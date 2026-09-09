# College Bus Tracking System — Build Journal and Interview Guide

> Living document: update this file whenever a meaningful feature, architectural decision, command, test, migration, or deployment step is added to the project.

Last updated: 24 August 2026

## 1. Project summary

The College Bus Tracking System is a transport-management and live-tracking platform for a college operating approximately 31 bus routes.

The system has three audiences:

1. **Passengers** — students and faculty members. They do not create accounts or log in. They select a route and can view its schedule, stops, assigned driver name, passenger list, live location, and ETA.
2. **Drivers** — authenticated users who share the live location of their assigned route while operating a trip.
3. **Administrators** — authenticated transport staff who manage routes, stops, schedules, drivers, annual passenger rosters, advisors, trips, late alerts, imports, and exports.

The system deliberately does **not** scan QR codes or record daily passenger attendance. Its job is to track buses and notify the college about students assigned to a late bus. Class advisors verify actual attendance after reaching the classroom.

## 2. Problem being solved

The college needs one reliable source of truth for:

- route numbers, route details, stops, and expected arrival times;
- each bus route's configurable capacity;
- the driver currently assigned to each route;
- students and faculty assigned to each bus and boarding stop;
- live bus location and estimated arrival time;
- identifying when a bus is likely to reach college late;
- notifying the relevant class advisors about students assigned to that late bus;
- replacing the passenger roster at the start of each academic year while retaining exportable historical records.

## 3. Important product decisions

### Route number and bus number

For this college, the operational route number and bus number represent the same service. The application therefore stores one canonical field: `routeNo`.

We do not store the government vehicle registration plate. Physical vehicles may be exchanged while the college continues to operate the same route number.

### Passengers do not need accounts

Creating thousands of student and faculty login accounts every academic year would introduce unnecessary account lifecycle, password-reset, privacy, and support work. Passenger information is imported and maintained by administrators, but passenger-facing route information is accessible without authentication.

### Student and faculty are passenger types

The generic business entity is a passenger. A `passengerType` value distinguishes:

- `STUDENT`
- `FACULTY`

The interface uses small visual badges/highlights to distinguish the two types.

### No transport attendance tracking

The system does not claim that an assigned passenger actually boarded the bus. There is no QR scan, boarding event, daily attendance field, or live occupied-seat counter.

When the application shows occupancy, it means:

```text
assigned passengers / configured route capacity
```

It is a planning value, not a real-time boarding count.

### Phone-number privacy

Driver and other phone numbers are stored for administrative use. Only administrators can retrieve them. Passenger and driver APIs must not include phone numbers, even if a UI currently does not display them. This prevents accidental exposure through browser developer tools or network inspection.

### Academic-year roster lifecycle

Rosters move through explicit states:

- `DRAFT` — next year's data can be prepared and validated without changing the live passenger view.
- `PUBLISHED` — the roster currently used by passenger views, trips, and late-alert logic.
- `ARCHIVED` — a past roster retained for audit/history.

Publishing is atomic: either the complete new roster becomes active or nothing changes. The previous published roster is archived in the same transaction.

### Late-bus alerts are assignment based

A late alert contains students assigned to the route's published roster. It does not say those students boarded the bus. Students are grouped by department, academic year, and section so notifications can be sent to the relevant class advisors.

The current college-arrival deadline is configurable and initially set to 09:50 in the `Asia/Kolkata` timezone.

## 4. Technology stack

### Backend

- **Node.js** — JavaScript runtime for the API and real-time server.
- **Express** — REST API framework.
- **Prisma ORM** — schema definition, generated database client, migrations, and seeding.
- **PostgreSQL** — relational database using timezone-aware timestamps, JSONB, check constraints, and partial indexes.
- **Socket.IO** — real-time driver location updates and passenger broadcasts.
- **JSON Web Tokens (JWT)** — admin and driver authentication.
- **bcrypt 6** — secure password hashing.
- **Node test runner** — focused automated unit tests.

### Admin application

- **React** — administrator interface.
- **Vite** — development server and production build tooling.

The existing admin prototype still needs to be refactored to use the new route-service, schedule, roster, and alert APIs.

### Mobile/passenger application

- **React Native 0.86 + React 19 + TypeScript** — shared Android/iOS application code.
- **Expo SDK 57** — mobile framework and build tooling.
- **Expo Router** — file-based navigation.
- **TanStack Query** — REST data caching, retries, and invalidation.
- **Socket.IO Client** — live passenger subscriptions and authenticated driver GPS.
- **react-native-maps + expo-location** — native maps and device location.
- **Expo SecureStore** — operating-system-backed driver JWT storage.

On 2026-08-24, the generated Flutter prototype was removed and replaced with the React Native foundation. Git history preserves the old prototype, but it is no longer part of the active project.

### Development and source control

- **Git and GitHub** — version history and remote repository.
- Repository: <https://github.com/Akhil-V04/college-bus-tracking-system>

## 5. High-level architecture

```text
Passenger React Native app (no login) ── REST + Socket.IO ─┐
                                                           │
Driver React Native app (JWT login) ──── REST + Socket.IO ─┼── Node/Express backend ── Prisma ── PostgreSQL
                                                           │
React admin panel (JWT login) ────────── REST ─────────────┘
```

REST endpoints handle durable operations such as configuration, route details, rosters, trip start/end, and history. Socket.IO handles frequently changing live-location events.

## 6. Backend directory responsibilities

```text
backend/
├── prisma/
│   ├── schema.prisma       Database schema and relationships
│   ├── migrations/         Version-controlled SQL migrations
│   └── seed.js             Development sample data
├── src/
│   ├── index.js            Express/HTTP/Socket.IO startup and route mounting
│   ├── socket.js           Secure live-location event handling
│   ├── middleware/         Authentication and authorization
│   ├── lib/                ETA, time, hashing, and late-alert business logic
│   └── routes/             REST endpoint modules
└── tests/                  Automated backend tests
```

