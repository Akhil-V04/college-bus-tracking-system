# College Bus Tracking System — Team Project Plan

## 1. What we're building

A live bus tracking platform for our college (located in Aushapur, Hyderabad) covering all **31 bus routes** across the city. Every bus must reach college before **9:50 AM** (first period start). The system has three user-facing parts sharing one backend:

- **Student app** — see their bus's live location, a stop-by-stop timeline, ETA, driver/incharge contact, and occupancy.
- **Driver app** — same Flutter app, a driver-only screen that streams GPS while the trip is running.
- **Admin panel** — web dashboard for the transport office to manage routes, buses, drivers, stops, students, and class advisors.

**Core differentiator:** if a bus is predicted to miss the 9:50 AM deadline (e.g. stuck in traffic), the system automatically identifies every student on that bus, groups them by year/section, and notifies the right class advisor with the affected roll numbers — turning this from "a map with a moving dot" into a system that actually prevents missed classes.

---

## 2. System architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Flutter App    │     │   Flutter App     │     │  React Admin    │
│  (Student view)  │     │  (Driver view)    │     │     Panel       │
└────────┬─────────┘     └────────┬──────────┘     └────────┬────────┘
         │  REST + WebSocket      │  GPS stream           │  REST (CRUD)
         └────────────┬───────────┴────────────────────────┘
                       ▼
          ┌─────────────────────────────┐
          │  Backend API (Node/Express)  │
          │  + Socket.io (real-time)     │
          │  + ETA & late-alert engine   │
          └───────────────┬──────────────┘
                           ▼
                 ┌───────────────────┐
                 │   PostgreSQL DB    │
                 │ (Supabase / Neon)  │
                 └────────────────────┘
```

Backend is API-first: the Flutter app and the admin panel are just two separate consumers that never touch the database directly. This keeps things clean and means the college could plug in another client later (e.g. a website) without touching core logic.

---

## 3. Tech stack (final)

| Layer | Choice | Notes |
|---|---|---|
| Student + Driver app | **Flutter** | One codebase, both Android/iOS, installable APK |
| Admin panel | **React (Vite)** | Web dashboard, used by transport office on laptops |
| Backend API | **Node.js + Express** | REST endpoints for all CRUD |
| Real-time layer | **Socket.io** | Push live GPS + status updates, no polling |
| Database | **PostgreSQL** (Supabase or Neon free tier) | Relational data — routes/stops/buses/students all reference each other |
| Maps | **flutter_map (OpenStreetMap)** or Google Maps Flutter plugin | OSM = no billing account needed |
| GPS source | **Driver's phone** (Geolocation API), throttled every 5–10s / 20m movement | No extra hardware needed |
| Notifications | In-app + email (SendGrid/Resend free tier) | WhatsApp via Twilio sandbox optional if time allows |
| Hosting | Render/Railway (API) + Vercel (admin panel) | Free tiers are enough for a demo/pilot |

---

## 4. AI dev tools — how we'll split usage

Three tools, three different jobs. Don't use all three on the same task — pick based on what you're doing:

| Tool | Best for | Cost |
|---|---|---|
| **Google Antigravity** | Scaffolding whole features autonomously — e.g. "build the admin CRUD panel for routes/stops," "set up the Socket.io live-location pipeline." It's an agent-first IDE (powered by Gemini 3) that plans and executes multi-step tasks with less hand-holding — good for greenfield modules. | Free for individuals |
| **Cursor** | Day-to-day in-editor work — fixing bugs, refining a specific screen, tight iterate-and-review loops where you want to see every diff. Feels like a supercharged VS Code. | Free tier (rate-limited); Pro is paid if you outgrow it |
| **OpenCode** | Backup/parallel option, especially for teammates without a paid plan — it's fully open-source and free, terminal-based, and works with whatever model you point it at (including free models). Good for repetitive backend tasks: API endpoints, DB migration scripts. | Free (tool) + free models available; BYOK if you want a stronger model |

**Suggested split for a 4–5 person team:**
- Whoever owns backend/admin panel scaffolding → start new modules in **Antigravity**, then polish in Cursor.
- Whoever owns the Flutter app UI → **Cursor** for the tight edit-preview loop.
- Anyone without a paid tool/API budget → **OpenCode** with free models, especially for scripts, seed data, and DB schema work.

Note: free-tier terms on all three of these change often — worth a quick check on each tool's site before you lock in your workflow, since limits/pricing can shift mid-semester.

---

## 5. Locked MVP — 8 features, no additions

We're deliberately **not** adding anything beyond this list. Extra scope is the most common way a college project runs out of time.

1. **Admin panel** — CRUD for routes, buses, drivers, stops, students, class advisors
2. **31 routes** with stops, sequence, and scheduled times stored in DB
3. **Driver screen** (inside the Flutter app) — login, auto-starts GPS streaming on trip start
4. **Live location pipeline** — Socket.io, throttled updates
5. **Student screen** — map view + timeline/stepper view for their specific route
6. **Bus info display** — driver name/number, capacity, filled count, faculty incharge contact
7. **ETA prediction** — rolling average speed → predicted time to each remaining stop + college
8. **Late-arrival alert system** — if predicted ETA misses 9:50 AM, notify affected class advisors (grouped by year/section) with roll numbers of students on that bus

---

## 6. Database schema (core tables)

| Table | Key fields |
|---|---|
| `routes` | route_no, name, area_covered |
| `buses` | bus_no, route_id, driver_id, capacity, plate_number |
| `drivers` | name, phone, license_no |
| `class_advisors` | name, phone/email, department, year, section |
| `stops` | name, latitude, longitude |
| `route_stops` | route_id, stop_id, sequence_order, scheduled_time |
| `students` | roll_no, name, route_id, year, department, section, boarding_stop_id |
| `trips` | bus_id, date, start_time, status (running/completed) |
| `live_locations` | bus_id, lat, lng, timestamp, current_stop_index |
| `late_alerts` | bus_id, trip_id, predicted_eta, triggered_at, students_affected[], advisors_notified[] |

---

## 7. 50-day timeline

| Days | Phase | Deliverable |
|---|---|---|
| 1–5 | Requirements + schema | All 31 routes/stops/timings collected from transport office; DB schema finalized; wireframes |
| 6–18 | Backend API + admin panel | Auth (student/driver/admin/advisor roles), CRUD APIs, React admin dashboard to input all data |
| 19–26 | Real-time pipeline | Socket.io server, driver GPS streaming, Haversine-based stop-detection logic |
| 27–38 | Flutter app build | Driver screens (login, start/end trip); student screens (home, map, timeline, bus info) |
| 39–45 | ETA + late-alert system | Rolling-average ETA calc, late-trigger logic, advisor grouping + notification, advisor dashboard |
| 46–50 | Testing + polish | End-to-end testing on real routes, bug fixes, screenshots, report, demo prep |

---

## 8. Team workflow notes

- Keep the backend API-first from day one — agree on endpoint contracts early so Flutter and admin-panel work can happen in parallel instead of blocking on each other.
- Use a shared `.env.example` and a single seed script for the 31 routes' data so everyone's local DB matches.
- Log decisions (schema changes, scope calls) in this doc as you go — it doubles as your project diary for the report later.
