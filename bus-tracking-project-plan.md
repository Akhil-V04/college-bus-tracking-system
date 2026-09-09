# College Bus Tracking System - Current Project Plan

This plan is aligned with [PRD.md](./PRD.md). The PRD wins if the documents ever disagree.

## 1. Current strategy

Backend-first contract stabilization is complete. The React administrator and React Native passenger/driver applications now cover the stable workflows; future redesign work is presentation-only and must preserve the locked privacy/domain contract.

The frontend redesign is intentionally deferred until the backend contracts, privacy rules, import/export workflows, trip state, ETA states, and late-alert behavior are stable. See [Frontend redesign boundary](./docs/FRONTEND_REDESIGN_BOUNDARY.md).

## 2. Product surfaces

### Backend — authoritative product layer

Node.js, Express, Prisma, Socket.IO, and PostgreSQL in `backend/`.

The backend owns:

- authentication and role authorization;
- public/admin field selection and phone-number privacy;
- route, stop, capacity, schedule, driver, advisor, and roster rules;
- draft validation and transactional publication;
- trip lifecycle, GPS acceptance, route progress, and ETA states;
- late-alert evidence, notification outbox, and audit history;
- import/export validation and stable API contracts.

Web and mobile clients never access PostgreSQL directly.

### Administrator web reference

React and Vite in `admin-panel/`.

The current reference UI already exercises administrator login and live PostgreSQL updates for routes, drivers, advisors, schedules, rosters, and late alerts. Its visual system and screen composition may be replaced later. Domain and privacy rules must remain in the backend.

### Passenger and driver mobile reference

React Native, Expo, and TypeScript in `mobile-app/`.

The current reference app proves:

- no-login passenger route selection;
- route, timeline, passenger-type badge, tracking, and ETA states;
- authenticated driver login and assigned-trip controls;
- foreground authenticated GPS publishing.

Final mobile design and reliable background GPS/device testing are deferred to their later phases.

## 3. Locked scope rules

- No passenger accounts or student Google login.
- No QR boarding or bus attendance tracking.
- No vehicle registration/plate field.
- No generic `active` passenger field.
- Route number and operational bus number are one identifier.
- Occupancy means assigned roster count against configured capacity, not actual boarded count.
- Driver and passenger phone numbers never appear in passenger or driver responses.
- Students and faculty are both passengers and must be differentiated by type.
- Annual rosters and schedules use draft, validation, publish, and archive states.
- Late alerts use route assignment; class advisors verify actual attendance.
- A passed stop returns `PASSED` or `POSSIBLY_SKIPPED`, never a negative ETA.

## 4. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL 18 | Relational integrity, transactions, `TIMESTAMPTZ`, `JSONB`, and partial indexes |
| ORM/migrations | Prisma | Version-controlled schema, migrations, and database transactions |
| Backend | Node.js + Express | REST APIs, authentication, business rules, and workflows |
| Realtime | Socket.IO | Authenticated driver GPS and passenger trip subscriptions |
| Admin reference | React + Vite | Working administrative API client; final design deferred |
| Mobile reference | React Native + Expo + TypeScript | Working passenger/driver API client; final design deferred |
| Mobile state | TanStack Query | API caching, retry, and invalidation |
| Maps/location | react-native-maps + expo-location | Route visualization and driver GPS |
| Driver token | Expo SecureStore | OS-backed mobile credential storage |

## 5. Repository structure

```text
backend/                       # Authoritative API and database layer
  prisma/                      # PostgreSQL schema and migrations
  scripts/                     # Safe local/administrative setup commands
  src/                         # Routes, services, authorization, sockets
  tests/                       # Unit and integration tests
admin-panel/                   # Functional React reference; not final UI
  src/screens/                 # Active route-level reference screens
  README.md                    # Reference-frontend rules and commands
mobile-app/                    # Functional React Native reference; not final UI
  src/app/                     # Expo Router screens
  src/components/              # Shared mobile reference UI
  src/lib/                     # API, authentication, and socket clients
  src/types/                   # API response types
docs/
  FRONTEND_REDESIGN_BOUNDARY.md
PRD.md                         # Product source of truth
BUILD_AND_INTERVIEW_GUIDE.md   # Living implementation/interview journal
bus-tracking-project-plan.md   # Current execution order
```

Generated dependencies, build output, local `.env` files, and generated native Expo projects are not source files. The deleted Flutter trees remain recoverable from Git history but are no longer part of the active project.

## 6. Milestone status

### Milestone A — Product model and PostgreSQL foundation

Status: complete.

- product/privacy rules and failure modes documented;
- PostgreSQL 18 role and database configured;
- Prisma PostgreSQL migration applied and development data seeded;
- administrator password hash configured privately;
- backend validation passes;
- backend health and real PostgreSQL CRUD verified.

### Milestone B — Functional reference clients

Status: complete enough for backend development.

- React administrator reference builds and performs real database updates;
- active admin screens are organized under `admin-panel/src/screens`;
- obsolete vehicle/student prototype files removed;
- React Native passenger and driver reference foundations validate;
- final visual frontend work explicitly frozen.

### Milestone C — Backend completion and contract stabilization

Status: current work.

1. **Completed 25 August 2026:** server-side CSV/XLSX roster template, preview, validation, atomic bulk import, complete export, and import/export audit APIs.
2. **Completed 25 August 2026:** transaction-safe, privacy-sanitized admin audit records across sensitive mutations plus a paginated administrator-only query API.
3. **Completed 25 August 2026:** idempotent concurrent trip start/end, persisted reconnect snapshots, GPS replay/quarantine rules, and stale/recovery events.
4. **Completed 25 August 2026:** monotonic reached/possibly-skipped route progress and explicit no-data, unreliable, stale, off-route, stationary, passed, route-completed, and ended ETA states.
5. **Completed 25 August 2026:** notification-outbox worker locking, bounded retries, idempotency, missing-advisor visibility, administrator recovery APIs, SMTP boundary, and database-backed concurrency verification.
6. **In progress 25 August 2026:** security/privacy/socket controls, clean-schema migration/seed verification, local role checks, isolated backup/restore, generated roster/outbox load-resource checks, and revocable administrator sessions are complete; shared deployment controls, monitoring, and contract freeze remain.
7. Publish stable, sanitized request/response contracts for the later frontends.

### Milestone D — Final frontend redesign

Status: deferred until Milestone C contracts are stable.

- create final visual identity and component systems;
- redesign administrator workflows for large annual datasets;
- redesign passenger and driver mobile experiences;
- add accessibility, responsive, offline, loading, and error-state polish;
- add browser and React Native component/end-to-end tests.

### Milestone E — Device testing, deployment, and pilot

- reliable background location in an Expo development build;
- actual-route field tests and ETA calibration;
- HTTPS deployment and production secret management;
- database backup/restore drills, retention, logs, metrics, and alerts;
- administrator and driver training followed by a controlled pilot.

## 7. Next implementation slice

Clean migration/seed, backup/restore, generated load/resource, and administrator-session baselines now pass. The next code slice finishes the backend acceptance gate before final frontend coupling:

1. define shared rate-limit storage and trusted-proxy behavior;
2. document privacy-safe monitoring, retention and dependency policy;
3. freeze/version sanitized request and response contracts for the final React and React Native clients.



## 8. Working rules

- Keep business rules and authorization in the backend, never only in a frontend.
- Keep API response types explicit and sanitized.
- Update the PRD and build/interview journal with every material decision.
- Run the relevant validation before each commit.
- Never commit database URLs, passwords, JWT secrets, phone lists, or real rosters.
- Use small milestone commits and preserve unrelated user changes.