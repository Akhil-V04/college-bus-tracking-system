# Authentication Session Contract

Last updated: 25 August 2026

Passengers never sign in. Drivers and administrators use separate controls.

## Administrator browser sessions

Successful administrator login creates a PostgreSQL `AdminSession` and signs a JWT containing its opaque ID. The JWT is sent in a `college_bus_admin` cookie with `HttpOnly`, `SameSite=Strict`, `Path=/`, bounded `Max-Age`, and `Secure` in production. The browser-readable JSON response does not contain the administrator token.

Every request validates signature, issuer, audience, expiry, matching owner and an unrevoked/unexpired database session. Cookie-authenticated mutations also require `X-Requested-With: college-bus-admin`; this custom header plus strict CORS prevents ordinary cross-site form requests. Bearer administrator tokens remain supported only for controlled integrations and tests.

- Production default lifetime: 120 minutes; maximum accepted: 480 minutes.
- Development default: 720 minutes.
- Configure with `ADMIN_SESSION_TTL_MINUTES`.
- Retention maintenance removes only inactive sessions whose expiry is older than `ADMIN_SESSION_RETENTION_DAYS` (default 90).

### Endpoints

- `POST /api/v1/auth/login`: sets the administrator cookie and returns role, ID and expiry. Driver login still returns a JWT for SecureStore.
- `GET /api/v1/auth/me`: returns current identity/session timestamps, never credentials.
- `POST /api/v1/auth/logout`: revokes the current session and expires the cookie.
- `GET /api/v1/auth/admin/sessions`: returns up to 200 retained sessions, newest first.
- `POST /api/v1/auth/admin/sessions/:id/revoke`: revokes one owned session.
- `POST /api/v1/auth/admin/sessions/revoke-all`: revokes every active administrator session and expires the cookie.

The final React admin sends cookies with credentials and clears obsolete local-storage keys. It does not store administrator bearer tokens.

## Rotation

`npm run admin:set-password` revokes active administrator sessions before replacing the local hash. Changing `JWT_SECRET` and restarting all instances invalidates every driver and administrator token; production rotation therefore needs a coordinated sign-in window.

## Driver tokens

Drivers use a JWT stored with Expo SecureStore and a database `sessionVersion`. Password reset/session revocation increments that version. Production defaults to 12 hours and is capped at 24 hours through `DRIVER_TOKEN_TTL_MINUTES`.