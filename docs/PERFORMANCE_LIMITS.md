# Performance and Resource-Limit Baseline

Last verified: 25 August 2026

This is a repeatable local acceptance baseline, not a production-capacity promise. Production infrastructure, real network latency, SMTP latency, database size and concurrent users will change the results.

## Enforced roster limits

| Limit | Enforced value | Reason |
|---|---:|---|
| HTTP upload size | 5 MB | Bounds in-memory Multer uploads |
| Passenger rows | 10,000 | Bounds parsing, validation and one import transaction |
| Columns | 30 | Rejects unexpectedly wide CSV and XLSX files |
| Canonical cell length | 500 characters | Bounds stored/validated text |
| Uploaded files | 1 | Rejects multipart upload abuse |

The 30-column limit is applied to both CSV and XLSX. XLSX formulas are rejected, exports neutralize spreadsheet-formula prefixes, and imports write in batches of 500 inside one transaction.

## Local measured result

Command:

```powershell
cd E:\bus-tracking-system\backend
npm run verify:load-limits
```

On the local development machine, a generated 10,000-row CSV was 1,053,820 bytes. Parsing and full Student/Faculty validation took 92 ms with an observed heap increase of 18.1 MiB. The check also proved that 10,001 rows, 31 columns and a 501-character canonical cell are rejected.

The thresholds in the verification script are deliberately generous: under 15 seconds and under 256 MiB heap increase. They detect major regressions without treating normal machine-to-machine variation as a failure.

## Notification outbox concurrency

The worker claims at most 100 due notifications per batch even if configured with a larger value. Claims use PostgreSQL `FOR UPDATE SKIP LOCKED` and unique lock tokens.

The local verification generated 500 isolated notifications and started five workers concurrently. Each worker claimed 100 rows; all 500 unique idempotency keys were delivered exactly once by the test provider in 257 ms. The generated alert, trip, roster, route, driver and notification rows were then removed.

The script refuses to start this part when any pre-existing notification is `PENDING`, preventing it from claiming normal application data. The provider is an in-memory test double: these timings do not measure SMTP throughput. SMTP delivery and provider throttling require a separate staging pilot.

## Repeatable acceptance conditions

- Exactly 10,000 generated roster rows parse and validate successfully.
- The generated file remains below the 5 MB transport limit.
- Row, column and cell limits reject one-over-limit inputs.
- Five concurrent workers claim 500 isolated notifications as five disjoint 100-row batches.
- No idempotency key is delivered twice.
- All generated notification rows finish as `SENT` and all fixture records are cleaned up.

## Production work still required

- Run HTTP-level import tests through the deployed reverse proxy, including 5 MB boundary and slow-upload behavior.
- Test realistic imports against production-like database volume and connection limits.
- Measure real SMTP provider throughput, timeout, throttle and retry behavior.
- Define worker count, database pool size and autoscaling limits from staging evidence.
- Add continuous latency, queue-depth, failure-rate, database and memory monitoring.
- Repeat load and restore drills before each pilot or material infrastructure change.
