# College Bus Tracking System

A live route tracking, annual passenger-roster, smart ETA, and class-advisor late-alert platform covering 31 college routes. The authoritative product requirements are in [PRD.md](./PRD.md).

```
bus-tracking-system/
├── backend/          # Node + Express + Prisma + Socket.io
├── admin-panel/      # React + Vite (admin-only website)
└── mobile-app/       # Flutter (no-account passenger + authenticated driver)
```

## How to run

### Backend
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev
npx prisma db seed          # optional local demo data
npm run dev            # http://localhost:4000
```

### Admin panel
```bash
cd admin-panel
npm install
npm run dev            # http://localhost:5173
```

### Mobile app
```bash
cd mobile-app
flutter pub get
flutter run
```

## Current implementation status

The repository is undergoing the PRD v1 schema-first refactor. The backend foundation now uses route services, versioned schedules and rosters, unified student/faculty passenger rows, secure driver-code authentication, trip snapshots, stateful ETA responses, and notification outbox records. The React and Flutter clients still contain prototype screens that will be updated in the next phases.