## 7. Database design

### Main tables

| Model | Purpose |
|---|---|
| `RouteService` | Canonical bus/route number, route name, covered area, capacity, and assigned driver |
| `Stop` | Ordered boarding stops belonging to a route service |
| `ScheduleVersion` | Draft or published schedule version for a route |
| `ScheduleStop` | Planned time and ordering for each stop in a schedule version |
| `Driver` | Driver code, name, admin-only contact details, password hash, and session version |
| `TransportRoster` | Academic-year roster with draft/published/archived status |
| `RosterPassenger` | Student/faculty identity, route, stop, bus pass ID, and conditional academic identifiers |
| `ClassAdvisor` | Maps a department/year/section to an advisor and notification destination |
| `Trip` | A route journey with snapshots of route, driver, roster, and schedule |
| `LiveLocation` | Accepted GPS observations for a running trip |
| `TripStopEvent` | Progress and status of stops during a trip |
| `LateAlert` | Immutable snapshot of a confirmed late-bus event |
| `NotificationOutbox` | Reliable queued notification delivery records |
| `AdminAuditLog` | Administrative action history |

### Why trips store snapshots

Routes, drivers, schedules, and passenger assignments can change later. A trip references the versions that were active when it began so historical records remain understandable and do not silently change after an administrator edits current data.

### Conditional passenger identifiers

Students can store roll number, department, academic year, and section. Faculty members store a faculty ID. Validation prevents invalid or incomplete records from being published.

## 8. API and service work completed

### Route services

- Public sanitized route list and route details.
- Driver endpoint for the driver's assigned route.
- Admin-only create, read, update, and management operations.
- Public responses include driver name but not phone number.

### Versioned schedules

- Create draft schedule versions.
- Add and arrange scheduled stops.
- Validate schedule integrity.
- Publish a schedule atomically.

### Annual rosters

- Create a new draft or copy a previous roster into a draft.
- Add, update, and remove passengers in a draft.
- Bulk insert structured passenger data.
- Validate required identifiers, capacity, assigned stops, and advisor coverage.
- Publish atomically and archive the previously published roster.

CSV/XLSX file parsing and one-click downloads are planned for the admin phase. The core roster model and publication workflow are already present.

### Passenger endpoints

- No-login route listing.
- Sanitized route details.
- Published passenger list grouped by stop with student/faculty type markers.
- Smart ETA response.
- No phone numbers or full private identifiers in passenger responses.

### Driver authentication and trip operations

- Drivers sign in using a driver code and password.
- Passwords are hashed by the server.
- JWT identifies and authorizes the driver.
- Driver can start/resume only a trip for the assigned route.
- Starting is idempotent: repeated requests should resume an existing running trip rather than create duplicates.
- Driver/admin can end a trip securely.

### Live tracking

- Driver Socket.IO connection requires a valid JWT.
- Each location update checks route and trip ownership.
- Physically impossible speed jumps are rejected.
- Accepted locations are written to the database and broadcast to passenger clients.
- Stop progression is monotonic so a trip cannot move backward through the stop timeline.

### ETA states

ETA is not represented only as a number. It returns a state so the UI can be honest when information is incomplete or the stop is no longer reachable on the current trip:

- `NOT_STARTED`
- `UPCOMING`
- `ARRIVING`
- `AT_STOP`
- `PASSED`
- `POSSIBLY_SKIPPED`
- `OFF_ROUTE`
- `NO_LIVE_DATA`
- `TRIP_ENDED`
- `UNKNOWN`

If the bus has passed a stop, the application returns “bus already passed” instead of a negative ETA.

The current estimator uses recent accepted GPS samples, returns a time range rather than false precision, and includes a confidence value. Future map-matching or traffic providers can improve the estimator without changing the product contract.

### Late-alert protection

A single noisy GPS reading must not trigger an alert. The current logic:

1. throttles repeated observations;
2. requires a confident ETA evaluation;
3. requires three consecutive late evaluations;
4. compares projected college arrival with the configured local deadline;
5. snapshots assigned students and relevant advisors;
6. creates notification-outbox records;
7. records recovery if the estimate improves later.

Alert evidence is protected with a hash chain. Mutable notification/recovery fields are excluded from the immutable evidence hash so legitimate status updates do not invalidate the event record.

The delivery worker is now implemented with PostgreSQL row claiming, bounded retry scheduling, stale-lock recovery, stable idempotency keys, console/SMTP providers, missing-advisor visibility, and audited administrator recovery actions.

## 9. Important failure scenarios considered

The complete catalogue is in `PRD.md`. Important examples include:

- bus has not started, GPS permission is denied, or the driver loses internet;
- stale location data must not be shown as live;
- the bus passes or skips a selected stop;
- GPS jumps to an impossible location;
- a driver attempts to update another route;
- driver presses Start Trip repeatedly;
- schedule changes while a trip is running;
- roster import contains duplicates or passengers assigned to unknown stops;
- a roster exceeds route capacity;
- advisor mappings are missing for students who could appear in late alerts;
- two administrators attempt to publish simultaneously;
- annual publication partially fails;
- notification delivery fails or is duplicated;
- private phone numbers accidentally appear in public API responses.

Each case should produce an explicit state, validation error, retryable operation, or transaction rollback rather than silently producing misleading data.

## 10. PostgreSQL decision and local database setup

### Final database decision

