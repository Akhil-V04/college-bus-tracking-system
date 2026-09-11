require('dotenv').config();

const prisma = require('../src/lib/prisma');
const { connectionMode, migrationConnectionSupported } = require('../src/lib/databaseConnectionPolicy');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function queryReadiness() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT 1::int AS ok,
          (SELECT COUNT(*)::int FROM "_prisma_migrations") AS migrations,
          (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE "finished_at" IS NULL OR "rolled_back_at" IS NOT NULL) AS "failedMigrations",
          (SELECT COUNT(*)::int FROM pg_tables WHERE schemaname = 'public') AS "publicTables",
          (SELECT COUNT(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS "rlsTables",
          (SELECT COUNT(*)::int FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')) AS "exposedGrants"
      `;
      return { snapshot: rows[0], attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1000);
    }
  }
  throw lastError;
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error('DATABASE_URL and DIRECT_URL must both be configured');
  }
  const runtimeConnectionMode = connectionMode(process.env.DATABASE_URL);
  const migrationConnectionMode = connectionMode(process.env.DIRECT_URL);
  if (!migrationConnectionSupported(process.env.DIRECT_URL)) {
    throw new Error('DIRECT_URL must use a direct PostgreSQL connection or Supavisor session mode; transaction mode cannot run migration/restore checks');
  }

  const { snapshot, attempts } = await queryReadiness();

  if (Number(snapshot?.ok) !== 1) throw new Error('Database readiness probe failed');
  if (Number(snapshot?.failedMigrations) !== 0) throw new Error('Prisma migration history contains an unfinished or rolled-back migration');

  console.log(JSON.stringify({
    database: 'reachable',
    connectionAttempts: attempts,
    migrations: Number(snapshot?.migrations || 0),
    publicTables: Number(snapshot?.publicTables || 0),
    rowLevelSecurityTables: Number(snapshot?.rlsTables || 0),
    anonOrAuthenticatedTableGrants: Number(snapshot?.exposedGrants || 0),
    runtimeConnectionMode,
    migrationConnectionMode,
    mapplsConfigured: Boolean(process.env.MAPPLS_ACCESS_TOKEN),
  }));
}

main()
  .catch((error) => {
    console.error(`[supabase-readiness] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
