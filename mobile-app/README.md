# College Bus Tracker mobile app

React Native application built with Expo SDK 57, TypeScript and Expo Router.

Passengers use public routes without accounts. Drivers authenticate, start/end their assigned trip and share only the bus device location. The app never connects directly to PostgreSQL.

## Local setup

1. Copy `.env.example` to `.env`.
2. Use `http://10.0.2.2:4000` for an Android emulator or the laptop LAN address for a physical phone.
3. Start the backend.

```powershell
cd E:\bus-tracking-system\mobile-app
npm install
npm run typecheck
npm start
```

The API client adds `/api/v1` when the configured URL is an origin.

## Background driver GPS

Background location is defined at module scope with Expo TaskManager and requires an Expo development build; it does not work in Expo Go. The driver sees a permission explanation first, Android displays a persistent foreground-service notification, and tracking stops on pause/end/logout. Up to 200 unsent samples are stored locally, retried oldest-first with original device timestamps, and then bounded by dropping the oldest samples with a visible dropped count.

See `../docs/DEPLOYMENT_AND_RELEASE.md` for EAS commands and the mandatory real-device test matrix.

## Validation

```powershell
npm run typecheck
npx expo config --type public
npx expo export --platform web
```