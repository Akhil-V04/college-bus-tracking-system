require('dotenv').config();

const assert = require('node:assert/strict');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const { signToken } = require('../src/middleware/auth');
const { app } = require('../src/index');

const forbidden = /phone|password|hash|license|busPassId|rollNo|facultyId/i;

function inspectKeys(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => inspectKeys(entry, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    assert.equal(forbidden.test(key), false, `private field ${path}.${key} crossed the public boundary`);
    inspectKeys(entry, `${path}.${key}`);
  }
}

async function main() {
  const session = await prisma.adminSession.create({
    data: { adminIdentifier: 'admin', expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  const token = signToken({ role: 'admin', id: 'admin', sessionId: session.id }, { expiresInMinutes: 10 });
  try {
    const live = await request(app).get('/health').expect(200);
    assert.equal(live.headers['x-api-version'], '1');
    await request(app).get('/health/ready').expect(200).expect(({ body }) => assert.equal(body.database, 'ok'));

    const versionedPublic = await request(app).get('/api/v1/passenger/routes').expect(200);
    inspectKeys(versionedPublic.body);
    await request(app).get('/passenger/routes').expect(200);

    const operations = await request(app)
      .get('/api/v1/operations/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.match(operations.headers['cache-control'], /no-store/);
    for (const key of [
      'runningTrips', 'staleRunningTrips', 'activeLateAlerts',
      'pendingNotifications', 'failedNotifications',
      'pendingPushNotifications', 'failedPushNotifications', 'activePushSubscriptions',
      'unresolvedFeedback', 'activeEmergencies', 'unverifiedEmergencies',
      'openAssistanceOffers', 'activeAdminSessions',
    ]) {
      assert.equal(Number.isInteger(operations.body[key]), true, `missing integer ${key}`);
    }
    await request(app)
      .get('/api/v1/admin-audit-logs?limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    console.log('Release API verification passed for health, v1 compatibility, privacy, operations and audit routes.');
  } finally {
    await prisma.adminSession.deleteMany({ where: { id: session.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
