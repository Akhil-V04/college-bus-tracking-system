const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

const MAX_IMPORT_ROWS = 10_000;
const MAX_IMPORT_COLUMNS = 30;
const MAX_CELL_LENGTH = 500;

const ROSTER_COLUMNS = [
  { key: 'passengerType', header: 'Passenger Type', width: 18 },
  { key: 'name', header: 'Name', width: 28 },
  { key: 'rollNo', header: 'Student Roll Number', width: 22 },
  { key: 'facultyId', header: 'Faculty ID', width: 18 },
  { key: 'department', header: 'Department', width: 18 },
  { key: 'year', header: 'Year', width: 10 },
  { key: 'section', header: 'Section', width: 12 },
  { key: 'routeNo', header: 'Route Number', width: 16 },
  { key: 'boardingStop', header: 'Boarding Stop', width: 28 },
];

const HEADER_ALIASES = new Map([
  ['passengertype', 'passengerType'], ['type', 'passengerType'], ['category', 'passengerType'], ['role', 'passengerType'],
  ['name', 'name'], ['passengername', 'name'], ['studentname', 'name'], ['facultyname', 'name'], ['fullname', 'name'],
  ['buspassid', 'busPassId'], ['buspassnumber', 'busPassId'], ['passid', 'busPassId'], ['passnumber', 'busPassId'], ['passno', 'busPassId'],
  ['studentrollnumber', 'rollNo'], ['studentrollno', 'rollNo'], ['rollnumber', 'rollNo'], ['rollno', 'rollNo'], ['roll', 'rollNo'], ['htno', 'rollNo'], ['hallticketno', 'rollNo'], ['hallticketnumber', 'rollNo'], ['regno', 'rollNo'], ['registrationno', 'rollNo'], ['pin', 'rollNo'], ['pinno', 'rollNo'],
  ['facultyid', 'facultyId'], ['facultyidentifier', 'facultyId'], ['staffid', 'facultyId'], ['empid', 'facultyId'], ['employeeid', 'facultyId'],
  ['department', 'department'], ['dept', 'department'], ['branch', 'department'], ['course', 'department'],
  ['year', 'year'], ['academicyearnumber', 'year'], ['yr', 'year'], ['classyear', 'year'],
  ['section', 'section'], ['sec', 'section'],
  ['routenumber', 'routeNo'], ['routeno', 'routeNo'], ['busnumber', 'routeNo'], ['busno', 'routeNo'], ['route', 'routeNo'],
  ['routename', 'routeName'], ['busname', 'routeName'],
  ['academicyear', 'academicYear'], ['rosterversion', 'rosterVersion'], ['version', 'rosterVersion'],
  ['boardingstop', 'boardingStop'], ['stop', 'boardingStop'], ['stopname', 'boardingStop'], ['boardingpoint', 'boardingStop'], ['pickuppoint', 'boardingStop'], ['pickupstop', 'boardingStop'], ['pickup', 'boardingStop'], ['stoplocation', 'boardingStop'],
]);

class RosterExchangeError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'RosterExchangeError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeLookup(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-IN');
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function numericRouteAlias(value) {
  const text = normalizeText(value);
  return /^\d+$/.test(text) ? String(Number(text)) : null;
}

function classKey(department, year, section) {
  return `${normalizeLookup(department)}|${year}|${normalizeLookup(section)}`;
}

function csvSafeValue(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function encodeCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvSafeValue).join(','));
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

function parseCsvMatrix(buffer) {
  const input = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
      } else cell += character;
      continue;
    }
    if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ',') { row.push({ text: cell, formula: false }); cell = ''; }
    else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push({ text: cell, formula: false });
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) throw new RosterExchangeError('CSV contains an unterminated quoted value');
  if (cell.length || row.length) { row.push({ text: cell, formula: false }); rows.push(row); }
  return rows;
}

function cellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return { text: '', formula: false };
  if (value instanceof Date) return { text: value.toISOString(), formula: false };
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) return { text: '', formula: true };
    if (Array.isArray(value.richText)) return { text: value.richText.map((part) => part.text || '').join(''), formula: false };
    if ('text' in value) return { text: String(value.text ?? ''), formula: false };
    if ('result' in value) return { text: String(value.result ?? ''), formula: false };
  }
  return { text: String(value), formula: false };
}

