# 🚌 Campus Wheels — Real-Time College Transit & Fleet Intelligence Platform

[![Live Website](https://img.shields.io/badge/Live%20Website-Hero%20Page-FF6B00?style=for-the-badge&logo=vercel&logoColor=white)](https://college-bus-tracking-system-pi.vercel.app/)
[![Download APK](https://img.shields.io/badge/Download%20APK-Campus%20Wheels%20v4.0-10B981?style=for-the-badge&logo=android&logoColor=white)](https://college-bus-tracking-system-pi.vercel.app/campus-wheels.apk)
[![Backend Status](https://img.shields.io/badge/Backend%20API-Render%20Live-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://college-bus-tracking-api-2fi5.onrender.com/api/v1/health)
[![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

---

## 🌟 Live Published Deployments

| Component | Production URL | Description |
| :--- | :--- | :--- |
| 🚀 **Official Hero & Download Page** | [**https://college-bus-tracking-system-pi.vercel.app/**](https://college-bus-tracking-system-pi.vercel.app/) | Official web landing page with live app mockups, feature tour, and direct mobile APK download. |
| 📲 **Android Mobile APK (Direct Download)** | [**Download `campus-wheels.apk`**](https://college-bus-tracking-system-pi.vercel.app/campus-wheels.apk) | Standalone release APK (~43 MB) for Android devices with dual-role Passenger and Driver support. |
| 🛡️ **Administrator Web Portal** | [**Admin Portal Login**](https://college-bus-tracking-system-pi.vercel.app/admin/login) | Staff dashboard for route creation, fleet GPS tracking, Excel/CSV student rosters, and emergency reports. |
| ⚙️ **Cloud Backend API** | [**Render API Base**](https://college-bus-tracking-api-2fi5.onrender.com/api/v1) | Persistent Node.js + Express REST API and Socket.IO real-time WSS gateway. |
| 🗄️ **Database Cluster** | **Supabase PostgreSQL** | High-concurrency PostgreSQL cluster with Prisma ORM and Supavisor connection pooling. |

---

## 📖 About Campus Wheels

**Campus Wheels** is a high-availability, full-stack transit management and vehicle tracking platform engineered for college bus operations. It bridges the gap between students, faculty, bus drivers, and campus administration through sub-second GPS tracking, explainable arrival forecasting, and proactive late-arrival notifications.

### Why Campus Wheels?
- **Zero-Friction Passenger Access:** Students and faculty do not need to register, create accounts, or remember passwords. Simply tap **Passenger**, select a route, and instantly track the bus on Google Maps.
- **Dual-Role Single Binary:** Both passengers and verified drivers share a single unified Android application with an intuitive role selection landing screen.
- **Interactive Google Maps WebView:** High-performance slippy tile engine rendering real Google Maps (Roadmap & Satellite modes) without Google Cloud API key restrictions or billing failures.
- **Explainable ETAs:** Progression-aware arrival estimation that accounts for rolling speeds and scheduled windows without ever showing confusing negative ETAs.
- **Comprehensive Fleet Scope:** Supports all **31 college bus routes**. Routes with active GPS (e.g. Route 08 and DEMO) provide real-time location streaming, while pending routes present tentative pickup timings and direct contact with the Transport In-Charge.
- **Clockwise Rotating Globe & Transit Bus:** Modern 3D-styled animated road and globe loading screen for smooth transitions.

---

## 🏗️ System Architecture

```text
                  +-----------------------------------+
                  |        Students & Faculty         |
                  |     (Zero-login Passengers)       |
                  +-----------------+-----------------+
                                    |
                                    v
+-----------------------+   +-----------------------+   +-----------------------+
|  Driver GPS Console   |   |   Passenger Mobile    |   |     Admin Web App     |
| (Expo / React Native) |   | (Expo / React Native) |   |  (React 19 + Vite 8)  |
+-----------+-----------+   +-----------+-----------+   +-----------+-----------+
            |                           |                           |
            | [ WSS / Location Stream ] | [ REST / Live WSS ]       | [ HTTPS / Cookies ]
            \---------------------+-----/                           |
                                  |                                 |
                                  v                                 v
                  +-------------------------------------------------+
                  |      Campus Wheels Express.js Backend Core      |
                  |           (Node.js + Socket.IO + Zod)           |
                  +-----------------------+-------------------------+
                                          |
                                          | [ Prisma ORM 5.x ]
                                          v
                  +-------------------------------------------------+
                  |          Supabase PostgreSQL Database           |
                  |       (Pooled Connections via Supavisor)        |
                  +-------------------------------------------------+
```

> 📖 **Deep Dive Reference:** For detailed mathematical formulas, Kalman filter smoothing, ETA algorithms, security standards, and viva cheat sheet, consult [TECHNICAL_ARCHITECTURE_AND_ALGORITHMS.md](./TECHNICAL_ARCHITECTURE_AND_ALGORITHMS.md).

---

## 📱 Mobile App Highlights (`app/`)

- **Instant Dual-Role Entry:** Choose between **Passenger** and **Driver** from the launch screen.
- **Interactive Live Map:**
  - Pinned route stops with numbered badges (`1` .. `N`) and destination star (`★`).
  - Pulsing live bus marker (`🚌`) with glowing radar halo.
  - Route polyline connecting every corridor stop.
  - **🗺️ Satellite / Roadmap** layer toggle button.
  - **↻ Re-center** control to auto-fit the full route on screen.
- **Smart Route Discovery:**
  - **Live Routes (Route 08 & DEMO):** Live GPS coordinates, active trip status, and stop-by-stop passenger rosters.
  - **Tentative Routes (Routes 01–07, 09–31):** Dedicated "Route Not Published Yet" card displaying tentative morning pickup timings, driver info, and one-tap calling to Transport In-Charge (Mr. P. Venu Gopal: `+91 7993453629`).
- **Driver Navigation HUD:**
  - Pre-trip route overview card displaying the assigned route map and pinned stops prior to starting.
  - One-tap trip initiation with background GPS broadcasting.
  - Resilient offline GPS queue with automatic re-sync when network connectivity drops.
- **Animated Loading Experience:** Custom CSS/Canvas rotating globe, transit bus, and animated road on app launch and route transitions.

---

## 💻 Administrator Portal (`admin-panel/`)

- **Fleet Overview & Live Tracking:** Real-time map displaying all active trips across campus corridors.
- **Route & Stop Management:** Configure 31 routes, add pickup stops, arrival windows, and polyline coordinates.
- **Roster Management:** Bulk import and export student and faculty rosters via Excel (`.xlsx`) or CSV, segmented by academic year.
- **Driver Credential Provisioning:** Generate secure driver codes (`DRV01` .. `DRV31`) and assign routes.
- **Safety & Incident Management:** Review passenger-submitted issues and emergency/delay reports.
- **Public APK Distribution:** Distributes production Android APK directly from `/campus-wheels.apk`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile App** | React Native 0.86, Expo SDK 52, Expo Router, TypeScript, React Native WebView, Leaflet |
| **Admin Panel** | React 19, Vite 8, TailwindCSS v4, React Router 7, Leaflet, Axios |
| **Backend API** | Node.js (v20+), Express.js, Socket.IO 4.8, Prisma ORM 5.x, Zod, BCrypt |
| **Database** | PostgreSQL hosted on Supabase (with transaction connection pooling) |
| **Real-Time Layer** | WebSockets (Socket.IO) over persistent WSS |
| **Deployment** | Vercel (Frontend & APK Hosting), Render (Backend API), GitHub Actions CI/CD |

---

## 📁 Repository Structure

```text
bus-tracking-system/
├── admin-panel/              # React 19 + Vite web portal & public landing website
│   ├── public/               # Public assets and release campus-wheels.apk
│   └── src/
│       ├── screens/          # HeroLandingPage, Dashboard, Routes, Rosters, etc.
│       └── components/       # Reusable UI widgets and map views
├── app/                      # React Native / Expo mobile application
│   ├── android/              # Native Android project configuration
│   └── src/
│       ├── app/              # Expo Router screens (index, passenger, driver)
│       └── components/map/   # CampusMap WebView Google Maps component
├── backend/                  # Node.js + Express backend service
│   ├── prisma/               # Database schema & migrations
│   └── src/
│       ├── routes/           # REST endpoints (auth, routes, trips, rosters, etc.)
│       └── lib/              # Socket.IO handlers, ETA algorithms, security
├── PRD_updated.md            # Comprehensive Product Requirements Document (v4.0)
├── TECHNICAL_ARCHITECTURE... # Complete mathematical and algorithmic specification
└── README.md                 # Project documentation (this file)
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js:** v18.x or v20.x recommended
- **npm:** v9.x or higher
- **Git**
- **Android Studio / JDK 17:** (Optional, only required for building native Android APK locally)
- **Expo Go App:** Available on Google Play Store for testing on physical devices.

### 2. Clone the Repository
```bash
git clone https://github.com/Akhil-V04/college-bus-tracking-system.git
cd college-bus-tracking-system
```

### 3. Setup and Start Backend
```bash
cd backend
npm install
copy .env.example .env
# Configure DATABASE_URL (Supabase or local PostgreSQL) and JWT_SECRET in .env
npx prisma db push
npm run dev
# Backend starts at http://localhost:4000
```

### 4. Setup and Start Admin Panel (with Hero Landing Page)
```bash
cd ../admin-panel
npm install
copy .env.example .env
npm run dev
# Web application starts at http://localhost:5173
```
Visit `http://localhost:5173` to explore the **Hero Landing Page** or `http://localhost:5173/admin/login` for the admin portal.

### 5. Setup and Start Mobile App
```bash
cd ../app
npm install
copy .env.example .env
# Set EXPO_PUBLIC_API_URL to your backend (use LAN IP for physical phones, e.g., http://192.168.1.X:4000/api/v1)
npx expo start
```
Scan the displayed QR code with the **Expo Go** app on your Android device.

---

## 🔑 Demo & Test Credentials

### Driver Access (Mobile App)
| Driver Code | Password | Assigned Route | Notes |
| :--- | :--- | :--- | :--- |
| `DRV08` | *Standard driver pass* | **Route 08** | Full stop timetable with active GPS broadcasting |
| `DRVDEMO` | *Standard driver pass* | **DEMO Route** | Fast-cycle test route for end-to-end verification |

### Administrator Access (Web Portal)
- **Login Portal:** [https://college-bus-tracking-system-pi.vercel.app/admin/login](https://college-bus-tracking-system-pi.vercel.app/admin/login)
- Authenticates securely via HttpOnly session cookies and authorization tokens.

---

## 🧪 Testing & Validation

Run the automated backend test suites:
```bash
cd backend
npm test
npm run validate
```

Run TypeScript verification in the mobile app:
```bash
cd app
npm run typecheck
```

---

## 📦 Building the Production Android APK

To compile the standalone release APK locally using Android Gradle:
```bash
cd app/android
./gradlew.bat assembleRelease --no-daemon
```
The output APK will be generated at:
`app/android/app/build/outputs/apk/release/app-release.apk`

---

## 📄 License & Attribution

Developed for college transport operations. All rights reserved.  
For operational queries or route additions, contact the College Transport Department.
