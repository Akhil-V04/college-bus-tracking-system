# Local testing: Administrator, Passenger, and Driver

This guide tests the current repository against the configured local backend and Supabase database. It uses the existing React administrator reference, the combined Expo Passenger/Driver application, synthetic data, simulated email/push providers, and the restricted `bus_tracker_runtime` database identity.

## 1. Current testing boundary

The backend workflows are ahead of the frontend. The current interfaces are suitable for integration testing, but they are not the final UI.

- The administrator panel is a React + Vite reference application.
- Passenger mode requires no login.
- Driver mode uses a driver code and password.
- The current mobile landing page opens the Passenger route list and provides a **Driver login** button. The finalized two-avatar Passenger/Driver landing screen is scheduled for the later frontend phase.
- Backend Google Maps routing and persisted route geometry can be tested. The mobile app still uses its reference map component; final native Google Maps rendering is deferred.
- Real SMTP, Expo push delivery, background-GPS device certification, and road calibration are deferred. Their backend behavior uses simulations.

## 2. Recommended local test arrangement

Use three surfaces at the same time:

| Role | Recommended surface | Purpose |
| --- | --- | --- |
| Administrator | Chrome/Edge at `http://localhost:5173` | Configure routes, schedules, rosters, drivers, and inspect operations/audit evidence |
| Passenger | Expo web or a second Android device/emulator | View Route 01 without logging in and watch public trip updates |
| Driver | Android emulator or physical Android phone | Log in, start a trip, grant GPS permission, share location, and end the trip |

Using Expo web for Passenger and Android for Driver avoids switching roles and stored driver state inside one running mobile installation.

## 3. Before starting

Required software:

- Node.js 22 or newer and npm;
- the existing private `backend/.env` with Supabase and Google Maps configuration;
- Android Studio emulator or an Android phone for driver GPS testing;
- all three package dependencies installed with `npm install`.

Do not replace the configured `backend/.env` with `.env.example`. Never put database passwords, Google Maps keys, JWT secrets, or administrator passwords in this guide, screenshots, commits, or chat.

Verify the backend configuration without displaying its values:

```powershell
cd E:\bus-tracking-system\backend
npm run verify:runtime-role
```

Expected result includes:

- `runtimeRole: bus_tracker_runtime`;
- `rlsPolicies: 27/27`;
- `deniedOperationsVerified: 10`;
- `migrationLedgerDenied: true`.

## 4. Prepare synthetic records and credentials

The database should already contain the synthetic Route 01, two stops, a published roster, two passengers, one advisor, and driver `DRV001`. If the demo records are missing, run:

```powershell
cd E:\bus-tracking-system\backend
npx prisma db seed
```

The seed is additive/idempotent and does not erase the database. Do **not** run `prisma migrate reset`, `DROP SCHEMA`, or passenger-purge commands against the configured Supabase database.

Create a private administrator password interactively:

```powershell
cd E:\bus-tracking-system\backend
npm run admin:set-password
```

The command asks for the administrator email and masks the password. It stores only the password hash in ignored `backend/.env` and revokes previous administrator sessions. Restart the backend after changing it.

For the driver test, sign in to the administrator panel, open **Drivers**, edit `DRV001`, and assign a new local-only test password that you know. Leave the password field blank on later edits when you do not want to rotate it. Record the password in a password manager or temporary private note, not in Git.

## 5. Start the backend

Open PowerShell terminal 1:

```powershell
cd E:\bus-tracking-system\backend
npm run dev
```

Check both endpoints in a browser or PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/health/ready
Invoke-RestMethod http://localhost:4000/api/v1/passenger/routes
```

Expected results:

- `/health` returns `status: ok`;
- `/health/ready` returns `status: ready` and `database: ok`;
- the passenger route response includes synthetic Route `01`;
- no response contains database credentials, Google Maps credentials, driver phone numbers, licence numbers, password hashes, or passenger identifiers.

Keep this terminal open while testing all roles.

## 6. Start and test the administrator panel

Open PowerShell terminal 2:

```powershell
cd E:\bus-tracking-system\admin-panel
npm run dev
```

Open `http://localhost:5173` and sign in with the administrator email and password configured by `npm run admin:set-password`.

Run this checklist:

1. **Authentication**
   - A wrong password returns an error.
   - A correct password opens Overview.
   - Refreshing the browser keeps the valid server-backed session.
   - Browser DevTools shows an HttpOnly administrator cookie; application JavaScript cannot read its value.
   - Sign out, then confirm a protected page returns to Login.

