require('dotenv').config();

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;
if (!databaseUrl || !directUrl) throw new Error('DATABASE_URL and DIRECT_URL are required');

const mainUrl = new URL(databaseUrl);
const migrationUrl = new URL(directUrl);
if (!['postgresql:', 'postgres:'].includes(mainUrl.protocol) ||
    !['postgresql:', 'postgres:'].includes(migrationUrl.protocol)) {
  throw new Error('Clean-database verification requires PostgreSQL');
}

const schemaName = `codex_clean_verify_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
if (!/^codex_clean_verify_[a-z0-9_]+$/.test(schemaName)) {
  throw new Error('Generated verification schema name is unsafe');
}
const cleanUrl = new URL(migrationUrl);
cleanUrl.searchParams.set('schema', schemaName);

const main = new PrismaClient({ datasources: { db: { url: migrationUrl.toString() } } });
let clean = null;
let schemaCreated = false;

function runPrisma(args) {
  const prismaCli = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: cleanUrl.toString(),
      DIRECT_URL: cleanUrl.toString(),
    },
    encoding: 'utf8',
    shell: false,
    timeout: 60_000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(`prisma ${args.join(' ')} exceeded the 60-second isolated-schema limit`);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npx prisma ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

async function verifyRole() {
  const runtime = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const rows = await runtime.$queryRawUnsafe(`
    SELECT current_user AS "currentUser",
           r.rolsuper AS "isSuperuser",
           r.rolcreatedb AS "canCreateDatabase",
           r.rolcreaterole AS "canCreateRole",
           r.rolcanlogin AS "canLogin",
           pg_get_userbyid(d.datdba) AS "databaseOwner"
      FROM pg_roles r
      JOIN pg_database d ON d.datname = current_database()
     WHERE r.rolname = current_user
  `);
  await runtime.$disconnect();
  assert.equal(rows.length, 1);
  const role = rows[0];
  assert.equal(role.isSuperuser, false, 'configured PostgreSQL role must not be a superuser');
  const restrictedRuntimeRole = !role.canCreateDatabase && !role.canCreateRole;
  if (process.env.REQUIRE_RESTRICTED_DB_ROLE === 'true') {
    assert.equal(restrictedRuntimeRole, true, 'production runtime requires a role without CREATEDB or CREATEROLE');
  }
  return {
    currentUser: role.currentUser,
    canLogin: role.canLogin,
    isSuperuser: role.isSuperuser,
    canCreateDatabase: role.canCreateDatabase,
    canCreateRole: role.canCreateRole,
    restrictedRuntimeRole,
    productionRuntimeSeparationRequired: !restrictedRuntimeRole || role.databaseOwner === role.currentUser,
    ownsDevelopmentDatabase: role.databaseOwner === role.currentUser,
  };
}

async function verifySchemaAndSeed() {
  clean = new PrismaClient({ datasources: { db: { url: cleanUrl.toString() } } });
  const requiredTables = [
    'AdminAuditLog',
    'AdminSession',
    'RateLimitBucket',
    'ClassAdvisor',
    'Driver',
    'LateAlert',
    'LiveLocation',
    'NotificationOutbox',
    'RosterPassenger',
    'RouteService',
    'ScheduleStop',
    'ScheduleVersion',
    'Stop',
    'TransportRoster',
    'Trip',
    'TripStopEvent',
    'TripDriverTransfer',
    'EtaCalibrationSnapshot',
    'SegmentTravelSample',
    'SegmentTravelAggregate',
    'PushDeviceSubscription',
    'StopAlertSubscription',
    'StopAlertDelivery',
    'PushNotificationOutbox',
    'FeedbackReport',
    'EmergencyReport',
    'EmergencyAssistance',
  ];
  const tables = await clean.$queryRawUnsafe(
    `SELECT table_name AS "tableName"
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    schemaName
  );
  const tableNames = tables.map((row) => row.tableName);
  for (const table of requiredTables) assert.ok(tableNames.includes(table), `missing migrated table ${table}`);

  const obsoleteColumns = await clean.$queryRawUnsafe(
    `SELECT table_name AS "tableName", column_name AS "columnName"
       FROM information_schema.columns
      WHERE table_schema = $1
        AND lower(column_name) IN (
          'registrationnumber', 'vehicleregistration',
          'boardingrecordid', 'attendancestatus', 'qrcode'
        )`,
    schemaName
  );
  assert.deepEqual(obsoleteColumns, [], 'obsolete registration/active/attendance/QR columns were migrated');

  const [routeCount, passengerCount, studentCount, facultyCount, advisorCount] = await Promise.all([
    clean.routeService.count(),
    clean.rosterPassenger.count(),
    clean.rosterPassenger.count({ where: { passengerType: 'STUDENT' } }),
    clean.rosterPassenger.count({ where: { passengerType: 'FACULTY' } }),
    clean.classAdvisor.count(),
  ]);
  assert.equal(routeCount, 1);
  assert.equal(passengerCount, 2);
  assert.equal(studentCount, 1);
  assert.equal(facultyCount, 1);
  assert.equal(advisorCount, 1);

  const migrations = await clean.$queryRawUnsafe(
    `SELECT migration_name AS "migrationName", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
       FROM "${schemaName}"."_prisma_migrations"
      ORDER BY migration_name`
  );
  assert.equal(migrations.length, 8);
  assert.ok(migrations.every((migration) => migration.finishedAt && !migration.rolledBackAt));
  return {
    migratedTables: requiredTables.length,
    appliedMigrations: migrations.map((migration) => migration.migrationName),
    seededRoutes: routeCount,
    seededPassengers: { total: passengerCount, students: studentCount, faculty: facultyCount },
    seededAdvisors: advisorCount,
    obsoleteColumns: [],
  };
}

async function cleanup() {
  if (clean) await clean.$disconnect();
  if (schemaCreated) {
    if (!schemaName.startsWith('codex_clean_verify_')) throw new Error('Refusing to drop a non-verification schema');
    await main.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    const remaining = await main.$queryRawUnsafe(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
      schemaName
    );
    assert.equal(remaining.length, 0, 'temporary verification schema was not removed');
  }
  await main.$disconnect();
}

async function run() {
  const role = await verifyRole();
  await main.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}" AUTHORIZATION CURRENT_USER`);
  schemaCreated = true;
  runPrisma(['migrate', 'deploy']);
  runPrisma(['db', 'seed']);
  const database = await verifySchemaAndSeed();
  console.log(JSON.stringify({ role, database, temporarySchemaRemovedAfterVerification: true }));
}

run().finally(cleanup);
