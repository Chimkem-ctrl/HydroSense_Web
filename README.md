# HydroSense Web Dashboard

Responsive React 18 + TypeScript frontend for monitoring water quality in milkfish larval rearing tanks (days 0–21). The dashboard is monitoring and alerting only; it has no aeration, dosing, or device-control actions. Salinity and ammonia are rule-based **advisories**, not sensor readings.

## Workspace

```text
apps/
  web/                 React, Vite, Router, Query, Recharts and UI
packages/
  shared/              Domain types, API/live interfaces, mock data, rules and utilities
```

`packages/shared` has no React dependency and is intended to be reusable by a future mobile client.

## Setup

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
npm test
npm run build
```

The Vite development server prints the local URL. Production output is written to `dist/`.

## Configuration

Copy `.env.example` to `.env.local` and set values as needed:

| Variable | Default | Description |
|---|---|---|
| `VITE_DATA_MODE` | `mock` | `mock` selects in-memory fixtures; `api` selects the HTTP/WebSocket adapters. |
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI base URL. |
| `VITE_WS_URL` | Derived from API URL | WebSocket stream URL. |
| `VITE_TIER` | `enterprise` | `free`, `premium`, or `enterprise`; controls node limits, refresh intervals, retention and feature flags. |
| `VITE_PILOT_UNLOCK_ALL` | enabled unless `false` | Keep all tier features enabled for the pilot. Set to `false` to exercise tier gates. |

Use the development role switcher in the top bar to verify role-specific routes and navigation. The role switcher and role persistence are demo-only and are not authentication or authorization; enforce all permissions in the backend.

## Data and live updates

The screens depend on `HydroSenseApi` and `LiveClient` from `@hydrosense/shared`. `MockApiClient` supplies two tanks, 21 days of 3-hour readings, alerts, device status, manual entries, calibration, validation and admin records. The mock API supports adding/removing tanks and linking monitoring hardware IDs; a newly registered mock device starts online with a sample reading. In API mode, actual online status depends on the device's first heartbeat.

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
| `GET`, `POST` | `/api/v1/manual-entries` | List or create refractometer, test-kit, rain and freshwater-event records. |
| `GET`, `PUT` | `/api/v1/settings/thresholds` | Read or update measured-parameter thresholds. |
| `GET`, `PUT` | `/api/v1/settings/advisory-rules` | Read or update salinity/ammonia advisory rules. |
| `GET` | `/api/v1/tanks/{tank_id}/advisories` | Current rule-based advisory states and evidence. |
| `GET`, `POST` | `/api/v1/calibrations` | List or record pH/DO calibration. |
| `GET` | `/api/v1/validation` | HydroSense versus reference validation rows. |
| `GET`, `PUT` | `/api/v1/validation/tolerances` | Read or update tolerances; PUT includes `{ "tolerances": { ... }, "changedBy": "..." }`. |
| `GET` | `/api/v1/admin/users` | List team accounts. |
| `PUT` | `/api/v1/admin/users/{user_id}/role` | Update a user's role with `{ "role": "...", "changedBy": "..." }`. |
| `GET` | `/api/v1/admin/logs` | Audit and system log records. |

Dates and timestamps are ISO-8601; screens display them in Asia/Manila time. Paginated endpoints can be added without changing the domain types or screens.

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
