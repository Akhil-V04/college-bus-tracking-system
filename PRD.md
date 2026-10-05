# College Bus Tracking System — Product Requirements Document

**Status:** Existing release-candidate baseline; revised backend scope pending implementation and verification; frontend work deferred
**Version:** 3.0
**Last updated:** 11 September 2026
**Location:** Aushapur, Hyderabad  
**Initial scope:** 31 college bus routes/services

## 1. Product summary

The College Bus Tracking System is a live transport-information and late-arrival alert platform for the college's 31 bus routes. It has two deployed applications sharing one backend:

1. One combined React Native (Expo + TypeScript) Android app. Its first screen presents two large role choices, `Passenger` and `Driver`. Passenger access requires no account or login. Driver access opens the authenticated driver login and trip/GPS workflow.
2. A separately hosted React + Vite administrator website for route, roster, driver, advisor, schedule, import, export, monitoring, feedback, emergency, and audit administration.

The system's central value is not only showing a moving bus. It predicts arrival times at remaining stops and the college. When a route is predicted to miss the college-arrival deadline, it identifies all students assigned to that route in the trip's academic-year roster, groups them by class, and alerts the appropriate class advisors. The advisor decides who is actually absent; the transport system does not track daily boarding attendance.

### 1.1 Current implementation status

This revision merges the finalized September requirements into the existing PRD. Sections 2–17 retain applicable product, privacy, domain, API, and failure-mode requirements. Section 22 records the complete finalized requirements for traceability; these supersede conflicting older plans. Section 23 is the repository status audit, and Section 24 is the active implementation plan.

The previous 87% completion estimate and blanket local-completion claims are withdrawn: they describe an older scope and do not measure this expanded product. Existing React administrator and Expo passenger/driver clients remain useful baseline assets, but **current development is backend-only**. New frontend implementation starts only after the complete revised backend workflow and API acceptance gate in Phase B9. Native delivery and road validation remain later gates; backend completion alone cannot prove device behavior.

On 9 September 2026, repository inspection confirmed Express, Prisma/PostgreSQL, Socket.IO, roster exchange, explainable ETA, SMTP/outbox code, session security, and administrative audit foundations. Running `npm test` in `backend` passed **59/59 tests**. This verifies the existing unit-test baseline, not all integration, hosting, or new-feature requirements. Database migration, backup/restore, live API/socket/load scripts, client builds, and field tests were not rerun in this documentation revision.

Supabase hosting is not verified; Google Maps, adaptive transmission, raw GPS cleanup, robust historical segment statistics, annual passenger purge, driver Excel import, push subscriptions, feedback, emergencies, and assistance require new work or modifications. No newly documented feature is marked complete merely because it appears here.

### 1.2 Locked technical stack

| Layer | Required technology and responsibility |
| --- | --- |
| Combined Passenger + Driver mobile app | One React Native + Expo + TypeScript Android application; two role entry choices; driver-only background GPS; role-appropriate mobile push |
| Administrator website | React + Vite; a web panel, not a mobile administrator app |
| APIs and business logic | Persistent Node.js + Express; Zod validation |
| Live communication | Socket.IO/WebSockets over persistent HTTPS/WSS connections |
| Data | Prisma ORM and migrations; Supabase-managed PostgreSQL for hosted database |
| Maps | Google Maps for rendering, route display, previews, and required directions |
| ETA | Explainable GPS, route progress, rolling speed, and robust historical segment statistics; no current ML claim |
| Notifications | Node.js workers; SMTP email to advisors; Expo/native push for passenger and driver devices |
| Data exchange | CSV/XLSX; separate annual passenger and driver workbook workflows |
| Security | Hashed passwords, JWT/sessions, revocation, HttpOnly/SameSite cookies, CSRF, Helmet, strict CORS, rate limits, role authorization |
| Hosting | Vercel administrator website; persistent Node backend/workers; Supabase PostgreSQL |

Supabase is primarily the managed PostgreSQL host. Express, Prisma, Socket.IO, current authentication, and Node workers remain authoritative. Do not substitute Supabase Auth, Realtime, Edge Functions, or other services without a separate request. No RAG is introduced.

`Combined Passenger + Driver mobile app / separately hosted Admin website → HTTPS/WSS → Express + Socket.IO + business logic/workers → Prisma → Supabase PostgreSQL`. Google Maps renders map information; backend route progress, ETA, and stop states remain authoritative.

## 2. Locked product decisions

These decisions supersede older project documents and implementation prompts:

- The route number and bus number are the same operational identifier. The product uses `routeNo` as the single displayed identifier.
- Physical vehicle registration/plate numbers are not stored.
- A physical vehicle may change without changing the route number, passenger roster, stops, or timings.
- The current vehicle capacity for each route/service is stored and can be updated by an admin.
- Only admins and drivers have authenticated accounts.
- Students and faculty are passengers, not authenticated application roles.
- Passengers use the app without creating accounts or signing in with Google.
- Passenger and Driver are two entry choices inside one installed mobile app; they are not separate downloadable apps.
- The landing screen shows two clear avatar/tile controls labelled `Passenger` and `Driver`. `Passenger` opens the passenger dashboard; `Driver` opens the driver login screen.
- The administrator panel is not part of the mobile app. It remains a separately hosted React website.
- Students and faculty share one roster-entry model and are differentiated by a visible `STUDENT` or `FACULTY` badge.
- There is no QR boarding workflow.
- There is no boarding record and no daily attendance tracking.
- There is no live occupied-seat count. The product displays assigned/registered passengers versus current capacity.
- Phone numbers are private. They are stored for administrative use and returned only by admin-authorized APIs.
- Passenger and driver screens never receive or display phone numbers.
- Passenger rosters are versioned by academic year with `DRAFT`, `PUBLISHED`, and `ARCHIVED` states.
- Publishing a validated annual workbook atomically replaces the active roster. Export the outgoing full roster first; retain only compact version metadata and necessary operational evidence after controlled cleanup, not a permanent full passenger archive.
- A trip uses the roster and route-schedule versions captured when that trip starts.
- ETA output is a state plus an estimate/range when appropriate; it is never blindly a number.
- If a selected stop was passed, the app says that it was already passed and does not return a negative ETA.
- All business-time calculations use the `Asia/Kolkata` timezone. Database timestamps are stored in UTC.

## 3. Goals

### 3.1 Passenger goals

- Select one route number and view its current details without an account.
- See the route, ordered stops, scheduled arrival time at each stop, driver name, capacity, and assigned-passenger count.
- Open a passenger-list view grouped by boarding stop.
- See passenger names and Student/Faculty badges. Roll numbers, faculty IDs, bus-pass IDs, and phone numbers remain administrator-only and are never returned by public APIs.
- Track the active bus on a live map.
- Select a stop and receive a useful, honest arrival estimate or a clear non-ETA state.
- See when live data was last updated.

### 3.2 Driver goals

- Log in securely with an admin-issued driver code and password.
- See only the route assigned by the admin.
- Start one trip for that route.
- Stream GPS reliably while the screen is locked or the app is backgrounded.
- See streaming, permission, connection, and last-update status.
- End the trip safely.

### 3.3 Admin goals

- Manage route services, stops, stop order, scheduled times, capacity, drivers, class advisors, and deadlines.
- Import thousands of student and faculty roster rows through CSV or Excel.
- Create and edit next-academic-year rosters as drafts without affecting the live passenger view.
- Validate a draft before publishing it.
- Export the complete current roster for all routes with one action.
- Download the complete current roster in CSV/Excel before replacement; old full rosters are not guaranteed downloadable after their approved cleanup.
- Publish a verified roster atomically and remove old passenger details according to retention rules while preserving minimal trip/alert/audit history.
- Monitor running routes, stale GPS, ETA status, late alerts, advisor coverage, and notification failures.
- See an audit history of sensitive administrative changes.

### 3.4 College goals

- Receive reliable early warning when a route is predicted to miss the college-arrival deadline.
- Notify the right class advisors with the affected students' names and roll numbers.
- Preserve an auditable history of trips, alerts, roster versions, and notification delivery.

## 4. Non-goals for the MVP

- Passenger login or Google OAuth.
- Passenger account lifecycle management.
- QR scanning or daily boarding confirmation.
- Student attendance decisions.
- Ticketing, fee payments, or bus-pass payments.
- Seat reservation.
- Parent accounts.
- Public driver or passenger phone numbers.
- Physical vehicle maintenance or registration tracking.
- RAG, and a machine-learning ETA model before sufficient historical data and evaluation demonstrate improvement.
- Play Store/App Store publication for the pilot; sideloaded Android builds are acceptable.

## 5. Users and access control

### 5.1 Admin

Privately provisioned with no public signup. Authenticated. Can view and manage all transport data, including private phone numbers, imports, exports, roster publication, advisors, alerts, and audit records.

### 5.2 Driver

Authenticated with an admin-issued driver code and password; no driver self-signup. Can view only their assigned route and trip controls. Cannot view passenger, advisor, or other driver phone numbers. Cannot start, end, or update another driver's trip.

### 5.3 Passenger

Unauthenticated student or faculty user. Can select a route and see the approved passenger-facing route, assigned names with Student/Faculty badges, tracking, timeline, and ETA data. Cannot see phone numbers, roll numbers, faculty IDs, bus-pass IDs, notification recipients, audit data, or administrator-only fields.

The implemented prototype uses fully open no-login route selection with sanitized responses. Before college rollout, the college must explicitly accept the passenger-name visibility policy or request a lightweight route access code. Such a code would restrict casual scraping without creating passenger accounts or password lifecycle.

### 5.4 Class advisor

Not an application account in the MVP. An advisor is a notification-contact record mapped to department, year, and section. Advisors verify attendance in class after receiving delayed-route information.

## 6. Primary user flows

### 6.1 Passenger flow

1. Open the app.
2. On the role-selection landing screen, tap the `Passenger` avatar/tile.
3. Open the passenger dashboard without login.
4. Select one route number, such as `Route 12`.
5. Open route details and view route name/areas, driver name, capacity, assigned count, trip status, and last update.
6. Use `Passenger List` to view the published roster grouped by stop.
7. Use `Track Bus` to open the live map.
8. Use `Estimate Arrival` to select a route stop.
9. Receive an ETA range or an explicit state such as not started, at stop, passed, stale, off route, or trip ended.

### 6.2 Driver flow

1. Open the same combined mobile app.
2. On the role-selection landing screen, tap the `Driver` avatar/tile.
3. Log in with administrator-issued credentials.
4. Review the assigned route and current schedule.
5. Complete location-permission and background-tracking checks.
6. Start the trip.
7. Stream authenticated GPS updates.
8. See connection and last-sent status.
9. End the trip at college.

### 6.3 Annual roster flow

1. Admin exports/downloads the complete outgoing roster as Excel before replacement.
2. Upload the approved new academic-year workbook, the source of truth; never automatically increment student years.
3. Parse without writing and validate Student/Faculty conditional fields, identifiers, duplicates, route/stop membership, capacity, advisor coverage, and schedule completeness.
4. Preview errors, additions, removals, route/stop changes, and academic changes against the current roster. Correct errors before confirmation.
5. Confirm the exact validated import and current roster version; reject stale previews and conflicting concurrent publication.
6. Atomically publish the new current roster. Future trips and current passenger views use it; running trips retain the operational snapshot captured at start.
7. Preserve minimum immutable trip/alert evidence, then purge superseded full passenger rows under a bounded policy. If a running trip still needs outgoing entries, defer only that required cleanup until its evidence is safe.
8. Manual corrections remain available through validated revision drafts and publication at any time. Recovery after full-roster cleanup requires re-import of the exported workbook, not a promise of indefinite database archives.

Separate driver Excel import and explicit active-trip transfer workflows are specified in Sections 22.13–22.15.

### 6.4 Late-alert flow

