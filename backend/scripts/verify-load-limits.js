require('dotenv').config();

const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const {
  MAX_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  ROSTER_COLUMNS,
  parseRosterFile,
  validateRosterRows,
} = require('../src/lib/rosterExchange');
const { drainNotificationOutbox } = require('../src/lib/notificationOutbox');

const prisma = require('../src/lib/prisma');
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const created = {};

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function buildRosterCsv(rowCount) {
  const lines = [ROSTER_COLUMNS.map((column) => csvCell(column.header)).join(',')];
  for (let index = 1; index <= rowCount; index += 1) {
    const faculty = index % 10 === 0;
    lines.push([
      faculty ? 'FACULTY' : 'STUDENT',
      `Load Passenger ${index}`,
      `LOAD-PASS-${index}`,
      faculty ? '' : `LOAD-ROLL-${index}`,
      faculty ? `LOAD-FAC-${index}` : '',
      'CSE',
      faculty ? '' : '2',
      faculty ? '' : 'A',
      'LOAD-01',
      'Load Stop',
    ].map(csvCell).join(','));
  }
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

async function verifyRosterLimits() {
  const buffer = buildRosterCsv(MAX_IMPORT_ROWS);
  assert.ok(buffer.length < 5 * 1024 * 1024, '10,000-row fixture must fit within the HTTP upload limit');
  const heapBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();
  const parsed = await parseRosterFile(buffer, 'load-roster.csv');
  const results = validateRosterRows(parsed.rows, {
    routes: [{ id: 1, routeNo: 'LOAD-01', name: 'Load Route', capacity: MAX_IMPORT_ROWS, allowedStops: [{ id: 1, name: 'Load Stop' }] }],
    existingCountsByRoute: new Map(),
    existingBusPassIds: new Set(),
    existingRollNos: new Set(),
    existingFacultyIds: new Set(),
    advisorKeys: new Set(['CSE|2|A']),
  });
  const durationMs = performance.now() - startedAt;
  const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
  assert.equal(parsed.rows.length, MAX_IMPORT_ROWS);
  assert.equal(results.filter((row) => row.valid).length, MAX_IMPORT_ROWS);
  assert.ok(durationMs < 15_000, `roster parse and validation took ${Math.round(durationMs)} ms`);
  assert.ok(heapDeltaBytes < 256 * 1024 * 1024, `roster heap delta was ${heapDeltaBytes} bytes`);

  await assert.rejects(
    () => parseRosterFile(buildRosterCsv(MAX_IMPORT_ROWS + 1), 'too-many.csv'),
    new RegExp(`${MAX_IMPORT_ROWS}-row import limit`)
  );
  const wideHeader = Buffer.from(Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, index) => csvCell(`Column ${index + 1}`)).join(',') + '\r\n');
  await assert.rejects(() => parseRosterFile(wideHeader, 'too-wide.csv'), new RegExp(`${MAX_IMPORT_COLUMNS}-column safety limit`));
  const longCell = buildRosterCsv(1).toString('utf8').replace('Load Passenger 1', 'X'.repeat(MAX_CELL_LENGTH + 1));
  await assert.rejects(() => parseRosterFile(Buffer.from(longCell), 'long-cell.csv'), new RegExp(`${MAX_CELL_LENGTH} characters`));

  return {
    rows: MAX_IMPORT_ROWS,
    fileBytes: buffer.length,
    parseAndValidateMs: Math.round(durationMs),
    heapDeltaMiB: Number((heapDeltaBytes / 1024 / 1024).toFixed(1)),
    rowLimitRejected: true,
    columnLimitRejected: true,
    cellLimitRejected: true,
  };
}