2. **Overview and operations**
   - Overview loads routes, drivers, rosters, schedules, advisors, and alerts without errors.
   - Operations shows integer counts for trips, notifications, push records, feedback, emergencies, assistance offers, and administrator sessions.

3. **Route and driver setup**
   - Route `01` exists with capacity `52` and is assigned to `DRV001`.
   - Driver phone and licence data appear only in administrator screens.
   - Editing the driver without a password preserves the current password.
   - Changing the password invalidates the driver's previous token.

4. **Schedule and Google Maps geometry**
   - If the driver later sees **Published route geometry is not ready**, create a new MORNING schedule version for Route 01.
   - Add at least `Demo Start` followed by `College`, with increasing times.
   - Validate the schedule and publish it.
   - Publication should succeed only when the backend Google Maps Cloud credential is available; generated geometry is persisted and reused.

5. **Roster**
   - Open the published `2026-27` roster and confirm Demo Student and Demo Faculty are assigned to Route 01.
   - Create a separate synthetic draft when testing add/edit/remove behavior.
   - Validate before publication. Publishing changes the active passenger view, so publish only a disposable synthetic draft you intend to use.
   - Old passenger deletion remains disabled; testing roster publication must not purge historical rows.

6. **Evidence and sessions**
   - Audit History contains administrator actions without passwords, phone numbers, workbook contents, or tokens.
   - Sessions lists the current session and supports revocation.
   - Late Alerts and Operations distinguish active, recovered, pending, failed, and stale states.

The newer feedback and emergency administration APIs are backend-complete but are not yet fully represented in this reference navigation. Use the automated restricted acceptance suite for those workflows until the frontend phase adds their screens.

## 7. Configure and start the combined mobile application

Create `mobile-app/.env` from the example only if it does not exist.

### Android emulator

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

### Physical Android phone

Connect the phone and laptop to the same network. Run `ipconfig`, find the laptop's active IPv4 address, and use it instead of the example below:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000
```

Allow inbound TCP port 4000 through Windows Firewall only for the private local network. Confirm the phone can open `http://YOUR-LAPTOP-IP:4000/health` before starting Expo.

### Expo web passenger test

Expo web can use `http://localhost:4000`:

```powershell
cd E:\bus-tracking-system\mobile-app
$env:EXPO_PUBLIC_API_URL='http://localhost:4000'
npm run web
```

### Android test

Open PowerShell terminal 3:

```powershell
cd E:\bus-tracking-system\mobile-app
npm run android
```

If Metro cached an old API address, stop it and restart with:

```powershell
npx expo start --clear
```

## 8. Test Passenger mode

Passenger mode never asks for a name, phone number, password, or account.

1. Open the combined mobile app. In the current reference UI, the Passenger route list opens first.
2. Confirm Route `01` appears with its public name, area, driver name, capacity, and assigned count.
3. Open Route 01.
4. Confirm the ordered fixed schedule shows `Demo Start` and `College`.
5. Confirm scheduled time is labelled separately from live ETA.
6. Open the roster view and confirm only the public Student/Faculty information appears.
7. Confirm driver phone, licence, password data, administrator data, passenger bus-pass IDs, roll numbers, and faculty IDs do not appear.
8. Before a trip starts, expect a clear no-live-data state while fixed route information remains available.
9. Keep this screen open while testing Driver mode. After the driver starts and shares GPS, confirm live state/ETA updates arrive without refreshing the page.
10. Pause driver GPS or disconnect the driver's network and confirm Passenger mode eventually reports stale/unavailable tracking rather than inventing a location.

The final route search, nearest-stop, saved My Route, Notify Me, feedback, emergency, two-avatar landing, and native Google Maps presentation are later frontend tasks. Their backend contracts are tested separately.

## 9. Test Driver mode

Use an Android emulator or phone for useful GPS behavior.

1. Tap **Driver login** from the current Passenger home.
2. Enter driver code `DRV001` and the private password set through the administrator panel.
3. Confirm the console shows the driver's assigned Route 01 without exposing passenger private data.
4. Tap **Start trip**.
5. If start is rejected, check the administrator setup:
   - driver is ACTIVE;
   - driver is assigned to Route 01;
   - one roster is PUBLISHED;
   - a MORNING schedule for Route 01 is PUBLISHED;
   - that schedule has persisted geometry.