PostgreSQL is the project's selected relational database. An initial MySQL 9.3 environment was configured during foundation testing, but the decision changed before production or real college data existed. The old MySQL database was left untouched for recoverability and is no longer used by the application.

PostgreSQL was selected because it provides strong transactions plus useful native features for this tracking domain:

- TIMESTAMPTZ(3) for unambiguous trip, GPS, schedule-version, and alert instants;
- JSONB for immutable student/advisor alert snapshots;
- partial unique indexes allowing at most one RUNNING trip per route and driver;
- check constraints for capacity, coordinates, sequence ordering, and academic year;
- targeted partial indexes for actionable notification rows and active late alerts.

The college-scale workload does not require 64-bit identifiers yet, so Prisma Int identifiers are retained to keep JSON and API handling simple. They can be migrated to BigInt if future growth justifies it.

### Least-privilege application role

Local and production backends must not connect as the PostgreSQL postgres superuser. The application uses a dedicated login role and database:

Database: college_bus_tracking
Application role: bus_tracker
Schema: public

A local administrator creates the database and role, grants only the privileges needed for migrations and application queries, and places the password only in backend/.env.

For production, use a PostgreSQL connection pooler such as PgBouncer and separate migration privileges from everyday application privileges.

### Environment variables

The backend reads local settings from `backend/.env`. The file must stay out of Git because it contains secrets.

Important variables:

| Variable | Reason |
|---|---|
| `DATABASE_URL` | Tells Prisma how to connect to PostgreSQL |
| `PORT` | Backend HTTP port |
| `NODE_ENV` | Development/production behavior |
| `JWT_SECRET` | Signs admin and driver authentication tokens |
| `ADMIN_EMAIL` | Configured administrator login identity |
| `ADMIN_PASSWORD_HASH` | bcrypt hash; never store the plain password |
| `CORS_ORIGINS` | Browser origins allowed to call the backend |
| `APP_TIMEZONE` | Makes deadline calculations use the college timezone |
| `COLLEGE_ARRIVAL_DEADLINE` | Configurable threshold for late-bus evaluation |

Google OAuth configuration was removed because passengers do not authenticate and only administrators/drivers require accounts.

## 11. Commands used and why

Run backend commands from:

```cmd
cd /d E:\bus-tracking-system\backend
```

### Install dependencies

```cmd
npm install
```

Reads `package.json`/the lockfile and installs the exact JavaScript packages required by the backend.

### Validate the Prisma schema

```cmd
npx prisma validate
```

Checks schema syntax, relations, indexes, datasource settings, and environment-variable availability without changing database data.

### Generate Prisma Client

```cmd
npx prisma generate
```

Generates the type-aware JavaScript database client from `schema.prisma`.

### Apply version-controlled migrations

```cmd
npx prisma migrate deploy
```

Applies migration SQL already committed in `prisma/migrations`. We used `deploy` for the prepared initial migration because it does not attempt to create a shadow database or invent a new migration.

The earlier local MySQL exercise applied `20260824211500_initial_foundation`; that migration is now superseded. The PostgreSQL cutover will apply the active migration:

```text
20260824230000_postgresql_foundation
```

This has not yet been deployed to the new local PostgreSQL database.

### Seed development data

```cmd
npx prisma db seed
```

Runs `prisma/seed.js` to create a small repeatable dataset for local testing: route `01`, ordered stops, a published schedule, demo driver `DRV001`, a published roster, student/faculty passengers, and an advisor.

The demo driver's initial password must be changed before any shared environment is used.

### Run backend validation and tests

```cmd
npm run validate
```

Runs Prisma validation and automated tests together. Current focused tests cover:

- request/data validation schemas;
- ETA behavior and states;
- immutable alert hash integrity;
- timezone/deadline calculations.

### Start the development backend

```cmd
npm run dev
```

Starts the Express and Socket.IO backend in development mode. The health endpoint is:

```text
http://localhost:4000/health
```

### Check production dependencies for known vulnerabilities

```cmd
npm audit --omit=dev
```

Checks runtime packages against the npm advisory database. The last completed backend audit reported zero production vulnerabilities after upgrading to bcrypt 6.

### Build the admin application

From the admin-panel directory:

```cmd
npm run build
```

Produces an optimized production bundle and catches compile-time/import errors. The administrator refactor is still in progress.

### Create the React Native application

From the repository root:

```cmd
npx create-expo-app@latest mobile-app --template default --yes
```

Creates the Expo SDK 57, React Native, TypeScript, and Expo Router foundation. The obsolete Flutter directory was removed first; its history remains available through Git.

### Install mobile capabilities

From `mobile-app/`:

```cmd
npx expo install expo-location expo-secure-store react-native-maps
npm install @tanstack/react-query socket.io-client
```

`expo install` selects versions compatible with the installed Expo SDK. The other packages provide server-state caching and Socket.IO communication.

### Validate the React Native application

```cmd
npm run validate
```

Runs `tsc --noEmit` in strict mode. It checks navigation modules, API response types, platform map files, authentication storage, and driver GPS code without producing a build artifact.

## 12. Testing completed so far

- Prisma schema validation passed.
- Prisma Client generation passed.
- The superseded MySQL migration was replaced by a clean PostgreSQL migration with native constraints and indexes.
- Development seed completed successfully.
- All 11 backend tests pass with the PostgreSQL Prisma provider: 11 passed, 0 failed, 0 skipped, and 0 cancelled.
- Backend module-load checks passed.
- The earlier admin prototype build passed. The current refactor build correctly exposes unfinished work: `DriversScreen`, `ClassAdvisorsScreen`, `SchedulesScreen`, and `RostersScreen` are imported but not implemented yet.
- npm production dependency audit reported zero vulnerabilities.
- React Native strict TypeScript validation passed with zero errors.
- Expo Doctor passed all 21 SDK/package/configuration checks.
- Expo web export succeeded and generated six static routes: passenger home, dynamic route details, driver console/login, sitemap, and not-found.
- Mobile npm audit reports a moderate uuid advisory through Expo's transitive iOS build tooling. The suggested forced fix would downgrade Expo SDK 57 to SDK 46, so it was rejected as unsafe; monitor upstream and upgrade through an Expo-compatible release.

