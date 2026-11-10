# HydroSense Dashboard

React + TypeScript frontends for monitoring water quality in milkfish larval rearing tanks (days 0–21). The apps are monitoring and alerting only; they have no aeration, dosing, or device-control actions. Salinity and ammonia are rule-based **advisories**, not sensor readings.

## Workspace

```text
apps/
  web/                 React 18, Vite, Router, Query, Recharts and UI
  mobile/              Expo, React Native, React Navigation and native screens
packages/
  shared/              Domain types, API/live interfaces, mock data, rules and utilities
```

Both apps import business logic and API contracts from `packages/shared`; neither app imports from the other. The repository uses npm workspaces to keep the existing web setup intact while sharing types and domain logic.

## Setup

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
npm run dev:mobile
npm test
npm run build
```

The Vite development server prints the local URL. Run `npm run dev:mobile` and open the project in an Android emulator or device. For a native Android development build, install the Android SDK and run `npm run android:mobile`. The mobile app uses native notifications and file sharing; use an Expo development build for full native behavior. Web production output is written to `dist/`; `npm run build` also type-checks the mobile app.

## Glass design review

Run `npm run dev`, then open `/gallery.html` on the printed Vite URL. This is a development-only, standalone review page and is not included in the production build. Its Light, Dark and System choice is stored separately from the dashboard preference. The dashboard and sign-in pages use the same glass tokens; the dashboard theme selector supports Light, Dark and System, with System as the default.

The CSS variables are in `apps/web/src/design-system/tokens.css`, with Tailwind mappings in `apps/web/tailwind.config.js` and the shared glass recipe in `apps/web/src/design-system/glass.css`. Tokens are scoped to the gallery, dashboard shell and authentication pages. Readable semantic `*-text` variants are used for small labels, rather than the brighter decorative status colors.

- **Do:** use `.glass` for the outer surface and solid/translucent non-blurred inner tiles, pair status color with an icon and label, and use tabular numbers for measurements.
- **Do:** keep advisory explanations distinct from sensor values, preserve visible alert text, support keyboard focus, and honor reduced motion and transparency.
- **Don't:** stack blurred glass layers, place text directly over decorative gradients, use the rainbow meter to imply status without a numeric label, or present simulated controls as hardware controls.
- The gallery uses opaque-enough fallback surfaces when blur or reduced transparency is unavailable; its mock interactions do not update dashboard data.

### Advisory context

Opening a salinity or ammonia advisory shows its existing rule and inputs, plus separate seven-day context: available temperature and, for ammonia, pH readings, and tank-specific or hatchery-wide activity logs. The trend summary shows first and last values and the observed range; sampling is normally every three hours, but missing samples are not estimated. Reading history is subject to the tier's retention and analytics settings. Manual salinity and ammonia entries are identified as manual results, not sensor readings.

The context does **not** change the advisory level or claim that a listed event caused it. In mock mode, the existing rules may consider older water events and use a preset feeding-load input rather than deriving it from the displayed logs. These rules are demonstration logic, not a validated assessment of hatchery risk.

## Configuration

Copy `.env.example` to `.env.local` and set values as needed:

| Variable | Default | Description |
|---|---|---|
| `VITE_DATA_MODE` | `mock` | `mock` selects in-memory fixtures; `api` selects the HTTP/WebSocket adapters. |
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI base URL. |
| `VITE_WS_URL` | Derived from API URL | WebSocket stream URL. |
| `VITE_TIER` | `enterprise` | `free`, `premium`, or `enterprise`; controls node limits, refresh intervals, retention and feature flags. |
| `VITE_PILOT_UNLOCK_ALL` | enabled unless `false` | Keep all tier features enabled for the pilot. Set to `false` to exercise tier gates. |
| `VITE_ADMIN_EMAIL` | `admin@hydrosense.demo` | Demo-only administrator email for local mock authentication. |
| `VITE_ADMIN_PASSWORD` | `AdminDemo!2026` | Demo-only administrator password for local mock authentication. Never use real credentials here. |
| `EXPO_PUBLIC_DATA_MODE` | `api` | Mobile data adapter: `mock` or `api`. |
| `EXPO_PUBLIC_API_URL` | Deployed Supabase API | Mobile HTTP API root, including `/functions/v1/api` for the Supabase function. Use a device-reachable address for local development. `EXPO_PUBLIC_API_BASE_URL` is a legacy fallback. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web project's publishable key | Publishable key for mobile API requests; set this when using a different backend. Never use a service-role key. |
| `EXPO_PUBLIC_WS_URL` | unset | Optional compatible mobile WebSocket stream URL. Set in `apps/mobile/.env.local`; API data is otherwise refreshed by polling. |

Sign-up requests an Operator or Manager role and remains pending until approved by the administrator. The role is a request, not a grant. In mock mode, account records and a session containing only the user ID are stored in browser localStorage under v2 keys. Authentication remains demo-only even when `VITE_DATA_MODE=api` selects the dashboard API adapter; connect a real authentication backend before deployment. Do not use real credentials or sensitive personal information, and enforce identity, approval and every authorization decision in the backend.

The mobile app defaults to the shared backend for sign-in and account requests; mock sign-in is explicitly demo-only and offers all three roles. API mode signs in through `/v1/auth/signin` relative to the configured API root and stores the backend's bearer token with Expo SecureStore on native devices. Mobile query data is cached for up to 24 hours for offline viewing, and is cleared on sign-out or account changes. Tank API requests run only after session restoration and authentication; tank-loading errors are surfaced in the tank selector. Alert notification taps use the `hydrosense://alerts/{alertId}` deep link. Local notification handling and permission requests are wired; delivery/push-token registration must be connected by the production backend. See [mobile setup and limitations](apps/mobile/README.md).