6. Tap **Share live GPS** and grant foreground location permission.
7. On a native development build, also grant background location after reading the disclosure. Confirm Android shows the persistent tracking notification.
8. Walk, drive only as a passenger, or use Android emulator location controls to move along the configured stop coordinates.
9. Confirm the driver progress changes monotonically and Passenger mode receives marker/progress updates.
10. Deny permission once and confirm the screen explains the failure without ending the trip.
11. Pause GPS sharing and confirm no new samples are sent.
12. Temporarily disable the network, produce several samples, reconnect, and confirm the bounded queue drains in order.
13. Tap **End trip** and confirm tracking stops.
14. Log out and confirm the stored driver token is cleared.

Expo Go can exercise Passenger screens and foreground behavior, but it cannot certify screen-locked background tracking. Use an Expo development build for that test:

```powershell
cd E:\bus-tracking-system\mobile-app
npx eas-cli build --profile development --platform android
```

Expo credentials are intentionally deferred, so this build step may remain unavailable during the current backend milestone.

## 10. End-to-end role sequence

Use this order for a faculty demonstration:

1. Administrator logs in and shows Route 01, its driver, published schedule, and roster.
2. Passenger opens Route 01 without logging in and sees fixed schedule information with no live trip.
3. Driver logs in and starts Route 01.
4. Driver enables GPS.
5. Passenger receives live state and ETA updates.
6. Administrator opens Operations and observes the running trip.
7. Driver pauses/restarts GPS to demonstrate stale/recovery handling.
8. Driver ends the trip.
9. Passenger sees route completion/no active trip.
10. Administrator checks actual-arrival evidence, Operations, alerts, and Audit History.

Do not perform an emergency-assistance road demonstration with real buses during ordinary local testing. That workflow requires supervised field testing.

## 11. Automated backend verification

For a quick code regression check:

```powershell
cd E:\bus-tracking-system\backend
npm run validate
```

Expected: Prisma schema valid and `92/92` tests pass.

For the full restricted Supabase workflow check:

```powershell
cd E:\bus-tracking-system\backend
npm run verify:restricted-acceptance
```

Expected: `restrictedAcceptanceChecks: 14` and `status: passed`. This suite uses synthetic fixtures, rolls back or removes them, keeps notification providers simulated, calls Google Maps without displaying the credential, and never enables old-passenger purge.

Run the heavier `npm run verify:backend-acceptance` only as a release gate. It uses the private migration connection for clean-schema and backup/restore drills and may take several minutes.

Validate the reference clients:

```powershell
cd E:\bus-tracking-system\admin-panel
npm run build

cd E:\bus-tracking-system\mobile-app
npm run validate
```

## 12. Record each manual run

Copy this table into an issue or private test note:

| Date/device | Role | Scenario | Expected | Actual | Pass/fail | Evidence without secrets |
| --- | --- | --- | --- | --- | --- | --- |
| | Admin | Login/logout/session revocation | Protected session behaves correctly | | | |
| | Passenger | Route 01 before trip | Fixed schedule; no fabricated live data | | | |
| | Driver | Start/share/pause/end | Owned trip and GPS lifecycle work | | | |
| | Passenger | Route 01 during trip | Live progress/ETA updates arrive | | | |
| | Admin | Operations/audit after trip | State and evidence are visible | | | |

Acceptable evidence includes status codes, timestamps, redacted screenshots, and synthetic route IDs. Never capture passwords, cookies, authorization headers, database URLs, Google Maps keys, push tokens, phone numbers, or real passenger records.

## 13. Common failures

| Symptom | Check |
| --- | --- |
| Administrator page shows network errors | Backend is running on port 4000 and admin panel is on an allowed CORS origin |
| Administrator credentials are not configured | Run `npm run admin:set-password`, then restart backend |
| Android cannot reach backend | Use `10.0.2.2` for emulator or the laptop LAN IP for a physical phone; verify firewall/private network |
| Driver login fails | Use the exact active driver code and the latest password set by the administrator |
| Start trip says no route assignment | Assign the driver to Route 01 in Routes & Capacity |
| Start trip says roster/schedule/geometry missing | Publish the synthetic roster and a valid two-stop schedule with Google Maps geometry |
| Passenger shows no live data | Start the trip, enable driver sharing, and keep device time/network/location accurate |
| Background GPS does not work in Expo Go | Use an Expo development build; test foreground fallback meanwhile |
| Route map is not the final Google Maps design | Native Google Maps/frontend integration is deferred; verify backend geometry with `npm run verify:googleMaps` |
| SMTP or push is simulated | This is expected until real provider credentials and device testing are authorized |
