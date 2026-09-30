# Supabase and Render database identities

Use separate credentials for migrations and the running backend.

1. Keep the Supabase owner/session-mode connection only as a deployment or operator secret. It is the local `DIRECT_URL` used by `prisma migrate deploy`, clean-schema rehearsals, and `pg_dump`/`pg_restore`.
2. Run `npm run provision:runtime-role` from `backend`. It uses the private `DIRECT_URL`, creates or hardens `bus_tracker_runtime` with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`, generates a 36-byte password when one is not supplied, and writes the derived restricted transaction-pool URL only to ignored `backend/.env`. The password is never printed. Set `RUNTIME_DATABASE_PASSWORD` privately only when an externally managed password must be used.
3. The provisioner atomically applies the same grants documented by `backend/prisma/restricted-runtime-policies.sql`: CRUD through role-specific RLS policies on the 27 application tables, sequence use for inserts, audit `SELECT`/`INSERT` only, no public-schema creation, and no Prisma migration-ledger access. It removes role memberships and fails if `PUBLIC` still conveys schema creation.
4. Build the Render `DATABASE_URL` from the Supavisor connection details for `bus_tracker_runtime`, explicitly target `schema=public`, and use the blueprint's bounded connection limit. Keep `DIRECT_URL` out of the web and retention services.
5. Before release, run `npm run verify:runtime-role`, then `npm run verify:restricted-acceptance`. The first command verifies ownership/role attributes, all RLS policies and sequences, audit append/read, and ten rollback-safe denied operations. The second runs 14 checks under the runtime URL, including all 27 application-table mutation groups, competing roster publication, API/privacy/socket/session/outbox/rate-limit/load behavior, Google Maps and retention dry-run. Use the owner `DIRECT_URL` only for migrations, clean-schema, and restore drills.

The policy file is intentionally not an automatic Prisma migration because the login role and password belong to deployment secret management. Each future migration that adds a table must be followed by reapplying the policy file before the runtime service uses that table.

For the shared Supavisor pooler, a custom login uses `[ROLE].[PROJECT-REF]`; runtime traffic uses transaction mode on port 6543. The provisioner derives this from the already configured pooler URL instead of reconstructing the regional host. Render receives `DATABASE_URL` with a five-connection Prisma pool and never receives `DIRECT_URL`.

Supabase documents the Prisma connection split in its [Prisma guide](https://supabase.com/docs/guides/database/prisma) and recommends session mode for database migration tooling in its [Postgres migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres).