The running backend health check returned `{"status":"ok","version":"2.0.0-foundation"}`. Database-backed API checks also verified that seeded route `01` loads, demo driver `DRV001` can authenticate and sees assigned route `01`, the public roster returns one student and one faculty member, and passenger responses expose no phone number, roll number, bus-pass ID, or faculty ID.

## 13. Git history established

The repository is connected to GitHub and the following foundation commits were pushed:

```text
e64e164 chore: preserve initial prototype and add product requirements
3e3551c feat: establish route service and roster foundation
```

New work should be committed in coherent milestones after tests pass. Secrets such as `.env` and database passwords must never be committed.

## 14. Current project status

### Completed backend baselines

- PostgreSQL/Prisma foundation and four applied versioned migrations.
- Functional React administrator and React Native/Expo reference clients.
- Private administrator bootstrap plus driver authentication and session boundaries.
- Route, stop, schedule, driver, advisor, roster and trip administrator workflows.
- Server-side CSV/XLSX annual roster template, preview, validation, atomic import and complete export.
- Privacy-sanitized administrator audit coverage and query API.
- Concurrent/recoverable trip lifecycle, hardened GPS ingestion, route progress, stale monitoring and explicit ETA states.
- Late-alert evidence, one-active-alert enforcement, linear hash-chain writes and notification outbox creation.
- Notification worker locking, idempotency, retries, permanent failure, stale-lock recovery, missing-advisor visibility and administrator requeue APIs.
- Forty-eight backend unit tests plus isolated real PostgreSQL and Socket.IO verification scripts.

### Partially complete

- ETA is stateful and conservative, but road map-matching, real traffic calibration and historical learning need field data.
- React Native foreground tracking works as a reference; Android background collection and bounded offline queuing need a development build and physical-device tests.
- The reference administrator screens exercise real APIs, but the final visual design, large-data workflows and accessibility pass are deferred.
- Security/privacy coverage exists in focused areas, but full HTTP/socket authorization, rate-limit, load, backup/restore and clean-environment tests remain.

### Not yet complete

- Production SMTP credentials and a real advisor-delivery pilot.
- Phase 6 security, performance, recovery and stable-contract acceptance gate.
- Final administrator and React Native redesign plus component/end-to-end tests.
- Production hosting, HTTPS/WSS, managed secrets, monitoring, backups and operational runbook.
- Real route data import, coordinate/timing verification, ETA calibration and staged fleet pilot.

## 15. Revised implementation phases

### Phase 1 — Product and backend foundation

Status: mostly complete.

- finalize requirements and privacy rules;
- define Prisma schema and migrations;
- implement authentication and role boundaries;
- build route, stop, schedule, roster, trip, ETA, and late-alert foundations;
- configure local database and seed data;
- add focused automated tests.

### Phase 2 — Administrator system

- create secure admin login/bootstrap flow;
- replace prototype admin navigation and old API usage;
- implement route/service, stop, capacity, schedule, driver, and advisor management;
- implement CSV/XLSX template download, draft import, validation/error preview, atomic publish, archive, and one-click export;
- add late-alert and notification-delivery dashboards;
- add audit log views.

### Phase 3 — Passenger and driver applications

- remove student Google login, QR scanning, and attendance/occupancy screens;
- create no-login route selection and passenger route details;
- show driver name only, route schedule, stop timeline, and passenger list with type badges;
- implement Track Bus and Estimate Time flows;
- implement driver-code login, assigned-route trip controls, permissions, and robust location transmission;
- display stale/no-data/passed/skipped/off-route/ended states honestly.

### Phase 4 — Notifications and resilience

- implement notification-outbox worker with retries and idempotency;
- configure advisor email delivery and admin visibility;
- improve ETA with map matching and optionally traffic data;
- test intermittent network, GPS noise, app termination, duplicate events, and concurrency;
- add retention, backup, and recovery policies.

### Phase 5 — End-to-end verification and deployment

- integration tests using a dedicated test database;
- admin, passenger, and driver end-to-end scenarios;
- real-route field testing with drivers;
- privacy/security review;
- HTTPS production deployment, secrets management, database backups, logging, and monitoring;
- train transport administrators and drivers.

## 16. Interview-ready explanations

### “Why did you avoid passenger accounts?”

Passenger authentication did not support a required business operation. It would create thousands of annual accounts and additional password/privacy support. The system instead maintains an admin-controlled roster and exposes only sanitized route information publicly. Authentication is reserved for actions that change trusted state: administration and driver location publishing.

### “Why use a relational database?”

The domain has strong relationships and integrity rules: routes own ordered stops, schedules have versions, rosters have academic-year states, passengers reference valid routes/stops, trips snapshot published versions, and alerts reference trips/advisors. PostgreSQL transactions and constraints are a good fit for atomic roster publication and consistent operational data. PostgreSQL also provides timezone-aware timestamps, JSONB, and partial indexes for concurrency-sensitive trip state.

### “Why use Prisma?”

Prisma provides a declarative schema, version-controlled migrations, a generated query client, relational modeling, and transaction support. It reduces hand-written query errors while still producing explicit SQL migrations that can be reviewed and deployed predictably.

### “Why both REST and Socket.IO?”

