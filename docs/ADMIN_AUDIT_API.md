# Administrator Audit API

Administrator audit records answer who changed trusted transport data, what kind of change occurred, which entity was affected, and when it happened. Audit writes are performed in the same PostgreSQL transaction as the corresponding mutation, so a business change cannot commit without its audit record.

## Query endpoint

`GET /admin-audit-logs`

The endpoint requires an administrator bearer token. Passenger and driver tokens cannot access it. Responses use `Cache-Control: private, no-store`.

Optional exact-match filters:

- `action`
- `entityType`
- `entityId`
- `from` — any valid ISO-8601 date/time
- `to` — any valid ISO-8601 date/time
- `page` — defaults to 1
- `limit` — defaults to 50 and is capped at 200

Results are ordered newest first and return `items`, normalized `filters`, and pagination metadata. Invalid, empty, overlong, or reversed date filters return HTTP 400.

Example:

```text
GET /admin-audit-logs?action=ROSTER_PUBLISHED&entityType=TransportRoster&page=1&limit=50
```

## Covered actions

| Area | Actions |
|---|---|
| Routes | `ROUTE_CREATED`, `ROUTE_UPDATED`, `ROUTE_DELETED` |
| Stops | `STOP_CREATED`, `STOP_UPDATED`, `STOP_DELETED` |
| Schedules | `SCHEDULE_CREATED`, `SCHEDULE_STOP_ADDED`, `SCHEDULE_STOP_UPDATED`, `SCHEDULE_STOP_REMOVED`, `SCHEDULE_PUBLISHED` |
| Rosters | `ROSTER_CREATED`, `ROSTER_FILE_IMPORTED`, `ROSTER_PASSENGERS_BULK_ADDED`, `ROSTER_PASSENGER_ADDED`, `ROSTER_PASSENGER_UPDATED`, `ROSTER_PASSENGER_REMOVED`, `ROSTER_PUBLISHED`, `ROSTER_EXPORTED` |
| Drivers | `DRIVER_CREATED`, `DRIVER_UPDATED`, `DRIVER_SESSIONS_REVOKED`, `DRIVER_DELETED` |
| Advisors | `CLASS_ADVISOR_CREATED`, `CLASS_ADVISOR_UPDATED`, `CLASS_ADVISOR_DELETED` |
| Administrator trip control | `TRIP_STARTED_BY_ADMIN`, `TRIP_ENDED_BY_ADMIN` |

Ordinary driver start/end actions are trusted operational events but are not administrator audit events. Their trip records already identify the driver and timestamps.

## Privacy and integrity rules

- Audit summaries contain operational metadata and changed-field names, not full request bodies.
- A defensive sanitizer recursively removes passwords, hashes, tokens, secrets, phone numbers, email addresses, license values, bus-pass IDs, roll numbers, faculty IDs, and notification recipients.
- Passenger names are not written to audit summaries. Passenger assignment events store only roster/type/route/stop relationships and the affected database ID.
- Driver summaries store driver code and session version, never password hashes, phone numbers, or license numbers.
- Advisor summaries store class grouping only, never name or contact details.
- Create/update/delete/publication audit writes share a transaction with the business write. Failed mutations therefore produce neither partial data nor a misleading success audit.
- There is no HTTP endpoint to modify or delete audit records.

Database administrators can still alter database rows directly, so production integrity also depends on least-privilege database roles, restricted console access, backups, and monitoring. The separate late-alert evidence chain has tamper-detection requirements that do not automatically apply to general administrator audit records.
