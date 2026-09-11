const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const { DRIVER_COLUMNS, masterFingerprint, parseDriverWorkbook, previewDriverImport } = require('../src/lib/driverExchange');

async function workbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Drivers');
  sheet.columns = DRIVER_COLUMNS;
  sheet.addRows(rows);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('driver workbook accepts master data without any password column', async () => {
  const buffer = await workbookBuffer([{
    driverCode: 'DRV-01', name: 'Synthetic Driver', phone: '9000000001',
    licenseNo: 'SYN-LIC-01', routeNo: 'R-01',
  }]);
  const rows = await parseDriverWorkbook(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].driverCode, 'DRV-01');
  assert.equal(DRIVER_COLUMNS.some((column) => /password/i.test(column.header)), false);
});

test('driver master fingerprint changes when assignment or record version changes', () => {
  const base = [{
    id: 1, driverCode: 'DRV-01', name: 'Driver', phone: '9000000001', licenseNo: 'LIC-1',
    status: 'ACTIVE', sessionVersion: 1, updatedAt: new Date('2026-09-09T00:00:00Z'), assignedRoute: null,
  }];
  assert.notEqual(masterFingerprint(base), masterFingerprint([{ ...base[0], assignedRoute: { id: 2 } }]));
  assert.notEqual(masterFingerprint(base), masterFingerprint([{ ...base[0], sessionVersion: 2 }]));
});

test('driver workbook rejects formulas', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Drivers');
  sheet.columns = DRIVER_COLUMNS;
  sheet.addRow({ driverCode: { formula: '1+1', result: 'DRV-01' }, name: 'Driver', phone: '9000000001', licenseNo: 'LIC' });
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(() => parseDriverWorkbook(buffer), /formula/i);
});

test('driver preview reports retained identity conflicts but allows included swaps', async () => {
  const drivers = [
    { id: 1, driverCode: 'DRV-01', name: 'One', phone: '9000000001', licenseNo: 'LIC-01', status: 'ACTIVE', sessionVersion: 1, updatedAt: new Date('2026-09-09'), assignedRoute: null, trips: [] },
    { id: 2, driverCode: 'DRV-02', name: 'Two', phone: '9000000002', licenseNo: 'LIC-02', status: 'ACTIVE', sessionVersion: 1, updatedAt: new Date('2026-09-09'), assignedRoute: null, trips: [] },
  ];
  const db = {
    driver: { findMany: async () => drivers },
    routeService: { findMany: async () => [] },
  };
  const conflict = await previewDriverImport(db, await workbookBuffer([{
    driverCode: 'DRV-03', name: 'Three', phone: '9000000001', licenseNo: 'LIC-03', routeNo: '',
  }]));
  assert.equal(conflict.summary.invalidRows, 1);
  assert.match(conflict.rows[0].errors.join(' '), /belongs to another driver/);

  const swap = await previewDriverImport(db, await workbookBuffer([
    { driverCode: 'DRV-01', name: 'One', phone: '9000000002', licenseNo: 'LIC-02', routeNo: '' },
    { driverCode: 'DRV-02', name: 'Two', phone: '9000000001', licenseNo: 'LIC-01', routeNo: '' },
  ]));
  assert.equal(swap.summary.invalidRows, 0);
});
