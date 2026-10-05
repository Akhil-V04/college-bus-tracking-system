# Backend Workflows v1

This document freezes the backend contracts added for the revised product. All paths use `/api/v1`. Administrator cookie-authenticated mutations also require `X-Requested-With: college-bus-admin`; bearer-authenticated native requests do not use that browser CSRF header.

## Driver master exchange

- `GET /drivers/import/template` returns the XLSX template. It has no password column.
- `POST /drivers/import/preview` accepts one XLSX file in multipart field `file`. Preview performs no writes and returns `previewDigest`, `masterVersion`, row actions/errors, removals, and summary counts.
- `POST /drivers/import/confirm` accepts the same file, multipart `confirmed=true`, `X-Preview-Digest`, and `X-Driver-Master-Version`.

Confirmation is serialized and atomic. A changed file or driver master returns `409`. Included drivers are created, updated, or reactivated; omitted active drivers are deactivated, unassigned, and have their sessions revoked. A driver owning a running trip blocks publication until the trip is transferred or ended. Initial passwords for newly created drivers appear once in the no-store confirmation response and never enter the workbook or audit log.

## Schedule geometry and active-trip stability

- `POST /schedules/:id/publish` validates the schedule, obtains Google Maps route geometry, and stores the encoded polyline, distance, duration, fingerprint, provider, and generation time with the published version.
- `POST /schedules/:id/geometry/regenerate` regenerates stored geometry for a published schedule.
- `PUT /stops/:id/coordinates` pre-generates every affected published geometry and then commits the stop and geometries together. A provider failure leaves all prior coordinates and geometries unchanged.

Trip start captures route, schedule, roster, stop, and deadline evidence. Active trip progress and ETA use that snapshot, so later master edits do not change a running trip.

## Passenger discovery

- `GET /passenger/routes` supports route, area, major-stop, and active-state discovery.
- `GET /passenger/routes/:routeNo` returns safe Bus Info, ordered published stops, fixed schedule, persisted geometry, active trip state, and live information when available.
- `GET /passenger/stops/nearest?latitude=...&longitude=...` calculates distance to stored stops. Coordinates are validated and used transiently; they are not persisted and do not invoke Google Maps Nearby.
- `GET /passenger/trips/:tripId/eta/:stopId` returns live ETA separately from the scheduled stop time, including confidence/stale or fallback state.

Public DTOs exclude driver phone/licence, credentials, private passenger identifiers, advisor recipients, and administrator evidence.

## Push subscriptions and stop alerts

- `POST /push-subscriptions/anonymous` registers a passenger device without an account.
- `POST /push-subscriptions/driver` registers a device for the authenticated active driver.
- `POST /push-subscriptions/:id/stop-alerts` creates or updates route/stop thresholds.
- `DELETE /push-subscriptions/:id/stop-alerts/:alertId` removes one preference.
- `DELETE /push-subscriptions/:id` unsubscribes the device.

Anonymous registration returns a one-time management secret. Subsequent anonymous changes supply that secret; it is stored only as a hash. Tokens are never returned after registration. Threshold delivery is durably deduplicated by subscription, trip, and threshold. When ETA jumps from 12 to 4 minutes, the 5-minute alert is queued and the crossed 10-minute alert is recorded as skipped. Expo tickets and receipts are processed with bounded retries; permanent invalid-device responses deactivate the token.

## Feedback

- `POST /feedback` accepts bounded anonymous feedback in the documented categories and deduplicates recent matching submissions.
- `GET /feedback` is administrator-only and paginated.
- `PATCH /feedback/:id/status` is administrator-only and accepts `NEW`, `UNDER_REVIEW`, `RESOLVED`, or `DISMISSED`.

Administrator state changes create append-only audit evidence. Public responses do not expose internal fingerprints.

## Emergencies and assistance

- `POST /emergencies/passenger` creates an `UNVERIFIED` active-trip Breakdown/Accident report. It alerts only the affected driver and administrators; it does not dispatch assistance.
- `POST /emergencies/driver` is restricted to the current active driver and creates a trusted own-trip report.
- `POST /emergencies/:id/confirm` lets an administrator confirm an unverified report.
- `POST /emergencies/:id/offers/:offerId/respond` accepts `ACCEPT` or `DECLINE`. Acceptance also requires `safelyStopped=true` plus a fresh accepted GPS sample at no more than 5 km/h.
- `POST /emergencies/:id/reopen-assistance` requires administrator authentication, `confirmed=true`, and a reason. It closes the current assignment and reopens only alternatives whose trip and driver remain active.
- `PATCH /emergencies/:id/status` lets an administrator resolve, cancel, or mark a false report and closes outstanding offers.

Confirmation snapshots only fresh accepted bus GPS. Missing or stale GPS stores an explicit uncertainty source without fabricated coordinates. Database serialization plus a partial unique index allows one accepted assistance offer. Losing concurrent accepts return `409` and cannot emit an accepted event.

## GPS, ETA, history, and retention

The native sender contract separates 5-second collection from transmission: 12 seconds normally, 7 seconds near transitions, about 30 seconds while stationary, and immediate transmission for trip start/end, reconnect, and GPS recovery. The backend continues to validate ownership, session version, timestamps, replay, accuracy, speed, and route proximity.

Accepted marker/progress broadcasts do not wait for ETA computation. ETA refresh uses a 15–30 second cache window with transition invalidation. Historical adjacent-segment medians use weekday/time windows and MAD-based disruption resistance; current slow or stationary evidence cannot be overridden by optimistic history.

`npm run maintenance:retention` is always a dry run. The explicitly invoked apply command uses these defaults:

- accepted GPS: 7 days, only for completed/cancelled trips after segment extraction;
- rejected GPS diagnostics: 2 days, never for a running trip;
- ETA calibration snapshots: 30 days, never for a running trip;
- compact trip, segment, lateness, transfer, emergency, feedback, and audit evidence: retained long-term;
- expired push subscriptions: deactivated; and
- expired rate-limit buckets and old inactive administrator sessions: removed.

The Render blueprint schedules only the dry-run report. Enabling destructive scheduled apply requires a reviewed production backup, alerting, and explicit operational authorization.

## Verification boundary

Run `npm run verify:backend-acceptance` from `backend`. It performs the current unit, hosted Supabase migration/restore, privacy, room isolation, auth/session, audit immutability, load, Google Maps, and retention dry-run checks. After provisioning the deployment identity, run `npm run verify:runtime-role` with its `DATABASE_URL`. The acceptance command does not claim real SMTP delivery, Expo credentials/device delivery, approved college data, or road testing.