1. Driver GPS updates advance live route progress.
2. The backend calculates ETA for every remaining stop and the final college stop.
3. The late monitor evaluates the prediction at a throttled interval.
4. After multiple confident late evaluations, the trip enters a delayed state.
5. The backend loads `STUDENT` entries from the trip's roster snapshot.
6. Students are grouped by department, year, and section.
7. Matching advisors are found.
8. A LateAlert creates NotificationOutbox entries; a Node.js worker sends class-advisor email through SMTP with idempotency, retries, and PENDING/SENT/FAILED outcomes.
9. Delivery status and unmatched groups appear on the admin dashboard.

## 7. Functional requirements

### 7.1 Route service

- `routeNo` is the unique operational/display identifier.
- Store route name and areas covered.
- Store current capacity.
- Store the currently assigned driver.
- Do not store a vehicle registration number.
- Permit capacity and driver changes without changing the passenger roster.
- Prevent more than one running trip for the same route.

### 7.2 Stops and schedules

- Store reusable stop name, latitude, and longitude.
- Store ordered route-stop entries with sequence and scheduled arrival time.
- Validate that timings progress forward.
- Support separate schedule/direction versions if morning and return journeys differ.
- Snapshot the applicable schedule when a trip starts.

### 7.3 Rosters

- Store roster name, academic year, status, creation time, publication time, and version.
- Permit exactly one published roster for the current service period.
- Store student and faculty rows in one roster-entry table.
- Store passenger name, type, bus-pass ID, route, boarding stop, and type-specific identifier/details.
- Do not use a passenger `active` flag. Roster status determines which records are current.
- Preserve compact roster-version metadata and minimal required historical evidence, not full archived passenger details indefinitely.
- Trips retain their version references and necessary immutable operational snapshots; cleanup must not cascade into trip, alert, notification, or audit destruction.

### 7.4 Import

- Provide downloadable CSV and Excel templates.
- Passenger imports upload into a draft only; annual replacement uses the approved workbook as source of truth and never automatically promotes student years.
- Preview parsed values before committing.
- Treat all identifiers as strings and preserve leading zeroes.
- Validate required and conditional fields.
- Detect duplicates within the file and against the draft.
- Detect cross-route stop assignments and over-capacity routes.
- Use a transaction for each confirmed import operation.
- Provide row-numbered errors and downloadable invalid rows.
- Apply file-size, row-count, MIME-type, and rate limits.
- Escape spreadsheet formulas during export.

### 7.5 Export

- One action exports all routes and passengers from the selected roster.
- CSV is a flattened roster with actual columns.
- Excel may contain separate `All Passengers`, `Route Summary`, `Students`, `Faculty`, and `Stops and Timings` sheets.
- The standard roster export does not contain phone numbers.
- No phone/contact export is part of the current standard workflow; any future contact export must be separately authorized, audited, and administrator-only.

Recommended flattened columns:

```text
academic_year
route_number
route_name
route_capacity
passenger_type
passenger_name
bus_pass_id
roll_number
faculty_id
department
year
section
boarding_stop
scheduled_boarding_time
```

### 7.6 Passenger list

- Read only from the published roster or the trip's captured roster version.
- Group entries by the ordered boarding stops.
- Show scheduled time for each stop.
- Show a small student/faculty badge.
- Never return phone numbers.
- Support search and collapsed groups for large rosters.

### 7.7 Trip management

- A trip belongs to one route, authorized driver, roster version, and schedule version captured at start. Master-data changes normally apply to future trips.
- Transfer Active Trip is a separate confirmed, audited administrator action that atomically removes the previous driver's authority and permits the replacement driver to resume. It must handle concurrent GPS and competing transfers safely.
- Only the assigned driver or an admin can start/end it.
- Starting is idempotent and cannot create duplicate running trips.
- Ending before the final stop requires confirmation and creates an admin warning.
- Publish `trip:started`, `trip:update`, `trip:stale`, and `trip:ended` events.

### 7.8 Live tracking

- Authenticate driver Socket.io connections.
- Authorize every GPS event against the driver and active trip.
- Store server receipt time as authoritative.
- Reject or quarantine invalid coordinates, impossible speed, out-of-order points, and suspicious jumps.
- Maintain monotonic route progress unless an explicit correction is made.
- Mark passenger data stale when no valid fix arrives within the configured threshold.
- Reconnect clients and rejoin trip rooms after network interruptions.

## 8. Smart ETA requirements

The MVP uses a transparent, explainable prediction algorithm with no ML or RAG claim. Robust historical segment statistics extend the baseline after real trips are collected; they are not machine learning.

### 8.1 Inputs

- Latest valid GPS fix.
- Recent valid GPS history.
- Ordered stop coordinates.
- Route progress and travel direction.
- Remaining route/segment distance.
- Scheduled times.
- Configurable dwell allowance at intermediate stops.
- Robust historical segment medians, sample counts, and variability when enough real-trip observations exist.
- GPS confidence, stationary/off-route conditions, and reached/passed/skipped stop state.

### 8.2 Calculation behavior

- Use a rolling median/average from the latest clean points, not a single instantaneous speed.
- Reject impossible movement and GPS jitter.
- Measure distance along the route/stop sequence rather than only straight-line distance to the selected stop.
- Widen the estimate when the bus is far away, stationary, stale, or off route.
- Display a range such as `12–16 minutes` and a confidence label.
- Recalculate at a configurable normal interval of approximately 15–30 seconds and sooner on meaningful transitions; include `updatedAt`. Broadcast accepted map positions independently, without waiting for ETA recalculation.
- Recompute from current conditions; never use old ETA minus elapsed time. Operational ETA is not permanently stored on every calculation; optional calibration snapshots have explicit retention.
- Fall back to the scheduled time when a live estimate is unavailable.

### 8.3 Stop states

Every ETA response contains one of:

- `NOT_STARTED`
- `UPCOMING`
- `ARRIVING`
- `AT_STOP`
- `PASSED`
- `POSSIBLY_SKIPPED`
- `OFF_ROUTE`
- `NO_LIVE_DATA`
- `GPS_UNRELIABLE`
- `STALE_LOCATION`
- `NOT_MOVING`
- `ROUTE_COMPLETED`
- `TRIP_ENDED`
- `NO_SCHEDULE`
- `INVALID_STOP`
- `UNKNOWN`

State priority prevents contradictory messages:

1. Trip ended or route completed.
2. Bus currently at the selected stop.
3. Selected stop passed or possibly skipped.
4. GPS missing, unreliable, stale, stationary, or off route.
5. Upcoming live ETA.
6. Published scheduled-time fallback, clearly labelled as non-live.

### 8.4 Passed-stop behavior

If route progress is beyond the selected stop, return no ETA and show:

```text
Bus has already passed this stop.
Passed at approximately 7:28 AM.
```

The system must never return a negative ETA. If progress indicates that the bus passed but a stop event was not confirmed, use `POSSIBLY_SKIPPED` and explain that the bus appears to have passed without a confirmed stop.

### 8.5 Robust historical segment intelligence

Collect adjacent-stop segment travel samples by route/version, direction, weekday, and time window after real trips exist. Use the median as the primary normal baseline, with a documented MAD/IQR or equivalent robust outlier rule, sample count, and variability/confidence; an average may be supplementary. Preserve disruption classifications without letting rare 31-minute incidents dominate an otherwise approximately eight-minute normal segment.

Historical statistics describe normal conditions. Live movement and sustained stationary detection must still reflect a genuine delay happening today. Use sparse-data fallback and confidence handling; do not fabricate historical confidence. Evaluate optional future ML only after sufficient data exists and measured improvement over the explainable baseline is demonstrated. See Sections 22.7–22.10.

## 9. Late-arrival requirements

- The college deadline is configurable; initial value is 9:50 AM.
- The service calendar prevents alerts on holidays and non-operating days.
- A single GPS anomaly cannot trigger an alert.
- Require a configured number of consecutive late evaluations and acceptable confidence.
- Deduplicate notifications per trip.
- Optionally re-alert only after a significant worsening delay.
- Mark a delayed trip as recovered if it returns to schedule.
- Include only student roster entries in class-advisor alerts.
- Include student names and roll numbers grouped by advisor/class.
- Do not infer daily attendance or claim that every listed student boarded.
- Preserve unmatched students and missing-advisor groups for admin action.
- Deliver notifications through an outbox with `PENDING`, `SENT`, and `FAILED` states and retries.
- Preserve the existing late-alert hash-chain evidence. This does not imply that the administrator audit trail is already hash protected.
- Derive routeNo lateness statistics from completed trips' actual college arrival compared with the captured configured deadline; predicted late alerts can recover and are not actual-late counters.

## 10. Data model

Names are conceptual and may use Prisma naming conventions.

### 10.1 `RouteService`

- `id`
- `routeNo` (unique display identifier)
- `name`
- `areaCovered`
- `capacity`
- `driverId` (nullable)
- timestamps

### 10.2 `Stop`

- `id`
- `name`
- `latitude`
- `longitude`

### 10.3 `ScheduleVersion`

- `id`
- `routeServiceId`
- `name`
- `direction`
- `effectiveFrom`
- `status`

### 10.4 `ScheduleStop`

- `id`
- `scheduleVersionId`
- `stopId`
- `sequenceOrder`
- `scheduledTime`

### 10.5 `Driver`

- `id`
- `name`
- `driverCode` (unique login identifier)
- `phone` (admin-only)
- `licenseNo` (admin-only)
- `passwordHash`
- `sessionVersion`
- timestamps

### 10.6 `TransportRoster`

