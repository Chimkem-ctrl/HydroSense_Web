# HydroSense backend and database

This directory contains the HydroSense Supabase PostgreSQL database, authentication configuration, migrations, and REST API Edge Function.

## Architecture

- **Supabase Auth** manages accounts and access tokens.
- **PostgreSQL** stores application data.
- **Row Level Security (RLS)** protects tables accessed directly by Supabase clients.
- **Edge Functions** expose the HydroSense `/v1` REST API.
- **Supabase Realtime** is enabled for readings, device status, and alerts.

Production project:

```text
Project: hydrosense_final
Project reference: iafooterjwbihuzwakoc
Region: ap-south-1
API base URL: https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api
```

The API function is deployed at:

```text
https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api
```

## Repository layout

```text
backend/
├── README.md
├── package.json
├── .env.local              # Local-only credentials; never commit
├── scripts/
│   └── migrate.mjs         # Applies SQL migrations through PostgreSQL
└── supabase/
    ├── config.toml         # Supabase local configuration
    ├── functions/
    │   └── api/
    │       └── index.ts    # REST API Edge Function
    └── migrations/
        └── 20261107210000_hydrosense_schema.sql
```

## Database schema

### Custom types

| Type | Values |
|---|---|
| `hydrosense_role` | `operator`, `manager`, `admin` |
| `account_status` | `pending`, `approved`, `rejected` |

### Tables

| Table | Purpose |
|---|---|
| `profiles` | Approved account, requested role, approval status, and profile fields |
| `tanks` | Tank registration and associated monitoring hardware |
| `readings` | Temperature, dissolved oxygen, and pH measurements |
| `device_statuses` | Device connectivity, battery, power, and synchronization state |
| `thresholds` | Tank water-quality limits |
| `advisory_settings` | Salinity and ammonia advisory rules |
| `alerts` | Active and historical alert records |
| `alert_responses` | Alert acknowledgement and resolution history |
| `manual_entries` | Manual measurements and environmental records |
| `activity_logs` | Hatchery operations and alert/activity records |
| `calibration_logs` | pH and dissolved-oxygen calibration records |
| `validation_rows` | HydroSense/reference comparison rows |
| `validation_tolerances` | Temperature, pH, and dissolved-oxygen tolerances |
| `audit_logs` | Administrative and configuration audit events |

Important relationships:

- Readings belong to a tank.
- Alerts and calibrations belong to a tank.
- Alert responses belong to an alert.
- Deleting a tank cascades to readings, alerts, and calibration records associated with it.
- Every Supabase Auth user is linked to a profile with the same UUID.

## Authentication and authorization

Use Supabase Auth access tokens for protected API routes.

```http
apikey: YOUR_SUPABASE_PUBLISHABLE_KEY
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

Roles:

- `operator`: reads operational monitoring data.
- `manager`: manages tanks, settings, and team information.
- `admin`: receives all manager permissions plus audit-log access and account administration.

Frontend route guards are not security controls. Authorization is enforced by the API and database policies.

Account approval flow:

1. Sign-up creates a Supabase Auth user and a pending profile.
2. No active role is assigned during sign-up.
3. An administrator approves the account and grants `operator` or `manager`.
4. `POST /v1/auth/signin` returns a session only for approved accounts.

Never expose the service-role/secret key in a browser, mobile application, or repository.

## REST API

Public routes must include the Supabase publishable key.

### Authentication

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/v1/auth/signup` | Publishable key | Create a pending account |
| `POST` | `/v1/auth/signin` | Publishable key | Sign in an approved account |

Sign-up body:

```json
{
  "email": "operator@example.com",
  "password": "StrongPassword123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "requestedRole": "operator",
  "position": "Hatchery Operator"
}
```

Only `operator` and `manager` may be requested.

### Tanks and readings

| Method | Path | Required role | Purpose |
|---|---|---|---|
| `GET` | `/v1/tanks` | Approved account | List tanks |
| `POST` | `/v1/tanks` | Manager/admin | Create a tank |
| `DELETE` | `/v1/tanks/{tank_id}` | Manager/admin | Delete a tank |
| `GET` | `/v1/readings?tankId=&from=&to=&parameter=&limit=` | Approved account | Query readings |
| `GET` | `/v1/tanks/{tank_id}/readings/latest` | Approved account | Get the latest reading |
| `GET` | `/v1/devices/status` | Approved account | Get device statuses |

Tank creation body:

```json
{
  "name": "Tank A",
  "site": "Camiguin Sagay Hatchery",
  "rearingStartDate": "2026-11-07",
  "deviceId": "HS-MF-001",
  "changedBy": "Administrator"
}
```

