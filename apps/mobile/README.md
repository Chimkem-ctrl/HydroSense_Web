# HydroSense mobile

The Expo workspace lives in `apps/mobile` and imports API contracts, validation,
and calculations from `packages/shared`. From the repository root, install the
workspace dependencies and run `npm run dev:mobile`. For an Android development
build, run `npm run android:mobile`; the Android SDK is required. Run
`npm run typecheck --workspace @hydrosense/mobile` and
`npm run test --workspace @hydrosense/mobile` to validate this package.
For a browser preview, open `http://localhost:8081` after starting Expo.
The mobile interface adapts the web app's glass palette, gradients,
branding, and reading cards to touch-friendly phone and tablet layouts. Native
surfaces use translucent fills rather than relying on backdrop blur. The
Appearance is available in Settings and the header account menu. Choose System,
Light or Dark; the preference is saved on the device and System follows its
current color scheme. The preference remains after signing out.
The dashboard header offers role-filtered navigation, tank selection, alert
access and account actions. Its connection indicator says `Polling` when no
WebSocket stream is configured; this is not a live-stream status.

The default is API mode, using the deployed Supabase API and publishable key
also configured in the web app. Mobile sign-in and account requests use the
backend's `/v1/auth/signin` and `/v1/auth/signup` routes. Account requests
remain pending until an administrator approves them; the requested role is not
automatically granted. Configure the web app in API mode against the same
Supabase project to use the same accounts. Its default browser-only demo
accounts are not backend accounts and cannot be shared with mobile.

Copy `.env.example` in this directory to `.env.local` to override settings,
and restart Expo after changing it. For another backend set
`EXPO_PUBLIC_API_URL` to the API root (for example
`https://<project>.supabase.co/functions/v1/api`) and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to that project's publishable key. The
API root is shared by sign-in and all data requests.
`EXPO_PUBLIC_API_BASE_URL` remains supported as a legacy fallback.
For a local API use an address reachable from the device: `10.0.2.2` is the
Android emulator host address; a physical device needs the computer's LAN
address. Never put a service-role key or other secret in Expo public variables.
Set `EXPO_PUBLIC_DATA_MODE=mock` for the separate demo roles and sample data;
mock mode does not create or authenticate backend accounts.

The web signup page currently contains demo-only terms, which do not describe
backend sign-up. The mobile form shows those same terms with an explicit
warning; production terms and a backend record of consent are not implemented.
Forgot password uses the same Supabase recovery endpoint as the web app and
requires an API root ending in `/functions/v1/api`; reset links follow the
Supabase project's configured redirect settings.

The access token is stored in Expo SecureStore; user metadata and the offline
query cache are stored in AsyncStorage and cleared on sign-out or account
changes. Cached data may be stale and is not encrypted. The backend returns a
refresh token, but this mobile app does not yet refresh sessions; when an access
token expires, sign out and sign in again. Account role changes are reflected
at the next sign-in; API authorization must remain enforced server-side.
SecureStore is not available on web, so browser preview sessions and tokens are
kept in memory only and require sign-in again after a page reload. Native
notification handling is disabled in the browser preview.
The current backend allows approved operators to call the readings endpoint
directly, so hiding the History tab does not restrict historical data at the
API. Enforcing the web's history restriction requires a backend change.

API queries refresh every 30 seconds while active. Set `EXPO_PUBLIC_WS_URL`
only if a compatible live WebSocket service is available; the Supabase REST
function does not itself provide that stream. Notification navigation is wired
but push-token registration and delivery require backend integration.

The Operator home supports monitoring, alerts, calibration and field entries.
Managers additionally get history, threshold editing and a read-only validation
review. Admins get those features and a read-only account/audit overview.
These are example mobile views, not complete web feature parity:
account approval and management, tolerance editing, full reporting and other
web features remain on the web. UI route restrictions are not a security
boundary; the backend must independently enforce every required permission.