REST is appropriate for durable request/response operations such as route configuration, roster publication, and trip creation. Live GPS locations are frequent events that multiple connected passengers should receive immediately, making a persistent Socket.IO channel more suitable.

### “How did you protect location publishing?”

The socket handshake requires a driver JWT. Every update verifies the running trip, assigned route, and driver ownership. The server rejects impossible movement before persistence. Passenger clients can subscribe to sanitized live data but cannot publish trusted locations.

### “How is ETA made trustworthy?”

The API communicates both an estimate and its state/confidence. It uses recent accepted GPS samples and avoids pretending that a stale or missing signal is precise. Passed stops return an explicit `PASSED` state rather than negative minutes. Multiple samples and map matching can improve the calculation later without changing the UI contract.

### “How do you prevent false late alerts?”

The system requires multiple consecutive confident late observations, throttles evaluation, and snapshots the evidence used for the decision. Notification creation uses an outbox so delivery failure does not lose the alert. Hash-chain verification helps detect later tampering with immutable evidence.

### “How do annual passenger updates avoid breaking the live app?”

Admins work in a draft roster isolated from the published one. Validation checks identifiers, duplicate assignments, stops, capacity, and advisor coverage. Publication occurs in one database transaction that archives the old roster and activates the new one. Failed validation or publication leaves the existing live roster untouched.

### “What security rules were important?”

- never store plaintext login passwords;
- never use the PostgreSQL superuser from the application;
- keep `.env` and secrets out of Git;
- authorize every state-changing endpoint, not merely hide UI buttons;
- omit phone numbers from public/driver API queries at the database-selection layer;
- restrict browser origins;
- reject insecure JWT configuration in production;
- validate imported and GPS data before persistence;
- preserve admin audit and alert evidence.

### “What would you improve with more time?”

- road-aware map matching and traffic-assisted ETA;
- road geometry storage and traffic-aware route matching for improved ETA;
- a polished administrator upload/preview experience in the final frontend redesign;
- reliable background location testing on Android devices;
- automated integration and end-to-end suites;
- production observability, alerting, backup restoration drills, and load tests.

## 17. How to keep this journal updated

For every meaningful future change, append or revise:

1. the feature and user problem it addresses;
2. the design decision and alternatives considered;
3. schema/API/UI changes;
4. commands used and why;
5. tests performed and their result;
6. known limitations or follow-up work;
7. the relevant Git commit.

Do not put real passwords, tokens, personal phone numbers, production URLs containing secrets, or full private passenger datasets in this file.

## 18. Implementation journal

### PostgreSQL local setup completed — 25 August 2026

The local database transition is now operational:

- PostgreSQL 18 is installed and its Windows service is running.
- The least-privilege `bus_tracker` role owns the `college_bus_tracking` database.
- `backend/.env` points Prisma to PostgreSQL on `localhost:5432` without committing the private password.
- `npx prisma migrate deploy` applied `20260824230000_postgresql_foundation` successfully. This command applies already-reviewed, version-controlled migrations without generating a new development migration.
- `npx prisma db seed` inserted the safe development/demo records needed to exercise the application.
- `npm run validate` confirmed that the Prisma schema is valid and all 11 backend tests pass against the PostgreSQL configuration.
- `npm run admin:set-password` securely updated the administrator email and stored only a bcrypt password hash in the untracked `.env` file.
- `npm run dev` started the backend on port 4000. `/health` returned `ok`, and `/passenger/routes` returned seeded route `01` from PostgreSQL.

MySQL remains installed temporarily as a recoverable fallback. It should only be stopped or removed after the PostgreSQL-backed application has been verified end to end; the project no longer uses it.

### React administrator foundation restored — 25 August 2026

- Added the missing driver and class-advisor screens using the authenticated CRUD APIs. Driver phone numbers remain visible only inside the admin role.
- Added schedule draft creation, ordered stop editing, validation, and transactional publication controls.
- Added annual roster draft/copy workflows, Student/Faculty differentiation, passenger editing controls, validation/publication, and complete multi-page CSV export with spreadsheet-formula escaping.
- `npm run build` completed successfully with 90 modules transformed.
- The Vite administrator login page returned HTTP 200 while the PostgreSQL-backed API continued returning a healthy status.

### Frontend freeze and backend-first organization — 25 August 2026

- Administrator login and real PostgreSQL route edits were verified through the reference web client.
- Fixed local CORS so both `localhost:5173` and `127.0.0.1:5173` work in development; browser-style preflight returned 204.
- Declared both current frontends functional reference implementations rather than final visual designs.
- Centralized active admin pages under `src/screens` and removed five unreferenced prototypes that contained obsolete bus-plate/separate-student concepts.
- Added a frontend redesign boundary and aligned the PRD/project plan to backend-first contract stabilization.
- Post-organization verification passed: React admin production build, React Native TypeScript validation, valid Prisma schema, and all 11 backend tests.

### Annual roster CSV/XLSX exchange completed — 25 August 2026

This milestone completes the backend contract for replacing passenger assignments each academic year while keeping the published roster safe:

