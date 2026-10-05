require('dotenv').config();

const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const { writeAdminAudit } = require('../src/lib/adminAudit');

const ROLLBACK_PROBE = Symbol('rollback-probe');

async function expectDenied(tx, label, statement) {
  const savepoint = `denied_${label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  let denied = false;
  try {
    await tx.$executeRawUnsafe(statement);
  } catch {
    denied = true;
  } finally {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  }
  assert.equal(denied, true, `${label} unexpectedly succeeded for the runtime role`);
}

async function verifyDeniedOperations() {
  try {
    await prisma.$transaction(async (tx) => {
      const audit = await writeAdminAudit(tx, {
        user: { id: 'restricted-role-verifier' },
        requestId: `runtime-role-${Date.now()}`,
      }, {
        action: 'RUNTIME_ROLE_PERMISSION_PROBE',
        entityType: 'DatabaseRole',
        entityId: 'bus_tracker_runtime',
        afterSummary: { synthetic: true },
      });
      assert.ok(await tx.adminAuditLog.findUnique({ where: { id: audit.id } }));

      await expectDenied(tx, 'create_role', 'CREATE ROLE bus_tracker_runtime_forbidden_probe');
      await expectDenied(tx, 'alter_database', "ALTER DATABASE postgres SET application_name = 'forbidden'");
      await expectDenied(tx, 'create_schema', 'CREATE SCHEMA bus_tracker_runtime_forbidden_probe');
      await expectDenied(tx, 'create_table', 'CREATE TABLE public."RuntimeForbiddenProbe" (id integer)');
      await expectDenied(tx, 'alter_table', 'ALTER TABLE public."RouteService" ADD COLUMN "runtimeForbiddenProbe" integer');
      await expectDenied(tx, 'drop_table', 'DROP TABLE public."RouteService"');
      await expectDenied(tx, 'grant_privilege', 'GRANT SELECT ON public."_prisma_migrations" TO bus_tracker_runtime');
      await expectDenied(tx, 'migration_ledger_read', 'SELECT * FROM public."_prisma_migrations" LIMIT 1');
      await expectDenied(tx, 'audit_update', `UPDATE public."AdminAuditLog" SET action = 'FORBIDDEN' WHERE id = ${audit.id}`);
      await expectDenied(tx, 'audit_delete', `DELETE FROM public."AdminAuditLog" WHERE id = ${audit.id}`);
      throw ROLLBACK_PROBE;
    }, { maxWait: 10_000, timeout: 60_000 });
  } catch (error) {
    if (error !== ROLLBACK_PROBE) throw error;
  }
}

async function main() {
  const expectedRole = String(process.env.EXPECTED_RUNTIME_DB_ROLE || 'bus_tracker_runtime');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT current_user AS "currentUser",
      pg_get_userbyid(d.datdba) AS "databaseOwner",
      r.rolcanlogin AS "canLogin",
      r.rolsuper AS "isSuperuser",
      r.rolcreatedb AS "canCreateDatabase",
      r.rolcreaterole AS "canCreateRole",
      r.rolinherit AS "inheritsRoles",
      r.rolreplication AS "canReplicate",
      r.rolbypassrls AS "bypassesRls",
      has_database_privilege(current_user, current_database(), 'CONNECT') AS "databaseConnect",
      has_schema_privilege(current_user, 'public', 'USAGE') AS "schemaUsage",
      has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
      has_table_privilege(current_user, 'public."RouteService"', 'SELECT, INSERT, UPDATE, DELETE') AS "routeCrud",
      has_table_privilege(current_user, 'public."AdminAuditLog"', 'SELECT, INSERT') AS "auditAppendRead",
      has_table_privilege(current_user, 'public."AdminAuditLog"', 'UPDATE') AS "auditUpdate",
      has_table_privilege(current_user, 'public."AdminAuditLog"', 'DELETE') AS "auditDelete",
      has_table_privilege(current_user, 'public."_prisma_migrations"', 'SELECT, INSERT, UPDATE, DELETE') AS "migrationLedgerAccess",
      (SELECT COUNT(*)::int FROM pg_auth_members membership WHERE membership.member = r.oid) AS "roleMemberships",
      (SELECT COUNT(*)::int FROM pg_namespace n WHERE n.nspowner = r.oid) AS "ownedSchemas",
      (SELECT COUNT(*)::int FROM pg_class c WHERE c.relowner = r.oid) AS "ownedRelations",
      (SELECT COUNT(*)::int FROM pg_tables WHERE schemaname = 'public' AND rowsecurity) AS "rlsTables",
      (SELECT COUNT(DISTINCT p.tablename)::int FROM pg_policies p
        WHERE p.schemaname = 'public' AND current_user = ANY(p.roles)) AS "runtimePolicyTables",
      (SELECT COUNT(*)::int FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
          AND c.relname <> 'AdminAuditLog'
          AND NOT has_table_privilege(current_user, c.oid, 'SELECT, INSERT, UPDATE, DELETE')) AS "applicationTablesMissingCrud",
      (SELECT COUNT(*)::int FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
          AND NOT has_sequence_privilege(current_user, c.oid, 'USAGE, SELECT')) AS "sequencesMissingUse"
    FROM pg_roles r
    JOIN pg_database d ON d.datname = current_database()
    WHERE r.rolname = current_user
  `);
  assert.equal(rows.length, 1, 'runtime role metadata is unavailable');
  const role = rows[0];
  assert.equal(role.currentUser, expectedRole, `DATABASE_URL must authenticate as ${expectedRole}`);
  assert.notEqual(role.currentUser, role.databaseOwner, 'runtime role must not own the database');
  assert.equal(role.canLogin, true, 'runtime role must remain a login role');
  assert.equal(role.isSuperuser, false, 'runtime role must not be a superuser');
  assert.equal(role.canCreateDatabase, false, 'runtime role must not create databases');
  assert.equal(role.canCreateRole, false, 'runtime role must not create roles');
  assert.equal(role.inheritsRoles, false, 'runtime role must not inherit privileges from role memberships');
  assert.equal(role.canReplicate, false, 'runtime role must not have replication privileges');
  assert.equal(role.bypassesRls, false, 'runtime role must not bypass RLS');
  assert.equal(role.databaseConnect, true, 'runtime role requires database CONNECT');
  assert.equal(role.schemaUsage, true, 'runtime role requires public schema usage');
  assert.equal(role.schemaCreate, false, 'runtime role must not create objects in public');
  assert.equal(role.routeCrud, true, 'runtime role requires application-table CRUD through RLS');
  assert.equal(role.auditAppendRead, true, 'runtime role requires audit SELECT and INSERT');
  assert.equal(role.auditUpdate, false, 'runtime role must not update audit evidence');
  assert.equal(role.auditDelete, false, 'runtime role must not delete audit evidence');
  assert.equal(role.migrationLedgerAccess, false, 'runtime role must not access the migration ledger');
  assert.equal(role.roleMemberships, 0, 'runtime role must have no role memberships');
  assert.equal(role.ownedSchemas, 0, 'runtime role must not own schemas');
  assert.equal(role.ownedRelations, 0, 'runtime role must not own tables, sequences, or indexes');
  assert.equal(role.runtimePolicyTables, role.rlsTables, 'every RLS application table requires a runtime-role policy');
  assert.equal(role.applicationTablesMissingCrud, 0, 'an application table is missing required runtime CRUD');
  assert.equal(role.sequencesMissingUse, 0, 'an application sequence is missing required runtime privileges');

  await verifyDeniedOperations();

  console.log(JSON.stringify({
    runtimeRole: role.currentUser,
    separateFromOwner: true,
    loginWithoutMemberships: true,
    privilegeEscalationDisabled: true,
    schemaOwnershipDenied: true,
    applicationCrudTables: Number(role.rlsTables) - 1,
    rlsPolicies: `${role.runtimePolicyTables}/${role.rlsTables}`,
    sequenceUsageComplete: true,
    auditAppendReadVerified: true,
    deniedOperationsVerified: 10,
    syntheticEvidenceRolledBack: true,
    migrationLedgerDenied: true,
  }));
}

main()
  .catch((error) => {
    console.error(`[runtime-role] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