async function parseXlsxMatrix(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer, { ignoreNodes: ['dataValidations', 'conditionalFormatting', 'drawing', 'extLst'] });
  } catch (_error) {
    throw new RosterExchangeError('The XLSX file is damaged, encrypted, or not a supported workbook');
  }
  let worksheet = workbook.getWorksheet('Passengers') ||
                  workbook.getWorksheet('Students') ||
                  workbook.getWorksheet('Passenger') ||
                  workbook.getWorksheet('Roster');
  if (!worksheet) {
    for (const sheet of workbook.worksheets) {
      const lower = sheet.name.toLowerCase();
      if (lower.includes('instruction') || lower.includes('example') || lower.includes('reference') || lower.includes('advisor')) {
        continue;
      }
      worksheet = sheet;
      break;
    }
  }
  if (!worksheet) worksheet = workbook.worksheets[0];
  if (!worksheet) throw new RosterExchangeError('The XLSX workbook has no worksheet');
  if (worksheet.actualRowCount > MAX_IMPORT_ROWS + 1) throw new RosterExchangeError(`The file exceeds the ${MAX_IMPORT_ROWS}-row import limit`);
  if (worksheet.actualColumnCount > MAX_IMPORT_COLUMNS) throw new RosterExchangeError(`The file exceeds the ${MAX_IMPORT_COLUMNS}-column safety limit`);
  const matrix = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    for (let column = 1; column <= worksheet.actualColumnCount; column += 1) values.push(cellValue(row.getCell(column)));
    values.sourceRowNumber = rowNumber;
    matrix.push(values);
  });

  const advisorSheet = workbook.getWorksheet('Class Advisors') || workbook.getWorksheet('Advisors') || workbook.getWorksheet('ClassAdvisors');
  const advisorRows = [];
  if (advisorSheet && advisorSheet.actualRowCount > 1) {
    const headers = [];
    const headerRow = advisorSheet.getRow(1);
    for (let c = 1; c <= advisorSheet.actualColumnCount; c += 1) {
      headers.push(normalizeHeader(cellValue(headerRow.getCell(c)).text));
    }
    const deptIdx = headers.findIndex((h) => h.includes('dept') || h.includes('depart') || h.includes('branch') || h.includes('course'));
    const yrIdx = headers.findIndex((h) => h.includes('year') || h.includes('yr') || h.includes('class'));
    const secIdx = headers.findIndex((h) => h.includes('sec'));
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('advisor') || h.includes('faculty'));
    const emailIdx = headers.findIndex((h) => h.includes('mail') || h.includes('email'));
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact'));

    if (deptIdx >= 0 && yrIdx >= 0 && nameIdx >= 0 && emailIdx >= 0) {
      advisorSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const dept = normalizeText(cellValue(row.getCell(deptIdx + 1)).text);
        const yr = Number(cellValue(row.getCell(yrIdx + 1)).text);
        const secRaw = secIdx >= 0 ? normalizeText(cellValue(row.getCell(secIdx + 1)).text) : '';
        const name = normalizeText(cellValue(row.getCell(nameIdx + 1)).text);
        const email = normalizeText(cellValue(row.getCell(emailIdx + 1)).text);
        const phone = phoneIdx >= 0 ? normalizeText(cellValue(row.getCell(phoneIdx + 1)).text) : '';

        if (dept && Number.isInteger(yr) && yr > 0 && name && email) {
          const sections = secRaw
            ? secRaw.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
            : ['ALL'];
          advisorRows.push({
            department: dept.toUpperCase(),
            year: yr,
            sections: sections.length ? sections : ['ALL'],
            rawSection: secRaw,
            name,
            email,
            phone: phone || '9000000000',
          });
        }
      });
    }
  }

  return { matrix, advisorRows };
}

function isBlankMatrixRow(row) {
  return row.every((cell) => normalizeText(cell.text) === '');
}

