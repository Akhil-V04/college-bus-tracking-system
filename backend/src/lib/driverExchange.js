const crypto = require('crypto');
const ExcelJS = require('exceljs');

const DRIVER_COLUMNS = [
  { key: 'driverCode', header: 'Driver Code', width: 18 },
  { key: 'name', header: 'Name', width: 28 },
  { key: 'phone', header: 'Phone', width: 18 },
  { key: 'licenseNo', header: 'License Number', width: 22 },
  { key: 'routeNo', header: 'Route Number', width: 18 },
];

class DriverExchangeError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.name = 'DriverExchangeError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalized(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizedKey(value) {
  return normalized(value).toLocaleUpperCase('en-IN');
}

function masterFingerprint(drivers) {
  const value = drivers
    .map((driver) => [
      driver.id, driver.driverCode, driver.name, driver.phone, driver.licenseNo,
      driver.status, driver.sessionVersion, driver.updatedAt?.toISOString?.() || driver.updatedAt,
      driver.assignedRoute?.id || null,
    ])
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

async function parseDriverWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); }
  catch (_error) { throw new DriverExchangeError('The XLSX file is damaged, encrypted, or unsupported'); }
  const sheet = workbook.getWorksheet('Drivers') || workbook.worksheets[0];
  if (!sheet) throw new DriverExchangeError('The workbook has no Drivers worksheet');
  if (sheet.actualRowCount > 1001) throw new DriverExchangeError('The driver workbook exceeds 1000 rows');
  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, column) => {
    const header = normalizedKey(cell.text).replace(/[^A-Z0-9]/g, '');
    const match = DRIVER_COLUMNS.find((item) => normalizedKey(item.header).replace(/[^A-Z0-9]/g, '') === header);
    if (match) headerMap.set(match.key, column);
  });
  const missing = DRIVER_COLUMNS.slice(0, 4).filter((item) => !headerMap.has(item.key));
  if (missing.length) throw new DriverExchangeError(`Missing required columns: ${missing.map((item) => item.header).join(', ')}`);
  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(DRIVER_COLUMNS.map((column) => {
      const cell = headerMap.has(column.key) ? row.getCell(headerMap.get(column.key)) : null;
      if (cell?.value && typeof cell.value === 'object' && ('formula' in cell.value || 'sharedFormula' in cell.value)) {
        throw new DriverExchangeError(`Row ${rowNumber} contains a formula in ${column.header}`);
      }
      return [column.key, normalized(cell?.text || cell?.value)];
    }));
    if (Object.values(values).every((value) => !value)) continue;
    rows.push({ rowNumber, ...values });
  }
  if (!rows.length) throw new DriverExchangeError('The workbook contains no driver rows');
  return rows;
}

async function loadDriverMaster(db) {
  return db.driver.findMany({
    select: {
      id: true, driverCode: true, name: true, phone: true, licenseNo: true,
      status: true, sessionVersion: true, updatedAt: true,
      assignedRoute: { select: { id: true, routeNo: true, name: true } },
      trips: { where: { status: 'RUNNING' }, select: { id: true }, take: 1 },
    },
    orderBy: { driverCode: 'asc' },
  });
}

