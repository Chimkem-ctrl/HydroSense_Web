import { HttpApiClient, MockApiClient, MockLiveClient, WebSocketLiveClient } from '@hydrosense/shared';
import type { LiveClient } from '@hydrosense/shared';
import { DATA_MODE, tierConfig } from './config';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api';
const wsUrl = import.meta.env.VITE_WS_URL ?? `${apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/v1/stream`;

const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const api = DATA_MODE === 'api'
  ? new HttpApiClient(apiBaseUrl, () => window.localStorage.getItem('hydrosense.auth.access-token'), apiKey)
  : new MockApiClient();
export const liveClient: LiveClient = DATA_MODE === 'api'
  ? new WebSocketLiveClient(wsUrl)
  : new MockLiveClient(tierConfig.refreshIntervalMs);
