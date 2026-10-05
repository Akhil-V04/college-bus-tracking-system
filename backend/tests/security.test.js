const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

process.env.REQUEST_LOGGING_ENABLED = 'false';

const { app } = require('../src/index');
const { signToken } = require('../src/middleware/auth');
const {
  consumeSocketRate,
  createRateLimiters,
  requestMetadata,
} = require('../src/middleware/security');

test('API responses include hardened security and request-correlation headers', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(response.headers['content-security-policy'], /default-src 'none'/);
  assert.ok(response.headers['x-request-id']);
});

test('hostile browser origins are rejected while non-browser clients remain supported', async () => {
  const rejected = await request(app).get('/health').set('Origin', 'https://attacker.example').expect(200);
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  await request(app).get('/health').expect(200);
});

test('admin routes reject anonymous and driver tokens before touching the database', async () => {
  await request(app).get('/drivers').expect(401);
  const driverToken = signToken({ role: 'driver', id: 99999, sessionVersion: 1 });
  await request(app).get('/drivers').set('Authorization', `Bearer ${driverToken}`).expect(403);
});

test('obsolete public password-hash helper is not available', async () => {
  await request(app).post('/auth/seed-passwords').send({ password: 'should-not-be-hashed-over-http' }).expect(404);
});

test('login limiter blocks repeated failures and returns standard rate-limit headers', async () => {
  const isolated = express();
  isolated.use(express.json());
  const { login } = createRateLimiters({ LOGIN_RATE_LIMIT_MAX: '2', LOGIN_RATE_LIMIT_WINDOW_MS: '60000' });
  isolated.post('/login', login, (_req, res) => res.status(401).json({ error: 'Invalid credentials' }));
  await request(isolated).post('/login').expect(401);
  await request(isolated).post('/login').expect(401);
  const blocked = await request(isolated).post('/login').expect(429);
  assert.match(blocked.headers['ratelimit-policy'], /q=2; w=60/);
  assert.match(blocked.body.error, /too many failed login attempts/i);
});

test('request metadata never includes bodies, query strings, headers, tokens, emails, or IP addresses', () => {
  const req = {
    requestId: 'request-1',
    method: 'POST',
    route: { path: '/login' },
    baseUrl: '/auth',
    path: '/login',
    originalUrl: '/login?email=private@example.edu',
    body: { password: 'private' },
    headers: { authorization: 'Bearer private' },
    user: { role: 'admin', email: 'private@example.edu' },
    ip: '203.0.113.1',
  };
  const metadata = requestMetadata(req, { statusCode: 401 }, 12.3456);
  assert.deepEqual(metadata, {
    type: 'http_request',
    requestId: 'request-1',
    method: 'POST',
    path: '/auth/login',
    status: 401,
    durationMs: 12.35,
    role: 'admin',
  });
});

test('Socket.IO GPS limiter blocks bursts and resets after its time window', () => {
  const socket = { data: {} };
  assert.equal(consumeSocketRate(socket, 'driver:location', { now: 1000, limit: 2, windowMs: 1000 }).allowed, true);
  assert.equal(consumeSocketRate(socket, 'driver:location', { now: 1100, limit: 2, windowMs: 1000 }).allowed, true);
  const blocked = consumeSocketRate(socket, 'driver:location', { now: 1200, limit: 2, windowMs: 1000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 800);
  assert.equal(consumeSocketRate(socket, 'driver:location', { now: 2000, limit: 2, windowMs: 1000 }).allowed, true);
});
