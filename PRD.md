# College Bus Tracking System — Product Requirements Document

**Status:** Planning baseline  
**Version:** 1.0  
**Last updated:** 24 August 2026  
**Location:** Aushapur, Hyderabad  
**Initial scope:** 31 college bus routes/services

## 1. Product summary

The College Bus Tracking System is a live transport-information and late-arrival alert platform for the college's 31 bus routes. It has three applications sharing one backend:

1. A Flutter passenger experience for students and faculty, with no passenger accounts or login.
2. A Flutter driver experience with authenticated trip controls and GPS streaming.
3. A React web admin panel for route, roster, driver, advisor, schedule, import, export, and alert administration.

The system's central value is not only showing a moving bus. It predicts arrival times at remaining stops and the college. When a route is predicted to miss the college-arrival deadline, it identifies all students assigned to that route in the trip's academic-year roster, groups them by class, and alerts the appropriate class advisors. The advisor decides who is actually absent; the transport system does not track daily boarding attendance.

## 2. Locked product decisions

These decisions supersede older project documents and implementation prompts:

- The route number and bus number are the same operational identifier. The product uses `routeNo` as the single displayed identifier.
- Physical vehicle registration/plate numbers are not stored.
- A physical vehicle may change without changing the route number, passenger roster, stops, or timings.
- The current vehicle capacity for each route/service is stored and can be updated by an admin.
- Only admins and drivers have authenticated accounts.
- Students and faculty are passengers, not authenticated application roles.
- Passengers use the app without creating accounts or signing in with Google.
- Students and faculty share one roster-entry model and are differentiated by a visible `STUDENT` or `FACULTY` badge.
- There is no QR boarding workflow.
- There is no boarding record and no daily attendance tracking.
- There is no live occupied-seat count. The product displays assigned/registered passengers versus current capacity.
- Phone numbers are private. They are stored for administrative use and returned only by admin-authorized APIs.
- Passenger and driver screens never receive or display phone numbers.
- Passenger rosters are versioned by academic year with `DRAFT`, `PUBLISHED`, and `ARCHIVED` states.
- Publishing a new roster replaces the passenger-visible current roster while preserving the previous roster as an archive.
- A trip uses the roster and route-schedule versions captured when that trip starts.
- ETA output is a state plus an estimate/range when appropriate; it is never blindly a number.
- If a selected stop was passed, the app says that it was already passed and does not return a negative ETA.
- All business-time calculations use the `Asia/Kolkata` timezone. Database timestamps are stored in UTC.

## 3. Goals

### 3.1 Passenger goals

- Select one route number and view its current details without an account.
- See the route, ordered stops, scheduled arrival time at each stop, driver name, capacity, and assigned-passenger count.
- Open a passenger-list view grouped by boarding stop.
- See passenger names and student/faculty badges; student roll numbers and faculty IDs follow the configured privacy policy.
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
- Download current and archived rosters in CSV or Excel format.
- Publish a verified roster atomically and retain the old roster as an archive.
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
- A machine-learning ETA model before sufficient historical data exists.
- Play Store/App Store publication for the pilot; sideloaded Android builds are acceptable.

## 5. Users and access control

### 5.1 Admin

Authenticated. Can view and manage all transport data, including private phone numbers, imports, exports, roster publication, advisors, alerts, and audit records.

### 5.2 Driver

Authenticated with an admin-issued driver code and password. Can view only their assigned route and trip controls. Cannot view passenger, advisor, or other driver phone numbers. Cannot start, end, or update another driver's trip.

### 5.3 Passenger

Unauthenticated student or faculty user. Can select a route and see the approved passenger-facing route, roster, tracking, timeline, and ETA data. Cannot see any phone numbers or admin-only fields.

Because an entirely open API could allow roster scraping, the implementation should support a lightweight no-account access control such as a route access code or valid bus-pass lookup. This is not a passenger account and requires no password lifecycle. If the college intentionally chooses fully open route selection, the privacy impact must be accepted and roll/faculty identifiers may need masking.

### 5.4 Class advisor

Not an application account in the MVP. An advisor is a notification-contact record mapped to department, year, and section. Advisors verify attendance in class after receiving delayed-route information.

## 6. Primary user flows

### 6.1 Passenger flow

1. Open the app.
2. Select one route number, such as `Route 12`.
3. Open the route details page.
4. View route name/areas, driver name, capacity, assigned count, trip status, and last update.
5. Use `Passenger List` to view the published roster grouped by stop.
6. Use `Track Bus` to open the live map.
7. Use `Estimate Arrival` to select a route stop.
8. Receive an ETA range or an explicit state such as not started, at stop, passed, stale, off route, or trip ended.

