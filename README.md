# College Bus Tracking System

A live bus tracking platform covering 31 college bus routes. Three parts share one backend:

```
bus-tracking-system/
├── backend/          # Node + Express + Prisma + Socket.io
├── admin-panel/      # React + Vite (website, browser only)
└── mobile-app/       # Flutter (student + driver, installs on phone)
```

## How to run

### Backend
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
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
