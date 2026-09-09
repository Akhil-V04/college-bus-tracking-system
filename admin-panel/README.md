# Administrator web reference

This React + Vite application is a **functional reference frontend**, not the final visual design.

It exists now to:

- exercise the real authenticated backend APIs;
- verify PostgreSQL writes and administrative workflows;
- prove route, driver, advisor, schedule, roster, and late-alert behavior;
- provide a working interface while the backend contract stabilizes.

A later frontend phase may replace the visual system, navigation, component library, responsive layout, and screen composition. It should preserve the product and API rules documented in `../PRD.md` and `../docs/FRONTEND_REDESIGN_BOUNDARY.md`.

## Source organization

```text
src/
  screens/       # One route-level screen per product area
  App.jsx        # Route registration only
  Layout.jsx     # Authenticated application shell
  Login.jsx      # Administrator authentication entry
  components.jsx # Small shared reference UI components
  EntityScreen.jsx # Temporary reusable CRUD foundation
  api.js         # Authenticated HTTP client and API base URL
  auth.jsx       # Administrator session state
  index.css      # Replaceable reference styling
```

Do not add new domain rules to React components. Validation, authorization, privacy, publishing, and concurrency guarantees belong in the backend.

Signing out calls the backend revocation endpoint before clearing the reference browser token. Expiry or network failure still clears local state. The final production frontend should follow ../docs/AUTH_SESSIONS_API.md and migrate administrator transport to a Secure HttpOnly cookie.

## Run and verify

```powershell
cd E:\bus-tracking-system\admin-panel
npm install
npm run dev
npm run build
```

The API defaults to `http://localhost:4000`. Override it with `VITE_API_URL` only when required.