- Added `exceljs` for XLSX buffer generation/parsing and `multer` memory uploads with file-size and part limits.
- Defined one canonical ten-column contract for students and faculty. Route numbers are stored as text so values such as `08` keep their leading zero; phone numbers never enter template/export files.
- Added administrator-only CSV/XLSX template downloads. The XLSX template contains instructions, an empty import sheet, examples, and a live route/stop reference.
- Added upload preview that normalizes rows and reports row-level errors/warnings without changing the database.
- Added draft-only, all-or-nothing import. The transaction locks and revalidates the roster before chunked inserts, so concurrent changes cannot bypass capacity, duplicate, route, or stop checks.
- Added complete non-paginated CSV/XLSX roster exports with formula-injection protection and no phone fields.
- Added `ROSTER_FILE_IMPORTED` and `ROSTER_EXPORTED` administrator audit events.
- Added limits of 5 MB, 10,000 rows, 30 columns, and 500 characters per cell; XLSX formulas are rejected rather than evaluated.
- Verified generated workbooks structurally and visually, including the `08` route value remaining an Excel text cell.
- Added ten focused exchange tests. `npm run validate` now passes all 21 backend tests.
- Ran an authenticated HTTP integration check against PostgreSQL: template download, clean preview, transactional import, stored row/audit verification, and XLSX export all succeeded. Temporary test records were deleted afterward.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
npm install exceljs@4.4.0 multer@2.2.0
node --test tests/rosterExchange.test.js
npm run validate
```

`npm install` records runtime dependencies and locks their resolved versions. The focused test command shortens the edit/verify loop; `npm run validate` then validates the Prisma schema and runs the complete backend suite.

Known dependency note: the current `exceljs` dependency chain produces two moderate `npm audit` findings through an older transitive `uuid` package. The affected UUID buffer API is not called by this roster implementation. An automatic forced fix would downgrade ExcelJS, so it was not applied; recheck and upgrade when a compatible upstream release resolves the chain.

### Administrator audit coverage completed — 25 August 2026

This milestone makes trusted administrator changes accountable without turning the audit table into a second store of private data:

- Added transaction-safe audit events for route, stop, schedule, annual roster, driver, class-advisor, roster export/import, and administrator-controlled trip mutations.
- Added one defensive summary sanitizer that recursively removes credentials, hashes, tokens, phone numbers, emails, license values, bus-pass IDs, roll numbers, faculty IDs, and notification recipients.
- Kept passenger names and advisor/driver contact values out of audit summaries; events retain only the operational relationships and changed-field information needed for accountability.
- Added `GET /admin-audit-logs`, protected by the administrator role, with exact action/entity filters, ISO date bounds, pagination capped at 200, newest-first ordering, and `private, no-store` responses.
- Added no update/delete audit endpoint. General audit integrity still depends on least-privilege PostgreSQL access, backups, and monitoring; the late-alert evidence hash chain remains a separate stronger tamper-detection mechanism.
- Fixed a schedule-stop ownership edge case discovered during the audit inventory: update/delete now verify that the stop entry actually belongs to the draft schedule in the URL.
- Added five focused privacy/filter tests. `npm run validate` now passes all 26 backend tests.
- Ran an authenticated PostgreSQL HTTP check: missing credentials returned 401, a driver token returned 403, administrator create/delete produced the expected two audit actions, private advisor fields were absent, and the query response used `private, no-store`. Temporary records and the check script were removed.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
node --test tests/adminAudit.test.js
npm run validate
```

The focused command verifies summary privacy and filter parsing quickly. The full validation then checks the Prisma schema and every backend test, reducing the chance that cross-cutting transaction changes broke roster, ETA, alert, or validation behavior.

### Live trip, GPS, route-progress, and ETA hardening completed — 25 August 2026

This milestone makes live tracking recoverable and stateful instead of assuming every request and GPS point is ideal:

- Made trip start concurrency-safe by relying on PostgreSQL's partial unique running-trip indexes and translating unique races into the same resumed trip rather than HTTP 500.
- Made trip end a compare-and-set transition. Concurrent retries both succeed safely while exactly one changes state and emits the end event.
- Extended `GET /trips/mine` with persisted reconnect health: live/no-data/stale state, last accepted point, last sample result, and rejection reason.
- Added optional GPS accuracy and device-speed metadata plus a partial unique `(tripId, deviceTimestamp)` index for idempotent queued/replayed samples.
- Quarantined poor-accuracy, too-old, future-clock, duplicate, out-of-order, and impossible-speed points. Rejected points remain diagnostic records but cannot move the public marker, progress, or ETA.
- Serialized progress with a PostgreSQL trip-row lock. Stops can become `REACHED` or honestly `POSSIBLY_SKIPPED`; progress never rolls backward automatically.
- Added conservative off-route detection from the stop-to-stop polyline and separated `ROUTE_COMPLETED` from a driver-confirmed `TRIP_ENDED`.
- Added explicit `NO_LIVE_DATA`, `GPS_UNRELIABLE`, `STALE_LOCATION`, `OFF_ROUTE`, `NOT_MOVING`, `AT_STOP`, `PASSED`, `POSSIBLY_SKIPPED`, `ROUTE_COMPLETED`, and `TRIP_ENDED` behavior. Unavailable live estimates include only the published schedule as a labelled fallback.
- Fixed duplicate socket delivery by broadcasting to the union of trip/route rooms. Added persisted stale monitoring with one-time `trip:stale` and recovery events.
- Applied migration `20260825030000_live_tracking_hardening` successfully to local PostgreSQL.
- Added five live-tracking/monitor tests and extended ETA/schema coverage. `npm run validate` now passes all 33 backend tests.
- Ran a real PostgreSQL + Socket.IO integration check: concurrent start returned 200/201 for one trip, reconnect returned `NO_LIVE_DATA`, the first GPS point produced one passenger update, duplicate replay was idempotent, poor accuracy was quarantined, the final stop produced `ROUTE_COMPLETED`, concurrent end returned 200/200, and final ETA returned `TRIP_ENDED`. Temporary records and scripts were removed.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy
node --test tests/liveTracking.test.js tests/staleTripMonitor.test.js tests/eta.test.js tests/schemas.test.js
npm run validate
```

Prisma generation was run after briefly stopping the backend because Windows locks the query-engine DLL while Node is using it. `migrate deploy` applied the already-versioned migration; it did not invent a database change interactively.

Known limitations: current route distance uses straight segments between configured stops rather than road geometry, so the two-kilometre off-route threshold and skipped-stop inference require field calibration. Reliable Android background collection and bounded offline queuing belong to the later development-build/device phase. The current frontend remains a functional reference and was not visually redesigned.

### Notification outbox reliability completed — 25 August 2026

This milestone separates late-alert evidence from unreliable external email delivery and makes failures recoverable:

- Added stable outbox idempotency keys, persisted next-attempt/last-attempt timestamps, lock ownership, stale-lock recovery, and provider message IDs.
- Added `FOR UPDATE SKIP LOCKED` worker claims so concurrent backend processes do not normally deliver the same due row.
- Added bounded 1-minute, 5-minute, 15-minute, 1-hour, and 6-hour retry delays. Permanent SMTP rejection or five automatic failures becomes administrator-visible `FAILED`.
- Added disabled, privacy-safe console simulation, and Nodemailer SMTP provider modes. No provider credentials are committed.
- Added a deterministic SMTP Message-ID and notification header. This reduces duplicates but does not promise exactly-once SMTP delivery across the crash-after-send window.
- Added a partial unique active-alert index and PostgreSQL advisory transaction lock so concurrent alert creation cannot duplicate an active trip alert or branch the evidence hash chain.
- Preserved class groups with missing advisors by deriving them from immutable alert snapshots.
- Added administrator summary/filter/retry/retry-all endpoints with private no-store responses and audited recovery actions.
- Applied migration `20260825050000_notification_outbox_reliability` successfully.
- Added eight focused outbox/provider tests. `npm run validate` now passes all 41 backend tests.
- Ran an isolated real PostgreSQL verification: two workers claimed a row as `[1,0]`, a transient failure recovered to `SENT`, a stale worker lock was reclaimed, and the unique idempotency constraint rejected duplication. Temporary records were removed.
- Ran an authenticated HTTP smoke check: the notification summary returned 200 with private no-store caching, and an invalid retry ID returned 400. The temporary check script was removed.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
npm install nodemailer@9.0.5
npx prisma validate
npx prisma generate
npx prisma migrate deploy
node --test tests/notificationOutbox.test.js
npm run validate
node scripts/verify-notification-outbox.js
```

