const path = require('path');
const ExcelJS = require('exceljs');

const MAX_IMPORT_ROWS = 10_000;
const MAX_IMPORT_COLUMNS = 30;
const MAX_CELL_LENGTH = 500;

const ROSTER_COLUMNS = [
  { key: 'passengerType', header: 'Passenger Type', width: 18 },
  { key: 'name', header: 'Name', width: 28 },
  { key: 'busPassId', header: 'Bus Pass ID', width: 18 },
  { key: 'rollNo', header: 'Student Roll Number', width: 22 },
  { key: 'facultyId', header: 'Faculty ID', width: 18 },
  { key: 'department', header: 'Department', width: 18 },
  { key: 'year', header: 'Year', width: 10 },
  { key: 'section', header: 'Section', width: 12 },
  { key: 'routeNo', header: 'Route Number', width: 16 },
  { key: 'boardingStop', header: 'Boarding Stop', width: 28 },
];

const HEADER_ALIASES = new Map([
  ['passengertype', 'passengerType'], ['type', 'passengerType'],
  ['name', 'name'], ['passengername', 'name'],
  ['buspassid', 'busPassId'], ['buspassnumber', 'busPassId'],
  ['studentrollnumber', 'rollNo'], ['studentrollno', 'rollNo'], ['rollnumber', 'rollNo'], ['rollno', 'rollNo'],
  ['facultyid', 'facultyId'], ['facultyidentifier', 'facultyId'],
  ['department', 'department'], ['dept', 'department'],
  ['year', 'year'], ['academicyearnumber', 'year'], ['section', 'section'],
  ['routenumber', 'routeNo'], ['routeno', 'routeNo'], ['busnumber', 'routeNo'],
  ['boardingstop', 'boardingStop'], ['stop', 'boardingStop'], ['stopname', 'boardingStop'],
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
  const worksheet = workbook.getWorksheet('Passengers') || workbook.worksheets[0];
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
  return matrix;
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
    rows.push({ rowNumber: matrixRow.sourceRowNumber || index + 1, values, formulaColumns });
  }
  if (!rows.length) throw new RosterExchangeError('The file contains headers but no passenger rows');
  return { rows, unknownHeaders };
}