- `id`
- `name`
- `academicYear`
- `status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `version`
- `createdAt`
- `publishedAt`
- optional `createdByAdminId`

### 10.7 `RosterPassenger`

- `id`
- `rosterId`
- `routeServiceId`
- `boardingStopId`
- `passengerType`: `STUDENT`, `FACULTY`
- `name`
- `busPassId`
- `rollNo` (student only)
- `facultyId` (faculty only)
- `department`
- `year`
- `section`

### 10.8 `ClassAdvisor`

- `id`
- `name`
- `phone` (admin-only)
- `email` (admin-only)
- `department`
- `year`
- `section`

### 10.9 `Trip`

- `id`
- `routeServiceId`
- `driverId`
- `rosterId`
- `scheduleVersionId`
- `date`
- `startTime`
- `endTime`
- `status`: `SCHEDULED`, `RUNNING`, `COMPLETED`, `CANCELLED`
- `currentStopIndex`

### 10.10 `LiveLocation`

- `id`
- `tripId`
- `latitude`
- `longitude`
- `deviceTimestamp` (diagnostic)
- `receivedAt` (authoritative)
- `acceptedForEta`
- `rejectionReason`

### 10.11 `TripStopEvent`

- `id`
- `tripId`
- `scheduleStopId`
- `status`: `REACHED`, `PASSED`, `POSSIBLY_SKIPPED`
- `detectedAt`
- location snapshot

### 10.12 `LateAlert`

- `id`
- `tripId`
- `predictedEta`
- `status`
- `triggeredAt`
- student/advisor snapshot data
- optional hash-chain fields

### 10.13 `NotificationOutbox`

- `id`
- `lateAlertId`
- recipient
- channel
- payload snapshot
- status
- attempts
- lastError
- sentAt

### 10.14 `AdminAuditLog`

- `id`
- admin identifier
- action
- entity type and ID
- safe before/after summary
- timestamp

### 10.15 `AdminSession`

- opaque UUID session ID
- administrator identifier
- expiry timestamp
- optional revocation timestamp and bounded reason
- creation timestamp

The signed administrator JWT is transported in an HttpOnly, SameSite cookie in the browser; the database stores no bearer token, password, browser fingerprint, or IP address.

### 10.16 `RateLimitBucket`

- SHA-256-hashed limiter/client key; no raw IP or identifier
- hit count
- reset timestamp
- update timestamp

The table shares failed-login and roster-import counters across backend instances. Expired buckets are eligible for scheduled retention cleanup.

## 11. API and real-time boundaries

### 11.1 Admin APIs

Authenticated admin-only CRUD and workflows for routes, stops, schedules, capacity, drivers, advisors, rosters, roster entries, imports, exports, publication, alert/delivery review and retry, operational health, audit history, and administrator-session review/revocation. Browser authentication uses an HttpOnly/SameSite cookie; cookie-authenticated mutations also require the CSRF-protection header.

### 11.2 Driver APIs

- Login with driver code and password.
- Get assigned route.
- Start own route's trip.
- End own trip.
- Resume own running trip.

### 11.3 Passenger APIs

Return sanitized DTOs only:

- List/select current route services.
- Route details and ordered schedule.
- Published passenger roster grouped by stop.
- Active trip and sanitized latest location.
- ETA for a selected stop.

No passenger API returns phone numbers, roll numbers, faculty IDs, bus-pass IDs, password/auth fields, internal audit data, notification recipients, or private admin fields.

### 11.4 Socket.io events

Driver to server:

- `driver:location`

Passenger/admin to server:

- `join:trip`

Server to clients:

- `trip:started`
- `bus:update`
- `trip:stale`
- `trip:recovered`
- `trip:ended`

Every event is scoped to a trip/route room. Driver events require JWT authentication, active driver session version, running-trip ownership, payload validation, replay protection, and burst limiting.

### 11.5 Versioning and health

- Stable HTTP base: `/api/v1`.
- Unversioned aliases remain temporarily for compatibility.
- Responses include `X-API-Version: 1` and a correlation/request ID.
- `/health` checks process liveness.
- `/health/ready` verifies PostgreSQL connectivity.
- `/api/v1/operations/summary` is administrator-only and exposes privacy-safe running/stale trip, alert, notification, and session counts.

## 12. Privacy and security requirements

- Phone numbers are admin-only in database queries, APIs, exports, logs, and UI.
- Never rely on frontend hiding for privacy.
- Production uses HTTPS/WSS.
- Production refuses insecure/default JWT secrets.
- Passwords are hashed by the backend; hashes are never sent to clients.
- Apply rate limits to login, public roster, ETA, import, and export endpoints.
- Restrict production CORS origins.
- Validate all input server-side.
- Authenticate and authorize Socket.io.
- Provide driver session revocation and password reset.
- Avoid personal data in logs.
- Protect exports and audit export actions.
- Back up the database and test restoration.

## 13. Failure-mode requirements and fixes

The following scenarios are mandatory design and acceptance-test inputs.

### 13.1 Roster/import failures

1. **Wrong spreadsheet columns:** reject before staging and show missing/unknown columns.
2. **Leading zeroes removed:** parse identifiers as strings and preview exact stored values.
3. **Duplicate bus-pass IDs:** block validation and identify both rows.
4. **Duplicate roll/faculty IDs:** block validation; never use names as identity.
5. **Passenger assigned to two routes:** block unless a future explicit multi-route rule exists.
6. **Student missing academic fields:** reject the row.
7. **Faculty contains invalid student-only fields:** enforce conditional type validation.
8. **Stop not on route:** block publication.
9. **Assigned count exceeds capacity:** show overage and block or require explicit authorized override.
10. **Replacement bus has smaller capacity:** revalidate published allocation and warn admins.
11. **Import crashes halfway:** use staging and a transaction.
12. **Wrong academic year:** show the target roster prominently and require confirmation.
13. **Unfinished draft publication:** require validation, comparison, backup, and confirmation.
14. **Two admins publish together:** use optimistic versioning and a transaction.
15. **Roster published during trip:** trip continues with its captured roster.
16. **Local export lost:** confirm outgoing Excel download before replacement; after full-roster cleanup, recovery depends on an authorized export/backup within its retention window, not indefinite online archives.
17. **CSV formula injection:** escape formula prefixes on export.
18. **Very large file:** stream processing and enforce file/row limits.
19. **Bad characters/encoding:** require UTF-8 or normalize supported Excel input and preview it.
20. **Rollback required:** validate and re-import the outgoing workbook as a new draft/version; retained metadata alone cannot reconstruct purged passenger details.

### 13.2 Admin failures

21. **Route deleted accidentally:** archive or block while related records exist.
22. **Published passenger edited accidentally:** create a revision draft rather than silent live mutation.
23. **Wrong stop coordinates:** require map preview/confirmation.
24. **Duplicate stop names:** display locality/landmark and use IDs internally.
25. **Times out of order:** block schedule publication.
26. **Driver password mishandled:** hash server-side from a temporary password.
27. **Session expires mid-edit:** autosave draft work and restore after login.
28. **Sensitive export:** separate standard roster and explicit private-contact exports.
29. **Unknown change author:** record admin audit logs.
30. **UI silently substitutes fake data:** display real load errors and never invent fallback records.

### 13.3 Security/privacy failures

31. **Phone leaked in API:** use role-specific explicit field allowlists.
32. **Public roster scraped:** use no-account route access/bus-pass validation plus rate limits; mask IDs if required.
33. **Driver accesses another route:** enforce ownership in every request.
34. **Fake Socket.io GPS:** authenticate socket and authorize trip ownership.
35. **Password guessing:** rate-limit and temporarily lock repeated failures.
36. **Default JWT secret:** fail production startup.
37. **Lost driver phone:** revoke sessions and reset password.
38. **Former driver token:** validate driver/session status on sensitive actions.
39. **PII logged:** log IDs/counts, not roster/contact payloads.
40. **XSS steals admin token:** use strong CSP, safe rendering, and preferably secure HttpOnly cookie auth for admin production.

### 13.4 Driver/trip failures

41. **Driver forgets start:** scheduled reminder and admin `not started` status.
42. **Trip started early:** show early-start state or enforce a configured window.
43. **Duplicate start:** database/API uniqueness for one running trip per route.
44. **Two drivers claim route:** only assigned driver; admin-controlled transfer.
45. **Driver forgets end:** final-stop prompt and configured auto-completion/admin warning.
46. **End before college:** require confirmation and create admin warning.
47. **Location permission denied:** block start and guide settings correction.
48. **Background permission missing:** preflight check before start.
49. **Battery optimization kills tracking:** foreground service and driver guidance.
50. **Internet loss:** bounded local queue, stale passenger state, timestamped replay.
51. **Duplicate GPS timers:** one managed subscription/timer, cancelled on end/restart.
52. **Wrong device clock:** server receipt time is authoritative.
53. **Mocked GPS:** flag OS indicators and impossible movement.
54. **App/phone restarts:** offer resume for the driver's own running trip.
55. **Low battery:** warn driver/admin before tracking fails.

### 13.5 Passenger failures

56. **Wrong route selected:** show route areas/stops before confirmation and allow easy change.
57. **Saved route archived:** validate on startup and require reselection.
58. **Refresh abuse:** cache static data, throttle refresh, use sockets for live data.
59. **Outdated app/API mismatch:** version APIs and enforce minimum app version gracefully.
60. **Backend offline:** show cached schedule with an offline warning.
61. **Map tiles unavailable:** keep timeline and textual status functional.
62. **Large roster slow:** group/collapse by stop and support search/filter.
63. **Incorrect passenger data:** admin correction workflow and optional report action.
64. **Trip ends while open:** broadcast end and remove live ETA/marker state.
65. **Slow connection:** skeleton/loading states, bounded retries, no duplicate requests.

### 13.6 ETA/route-progress failures

66. **Selected stop passed:** return `PASSED`, no ETA, and approximate pass time.
67. **Bus misses geofence:** use route progress/direction in addition to radius.
68. **Bus close on parallel road/flyover:** map-match and require consecutive confirmation.
69. **Nearby stops:** use sequence, heading, direction, and previous progress.
70. **Route crosses itself:** enforce progress continuity.
71. **GPS jump:** reject impossible speed/acceleration.
72. **Bus stationary:** retain last good basis, widen range, lower confidence.
73. **Diversion/off route:** return `OFF_ROUTE` until progress becomes reliable.
74. **ETA oscillation:** smooth speed and show ranges.
75. **No GPS:** return `NO_LIVE_DATA` with scheduled fallback.
76. **Bus at stop:** return `AT_STOP`, not indefinite zero minutes.
77. **College already reached:** return recorded arrival and `TRIP_ENDED`/destination state.
78. **Out-of-order point:** ignore for live position; optionally retain diagnostically.
79. **Bus reverses:** do not roll progress backwards automatically; flag direction anomaly.
80. **Stop possibly skipped:** return `POSSIBLY_SKIPPED` with honest wording.

### 13.7 Late-alert failures

81. **GPS anomaly causes false alert:** require consecutive confident predictions.
82. **Repeated spam:** trip-level state, cooldown, and worsening threshold.
83. **Bus recovers:** mark recovered and optionally send one resolution.
84. **Missing advisor:** retain unresolved group and warn admin.
85. **Wrong advisor mapping:** coverage validation before roster publication.
86. **Student lacks grouping:** retain under unmatched students.
87. **Notification fails:** outbox status, retry, and admin visibility.
88. **Holiday/weekend:** service calendar disables alerts.
89. **Wrong timezone:** explicit Asia/Kolkata business time and UTC storage.
90. **Faculty included:** filter alerts to `STUDENT` only.

### 13.8 Backend/operations failures

91. **Database unavailable:** retry transient work and expose system health.
92. **Server restart:** rebuild running-trip state from persisted data and reconnect clients.
93. **Concurrent stop updates:** transaction/compare-and-set current progress.
94. **Socket room cross-talk:** trip-scoped rooms and simultaneous-trip tests.
95. **Location table growth:** retention/downsampling policy.
96. **Migration failure:** backup, rehearsal, atomic deployment, rollback plan.
97. **Cascading historical deletion:** preserve minimal immutable evidence and restrictive relations before deleting old full-roster rows.
98. **Hosting sleep/disconnection:** continuous pilot hosting or robust wake/reconnect behavior.
99. **No HTTPS:** refuse insecure production transport.
100. **Hardcoded backend URL:** environment-specific builds.
101. **Driver absent:** admin transfer invalidates prior trip control.
102. **Poor network corridor:** stale status, local queue, reconnection.
103. **Road closure:** versioned schedule/route update; running-trip snapshot remains stable.
104. **Morning/return paths differ:** separate direction/schedule versions.
105. **Deadline changes:** admin configuration, not source constant.
106. **Failures unmonitored:** admin health dashboard and alerts.
107. **Bad deployment:** versioned release and tested rollback.
108. **No source history:** initialize Git and commit each verified phase.
109. **Only fake testing:** real-device, poor-network, screen-lock, and real-route pilot.
110. **Backups cannot restore:** scheduled restoration drills, not backup creation alone.

## 14. Admin screens

- Login
- System/route summary dashboard
- Route services and capacity
- Stops
- Schedule versions and stop ordering
- Drivers
- Class advisors and coverage
- Current/draft rosters and compact archived version metadata (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- Draft roster editor
- Import preview/errors
- Publish comparison/confirmation
- Exports
- Running trips and GPS health
- Delayed routes and notification status
- Audit log
- Operations centre for running/stale trips, active alerts, pending/failed notifications, and active sessions
- Administrator-session list with individual and revoke-all controls
- Driver Excel import and safe deactivation; explicit active-trip transfer
- Google Maps stop/route preview and published route geometry
- Actual route lateness analytics
- Feedback management
- High-priority emergencies, confirmation, assistance assignment, and incident map

This is the required React + Vite website scope; new screen work is deferred until the backend gate.

## 15. Passenger screens

- Shared role-selection landing screen with two prominent avatar/tiles: `Passenger` and `Driver`
- Route selection
- Route details summary
- Passenger list grouped by stop
- Track Bus button and live tracking map
- Stop timeline
- Stop-selection ETA sheet/page
- Offline/stale/error states
- Route-number search, Bus Stop Near Me, and locally saved My Route
- Full Route on Google Maps and passenger-safe Bus Info
- Optional Notify Me push thresholds
- Feedback and unverified passenger Emergency reporting

Passenger route details show driver name but no driver phone number.

## 16. Driver screens

- Shared role-selection landing screen; the `Driver` avatar/tile opens driver login
- Login
- Assigned-route summary
- Permission/readiness check
- Start trip
- Running-trip GPS/connection/queue status
- Foreground/background permission explanation and persistent Android tracking notification
- Bounded offline queue status, ordered retry, and dropped-sample warning
- End trip confirmation that flushes/stops tracking
- Resume interrupted trip
- Receive an authorized active-trip transfer
- Report/confirm own-trip emergencies; receive background push
- Safely stopped assistance ACCEPT/DECLINE and incident/directions view

No scanner, QR, passenger phone, or attendance UI is included.

## 17. Non-functional requirements

- Support at least 31 simultaneous route services and their passenger viewers.
- Ship one combined Passenger + Driver Android app. The separately hosted React administrator website is not bundled into the mobile binary.
- Production size target: a fresh Google Play device-specific installation should remain below 100 MB on representative supported Android devices. Treat universal/internal/development APK size as diagnostic only; use the production AAB and Google Play App Size report for acceptance.
- Target the optimized production download at approximately 25–50 MB and normal application data below approximately 10 MB before optional map cache. Set bounded eviction for map and network caches so ordinary use does not create uncontrolled storage growth.
- Measure size after Google Maps, location, push and release minification are integrated. Remove unused native dependencies and production development-client code where safe; do not reduce required GPS reliability, security, accessibility or offline behavior merely to meet the size target.
- Live updates should normally appear within seconds of a valid driver fix.
- Static route/roster reads should be cached where safe.
- Admin imports must handle the college's full annual roster without browser freezing.
- APIs return structured, user-safe errors.
- Accessibility: readable contrast, scalable text, and timeline usable without a map.
- Observability: health checks, structured logs, stale-trip monitoring, and notification status.
- Data protection: least-privilege responses, secure secrets, backups, and auditability.
- Production browser authentication: HttpOnly/Secure/SameSite cookie, CSRF-protection header, restricted CORS, and immediate database-session revocation.
- Multi-instance controls: PostgreSQL-shared rate limits and an exact reviewed reverse-proxy hop count.
- Configure and schedule bounded raw GPS/rejected-diagnostic retention and cleanup after required derived evidence is secured. Keep current master data, compact operational history, and temporary high-volume data in separate retention categories. The existing maintenance script only cleans rate-limit buckets and inactive admin sessions; GPS/roster policies still require implementation.

## 18. Revised delivery order and preserved baseline

The August release candidate established requirements/privacy, PostgreSQL migrations, initial client/API integration, annual roster exchange, trip/GPS/ETA handling, late-alert outbox delivery, security/recovery, and administrator/mobile client foundations. Those assets are retained. Their old phase-complete labels do not establish completion of the September requirements.

The active plan is Section 24: baseline regression protection → hosted database readiness → snapshots/audit → roster and driver workflows → route geometry/discovery → GPS/ETA/retention → historical statistics and actual lateness → push → feedback/emergencies/assistance → complete backend acceptance → deferred frontend integration → field pilot. Preserve compatible v1 responses and existing clients while adding the revised contracts.

No frontend redesign, new mobile screens, or administrator UI implementation belongs to the present backend work. API fixtures, simulated devices, worker tests, provider contract checks, and integration scripts are used to finish the backend workflow first.

## 19. Definition of done

### 19.1 Existing baseline acceptance — retained regression requirements

- Existing roster draft/import/preview/validate/export/publication behavior must remain operational while annual purge/replacement is added.
- Passenger views switch to the newly published roster and sanitized APIs do not leak private identifiers or phone numbers.
- Drivers can start, stream, resume, and end only their assigned trip; two routes do not exchange live events.
- ETA returns explicit upcoming, at-stop, passed, skipped, stale, off-route, not-moving, route-completed, and ended states without negative values.
- Late trips produce assigned-student/advisor evidence and recoverable notification rows without attendance claims or ordinary duplicate processing.
- Imports, migrations, backup/restore, security controls, load limits, session revocation, API privacy, and failure modes have automated/documented local evidence.
- Existing administrator/mobile compatibility must be preserved. Historical build results are not revalidated in this documentation change.

The revised backend is complete only when every Phase B1–B9 acceptance gate in Section 24 passes, with explicit evidence and no newly required backend workflow left as a stub. The full product additionally requires the deferred frontend and field gates.

### 19.2 Production/pilot acceptance — pending

The real production MVP is not complete until:

- college transport staff approve real routes, coordinates, capacities, timings, drivers, advisors, and annual passengers;
- HTTPS/WSS hosting, managed secrets, restricted runtime database identity, monitoring, backups, and restore ownership are operational;
- real SMTP delivery and failure recovery are tested with authorized recipients;
- target browsers pass responsive, keyboard, contrast, loading/error/offline, and privacy review;
- at least one real Android device succeeds with screen lock and variable network conditions;
- real-road ETA ranges and reached/skipped/off-route thresholds are calibrated; and
- at least one supervised route pilot succeeds without private-data leakage, false attendance claims, cross-route updates, or unrecoverable delivery failures.

## 20. Prototype deployment plan

`React + Vite admin website on Vercel → HTTPS API proxy → persistent Node.js + Express + Socket.IO + Node workers → Prisma → Supabase PostgreSQL`.

`React Native + Expo passenger/driver Android clients → direct HTTPS/WSS backend`. Google Maps provides map rendering and required directions. SMTP serves class-advisor email; Expo/native infrastructure serves mobile push.

- Keep the backend and workers on a persistent Node host supporting long-lived sockets; hosting/provider activation is external configuration, not evidence of an implemented deployment.
- Preserve same-origin admin API proxying and secure HttpOnly/SameSite cookies, CSRF checks, strict CORS, role checks, and revocation.
- Configure database connectivity, migrations, runtime privileges, backup/restore, HTTPS/WSS, monitoring, and secret rotation before pilot release. Supabase hosting must not create a public direct route to private application tables.
- Store database credentials, SMTP credentials, JWT secrets, private Google Maps credentials, and push-provider secrets only in environment/secret configuration; never commit or return them to clients.
- Begin with approved synthetic demo data and explicitly simulated email/push delivery. Real provider verification remains required for production acceptance.
- Publish/integrate the new frontends only after the backend gate. Test native GPS and push with development Android builds before pilot rollout.
- Prototype ETA remains an experimental estimate with confidence and stale/offline states, not guaranteed arrival.

## 21. Abstract-preparation summary

This section gives a teammate the facts needed to write an academic abstract without reading implementation logs.

### Problem

College passengers depend on fixed bus schedules even when traffic, delays, route deviation, weak GPS, or network loss changes actual arrival time. Class advisors also need timely information about students assigned to a late bus, but a transport system must not falsely claim boarding attendance.

### Proposed solution

A role-aware college bus tracking platform combines a single Passenger + Driver mobile app, a no-login passenger dashboard, authenticated driver GPS workflow, separately hosted administrator website, PostgreSQL data model, live Socket.IO updates, explainable stop-level ETA ranges, annual Student/Faculty roster management, and automatic late-route advisor notifications based on assigned students rather than QR scans or attendance.

### Methodology and architecture

- React Native/Expo for passenger and driver experiences.
- React/Vite for transport administration.
- Node.js/Express, Socket.IO, Zod, JWT/cookies, and background workers for API/realtime/business logic.
- Supabase-managed PostgreSQL with Prisma migrations for versioned schedules, current annual rosters, trips, retained derived evidence, alerts, outbox, sessions, audit, and rate limits.
- Google Maps rendering separated from backend geospatial progress and rolling-speed ETA; robust historical segment medians follow real data collection. No RAG or current ML claim.
- SMTP advisor email, Expo/native mobile push, and Node.js notification workers.
- Privacy-by-design boundaries: no passenger accounts, no QR attendance, no public phone/roll/faculty/bus-pass identifiers, administrator-only contacts, auditable sensitive changes, and revocable authentication.

### Main contribution

The project treats reliability and honesty as core features: a passed stop never produces negative ETA; stale/off-route/unreliable GPS is shown explicitly; offline driver samples are bounded and replayed with device timestamps; late alerts use assigned rosters without inferring presence; and administrator roster replacement is previewed, validated, atomic, versioned, exportable, and recoverable.

### Current result

The existing repository provides a release-candidate foundation and passes 59 backend tests in this revision. The expanded September requirements remain partially unimplemented; Section 23 identifies the actual gaps. Backend work precedes new frontend work. Supabase deployment, Google Maps integration, real notifications, device/road calibration, and supervised pilot acceptance must not be described as completed results.

### Suggested keywords

College bus tracking, React Native, PostgreSQL, Socket.IO, GPS, estimated time of arrival, transport management, annual passenger roster, late-bus alert, privacy, offline queue, real-time system.

## 22. Finalized feature and workflow specifications

The following finalized requirements are retained in full to avoid losing workflow details. They define target behavior, not implementation status. The repository audit in Section 23 implements the supplied implementation-status rule. All UI behavior below is planned for the deferred frontend phase; its backend contracts and business workflows belong to the current scope.

### 22.1 Core architecture

Use:

One combined React Native + Expo + TypeScript Android application for the passenger and driver mobile experiences. The first screen contains two avatar/tile choices labelled Passenger and Driver. Passenger opens the no-login passenger dashboard; Driver opens the authenticated driver login.

React + Vite for the administrator WEB PANEL. The administrator interface is a website, not a mobile application.

Node.js + Express for backend APIs and business logic.

Socket.IO/WebSockets for live trip/location communication.

Prisma as ORM.

Supabase-managed PostgreSQL as the hosted PostgreSQL database.

Google Maps for maps, route display and location-related map functionality.

Node.js background workers for notification processing.

SMTP email for class-advisor late-bus notifications.

Expo Push Notifications / native Android push infrastructure for passenger and driver mobile notifications.

Do NOT introduce RAG.

Do NOT claim that the current ETA system uses machine learning.

Supabase is being used primarily as managed PostgreSQL. Do NOT replace Express, Prisma, Socket.IO, existing authentication or workers with Supabase services unless separately requested.

Architecture:

```text
Combined React Native Passenger + Driver App
Separately hosted React Admin Website
|
HTTPS / WSS
|
Node.js + Express
|
-----------------
|               |
Socket.IO      Business Logic
|
Prisma
|
Supabase PostgreSQL
```

Map rendering/location UI:
Google Maps

### 22.2 GPS update strategy

Do NOT use a single fixed 5-second GPS transmission interval.

Use an adaptive/configurable strategy.

Suggested behaviour:

Moving normally:
send approximately every 10–15 seconds.

Approaching a stop, leaving a stop, unusual movement, route transition or other location-sensitive situation:
approximately every 5–10 seconds where useful.

Stationary for a sustained period:
reduce transmission to approximately every 30 seconds.

Trip start, trip end, reconnect, recovery and important state transitions:
send immediately.

All thresholds must be configurable rather than permanently hardcoded.

The driver app may collect device-location samples more frequently locally than it transmits to the backend if that improves motion detection without unnecessarily increasing network/server traffic.

### 22.3 Server-load strategy

Do not describe every Socket.IO location event as a new HTTP request.

Driver devices maintain persistent Socket.IO/WebSocket connections.

At a 10-second interval:

31 buses × 6 messages/minute = 186 inbound location events/minute.

That is approximately 3.1 incoming driver-location events/second.

At 15 seconds:

31 buses × 4 messages/minute = 124/minute.

That is approximately 2.1 incoming events/second.

This is acceptable for the intended architecture.

However, continue to minimise unnecessary broadcasts.

Only users subscribed to the relevant active trip/route room should receive its bus updates.

Do not broadcast every route's coordinates to every passenger.

### 22.4 Passenger live-map behaviour

The live bus location should update automatically.

Do NOT make manual Refresh the primary tracking mechanism.

When a valid GPS point is accepted by the backend:

Driver
→ backend
→ GPS validation
→ route progress
→ Socket.IO trip room
→ connected passenger/admin clients
→ Google Maps marker position update

Provide a Refresh button only as a fallback.

Refresh should request/re-render the latest server-known position. It does not force the driver's phone to immediately generate a new GPS point.

Show:

Last updated: X seconds ago

and appropriate stale/offline states.

### 22.5 Google Maps

Use Google Maps as the mapping platform.

Google Maps features required:

live bus marker
stop markers
route display
Full Route view
nearest-stop result visualization
admin stop/map preview
incident/emergency map visualization
navigation/directions where required

Do not couple ETA calculation directly to Google Maps rendering.

The backend remains authoritative for route progress, ETA and stop states.

For the Full Route feature, avoid requesting/recalculating the same route geometry every time a passenger opens the page.

Generate/cache/persist the route polyline/geometry associated with a published route version where practical.

When the route is edited/published, update the route geometry.

Then passenger clients can render the stored published route on Google Maps.

### 22.6 GPS validation

Continue validating:

coordinates
accuracy
impossible movement
speed
suspicious jumps
old/out-of-order points
replay
device timestamp
server receipt timestamp
driver identity
assigned route
active-trip ownership
off-route movement

Rejected GPS points must never move the public map marker or affect normal ETA.

### 22.7 ETA engine

The current ETA engine remains explainable and non-ML.

Inputs should include:

latest valid GPS
recent clean movement history
rolling speed
route progress
remaining route distance
stop order
direction
scheduled times
stop dwell allowance
GPS confidence
stationary state
off-route state
passed/reached/skipped state

Do NOT implement:

ETA = old ETA minus elapsed time.

ETA must be recalculated from current conditions.

Example:

Initial:
ETA 5 minutes.

Traffic becomes worse:
ETA may become 6–7 minutes.

Bus progresses quickly:
ETA may become 3–4 minutes.

Near stop:
ARRIVING.

At stop:
AT_STOP.

Passed:
PASSED with no negative ETA.

### 22.8 ETA recalculation frequency

ETA calculation and live-map updates are separate concerns.

GPS may arrive every approximately 10–15 seconds under normal movement.

ETA should be recalculated at a configurable throttled interval, approximately 15–30 seconds under normal conditions.

Recalculate sooner on meaningful state transitions where required.

Do not permanently store every calculated ETA.

The live ETA is operational data.

Optional ETA snapshots may be retained during testing/calibration to compare predicted ETA with actual arrival time.

### 22.9 Historical segment travel-time intelligence

After real trips have been collected, maintain historical travel statistics between adjacent route stops.

Example:

Route 12
Stop A → Stop B
Monday
08:00–08:30
Median: 8.1 minutes
Sample count: 24

Store useful aggregate information such as:

route
fromStop
toStop
weekday
time window
median travel time
average travel time if useful
sample count
variability/confidence

Do not use a plain average as the primary baseline because abnormal events can distort it.

Use robust statistical methods such as median and an outlier-detection rule such as MAD/IQR or another documented robust method.

Example historical samples:

8
8.4
7.9
8.2
31
8.1

A one-time 31-minute delay caused by a rally, accident, unusual traffic or road closure must be recorded as an abnormal observation but should not significantly increase the normal baseline.

Classify exceptional segment runs as disruption/outlier samples when appropriate.

Historical baseline answers:

"What normally happens on this segment?"

Live GPS answers:

"What is happening right now?"

If TODAY the bus is genuinely stuck for 30 minutes, the current ETA must reflect that using live movement/stationary detection even though that abnormal trip should not heavily affect future normal historical averages.

Future ML may only be introduced after enough historical data exists and after evaluation proves that it performs better than the explainable baseline.

Do not call this RAG.

### 22.10 GPS storage and retention

Do not permanently store every high-frequency GPS point forever.

Raw location data is temporary/high-volume operational data.

It is required for:

recent movement
ETA
route progress
stop detection
anomaly detection
reconnection
debugging
pilot calibration

Implement configurable raw GPS retention.

After the raw-data retention period:

delete it or downsample it according to policy.

Preserve long-term useful derived information rather than millions of raw coordinates.

Examples of long-term data:

trip start
trip end
route
driver
final college arrival
stop arrival/pass events
actual late result
late alert
notification outcome
segment travel statistics
important operational evidence

### 22.11 Old annual passenger data and database storage

The new academic-year passenger file becomes the only ACTIVE operational passenger roster.

Before annual replacement:

allow admin to export/download the complete outgoing roster as Excel.

After successful validation, confirmation and replacement:

remove the old full passenger roster from active operations.

The database does NOT need to retain the complete previous-year passenger roster indefinitely merely for archival purposes.

Avoid storing unnecessary old student/faculty data that increases storage and privacy exposure.

However, deleting an old roster must NOT destroy minimal historical evidence required for previously completed operations.

Past trip records may retain only the minimum information required for:

trip history
late statistics
stop timings
late-alert evidence
notifications
auditability

Do not retain complete old passenger details simply because a trip existed.

Where past late alerts legally/functionally require the affected-student/advisor snapshot, retain only the required immutable snapshot.

Design historical records so deletion of an old annual roster does not cascade into destruction of important trip/alert/audit history.

### 22.12 Annual passenger Excel replacement

Passenger data changes each academic year.

The administrator uploads a new approved Excel workbook containing current Student and Faculty information.

The annual Excel file is the source of truth.

Do NOT automatically perform:

student.year = student.year + 1

because students may:

graduate
leave
change section
change department
repeat
change route
change stop

and new students join.

Import should support fields such as:

passenger type
name
bus pass ID
roll number
faculty ID
department
year
section
route number
boarding stop
other required fields

Workflow:

export current roster
upload new workbook
parse without writing
validate
preview changes
show errors
show additions
show removals
show changed route
show changed stop
show academic changes
show capacity problems
confirm
perform atomic replacement
make new roster current

### 22.13 Annual Driver Excel import

Provide a separate Driver Excel template/import.

Use it to update annual/bulk driver information and route assignments without manually editing every driver.

Fields can include:

route number
driver code
driver name
phone
license number
other approved fields

Never store plaintext passwords in Excel.

Import workflow:

upload
preview
validate
compare
confirm
atomic update

Existing matching drivers should update.

New drivers may be created.

Removed drivers should be safely deactivated/unassigned according to historical requirements.

### 22.14 Manual admin editing remains available

Excel import is NOT the only way to modify data.

The administrator website must permit authorised manual changes at any time.

Admin can manually:

add driver
edit driver
deactivate driver
change driver assignment
add/edit route
change capacity
change stop
change stop coordinates
change route geometry
change schedule
change advisor
correct passenger information
perform other authorised transport-management operations

This is important because drivers/routes/stops may change in the middle of an academic year.

### 22.15 Driver changes during an active trip

A route's assigned driver may change.

Changing normal master data should normally affect future trips.

A running trip keeps the route/schedule/roster snapshot captured at start.

If an administrator needs to transfer control of an ACTIVE trip to another driver, create an explicit:

Transfer Active Trip

workflow.

It should:

require admin confirmation
audit the transfer
invalidate the previous driver's authority over that trip
authorise the new driver
allow the new driver to resume tracking

Do not silently change running-trip ownership simply because the master driver assignment was edited.

### 22.16 Authentication

No public signup pages.

Passenger:
no account/no login.

Driver:
no self-signup.

Only administrators create/manage driver access.

Admin:
no public signup.

Administrator accounts are privately provisioned.

Maintain secure:

password hashing
sessions
revocation
JWT/session validation
HttpOnly/SameSite admin cookies
CSRF protection
CORS
role authorization

### 22.17 Admin audit trail

Create a chronological, append-only audit trail for important administrative and security actions.

Audit trail does NOT mean logging every system event.

Do NOT audit:

every GPS point
every map update
every ETA recalculation
every ordinary stop arrival

Those belong in operational/trip records if needed.

Audit important actions such as:

driver created
driver changed
driver deactivated
driver assignment changed
active trip transferred
route created/changed
stop coordinates changed
schedule published
capacity changed
roster import
roster replacement
roster export
driver import
advisor change
sensitive export
late-alert manual action
notification retry
emergency confirmation
emergency assistance assignment
admin session revocation
security-sensitive configuration change

Store a compact privacy-safe record containing:

event type
timestamp
administrator identifier
target entity/type
safe before/after summary
correlation/reference ID where useful

Do not store huge workbook contents or unnecessary personal information inside the audit table.

The application must expose NO edit or delete operation for audit events.

Where feasible, database permissions should prevent the application runtime role from UPDATE/DELETE on audit rows.

Add tamper-evident chaining/hash protection for important audit records if practical.

Therefore the audit timeline is append-only/tamper-evident from the application's perspective.

### 22.18 Route lateness statistics

Track actual lateness per route.

Because routeNo is the operational bus identity, statistics belong to routeNo.

Distinguish:

Predicted delay

from:

Actual late arrival.

A predicted late alert can recover.

Therefore:

"How many times did this bus come late?"

must be calculated primarily from ACTUAL completed trip arrival time compared with the configured college deadline.

Admin should see:

completed trips
actual late trips
late percentage
recent late history
average/median actual delay if useful

Example:

Route 12
Completed trips: 82
Actual late: 11
Late rate: 13.4%

Do not maintain a manually incremented counter when it can be reliably derived from Trip history.

### 22.19 Class-advisor notifications

For the MVP, class-advisor delayed-bus notification channel is EMAIL through SMTP.

Flow:

late condition confirmed
→ LateAlert
→ NotificationOutbox
→ background worker
→ SMTP
→ advisor email

Keep:

idempotency
retry
PENDING/SENT/FAILED
delivery history
failure visibility
admin retry

Do not claim SMS/WhatsApp is currently implemented.

The notification-provider design may remain extensible so SMS/WhatsApp could be added later.

### 22.20 Passenger stop-arrival notifications

Add an optional passenger feature:

"Notify Me"

Passenger chooses:

route
stop
desired notification thresholds

Suggested options:

10 minutes
5 minutes
1 minute

or allow the passenger to select one or more.

Passengers do not need an account.

Store only a device notification subscription/push token and required route/stop preferences.

Do not store unnecessary passenger identity.

Use mobile push notifications, not SMS/email.

Use Expo/native push notifications.

Each selected threshold should trigger at most ONCE for the relevant trip.

Deduplicate notifications.

Example:

Notify at 10 minutes
Notify at 5 minutes
Notify at 1 minute

Maximum three notifications for that configured trip/approach.

If ETA suddenly jumps from 12 minutes to 4 minutes, avoid sending multiple stale alerts simultaneously. Send the most relevant current notification and mark already-crossed thresholds appropriately.

If ETA becomes unreliable/stale/off-route, do not send a false "bus arriving" alert until confidence returns.

### 22.21 Bus Stop Near Me

Add home-page feature:

Bus Stop Near Me

On explicit user action:

request passenger device location permission.

Use current device location to find the nearest college bus stops.

Do NOT permanently store the passenger's location.

Compare passenger coordinates with the college's stored stop coordinates.

Use a simple geographic-distance calculation locally/backend or an appropriate spatial query.

Google Maps displays the result.

Show preferably:

nearest stops
distance
route number(s)
stop name
scheduled time where applicable

Allow user to select the route/stop.

Do not call Google Maps Nearby search for every request if the college stops are already stored in our database and can be compared efficiently.

### 22.22 Home route search

Add a route-number search on the passenger home screen.

User can enter/select:

Route 1
Route 12
etc.

Results should show enough information to distinguish the route:

route number
areas served
major stops
current trip state if applicable

### 22.23 My Route

Add passenger section:

My Route

Allow the passenger to select/save a preferred route locally on their device.

No passenger account is required.

The UI should show a vertical timeline:

```text
● Stop A     7:15 AM
│
● Stop B     7:30 AM
│
● Stop C     7:45 AM
│
● College    9:30 AM
```

These are PUBLISHED FIXED SCHEDULE TIMES.

They are NOT live ETA values.

Clearly distinguish:

Scheduled time

from:

Live ETA.

### 22.24 Full Route

Add:

Full Route

Display the entire selected bus route on Google Maps.

Show:

highlighted route/polyline
ordered bus stops
college destination
current bus location when active

Use cached/published route geometry where possible rather than recalculating the full route for every viewer.

### 22.25 Bus Info

Add:

Bus Info

Show passenger-safe information such as:

route number
areas covered
driver name
capacity
assigned passenger count
schedule/trip status

Do NOT expose:

driver phone
license number
private identifiers
physical registration plate if the current product continues using routeNo as its operational bus identity

### 22.26 Feedback

Add a Feedback option in passenger navigation.

Suggested categories:

Driver Behaviour
Driving
Bus Condition
Route/Stop Issue
Schedule Issue
App Issue
Other

Allow:

category
route number
optional trip reference
short description
optional additional information

Because passengers do not authenticate, protect feedback from spam using:

rate limiting
payload limits
basic duplicate/spam protection

Do not require unnecessary personal information.

Create an admin feedback-management view with statuses such as:

NEW
UNDER_REVIEW
RESOLVED
DISMISSED

Important admin actions on feedback may be audited.

### 22.27 Emergency reporting

Add:

Emergency

Initial categories:

Bus Breakdown
Accident

Do NOT allow an unauthenticated passenger emergency report to immediately dispatch or notify the entire fleet as if it were verified.

Two trust levels are required.

Passenger report:

Passenger selects active route/trip
→ reports Breakdown/Accident
→ backend records UNVERIFIED high-priority report
→ affected driver and administrator receive immediate alert
→ driver/admin confirms

Authenticated driver report:

Driver reports emergency for own running trip
→ treat as trusted/confirmed according to configured workflow

After confirmation:

create confirmed emergency
identify suitable nearby active buses
send assistance request to nearby drivers/admin
show incident location
allow assistance acknowledgement

### 22.28 Emergency assistance workflow

Example:

Route 12 breakdown confirmed.

System knows Route 12's latest accepted GPS location.

Backend identifies nearby active routes.

Selected nearby drivers receive:

"Route 12 has reported a breakdown near [location]. Assistance requested."

Driver sees:

ACCEPT
DECLINE

A driver must not be encouraged to interact with the device while actively driving.

Where possible, disable/limit interaction while movement indicates the assisting bus is moving and instruct the driver to respond only when safely stopped.

When one bus accepts:

create assistance assignment.

Affected driver receives:

"Route 8 has accepted the assistance request."

Admin receives the same status.

Other drivers see that assistance is already assigned.

Use Google Maps to show incident location and, when needed, route/directions for the assisting bus.

Do not automatically claim that the assisting bus has sufficient empty seats because the system tracks assigned passengers, not actual occupied seats.

Admin/driver remains responsible for operational capacity decisions.

### 22.29 Emergency location

For a confirmed emergency on an active trip, use the BUS'S latest accepted GPS location as the primary incident location.

This is preferable to permanently storing a passenger's personal location.

Store an incident-location snapshot with the emergency record.

Do not continuously track the passenger who submitted the report.

### 22.30 Emergency notifications

Use:

Socket.IO for immediate in-app emergency state.

Mobile push notifications for backgrounded driver apps.

Admin web panel should show a high-priority incident card/status.

Emergency states can include:

REPORTED
UNVERIFIED
CONFIRMED
ASSISTANCE_REQUESTED
ASSISTANCE_ACCEPTED
RESOLVED
CANCELLED/FALSE_REPORT

Important emergency transitions must be included in the audit trail.

### 22.31 Database models to review/add

Review whether new models are required for:

SegmentTravelSample / derived segment travel data
SegmentTravelAggregate
FeedbackReport
PushDeviceSubscription
StopAlertSubscription
EmergencyReport
EmergencyAssistance
route geometry/polyline
raw GPS retention metadata

Do not add tables unnecessarily if existing structures can safely represent the requirement.

### 22.32 Database retention categories

Long-term master/current data:

routes
stops
published schedule
current passenger roster
current drivers
advisors
configuration

Compact historical data:

completed trip summaries
stop events
actual arrival
lateness
alerts
notification history
important audit trail
segment-time aggregates
confirmed emergencies

Temporary/high-volume data:

raw frequent GPS
rejected GPS diagnostics
temporary ETA calculations
temporary operational queues

Apply strong cleanup/retention to the last category.

### 22.33 Admin website

The administrator interface is a React WEBSITE.

It should provide full authorised transport-management functionality.

Include:

dashboard
routes
capacities
stops
Google Maps previews
route geometry
schedules
drivers
manual driver edits
driver Excel import
students/faculty
passenger Excel annual replacement
class advisors
exports
live trips
GPS health
late routes
lateness statistics
notifications
notification retries
feedback
emergencies
emergency assistance
audit timeline
administrator sessions
operations/system health

### 22.34 Deployment

Intended architecture:

React admin website:
Vercel

Combined passenger/driver Android app:
one React Native + Expo installation with Passenger and Driver entry choices

Backend:
persistent Node.js + Express + Socket.IO + workers

Database:
Supabase PostgreSQL

Maps:
Google Maps

Advisor notifications:
SMTP

Mobile push:
Expo/native push notification infrastructure

Store secrets only in environment/secret configuration.

Do not commit:

Supabase private database credentials
SMTP credentials
JWT secrets
private Google Maps credentials
push-provider secrets

### 22.35 Security and privacy

Preserve all existing security requirements.

No passenger account.

No public signup.

No public driver/admin signup.

No public phone numbers.

No driver phone on passenger UI.

Secure password hashing.

Driver ownership checks.

Admin role checks.

HttpOnly/SameSite admin cookie.

CSRF.

Strict CORS.

Socket.IO authentication/authorization.

Rate limiting.

Privacy-safe logs.

Audit-sensitive actions.

HTTPS/WSS.

Session revocation.

Backups and restore tests.

### 22.36 Revised technical stack for PRD/abstract

Mobile:
React Native + Expo + TypeScript

Admin website:
React + Vite

Backend:
Node.js + Express

Realtime:
Socket.IO/WebSockets

Database:
Supabase-managed PostgreSQL

ORM:
Prisma

Validation:
Zod

Maps:
Google Maps

Driver location:
Expo/native background GPS

ETA:
Explainable GPS + route-progress + robust rolling/historical segment ETA

Passenger notifications:
Expo/native push notifications

Advisor notifications:
SMTP email

Imports/exports:
CSV/XLSX

Security:
JWT/sessions, HttpOnly/SameSite cookies, CSRF, Helmet, CORS, rate limiting, role authorization

Deployment:
Vercel + persistent Node host + Supabase PostgreSQL

No RAG.

No current ML claim.

## 23. Repository implementation audit — 9 September 2026

### 23.1 Evidence and status rules

This audit inspected the actual Prisma schema/migrations, backend routes/libraries, maintenance script, tests and mobile source. All **59 existing backend tests passed** with `npm test`. Database-backed verification scripts were identified but not executed in this revision. No hosting account, production database, secret configuration or real device was validated. A PostgreSQL datasource does not prove Supabase hosting; a provider adapter does not prove delivered notifications.

The required classifications are:

- **ALREADY IMPLEMENTED:** existing code supported by inspection and applicable baseline tests; evidence limits remain explicit.
- **REQUIRES MODIFICATION:** existing capability partially satisfies the revised requirement.
- **NEW FEATURE — NOT IMPLEMENTED:** no implementation of the specified workflow was found.
- **DATABASE MIGRATION REQUIRED:** persisted behavior requires schema/data/permission changes; reuse existing models where safe.
- **EXTERNAL CONFIGURATION REQUIRED:** hosting, credentials, provider setup or approved configuration is pending/unverified.
- **FIELD TESTING REQUIRED:** device, road, safety or real-delivery behavior cannot be proven locally.

Multiple categories may apply. Writing requirements never changes an implementation status by itself.

### 23.2 Existing foundations and verification limits

| Capability | Classification and evidence | Limit / remaining work |
| --- | --- | --- |
| Express, Prisma/PostgreSQL, Zod | ALREADY IMPLEMENTED — backend/package.json, backend/prisma/schema.prisma, backend/src/index.js; five migration directories and 16 models | Hosted Supabase deployment not verified |
| Authentication and privacy | ALREADY IMPLEMENTED — backend/src/middleware/auth.js, middleware/security.js, lib/adminCookie.js, lib/adminSessions.js; security/cookie/session tests pass | Preserve controls on all new HTTP/socket workflows; database integrations not rerun |
| Passenger CSV/XLSX exchange | ALREADY IMPLEMENTED — routes/rosters.js and lib/rosterExchange.js; parser/export/validation tests pass | Full archived-roster retention conflicts with revised cleanup |
| Manual administration | ALREADY IMPLEMENTED foundation — routes/drivers.js, route-services.js, stops.js, schedules.js, class-advisors.js, rosters.js | REQUIRES MODIFICATION for deactivation, geometry and revised historical protection |
| GPS validation and room scope | ALREADY IMPLEMENTED — socket.js and lib/liveTracking.js; validation/progress/freshness/limiter tests pass | ETA currently runs before each accepted-position broadcast; adaptive transmission is absent |
| Trip start/end/resume | ALREADY IMPLEMENTED foundation — routes/trips.js and Trip model | Version references exist; explicit transfer and complete protection from master-data edits require work |
| Explainable ETA | ALREADY IMPLEMENTED — lib/eta.js; range/passed/no-negative tests pass | Configurable throttling, robust history and road calibration remain |
| SMTP adapter and outbox | ALREADY IMPLEMENTED — lib/notificationProvider.js, notificationOutbox.js, lateAlert.js; retry/provider/content tests pass | EXTERNAL CONFIGURATION REQUIRED and FIELD TESTING REQUIRED for real SMTP delivery |
| Late-alert hash chain | ALREADY IMPLEMENTED — lib/hashChain.js and LateAlert hash fields; tamper/recovery tests pass | This does not protect AdminAuditLog |
| Basic admin audit timeline | ALREADY IMPLEMENTED — lib/adminAudit.js and routes/admin-audit-logs.js; sanitization/filter tests pass; audit router exposes GET only | New action coverage, runtime mutation restrictions and hash protection remain |

Paths in this subsection are relative to backend/src unless a different root is stated. Existing application-level code and passing unit tests are not a claim of complete hosted or end-to-end verification.

### 23.3 Mandatory finalized-requirement audit

| Requirement | Classification | Actual repository evidence / remaining work |
| --- | --- | --- |
| Supabase hosting | EXTERNAL CONFIGURATION REQUIRED | PostgreSQL via DATABASE_URL exists. Live Supabase connectivity, permissions, migrations and restore were not verified; retain Express/Prisma/auth/workers |
| Google Maps | NEW FEATURE — NOT IMPLEMENTED; EXTERNAL CONFIGURATION REQUIRED; FIELD TESTING REQUIRED | mobile-app/src/components/route-map.native.tsx uses react-native-maps; no Google Maps integration found |
| Combined app role-selection landing | REQUIRES MODIFICATION | The repository already has passenger and driver routes in one Expo package, but mobile-app/src/app/index.tsx opens passenger route selection directly and exposes Driver Login as a button. Replace it after B9 with the required two-avatar Passenger/Driver landing screen |
| Sub-100 MB production installation | REQUIRES MODIFICATION; FIELD TESTING REQUIRED | Current app source/assets are small, but no final Google Maps-enabled production artifact exists. Remove unused native modules where safe and verify the production AAB through Google Play on representative devices |
| Adaptive GPS transmission | REQUIRES MODIFICATION; FIELD TESTING REQUIRED | DriverConsoleScreen.tsx and lib/backgroundLocation.ts use fixed 5,000 ms location options; no specified adaptive sending policy found. Simulate/backend-test policy now; native sender later |
| GPS retention | NEW FEATURE — NOT IMPLEMENTED; EXTERNAL CONFIGURATION REQUIRED | backend/scripts/run-retention.js only cleans rate-limit buckets and inactive sessions, not raw/rejected GPS; add guarded scheduled cleanup. Metadata migration only if needed |
| Robust historical segments | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED; FIELD TESTING REQUIRED | eta.js uses recent clean points; schema has no segment sample/aggregate pipeline |
| Annual passenger purge/replacement | REQUIRES MODIFICATION; DATABASE MIGRATION REQUIRED | rosters.js marks old roster ARCHIVED without purging passenger rows. Trip.rosterId is restrictive; preserve required evidence before cleanup |
| Driver Excel import/deactivation | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED | drivers.js has CRUD/password/session operations, no workbook workflow; Driver has no deactivation field and historical references restrict deletion |
| Transfer Active Trip | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED for ownership/evidence changes as designed | No explicit transfer workflow found; add confirmed atomic transfer and immediate previous-driver denial |
| Route polyline persistence | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED | No version-bound geometry field/model in schema; persist/cache on publication |
| Independent map/ETA updates | REQUIRES MODIFICATION | socket.js invokes estimateArrival before bus:update on every accepted fix; add configurable normal ETA throttling and transition invalidation |
| Push / Notify Me | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED; EXTERNAL CONFIGURATION REQUIRED; FIELD TESTING REQUIRED | NotificationChannel is EMAIL only; outbox requires lateAlertId. No device/threshold subscription/provider flow found |
| Bus Stop Near Me | NEW FEATURE — NOT IMPLEMENTED; FIELD TESTING REQUIRED for permission/display | Existing coordinates/haversine utility reusable; no nearest-stop workflow found |
| Route-number search | REQUIRES MODIFICATION | passenger.js lists/selects routes; mobile-app/src/app/index.tsx renders cards without search. Extend discovery data with major stops/current state; UI later |
| My Route | NEW FEATURE — NOT IMPLEMENTED for local preference | Published schedule data is reusable; no saved preferred route found. Device-local storage requires no passenger account/database identity |
| Full Route | REQUIRES MODIFICATION; DATABASE MIGRATION REQUIRED; EXTERNAL CONFIGURATION REQUIRED | Existing map/ordered stops do not implement Google Maps plus cached published geometry |
| Bus Info | ALREADY IMPLEMENTED data foundation; REQUIRES MODIFICATION for finalized integration | passenger.js returns sanitized route, areas, driver name, capacity, assigned count, schedule/active state; dedicated UI/navigation is deferred |
| Feedback | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED | No feedback model/routes found; add spam-controlled anonymous intake and administrator status workflow |
| Emergency reporting | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED; EXTERNAL CONFIGURATION REQUIRED; FIELD TESTING REQUIRED | No incident model/routes/notification workflow; separate passenger unverified reports from trusted confirmation |
| Emergency assistance | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED; FIELD TESTING REQUIRED | No nearby-driver offers, atomic acceptance or assistance resolution; no occupied-seat inference |
| Actual lateness analytics | NEW FEATURE — NOT IMPLEMENTED; DATABASE MIGRATION REQUIRED for missing arrival/deadline evidence | Trips/stop events/late alerts are inputs, not an actual-late reporting workflow. endTime alone does not prove college arrival |
| Tamper-evident admin audit | REQUIRES MODIFICATION; DATABASE MIGRATION REQUIRED for permissions/hash fields if adopted | AdminAuditLog has no hash fields; no audit UPDATE/DELETE restriction found in migrations. Late-alert hash chain is separate |

Existing client code remains retained. Backend implementation began after this planning revision; the dated checkpoint below supersedes the earlier repository-audit classifications without deleting their baseline evidence.

### 23.4 Backend implementation checkpoint — 11 September 2026

This checkpoint records verified progress and does not declare B1–B9 complete. Frontend work remains deferred until the full B9 gate.

- **Hosted database foundation:** the additive `20260909120000_backend_workflows_foundation` migration is deployed to Supabase PostgreSQL. Credential-safe readiness reports 28 public tables, RLS on all 27 application tables, zero `anon`/`authenticated` grants, and six completed Prisma migrations. A clean temporary-schema migration/seed and a 163,388-byte dump/restore rehearsal passed inside the consolidated acceptance run and removed their fixtures. Runtime and migration connection modes are validated separately, application/verification pool sizes are bounded, and temporary schemas never use the transaction pool. A dedicated `bus_tracker_runtime` login is now provisioned through the shared Supavisor transaction pool with a five-connection Prisma limit. It is separate from the database owner, has no memberships or owned schemas/relations, cannot create databases/roles/schema objects, cannot bypass RLS or access the migration ledger, and retains only application CRUD plus sequence use and append/read audit access. The privileged session connection remains private and migration-only.
- **Historical evidence and audit:** trip start captures route, schedule, roster and college-deadline snapshots. Completion distinguishes final-stop arrival evidence from manual end and stores unknown arrival explicitly. Administrator audit rows carry correlation references and a serialized, advisory-lock-protected hash chain. PostgreSQL append-only triggers rejected transaction-safe UPDATE and DELETE probes while preserving the original evidence. Broader complete-workflow mutation coverage remains.
- **Roster replacement:** import confirmation binds the exact file SHA-256 and roster version. Publishing requires explicit confirmation and snapshots older affected trips before archival. Old passenger rows are not yet deleted: the destructive purge was deliberately deferred pending explicit authorization and backup evidence.
- **Drivers and transfers:** inactive drivers cannot log in, start/resume GPS, or accept assistance; removal deactivates, unassigns and revokes sessions while preserving history. The separate XLSX driver template/preview/confirm workflow is implemented with formula/duplicate/route/identity validation, exact file and master fingerprints, atomic swaps, safe deactivation, active-trip blocking and one-time generated credentials outside the workbook/audit. Active-trip transfer is confirmed, serialized, audited and immediately rechecks socket/end ownership.
- **Google Maps and discovery:** schedule publication persists Google Maps polyline, distance, duration, fingerprint and generation metadata. Reads reuse that geometry; a credential-safe synthetic Cloud routing probe succeeded. Stop-coordinate edits pre-generate every affected published geometry and commit all-or-nothing. Active trips use captured stop coordinates. Public APIs support route/area/major-stop search, active state, ordered schedules, geometry and transient nearest stored stops without retaining passenger coordinates. The privacy verifier now creates and removes a complete synthetic public fixture rather than passing against an empty database.
- **GPS, ETA and retention:** accepted marker/progress broadcasts do not wait for ETA recalculation. ETA refresh is cached at a configurable 15–30 second interval with transition invalidation. Backend simulation verifies separate five-second collection, 12-second normal, seven-second transition, 30-second stationary and immediate lifecycle/recovery sending contracts; native implementation remains deferred. Retention dry-run/apply logic covers accepted GPS at seven days only after derived evidence, rejected diagnostics at two days, calibration snapshots at 30 days and expired push devices. The Render blueprint schedules dry-run only; production apply scheduling and failure alerting remain an operational gate.
- **Segments and actual lateness:** completed-trip stop evidence feeds idempotent adjacent-segment samples and median/MAD aggregates, preserving disruption classification. ETA consumes matching weekday/time-window history while current slow/stationary evidence outweighs optimistic history. Admin analytics separate completed, verified-arrival, unknown-arrival and actual-late counts and use verified arrivals as the late-percentage denominator. Production accuracy remains a field gate.
- **Notify Me:** anonymous and driver device registration uses one-time management secrets; tokens are never returned after registration. Route/stop threshold preferences and durable 10/5/1-minute deduplication are implemented, including jump-skipping semantics. The push worker now includes Expo ticket submission, bounded retry, delayed receipt checks and invalid-token deactivation. Console simulation remains configured until Expo credentials/device tests are available.
- **Feedback and emergencies:** bounded, rate-limited, duplicate-resistant feedback with audited admin states is implemented. Passenger emergencies remain unverified; own-trip driver/admin confirmation snapshots only fresh accepted bus GPS, creates nearest active-bus offers and requires a recent low-speed GPS sample plus explicit safely-stopped confirmation before atomic acceptance. Concurrent losing accepts cannot emit false acceptance. Administrator reassignment closes the current assignment and reopens only still-active alternatives with audit evidence. Provider/device and supervised operational tests remain.
- **Contracts and verification at this checkpoint:** expanded v1 workflows are frozen in `docs/BACKEND_WORKFLOWS_V1.md`; `npm run verify:backend-acceptance` composes 16 local/hosted checks with bounded database retries. On 11 September 2026, one uninterrupted run passed all 16 checks in 208 seconds, including Prisma validation and **92/92 backend unit tests**, Supabase readiness, clean migration/seed, backup/restore, append-only audit, administrator session/cookie, socket isolation, shared rate limiting, public privacy, release API, adaptive GPS, a 10,000-row roster limit, five concurrent workers delivering 500 unique outbox messages, credential-safe Google Maps geometry and retention dry-run. After provisioning the restricted identity, `npm run verify:restricted-acceptance` passed all 14 checks in 165 seconds without the migration credential. It verified all 27 RLS policies, 26 ordinary application-table CRUD grants, sequence access, append/read-only audit behavior, ten denied privilege-escalation operations, rollback-only mutations across all 27 application tables, two serialized competing roster publications, API/privacy/socket/session/outbox/rate-limit/load behavior, Google Maps and retention dry-run. Production-mode local startup, restricted readiness and graceful shutdown also passed. The Render blueprint and hosted HTTPS/WSS verifier are prepared, but the service is not yet deployed because publishing the deployment branch requires explicit approval for the GitHub remote. No secret value was printed, committed, copied to documentation/tests, or added to `.env.example`.

Phase implementation status at this checkpoint:

| Phase | State | Remaining gate |
|---|---|---|
| B0 | Complete: reproducible 16-check consolidated baseline passed | None for the backend baseline; preserve this command as a release regression gate |
| B1 | Supabase schema/restore and dedicated least-privilege runtime identity verified | Render deployment, hosted connectivity and monitoring |
| B2 | Snapshot boundaries, append-only chained audit and all-table mutation coverage verified under the restricted role | Re-run hosted checks from the deployed Render process |
| B3 | Passenger preview/confirm/snapshot, driver exchange, trip transfer and competing publication verified | Old-passenger deletion remains intentionally disabled pending separate authorization and backup policy |
| B4 | Published/reused Google Maps geometry, atomic coordinate regeneration and discovery DTOs implemented and backend-verified | Visual rendering is deferred to the frontend/mobile phase |
| B5 | Adaptive contract simulation, independent ETA, fan-out/load behavior and guarded retention backend-verified | Native sender and road behavior remain deferred field gates |
| B6 | Segment history, robust aggregates and actual lateness implemented | Production route calibration remains a field gate |
| B7 | Subscriptions, threshold worker and Expo ticket/receipt behavior implemented | Real Expo credential/device delivery gate |
| B8 | Feedback, trust/confirmation, safe assistance and reassignment implemented | Supervised operational and real-device gate |
| B9 | Acceptance commands, contract documentation, stable all-check run and restricted-role hosted-database run completed | Publish/deploy the prepared Render service and run HTTPS/WSS hosted acceptance; real SMTP/push and supervised road validation remain later gates |

## 24. Backend-first implementation plan and acceptance gates

### 24.1 Working method and dependency order

Preserve the release candidate as a regression baseline. Each phase delivers backend code, migrations where required, documented HTTP/socket contracts and targeted verification. Extend `/api/v1` compatibly; use additive fields or explicit versioning for breaking changes. Keep existing clients usable while new capabilities remain disabled until dependencies are ready. Frontend mocks cannot establish backend completion.

For database changes: rehearse backup/restore, add compatible structures, backfill/validate minimal evidence, switch reads/writes, then enable cleanup. Never combine destructive roster purge with its first schema deployment. A code rollback cannot restore deleted rows: use a confirmed outgoing workbook or a tested backup within its retention window. No real data purge is authorized by this planning update.

The gates below remain the definition of completion. Implementation is now in progress as recorded in Section 23.4; no phase should be called complete until every exit-gate item for that phase has reproducible evidence. The original 59-test result remains the baseline, while later checkpoint counts record added coverage.

### B0 — Preserve and verify the existing baseline

Record source revision, schema, API/event contracts, synthetic fixtures and simulated provider settings without exposing secrets. Run clean migration/database, backup/restore, privacy, socket-isolation, auth/session, release API and load scripts against an isolated database. Map every finalized requirement to acceptance cases.

**Exit gate:** reproducible isolated baseline, tested restore, compatibility fixtures, and explicit failed/unverified checks. The 59/59 unit result alone does not satisfy this gate.

### B1 — Supabase PostgreSQL hosting readiness

Configure Supabase-managed PostgreSQL for existing Prisma/Express without replacing auth, sockets or workers. Verify current provider documentation when implementing connection/migration settings. Configure secret-managed runtime/migration identities, connectivity, backup/restore and monitoring; prevent unintended public access to private application tables. Rehearse migrations and long-lived API/worker connections with synthetic data.

**Exit gate:** isolated hosted PostgreSQL passes readiness, migration, authorization and restore checks; no database credentials enter clients/logs. Provisioning can proceed alongside isolated local work, but hosted verification remains mandatory before the backend release gate.

### B2 — Historical evidence, master-data boundaries and audit

Protect immutable trip-start route/schedule/roster/deadline evidence with only operationally necessary passenger data. Preserve active trips through changes to stops, drivers and rosters. Distinguish actual college arrival from manual end time; unknown arrival is explicit.

Extend compact chronological audit coverage for imports/exports, driver changes, transfers, geometry, configuration, feedback and emergencies. Include safe before/after summaries and correlation references, not full workbooks or personal payloads. Expose no edit/delete API, restrict runtime UPDATE/DELETE where feasible, and evaluate hash chaining with concurrent-write and verification rules separately from LateAlert's chain.

**Exit gate:** master edits cannot change captured trip behavior; minimal history survives isolated cleanup tests; unauthorized audit mutations fail; evidence/permission migrations are reproducible.

### B3 — Annual passenger replacement, driver import and transfer

Extend passenger previews with additions/removals, route/stop and academic changes, errors and capacity problems. Confirm the exact workbook/preview and current version, then atomically replace the roster. Never increment student years automatically. Secure minimal trip/alert snapshots before scheduling old passenger-row purge; defer only dependencies required by running trips within a bounded policy.

Implement separate driver templates and parse/validate/compare/confirm/atomic-update workflow. Update matching drivers, create new ones, safely deactivate/unassign removals and revoke access; privately provision credentials without workbook passwords. Resolve removal during an active trip explicitly. Manual correction workflows remain available.

Implement Transfer Active Trip with confirmation, atomic ownership update, audit evidence, previous-driver denial and new-driver resume. Serialize transfers with GPS/end commands and prevent conflicting running trips.

**Exit gate:** preview makes no writes; invalid/stale imports leave live state unchanged; competing publications/transfers are safe; failures roll back atomically; cleanup preserves history; previous driver GPS is immediately rejected after transfer.

### B4 — Published geometry and discovery APIs

Persist/cache route geometry per published route/schedule version and regenerate on edited publication. Keep active-trip geometry stable and reuse it for readers. Extend route-number discovery with areas, major stops and active state; expose safe Bus Info and ordered fixed schedule for My Route.

Provide nearest stored stops using validated transient coordinates/geographic distance, returning distances/routes/applicable schedule without retaining user location or repeatedly calling Google Maps Nearby. Define Full Route, stop/map preview and incident geometry contracts independently of rendering, including unavailable-geometry fallback.

**Exit gate:** repeated reads reuse published geometry; generation failure cannot corrupt published state; nearest-stop fixtures are deterministic; response allowlists exclude private fields; scheduled time and live ETA remain distinct.

### B5 — Adaptive GPS contracts, independent ETA and raw retention

Define configurable 10–15 second normal, 5–10 second sensitive-transition, approximately 30 second sustained-stationary and immediate start/end/reconnect/recovery transmission policy. Separate local collection frequency from sending. Simulate adaptive events now; native sender implementation remains in the deferred frontend phase.

Preserve ownership, timestamps, replay, accuracy, impossible-motion and off-route validation. Broadcast accepted map position/progress promptly to relevant rooms; independently throttle ETA to approximately 15–30 seconds with meaningful-transition invalidation. Safely share/cache current-condition ETA across readers; preserve confidence, stale states and fallback Refresh semantics.

Add configurable batched raw/rejected-GPS cleanup, dry runs, scheduled execution, failure visibility and safeguards for active progress/reconstruction and pending derived-data extraction. Persist needed compact evidence before deleting source points.

**Exit gate:** rejected/replayed points never advance public tracking; marker updates do not wait for ETA; transition/stale behavior passes; retention boundaries preserve required history. Load tests include viewer fan-out, beyond the approximately 3.1/2.1 inbound events/second at 10/15-second intervals for 31 buses.

### B6 — Historical segments and actual lateness analytics

Review/add segment samples/aggregates by route/version, direction, adjacent stops, weekday/time window. Extract idempotently from accepted evidence before raw cleanup; document sample eligibility, sparse-data fallback, MAD/IQR outlier handling and algorithm version. Preserve disruption classification; live stationary delay must outweigh optimistic normal history. Optional ETA calibration snapshots have bounded retention.

Derive routeNo completed trips, actual late trips, late percentage and recent actual-delay history from verified arrival/deadline evidence, with optional average/median actual delay. Expose unknown-arrival counts separately and document the eligible denominator. Cancelled/incomplete trips and recovered predictions cannot silently count as actual-late or on-time arrivals.

**Exit gate:** one 31-minute disruption does not dominate eight-minute normal samples; today's real delay still worsens ETA; reprocessing does not duplicate aggregates; predicted-late/on-time trips are not counted late; absent arrival evidence is not invented. Production accuracy remains a field gate.

### B7 — Push subscriptions and stop-arrival workers

Review the EMAIL-only, required-lateAlertId outbox before extending it or creating a dedicated push outbox. Reuse reliability behavior, not incompatible schema assumptions. Add anonymous device subscriptions and route/stop preferences with authorized modification/unsubscribe, expiry and invalid-token cleanup; driver registration remains authenticated.

Implement selected 10/5/1-minute thresholds with durable at-most-once logical triggering per trip/approach/subscription. For 12-to-4-minute jumps, send only the relevant current alert and mark earlier crossed thresholds skipped. Suppress stale/off-route/unreliable arrivals. Add provider retry/receipt handling and restart-safe deduplication while preserving SMTP advisor delivery. Distinguish logical enqueue deduplication from provider delivery guarantees; deduplicate client display where needed.

**Exit gate:** workers/restarts/ETA oscillations do not enqueue duplicate or stale thresholds; invalid tokens deactivate safely; no passenger account is required; provider contract checks pass. Native background delivery remains a device gate.

### B8 — Feedback, emergency trust and assistance

Add payload-bounded, rate-limited, duplicate-resistant anonymous feedback with specified categories and admin NEW/UNDER_REVIEW/RESOLVED/DISMISSED management.

Add active-trip Breakdown/Accident reporting. Passenger reports remain unverified and immediately alert only the affected driver/admin; authenticated own-trip driver reports follow configured trusted confirmation. After confirmation, snapshot the bus's latest accepted GPS with age/confidence. Missing/stale location requires honest uncertainty and administrative resolution, not fabricated coordinates or passenger tracking.

Select suitable nearby active buses; send scoped socket state and background driver push. Add safely-stopped ACCEPT/DECLINE, atomically award one assistance assignment, notify affected driver/admin and close other offers. Define cancellation/reassignment, stale candidates, role permissions, audit transitions and idempotency. Never infer empty seats from assigned counts.

**Exit gate:** unverified reports cannot dispatch; unauthorized confirmation/assignment fails; simultaneous accepts yield one assignment; retries do not duplicate incidents/offers; location uncertainty and movement safety are explicit. Operational emergency usability remains a supervised field gate.

### B9 — Complete revised backend acceptance

Exercise the complete workflow with synthetic data: master setup → geometry/schedule publication → passenger/driver imports → trip start → simulated adaptive GPS → progress/ETA → SMTP and push processing → transfer → emergency confirmation/assistance → actual arrival → statistics/aggregation/retention → next-year replacement without history loss.

Freeze documented HTTP/socket contracts, safe DTOs, state transitions, validation/errors, pagination, idempotency and provider behavior for every deferred client feature. Include My Route's local-only preference and scheduled-versus-live distinction. Run applicable unit/integration, hosted database, concurrency/restart, room isolation, privacy/auth/CSRF/session, migration/restore, retention and fan-out checks. Verify provider failure recovery and operational runbooks.

Reconcile Section 23 against evidence, distinguishing local simulation, hosted configuration and field verification. A stub endpoint/model does not complete a workflow.

**Exit gate:** all revised backend workflows and B1–B8 acceptance cases pass reproducibly; hosted/provider dependencies required for the backend release are verified; no critical data-loss/security/reliability gap remains. Only visual/device/road validation is deferred. New frontend implementation starts after this gate.

### F1 — Deferred frontend implementation

After B9, update the separately hosted React + Vite administrator WEBSITE and the single combined React Native + Expo + TypeScript Passenger + Driver app against verified contracts. Reuse applicable clients. Make the first mobile screen two large avatar/tiles labelled `Passenger` and `Driver`; Passenger opens the no-login dashboard and Driver opens login. Implement Sections 14–16 and 22: Google Maps, automatic tracking/fallback Refresh, fixed-schedule My Route, route search, nearby stops, Bus Info/Full Route, Notify Me, feedback, emergencies and safely-stopped assistance. Implement the adaptive native sender and background behavior without weakening backend rules to fit UI shortcuts.

**Exit gate:** builds and contract integration pass; role privacy, landing navigation, loading/error/offline/stale, accessibility, permission, push-token lifecycle and reconnect behavior are tested. The production AAB is analyzed and its fresh device-specific installation remains below the 100 MB target on representative supported Android devices.

### F2 — Devices, roads and supervised rollout

Use approved college data, configured Google Maps, real SMTP recipients and mobile push infrastructure. Test Android screen lock/battery vendors, foreground/background permissions/GPS, weak network, queue replay and push delivery. Compare ETA with actual arrivals, calibrate thresholds, evaluate historical baselines with sufficient samples and rehearse assistance safely. Begin with one route, then several, then all 31 after acceptance.

**Exit gate:** approved data, restore ownership, measured road/device results, browser sign-off and supervised operational acceptance. No RAG or current ML claim; future ML requires separate evaluation showing improvement.

### 24.2 Data-model and retention review

These are design candidates, not a requirement to create every table:

| Responsibility | Candidate reuse/addition | Preservation rule |
| --- | --- | --- |
| Route geometry | ScheduleVersion fields or related geometry record | Published and active-trip geometry remains stable |
| Segment intelligence | SegmentTravelSample / SegmentTravelAggregate | Compact robust statistics survive raw cleanup |
| Annual replacement | TransportRoster metadata and minimal trip/alert snapshots | Purge full old RosterPassenger rows without cascading history loss |
| Driver lifecycle/transfer | Driver deactivation state and Trip ownership/evidence | Previous authority revoked; ownership changes auditable |
| Actual lateness | Actual college arrival and captured deadline or equivalent immutable evidence | Unknown arrival distinct from on-time; derive rather than increment counters |
| Push / Notify Me | PushDeviceSubscription, StopAlertSubscription, durable delivery/deduplication | No unnecessary passenger identity or public token exposure |
| Feedback | FeedbackReport and admin status | Minimal content, spam controls and bounded retention |
| Incidents | EmergencyReport / EmergencyAssistance or equivalent | Bus location snapshot, trusted confirmation, one assignment |
| Audit | AdminAuditLog permissions and optional chain/reference fields | No edit/delete surface or workbook/secret payloads |
| Retention | Existing timestamps/indexes first; job/policy metadata only if needed | Dry run, bounded cleanup and derived-evidence dependency checks |

Set explicit configurable retention policies for current master data, compact history, raw/rejected GPS, calibration snapshots, expired device subscriptions, closed offers and temporary queues. Preserve backups and restore requirements while avoiding indefinite retention of unnecessary old full rosters. Approve values during implementation; no arbitrary permanent retention period is introduced here.