`FOR UPDATE SKIP LOCKED` lets each worker skip rows another transaction already owns instead of waiting and processing the same work. Persisted retry and lock timestamps allow the queue to recover after a backend restart. The console provider is only a local simulation; production remains disabled until private SMTP configuration is supplied.

### Phase 6 HTTP/privacy/socket security baseline completed — 25 August 2026

This slice protects the most exposed application boundaries before final frontend coupling:

- Added Helmet API security headers, a deny-by-default content security policy, frame/MIME protections, and request correlation IDs.
- Preserved explicit CORS origins: hostile browser origins return 403 while React Native and non-browser clients without an Origin remain supported.
- Added failed-login limits, roster preview/import limits, and per-socket GPS burst limits with configurable positive-integer defaults.
- Added metadata-only structured request logs. They omit bodies, query strings, headers, tokens, IPs, emails, phone numbers, and passenger identifiers.
- Removed the obsolete development `/auth/seed-passwords` HTTP helper; secure local administrator password setup remains a script.
- Added seven security tests covering headers, CORS, roles, hash-helper removal, throttling, log redaction, and GPS bursts. The full suite now passes 48 tests.
- Added a read-only PostgreSQL API privacy verification: one public route and a real driver session had no forbidden private fields; anonymous and driver access to admin endpoints returned 401/403.
- Added an isolated two-route Socket.IO check: anonymous GPS and the wrong driver were rejected, Route A received exactly one update, and Route B received zero.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
npm install helmet@8.3.0 express-rate-limit@8.6.2
npm install --save-dev supertest@7.2.2
node --test tests/security.test.js
node scripts/verify-api-privacy.js
node scripts/verify-socket-isolation.js
npm run validate
```

The current limiter memory store is appropriate for one local/backend process. A multi-instance deployment needs a shared store and an explicitly reviewed trusted-proxy configuration so client identification remains correct.

### Clean migration, role, and backup/restore verification completed — 25 August 2026

This slice proves that the database can be reproduced and recovered without experimenting on the real `public` schema:

- Added `verify:database-clean`, which creates a strictly named temporary schema, applies all four migrations, runs the seed, verifies 15 tables and Student/Faculty data, rejects obsolete QR/attendance/registration/active columns, and removes the schema.
- Verified local `bus_tracker` can log in but is not superuser and cannot create databases or roles. It owns the development database, so production must use separate migration and runtime identities.
- Added `verify:backup-restore`, which created an isolated seeded schema, produced an 85,129-byte custom-format dump, dropped and restored that schema, verified routes/passengers/migration history/notification columns, and removed both schema and dump.
- PostgreSQL credentials were passed to child tools through process environment rather than command arguments or logs.
- Added `docs/DATABASE_RECOVERY.md` with production role separation, backup retention, restore safety and recovery-policy requirements.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
npm run verify:database-clean
npm run verify:backup-restore
npm run validate
```

The drills intentionally use temporary schemas instead of a temporary database because the development application role correctly lacks `CREATEDB`. Both scripts validate a strict generated prefix before any `DROP SCHEMA` operation.

### Roster and notification load/resource baseline completed — 25 August 2026

This slice turned the intended safety numbers into executable acceptance checks:

