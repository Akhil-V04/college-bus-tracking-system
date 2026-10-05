const test = require('node:test');
const assert = require('node:assert/strict');

const {
  connectionMode, migrationConnectionSupported, withConnectionLimit, withDatabaseSchema,
} = require('../src/lib/databaseConnectionPolicy');

test('Supabase transaction pooling is valid for runtime but rejected for migrations', () => {
  const url = 'postgresql://user:secret@aws-0-region.pooler.supabase.com:6543/postgres';
  assert.equal(connectionMode(url), 'SUPAVISOR_TRANSACTION');
  assert.equal(migrationConnectionSupported(url), false);
});

test('Supabase session and direct connections support migration sessions', () => {
  assert.equal(connectionMode('postgresql://user:secret@aws-0-region.pooler.supabase.com:5432/postgres'), 'SUPAVISOR_SESSION');
  assert.equal(connectionMode('postgresql://user:secret@db.project.supabase.co:5432/postgres'), 'DIRECT_OR_STANDARD');
  assert.equal(migrationConnectionSupported('postgresql://user:secret@aws-0-region.pooler.supabase.com:5432/postgres'), true);
});

test('connection classification never needs to expose credentials', () => {
  assert.equal(connectionMode('not a url'), 'INVALID');
});

test('runtime URLs explicitly target public without overriding an existing schema', () => {
  const base = 'postgresql://user:secret@host:6543/postgres';
  assert.equal(new URL(withDatabaseSchema(base)).searchParams.get('schema'), 'public');
  assert.equal(new URL(withDatabaseSchema(`${base}?schema=tenant`)).searchParams.get('schema'), 'tenant');
});

test('connection limits are added only when missing', () => {
  const base = 'postgresql://user:secret@host:6543/postgres';
  assert.equal(new URL(withConnectionLimit(base, 1)).searchParams.get('connection_limit'), '1');
  assert.equal(new URL(withConnectionLimit(`${base}?connection_limit=3`, 1)).searchParams.get('connection_limit'), '3');
});