function mapMatrixToRows(matrix) {
  if (matrix.some((row) => row.length > MAX_IMPORT_COLUMNS)) {
    throw new RosterExchangeError('The file exceeds the ' + MAX_IMPORT_COLUMNS + '-column safety limit');
  }
  const headerIndex = matrix.findIndex((row) => !isBlankMatrixRow(row));
  if (headerIndex < 0) throw new RosterExchangeError('The file is empty');
  const headerRow = matrix[headerIndex];
  const positions = new Map();
  const unknownHeaders = [];
  headerRow.forEach((cell, index) => {
    const rawHeader = normalizeText(cell.text);
    if (!rawHeader) return;
    const key = HEADER_ALIASES.get(normalizeHeader(rawHeader));
    if (!key) { unknownHeaders.push(rawHeader); return; }
    if (positions.has(key)) throw new RosterExchangeError(`Column "${rawHeader}" appears more than once`);
    positions.set(key, index);
  });
  const missing = ROSTER_COLUMNS.filter((column) => !positions.has(column.key)).map((column) => column.header);
  if (missing.length) throw new RosterExchangeError(`Missing required columns: ${missing.join(', ')}`);

  const rows = [];
  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const matrixRow = matrix[index];
    if (isBlankMatrixRow(matrixRow)) continue;
    if (rows.length >= MAX_IMPORT_ROWS) throw new RosterExchangeError(`The file exceeds the ${MAX_IMPORT_ROWS}-row import limit`);
    const values = {};
    const formulaColumns = [];
    for (const column of ROSTER_COLUMNS) {
      const cell = matrixRow[positions.get(column.key)] || { text: '', formula: false };
      const text = normalizeText(cell.text);
      if (text.length > MAX_CELL_LENGTH) throw new RosterExchangeError(`Row ${matrixRow.sourceRowNumber || index + 1}, ${column.header} exceeds ${MAX_CELL_LENGTH} characters`);
      values[column.key] = text;
      if (cell.formula) formulaColumns.push(column.header);
    }
    if (positions.has('busPassId')) {
      const cell = matrixRow[positions.get('busPassId')] || { text: '', formula: false };
      values.busPassId = normalizeText(cell.text);
    }
    rows.push({ rowNumber: matrixRow.sourceRowNumber || index + 1, values, formulaColumns });
  }
  if (!rows.length) throw new RosterExchangeError('The file contains headers but no passenger rows');
  return { rows, unknownHeaders };
}

async function parseRosterFile(buffer, originalName) {
  const extension = path.extname(originalName || '').toLowerCase();
  let matrix;
  let advisorRows = [];
  if (extension === '.csv') {
    matrix = parseCsvMatrix(buffer);
  } else if (extension === '.xlsx') {
    const result = await parseXlsxMatrix(buffer);
    matrix = result.matrix;
    advisorRows = result.advisorRows;
  } else {
    throw new RosterExchangeError('Only .csv and .xlsx roster files are accepted');
  }
  return { ...mapMatrixToRows(matrix), format: extension.slice(1), advisors: advisorRows };
}
function buildRouteLookups(routes) {
  const exact = new Map();
  const numeric = new Map();
  for (const route of routes) {
    const exactKey = normalizeLookup(route.routeNo);
    if (!exact.has(exactKey)) exact.set(exactKey, []);
    exact.get(exactKey).push(route);
    const numericKey = numericRouteAlias(route.routeNo);
    if (numericKey !== null) {
      if (!numeric.has(numericKey)) numeric.set(numericKey, []);
      numeric.get(numericKey).push(route);
    }
  }
  return { exact, numeric };
}

function resolveRoute(value, lookups) {
  const exactMatches = lookups.exact.get(normalizeLookup(value)) || [];
  if (exactMatches.length === 1) return { route: exactMatches[0] };
  if (exactMatches.length > 1) return { error: 'Route number is ambiguous' };
  const numericKey = numericRouteAlias(value);
  const numericMatches = numericKey === null ? [] : lookups.numeric.get(numericKey) || [];
  if (numericMatches.length === 1) return { route: numericMatches[0] };
  if (numericMatches.length > 1) return { error: 'Route number is ambiguous; preserve its leading zeroes' };
  return { error: 'Route number does not exist' };
}

function addIssue(result, kind, code, message, column = undefined) {
  result[kind].push({ code, message, ...(column ? { column } : {}) });
}

function requireValue(result, values, key, label) {
  if (!values[key]) {
    addIssue(result, 'errors', 'REQUIRED', `${label} is required`, label);
    return false;
  }
  return true;
}

function checkLength(result, value, max, label) {
  if (value && value.length > max) addIssue(result, 'errors', 'TOO_LONG', `${label} must not exceed ${max} characters`, label);
}

