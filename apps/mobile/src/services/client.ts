import {
  HttpApiClient,
  MockApiClient,
  MockLiveClient,
  WebSocketLiveClient,
} from '@hydrosense/shared';
import type { LiveClient } from '@hydrosense/shared';
import type { Role } from '@hydrosense/shared';

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

export interface PendingAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  site: string | null;
}

async function reviewRequest(path: string, init?: RequestInit): Promise<unknown> {
  if (DATA_MODE !== 'api') throw new Error('Account review is unavailable in mobile demo mode. Connect to the backend to review requests.');
  if (!accessToken) throw new Error('Sign in again to review account requests.');
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(API_KEY ? { apikey: API_KEY } : {}), Authorization: `Bearer ${accessToken}` },
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string' ? result.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return result;
}

export async function listPendingAccounts(): Promise<PendingAccount[]> {
  const result = await reviewRequest('/v1/admin/users?status=pending');
  if (!Array.isArray(result) || !result.every((item) => item && typeof item.id === 'string' && typeof item.firstName === 'string' && typeof item.lastName === 'string' && typeof item.email === 'string')) {
    throw new Error('The server returned an invalid account list.');
  }
  return result;
}

export async function reviewPendingAccount(id: string, role: Role | null): Promise<void> {
  await reviewRequest(`/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ status: role ? 'approved' : 'rejected', role }),
  });
}

export const api = DATA_MODE === 'api' ? new HttpApiClient(API_BASE_URL, () => accessToken, API_KEY) : new MockApiClient();
export const liveClient: LiveClient | null = DATA_MODE === 'mock'
  ? new MockLiveClient(10_000)
  : wsUrl ? new WebSocketLiveClient(wsUrl) : null;
