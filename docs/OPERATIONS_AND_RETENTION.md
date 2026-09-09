# Operations, Monitoring and Retention

## Health and monitoring

- `GET /health` is a process liveness check and does not query private data.
- `GET /health/ready` verifies PostgreSQL connectivity. A load balancer should send traffic only after this returns 200.
- `GET /api/v1/operations/summary` is administrator-only and reports running/stale trips, active late alerts, pending/failed notifications and active administrator sessions. It contains no phone numbers, passenger identifiers or notification recipients.
- Structured request logs contain request ID, method, matched path, status, duration and authenticated role only. Alert on readiness failures, repeated 5xx responses, stale running trips, failed notifications and an unexpected rise in authentication failures.

## Retention implementation

`npm run maintenance:retention` is a read-only dry run. `npm run maintenance:retention:apply` deletes only:

- expired rate-limit buckets; and
- expired or revoked administrator sessions whose expiry is older than `ADMIN_SESSION_RETENTION_DAYS` (default 90 days).

Late-alert evidence, administrator audit logs, published/draft rosters, schedules, trips and GPS history are deliberately not auto-deleted. The college must approve legal, operational and backup-retention periods before those records receive an automated deletion policy. Annual roster replacement publishes a new version; it does not silently mutate historical trip evidence.

Run retention from one scheduled production job, capture its JSON report, and back up before changing any policy. Never run an `--apply` job against a database whose target environment has not been verified.

## Deployment controls

- Production requires `RATE_LIMIT_STORE=postgres` so multiple backend instances share failed-login and import limits.
- Production requires an explicit integer `TRUST_PROXY_HOPS` from 0 to 5. Use the exact number of controlled reverse-proxy hops; never set Express trust proxy to an unrestricted boolean.
- Use a long random `JWT_SECRET`, HTTPS, restricted CORS origins and separate PostgreSQL migration/runtime roles.
- The notification provider remains disabled until SMTP credentials, sender policy and a delivery pilot are approved.

## Dependency policy

Run `npm audit --omit=dev` and normal build/test validation before releases and monthly during maintenance. Review transitive findings in context; do not use forced automatic fixes that downgrade core packages or change APIs without regression testing. Commit lockfiles and upgrade dependencies in reviewable batches.
