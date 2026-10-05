require('dotenv').config();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const runtimeUrl = new URL(process.env.DATABASE_URL || '');
const sourceUrl = new URL(process.env.DIRECT_URL || '');
if (!['postgresql:', 'postgres:'].includes(runtimeUrl.protocol) ||
    !['postgresql:', 'postgres:'].includes(sourceUrl.protocol)) {
  throw new Error('Backup/restore verification requires PostgreSQL DATABASE_URL and DIRECT_URL');
}

const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
const schemaName = `codex_restore_verify_${suffix}`;
if (!/^codex_restore_verify_[a-z0-9_]+$/.test(schemaName)) throw new Error('Unsafe verification schema name');
const schemaUrl = new URL(sourceUrl);
schemaUrl.searchParams.set('schema', schemaName);
const dumpPath = path.join(os.tmpdir(), `${schemaName}.dump`);
const postgresBin = process.env.PG_BIN_DIR || path.join('C:\\Program Files', 'PostgreSQL', '18', 'bin');
const executable = (name) => path.join(postgresBin, process.platform === 'win32' ? `${name}.exe` : name);
const pgDump = executable('pg_dump');
const pgRestore = executable('pg_restore');
for (const tool of [pgDump, pgRestore]) {
  if (!fs.existsSync(tool)) throw new Error(`PostgreSQL tool was not found: ${tool}. Set PG_BIN_DIR if PostgreSQL is installed elsewhere.`);
}

const databaseName = decodeURIComponent(sourceUrl.pathname.replace(/^\//, ''));
const pgEnv = {
  ...process.env,
  PGHOST: sourceUrl.hostname,
  PGPORT: sourceUrl.port || '5432',
  PGUSER: decodeURIComponent(sourceUrl.username),
  PGPASSWORD: decodeURIComponent(sourceUrl.password),
  PGDATABASE: databaseName,
};

const main = new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } });
let scoped = null;
let schemaExists = false;

function runCommand(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    shell: false,
    timeout: 60_000,
  });
  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(`${path.basename(command)} exceeded the 60-second verification limit`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.error?.message || '').trim().slice(0, 2000);
    throw new Error(`${path.basename(command)} failed with exit code ${result.status}: ${detail}`);
  }
  return result;
}

function runPrisma(args) {
  const prismaCli = require.resolve('prisma/build/index.js');
  return runCommand(process.execPath, [prismaCli, ...args], {
    ...process.env,
    DATABASE_URL: schemaUrl.toString(),
    DIRECT_URL: schemaUrl.toString(),
  });
}

async function dropVerificationSchema() {
  if (!schemaExists) return;
  if (!schemaName.startsWith('codex_restore_verify_')) throw new Error('Refusing to drop a non-verification schema');
  if (scoped) {
    await scoped.$disconnect();
    scoped = null;
  }
  await main.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
  schemaExists = false;
}

async function createMigratedSeededSchema() {
  await main.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}" AUTHORIZATION CURRENT_USER`);
  schemaExists = true;
  runPrisma(['migrate', 'deploy']);
  runPrisma(['db', 'seed']);
  scoped = new PrismaClient({ datasources: { db: { url: schemaUrl.toString() } } });
  assert.equal(await scoped.routeService.count(), 1);
  assert.equal(await scoped.rosterPassenger.count(), 2);
  await scoped.$disconnect();
  scoped = null;
}

async function verifyRestoredSchema() {
  scoped = new PrismaClient({ datasources: { db: { url: schemaUrl.toString() } } });
  const [routes, passengers, migrations, notificationColumns, adminSessionColumns, rateLimitColumns] = await Promise.all([
    scoped.routeService.count(),
    scoped.rosterPassenger.count(),
    scoped.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${schemaName}"."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`),
    scoped.$queryRawUnsafe(
      `SELECT column_name AS "columnName"
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'NotificationOutbox'
          AND column_name IN ('idempotencyKey', 'nextAttemptAt', 'lockToken')
        ORDER BY column_name`,
      schemaName
    ),
    scoped.$queryRawUnsafe(
      `SELECT column_name AS "columnName"
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'AdminSession'
          AND column_name IN ('adminIdentifier', 'expiresAt', 'revokedAt')
        ORDER BY column_name`,
      schemaName
    ),
    scoped.$queryRawUnsafe(
      `SELECT column_name AS "columnName"
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'RateLimitBucket'
          AND column_name IN ('key', 'hits', 'resetAt')
        ORDER BY column_name`,
      schemaName
    ),
  ]);
  assert.equal(routes, 1);
  assert.equal(passengers, 2);
  assert.equal(migrations[0].count, 8);
  assert.deepEqual(notificationColumns.map((row) => row.columnName).sort(), ['idempotencyKey', 'lockToken', 'nextAttemptAt']);
  assert.deepEqual(adminSessionColumns.map((row) => row.columnName).sort(), ['adminIdentifier', 'expiresAt', 'revokedAt']);
  assert.deepEqual(rateLimitColumns.map((row) => row.columnName).sort(), ['hits', 'key', 'resetAt']);
  return { routes, passengers, migrations: migrations[0].count, notificationColumns: notificationColumns.length, adminSessionColumns: adminSessionColumns.length, rateLimitColumns: rateLimitColumns.length };
}

async function cleanup() {
  await dropVerificationSchema();
  if (fs.existsSync(dumpPath)) fs.rmSync(dumpPath);
  const schemas = await main.$queryRawUnsafe(
    'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
    schemaName
  );
  assert.equal(schemas.length, 0, 'temporary restore schema was not removed');
  assert.equal(fs.existsSync(dumpPath), false, 'temporary dump file was not removed');
  await main.$disconnect();
}

async function run() {
  let report;
  try {
    await createMigratedSeededSchema();
    runCommand(pgDump, ['--format=custom', '--no-owner', '--no-privileges', `--schema=${schemaName}`, `--file=${dumpPath}`], pgEnv);
    const dumpBytes = fs.statSync(dumpPath).size;
    assert.ok(dumpBytes > 0, 'pg_dump created an empty backup');

    await dropVerificationSchema();
    runCommand(pgRestore, ['--exit-on-error', '--no-owner', '--no-privileges', `--dbname=${databaseName}`, dumpPath], pgEnv);
    schemaExists = true;
    const restored = await verifyRestoredSchema();
    report = { dumpBytes, restored };
  } finally {
    await cleanup();
  }
  console.log(JSON.stringify({ ...report, temporarySchemaRemoved: true, temporaryDumpRemoved: true }));
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
