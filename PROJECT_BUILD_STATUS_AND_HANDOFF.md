# College Bus Tracking System — Build Status and Agent Handoff

Last updated: 25 August 2026

This file is the durable continuation point for a developer or another coding agent. Read `PRD.md` first for product rules, then this file for current implementation status and the next build steps. Do not restart the project from scratch.

## 1. Honest progress estimate

The percentages below estimate remaining engineering effort, not just the number of files created.

| Area | Weight | Complete | Status |
|---|---:|---:|---|
| Requirements and privacy rules | 5% | 5% | Complete |
| PostgreSQL/domain/backend foundation | 10% | 10% | Complete |
| Administrator and annual-roster backend | 15% | 15% | Complete |
| Live-trip/GPS/ETA backend | 15% | 13% | Code complete; real-road calibration remains |
| Late alerts and notification reliability | 10% | 9% | Worker/retries complete; real SMTP account and delivery pilot remain |
| Security, API integration, performance and recovery testing | 15% | 15% | Local release gate complete |
| Final React admin and React Native experience | 20% | 17% | Required screens complete; target-browser/device acceptance remains |
| Deployment, production data, field test and pilot | 10% | 3% | CI/container/build profiles exist; external rollout remains |
| **Overall production MVP** | **100%** | **about 87%** | **about 13% remains, all dependent on target infrastructure/data/devices or visual sign-off** |

Repository implementation is a **local release candidate**. The remaining percentage is not hidden coding work: it is target-browser visual sign-off, real college data/approvals, HTTPS/secrets/SMTP, real Android background tests, road calibration and a supervised pilot.

## 2. Locked product decisions

These decisions came directly from the project owner and must not be reversed:

- PostgreSQL with Prisma is the database; MySQL is obsolete for this repository.
- The final mobile application uses React Native/Expo, not Flutter.
- Passengers do not create accounts or sign in. Driver and administrator access requires authentication.
- “Passenger” includes both Student and Faculty. Interfaces show a small Student/Faculty badge.
- The system stores assigned passenger lists; it does not claim who actually boarded.
- No QR boarding scans and no bus attendance tracking.
- Class advisors verify attendance in class. Late alerts describe students assigned to the delayed bus/class group.
- Driver/passenger phone numbers are private and visible only to administrators. Public and driver APIs must not expose them.
- Route number is the operational bus identity. Do not add a government vehicle registration-number field.
- Do not add a passenger `active` field. Annual published rosters determine the current transport list.
- Bus capacity is route-specific and the assigned passenger count may differ by academic year.
- A passenger selects one route/bus number; route and bus number are not separate selectors.
- ETA must explicitly handle no data, unreliable/stale GPS, off-route, stopped bus, at stop, passed, possibly skipped, route completed and trip ended. Passed/skipped stops never return a negative ETA.
- The implemented clients cover the stable workflows. Future visual redesigns may change presentation but must preserve API/domain/privacy behavior.

## 3. Technology stack

- Database: PostgreSQL 18 locally, Prisma ORM and versioned SQL migrations.
- Backend: Node.js, Express, Socket.IO, Zod, JWT, bcrypt, Helmet and scoped rate limiting.
- Email delivery: durable PostgreSQL outbox plus Nodemailer SMTP adapter. No credentials are committed.
- Administrator client: React + Vite reference application.
- Mobile client: React Native + Expo + Expo Router reference application.
- Imports/exports: ExcelJS and Multer for CSV/XLSX annual rosters.
- Tests: Node's built-in `node:test`, plus isolated real-PostgreSQL integration scripts.

## 4. Completed milestones

### Foundation and data model

- PostgreSQL conversion completed; obsolete MySQL migration removed from active history.
- Route services, stops, versioned schedules, versioned rosters, unified passengers, drivers, advisors, trips, locations, stop events, alerts, outbox and audit models exist.
- Local database, development seed, private administrator password setup and health endpoint verified.
- Flutter source removed and React Native/Expo reference client established.

### Annual roster and administrator workflows

- Server-side CSV/XLSX templates and complete exports.
- Non-writing import preview with row-level validation.
- Atomic draft import with duplicate, capacity, route, stop and advisor checks.
- Student roll-number rules and Faculty ID rules.
- Formula-injection protection, upload limits and privacy-safe exports.
- Administrator audit events and private paginated audit query API.

### Live tracking

- Idempotent/concurrent trip start and end.
- Assigned-driver enforcement and reconnect snapshots.
- GPS replay/idempotency, accuracy, clock, order and impossible-speed validation.
- Rejected GPS samples are kept diagnostically but cannot move public progress or ETA.
- Monotonic reached/possibly-skipped stop progress with PostgreSQL row locking.
- Stale/no-data/off-route/stationary detection and recovery events.
- Explicit stateful ETA responses and scheduled-time fallback labels.
- Duplicate Socket.IO passenger broadcasts fixed.
- Detailed contract: `docs/LIVE_TRACKING_API.md`.

### Late alerts and notification reliability

