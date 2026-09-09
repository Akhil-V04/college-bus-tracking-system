# Current Build Sequence

The original prompt sequence was removed because it described obsolete Flutter, Google-login, QR-boarding, and attendance requirements. This file now records safe implementation checkpoints. [PRD.md](./PRD.md) is authoritative.

## Checkpoint 1 - PostgreSQL local cutover

1. Create a least-privilege `bus_tracker` login and `college_bus_tracking` database.
2. Put the private PostgreSQL URL in `backend/.env`.
3. Run:

```powershell
cd E:\bus-tracking-system\backend
npx prisma migrate deploy
npx prisma db seed
npm run admin:set-password
npm run validate
npm run dev
```

4. Verify `GET /health`, administrator login, passenger routes, and phone-number omission.

Never paste a real database or account password into this file or an AI prompt.

## Checkpoint 2 - Administrator workflows

Complete and verify these React screens against the current API:

- dashboard;
- route services and capacity;
- stops and published schedule versions;
- drivers and route assignments;
- class advisors;
- draft annual rosters;
- CSV/XLSX validation preview;
- atomic publish/archive;
- one-click current-roster export;
- late alerts, notification attempts, and audit records.

Reject obsolete fields such as vehicle registration, passenger `active`, boarded count, and QR data.

## Checkpoint 3 - React Native passenger flow

Inside `mobile-app/`:

- keep passengers unauthenticated;
- fetch `GET /passenger/routes`;
- show one selector for route number (do not ask separately for bus number);
- fetch route details and published roster;
- show driver name without phone number;
- group passenger names by stop and label Student/Faculty;
- subscribe to `bus:update`;
- request ETA for a selected stop;
- clearly display `NOT_STARTED`, `NO_LIVE_DATA`, `AT_STOP`, `PASSED`, `POSSIBLY_SKIPPED`, and `TRIP_ENDED`.

Validate with:

```powershell
cd E:\bus-tracking-system\mobile-app
npm run validate
```

## Checkpoint 4 - React Native driver flow

- authenticate only through `POST /auth/login` with role `driver`;
- store the JWT in Expo SecureStore;
- load `GET /auth/me` and `GET /trips/mine`;
- start/resume through `POST /trips/start`;
- publish GPS only over an authenticated socket;
- end through `POST /trips/:id/end`;
- clear GPS subscriptions and sockets on end/logout;
- handle permission denial, invalid token, another running trip, rejected GPS, and network loss.

Foreground GPS is the foundation. Background GPS must use an Expo development build, explicit background permissions, an Android foreground-service notification, and real-device testing. Do not claim Expo Go proves background reliability.

## Checkpoint 5 - Verification

- backend unit and integration tests;
- mobile TypeScript validation and Expo export;
- admin production build;
- API privacy tests proving phone numbers are absent;
- stale/impossible GPS tests;
- passed-stop and skipped-stop tests;
- roster publication concurrency tests;
- notification idempotency/retry tests;
- real Android trip simulation;
- database backup and restoration drill.

## Environment notes

- Android emulator backend: `http://10.0.2.2:4000`
- Physical phone backend: laptop LAN IP on the same Wi-Fi
- Admin local URL: `http://localhost:5173`
- Backend local URL: `http://localhost:4000`
- PostgreSQL local port: `5432`

Only public client identifiers may appear in source control. Database passwords, JWT secrets, SMTP credentials, private roster files, and personal phone numbers must stay out of Git.
