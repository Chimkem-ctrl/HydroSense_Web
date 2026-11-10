import {
  HttpApiClient,
  MockApiClient,
  MockLiveClient,
  WebSocketLiveClient,
} from '@hydrosense/shared';
import type { LiveClient } from '@hydrosense/shared';

export const DATA_MODE: 'mock' | 'api' = process.env.EXPO_PUBLIC_DATA_MODE === 'mock' ? 'mock' : 'api';
const DEFAULT_API_URL = 'https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_URL;
export const API_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  (API_BASE_URL.replace(/\/$/, '') === DEFAULT_API_URL ? 'sb_publishable_Dagoxgq2hOU3RFsE8RJGaA_jUtn8oJn' : undefined);
const wsUrl = process.env.EXPO_PUBLIC_WS_URL?.trim();

let accessToken: string | null = null;
export function setMobileAccessToken(token: string | null) {
  accessToken = token;
}

export const api = DATA_MODE === 'api' ? new HttpApiClient(API_BASE_URL, () => accessToken, API_KEY) : new MockApiClient();
export const liveClient: LiveClient | null = DATA_MODE === 'mock'
  ? new MockLiveClient(10_000)
  : wsUrl ? new WebSocketLiveClient(wsUrl) : null;