async function parseRosterFile(buffer, originalName) {
  const extension = path.extname(originalName || '').toLowerCase();
  let matrix;
  if (extension === '.csv') matrix = parseCsvMatrix(buffer);
  else if (extension === '.xlsx') matrix = await parseXlsxMatrix(buffer);
  else throw new RosterExchangeError('Only .csv and .xlsx roster files are accepted');
  return { ...mapMatrixToRows(matrix), format: extension.slice(1) };
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
    requireValue(result, values, 'passengerType', 'Passenger Type');
    requireValue(result, values, 'name', 'Name');
    requireValue(result, values, 'busPassId', 'Bus Pass ID');
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
      if (!route.allowedStops.length) addIssue(result, 'errors', 'NO_PUBLISHED_SCHEDULE', `Route ${route.routeNo} has no published schedule`, 'Route Number');
      else {
        const matches = route.allowedStops.filter((stop) => normalizeLookup(stop.name) === normalizeLookup(values.boardingStop));
        if (matches.length === 1) boardingStop = matches[0];
        else if (matches.length > 1) addIssue(result, 'errors', 'AMBIGUOUS_STOP', 'Boarding Stop is duplicated on this route', 'Boarding Stop');
        else addIssue(result, 'errors', 'STOP_NOT_ON_ROUTE', `${values.boardingStop || 'Boarding stop'} is not on route ${route.routeNo}`, 'Boarding Stop');
      }
    }

    const identifiers = [
      [values.busPassId, 'Bus Pass ID', seenBusPasses, context.existingBusPassIds],
      [passengerType === 'STUDENT' ? values.rollNo : '', 'Student Roll Number', seenRollNos, context.existingRollNos],
      [passengerType === 'FACULTY' ? values.facultyId : '', 'Faculty ID', seenFacultyIds, context.existingFacultyIds],
    ];
    for (const [value, label, seen, existing] of identifiers) {
      if (!value) continue;
      const identifier = normalizeLookup(value);
      if (existing.has(identifier)) addIssue(result, 'errors', 'DUPLICATE_EXISTING_IDENTIFIER', `${label} already exists in this draft`, label);
      if (seen.has(identifier)) addIssue(result, 'errors', 'DUPLICATE_FILE_IDENTIFIER', `${label} duplicates file row ${seen.get(identifier)}`, label);
      else seen.set(identifier, rawRow.rowNumber);
    }

    if (passengerType === 'STUDENT' && values.department && Number.isInteger(year) && values.section && !context.advisorKeys.has(classKey(values.department, year, values.section))) {
      addIssue(result, 'warnings', 'MISSING_ADVISOR', `No class advisor is configured for ${values.department} Year ${year} Section ${values.section}`);
    }

    if (route && boardingStop && (passengerType === 'STUDENT' || passengerType === 'FACULTY')) {
      result.normalized = {
        routeServiceId: route.id,
        boardingStopId: boardingStop.id,
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
    const existing = context.existingCountsByRoute.get(route.id) || 0;
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
  const [roster, routes, existingPassengers, advisors] = await Promise.all([
    db.transportRoster.findUnique({ where: { id: rosterId } }),
    db.routeService.findMany({
      select: {
        id: true, routeNo: true, name: true, capacity: true,
        schedules: {
          where: { status: 'PUBLISHED' },
          select: { direction: true, stops: { select: { stop: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: { routeNo: 'asc' },
    }),
    db.rosterPassenger.findMany({
      where: { rosterId },
      select: { routeServiceId: true, busPassId: true, rollNo: true, facultyId: true },
    }),
    db.classAdvisor.findMany({ select: { department: true, year: true, section: true } }),
  ]);

  if (!roster) throw new RosterExchangeError('Roster not found', 404);
  if (roster.status !== 'DRAFT') throw new RosterExchangeError('Only draft rosters can import passengers', 409);

  const contextRoutes = routes.map((route) => {
    const uniqueStops = new Map();
    for (const schedule of route.schedules) {
      for (const entry of schedule.stops) uniqueStops.set(entry.stop.id, entry.stop);
    }
    return { ...route, allowedStops: [...uniqueStops.values()] };
  });
  const existingCountsByRoute = new Map();
  for (const passenger of existingPassengers) {
    existingCountsByRoute.set(passenger.routeServiceId, (existingCountsByRoute.get(passenger.routeServiceId) || 0) + 1);
  }

  return {
    roster,
    context: {
      routes: contextRoutes,
      existingCountsByRoute,
      existingBusPassIds: new Set(existingPassengers.map((item) => normalizeLookup(item.busPassId))),
      existingRollNos: new Set(existingPassengers.filter((item) => item.rollNo).map((item) => normalizeLookup(item.rollNo))),
      existingFacultyIds: new Set(existingPassengers.filter((item) => item.facultyId).map((item) => normalizeLookup(item.facultyId))),
      advisorKeys: new Set(advisors.map((item) => classKey(item.department, item.year, item.section))),
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
  const results = validateRosterRows(parsed.rows, context);
  const rawByRow = new Map(parsed.rows.map((row) => [row.rowNumber, row]));
  return {
    roster: { id: roster.id, name: roster.name, academicYear: roster.academicYear, version: roster.version },
    fileName: path.basename(originalName),
    format: parsed.format,
    unknownHeaders: parsed.unknownHeaders,
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
  worksheet.autoFilter = { from: 'A1', to: 'J1' };
  for (const column of ['C', 'D', 'E', 'I']) worksheet.getColumn(column).numFmt = '@';
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
    ['Route Number', 'Use the operational route/bus number from the Route & Stop Reference sheet.'],
    ['Boarding Stop', 'Must match a published schedule stop for the chosen route.'],
    ['Identifiers', 'Bus Pass ID, Student Roll Number, and Faculty ID must be unique within the roster.'],
    ['Capacity', 'The existing draft rows plus the import must not exceed a route’s configured capacity.'],
    ['Formulas', 'Formula cells are rejected. Enter identifiers and names as plain values.'],
    ['Limits', `Maximum ${MAX_IMPORT_ROWS.toLocaleString('en-IN')} passenger rows and a 5 MB upload.`],
  ].forEach((row) => instructions.addRow(row));
  instructions.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  const passengers = workbook.addWorksheet('Passengers');
  configurePassengerSheet(passengers);

  const examples = workbook.addWorksheet('Examples');
  configurePassengerSheet(examples);
  examples.addRow({
    passengerType: 'STUDENT', name: 'Example Student (do not import)', busPassId: 'PASS-EXAMPLE-001',
    rollNo: 'ROLL-EXAMPLE-001', department: 'CSE', year: 2, section: 'A',
    routeNo: routeReferences[0]?.routeNo || '01', boardingStop: routeReferences[0]?.stops[0]?.name || 'Example Stop',
  });
  examples.addRow({
    passengerType: 'FACULTY', name: 'Example Faculty (do not import)', busPassId: 'PASS-EXAMPLE-002',
    facultyId: 'FAC-EXAMPLE-001', department: 'CSE', routeNo: routeReferences[0]?.routeNo || '01',
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
    passenger.passengerType, passenger.name, passenger.busPassId, passenger.rollNo, passenger.facultyId,
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
      busPassId: passenger.busPassId,
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
  parseCsvMatrix,
  parseRosterFile,
  previewRosterImport,
  summarizeResults,
  validateRosterRows,
};