## Data and live updates

The screens depend on `HydroSenseApi` and `LiveClient` from `@hydrosense/shared`. `MockApiClient` supplies two tanks, 21 days of 3-hour readings, alerts, device status, activity logs, calibration, validation and admin records. The mock API supports adding/removing tanks and linking monitoring hardware IDs; a newly registered mock device starts online with a sample reading. In API mode, actual online status depends on the device's first heartbeat.

`HttpApiClient` expects JSON responses from the endpoints below. Implement API-side authentication, authorization, validation and auditing; frontend role guards are only a UX aid.

### REST contract

| Method | Path | Purpose |
|---|---|---|
| `GET`, `POST` | `/api/v1/tanks` | List or register tanks and their monitoring hardware IDs. POST includes `changedBy` for audit attribution. |
| `DELETE` | `/api/v1/tanks/{tank_id}?changed_by={user}` | Remove a tank and its hardware association. |
| `GET` | `/api/v1/readings` | Query readings by `tankId`, `from`, `to`, `parameter`, and `limit`. |
| `GET` | `/api/v1/tanks/{tank_id}/readings/latest` | Latest measured values. |
| `GET` | `/api/v1/devices/status` | Device online, power, battery, Wi-Fi and pending-sync status. |
| `GET` | `/api/v1/alerts` | List alerts; optional `tank_id` filter. |
| `GET` | `/api/v1/alerts/{alert_id}/responses` | Alert response history. |
| `POST` | `/api/v1/alerts/{alert_id}/acknowledge` | Acknowledge with `{ "note": "...", "user": "..." }`. |
| `POST` | `/api/v1/alerts/{alert_id}/resolve` | Resolve with `{ "note": "...", "user": "..." }`. |
| `GET`, `POST` | `/api/v1/activity-logs` | List or create hatchery operation, manual water-quality, environmental-event and alert-resolution records. |
| `GET`, `PUT` | `/api/v1/settings/thresholds` | Read or update measured-parameter thresholds. |
| `GET`, `PUT` | `/api/v1/settings/advisory-rules` | Read or update salinity/ammonia advisory rules. |
| `GET` | `/api/v1/tanks/{tank_id}/advisories` | Current rule-based advisory states and evidence. |
| `GET`, `POST` | `/api/v1/calibrations` | List or record pH/DO calibration. |
| `GET` | `/api/v1/validation` | HydroSense versus reference validation rows. |
| `GET`, `PUT` | `/api/v1/validation/tolerances` | Read or update tolerances; PUT includes `{ "tolerances": { ... }, "changedBy": "..." }`. |
| `GET` | `/api/v1/admin/users` | List team accounts. |
| `PUT` | `/api/v1/admin/users/{user_id}/role` | Update a user's role with `{ "role": "operator or manager", "changedBy": "..." }`; admin cannot be assigned. |
| `POST` | `/api/v1/auth/signup` | Submit an account request with requested role `operator` or `manager`; create it pending with no active role. |
| `POST` | `/api/v1/auth/signin` | Verify credentials before revealing account status; issue a session only for approved accounts. |
| `GET` | `/api/v1/admin/pending-requests` | List pending requests; administrator authorization is mandatory. |
| `PUT` | `/api/v1/admin/pending-requests/{user_id}/approve` | Approve with a role of `operator` or `manager`; validate the role and administrator authorization server-side. |
| `PUT` | `/api/v1/admin/pending-requests/{user_id}/reject` | Reject a request; administrator authorization is mandatory. |
| `GET` | `/api/v1/admin/logs` | Audit and system log records. |

All authentication, role assignment and request-review endpoints must enforce authorization, validation and status transitions server-side. No signup or review endpoint may create or grant the `admin` role. Dates and timestamps are ISO-8601; screens display them in Asia/Manila time. Paginated endpoints can be added without changing the domain types or screens.

### WebSocket contract

Connect to `/ws/v1/stream`. Events are JSON objects discriminated by `type`:

```json
{
  "type": "reading",
  "tankId": "tank-a",
  "emittedAt": "2025-01-01T00:00:00Z",
  "reading": {
    "id": "reading-id",
    "tankId": "tank-a",
    "timestamp": "2025-01-01T00:00:00Z",
    "temperature": 30,
    "doMgL": 6,
    "ph": 7.2
  }
}
```

```json
{
  "type": "device_status",
  "tankId": "tank-a",
  "emittedAt": "2025-01-01T00:00:00Z",
  "status": {
    "deviceId": "HS-MF-001",
    "online": true,
    "lastSeen": "2025-01-01T00:00:00Z",
    "batteryPct": 86,
    "powerSource": "solar",
    "wifiRssi": -58,
    "pendingSyncCount": 0
  }
}
```

The live client reconnects after disconnect. Do not send hardware control commands over this stream.

## Product behavior

- Measured parameters: temperature (28–32 °C), dissolved oxygen (≥4 mg/L), and pH (6–8), with visible status labels/icons and safe-range distance.
- Salinity target (28–33 ppt) and ammonia are not measured. They appear only as advisory chips with inputs and the fired rule in a popover.
- Asia/Manila timestamps, 24-hour time, 3-hour mock reading cadence, and overnight chart shading (22:00–06:00).
- Operator, manager and admin navigation is role-gated. Admins can add/remove tanks and associate monitoring hardware.
- Enterprise batch tracking and fleet view are explicitly marked as coming soon.