async function previewDriverImport(db, buffer) {
  const [rows, drivers, routes] = await Promise.all([
    parseDriverWorkbook(buffer),
    loadDriverMaster(db),
    db.routeService.findMany({ select: { id: true, routeNo: true, name: true, driverId: true } }),
  ]);
  const driverByCode = new Map(drivers.map((item) => [normalizedKey(item.driverCode), item]));
  const driverByPhone = new Map(drivers.map((item) => [normalizedKey(item.phone), item]));
  const driverByLicense = new Map(drivers.map((item) => [normalizedKey(item.licenseNo), item]));
  const routeByNo = new Map(routes.map((item) => [normalizedKey(item.routeNo), item]));
  const importedRowsByCode = new Map(rows.map((item) => [normalizedKey(item.driverCode), item]));
  const seenCodes = new Set();
  const seenPhones = new Set();
  const seenLicenses = new Set();
  const seenRoutes = new Set();
  const results = rows.map((row) => {
    const errors = [];
    for (const [field, label, max] of [
      ['driverCode', 'Driver Code', 50], ['name', 'Name', 150], ['phone', 'Phone', 30], ['licenseNo', 'License Number', 100],
    ]) {
      if (!row[field]) errors.push(`${label} is required`);
      if (row[field].length > max) errors.push(`${label} exceeds ${max} characters`);
    }
    if (row.phone && row.phone.length < 5) errors.push('Phone must contain at least 5 characters');
    const codeKey = normalizedKey(row.driverCode);
    const phoneKey = normalizedKey(row.phone);
    const licenseKey = normalizedKey(row.licenseNo);
    const routeKey = normalizedKey(row.routeNo);
    if (seenCodes.has(codeKey)) errors.push('Driver Code is duplicated in the workbook');
    if (seenPhones.has(phoneKey)) errors.push('Phone is duplicated in the workbook');
    if (seenLicenses.has(licenseKey)) errors.push('License Number is duplicated in the workbook');
    if (routeKey && seenRoutes.has(routeKey)) errors.push('Route Number is assigned to more than one workbook row');
    seenCodes.add(codeKey); seenPhones.add(phoneKey); seenLicenses.add(licenseKey); if (routeKey) seenRoutes.add(routeKey);
    const route = routeKey ? routeByNo.get(routeKey) : null;
    if (routeKey && !route) errors.push('Route Number does not exist');
    const existing = driverByCode.get(codeKey);
    for (const [field, label, key, owner] of [
      ['phone', 'Phone', phoneKey, driverByPhone.get(phoneKey)],
      ['licenseNo', 'License Number', licenseKey, driverByLicense.get(licenseKey)],
    ]) {
      if (!owner || owner.id === existing?.id) continue;
      const ownerImport = importedRowsByCode.get(normalizedKey(owner.driverCode));
      const ownerChangesAway = ownerImport && normalizedKey(ownerImport[field]) !== key;
      if (!ownerChangesAway) errors.push(`${label} belongs to another driver record`);
    }
    const normalizedRow = {
      driverCode: row.driverCode, name: row.name, phone: row.phone, licenseNo: row.licenseNo,
      routeServiceId: route?.id || null, routeNo: route?.routeNo || null,
    };
    const changed = !existing || existing.name !== row.name || existing.phone !== row.phone ||
      existing.licenseNo !== row.licenseNo || existing.status !== 'ACTIVE' ||
      (existing.assignedRoute?.id || null) !== normalizedRow.routeServiceId;
    return {
      rowNumber: row.rowNumber,
      driverCode: row.driverCode,
      valid: errors.length === 0,
      errors,
      action: existing ? (changed ? 'UPDATE' : 'UNCHANGED') : 'CREATE',
      normalized: normalizedRow,
      existingId: existing?.id || null,
    };
  });
  const importedCodes = new Set(results.map((item) => normalizedKey(item.driverCode)));
  const removals = drivers
    .filter((driver) => driver.status === 'ACTIVE' && !importedCodes.has(normalizedKey(driver.driverCode)))
    .map((driver) => ({
      id: driver.id, driverCode: driver.driverCode, name: driver.name,
      activeTripId: driver.trips[0]?.id || null,
      action: driver.trips.length ? 'BLOCKED_ACTIVE_TRIP' : 'DEACTIVATE',
    }));
  const invalidRows = results.filter((item) => !item.valid).length;
  const blockedRemovals = removals.filter((item) => item.activeTripId).length;
  return {
    previewDigest: crypto.createHash('sha256').update(buffer).digest('hex'),
    masterVersion: masterFingerprint(drivers),
    summary: {
      totalRows: results.length,
      create: results.filter((item) => item.action === 'CREATE').length,
      update: results.filter((item) => item.action === 'UPDATE').length,
      unchanged: results.filter((item) => item.action === 'UNCHANGED').length,
      deactivate: removals.length - blockedRemovals,
      invalidRows,
      blockedRemovals,
    },
    rows: results.map(({ normalized: _normalized, existingId: _existingId, ...item }) => item),
    removals,
    normalizedRows: results.map((item) => ({ ...item.normalized, existingId: item.existingId, valid: item.valid })),
    removalIds: removals.filter((item) => !item.activeTripId).map((item) => item.id),
  };
}

async function buildDriverTemplate(db) {
  const routes = await db.routeService.findMany({ select: { routeNo: true, name: true }, orderBy: { routeNo: 'asc' } });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Drivers');
  sheet.columns = DRIVER_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const column of ['A', 'C', 'D', 'E']) sheet.getColumn(column).numFmt = '@';
  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRows([
    ['Driver Import Instructions'],
    ['Use one row per active driver. Drivers omitted from a confirmed import are deactivated unless they own a running trip.'],
    ['Passwords are never accepted in this workbook. New credentials are returned once after confirmed import.'],
  ]);
  const routeSheet = workbook.addWorksheet('Routes');
  routeSheet.columns = [{ header: 'Route Number', key: 'routeNo', width: 18 }, { header: 'Route Name', key: 'name', width: 30 }];
  routeSheet.addRows(routes);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
  DRIVER_COLUMNS, DriverExchangeError, buildDriverTemplate, loadDriverMaster,
  masterFingerprint, parseDriverWorkbook, previewDriverImport,
};
