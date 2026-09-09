const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDeploymentPolicy } = require('../src/lib/deployment');
const { PostgresRateLimitStore } = require('../src/lib/postgresRateLimitStore');

test('production requires explicit proxy hops and PostgreSQL rate limits', () => {
  assert.throws(() => resolveDeploymentPolicy({ NODE_ENV: 'production' }), /TRUST_PROXY_HOPS/);
  assert.throws(() => resolveDeploymentPolicy({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '1', RATE_LIMIT_STORE: 'memory' }), /postgres/);
  assert.deepEqual(resolveDeploymentPolicy({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '1' }), {
    production: true, trustProxyHops: 1, rateLimitStore: 'postgres',
  });
});

test('development keeps a no-proxy memory-store default', () => {
  assert.deepEqual(resolveDeploymentPolicy({ NODE_ENV: 'development' }), {
    production: false, trustProxyHops: 0, rateLimitStore: 'memory',
  });
});

test('PostgreSQL rate-limit keys are stable hashes without raw client identifiers', () => {
  const store = new PostgresRateLimitStore({ prisma: {}, prefix: 'login:' });
  const first = store.hashedKey('203.0.113.10');
  assert.equal(first, store.hashedKey('203.0.113.10'));
  assert.equal(first.length, 64);
  assert.equal(first.includes('203.0.113.10'), false);
  assert.notEqual(first, new PostgresRateLimitStore({ prisma: {}, prefix: 'import:' }).hashedKey('203.0.113.10'));
});