### 6.2 Driver flow

1. Log in.
2. Review the assigned route and current schedule.
3. Complete location-permission and background-tracking checks.
4. Start the trip.
5. Stream authenticated GPS updates.
6. See connection and last-sent status.
7. End the trip at college.

### 6.3 Annual roster flow

1. Admin exports the current published roster as a backup.
2. Admin creates a named next-year draft, either empty or copied from the current roster.
3. Admin edits rows in the panel and/or imports CSV/Excel.
4. The backend validates identifiers, conditional fields, routes, stops, capacity, duplicates, advisor coverage, and schedule completeness.
5. Admin downloads an invalid-row report and corrects errors.
6. Admin reviews a comparison summary against the current roster.
7. Admin publishes the draft.
8. In one database transaction, the old roster becomes `ARCHIVED` and the draft becomes `PUBLISHED`.
9. Passenger views and future trips use the newly published roster.

### 6.4 Late-alert flow

1. Driver GPS updates advance live route progress.
2. The backend calculates ETA for every remaining stop and the final college stop.
3. The late monitor evaluates the prediction at a throttled interval.
4. After multiple confident late evaluations, the trip enters a delayed state.
5. The backend loads `STUDENT` entries from the trip's roster snapshot.
6. Students are grouped by department, year, and section.
7. Matching advisors are found.
8. Notifications are written to an outbox and delivered.
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
- Preserve archived rosters.
- Trips retain their roster-version reference.

### 7.4 Import

- Provide downloadable CSV and Excel templates.
- Upload into a draft only.
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
- A separate explicitly private contact export may be available only to admins.

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

- A trip belongs to one route, driver, roster version, and schedule version.
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

The MVP uses a transparent prediction algorithm, not a machine-learning claim. A later model may use historical segment travel times after sufficient real-trip data has been collected.

### 8.1 Inputs

- Latest valid GPS fix.
- Recent valid GPS history.
- Ordered stop coordinates.
- Route progress and travel direction.
- Remaining route/segment distance.
- Scheduled times.
- Configurable dwell allowance at intermediate stops.
- Historical segment averages when available in a later phase.

### 8.2 Calculation behavior

- Use a rolling median/average from the latest clean points, not a single instantaneous speed.
- Reject impossible movement and GPS jitter.
- Measure distance along the route/stop sequence rather than only straight-line distance to the selected stop.
- Widen the estimate when the bus is far away, stationary, stale, or off route.
- Display a range such as `12–16 minutes` and a confidence label.
- Recalculate at a throttled interval and include `updatedAt`.
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
- `TRIP_ENDED`
- `UNKNOWN`

State priority prevents contradictory messages:

1. Trip ended.
2. Selected stop passed.
3. Bus at selected stop.
4. Location stale or off route.
5. Upcoming live ETA.
6. Scheduled-time fallback.

### 8.4 Passed-stop behavior

If route progress is beyond the selected stop, return no ETA and show:

```text
Bus has already passed this stop.
Passed at approximately 7:28 AM.
```

The system must never return a negative ETA. If progress indicates that the bus passed but a stop event was not confirmed, use `POSSIBLY_SKIPPED` and explain that the bus appears to have passed without a confirmed stop.

### 8.5 Future historical/AI phase

After collecting sufficient trips, store average travel time per route segment by weekday and time window. Compare that method with the live-speed baseline. Only add an ML model if measured evaluation shows a meaningful accuracy improvement.

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
- Keep a tamper-evident alert hash chain only after core delivery is reliable.

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

## 11. API and real-time boundaries

### 11.1 Admin APIs

Authenticated admin-only CRUD and workflows for routes, stops, schedules, capacity, drivers, advisors, rosters, roster entries, imports, exports, publication, alert review, and audit history.

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

No passenger API returns phone numbers, password/auth fields, internal audit data, notification recipients, or private admin fields.

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

