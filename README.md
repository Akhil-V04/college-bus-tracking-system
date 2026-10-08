# College Bus Tracking System

A comprehensive, full-stack college bus tracking system built to manage transport operations for colleges. It provides a real-time passenger dashboard, an administrative panel for staff, and a dedicated backend for data management, routing, and notifications.

## Project Overview

The application solves the problem of tracking college buses, managing driver/passenger rosters, and providing real-time ETA updates. It is used by passengers (students, faculty), bus drivers, and college transport administrators.
Main features include real-time bus tracking, emergency accident reporting, passenger feedback/issue reporting, driver login to broadcast locations, and an admin panel to manage routes, buses, stops, and schedules. The current project is functional with core architecture across three connected modules: mobile app, backend, and admin web panel.

## Technology Stack

**Frontend (Mobile App):**
- React Native
- Expo
- Expo Router
- TypeScript

**Frontend (Admin Panel):**
- React
- Vite
- TailwindCSS

**Backend:**
- Node.js
- Express
- Prisma (ORM)
- Socket.io (Real-time tracking)
- Zod (Validation)

**Database:**
- PostgreSQL (via Prisma)

**Authentication:**
- Custom JWT (Driver & Admin)
- Secure session cookies

## Architecture

```text
       Passengers / Drivers
               |
               v
     Expo / React Native App
               |
    [ REST API & WebSockets ]
               |
               v
   Backend API (Express/Node.js) <---- [ REST API ] ---- Admin Panel (React/Vite)
               |
               v
     PostgreSQL Database (Prisma)
```

**Mobile App:** Provides passengers with tracking features and allows drivers to update GPS.
**Backend:** Handles business logic, socket real-time routing, role-based auth, and rate-limiting.
**Admin Panel:** A web dashboard for staff to add routes, manage rosters, and view reported issues.
**Database:** Stores persistent data including routes, issues, users, and audit logs.

## Project Structure

```text
bus-tracking-system/
├── admin-panel/          # React web app for administrators
├── app/                  # React Native mobile application for passengers/drivers
├── backend/              # Node.js Express server + Prisma Database
├── .env.example          # Aggregated environment variables example
├── README.md             # This file
└── .gitignore            # Ignored files
```

## Application Screens / Routes

**Mobile App:**
- `/passenger` - Passenger dashboard showing active routes, ETA, and emergency contacts.
- `/passenger/report-issue` - Dynamic form for reporting bus or app issues.
- `/passenger/emergency` - Report an accident or major delay.
- `/passenger/search` - Look up bus stops and view route information.
- `/driver/login` - Secure login exclusively for assigned drivers.
- `/driver` - Driver console for starting trips and broadcasting location.

**Admin Panel:**
- Dashboard - General statistics and reports.
- Routes / Stops / Rosters - Data grids to manage transport lists and bus configurations.

## Core Features

- Real-time bus tracking (GPS via WebSockets)
- Emergency / Accident reporting
- Issue and feedback submission
- Driver authentication and trip broadcasting
- Dedicated Admin Web Panel for transport staff
- AI Assistant embedded in the mobile app for policy queries

## Data Flow

1. **Driver** logs in and starts a trip -> The mobile app continuously sends GPS points via WebSocket to the Backend.
2. **Passenger** opens the app -> App fetches active routes via REST API from Backend.
3. **Passenger** views map -> App establishes a WebSocket connection to receive real-time driver coordinates.
4. **Admin** views the web panel -> Panel fetches database records (reports, trips, routes) from the Backend via protected REST APIs.

## Environment Variables

The repository uses environment variables for configuration.
1. Copy `.env.example` to `.env` in the root (or directly inside `app/`, `backend/`, `admin-panel/`).
2. Fill in the required values (e.g., `DATABASE_URL`, `JWT_SECRET`, `VITE_API_URL`, `EXPO_PUBLIC_API_URL`).
3. **Never commit `.env` containing real credentials.**

*Note: Public variables usually start with `EXPO_PUBLIC_` or `VITE_`. Backend database strings and secrets are strictly server-side.*

## Prerequisites

- Windows 10/11 (or macOS/Linux)
- Git
- Node.js (v18 or higher recommended)
- npm
- Expo Go app on your physical iOS/Android device
- A PostgreSQL database (can be local or hosted, e.g. Supabase)

## Setup on a New PC

```bash
# 1. Clone the repository
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd bus-tracking-system

# 2. Start the Backend
cd backend
npm install
copy .env.example .env
# Fill in DATABASE_URL and secrets in backend/.env
# Setup Database schema
npx prisma db push
npm run dev

# 3. Start the Admin Panel
cd ../admin-panel
npm install
copy .env.example .env
# Ensure VITE_API_URL points to the backend
npm run dev

# 4. Start the Mobile App
cd ../app
npm install
copy .env.example .env
# Ensure EXPO_PUBLIC_API_URL points to the backend
npx expo start
```