function validateRosterRows(rawRows, context) {
  const routeLookups = buildRouteLookups(context.routes);
  const seenBusPasses = new Map();
  const seenRollNos = new Map();
  const seenFacultyIds = new Map();
  const results = rawRows.map((rawRow) => {
    const values = Object.fromEntries(Object.entries(rawRow.values).map(([key, value]) => [key, normalizeText(value)]));
    const result = { rowNumber: rawRow.rowNumber, valid: false, errors: [], warnings: [], normalized: null };

    for (const column of rawRow.formulaColumns) addIssue(result, 'errors', 'FORMULA_NOT_ALLOWED', `${column} must contain a value, not a formula`, column);

    if (!values.passengerType) {
      if (values.rollNo) values.passengerType = 'STUDENT';
      else if (values.facultyId) values.passengerType = 'FACULTY';
    }

    if (!values.busPassId) {
      if (values.rollNo) values.busPassId = `PASS-${values.rollNo}`;
      else if (values.facultyId) values.busPassId = `PASS-${values.facultyId}`;
    }

    requireValue(result, values, 'passengerType', 'Passenger Type');
    requireValue(result, values, 'name', 'Name');
    requireValue(result, values, 'routeNo', 'Route Number');
    requireValue(result, values, 'boardingStop', 'Boarding Stop');
    checkLength(result, values.name, 150, 'Name');
    checkLength(result, values.busPassId, 100, 'Bus Pass ID');
    checkLength(result, values.rollNo, 100, 'Student Roll Number');
    checkLength(result, values.facultyId, 100, 'Faculty ID');
    checkLength(result, values.department, 100, 'Department');
    checkLength(result, values.section, 30, 'Section');

    const passengerType = normalizeLookup(values.passengerType);
    if (passengerType !== 'STUDENT' && passengerType !== 'FACULTY') {
      addIssue(result, 'errors', 'INVALID_PASSENGER_TYPE', 'Passenger Type must be STUDENT or FACULTY', 'Passenger Type');
    }

    let year = null;
    if (passengerType === 'STUDENT') {
      requireValue(result, values, 'rollNo', 'Student Roll Number');
      requireValue(result, values, 'department', 'Department');
      requireValue(result, values, 'year', 'Year');
      requireValue(result, values, 'section', 'Section');
      if (values.facultyId) addIssue(result, 'errors', 'STUDENT_HAS_FACULTY_ID', 'Faculty ID must be blank for a student', 'Faculty ID');
      year = Number(values.year);
      if (!Number.isInteger(year) || year < 1 || year > 10) addIssue(result, 'errors', 'INVALID_YEAR', 'Year must be a whole number from 1 to 10', 'Year');
    } else if (passengerType === 'FACULTY') {
      requireValue(result, values, 'facultyId', 'Faculty ID');
      if (values.rollNo || values.year || values.section) {
        addIssue(result, 'errors', 'FACULTY_HAS_STUDENT_FIELDS', 'Student Roll Number, Year, and Section must be blank for faculty', 'Passenger Type');
      }
    }

    const routeResolution = resolveRoute(values.routeNo, routeLookups);
    const route = routeResolution.route;
    if (!route) addIssue(result, 'errors', 'UNKNOWN_ROUTE', routeResolution.error, 'Route Number');

    let boardingStop = null;
    if (route) {
      if (!route.hasPublishedSchedule) {
        addIssue(result, 'warnings', 'NO_PUBLISHED_SCHEDULE', `Route ${route.routeNo} has no published schedule yet`);
      }

      const requestedStopName = values.boardingStop ? values.boardingStop.trim() : '';
      if (!requestedStopName) {
        addIssue(result, 'errors', 'REQUIRED', 'Boarding Stop is required', 'Boarding Stop');
      } else {
        const routeStops = route.allowedStops || [];
        const routeMatches = routeStops.filter((stop) => normalizeLookup(stop.name) === normalizeLookup(requestedStopName));
        if (routeMatches.length >= 1) {
          boardingStop = routeMatches[0];
        } else if (routeStops.length > 0 && (!context.allStops || !context.allStops.length)) {
          addIssue(result, 'errors', 'STOP_NOT_ON_ROUTE', `${requestedStopName} is not on route ${route.routeNo}`, 'Boarding Stop');
        } else {
          const globalMatches = (context.allStops || []).filter((stop) => normalizeLookup(stop.name) === normalizeLookup(requestedStopName));
          if (globalMatches.length >= 1) {
            boardingStop = globalMatches[0];
            if (routeStops.length > 0) {
              addIssue(result, 'warnings', 'STOP_NOT_ON_SCHEDULE', `Boarding stop "${boardingStop.name}" is not on Route ${route.routeNo}'s timetable schedule`);
            }
          } else {
            const normName = normalizeLookup(requestedStopName);
            let virtual = context.virtualStops ? context.virtualStops.get(normName) : null;
            if (!virtual) {
              virtual = {
                id: -((context.virtualStops ? context.virtualStops.size : 0) + 1),
                name: requestedStopName,
                isNew: true,
              };
              if (context.virtualStops) context.virtualStops.set(normName, virtual);
            }
            boardingStop = virtual;
            addIssue(result, 'warnings', 'NEW_STOP_RECORDED', `Stop "${requestedStopName}" recorded (boarding reference for database)`);
          }
        }
      }
    }

    const identifiers = [
      [rawRow.values?.busPassId ? values.busPassId : '', 'Bus Pass ID', seenBusPasses, context.existingBusPassIds],
      [passengerType === 'STUDENT' ? values.rollNo : '', 'Student Roll Number', seenRollNos, context.existingRollNos],
      [passengerType === 'FACULTY' ? values.facultyId : '', 'Faculty ID', seenFacultyIds, context.existingFacultyIds],
    ];
    for (const [value, label, seen, existing] of identifiers) {
      if (!value) continue;
      const identifier = normalizeLookup(value);
      if (!context.isOverwriteMode && existing && existing.has(identifier)) {
        addIssue(result, 'errors', 'DUPLICATE_EXISTING_IDENTIFIER', `${label} already exists in this draft`, label);
      }
      if (seen.has(identifier)) addIssue(result, 'errors', 'DUPLICATE_FILE_IDENTIFIER', `${label} duplicates file row ${seen.get(identifier)}`, label);
      else seen.set(identifier, rawRow.rowNumber);
    }

    if (passengerType === 'STUDENT' && values.department && Number.isInteger(year) && values.section) {
      const hasSpecific = context.advisorKeys.has(classKey(values.department, year, values.section));
      const hasAll = context.advisorKeys.has(classKey(values.department, year, 'ALL')) ||
                     context.advisorKeys.has(classKey(values.department, year, '*'));
      if (!hasSpecific && !hasAll) {
        addIssue(result, 'warnings', 'MISSING_ADVISOR', `No class advisor is configured for ${values.department} Year ${year} Section ${values.section}`);
      }
    }

    if (route && boardingStop && (passengerType === 'STUDENT' || passengerType === 'FACULTY')) {
      result.normalized = {
        routeServiceId: route.id,
        boardingStopId: boardingStop.id,
        boardingStopName: boardingStop.name,
        isNewStop: Boolean(boardingStop.isNew),
        passengerType,
        name: values.name,
        busPassId: values.busPassId,
        rollNo: passengerType === 'STUDENT' ? values.rollNo : null,
        facultyId: passengerType === 'FACULTY' ? values.facultyId : null,
        department: values.department || null,
        year: passengerType === 'STUDENT' && Number.isInteger(year) ? year : null,
        section: passengerType === 'STUDENT' ? values.section : null,
        routeNo: route.routeNo,
        boardingStop: boardingStop.name,
      };
    }
    return result;
  });

  const candidateCounts = new Map();
  for (const result of results) {
    if (result.errors.length || !result.normalized) continue;
    const routeId = result.normalized.routeServiceId;
    candidateCounts.set(routeId, (candidateCounts.get(routeId) || 0) + 1);
  }
  for (const route of context.routes) {
    const existing = context.isOverwriteMode ? 0 : (context.existingCountsByRoute.get(route.id) || 0);
    const incoming = candidateCounts.get(route.id) || 0;
    if (existing + incoming <= route.capacity) continue;
    for (const result of results) {
      if (result.normalized?.routeServiceId === route.id && !result.errors.length) {
        addIssue(result, 'errors', 'OVER_CAPACITY', `Route ${route.routeNo} would exceed capacity (${existing + incoming}/${route.capacity})`, 'Route Number');
      }
    }
  }
  for (const result of results) result.valid = result.errors.length === 0;
  return results;
}
async function loadValidationContext(db, rosterId) {
  const [roster, routes, existingPassengers, advisors, allStops] = await Promise.all([
    db.transportRoster.findUnique({ where: { id: rosterId } }),
    db.routeService.findMany({
      select: {
        id: true, routeNo: true, name: true, capacity: true,
        schedules: {
          select: { status: true, direction: true, stops: { select: { stop: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: { routeNo: 'asc' },
    }),
    db.rosterPassenger.findMany({
      where: { rosterId },
      select: { routeServiceId: true, busPassId: true, rollNo: true, facultyId: true },
    }),
    db.classAdvisor.findMany({ select: { department: true, year: true, section: true } }),
    db.stop.findMany({ select: { id: true, name: true } }),
  ]);

  if (!roster) throw new RosterExchangeError('Roster not found', 404);
  if (roster.status !== 'DRAFT') throw new RosterExchangeError('Only draft rosters can import passengers', 409);

  const contextRoutes = routes.map((route) => {
    const uniqueStops = new Map();
    let hasPublished = false;
    for (const schedule of route.schedules) {
      if (schedule.status === 'PUBLISHED') hasPublished = true;
      for (const entry of schedule.stops) uniqueStops.set(entry.stop.id, entry.stop);
    }
    return {
      ...route,
      allowedStops: [...uniqueStops.values()],
      hasPublishedSchedule: hasPublished,
    };
  });
  const existingCountsByRoute = new Map();
  for (const passenger of existingPassengers) {
    existingCountsByRoute.set(passenger.routeServiceId, (existingCountsByRoute.get(passenger.routeServiceId) || 0) + 1);
  }

  const advisorKeys = new Set(advisors.map((item) => classKey(item.department, item.year, item.section)));

  return {
    roster,
    context: {
      routes: contextRoutes,
      allStops: allStops || [],
      virtualStops: new Map(),
      existingCountsByRoute,
      existingBusPassIds: new Set(existingPassengers.map((item) => normalizeLookup(item.busPassId))),
      existingRollNos: new Set(existingPassengers.filter((item) => item.rollNo).map((item) => normalizeLookup(item.rollNo))),
      existingFacultyIds: new Set(existingPassengers.filter((item) => item.facultyId).map((item) => normalizeLookup(item.facultyId))),
      advisorKeys,
    },
  };
}

function summarizeResults(results) {
  return {
    totalRows: results.length,
    validRows: results.filter((row) => row.valid).length,
    invalidRows: results.filter((row) => !row.valid).length,
    warningRows: results.filter((row) => row.warnings.length > 0).length,
  };
}

async function previewRosterImport(db, rosterId, buffer, originalName) {
  const parsed = await parseRosterFile(buffer, originalName);
  const { roster, context } = await loadValidationContext(db, rosterId);
  context.isOverwriteMode = true;

  // If the uploaded file had a Class Advisors sheet, integrate them into context.advisorKeys
  if (parsed.advisors && parsed.advisors.length > 0) {
    for (const adv of parsed.advisors) {
      for (const sec of adv.sections) {
        context.advisorKeys.add(classKey(adv.department, adv.year, sec));
      }
    }
  }

  const results = validateRosterRows(parsed.rows, context);
  const rawByRow = new Map(parsed.rows.map((row) => [row.rowNumber, row]));
  return {
    roster: { id: roster.id, name: roster.name, academicYear: roster.academicYear, version: roster.version },
    fileName: path.basename(originalName),
    format: parsed.format,
    previewDigest: crypto.createHash('sha256').update(buffer).digest('hex'),
    unknownHeaders: parsed.unknownHeaders,
    advisorsFound: parsed.advisors ? parsed.advisors.length : 0,
    summary: summarizeResults(results),
    rows: results.map((result) => ({
      rowNumber: result.rowNumber,
      valid: result.valid,
      values: rawByRow.get(result.rowNumber)?.values,
      errors: result.errors,
      warnings: result.warnings,
    })),
    normalizedRows: results.filter((result) => result.valid).map((result) => result.normalized),
  };
}

function styleHeader(row) {
  row.height = 24;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
}

function configurePassengerSheet(worksheet) {
  worksheet.columns = ROSTER_COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }));
  styleHeader(worksheet.getRow(1));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'I1' };
  for (const column of ['C', 'D', 'H']) worksheet.getColumn(column).numFmt = '@';
  worksheet.dataValidations.add('A2:A10001', {
    type: 'list', allowBlank: false, formulae: ['"STUDENT,FACULTY"'],
    showErrorMessage: true, errorTitle: 'Passenger type', error: 'Choose STUDENT or FACULTY.',
  });
}

async function buildTemplateXlsx(routeReferences) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'College Bus Tracking System';
  workbook.title = 'Annual transport roster import template';
  workbook.subject = 'Admin roster draft import';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet('Instructions', { views: [{ state: 'frozen', ySplit: 1 }] });
  instructions.columns = [{ width: 24 }, { width: 95 }];
  instructions.addRow(['Rule', 'Requirement']);
  styleHeader(instructions.getRow(1));
  [
    ['Import behavior', 'Upload preview never changes live data. Import is allowed only into a DRAFT roster and is all-or-nothing.'],
    ['Passenger Type', 'Use STUDENT or FACULTY.'],
    ['Student fields', 'Students require Student Roll Number, Department, Year, and Section. Faculty ID must be blank.'],
    ['Faculty fields', 'Faculty require Faculty ID. Student Roll Number, Year, and Section must be blank. Department is optional.'],
    ['Class Advisors', 'Fill the Class Advisors sheet to automatically link advisors. A branch advisor can cover multiple sections (e.g. "A, B, C, D" or "ALL") for a year.'],
    ['Route Number', 'Use the operational route/bus number from the Route & Stop Reference sheet.'],
    ['Boarding Stop', 'Must match a schedule stop or a known bus stop. Unlisted stops will be registered as landmarks.'],
    ['Identifiers', 'Student Roll Number (for students) and Faculty ID (for faculty) must be unique within the roster.'],
    ['Capacity', 'The existing draft rows plus the import must not exceed a route’s configured capacity.'],
    ['Formulas', 'Formula cells are rejected. Enter identifiers and names as plain values.'],
    ['Limits', `Maximum ${MAX_IMPORT_ROWS.toLocaleString('en-IN')} passenger rows and a 5 MB upload.`],
  ].forEach((row) => instructions.addRow(row));
  instructions.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  const passengers = workbook.addWorksheet('Passengers');
  configurePassengerSheet(passengers);

  const advisors = workbook.addWorksheet('Class Advisors', { views: [{ state: 'frozen', ySplit: 1 }] });
  advisors.columns = [
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Section(s)', key: 'section', width: 24 },
    { header: 'Advisor Name', key: 'name', width: 28 },
    { header: 'Advisor Email', key: 'email', width: 34 },
    { header: 'Advisor Phone', key: 'phone', width: 18 },
  ];
  styleHeader(advisors.getRow(1));
  advisors.autoFilter = { from: 'A1', to: 'F1' };
  advisors.addRow({
    department: 'CSE',
    year: 1,
    section: 'A, B, C, D',
    name: 'Prof. K. Sharma (Branch Advisor)',
    email: 'sharma.cse@vbithyd.ac.in',
    phone: '9876543210',
  });
  advisors.addRow({
    department: 'CSE',
    year: 2,
    section: 'A, B, C, D',
    name: 'Dr. P. Reddy (Branch Advisor)',
    email: 'reddy.cse@vbithyd.ac.in',
    phone: '9876543211',
  });
  advisors.addRow({
    department: 'ECE',
    year: 1,
    section: 'ALL',
    name: 'Prof. S. Rao',
    email: 'rao.ece@vbithyd.ac.in',
    phone: '9876543212',
  });

  const examples = workbook.addWorksheet('Examples');
  configurePassengerSheet(examples);
  examples.addRow({
    passengerType: 'STUDENT', name: 'Example Student (do not import)',
    rollNo: '24B01A0501', department: 'CSE', year: 2, section: 'A',
    routeNo: routeReferences[0]?.routeNo || '01', boardingStop: routeReferences[0]?.stops[0]?.name || 'Example Stop',
  });
  examples.addRow({
    passengerType: 'FACULTY', name: 'Example Faculty (do not import)',
    facultyId: 'FAC-CSE-001', department: 'CSE', routeNo: routeReferences[0]?.routeNo || '01',
    boardingStop: routeReferences[0]?.stops[0]?.name || 'Example Stop',
  });

  const reference = workbook.addWorksheet('Route & Stop Reference', { views: [{ state: 'frozen', ySplit: 1 }] });
  reference.columns = [
    { header: 'Route Number', key: 'routeNo', width: 16 },
    { header: 'Route Name', key: 'routeName', width: 28 },
    { header: 'Capacity', key: 'capacity', width: 12 },
    { header: 'Published Direction', key: 'direction', width: 20 },
    { header: 'Boarding Stop', key: 'stopName', width: 30 },
    { header: 'Scheduled Time', key: 'scheduledTime', width: 18 },
  ];
  styleHeader(reference.getRow(1));
  reference.autoFilter = { from: 'A1', to: 'F1' };
  reference.getColumn('routeNo').numFmt = '@';
  for (const route of routeReferences) {
    if (!route.stops.length) {
      reference.addRow({ routeNo: route.routeNo, routeName: route.name, capacity: route.capacity });
      continue;
    }
    for (const stop of route.stops) {
      reference.addRow({ routeNo: route.routeNo, routeName: route.name, capacity: route.capacity, direction: stop.direction, stopName: stop.name, scheduledTime: stop.scheduledTime });
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildTemplateCsv() {
  return encodeCsv(ROSTER_COLUMNS.map((column) => column.header), []);
}
function exportRow(passenger) {
  return [
    passenger.passengerType, passenger.name, passenger.rollNo, passenger.facultyId,
    passenger.department, passenger.year, passenger.section, passenger.routeService.routeNo, passenger.boardingStop.name,
  ];
}

function buildRosterExportCsv(passengers) {
  return encodeCsv(ROSTER_COLUMNS.map((column) => column.header), passengers.map(exportRow));
}

async function buildRosterExportXlsx(roster, passengers) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'College Bus Tracking System';
  workbook.title = `${roster.name} roster export`;
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 24 }, { width: 45 }];
  summary.addRow(['Field', 'Value']);
  styleHeader(summary.getRow(1));
  summary.addRows([
    ['Roster', roster.name], ['Academic Year', roster.academicYear], ['Version', roster.version],
    ['Status', roster.status], ['Passenger Rows', passengers.length], ['Exported At', new Date()],
  ]);
  summary.getCell('B7').numFmt = 'yyyy-mm-dd hh:mm';

  const worksheet = workbook.addWorksheet('Passengers');
  configurePassengerSheet(worksheet);
  for (const passenger of passengers) {
    const row = worksheet.addRow({
      passengerType: passenger.passengerType,
      name: passenger.name,
      rollNo: passenger.rollNo,
      facultyId: passenger.facultyId,
      department: passenger.department,
      year: passenger.year,
      section: passenger.section,
      routeNo: passenger.routeService.routeNo,
      boardingStop: passenger.boardingStop.name,
    });
    row.alignment = { vertical: 'top' };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function loadRouteReferences(db) {
  const routes = await db.routeService.findMany({
    select: {
      routeNo: true, name: true, capacity: true,
      schedules: {
        where: { status: 'PUBLISHED' },
        select: {
          direction: true,
          stops: { orderBy: { sequenceOrder: 'asc' }, select: { scheduledTime: true, stop: { select: { name: true } } } },
        },
      },
    },
    orderBy: { routeNo: 'asc' },
  });
  return routes.map((route) => ({
    routeNo: route.routeNo,
    name: route.name,
    capacity: route.capacity,
    stops: route.schedules.flatMap((schedule) => schedule.stops.map((entry) => ({
      direction: schedule.direction, name: entry.stop.name, scheduledTime: entry.scheduledTime,
    }))),
  }));
}

module.exports = {
  MAX_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  ROSTER_COLUMNS,
  RosterExchangeError,
  buildRosterExportCsv,
  buildRosterExportXlsx,
  buildTemplateCsv,
  buildTemplateXlsx,
  csvSafeValue,
  loadRouteReferences,
  loadValidationContext,
  normalizeLookup,
  parseCsvMatrix,
  parseRosterFile,
  previewRosterImport,
  summarizeResults,
  validateRosterRows,
};
