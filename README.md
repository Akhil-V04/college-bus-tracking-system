# College Bus Tracking System

A live route-tracking, annual passenger-roster, stateful ETA, and class-advisor late-alert platform for approximately 31 college routes. [PRD.md](./PRD.md) is the product source of truth, [PROJECT_BUILD_STATUS_AND_HANDOFF.md](./PROJECT_BUILD_STATUS_AND_HANDOFF.md) is the continuation point, and [BUILD_AND_INTERVIEW_GUIDE.md](./BUILD_AND_INTERVIEW_GUIDE.md) is the technical journal.

```text
bus-tracking-system/
|-- backend/          # Node + Express + Prisma + Socket.IO + PostgreSQL
|-- admin-panel/      # React administrator operations application
|-- mobile-app/       # React Native/Expo passenger and driver application
|-- docs/             # API, security, recovery, operations and release contracts
|-- PRD.md
+-- BUILD_AND_INTERVIEW_GUIDE.md
```

## Locked technology and product decisions

- PostgreSQL is the only active database; Prisma owns versioned migrations.
- React Native with Expo is the mobile framework; Flutter and MySQL are obsolete.
- Passengers require no accounts. Drivers and administrators authenticate.
- Student and Faculty are passenger types, not separate account systems.
- There is no QR scan, bus attendance, vehicle-registration field, or passenger `active` field.
- Phone numbers are private administrator data. Public and driver responses do not expose them.
- Route number is the operational bus identity and the single passenger selector.
- Assigned roster counts are not claims that a person boarded.

## Prerequisites

- Node.js 22 or newer and npm
- PostgreSQL 18
- Android Studio or a real Android phone
- An Expo development build for screen-locked/background driver GPS (Expo Go cannot provide this capability)

Never commit `.env` files or real passenger rosters.

## Backend

```powershell
cd E:\bus-tracking-system\backend
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run admin:set-password
npm run validate
npm run dev
```

Liveness: <http://localhost:4000/health>
Database readiness: <http://localhost:4000/health/ready>
Stable API base: `http://localhost:4000/api/v1`

## Administrator application

```powershell
cd E:\bus-tracking-system\admin-panel
npm install
npm run dev
```

Open <http://localhost:5173>. Administrator authentication uses an HttpOnly, SameSite cookie plus server-side revocation and a CSRF-blocking request header; no administrator bearer token is retained in browser local storage.

## Mobile application

Copy `mobile-app/.env.example` to `.env`. The Android emulator uses `10.0.2.2`; a physical phone uses the laptop's LAN IP.

```powershell
cd E:\bus-tracking-system\mobile-app
npm install
npm run typecheck
npm start
```

Passenger screens can be previewed normally. Driver background tracking needs the development-build flow in [DEPLOYMENT_AND_RELEASE.md](./docs/DEPLOYMENT_AND_RELEASE.md).

## Current implementation

- Five PostgreSQL migrations reproduce 16 application tables; clean-schema and backup/restore drills pass.
- CSV/XLSX annual roster template, preview, atomic draft import, publish and complete sanitized exports are implemented.
- Driver trip lifecycle, GPS quarantine, reconnect state, monotonic route progress, explicit ETA states and late-alert evidence are implemented.
- Notification delivery uses a durable PostgreSQL outbox, worker locking, bounded retries and audited recovery controls.
- Security includes strict CORS, Helmet, metadata-only logs, PostgreSQL-shared rate limits, exact proxy-hop policy, revocable sessions, HttpOnly admin cookies and CSRF protection.
- The admin app includes route/schedule/roster/driver/advisor workflows plus operations, late-alert delivery, audit-history and session-management screens.
- The mobile app includes no-login route selection, Track Bus, timeline, stop ETA, Student/Faculty roster badges, driver login/trip controls, native background location and a bounded 200-sample offline queue.
- Stable contracts, retention rules, CI, Docker staging examples and Expo build profiles are documented under `docs/`.

The repository is a local release candidate, not a completed college rollout. Real data approval, hosting/TLS/secrets, SMTP, real-device road testing, ETA calibration and a supervised pilot remain external release gates. See [the handoff](./PROJECT_BUILD_STATUS_AND_HANDOFF.md).