- Three consecutive confident late observations are required before an alert.
- Alerts snapshot assigned students and available class advisors without using boarding attendance.
- Immutable alert evidence uses a SHA-256 hash chain.
- A partial unique PostgreSQL index prevents two active alerts for one trip.
- A PostgreSQL advisory transaction lock keeps concurrent hash-chain creation linear.
- Notification rows have stable idempotency keys, persisted next-attempt timestamps, lock tokens, stale-lock recovery, attempt history and provider message IDs.
- Workers claim rows with `FOR UPDATE SKIP LOCKED`, preventing concurrent double claims.
- Transient failures use bounded backoff; SMTP 5xx/permanent errors and maximum-attempt failures become `FAILED`.
- Development console and production SMTP provider boundaries exist. The worker is disabled by default until explicitly configured.
- Administrator APIs expose pending/sent/failed counts, missing-advisor groups, delivery details, individual retry and retry-all-failed actions.
- Retry actions are administrator-audited and never expose recipients publicly.
- Detailed contract should be maintained in `docs/NOTIFICATION_OUTBOX_API.md`.

### Phase 6 security baseline

- Helmet deny-by-default API security headers and strict configured browser origins.
- Correlation IDs plus metadata-only structured logs that omit bodies, queries, headers, tokens, IP addresses and private identifiers.
- Failed-login, roster-import and GPS-socket burst limits with configurable safe defaults.
- Obsolete HTTP password-hash helper removed; local administrator setup script remains the only bootstrap path.
- Automated header/CORS/role/rate/log-redaction tests.
- Read-only PostgreSQL API privacy verification for public passenger and driver responses.
- Isolated two-route Socket.IO verification proves anonymous/wrong-driver rejection and zero cross-route bus updates.
- Detailed baseline: `docs/SECURITY_BASELINE.md`.
- All four migrations and the seed verified from a clean isolated PostgreSQL schema; 15 required tables and zero obsolete attendance/QR/registration/active columns confirmed.
- Local `bus_tracker` confirmed as non-superuser without database/role creation, while documenting that production must separate migration ownership from runtime access.
- Isolated custom-format `pg_dump`/`pg_restore` drill restored seeded data, migration history and notification columns, then removed its temporary schema and dump.
- Detailed database/recovery evidence: `docs/DATABASE_RECOVERY.md`.
- Repeatable 10,000-row CSV parse/validation limits and one-over-limit rejection checks.
- Five concurrent outbox workers processed 500 generated notifications as disjoint 100-row batches without duplicate test-provider delivery.
- Detailed local performance evidence and production caveats: `docs/PERFORMANCE_LIMITS.md`.
- PostgreSQL-backed administrator sessions add immediate logout, individual/all-session revocation, expiry enforcement and password-rotation invalidation.
- Production defaults to a two-hour admin session and twelve-hour driver token, with bounded configuration and placeholder-secret rejection.
- Detailed authentication contract: `docs/AUTH_SESSIONS_API.md`.

## 5. Database migrations

Apply migrations in order; never edit a migration already used by another environment:

1. `20260824230000_postgresql_foundation`
2. `20260825030000_live_tracking_hardening`
3. `20260825050000_notification_outbox_reliability`
4. `20260825080000_admin_sessions`

The local PostgreSQL database has all four migrations applied.

## 6. Important code map

| Path | Responsibility |
|---|---|
| `PRD.md` | Product source of truth and worst-case behavior |
| `bus-tracking-project-plan.md` | Phase and delivery order |
| `BUILD_AND_INTERVIEW_GUIDE.md` | Learning journal, commands and interview explanations |
| `backend/prisma/schema.prisma` | Current PostgreSQL domain model |
| `backend/src/lib/liveTracking.js` | GPS acceptance and route progress |
| `backend/src/lib/eta.js` | ETA state machine |
| `backend/src/socket.js` | Authenticated GPS ingestion and passenger events |
| `backend/src/lib/lateAlert.js` | Late evaluation, alert snapshot and outbox creation |
| `backend/src/lib/notificationOutbox.js` | Claiming, retries, locking and worker loop |
| `backend/src/lib/notificationProvider.js` | Console/SMTP provider boundary and email content |
| `backend/src/routes/late-alerts.js` | Private alert/delivery/missing-advisor/retry APIs |
| `backend/src/lib/adminAudit.js` | Privacy-safe administrator audit summaries |
| `backend/src/middleware/security.js` | Headers, HTTP limits, GPS limits and metadata-only logs |
| `backend/src/lib/adminSessions.js` | Admin lifetime policy, database validation, revocation and retention |
| `backend/scripts/verify-admin-sessions.js` | Isolated real-PostgreSQL session/revocation verification |
| `docs/AUTH_SESSIONS_API.md` | Authentication and rotation contract |
| `backend/scripts/verify-api-privacy.js` | Read-only public/driver privacy verification |
| `backend/scripts/verify-socket-isolation.js` | Two-route authorization/event-isolation verification |
| `backend/scripts/verify-clean-database.js` | Isolated migration/seed and role verification |
| `backend/scripts/verify-backup-restore.js` | Isolated pg_dump/pg_restore drill |
| `backend/scripts/verify-load-limits.js` | Generated roster and outbox load/resource verification |
| `docs/PERFORMANCE_LIMITS.md` | Measured local limits and production caveats |
| `backend/scripts/verify-notification-outbox.js` | Isolated real-PostgreSQL worker verification |
| `admin-panel/` | Functional React admin reference; not final design |
| `mobile-app/` | Functional React Native reference; not final design |

