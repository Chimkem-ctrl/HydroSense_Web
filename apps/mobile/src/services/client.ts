import {
  HttpApiClient,
  MockApiClient,
  MockLiveClient,
  WebSocketLiveClient,
} from '@hydrosense/shared';
import type { LiveClient } from '@hydrosense/shared';

export const DATA_MODE: 'mock' | 'api' = process.env.EXPO_PUBLIC_DATA_MODE === 'api' ? 'api' : 'mock';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const wsUrl = process.env.EXPO_PUBLIC_WS_URL ?? `${API_BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/v1/stream`;

let accessToken: string | null = null;
export function setMobileAccessToken(token: string | null) {
  accessToken = token;
}

const apiKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const api = DATA_MODE === 'api' ? new HttpApiClient(API_BASE_URL, () => accessToken, apiKey) : new MockApiClient();
export const liveClient: LiveClient = DATA_MODE === 'api'
  ? new WebSocketLiveClient(wsUrl)
  : new MockLiveClient(10_000);