For the mobile app, scan the QR code with **Expo Go** on an Android phone. If your phone and PC cannot connect over the same Wi-Fi, start the app with:
```bash
npx expo start --tunnel
```

## Running the Application

- **Backend:** Runs on port 4000 (usually `http://localhost:4000`).
- **Admin Panel:** Runs via Vite (usually `http://localhost:5173`). Open this URL in your web browser.
- **Mobile App:** Runs via Expo. Use Expo Go on your mobile device to test.

## Development Workflow

1. Git pull the latest changes.
2. Install any new dependencies across the three folders (`npm install`).
3. Make sure your `.env` variables match `.env.example`.
4. Run `npm run dev` / `npx expo start` in the required modules.
5. Save files to automatically trigger Hot Reload / Fast Refresh.
6. Commit changes systematically.

## Git Workflow

```bash
git checkout -b feature/my-new-feature
git add .
git commit -m "Add my new feature"
git push origin feature/my-new-feature
```
Always pull from the main branch before creating a new feature branch.

## API / Backend Configuration

The backend is an Express.js API located in the `backend/` folder.
- Base URL is `/api/v1`
- JWT is used for Driver authentication; secure HttpOnly cookies are used for Admin authentication.
- Endpoints are defined in `backend/src/routes`.

## Database

- **Technology:** PostgreSQL
- **ORM:** Prisma
- **Location:** Configured via `DATABASE_URL` in `backend/.env`.
The schema defines entities like `Route`, `Driver`, `FeedbackReport`, and `AdminSession`. All models are strictly managed through Prisma migrations or `prisma db push`.

## Authentication

- **Driver:** Logs in using a unique code/username and password via the Mobile App. The backend issues a JWT token saved locally on the device.
- **Admin:** Logs in via the Admin Panel. The backend uses secure HttpOnly cookies for session management.

## Testing

Automated testing is configured in the backend utilizing Node's native test runner (`node --test`) and Supertest.
Run tests from the `backend/` directory:
```bash
npm test
npm run validate
```
*(Automated tests are not currently configured for the React Native app or Admin Panel)*

## Build / Deployment

The React Native application is configured for Expo EAS builds (`eas.json` is present in the `app` folder).
Production build configuration for the backend is partially configured via Render (`render.yaml`) and Docker Compose (`compose.production.example.yml`).
To deploy the mobile app with EAS:
```bash
eas build --profile production --platform android
```

## Troubleshooting

1. **Expo cannot connect to phone**
   - Ensure PC and phone are on the exact same Wi-Fi network.
   - Use `npx expo start --tunnel` to bypass local network restrictions.
2. **Dependencies problem**
   - Delete `node_modules` and run `npm install` again.
3. **Database connection failed**
   - Verify `DATABASE_URL` in `backend/.env` is accessible and properly formatted.
4. **App cannot fetch data**
   - Make sure `EXPO_PUBLIC_API_URL` uses your local IP address (e.g. `http://192.168.1.5:4000/api/v1`) instead of `localhost` if testing on a physical phone.

## Known Issues

- The AI assistant requires a valid Gemini API key (`AI_API_KEY`) for generating document embeddings, and a Groq API key (`GROQ_API_KEY`) for chat responses. If either is missing, it will hang or error out.

## Important Development Rules

- **Don't commit secrets:** Always review `git status` before committing.
- **API Contracts:** Check backend routing and validation (Zod schemas) before changing API payloads.
- **Database:** Don't change database structure without checking `Prisma` dependencies and running migrations.
- **Preserve navigation structure:** Do not alter the core bottom tab navigation without thorough testing.

## AI Coding Agent Instructions

If you are an AI coding agent (like Google Antigravity) assigned to work on this repository, please:
1. **Read this README.md first.**
2. Inspect the repository structure (`app`, `backend`, `admin-panel`) before modifying code.
3. Understand the architecture: this is a monorepo-style structure but without a root package manager.
4. Never expose or request secrets unnecessarily.
5. Never overwrite working functionality without checking dependencies.
6. Follow existing coding patterns (e.g., using `components/ui` for UI components).
7. Check `package.json` before installing new packages.
8. Check environment variables before changing API configuration.
9. Run appropriate validation (`tsc --noEmit` in `app`, `npm test` in `backend`) after modifications.
10. Explain which files were changed and why.
11. **Never fabricate APIs, routes, database tables, or configuration.**

## Quick Start

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd bus-tracking-system

# Install and configure backend
cd backend
npm install
copy .env.example .env
# Edit backend/.env to include your PostgreSQL connection URL
npx prisma db push
npm run dev

# Open new terminal, configure app
cd ../app
npm install
copy .env.example .env
# Edit app/.env to point EXPO_PUBLIC_API_URL to your backend
npx expo start
# Scan the QR code with Expo Go!
```
