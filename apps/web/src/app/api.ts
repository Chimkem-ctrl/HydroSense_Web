import { HttpApiClient, MockApiClient, MockLiveClient, WebSocketLiveClient } from '@hydrosense/shared';
import type { LiveClient } from '@hydrosense/shared';
import { DATA_MODE, tierConfig } from './config';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const wsUrl = import.meta.env.VITE_WS_URL ?? `${apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/v1/stream`;

export const api = DATA_MODE === 'api' ? new HttpApiClient(apiBaseUrl) : new MockApiClient();
export const liveClient: LiveClient = DATA_MODE === 'api'
  ? new WebSocketLiveClient(wsUrl)
  : new MockLiveClient(tierConfig.refreshIntervalMs);