## 7. How to resume safely

The working tree contains intentional uncommitted project work and the Flutter-to-React-Native replacement. Do not run `git reset --hard`, do not restore deleted Flutter files, and do not overwrite unrelated changes.

From a fresh terminal:

```powershell
cd /d E:\bus-tracking-system\backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run validate
node scripts/verify-notification-outbox.js
node scripts/verify-api-privacy.js
node scripts/verify-socket-isolation.js
npm run verify:database-clean
npm run verify:backup-restore
npm run verify:load-limits
npm run verify:admin-sessions
npm run dev
```

Why these commands are used:

- `npm install` restores exact JavaScript dependencies from the lockfile.
- `prisma generate` regenerates the typed client after schema changes. On Windows, stop the backend first because Node can lock Prisma's DLL.
- `prisma migrate deploy` applies only versioned migrations that have not yet run.
- `npm run validate` validates the Prisma schema and runs all unit tests.
- The integration script verifies database row locking, retry recovery, stale-lock recovery and idempotency, then removes only its temporary records.
- `npm run dev` starts the backend on port 4000 with automatic restart.

For local simulated notification delivery, add this only to the untracked `backend/.env`:

```env
NOTIFICATION_PROVIDER="console"
NOTIFICATION_POLL_INTERVAL_MS="5000"
```

For real email, use `NOTIFICATION_PROVIDER="smtp"` and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` privately. Never commit these values. SMTP uses a deterministic Message-ID, but no SMTP system can guarantee exactly-once delivery after a process crash unless the upstream provider also honors idempotency.

## 8. Local implementation completed after the 68% checkpoint

- Added migration `20260825093000_shared_rate_limits`, the `RateLimitBucket` model and PostgreSQL-backed Express rate-limit store. Raw client identifiers are SHA-256 hashed, limiter prefixes isolate purposes, two store instances share counts, and production fails closed unless `RATE_LIMIT_STORE=postgres`.
- Added explicit `TRUST_PROXY_HOPS`, database readiness, `X-API-Version: 1`, stable `/api/v1` aliases and the private `/operations/summary` contract.
- Added dry-run-first session/rate-bucket retention, monitoring guidance, dependency policy, CI, Docker staging files, Nginx API/Socket proxy and Expo EAS profiles.
- Moved administrator browser auth to HttpOnly/SameSite cookies with CSRF protection and retained revocable PostgreSQL sessions. Real integration verified login, cookie flags, CSRF rejection, logout and revocation.
- Added admin Operations, Audit History and Sessions screens and migrated the client to `/api/v1`. Production build passes.
- Added native Expo background driver location, a persistent Android service notification, original device timestamps and a visible bounded 200-sample offline queue. Passenger UI now has Track Bus, reconnect feedback, scheduled times and explicit messages for all ETA states.
- Added release API/privacy integration verification. Clean migration now proves five migrations/16 tables; backup/restore proves the rate-limit table and five migration records.
- Backend validation passes 59 tests. Admin production build, mobile strict TypeScript, resolved Expo configuration and web static export pass.

## 9. Remaining external release gates (about 13%)

1. Import and transport-office approval of real routes, stop coordinates, times, capacities, drivers, advisors and annual passenger data.
2. Deploy PostgreSQL/backend/admin behind HTTPS/WSS using a secret manager and separate migration/runtime database roles.
3. Configure a real SMTP sender and test success, permanent rejection, retries, SPF/DKIM and recovery with advisors.
4. Build/install the Android development client; test permission settings, background notification, screen lock, battery optimization, network loss/queue recovery, pause/end/logout on real devices.
5. Calibrate reached/skipped/off-route thresholds and ETA confidence on real roads; never present the local straight-segment estimate as guaranteed arrival time.
6. Complete target-browser responsive/accessibility/visual acceptance. The in-app browser harness was unavailable locally because the desktop sandbox helper failed; do not mark this passed based only on builds.
7. Run one supervised route pilot, then a small group, then fleet rollout with rollback ownership and backup/restore evidence.

No coding agent can truthfully complete these without the college's data, credentials, devices, roads and approval. Do not fabricate completion.

## 10. Release commands

```powershell
cd E:\bus-tracking-system\backend
npm run validate
npm run verify:shared-rate-limit
npm run verify:admin-sessions
npm run verify:admin-cookie-auth
npm run verify:release-api
npm run verify:database-clean
npm run verify:backup-restore
npm run verify:load-limits

cd E:\bus-tracking-system\admin-panel
npm run build

cd E:\bus-tracking-system\mobile-app
npm run typecheck
npx expo config --type public
npx expo export --platform web
```

Read `docs/DEPLOYMENT_AND_RELEASE.md`, `docs/OPERATIONS_AND_RETENTION.md` and `docs/API_CONTRACT_V1.md` before staging.