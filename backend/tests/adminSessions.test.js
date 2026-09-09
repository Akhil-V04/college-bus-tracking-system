const test = require('node:test');
const assert = require('node:assert/strict');
const {
  adminSessionExpiry,
  isSecureJwtSecret,
  findActiveAdminSession,
  resolveAuthPolicy,
  revokeAdminSession,
  revokeAllAdminSessions,
} = require('../src/lib/adminSessions');

test('production JWT secret policy rejects defaults and short values', () => {
  assert.equal(isSecureJwtSecret('change-me'), false);
  assert.equal(isSecureJwtSecret('replace-with-a-long-random-secret'), false);
  assert.equal(isSecureJwtSecret('short-but-random'), false);
  assert.equal(isSecureJwtSecret('v3ry-long-random-production-secret-2026!'), true);
});

test('production authentication policy is shorter and bounded', () => {
  assert.deepEqual(resolveAuthPolicy({}, 'production'), {
    adminSessionMinutes: 120,
    driverTokenMinutes: 720,
  });
  assert.deepEqual(resolveAuthPolicy({ ADMIN_SESSION_TTL_MINUTES: '99999', DRIVER_TOKEN_TTL_MINUTES: '99999' }, 'production'), {
    adminSessionMinutes: 480,
    driverTokenMinutes: 1440,
  });
  assert.equal(resolveAuthPolicy({ ADMIN_SESSION_TTL_MINUTES: 'invalid' }, 'development').adminSessionMinutes, 720);
});

test('admin session expiry uses the configured minute lifetime', () => {
  const now = new Date('2026-08-25T00:00:00.000Z');
  assert.equal(adminSessionExpiry(now, 120).toISOString(), '2026-08-25T02:00:00.000Z');
});

test('active-session lookup requires matching unrevoked unexpired server state', async () => {
  const calls = [];
  const client = { adminSession: { findFirst: async (query) => { calls.push(query); return { id: 'session-1' }; } } };
  assert.equal(await findActiveAdminSession(client, { id: 'admin' }), null);
  assert.deepEqual(
    await findActiveAdminSession(client, { id: 'admin', sessionId: 'session-1' }, new Date('2026-08-25T00:00:00Z')),
    { id: 'session-1' }
  );
  assert.deepEqual(calls[0].where, {
    id: 'session-1',
    adminIdentifier: 'admin',
    revokedAt: null,
    expiresAt: { gt: new Date('2026-08-25T00:00:00Z') },
  });
});

test('session revocation updates only currently active matching rows', async () => {
  const calls = [];
  const client = { adminSession: { updateMany: async (query) => { calls.push(query); return { count: 1 }; } } };
  await revokeAdminSession(client, 'session-1', 'LOGOUT', new Date('2026-08-25T01:00:00Z'));
  await revokeAllAdminSessions(client, 'admin', 'PASSWORD_ROTATED', new Date('2026-08-25T02:00:00Z'));
  assert.deepEqual(calls[0].where, { id: 'session-1', revokedAt: null });
  assert.equal(calls[0].data.revokeReason, 'LOGOUT');
  assert.deepEqual(calls[1].where, {
    adminIdentifier: 'admin',
    revokedAt: null,
    expiresAt: { gt: new Date('2026-08-25T02:00:00Z') },
  });
  assert.equal(calls[1].data.revokeReason, 'PASSWORD_ROTATED');
});