- Fixed a consistency gap: the 30-column safety limit now applies to CSV as well as XLSX imports.
- Added a regression test for over-wide CSV input. The complete backend suite now passes 49 tests.
- Added `npm run verify:load-limits`, which generates data instead of reading real passenger records.
- Parsed and validated 10,000 mixed Student/Faculty rows in 92 ms. The CSV was 1,053,820 bytes and the observed heap increase was 18.1 MiB.
- Verified rejection of 10,001 rows, 31 columns, and a 501-character canonical cell.
- Inserted 500 isolated notification rows, started five workers concurrently, and observed five disjoint 100-row claims.
- The in-memory test provider received 500 unique idempotency keys in 257 ms with no duplicate delivery.
- The database fixture was removed in a finally block. The script refuses to run the outbox portion if any unrelated notification is already pending.

Command used:

```powershell
cd E:\bus-tracking-system\backend
npm run verify:load-limits
npm run validate
```

These are local regression measurements, not production capacity promises. The script uses generous pass thresholds of 15 seconds/256 MiB for roster processing and 20 seconds for the test-provider outbox run. Real SMTP, reverse-proxy uploads, database pool limits, production-like data volume and real networks still require staging tests.

The detailed limits and caveats are recorded in `docs/PERFORMANCE_LIMITS.md`.

### PostgreSQL-backed administrator sessions completed — 25 August 2026

This slice changes administrator authentication from a valid-until-expiry stateless token into a signed token plus revocable server state:

- Added a fourth migration and the AdminSession table with opaque UUID, owner, expiry, revocation reason/timestamp, creation timestamp, and an active-session lookup index.
- Administrator login now creates a database session and audits only its opaque ID and expiry; no bearer token, password, IP address, or browser fingerprint is stored.
- Every administrator request verifies JWT signature, issuer, audience and expiry, then requires an unexpired and unrevoked matching database session.
- Added current logout, retained-session listing, individual revocation, and revoke-all endpoints with private no-store responses and privacy-safe audit events.
- Production defaults to a two-hour administrator lifetime and twelve-hour driver lifetime, with maximum bounds of eight and twenty-four hours.
- Production startup rejects missing, short, and common placeholder JWT secrets. Signing-key rotation intentionally invalidates every existing token.
- The administrator password command revokes active sessions before replacing the credential hash, so password rotation does not leave older tokens usable.
- Updated the React reference sign-out action to call server logout and still clear local state if the session expired or the network failed.
- Added five focused tests. The complete backend suite passes 54 tests and the administrator production build succeeds.
- The isolated PostgreSQL verification proved current logout, expired/missing-session rejection, one-session revocation, and revoke-all of two sessions; generated sessions and audit rows were removed.
- Re-ran clean migration/seed: four migrations and 15 tables passed. Re-ran backup/restore: an 85,129-byte dump restored all four migration records and AdminSession columns, then removed temporary artifacts.

Commands used:

```powershell
cd E:\bus-tracking-system\backend
npx prisma generate
npx prisma migrate deploy
npm run verify:admin-sessions
npm run verify:database-clean
npm run verify:backup-restore
npm run validate
```

The reference admin still stores a bearer token in local storage. For production, the final frontend should migrate administrator authentication to a Secure, HttpOnly, SameSite cookie with CSRF protection after the deployment origin is fixed. The backend database-session model remains useful with either transport.

Detailed endpoint and rotation behavior: `docs/AUTH_SESSIONS_API.md`.

### Immediate next actions

1. Define shared rate-limit storage and trusted-proxy deployment behavior.
2. Document privacy-safe monitoring, retention and dependency-review policy.
3. Freeze stable sanitized API contracts before the final frontend redesign.

### Production controls, stable API, final clients and release packaging — 25 August 2026

This milestone completed the locally implementable work after the 68% checkpoint:

- PostgreSQL now stores shared rate-limit buckets, allowing multiple Express processes to enforce one login/import counter without retaining raw IP values.
- Exact proxy-hop policy prevents blindly trusting forged forwarded addresses. `/health/ready` distinguishes a running Node process from one that can actually reach PostgreSQL.
- `/api/v1` freezes a major contract while unversioned aliases provide a transition period.
- Administrator login moved from local-storage bearer tokens to HttpOnly, SameSite cookies. A custom mutation header and strict CORS provide CSRF protection, while database sessions still allow immediate revocation.
- Operations, audit and session screens close the administrator recovery/visibility gap.
- Expo TaskManager provides native background location. AsyncStorage implements a bounded 200-sample queue so temporary network loss does not silently lose the entire trip or grow storage without limit.
- CI, Docker/Nginx staging files and EAS profiles make release steps repeatable without committing credentials.

Important interview distinction: “code complete” is not “production proven.” Builds and simulated integration checks can prove contracts, isolation and recovery logic. Only real devices can prove Android vendor/battery behavior; only real roads can calibrate ETA; only real SMTP can prove sender policy; and only the data owner can approve rosters. The honest status is therefore a local release candidate at about 87%, with the remaining 13% as explicit operational gates.

Release checks completed locally:

```powershell
npm run validate                    # Prisma plus 59 backend tests
npm run verify:shared-rate-limit    # two instances share PostgreSQL counters
npm run verify:admin-cookie-auth    # cookie flags, CSRF, logout, revocation
npm run verify:release-api          # v1, readiness, privacy, operations, audit
npm run verify:database-clean       # five migrations and 16 tables
npm run verify:backup-restore       # custom dump/restore with migration evidence
npm run build                       # React administrator production bundle
npm run typecheck                   # strict React Native TypeScript
npx expo export --platform web      # Expo Router static bundling
```

`npm audit --omit=dev --audit-level=high` found no high/critical issues. Moderate transitive `uuid` findings remain through ExcelJS and Expo tooling; forced fixes propose breaking downgrades, so the release policy records them for compatible upstream upgrades instead of applying unsafe automatic changes.