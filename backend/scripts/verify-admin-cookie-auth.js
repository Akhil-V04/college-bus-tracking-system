require('dotenv').config();
process.env.REQUEST_LOGGING_ENABLED = 'false';

const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
let createdSessionId = null;

async function main() {
  const email = `cookie-check-${Date.now()}@example.invalid`;
  const password = 'CookieCheck!2026-Strong';
  process.env.ADMIN_EMAIL = email;
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(password, 10);
  const { app } = require('../src/index');

  const agent = request.agent(app);
  const login = await agent.post('/api/v1/auth/login').send({ role: 'admin', identifier: email, password }).expect(200);
  assert.equal(login.body.token, undefined, 'browser-readable response must not contain the administrator bearer token');
  assert.match(String(login.headers['set-cookie']?.[0]), /HttpOnly/);
  const profile = await agent.get('/api/v1/auth/me').expect(200);
  assert.equal(profile.body.role, 'admin');
  createdSessionId = profile.body.session.id;
  await agent.post('/api/v1/auth/logout').expect(403);
  await agent.post('/api/v1/auth/logout').set('X-Requested-With', 'college-bus-admin').expect(200);
  await agent.get('/api/v1/auth/me').expect(401);
  console.log('Administrator HttpOnly-cookie login, CSRF rejection, logout and revocation verified.');
}

async function cleanup() {
  if (createdSessionId) {
    await prisma.adminAuditLog.deleteMany({ where: { entityType: 'AdminSession', entityId: createdSessionId } });
    await prisma.adminSession.deleteMany({ where: { id: createdSessionId } });
  }
  await prisma.$disconnect();
}

main().finally(cleanup).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
