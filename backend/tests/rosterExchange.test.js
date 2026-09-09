const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {
  ROSTER_COLUMNS,
  buildRosterExportCsv,
  buildRosterExportXlsx,
  buildTemplateCsv,
  buildTemplateXlsx,
  csvSafeValue,
  parseCsvMatrix,
  parseRosterFile,
  validateRosterRows,
} = require('../src/lib/rosterExchange');

function rawRow(rowNumber, overrides = {}) {
  return {
    rowNumber,
    formulaColumns: [],
    values: {
      passengerType: 'STUDENT',
      name: 'Akhil Student',
      busPassId: `PASS-${rowNumber}`,
      rollNo: `ROLL-${rowNumber}`,
      facultyId: '',
      department: 'CSE',
      year: '2',
      section: 'A',
      routeNo: '01',
      boardingStop: 'Central Stop',
      ...overrides,
    },
  };
}

function context(overrides = {}) {
  return {
    routes: [{ id: 1, routeNo: '01', name: 'Central', capacity: 50, allowedStops: [{ id: 10, name: 'Central Stop' }] }],
    existingCountsByRoute: new Map(),
    existingBusPassIds: new Set(),
    existingRollNos: new Set(),
    existingFacultyIds: new Set(),
    advisorKeys: new Set(['CSE|2|A']),
    ...overrides,
  };
}

test('CSV parser supports quoted commas and line breaks', () => {
  const rows = parseCsvMatrix(Buffer.from('Name,Notes\r\n"Doe, A","Line 1\nLine 2"\r\n'));
  assert.equal(rows[1][0].text, 'Doe, A');
  assert.equal(rows[1][1].text, 'Line 1\nLine 2');
});

test('CSV imports reject rows wider than the column safety limit', async () => {
  const headers = Array.from({ length: 31 }, (_, index) => 'Column ' + (index + 1)).join(',');
  await assert.rejects(
    () => parseRosterFile(Buffer.from(headers + '\r\n'), 'roster.csv'),
    /30-column safety limit/
  );
});

test('CSV exports neutralize spreadsheet formulas', () => {
  assert.equal(csvSafeValue('=2+2'), '"\'=2+2"');
  const buffer = buildRosterExportCsv([{
    passengerType: 'FACULTY',
    name: '=HYPERLINK("https://example.test")',
    busPassId: 'PASS-1',
    rollNo: null,
    facultyId: 'FAC-1',
    department: 'CSE',
    year: null,
    section: null,
    routeService: { routeNo: '01' },
    boardingStop: { name: 'Central Stop' },
  }]);
  assert.match(buffer.toString('utf8'), /"'=HYPERLINK/);
  assert.doesNotMatch(buffer.toString('utf8'), /,"=HYPERLINK/);
});

test('student and faculty rows normalize to one passenger model', () => {
  const rows = [
    rawRow(2),
    rawRow(3, {
      passengerType: 'Faculty',
      name: 'Faculty Member',
      busPassId: 'PASS-F',
      rollNo: '',
      facultyId: 'FAC-9',
      year: '',
      section: '',
    }),
  ];
  const results = validateRosterRows(rows, context());
  assert.equal(results[0].valid, true);
  assert.equal(results[0].normalized.passengerType, 'STUDENT');
  assert.equal(results[0].normalized.routeServiceId, 1);
  assert.equal(results[1].valid, true);
  assert.equal(results[1].normalized.passengerType, 'FACULTY');
  assert.equal(results[1].normalized.rollNo, null);
});

test('validation detects file duplicates, existing identifiers, bad stops, and missing advisors', () => {
  const rows = [
    rawRow(2, { busPassId: 'EXISTING', department: 'ECE' }),
    rawRow(3, { busPassId: 'EXISTING', boardingStop: 'Wrong Stop' }),
  ];
  const results = validateRosterRows(rows, context({ existingBusPassIds: new Set(['EXISTING']), advisorKeys: new Set() }));
  assert.ok(results[0].errors.some((issue) => issue.code === 'DUPLICATE_EXISTING_IDENTIFIER'));
  assert.ok(results[0].warnings.some((issue) => issue.code === 'MISSING_ADVISOR'));
  assert.ok(results[1].errors.some((issue) => issue.code === 'DUPLICATE_FILE_IDENTIFIER'));
  assert.ok(results[1].errors.some((issue) => issue.code === 'STOP_NOT_ON_ROUTE'));
});

test('capacity validation includes existing draft passengers', () => {
  const results = validateRosterRows(
    [rawRow(2), rawRow(3)],
    context({
      routes: [{ id: 1, routeNo: '01', name: 'Central', capacity: 2, allowedStops: [{ id: 10, name: 'Central Stop' }] }],
      existingCountsByRoute: new Map([[1, 1]]),
    })
  );
  assert.equal(results.every((row) => row.errors.some((issue) => issue.code === 'OVER_CAPACITY')), true);
});

test('route number with lost leading zero resolves when unambiguous', () => {
  const [result] = validateRosterRows([rawRow(2, { routeNo: '1' })], context());
  assert.equal(result.valid, true);
  assert.equal(result.normalized.routeNo, '01');
});

test('XLSX formula cells are detected and rejected', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Passengers');
  worksheet.addRow(ROSTER_COLUMNS.map((column) => column.header));
  worksheet.addRow(['STUDENT', 'Placeholder', 'PASS-2', 'ROLL-2', '', 'CSE', 2, 'A', '01', 'Central Stop']);
  worksheet.getCell('B2').value = { formula: '2+2', result: 4 };
  const parsed = await parseRosterFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'roster.xlsx');
  const [result] = validateRosterRows(parsed.rows, context());
  assert.ok(result.errors.some((issue) => issue.code === 'FORMULA_NOT_ALLOWED'));
});

test('generated XLSX template has instructions, empty import sheet, examples, and route reference', async () => {
  const buffer = await buildTemplateXlsx([{
    routeNo: '01', name: 'Central Route', capacity: 50,
    stops: [{ direction: 'MORNING', name: 'Central Stop', scheduledTime: '07:15' }],
  }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    'Instructions', 'Passengers', 'Examples', 'Route & Stop Reference',
  ]);
  assert.deepEqual(workbook.getWorksheet('Passengers').getRow(1).values.slice(1), ROSTER_COLUMNS.map((column) => column.header));
  assert.equal(workbook.getWorksheet('Passengers').actualRowCount, 1);
  assert.equal(workbook.getWorksheet('Route & Stop Reference').getCell('E2').value, 'Central Stop');
});

test('CSV template contains only the canonical import headers', () => {
  const csv = buildTemplateCsv().toString('utf8').replace(/^\uFEFF/, '').trim();
  assert.equal(csv, ROSTER_COLUMNS.map((column) => `"${column.header}"`).join(','));
});

test('XLSX roster export contains no private phone fields', async () => {
  const buffer = await buildRosterExportXlsx(
    { name: '2026 list', academicYear: '2026-27', version: 1, status: 'DRAFT' },
    [{
      passengerType: 'STUDENT', name: 'Akhil', busPassId: 'PASS-1', rollNo: 'ROLL-1', facultyId: null,
      department: 'CSE', year: 2, section: 'A', routeService: { routeNo: '01' }, boardingStop: { name: 'Central Stop' },
    }]
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const headers = workbook.getWorksheet('Passengers').getRow(1).values.slice(1);
  assert.equal(headers.includes('Phone'), false);
  assert.deepEqual(headers, ROSTER_COLUMNS.map((column) => column.header));
});
