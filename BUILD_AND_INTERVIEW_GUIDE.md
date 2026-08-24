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
- **MySQL 9.3** — relational database for operational and historical data.
- **Socket.IO** — real-time driver location updates and passenger broadcasts.
- **JSON Web Tokens (JWT)** — admin and driver authentication.
- **bcrypt 6** — secure password hashing.
- **Node test runner** — focused automated unit tests.

### Admin application

- **React** — administrator interface.
- **Vite** — development server and production build tooling.

The existing admin prototype still needs to be refactored to use the new route-service, schedule, roster, and alert APIs.

### Mobile/passenger application

- **Flutter** — cross-platform passenger and driver application.

The existing Flutter prototype still contains obsolete Google student login, QR scanning, and attendance-oriented screens. It will be rebuilt around no-login passenger route selection and authenticated driver tracking.

### Development and source control

- **Git and GitHub** — version history and remote repository.
- Repository: <https://github.com/Akhil-V04/college-bus-tracking-system>

## 5. High-level architecture

```text
Passenger Flutter app (no login) ── REST + Socket.IO ─┐
                                                      │
Driver Flutter app (JWT login) ──── REST + Socket.IO ─┼── Node/Express backend ── Prisma ── MySQL
                                                      │
React admin panel (JWT login) ───── REST ─────────────┘
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

Actual email delivery workers and retry scheduling remain a later implementation task; the outbox data model and alert creation are in place.

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

## 10. Local database setup performed

### Windows service

MySQL Server 9.3 is installed as the Windows service `MySQL93`. Its startup type was changed to Automatic so it starts with Windows.

The configured server paths are:

```text
C:\Program Files\MySQL\MySQL Server 9.3\bin\mysqld.exe
C:\ProgramData\MySQL\MySQL Server 9.3\my.ini
```

### Root-password recovery

The root password was forgotten, so the official MySQL Windows `--init-file` recovery process was used:

1. stop the MySQL service;
2. create a temporary file containing an `ALTER USER` statement;
3. start `mysqld` once with `--init-file` and the normal `--defaults-file`;
4. wait for “ready for connections”;
5. stop the temporary server;
6. immediately delete the plaintext reset file;
7. restart the normal Windows service.

Passwords are intentionally not recorded in this document.

### Database and least-privilege application user

The root account was used only to create:

```text
Database: college_bus_tracking
Application user: bus_tracker@localhost
```

The application user receives privileges only on the project database. The backend does not use the MySQL root account.

The SQL operations were conceptually:

```sql
CREATE DATABASE IF NOT EXISTS college_bus_tracking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'bus_tracker'@'localhost'
  IDENTIFIED BY '<private-password>';

GRANT ALL PRIVILEGES ON college_bus_tracking.*
  TO 'bus_tracker'@'localhost';

FLUSH PRIVILEGES;
```

### Environment variables

The backend reads local settings from `backend/.env`. The file must stay out of Git because it contains secrets.

Important variables:

| Variable | Reason |
|---|---|
| `DATABASE_URL` | Tells Prisma how to connect to MySQL |
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

Applied migration:

```text
20260824211500_initial_foundation
```

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

Produces an optimized production bundle and catches many compile-time/import errors. The prototype currently builds, but its screens still need Phase 2 API and product-flow refactoring.

## 12. Testing completed so far

- Prisma schema validation passed.
- Prisma Client generation passed.
- Initial MySQL migration generated and applied successfully to the local database.
- Development seed completed successfully.
- Eight backend unit tests previously passed.
- Backend module-load checks passed.
- Admin production build passed.
- npm production dependency audit reported zero vulnerabilities.

The next immediate verification is to run `npm run validate` against the now-configured local environment, then start the backend and check `/health`.

## 13. Git history established

The repository is connected to GitHub and the following foundation commits were pushed:

```text
e64e164 chore: preserve initial prototype and add product requirements
3e3551c feat: establish route service and roster foundation
```

New work should be committed in coherent milestones after tests pass. Secrets such as `.env` and database passwords must never be committed.

## 14. Current project status

### Completed

- Product requirements and failure-mode catalogue.
- Revised relational data model.
- Initial migration applied to local MySQL.
- Development sample data seeded.
- Route-service and schedule backend foundation.
- Draft/published/archived roster foundation.
- Sanitized public passenger endpoints.
- Admin/driver-only authentication model.
- Driver trip start/end and live-location authorization.
- ETA state model and baseline estimator.
- Late-alert evaluation, immutable snapshots, and notification outbox creation.
- Backend focused test suite.

### Partially complete

- ETA works as a baseline but full road map-matching, traffic integration, robust skipped-stop detection, and off-route recovery require later work.
- Outbox records are created, but an SMTP worker with retry/backoff is not yet implemented.
- JSON roster bulk insertion exists, but user-facing CSV/XLSX parsing and one-click export are not yet implemented.
- Admin panel builds, but most screens still target the old prototype concepts.
- Flutter project exists, but its passenger and driver flows must be redesigned.

### Not yet complete

- Final admin login setup and secure initial password workflow.
- Admin dashboard refactor.
- Route, stop, schedule, driver, advisor, and capacity management UI.
- Draft annual roster import, error-preview, publication, archive, CSV/XLSX export, and audit UI.
- No-login Flutter passenger experience.
- Authenticated Flutter driver experience and background-safe location sharing.
- Passenger live map/timeline screens.
- Reliable notification worker.
- End-to-end and real-device testing.
- Production hosting, HTTPS, monitoring, backups, and operational runbook.

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

The domain has strong relationships and integrity rules: routes own ordered stops, schedules have versions, rosters have academic-year states, passengers reference valid routes/stops, trips snapshot published versions, and alerts reference trips/advisors. MySQL transactions and constraints are a good fit for atomic roster publication and consistent operational data.

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
- never use the MySQL root account from the application;
- keep `.env` and secrets out of Git;
- authorize every state-changing endpoint, not merely hide UI buttons;
- omit phone numbers from public/driver API queries at the database-selection layer;
- restrict browser origins;
- reject insecure JWT configuration in production;
- validate imported and GPS data before persistence;
- preserve admin audit and alert evidence.

### “What would you improve with more time?”

- road-aware map matching and traffic-assisted ETA;
- stronger database-level protection against concurrent duplicate running trips;
- full CSV/XLSX import/export with row-level error reports;
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

## 18. Immediate next actions

1. Run `npm run validate` against the configured local database environment.
2. Start the backend with `npm run dev` and verify `http://localhost:4000/health`.
3. test seeded driver authentication and public route endpoints against MySQL.
4. create the secure local admin password hash/bootstrap flow.
5. begin Phase 2 by refactoring the React administrator application.

