# Build Guide — OpenCode + Nemotron 3 Ultra Prompt Sequence
### College Bus Tracking System

**How to use this doc:** Work top to bottom. Copy one prompt block into OpenCode, let it finish, run the "Test before moving on" step, then move to the next prompt. Don't skip the test steps — catching a broken phase early is 10x cheaper than debugging three phases later. Commit to git after every phase (`git add -A && git commit -m "phase X done"`).

---

## 0. One-time setup (before any prompts)

Install locally:
- Node.js LTS + npm
- MySQL (or a free PlanetScale/Railway MySQL project — recommended, saves you local DB setup)
- Flutter SDK + Android Studio (for the Android emulator + `adb`)
- Git

One manual step you'll need before Phase 2 (not an OpenCode prompt — do this yourself in a browser):
- Go to [Google Cloud Console](https://console.cloud.google.com) → create a project → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
  - Create a **Web application** client (used by the admin panel for class advisor login).
  - Create an **Android** client (used by the Flutter student app) — you'll need your app's package name (`com.college.bustracker`) and SHA-1 fingerprint (`cd android && ./gradlew signingReport` inside `mobile-app/`, grab the debug SHA-1).
- Save both client IDs — you'll paste them into `.env` (backend + admin-panel) and `config.dart` (mobile-app) when we get there.

Create the project folder and open OpenCode inside it:
```bash
mkdir bus-tracking-system && cd bus-tracking-system
git init
opencode
```

Target repo structure (tell OpenCode this up front — it's in Prompt 0.1 below):
```
bus-tracking-system/
├── backend/          # Node + Express + Prisma + Socket.io
├── admin-panel/       # React + Vite (website, browser only)
└── mobile-app/        # Flutter (student + driver, installs on phone)
```

---

## PHASE 0 — Project Scaffolding

### Prompt 0.1
```
Act as a senior full-stack developer. Set up a monorepo for a college bus tracking system with three folders:

1. backend/ — Node.js + Express (plain JavaScript, no TypeScript) + Prisma ORM + MySQL + Socket.io
2. admin-panel/ — React + Vite (plain JavaScript, no TypeScript) + TailwindCSS
3. mobile-app/ — Flutter project (org id: com.college.bustracker)

Requirements:
- backend/: initialize npm, install express, prisma, @prisma/client, socket.io, jsonwebtoken, bcrypt, cors, dotenv. Set up a basic src/index.js that starts an Express server on port 4000 with a Socket.io server attached, and a GET /health route returning { status: "ok" }. Add npm scripts: "dev" (using nodemon), "start". Use CommonJS (require/module.exports) unless you have a good reason to use ES modules — keep it simple.
- admin-panel/: scaffold with `npm create vite@latest` (React + JavaScript template, not TypeScript), install tailwindcss, react-router-dom, axios. Set up Tailwind config. Replace the default page with a simple placeholder that says "Admin Panel — Bus Tracking System".
- mobile-app/: run `flutter create` with the given org id. Add these dependencies to pubspec.yaml: socket_io_client, geolocator, flutter_map, latlong2, http, provider. Confirm the default counter app runs.
- Add a root .gitignore covering node_modules, .env, build folders, and Flutter build artifacts.
- Add a root README.md briefly describing the three folders and how to run each (npm run dev for backend, npm run dev for admin-panel, flutter run for mobile-app).

Do not add any business logic yet — this is scaffolding only. After setup, run each project's dev/build command to confirm all three start without errors and report the output.
```

**Test before moving on:**
- `cd backend && npm run dev` → visit `http://localhost:4000/health`, should return `{"status":"ok"}`
- `cd admin-panel && npm run dev` → open the printed localhost URL, should see the placeholder page
- `cd mobile-app && flutter run` → should launch the default counter app on an emulator or connected phone

---

## PHASE 1 — Database Schema

### Prompt 1.1
```
In backend/, set up Prisma with MySQL (provider = "mysql" in schema.prisma). Create a .env.example with DATABASE_URL placeholder (I'll fill in the real connection string myself — do not ask me for it, just reference process.env.DATABASE_URL in the Prisma config).

Create prisma/schema.prisma with these models (use Prisma's relation syntax correctly, add appropriate @id, @default, @unique, and foreign key relations):

- Route: id, routeNo (unique string), name, areaCovered
- Stop: id, name, latitude (float), longitude (float)
- RouteStop: id, routeId (FK to Route), stopId (FK to Stop), sequenceOrder (int), scheduledTime (string, e.g. "07:45")
- Driver: id, name, phone (unique), licenseNo, passwordHash — drivers log in with phone+password, not Google, since they may not have a college account
- Bus: id, busNo (unique string), routeId (FK to Route), driverId (FK to Driver, optional), capacity (int), plateNumber
- ClassAdvisor: id, name, phone, email (unique — must match their college Google account email), department, year (int), section, googleId (unique, nullable — filled in on first Google login)
- Student: id, rollNo (unique string), name, email (unique — must match their college Google account email), routeId (FK to Route), year (int), department, section, boardingStopId (FK to Stop), googleId (unique, nullable — filled in on first Google login)
- Trip: id, busId (FK to Bus), date (DateTime), startTime (DateTime, optional), status (enum: SCHEDULED, RUNNING, COMPLETED), filledCount (int, default 0)
- LiveLocation: id, tripId (FK to Trip), latitude (float), longitude (float), timestamp (DateTime, default now), currentStopIndex (int, default 0)
- BoardingRecord: id, tripId (FK to Trip), studentId (FK to Student), boardedAt (DateTime, default now) — one row per QR scan, gives real per-student boarding data
- LateAlert: id, tripId (FK to Trip), predictedEta (DateTime), triggeredAt (DateTime, default now), studentsAffected (Json — array of roll numbers), advisorsNotified (Json — array of advisor ids), previousHash (string, nullable), recordHash (string) — these last two fields form a simple hash chain: each new LateAlert's recordHash is a SHA-256 hash of its own data plus the previous row's recordHash, so tampering with any past row breaks the chain and is detectable. Explain this in a code comment.

Note: students and class advisors have no passwordHash — they only ever log in via Google OAuth (built in Phase 2), matched by email. Drivers and the hardcoded admin use password auth.

Add indexes on foreign keys where sensible. After writing the schema, run `npx prisma generate` to confirm it's valid (do not run migrate yet since I haven't connected a real database). Report any schema errors.
```

**Test before moving on:**
- Fill in your real `DATABASE_URL` in `backend/.env` (from PlanetScale/Railway MySQL)
- Run `npx prisma migrate dev --name init` — should create all tables with no errors
- Run `npx prisma studio` — you should see all 11 empty tables in the browser UI

---

## PHASE 2 — Backend Auth + Core CRUD APIs

### Prompt 2.1
```
In backend/, build authentication. Four roles can log in: admin, driver, student, classAdvisor — two different auth methods depending on role.

Password auth (driver, admin) — admins are not a database table, hardcode one admin login via environment variables (ADMIN_EMAIL, ADMIN_PASSWORD_HASH in .env):
- POST /auth/login — accepts { role, identifier, password }. For driver: identifier is phone. For admin: identifier is the env ADMIN_EMAIL. Verify password with bcrypt, return a JWT (include role and id in the payload, 7-day expiry).
- A POST /auth/seed-passwords dev-only route (only runs if NODE_ENV=development) that takes a plain password and returns its bcrypt hash — I'll use this to manually set initial passwords for testing via Prisma Studio.

Google OAuth (student, classAdvisor) — install google-auth-library:
- POST /auth/google — accepts { role, idToken }. role must be 'student' or 'classAdvisor'. Verify idToken using OAuth2Client.verifyIdToken (client ID from env GOOGLE_CLIENT_ID — I'll set this after creating my Google Cloud OAuth credentials). Extract the verified email from the token payload.
- Look up the matching Student or ClassAdvisor row by that email (they must already exist — admin creates them via the admin panel first, with their college email). If no matching row exists, return 404 with a clear message ("No student/advisor record found for this email — ask admin to add you first").
- If found and googleId is empty, save the Google account's sub (id) as googleId on first login. If googleId is already set, confirm it matches (extra safety check).
- Return a JWT (role + id in payload, 7-day expiry) — same shape as the password-login JWT so the rest of the app doesn't need to care which method was used.

Shared:
- Express middleware `requireAuth(allowedRoles)` that verifies the JWT from the Authorization header and checks the role is allowed. Attach decoded payload to req.user.

Write clean error handling (401 for bad credentials/invalid token, 403 for wrong role, 404 for unregistered email). Report the final list of routes added.
```

**Test before moving on:**
- Use Prisma Studio to add one test Driver row, get its password hash via the seed-passwords route, paste into `passwordHash`.
- Add one test Student and one ClassAdvisor row with your own real Google email (so you can actually test the OAuth flow).
- Use `curl`/Postman to log in as driver, confirm JWT + 401 on wrong password.
- Google OAuth needs a real client to get an idToken — you'll do the full end-to-end test once Phase 3/5's Google Sign-In buttons exist. For now, just confirm the routes exist and return sensible errors on garbage input.

### Prompt 2.2
```
In backend/, build full CRUD REST APIs, all protected by requireAuth(['admin']) except where noted:

- /routes — GET (public, no auth needed), POST, PUT /:id, DELETE /:id
- /stops — GET (public), POST, PUT /:id, DELETE /:id
- /route-stops — GET /:routeId (public, returns ordered stops for a route with scheduledTime), POST, PUT /:id, DELETE /:id
- /drivers — GET, POST, PUT /:id, DELETE /:id (never return passwordHash in responses)
- /buses — GET, POST, PUT /:id, DELETE /:id
- /class-advisors — GET, POST, PUT /:id, DELETE /:id (never return passwordHash)
- /students — GET, POST, PUT /:id, DELETE /:id, plus GET /students/by-route/:routeId (never return passwordHash)

Use Prisma for all queries. Validate request bodies with zod (install it) — reject malformed input with 400 and a clear error message. Add pagination (?page=&limit=) to all GET-list endpoints, default limit 50.

Report the full route list when done.
```

**Test before moving on:**
- Log in as admin, use the JWT to create 2-3 routes, a few stops, a bus, a driver via curl/Postman
- Confirm GET /routes (no auth) returns them
- Confirm POST /routes without a JWT returns 401

---

## PHASE 3 — Admin Panel (Website)

### Prompt 3.1
```
In admin-panel/, build the login page and app shell.

- A login page with two sections: (1) a password form (role dropdown: admin/driver) that calls POST http://localhost:4000/auth/login and stores the returned JWT + role in localStorage; (2) a "Sign in with Google" button (use @react-oauth/google, client ID from env VITE_GOOGLE_CLIENT_ID) for class advisors — on success, send the returned Google idToken to POST http://localhost:4000/auth/google with { role: 'classAdvisor', idToken }, store the returned JWT + role the same way. Students don't use the admin panel at all.
- A protected layout: sidebar with links to Routes, Stops, Buses, Drivers, Students, Class Advisors, and (if role is admin) a "Delayed Buses Today" link. Redirect to /login if no valid JWT in localStorage.
- Use react-router-dom for routing. Add an axios instance in src/api.js that automatically attaches the JWT as Authorization: Bearer <token> to every request, base URL http://localhost:4000.
- Simple, clean Tailwind styling — doesn't need to be fancy, just usable. Use a consistent table + "Add New" button pattern since we'll reuse it across every entity screen.

Confirm the login flow works end to end against the running backend.
```

**Test before moving on:**
- Log in as admin in the browser, confirm you land on the dashboard and the sidebar shows
- Confirm reloading the page keeps you logged in (JWT persists)

### Prompt 3.2
```
In admin-panel/, build full CRUD screens for: Routes, Stops, Buses, Drivers, Students, Class Advisors. Each screen should:
- Show a table of all records (paginated) fetched from the matching backend endpoint
- Have an "Add New" button opening a modal/form with the right fields for that entity
- Have Edit and Delete actions per row
- For Buses: the form should let you pick an existing Route and Driver from dropdowns (fetch routes/drivers for the select options)
- For Students: the form should let you pick a Route and a boarding Stop from dropdowns
- For Route Stops (nested inside the Route detail view): let admin add stops to a route in order, with a scheduled time per stop, and reorder them

Reuse a shared <DataTable> and <FormModal> component across all six screens instead of duplicating code. Show a loading spinner while fetching and a toast/message on save success or error.
```

**Test before moving on:**
- Create all 31 routes with realistic Hyderabad-area names, and stops for at least 2-3 routes fully (this is real data entry, not a code task — budget time for it)
- Add a few drivers, buses, students, and class advisors through the UI and confirm they show up correctly

---

## PHASE 4 — Real-time GPS Pipeline

### Prompt 4.1
```
In backend/, extend the Socket.io server for live bus tracking.

Events:
- Driver app emits "driver:location" with { tripId, latitude, longitude }. On receipt:
  1. Save a new LiveLocation row.
  2. Fetch the trip's route stops (ordered). Using the Haversine formula, compute distance from this location to the next unreached stop (based on currentStopIndex). If distance < 150 meters, increment currentStopIndex on the LiveLocation/Trip and treat that stop as reached.
  3. Broadcast "bus:update" to a Socket.io room named `trip:${tripId}` with { tripId, latitude, longitude, currentStopIndex, timestamp }.
- Student/admin clients emit "join:trip" with { tripId } to join that room and receive updates.

Also add REST endpoints:
- POST /trips/start — { busId } — creates a Trip with status RUNNING, startTime now, date today. Returns the tripId.
- POST /trips/:id/end — sets status to COMPLETED.
- POST /trips/:id/board — { rollNo } — used by the driver's QR scanner. Look up the Student by rollNo, confirm they belong to this trip's route (404 with a clear message if not), confirm they haven't already boarded this trip (409 if a BoardingRecord already exists for this tripId+studentId — no duplicate scans). Otherwise create a BoardingRecord, increment Trip.filledCount, and broadcast "occupancy:update" to the trip's Socket.io room with { tripId, filledCount, lastBoarded: { rollNo, name } }.
- GET /trips/active — returns all currently RUNNING trips with their route and latest location (public, no auth — students need this to find their bus).

Write a Haversine distance utility function with clear comments explaining the math (I want to understand it, not just have it work).
```

**Test before moving on:**
- Write a tiny test script (Node or a simple HTML page with socket.io-client via CDN) that connects, joins a trip room, and fake-emits a few "driver:location" events walking toward a stop's coordinates
- Confirm you see "bus:update" events fire, and currentStopIndex increments once you're within 150m of a stored stop

---

## PHASE 5 — Flutter App: Auth + Driver Screen

### Prompt 5.1
```
In mobile-app/, build the app foundation.

- A login screen with a role toggle (Driver / Student):
  - Driver mode: phone + password fields, calling POST http://<BACKEND_HOST>:4000/auth/login (use 10.0.2.2 as host if targeting the Android emulator; make this a configurable constant at the top of a config.dart file so I can switch it to my laptop's LAN IP for real phone testing).
  - Student mode: a "Sign in with Google" button using the google_sign_in package (Android client ID from Google Cloud, referenced via config.dart). On success, grab the idToken from the signed-in account and POST it to /auth/google with { role: 'student', idToken }.
- Store the JWT and role using shared_preferences (add this package).
- After login, route to DriverHomeScreen or StudentHomeScreen based on role.
- Use Provider for simple app-wide auth state (isLoggedIn, role, token, userId).
- If the backend returns 404 (email not registered by admin yet), show a clear message: "Ask your transport admin to add your college email first."

Keep the UI simple and functional — Material widgets, no custom design system needed yet.
```

**Test before moving on:**
- Run on an emulator, log in as the test driver you created earlier, confirm it navigates to a (currently blank) driver home screen
- Log in as the test student, confirm it navigates to a (currently blank) student home screen

### Prompt 5.2
```
In mobile-app/, build DriverHomeScreen fully.

- Show the driver's assigned bus (fetch via a new backend endpoint GET /buses/by-driver/:driverId — add this endpoint in backend/ too) with route name and bus number.
- A big "Start Trip" button that calls POST /trips/start with the busId, stores the returned tripId, and begins streaming GPS.
- Once started: use the geolocator package to get location updates every 8 seconds (or on 20m movement, whichever comes first), and emit them via socket_io_client as "driver:location" events with the tripId. Request location permission properly (handle denied permission with a clear message).
- Show a live status text: "Streaming location... last sent: <time>" so the driver knows it's working.
- A "Scan Student" button that opens a camera scanner (use mobile_scanner package) to read a QR code containing a student's rollNo. On a successful scan, call POST /trips/:id/board with { rollNo }, which the backend uses to create a BoardingRecord and increment Trip.filledCount. Show a brief confirmation ("Boarded: <name>, <rollNo>") or an error if the rollNo doesn't match anyone on this route or was already scanned for this trip. Show a running "Boarded: X / capacity" counter driven by the actual scan count, not manual input.
- An "End Trip" button that stops the GPS stream and calls POST /trips/:id/end.
- Handle app backgrounding: use a foreground service notification (add flutter_foreground_task package) so location streaming doesn't get killed when the driver's screen locks — explain briefly in a code comment why this matters for a moving vehicle.
```

**Test before moving on:**
- On a real phone (see Phase 9 for how to install it), start a trip, walk/drive around, and confirm — via a temporary debug endpoint or backend console logs — that location updates are arriving
- Lock the phone screen for a minute and confirm updates keep arriving (tests the foreground service)

---

## PHASE 6 — Flutter App: Student Screens

### Prompt 6.1
```
In mobile-app/, build StudentHomeScreen.

- On load, fetch the student's own route (GET /students/:id or similar — add a "me" endpoint that returns the logged-in student's full profile including route and boarding stop, using the JWT) and the active trip for that route (GET /trips/active, filter client-side or add a query param).
- If no bus is currently running for their route, show "No bus running yet — check back closer to your pickup time."
- If a trip is active: join the trip's Socket.io room ("join:trip"), and show:
  - A flutter_map view centered on the bus's last known location, with a marker that moves as "bus:update" events arrive (animate the marker position smoothly between updates rather than jumping).
  - A card showing: bus number, driver name + phone, faculty incharge (class advisor) name + phone, capacity vs current filled count (color-coded: green <70%, yellow 70-90%, red >90%).
  - A "Timeline" tab/toggle as an alternative to the map: a vertical stepper of all stops on the route, with the current stop highlighted based on currentStopIndex, and scheduled time shown next to each stop.
- A third tab, "My QR": a full-screen QR code (use the qr_flutter package) encoding just the student's rollNo as plain text, with their name and rollNo printed below it in large text. This is what the driver scans at boarding — keep it simple, no extra encoding or encryption needed since it's just an identifier, not a credential.

Use a bottom navigation or tab bar to switch between Map, Timeline, and My QR. Keep state in a StudentTripProvider using Provider so the live views share data.
```

**Test before moving on:**
- With a driver trip running (from Phase 5 test), open the student app on a second device/emulator, confirm the map marker and timeline both update live as fake/real location events come in

---

## PHASE 7 — ETA Prediction

### Prompt 7.1
```
In backend/, add ETA prediction to the live location pipeline.

- For each trip, keep the last 5 LiveLocation points in memory (or query them from DB) whenever a new "driver:location" event arrives.
- Compute average speed (meters/second) from consecutive points using their timestamps and Haversine distance.
- For the next unreached stop and for the college itself (store college's lat/lng as a constant), compute predicted arrival time = current time + (remaining distance / average speed).
- Include predictedEtaCollege and predictedEtaNextStop in the "bus:update" Socket.io broadcast payload.
- Guard against divide-by-zero or wildly inflated ETAs when the bus is stationary (e.g., at a stop) — if average speed is below a small threshold (e.g., 0.5 m/s), don't update the ETA, just report the last known good one.

Add a comment explaining the ETA formula clearly.
```

**Test before moving on:**
- Re-run the fake-GPS test script from Phase 4, moving points at a realistic walking/driving pace, and confirm predictedEtaCollege appears and looks sane in the broadcast payload

---

## PHASE 8 — Late-Alert System

### Prompt 8.1
```
In backend/, build the late-arrival alert system.

- Add COLLEGE_ARRIVAL_DEADLINE = "09:50" and a buffer constant (e.g., alert triggers if predicted ETA to college is later than 09:45, giving a 5-min early warning) as config values.
- After every ETA calculation (from Phase 7), check: if predictedEtaCollege > today's deadline threshold AND no LateAlert already exists for this trip (avoid duplicate spam) OR the new ETA is more than 15 minutes later than the last alert's predictedEta (re-alert on worsening delay):
  1. Fetch all students on this trip's route.
  2. Group them by (year, department, section).
  3. For each group, find the matching ClassAdvisor.
  4. Build the record data { tripId, predictedEta, studentsAffected (roll numbers), advisorsNotified (advisor ids) }. Fetch the most recent LateAlert (by triggeredAt) and use its recordHash as this new record's previousHash (null if this is the very first alert ever). Compute recordHash = SHA-256 hex digest (use Node's built-in crypto module) of JSON.stringify({ ...recordData, previousHash }) — deterministic and tamper-evident: if anyone edits a past row directly in the database, recomputing its hash won't match what the next row in the chain expected. Save the LateAlert row with both hash fields.
  5. Send an email to each advisor (use nodemailer with a free SMTP like Gmail app-password or Resend — make the SMTP config env-driven, and if no SMTP env vars are set, just log the "would-be email" to console instead of failing, so this works even before I've set up email credentials).
     Email content: "Route <routeNo> is running late (predicted arrival <time>). Affected students: <roll_no list>, Year <Y> <Dept>-<Section>."

Add GET /late-alerts/today (admin-only) returning today's alerts, for the admin dashboard.
Add GET /late-alerts/verify (admin-only) that walks the full chain in order (oldest to newest), recomputes each row's expected hash from its data + the previous row's stored hash, and compares it to the stored recordHash. Return { valid: true } if every row checks out, or { valid: false, brokenAt: <alertId> } for the first mismatch found. Explain in a comment that this is the same tamper-evidence principle blockchains use (a hash chain), just without the distributed/consensus part — appropriate for a single trusted database rather than a decentralized ledger.
```

**Test before moving on:**
- Fake-GPS a trip that's clearly going to arrive late (slow speed, far from college), confirm a LateAlert row is created and the console (or real email) shows the correct grouped student/advisor info
- Confirm running it again right after doesn't spam a duplicate alert, but a much later ETA does trigger a second one
- Trigger 2-3 alerts, then call GET /late-alerts/verify and confirm { valid: true }. Then manually edit one alert's studentsAffected directly in Prisma Studio and call verify again — confirm it now reports { valid: false, brokenAt: <that id> }

### Prompt 8.2
```
In admin-panel/, add a "Delayed Buses Today" dashboard page showing GET /late-alerts/today as a table: route, predicted ETA, students affected (expandable list), advisors notified, triggered time. Auto-refresh every 30 seconds while the page is open.
```

**Test before moving on:**
- Open this page while a fake-late trip is running, confirm the alert appears within 30 seconds

---

## PHASE 9 — Get the App on Your Phone

You don't need the Play Store for testing — sideload a debug build directly.

**Option A — fastest, while developing (USB cable):**
1. Enable Developer Options on your Android phone (tap Build Number 7 times in Settings → About Phone), then enable USB Debugging.
2. Connect phone via USB, accept the "Allow USB debugging" prompt.
3. In `mobile-app/`, run:
   ```bash
   flutter devices        # confirm your phone shows up
   flutter run             # installs + launches directly, with hot reload
   ```
4. In `mobile-app/lib/config.dart`, set the backend host to your laptop's LAN IP (not `10.0.2.2`, that's emulator-only) — e.g. `http://192.168.1.42:4000`. Find your LAN IP with `ipconfig` (Windows) or `ifconfig`/`ip a` (Mac/Linux). Phone and laptop must be on the same Wi-Fi.

**Option B — a shareable APK (for driver/tester phones without a USB/dev setup):**
```bash
cd mobile-app
flutter build apk --debug
```
This produces `build/app/outputs/flutter-apk/app-debug.apk`. Send this file to any Android phone (via WhatsApp, email, USB transfer, Google Drive) and tap it to install — the phone will need "Install from unknown sources" allowed once (Android will prompt automatically).

For a smaller, faster release-style build once things are stable:
```bash
flutter build apk --release
```

**Test before moving on:** install on at least two real phones (one as "driver," one as "student"), and do a real walk-test — start a trip on the driver phone, watch the student phone's map and timeline update as you physically move.

---

## PHASE 10 — End-to-End Testing Checklist

Run through these real scenarios before considering the MVP done:

1. Admin creates a route with 5+ stops, a bus, a driver, and 3+ students on that route.
2. Driver logs in, starts trip, GPS streams correctly, QR scan boarding works (scan a student's "My QR" screen, confirm occupancy count and boarding record update).
3. Student logs in, sees live map movement and timeline advancing as stops are passed.
4. Bus info card shows correct driver name/phone, advisor name/phone, and correct color-coded occupancy.
5. Simulate a late bus (slow movement or a route that's naturally tight on time) → confirm LateAlert fires once, correct students/advisors identified, admin dashboard shows it.
6. Driver ends trip → student view reflects "trip ended" state cleanly (add this state if missing).
7. Kill and reopen the app mid-trip → confirm login persists and the student rejoins the live trip room correctly.
8. Two students on different routes, two buses running simultaneously → confirm no cross-talk between trip rooms.

---

## Working with OpenCode + Nemotron 3 Ultra — a few practical tips

- **One phase per session, always test before the next.** Even with a 1M-token context, an agent that free-runs across 5 phases without a checkpoint will compound small mistakes (e.g., a wrong field name in Phase 1 silently breaks Phase 4).
- **Paste real errors back, don't re-describe them.** If `npm run dev` throws a stack trace, paste the exact trace into OpenCode rather than summarizing — it'll fix it faster and more precisely.
- **Commit after every working phase.** `git commit` after each green checkmark above gives you a rollback point if a later phase's agent edits break something upstream.
- **Keep secrets out of prompts.** Never paste your real `DATABASE_URL`, JWT secret, SMTP password, or Google OAuth client secret into an OpenCode prompt — reference them as env vars like the prompts above already do. The OAuth *client IDs* (not secrets) are safe to reference directly since they're public by design.
