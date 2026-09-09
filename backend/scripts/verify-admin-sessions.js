require('dotenv').config();
process.env.REQUEST_LOGGING_ENABLED = 'false';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const { app } = require('../src/index');
const { signToken } = require('../src/middleware/auth');

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const adminIdentifier = `admin-session-test-${suffix}`;

async function createSession(minutes = 30) {
  const session = await prisma.adminSession.create({
    data: {
      adminIdentifier,
      expiresAt: new Date(Date.now() + minutes * 60 * 1000),
    },
  });
  return {
    session,
    token: signToken(
      { role: 'admin', id: adminIdentifier, sessionId: session.id },
      { expiresInMinutes: 60 }
    ),
  };
}

function authorization(token) {
  return { Authorization: `Bearer ${token}` };
}

async function run() {
  const first = await createSession();
  const profile = await request(app).get('/auth/me').set(authorization(first.token)).expect(200);
  assert.equal(profile.body.role, 'admin');
  assert.equal(profile.body.session.id, first.session.id);
  assert.match(profile.headers['cache-control'], /no-store/);

  await request(app).post('/auth/logout').set(authorization(first.token)).expect(200);
  await request(app).get('/auth/me').set(authorization(first.token)).expect(401);

  const expired = await createSession(-1);
  await request(app).get('/auth/me').set(authorization(expired.token)).expect(401);
  const missingToken = signToken(
    { role: 'admin', id: adminIdentifier, sessionId: randomUUID() },
    { expiresInMinutes: 60 }
  );
  await request(app).get('/auth/me').set(authorization(missingToken)).expect(401);

  const controller = await createSession();
  const target = await createSession();
  const listed = await request(app).get('/auth/admin/sessions').set(authorization(controller.token)).expect(200);
  assert.ok(listed.body.some((item) => item.id === controller.session.id && item.current === true));
  assert.ok(listed.body.some((item) => item.id === target.session.id && item.status === 'ACTIVE'));

  await request(app)
    .post(`/auth/admin/sessions/${target.session.id}/revoke`)
    .set(authorization(controller.token))
    .expect(200);
  await request(app).get('/auth/me').set(authorization(target.token)).expect(401);
  await request(app).get('/auth/me').set(authorization(controller.token)).expect(200);

  const finalSession = await createSession();
  const revokeAll = await request(app)
    .post('/auth/admin/sessions/revoke-all')
    .set(authorization(controller.token))
    .expect(200);
  assert.equal(revokeAll.body.revokedSessions, 2);
  await request(app).get('/auth/me').set(authorization(controller.token)).expect(401);
  await request(app).get('/auth/me').set(authorization(finalSession.token)).expect(401);

  console.log(JSON.stringify({
    serverBackedSession: 'verified',
    logoutRevocation: 'verified',
    expiredAndMissingSessionsRejected: 'verified',
    singleSessionRevocation: 'verified',
    revokeAllCount: revokeAll.body.revokedSessions,
  }));
}

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { adminIdentifier } });
  await prisma.adminSession.deleteMany({ where: { adminIdentifier } });
}

run()
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
