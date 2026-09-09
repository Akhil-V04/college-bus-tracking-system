require('dotenv').config();
process.env.REQUEST_LOGGING_ENABLED = 'false';

const assert = require('node:assert/strict');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const { app } = require('../src/index');
const { signToken } = require('../src/middleware/auth');


const FORBIDDEN_NON_ADMIN_KEYS = /^(phone|password|passwordHash|licenseNo|email|recipient|providerMessageId|busPassId|rollNo|facultyId|adminIdentifier|beforeSummary|afterSummary)$/i;

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

async function run() {
  const routes = await request(app).get('/passenger/routes').expect(200);
  assertPrivateFieldsAbsent('public route list', routes.body);

  if (routes.body.length) {
    const routeNo = encodeURIComponent(routes.body[0].routeNo);
    const details = await request(app).get(`/passenger/routes/${routeNo}`).expect(200);
    assertPrivateFieldsAbsent('public route details', details.body);
    const roster = await request(app).get(`/passenger/routes/${routeNo}/roster`);
    assert.ok([200, 404].includes(roster.status));
    if (roster.status === 200) assertPrivateFieldsAbsent('public route roster', roster.body);
  }

  await request(app).get('/drivers').expect(401);
  await request(app).get('/late-alerts').expect(401);
  await request(app).get('/admin-audit-logs').expect(401);

  const driver = await prisma.driver.findFirst({
    select: { id: true, sessionVersion: true },
    orderBy: { id: 'asc' },
  });
  if (driver) {
    const driverToken = signToken({ role: 'driver', id: driver.id, sessionVersion: driver.sessionVersion });
    const authorization = `Bearer ${driverToken}`;
    const me = await request(app).get('/auth/me').set('Authorization', authorization).expect(200);
    assertPrivateFieldsAbsent('driver session response', me.body);
    await request(app).get('/drivers').set('Authorization', authorization).expect(403);
    await request(app).get('/late-alerts').set('Authorization', authorization).expect(403);
    await request(app).get('/admin-audit-logs').set('Authorization', authorization).expect(403);
  }

  console.log(JSON.stringify({
    publicRoutesChecked: routes.body.length,
    driverSessionChecked: Boolean(driver),
    forbiddenKeys: [],
    anonymousAdminBoundaries: 'verified',
    driverAdminBoundaries: driver ? 'verified' : 'no seeded driver',
  }));
}

run().finally(() => prisma.$disconnect());