async function createOutboxFixture() {
  created.driver = await prisma.driver.create({ data: {
    driverCode: `LOAD-${suffix}`, name: 'Load Test Driver', phone: `8${String(Date.now()).slice(-9)}`,
    licenseNo: `LOAD-${suffix}`, passwordHash: 'load-test-only',
  } });
  created.route = await prisma.routeService.create({ data: {
    routeNo: `LOAD-${suffix}`, name: 'Load Test Route', areaCovered: 'Temporary generated load fixture',
    capacity: 10, driverId: created.driver.id,
  } });
  created.schedule = await prisma.scheduleVersion.create({ data: {
    routeServiceId: created.route.id, name: 'Load Test Schedule', version: 1, status: 'PUBLISHED',
  } });
  created.roster = await prisma.transportRoster.create({ data: {
    name: 'Load Test Roster', academicYear: `LOAD-${suffix}`, version: 1, status: 'PUBLISHED',
  } });
  created.trip = await prisma.trip.create({ data: {
    routeServiceId: created.route.id, driverId: created.driver.id, rosterId: created.roster.id,
    scheduleVersionId: created.schedule.id, date: new Date(), status: 'COMPLETED',
  } });
  created.alert = await prisma.lateAlert.create({ data: {
    tripId: created.trip.id, predictedEta: new Date(Date.now() + 30 * 60 * 1000), status: 'RECOVERED',
    studentsAffected: [], advisorsNotified: [],
  } });
}

async function verifyOutboxConcurrency() {
  const unrelatedPending = await prisma.notificationOutbox.count({ where: { status: 'PENDING' } });
  assert.equal(unrelatedPending, 0, 'load verification requires no pre-existing pending notifications');
  await createOutboxFixture();
  const notificationCount = 500;
  await prisma.notificationOutbox.createMany({
    data: Array.from({ length: notificationCount }, (_, index) => ({
      lateAlertId: created.alert.id,
      recipient: `load-${index + 1}@example.edu`,
      idempotencyKey: `load-${suffix}-${index + 1}`,
      payload: { advisorName: 'Load Test Advisor', routeNo: created.route.routeNo, students: [] },
    })),
  });

  const deliveredKeys = new Set();
  const provider = {
    async sendEmail(item) {
      assert.equal(deliveredKeys.has(item.idempotencyKey), false, 'an idempotency key was delivered twice');
      deliveredKeys.add(item.idempotencyKey);
      return { messageId: `load:${item.idempotencyKey}` };
    },
  };
  const startedAt = performance.now();
  const workers = await Promise.all(Array.from({ length: 5 }, () => drainNotificationOutbox({
    prisma,
    provider,
    batchSize: 1000,
  })));
  const durationMs = performance.now() - startedAt;
  assert.deepEqual(workers.map((result) => result.claimed), [100, 100, 100, 100, 100]);
  assert.equal(deliveredKeys.size, notificationCount);
  // This verification runs from a developer machine against remote Supabase and
  // persists every delivery result. Keep the ceiling bounded while allowing for
  // network latency that is not present between Render and Supabase in production.
  assert.ok(durationMs < 120_000, `notification load verification took ${Math.round(durationMs)} ms`);
  const statusCounts = await prisma.notificationOutbox.groupBy({
    by: ['status'],
    where: { lateAlertId: created.alert.id },
    _count: { _all: true },
  });
  assert.deepEqual(statusCounts, [{ status: 'SENT', _count: { _all: notificationCount } }]);

  return {
    notifications: notificationCount,
    workers: workers.length,
    claimedPerWorker: workers.map((result) => result.claimed),
    uniqueDeliveries: deliveredKeys.size,
    durationMs: Math.round(durationMs),
    hardBatchCap: 100,
  };
}

async function cleanup() {
  if (created.alert) await prisma.lateAlert.deleteMany({ where: { id: created.alert.id } });
  if (created.trip) await prisma.trip.deleteMany({ where: { id: created.trip.id } });
  if (created.schedule) await prisma.scheduleVersion.deleteMany({ where: { id: created.schedule.id } });
  if (created.roster) await prisma.transportRoster.deleteMany({ where: { id: created.roster.id } });
  if (created.route) await prisma.routeService.deleteMany({ where: { id: created.route.id } });
  if (created.driver) await prisma.driver.deleteMany({ where: { id: created.driver.id } });
}

async function run() {
  const roster = await verifyRosterLimits();
  const outbox = await verifyOutboxConcurrency();
  console.log(JSON.stringify({ roster, outbox }, null, 2));
}

run()
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
