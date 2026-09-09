# Deployment and Release

## Local release gate

From each package, run the commands below before creating a release:

```powershell
cd E:\bus-tracking-system\backend
npm run validate
npm run verify:shared-rate-limit
npm run verify:admin-sessions
npm run verify:admin-cookie-auth
npm run verify:release-api

cd E:\bus-tracking-system\admin-panel
npm run build

cd E:\bus-tracking-system\mobile-app
npm run typecheck
npx expo config --type public
```

GitHub Actions repeats the portable checks with PostgreSQL 18. Clean-schema and backup/restore drills remain explicit operator checks because they require local PostgreSQL command-line tools and a deliberately restricted role.

## Container staging

`compose.production.example.yml` is a staging template, not a secrets file. Supply `POSTGRES_PASSWORD`, a 32+ character random `JWT_SECRET`, administrator email/hash and `PUBLIC_ORIGIN` through the deployment secret manager. Start it with a TLS reverse proxy in front of port 8080. The migration service runs versioned Prisma migrations before the backend becomes healthy; Nginx serves the SPA and proxies `/api` and Socket.IO to the backend.

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
