require('dotenv').config();
process.env.REQUEST_LOGGING_ENABLED = 'false';

const assert = require('node:assert/strict');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const { app } = require('../src/index');
const { signToken } = require('../src/middleware/auth');

const FORBIDDEN_NON_ADMIN_KEYS = /^(phone|password|passwordHash|licenseNo|email|recipient|providerMessageId|busPassId|rollNo|facultyId|adminIdentifier|beforeSummary|afterSummary)$/i;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const created = {};

function findForbiddenKeys(value, path = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, `${path}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_NON_ADMIN_KEYS.test(key)) found.push(`${path}.${key}`);
    findForbiddenKeys(item, `${path}.${key}`, found);
  }
  return found;
}

function assertPrivateFieldsAbsent(label, body) {
  assert.deepEqual(findForbiddenKeys(body), [], `${label} leaked a private field`);
}

async function createFixture() {
  const fixture = await prisma.$transaction(async (tx) => {
    const driver = await tx.driver.create({ data: {
      driverCode: `PRIV-${suffix}`, name: 'Synthetic Privacy Driver',
      phone: `7${String(Date.now()).slice(-9)}`, licenseNo: `PRIV-LIC-${suffix}`,
      passwordHash: 'privacy-verification-only',
    } });
    const route = await tx.routeService.create({ data: {
      routeNo: `PRIV-${suffix}`, name: 'Synthetic Privacy Route',
      areaCovered: 'Synthetic Privacy Area', capacity: 25, driverId: driver.id,
    } });
    const stop = await tx.stop.create({ data: {
      name: 'Synthetic Privacy Stop', latitude: 17.4501, longitude: 78.3902,
    } });
    const schedule = await tx.scheduleVersion.create({ data: {
      routeServiceId: route.id, name: 'Synthetic Privacy Schedule', status: 'PUBLISHED',
      publishedAt: new Date(), geometryPolyline: 'synthetic-polyline', geometryFormat: 'polyline5',
      geometryProvider: 'SYNTHETIC',
    } });
    await tx.scheduleStop.create({ data: {
      scheduleVersionId: schedule.id, stopId: stop.id, sequenceOrder: 1, scheduledTime: '08:30',
    } });
    const roster = await tx.transportRoster.create({ data: {
      name: 'Synthetic Privacy Roster', academicYear: `PRIV-${suffix}`,
      status: 'PUBLISHED', publishedAt: new Date(),
    } });
    await tx.rosterPassenger.create({ data: {
      rosterId: roster.id, routeServiceId: route.id, boardingStopId: stop.id,
      passengerType: 'STUDENT', name: 'Synthetic Passenger', busPassId: `PRIV-PASS-${suffix}`,
      rollNo: `PRIV-ROLL-${suffix}`, department: 'CSE', year: 2, section: 'A',
    } });
    return { driver, route, stop, schedule, roster };
  });
  Object.assign(created, fixture);
}

async function cleanup() {
  if (!created.route) return;
  await prisma.$transaction(async (tx) => {
    await tx.transportRoster.deleteMany({ where: { id: created.roster.id } });
    await tx.scheduleVersion.deleteMany({ where: { id: created.schedule.id } });
    await tx.routeService.deleteMany({ where: { id: created.route.id } });
    await tx.stop.deleteMany({ where: { id: created.stop.id } });
    await tx.driver.deleteMany({ where: { id: created.driver.id } });
  });
}

async function run() {
  await createFixture();
  const routes = await request(app)
    .get(`/passenger/routes?q=${encodeURIComponent(created.route.routeNo)}`)
    .expect(200);
  assertPrivateFieldsAbsent('public route list', routes.body);
  assert.equal(routes.body.length, 1);
  const routeNo = encodeURIComponent(created.route.routeNo);
  const details = await request(app).get(`/passenger/routes/${routeNo}`).expect(200);
  assertPrivateFieldsAbsent('public route details', details.body);
  const roster = await request(app).get(`/passenger/routes/${routeNo}/roster`).expect(200);
  assertPrivateFieldsAbsent('public route roster', roster.body);
  const nearest = await request(app)
    .get('/passenger/stops/nearest?latitude=17.4501&longitude=78.3902&radiusMeters=1000&limit=1')
    .expect(200);
  assertPrivateFieldsAbsent('nearest stop response', nearest.body);
  assert.equal(nearest.body.query.latitude, undefined);
  assert.equal(nearest.body.query.longitude, undefined);

  await request(app).get('/drivers').expect(401);
  await request(app).get('/late-alerts').expect(401);
  await request(app).get('/admin-audit-logs').expect(401);

  const driverToken = signToken({
    role: 'driver', id: created.driver.id, sessionVersion: created.driver.sessionVersion,
  });
  const authorization = `Bearer ${driverToken}`;
  const me = await request(app).get('/auth/me').set('Authorization', authorization).expect(200);
  assertPrivateFieldsAbsent('driver session response', me.body);
  await request(app).get('/drivers').set('Authorization', authorization).expect(403);
  await request(app).get('/late-alerts').set('Authorization', authorization).expect(403);
  await request(app).get('/admin-audit-logs').set('Authorization', authorization).expect(403);

  console.log(JSON.stringify({
    publicRoutesChecked: 1,
    publicRouteDetailsChecked: true,
    publicRosterChecked: true,
    nearestStopPrivacyChecked: true,
    driverSessionChecked: true,
    forbiddenKeys: [],
    anonymousAdminBoundaries: 'verified',
    driverAdminBoundaries: 'verified',
  }));
}

run().finally(async () => {
  await cleanup();
  await prisma.$disconnect();
});
