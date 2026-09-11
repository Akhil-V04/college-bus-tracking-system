require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const {
  connectionMode,
  migrationConnectionSupported,
  withConnectionLimit,
  withDatabaseSchema,
} = require('../src/lib/databaseConnectionPolicy');

const ROLE_NAME = 'bus_tracker_runtime';
const ENV_PATH = path.join(__dirname, '..', '.env');

function runtimePassword() {
  if (process.env.RUNTIME_DATABASE_PASSWORD) {
    if (process.env.RUNTIME_DATABASE_PASSWORD.length < 32) {
      throw new Error('RUNTIME_DATABASE_PASSWORD must contain at least 32 characters');
    }
    return process.env.RUNTIME_DATABASE_PASSWORD;
  }
  try {
    const configured = new URL(process.env.DATABASE_URL);
    const configuredUser = decodeURIComponent(configured.username).split('.')[0];
    if (configuredUser === ROLE_NAME && configured.password.length >= 32) {
      return decodeURIComponent(configured.password);
    }
  } catch {
    // A new password is generated below. The actual value is never logged.
  }
  return crypto.randomBytes(36).toString('base64url');
}

function buildRuntimeUrl(sourceValue, password) {
  const url = new URL(sourceValue);
  const currentUser = decodeURIComponent(url.username);
  const tenantSuffix = currentUser.includes('.') ? currentUser.slice(currentUser.indexOf('.')) : '';
  const sharedPooler = /pooler\.supabase\.com$/i.test(url.hostname);
  url.username = sharedPooler ? `${ROLE_NAME}${tenantSuffix}` : ROLE_NAME;
  url.password = password;
  if (sharedPooler) url.port = '6543';
  url.searchParams.set('schema', 'public');
  url.searchParams.set('connection_limit', '5');
  return url.toString();
}

function updateEnvValue(contents, key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.replace(/\s*$/, '')}\n${line}\n`;
}

async function provision(tx, password) {
  await tx.$executeRaw`SELECT set_config('bus_tracker.runtime_password', ${password}, true)`;
  await tx.$executeRawUnsafe(`
    DO $provision$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE_NAME}') THEN
        EXECUTE format(
          'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS VALID UNTIL ''infinity''',
          '${ROLE_NAME}', current_setting('bus_tracker.runtime_password')
        );
      ELSE
        EXECUTE format(
          'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS VALID UNTIL ''infinity''',
          '${ROLE_NAME}', current_setting('bus_tracker.runtime_password')
        );
      END IF;
    END
    $provision$
  `);
  await tx.$executeRawUnsafe(`ALTER ROLE ${ROLE_NAME} SET statement_timeout = '30s'`);
  await tx.$executeRawUnsafe(`ALTER ROLE ${ROLE_NAME} SET idle_in_transaction_session_timeout = '30s'`);
  await tx.$executeRawUnsafe(`GRANT CONNECT ON DATABASE postgres TO ${ROLE_NAME}`);
  await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE_NAME}`);
  await tx.$executeRawUnsafe(`REVOKE CREATE ON SCHEMA public FROM ${ROLE_NAME}`);

  await tx.$executeRawUnsafe(`
    DO $memberships$
    DECLARE granted_role text;
    BEGIN
      FOR granted_role IN
        SELECT parent.rolname
        FROM pg_auth_members membership
        JOIN pg_roles parent ON parent.oid = membership.roleid
        JOIN pg_roles member ON member.oid = membership.member
        WHERE member.rolname = '${ROLE_NAME}'
      LOOP
        EXECUTE format('REVOKE %I FROM %I', granted_role, '${ROLE_NAME}');
      END LOOP;
    END
    $memberships$
  `);

  await tx.$executeRawUnsafe(`
    DO $tables$
    DECLARE table_name text;
    DECLARE sequence_name text;
    BEGIN
      FOR table_name IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      LOOP
        EXECUTE format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO ${ROLE_NAME}',
          table_name
        );
        EXECUTE format('DROP POLICY IF EXISTS bus_tracker_runtime_all ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS bus_tracker_runtime_select ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS bus_tracker_runtime_insert ON public.%I', table_name);
        IF table_name = 'AdminAuditLog' THEN
          EXECUTE format(
            'CREATE POLICY bus_tracker_runtime_select ON public.%I FOR SELECT TO ${ROLE_NAME} USING (true)',
            table_name
          );
          EXECUTE format(
            'CREATE POLICY bus_tracker_runtime_insert ON public.%I FOR INSERT TO ${ROLE_NAME} WITH CHECK (true)',
            table_name
          );
        ELSE
          EXECUTE format(
            'CREATE POLICY bus_tracker_runtime_all ON public.%I FOR ALL TO ${ROLE_NAME} USING (true) WITH CHECK (true)',
            table_name
          );
        END IF;
      END LOOP;

      FOR sequence_name IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
      LOOP
        EXECUTE format(
          'GRANT USAGE, SELECT ON SEQUENCE public.%I TO ${ROLE_NAME}',
          sequence_name
        );
      END LOOP;
    END
    $tables$
  `);

  await tx.$executeRawUnsafe(`REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public."AdminAuditLog" FROM ${ROLE_NAME}`);
  await tx.$executeRawUnsafe(`REVOKE ALL ON TABLE public."_prisma_migrations" FROM ${ROLE_NAME}`);

  const [schemaCreate] = await tx.$queryRawUnsafe(`
    SELECT has_schema_privilege('${ROLE_NAME}', 'public', 'CREATE') AS "canCreate"
  `);
  if (schemaCreate?.canCreate) {
    throw new Error('PUBLIC still conveys CREATE on schema public; revoke it before provisioning the runtime identity');
  }
}

async function main() {
  if (!process.env.DIRECT_URL || !migrationConnectionSupported(process.env.DIRECT_URL)) {
    throw new Error('DIRECT_URL must be a private direct or Supavisor session-mode owner connection');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to derive the runtime pooler endpoint');

  const password = runtimePassword();
  const ownerUrl = withConnectionLimit(withDatabaseSchema(process.env.DIRECT_URL, 'public'), 1);
  const runtimeUrl = buildRuntimeUrl(process.env.DATABASE_URL, password);
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  try {
    await owner.$transaction((tx) => provision(tx, password), { maxWait: 10_000, timeout: 60_000 });
  } finally {
    await owner.$disconnect();
  }

  let envContents = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  envContents = updateEnvValue(envContents, 'DATABASE_URL', runtimeUrl);
  envContents = updateEnvValue(envContents, 'DATABASE_CONNECTION_LIMIT', '5');
  envContents = updateEnvValue(envContents, 'REQUIRE_RESTRICTED_DB_ROLE', 'true');
  envContents = updateEnvValue(envContents, 'EXPECTED_RUNTIME_DB_ROLE', ROLE_NAME);
  fs.writeFileSync(ENV_PATH, envContents, { encoding: 'utf8', mode: 0o600 });

  console.log(JSON.stringify({
    runtimeRole: ROLE_NAME,
    provisioned: true,
    runtimeConnectionMode: connectionMode(runtimeUrl),
    runtimePoolLimit: 5,
    migrationConnectionKeptSeparate: true,
    localEnvironmentUpdated: true,
    secretPrinted: false,
  }));
}

main().catch((error) => {
  console.error(`[provision-runtime-role] ${error.message}`);
  process.exitCode = 1;
});
