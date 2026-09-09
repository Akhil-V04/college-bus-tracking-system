# PostgreSQL Migration, Role, Backup and Restore Verification

Updated: 25 August 2026

## Local verification result

The project was verified without modifying the real `public` application schema:

- all four versioned migrations applied to a newly created temporary schema;
- the development seed completed successfully;
- 15 required application tables were present;
- one route, one Student, one Faculty member and one class advisor were seeded;
- no obsolete registration-number, passenger-`active`, QR, boarding-attendance or attendance-status columns existed;
- the temporary clean schema was removed;
- an 85,129-byte custom-format `pg_dump` was created from a second isolated schema;
- that schema was dropped, restored with `pg_restore`, and checked for route/passenger data, all four migration records, notification-reliability columns and administrator-session columns;
- the restored schema and temporary dump file were removed.

The scripts generate schema names using strict `codex_clean_verify_...` or `codex_restore_verify_...` prefixes and refuse to drop other schema names.

## Repeatable commands

```powershell
cd E:\bus-tracking-system\backend
npm run verify:database-clean
npm run verify:backup-restore
```

`verify:database-clean` runs Prisma migration deployment and the seed against an isolated schema. `verify:backup-restore` uses the PostgreSQL 18 `pg_dump` and `pg_restore` executables against another isolated schema.

If PostgreSQL is installed elsewhere, set `PG_BIN_DIR` privately to the directory containing `pg_dump.exe` and `pg_restore.exe`.

Passwords are supplied to PostgreSQL child processes through `PGPASSWORD`; they are not placed in command arguments or printed by the scripts. Production automation should use a managed secret system or `.pgpass` equivalent rather than a long-lived interactive environment variable.

## Local role finding

The local `bus_tracker` development role was verified as:

- login allowed;
- not a PostgreSQL superuser;
- cannot create databases;
- cannot create roles;
- owner of the local development database.

Owning the development database is convenient for migrations, but it is broader than a production runtime needs.

## Required production role separation

Use at least two database identities in production:

1. **Migration role** — used only by controlled deployment jobs; owns or can alter the application schema and migration table.
2. **Runtime role** — used by the Express backend; can connect and perform only the required `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and sequence operations on application objects.

The runtime role must not be a superuser, database owner, schema owner, role creator or database creator. It must not receive permission to drop schemas or alter migrations. Backup credentials should be separate and read-only where the chosen managed PostgreSQL platform permits it.

Role creation and grants are deliberately not automated in the local application migration because production ownership varies by hosting provider. They belong in deployment infrastructure reviewed for the selected platform.

## Production backup policy still required

The isolated drill proves the schema/data can be dumped and restored locally. Production readiness additionally requires:

- encrypted automatic backups;
- defined retention and deletion periods;
- off-instance or provider-managed storage;
- monitoring for failed backups;
- a documented recovery-time objective and recovery-point objective;
- periodic restore drills into a non-production database;
- verification that private passenger, driver and advisor data remain access-controlled in backup storage;
- a disaster-recovery owner and incident runbook.

Never experiment with restore commands against the live production database. Restore into a new isolated database, verify it, and perform a controlled cutover only with an approved operational procedure.
