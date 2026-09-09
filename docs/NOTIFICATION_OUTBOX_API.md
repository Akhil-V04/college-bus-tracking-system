# Notification Outbox and Late-Alert Delivery Contract

Updated: 25 August 2026

## Purpose

Late alerts describe students assigned to a delayed bus. They are not boarding or attendance records. The backend snapshots the relevant Student class groups, resolves class advisors, creates durable notification rows and delivers those rows independently from GPS processing.

Passenger and driver endpoints never expose advisor email addresses, notification recipients, delivery errors or provider identifiers. Every endpoint in this document requires an administrator JWT.

## Delivery lifecycle

1. Three consecutive confident late ETA observations create one active `LateAlert` per trip.
2. Alert creation and notification-row creation occur in one serializable PostgreSQL transaction.
3. Every advisor row receives a stable idempotency key such as `late-alert-42-advisor-7`.
4. A worker transaction claims due `PENDING` rows using `FOR UPDATE SKIP LOCKED` and a persisted lock token.
5. The provider is called outside the claim transaction.
6. Success changes the row to `SENT` and records `sentAt`, `lastAttemptAt`, attempts and the provider message ID.
7. A transient failure remains `PENDING` and receives a persisted future `nextAttemptAt`.
8. SMTP 5xx/permanent rejection or the maximum attempt count changes the row to `FAILED`.
9. A crashed worker's lock becomes claimable after the lock timeout.
10. An administrator can manually requeue one failed row or every failed row. Retry actions are audited.

## Status meanings

| Status | Meaning |
|---|---|
| `PENDING` | New, scheduled for retry, or manually requeued. `nextAttemptAt` says when it becomes claimable. |
| `SENT` | Provider accepted the message. This is not proof the human opened it. |
| `FAILED` | Permanent provider rejection or automatic retry limit reached. Administrator action is required. |

Automatic retry delays are 1 minute, 5 minutes, 15 minutes, 1 hour and 6 hours. The automatic attempt limit is five. A manual retry of a failed item grants another delivery call but keeps the historical attempt count.

## Provider configuration

The worker is disabled by default.

```env
NOTIFICATION_PROVIDER="disabled" # disabled | console | smtp
NOTIFICATION_POLL_INTERVAL_MS="5000"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="transport@college.edu"
```

- `disabled`: rows remain durable and visible as pending; no provider call occurs.
- `console`: local simulation that logs only the outbox ID/idempotency key and marks the row sent. It never logs the recipient.
- `smtp`: Nodemailer sends the email using private environment configuration.

The email explicitly says the list represents assigned students and is not a bus-attendance record. Dynamic values are HTML-escaped.

## Administrator endpoints

### `GET /late-alerts`

Returns today's late alerts. Optional query:

```text
notificationStatus=PENDING|SENT|FAILED
```

Each alert contains private delivery rows and a derived `missingAdvisorGroups` array. Missing groups are calculated from the immutable student/advisor alert snapshots, so an absent advisor mapping is not silently lost.

Response header: `Cache-Control: private, no-store`.

### `GET /late-alerts/notification-summary`

Returns:

- active alert count;
- pending, sent, failed and total notification counts;
- recent alerts containing class groups with no advisor mapping.

No recipient addresses are included in this summary.

### `POST /late-alerts/notifications/:id/retry`

Requeues one `FAILED` row and returns HTTP 202. A `SENT` or already-`PENDING` row returns HTTP 409 to avoid interfering with a worker currently delivering it.

### `POST /late-alerts/notifications/retry-failed`

Requeues all currently `FAILED` rows and returns:

```json
{ "queued": 4 }
```

### `GET /late-alerts/verify`

Recomputes the immutable late-alert hash chain and reports whether the evidence chain is valid.

## Concurrency and idempotency

- `FOR UPDATE SKIP LOCKED` prevents two healthy workers from claiming the same due row.
- Lock tokens prevent a stale worker from updating a row after ownership changed.
- Expired locks allow recovery after process crashes.
- A unique database idempotency key prevents duplicate logical outbox rows.
- Alert creation uses a partial unique active-trip index and a PostgreSQL advisory transaction lock, preventing duplicate active alerts and branched hash-chain writes across backend instances.
- SMTP receives a deterministic Message-ID and notification header. SMTP does not guarantee exactly-once processing if the worker crashes after the provider accepts a message but before PostgreSQL records success. A future HTTP email provider with native idempotency can close that provider-specific gap.

## Verification

```powershell
cd E:\bus-tracking-system\backend
npm run validate
node scripts/verify-notification-outbox.js
```

The integration script creates isolated temporary records, verifies competing claims, retry recovery, stale-lock recovery and the unique idempotency constraint, and removes only those temporary records afterward.
