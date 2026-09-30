# Deployment and Release

## Local release gate

From each package, run the commands below before creating a release:

```powershell
cd E:\bus-tracking-system\backend
npm run verify:backend-acceptance
```

The consolidated command checks `DATABASE_URL` runtime reachability, then uses `DIRECT_URL` for mutation-heavy integration, clean-schema, and backup/restore drills so the transaction pool is not exhausted. It removes all temporary fixtures. Configure `DATABASE_URL` for runtime traffic and `DIRECT_URL` for migrations and PostgreSQL tooling. For Supabase, transaction mode on port 6543 can serve scalable runtime traffic; migrations, dump/restore, and the acceptance drill use session mode on port 5432 or a direct connection.

Frontend build/type checks remain deferred until backend Phase B9 is accepted.

## Container staging

`render.yaml` is the backend deployment blueprint. Supply the restricted runtime `DATABASE_URL`, a 32+ character random `JWT_SECRET`, administrator email/hash, Google Maps key, and eventual provider credentials through Render secret environment variables. Keep the owner-level `DIRECT_URL` outside runtime services and use it only in a controlled migration job or operator environment before promotion. Follow `SUPABASE_RENDER_DATABASE.md`. The scheduled retention service is dry-run only.

The web service also requires the exact future administrator origin in `CORS_ORIGINS`; use a single HTTPS Vercel origin initially and add comma-separated approved origins only when needed. `REQUIRE_RESTRICTED_DB_ROLE=true` makes startup and `/health/ready` fail if Render accidentally receives the owner credential. Render terminates TLS for HTTPS/WSS, forwards one trusted proxy hop, and sends `SIGTERM`; the backend stops workers, closes Socket.IO/HTTP, disconnects Prisma, and bounds shutdown to ten seconds.

After deployment, set `HOSTED_BACKEND_URL` privately to the Render HTTPS origin and run `npm run verify:hosted-render`. It verifies liveness, restricted database readiness, safe public access, hostile-origin rejection, security headers, two WSS connections/reconnection, and that health payloads contain no provider or database secrets. Run `npm run verify:restricted-acceptance` separately against the same restricted Supabase identity before promotion.

The example uses one database owner for compact staging. Production must split migration ownership from the restricted runtime role as described in `DATABASE_RECOVERY.md`.

## Mobile builds

Background location is a native capability and does not work in Expo Go. Use an Expo development build first:

```powershell
cd E:\bus-tracking-system\mobile-app
npx eas-cli build --profile development --platform android
```

Set `EXPO_PUBLIC_API_URL` to the HTTPS API origin (the client adds `/api/v1` when absent). Verify permission education, the persistent Android location notification, phone locking, network loss/recovery, the 200-sample queue limit, trip ending and logout on a real device. Only then create preview/production builds from `eas.json`.

## Release blockers outside this repository

- real route/stops/times, drivers, advisors and annual passenger roster approved by the college;
- HTTPS domain, hosting and secret-manager access;
- SMTP sender account and delivery/retry pilot;
- Android device/background/battery-optimization testing;
- route-distance, skipped-stop and ETA calibration on real roads; and
- a supervised pilot with transport staff before public rollout.

These are operational approvals and measurements; no code change can truthfully mark them complete in a local workspace.