Every event is scoped to a trip room. Driver events require JWT authentication and ownership authorization.

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
16. **Local export lost:** retain downloadable database archives.
17. **CSV formula injection:** escape formula prefixes on export.
18. **Very large file:** stream processing and enforce file/row limits.
19. **Bad characters/encoding:** require UTF-8 or normalize supported Excel input and preview it.
20. **Rollback required:** permit republishing an archived roster as a new draft/version.

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
97. **Cascading historical deletion:** restrictive relations and archival workflows.
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
- Rosters list (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- Draft roster editor
- Import preview/errors
- Publish comparison/confirmation
- Exports
- Running trips and GPS health
- Delayed routes and notification status
- Audit log

## 15. Passenger screens

- Route selection
- Route details summary
- Passenger list grouped by stop
- Live tracking map
- Stop timeline
- Stop-selection ETA sheet/page
- Offline/stale/error states

Passenger route details show driver name but no driver phone number.

## 16. Driver screens

- Login
- Assigned-route summary
- Permission/readiness check
- Start trip
- Running-trip GPS/connection status
- End trip confirmation
- Resume interrupted trip

No scanner, QR, passenger phone, or attendance UI is included.

## 17. Non-functional requirements

- Support at least 31 simultaneous route services and their passenger viewers.
- Live updates should normally appear within seconds of a valid driver fix.
- Static route/roster reads should be cached where safe.
- Admin imports must handle the college's full annual roster without browser freezing.
- APIs return structured, user-safe errors.
- Accessibility: readable contrast, scalable text, and timeline usable without a map.
- Observability: health checks, structured logs, stale-trip monitoring, and notification status.
- Data protection: least-privilege responses, secure secrets, backups, and auditability.

## 18. Revised build phases

### Phase 0 — Requirements, repository, and privacy baseline

- Adopt this PRD as the source of truth.
- Reconcile or replace older planning documents.
- Choose MySQL or PostgreSQL and document the decision.
- Initialize Git and commit the current prototype as a baseline.
- Decide the no-account passenger roster-access policy.

### Phase 1 — Schema redesign and migrations

- Implement route-service, versioned schedule, roster, unified roster passenger, trip snapshot, stop-event, notification outbox, and audit models.
- Remove registration/plate number, passenger login fields, boarding records, QR occupancy, and passenger `active` concepts.
- Create migrations and seed/import fixtures.

### Phase 2 — Backend admin and annual-roster workflows

- Secure admin and driver authentication.
- Implement route/stop/schedule/driver/advisor CRUD.
- Implement roster draft, copy, edit, import, validate, compare, publish, archive, rollback-as-draft, and export.
- Add field-level privacy DTOs and audit logs.

### Phase 3 — Admin panel

- Build admin-only navigation and all management screens.
- Add roster import preview, downloadable errors, capacity checks, publish confirmation, archive/export, advisor coverage, and health dashboards.

### Phase 4 — Secure driver tracking

- Driver-only mobile login and assignment.
- Permission/readiness flow.
- One-running-trip enforcement.
- Authenticated GPS socket, foreground service, reconnection, stale status, resume, and ownership checks.

### Phase 5 — Passenger experience

- No-account route selection/access.
- Sanitized route details, capacity/assigned count, passenger roster, map, timeline, trip status, and offline handling.

### Phase 6 — Smart ETA and route progress

- Validated rolling-speed model, route progress, stop states, passed/skipped handling, confidence ranges, stale/off-route behavior, stop events, and ETA UI.

### Phase 7 — Automatic late alerts

- Throttled automatic evaluation, deadline/service calendar, confident triggering, student grouping, advisor matching, outbox delivery/retry, recovery, and dashboard.

### Phase 8 — Security, performance, and failure-mode testing

- Implement the acceptance cases in Section 13.
- Add unit, API integration, socket, import, concurrency, Flutter widget/state, and browser end-to-end tests.
- Test backups and migrations.

### Phase 9 — Data collection, deployment, and pilot

- Import all 31 routes, schedules, passengers, and advisors.
- Verify coordinates and timings.
- Deploy HTTPS/WSS services.
- Pilot one route on real phones and roads, expand to several, then all 31.
- Collect ETA accuracy metrics before considering historical/ML enhancement.

## 19. Definition of done

The MVP is complete only when:

- A full academic-year roster can be drafted, imported, validated, exported, published, archived, and restored as a new draft.
- Passenger views switch atomically to the newly published roster.
- No passenger or driver API leaks phone numbers.
- A driver can securely start, stream, resume, and end only their assigned route's trip.
- Two simultaneous routes do not exchange live events.
- Passenger map and timeline correctly show live, stale, ended, and offline states.
- ETA returns correct stateful behavior for upcoming, at-stop, passed, skipped, stale, off-route, and ended cases.
- A predicted-late trip automatically produces the correct student groups and advisor notifications without duplicate spam.
- Failed deliveries and missing advisors are visible to admins.
- Imports, migrations, backups, security controls, and the failure cases in Section 13 have automated or documented test evidence.
- At least one real-route pilot succeeds with the driver's screen locked and variable network conditions.