### Alerts

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/v1/alerts?tank_id=` | Approved account | List alerts |
| `GET` | `/v1/alerts/{alert_id}/responses` | Approved account | List alert history |
| `POST` | `/v1/alerts/{alert_id}/acknowledge` | Approved account | Acknowledge an alert |
| `POST` | `/v1/alerts/{alert_id}/resolve` | Approved account | Resolve an alert |

Acknowledgement/resolution body:

```json
{
  "note": "Threshold checked and corrective action recorded.",
  "user": "Jane Doe"
}
```

### Configuration and calibration

| Method | Path | Required role | Purpose |
|---|---|---|---|
| `GET`, `PUT` | `/v1/settings/thresholds` | Read: approved; Write: manager/admin | Threshold settings |
| `GET`, `PUT` | `/v1/settings/advisory-rules` | Read: approved; Write: manager/admin | Advisory settings |
| `GET`, `POST` | `/v1/calibrations?tank_id=` | Approved account | List or create calibration records |
| `GET`, `PUT` | `/v1/validation/tolerances` | Read: approved; Write: manager/admin | Validation tolerances |

Threshold update body:

```json
{
  "thresholds": [
    { "parameter": "temperature", "min": 28, "max": 32 },
    { "parameter": "do", "min": 5 },
    { "parameter": "ph", "min": 7.2, "max": 8.5 }
  ],
  "changedBy": "Jane Doe"
}
```

### Administration

| Method | Path | Required role | Purpose |
|---|---|---|---|
| `GET` | `/v1/admin/users` | Manager/admin | List approved users |
| `GET` | `/v1/admin/logs` | Admin | List audit logs |

## Response conventions

- JSON is returned for successful requests and API errors.
- `204 No Content` is returned after successful tank deletion.
- `400` indicates invalid input or a database constraint failure.
- `401` indicates missing or invalid authentication.
- `403` indicates a valid account without sufficient role/access.
- `404` indicates an unknown API route.
- `500` indicates an unexpected server or database failure.

Example error:

```json
{
  "error": "Authentication required."
}
```

## Local environment configuration

## Backend startup guide

### Prerequisites

- Node.js 20 or newer
- npm
- Supabase CLI
- Docker Desktop, only for running the complete local Supabase stack
- Access to the HydroSense Supabase project

### Install and configure

From the repository root:

```powershell
npm install
npx supabase login
```

Create `backend/.env.local` from the database settings stored in the Supabase project dashboard:

```dotenv
SUPABASE_PROJECT_REF=your-project-reference
SUPABASE_DB_HOST=your-host
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=your-database-user
SUPABASE_DB_PASSWORD=your-database-password
```

The database password is not a frontend or deployment secret and must never be committed.

### Start local Supabase

Docker Desktop must be running:

```powershell
npm run start --workspace @hydrosense/backend
```

Stop the local stack with:

```powershell
npm run stop --workspace @hydrosense/backend
```

### Start with a hosted Supabase project

Link the repository to the hosted project:

```powershell
npx supabase link --project-ref your-project-reference --workdir backend/supabase
```

Apply migrations and deploy the API:

```powershell
npm run db:migrate --workspace @hydrosense/backend
npm run deploy:api --workspace @hydrosense/backend
```

The API function can also be deployed directly:

```powershell
npx supabase functions deploy api --project-ref your-project-reference --workdir backend/supabase --yes
```

### Start the web application

From the repository root, configure `apps/web/.env.local` and start the web workspace:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://your-project-reference.supabase.co/functions/v1/api
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

```powershell
npm run dev
```

The Vite server prints the local URL, normally `http://localhost:5173`.

Create `backend/.env.local`. This file is excluded by Git.

```dotenv
SUPABASE_PROJECT_REF=iafooterjwbihuzwakoc
SUPABASE_DB_HOST=aws-0-ap-south-1.pooler.supabase.com
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.iafooterjwbihuzwakoc
SUPABASE_DB_PASSWORD=your-database-password
```

Never put the service-role/secret key in `.env.local` unless an explicitly server-side deployment workflow requires it. If added, do not commit it.

## Install and link Supabase CLI

Run from the repository root:

```powershell
npm install
npx supabase login
npx supabase link --project-ref iafooterjwbihuzwakoc --workdir backend/supabase
```

Docker is optional for direct hosted migration/deployment. It is required for fully local Supabase services.

## Apply migrations

Apply every SQL migration in `backend/supabase/migrations`:

```powershell
npm run db:migrate --workspace @hydrosense/backend
```

To apply migrations through the Supabase CLI instead:

```powershell
npx supabase db push --workdir backend/supabase
```

`RESET_PUBLIC_SCHEMA=true` in the migration script resets the public schema. Only use this on a disposable development database.

## Deploy and update the API

Deploy from the repository root:

```powershell
npx supabase functions deploy api --workdir backend/supabase --project-ref iafooterjwbihuzwakoc --yes
```

The Edge Function must be deployed from the Supabase project containing:

```text
backend/supabase/functions/api/index.ts
```

When configuration changes are needed, edit:

```text
backend/supabase/config.toml
```

The custom API runs with gateway JWT verification disabled for public sign-up/sign-in routes and validates tokens internally for protected routes.

## Frontend configuration

The web app uses these values in `apps/web/.env.local`:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is safe for browser/mobile clients. The secret or service-role key must remain server-only.

## Realtime

These tables are included in the `supabase_realtime` publication:

- `readings`
- `device_statuses`
- `alerts`

The repository does not yet implement the WebSocket endpoint. Realtime subscribers should connect through the Supabase Realtime client rather than `/ws/v1/stream` until that adapter is implemented.

## Account and operational routes

The API includes these routes:

- `GET`, `POST /v1/manual-entries`
- `GET`, `POST /v1/activity-logs`
- `GET /v1/tanks/{tank_id}/advisories`
- `GET /v1/validation`
- `PUT /v1/admin/users/{user_id}/role`
- `GET /v1/admin/pending-requests`
- `PUT /v1/admin/pending-requests/{user_id}/approve`
- `PUT /v1/admin/pending-requests/{user_id}/reject`

Pending requests can also be reviewed through `GET /v1/admin/users?status=pending`
and `PATCH /v1/admin/users/{user_id}`, which are used by the web and mobile
apps. Approval requires an explicit `role` of `operator`, `manager`, or `admin`;
rejection does not assign a role. Both review and approved-user role changes
require an approved admin session. Deploy the updated function before using
the updated signup form; deployment requires a Supabase CLI account with project
function-deployment privileges.

## Team security checklist

- Do not commit passwords, secret keys, personal access tokens, or `.env.local`.
- Use the publishable key in clients.
- Rotate a key immediately if it is committed or shared accidentally.
- Use least privilege for database and Edge Function operations.
- Review pending-account approvals before granting roles.
- Test every role restriction before production release.
- Back up the database before destructive migrations.
