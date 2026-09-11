# API Contract v1

The stable HTTP base path is `/api/v1`. Existing unversioned paths remain temporarily available for the reference clients, but new clients must use v1.

## Common rules

- JSON responses carry `X-API-Version: 1` and `X-Request-Id`.
- Errors use `{ "error": "safe message" }` with an appropriate HTTP status.
- Administrator and driver requests use `Authorization: Bearer <token>`.
- Passenger endpoints require no account and return no phone number, credential, licence number, or private identifier.
- Administrator-only responses use `Cache-Control: private, no-store` where they contain operational or private data.
- Times are ISO 8601 instants except published stop times, which are `HH:mm` in the configured college timezone.

## Stable route groups

| Prefix | Access | Purpose |
|---|---|---|
| `/api/v1/auth` | mixed | administrator/driver login, current identity, logout and administrator sessions |
| `/api/v1/passenger` | public | route list/detail, assigned passenger list, live ETA |
| `/api/v1/route-services` | administrator | operational route number, capacity and driver assignment |
| `/api/v1/stops` | administrator | route stop coordinates |
| `/api/v1/schedules` | administrator | draft/version/publish schedule lifecycle |
| `/api/v1/rosters` | administrator | annual draft/import/validate/publish/export workflow |
| `/api/v1/drivers` | administrator | private driver records and credential reset |
| `/api/v1/class-advisors` | administrator | private class-to-advisor mappings |
| `/api/v1/trips` | driver/administrator | trip lifecycle and driver reconnect state |
| `/api/v1/push-subscriptions` | mixed | anonymous/driver devices and stop-alert preferences |
| `/api/v1/feedback` | mixed | anonymous submission and administrator workflow |
| `/api/v1/emergencies` | mixed | active-trip reports, confirmation and assistance |
| `/api/v1/late-alerts` | administrator | evidence, delivery state and retry controls |
| `/api/v1/admin-audit-logs` | administrator | immutable application-level audit history query |
| `/api/v1/operations` | administrator | privacy-safe operational health summary |

## Public DTO boundary

Passenger route DTOs may include route number, route name, covered area, capacity, assigned count, driver name, published schedule, trip state and Student/Faculty-labelled assigned names. They must never include phone numbers, password hashes, driver licence numbers, bus-pass IDs, student roll numbers, faculty IDs, administrator data, notification recipients or audit records.

## Compatibility policy

Breaking field or state changes require a new major API prefix. Additive optional fields may be introduced in v1. ETA state names and privacy exclusions are contractually stable. The Socket.IO endpoint remains at the server origin; its `bus:update`, `trip:stale` and recovery events are documented in `LIVE_TRACKING_API.md`.

The expanded backend workflow and request guards are documented in `BACKEND_WORKFLOWS_V1.md`.
