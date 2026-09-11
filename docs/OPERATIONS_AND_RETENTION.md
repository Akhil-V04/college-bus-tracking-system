# Operations, Monitoring and Retention

## Health and monitoring

- `GET /health` is a process liveness check and does not query private data.
- `GET /health/ready` verifies PostgreSQL connectivity. A load balancer should send traffic only after this returns 200.
- `GET /api/v1/operations/summary` is administrator-only and reports running/stale trips, active late alerts, email and push backlogs, active push subscriptions, unresolved feedback, active/unverified emergencies, open assistance offers and active administrator sessions. It contains no phone numbers, passenger identifiers, device tokens or notification recipients.
- Structured request logs contain request ID, method, matched path, status, duration and authenticated role only. Alert on readiness failures, repeated 5xx responses, stale running trips, failed notifications and an unexpected rise in authentication failures.

## Retention implementation

`npm run maintenance:retention` is a read-only dry run. `npm run maintenance:retention:apply` deletes only:

- expired rate-limit buckets; and
- expired or revoked administrator sessions whose expiry is older than `ADMIN_SESSION_RETENTION_DAYS` (default 90 days);
- accepted GPS older than `RAW_GPS_ACCEPTED_RETENTION_DAYS` (default 7 days) only after its completed/cancelled trip has segment evidence;
- rejected GPS diagnostics older than `RAW_GPS_REJECTED_RETENTION_DAYS` (default 2 days) only for non-running trips; and
- ETA calibration snapshots older than `ETA_CALIBRATION_RETENTION_DAYS` (default 30 days) only for non-running trips.

Expired push subscriptions are deactivated. Compact late-alert, audit, trip-snapshot, transfer, segment, lateness, feedback, and emergency evidence remains long-term. Annual roster replacement publishes a new version and snapshots affected trips; physical removal of superseded passenger rows remains disabled until a tested backup and explicit purge authorization exist.

Run retention from one scheduled production job, capture its JSON report, and back up before changing any policy. Never run an `--apply` job against a database whose target environment has not been verified.

## Deployment controls

- Production requires `RATE_LIMIT_STORE=postgres` so multiple backend instances share failed-login and import limits.
- Production requires an explicit integer `TRUST_PROXY_HOPS` from 0 to 5. Use the exact number of controlled reverse-proxy hops; never set Express trust proxy to an unrestricted boolean.
- Use a long random `JWT_SECRET`, HTTPS, restricted CORS origins and separate PostgreSQL migration/runtime roles.
- SMTP remains simulated until credentials, sender policy and a delivery pilot are available. Expo push remains simulated until Expo credentials and device tests are available.

## Dependency policy

Run `npm audit --omit=dev` and normal build/test validation before releases and monthly during maintenance. Review transitive findings in context; do not use forced automatic fixes that downgrade core packages or change APIs without regression testing. Commit lockfiles and upgrade dependencies in reviewable batches.
