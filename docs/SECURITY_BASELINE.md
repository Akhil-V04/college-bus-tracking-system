# Backend Security and Privacy Baseline

Updated: 25 August 2026

This document describes the implemented Phase 6 baseline. It is not a claim that the system is ready for public production deployment.

## Implemented controls

### Authentication and authorization

- Administrator and driver JWTs are signed by the backend.
- Administrator JWTs also require a matching active PostgreSQL session, enabling immediate logout and individual/all-session revocation.
- Production defaults to two-hour administrator sessions and twelve-hour driver tokens; placeholder or shorter-than-32-character signing secrets fail startup.
- Password rotation revokes active administrator sessions before replacing the local hash.
- Administrator endpoints require the `admin` role.
- Driver trip/location operations require the `driver` role, the assigned driver ID and the current driver session version.
- Passenger endpoints require no login and use explicit Prisma `select` shapes.
- The obsolete development `/auth/seed-passwords` endpoint was removed. Administrator password hashes are created with the local `npm run admin:set-password` script instead of an HTTP endpoint.

### Browser/API protections

- Helmet adds API security headers including a deny-by-default content security policy, frame protection, MIME sniffing protection and related defaults.
- CORS accepts only configured administrator origins. Requests with a hostile browser Origin receive HTTP 403.
- Requests without an Origin remain allowed for React Native, server-to-server checks and command-line clients.
- JSON request bodies are capped at 2 MB. Roster uploads have their separate file/row/cell limits.
- Every response receives an `X-Request-Id` correlation header.

### Rate limits

| Boundary | Default | Behavior |
|---|---:|---|
| Failed login | 10 per 15 minutes per client | Successful logins are not counted; excess failures return 429. |
| Roster preview/import | 20 per 10 minutes per client | Protects CPU/memory-heavy file parsing. |
| Driver GPS socket events | 120 per 60 seconds per socket | Excess events are rejected with `RATE_LIMITED` and `retryAfterMs`. |

These default values are deliberately generous for normal operation. Production behind a reverse proxy must configure Express proxy trust correctly before depending on client-IP rate limits. The current in-memory rate-limit store is per backend process; a multi-instance production deployment should use a shared store such as Redis.

### Privacy-safe request logs

Structured request logs contain only:

- event type;
- request ID;
- method;
- matched route path without query values;
- HTTP status;
- duration;
- authenticated role or `anonymous`.

Bodies, query strings, headers, tokens, IP addresses, email addresses, phone numbers and passenger identifiers are not included. Set `REQUEST_LOGGING_ENABLED="false"` for test environments where logs are unnecessary.

### Non-admin response privacy

The read-only database/API verification checks public passenger routes, route details, public roster views and the driver `/auth/me` response for forbidden private keys. It also confirms anonymous and driver requests cannot enter driver-administration, late-alert or audit endpoints.

Forbidden non-admin keys include phone/password/hash/license/email/recipient/provider identifiers, bus-pass IDs, roll numbers, faculty IDs and administrator audit details.

## Configuration

```env
ADMIN_SESSION_TTL_MINUTES="720"
DRIVER_TOKEN_TTL_MINUTES="10080"
REQUEST_LOGGING_ENABLED="true"
LOGIN_RATE_LIMIT_WINDOW_MS="900000"
LOGIN_RATE_LIMIT_MAX="10"
IMPORT_RATE_LIMIT_WINDOW_MS="600000"
IMPORT_RATE_LIMIT_MAX="20"
GPS_RATE_LIMIT_WINDOW_MS="60000"
GPS_RATE_LIMIT_MAX="120"
```

Only positive integers are accepted; invalid values fall back to safe defaults.

## Verification

```powershell
cd E:\bus-tracking-system\backend
node --test tests/security.test.js
node scripts/verify-api-privacy.js
npm run verify:admin-sessions
npm run validate
```

The focused test covers security headers, CORS rejection, authorization, removal of the hash helper, failed-login throttling, log redaction and GPS throttling. The integration script performs read-only checks against local PostgreSQL and does not create or delete project data.

## Remaining security work

- Use a shared production rate-limit store for multiple backend instances.
- Decide and configure trusted reverse-proxy behavior at deployment time.
- Two-route Socket.IO isolation and administrator revoked-session integration are verified.
- Clean-schema migration/seed and local role-capability verification are complete; production migrator/runtime role separation remains deployment work.
- Generated import/outbox load and resource-limit verification is complete; HTTP reverse-proxy and staging abuse tests remain.
- Database-backed administrator revocation and credential/signing-key rotation behavior are documented; production cookie migration remains final-frontend work.
- Add privacy-safe error monitoring, retention policy and operational alerts.
- Isolated local dump/restore is complete; managed production backup retention, monitoring and periodic restore drills remain.
- Perform dependency review and resolve compatible upstream audit findings.
- Run external security review before public deployment.
