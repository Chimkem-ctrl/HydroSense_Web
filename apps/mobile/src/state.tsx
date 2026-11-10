import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import type { Role, Tank } from '@hydrosense/shared';
import { api } from './services/client';
import { DATA_MODE, setMobileAccessToken } from './services/client';
import { clearMobileQueryCache } from './services/queryClient';

const SESSION_KEY = 'hydrosense.mobile.session.v1';
const ACCESS_TOKEN_KEY = 'hydrosense.mobile.access-token.v1';
const VALID_ROLES: readonly Role[] = ['operator', 'manager', 'admin'];

export interface MobileUser {
  id: string;
  name: string;
  role: Role;
}

interface SessionValue {
  user: MobileUser | null;
  ready: boolean;
  signIn: (user: MobileUser, accessToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function isMobileUser(value: unknown): value is MobileUser {
  if (typeof value !== 'object' || value === null) return false;
  if ('token' in value || Object.keys(value).some((key) => !['id', 'name', 'role'].includes(key))) return false;
  if (!('id' in value) || typeof value.id !== 'string' || value.id.trim().length === 0) return false;
  if (!('name' in value) || typeof value.name !== 'string' || value.name.trim().length === 0) return false;
  return 'role' in value && typeof value.role === 'string' && VALID_ROLES.includes(value.role as Role);
}

function isStoredSession(value: unknown): value is { version: 1; mode: 'mock' | 'api'; user: MobileUser } {
  if (typeof value !== 'object' || value === null) return false;
  return Object.keys(value).length === 3 &&
    'version' in value && value.version === 1 &&
    'mode' in value && value.mode === DATA_MODE &&
    'user' in value && isMobileUser(value.user);
}

async function clearStoredSession() {
  const results = await Promise.allSettled([
    AsyncStorage.removeItem(SESSION_KEY),
    ...(Platform.OS === 'web' ? [] : [SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)]),
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length) {
    throw new Error(`Could not clear all saved session data: ${failures.map((failure) => String(failure.reason)).join('; ')}`);
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        if (Platform.OS === 'web') {
          await clearStoredSession();
          await clearMobileQueryCache();
          return;
        }
        const [savedUser, savedToken] = await Promise.all([
          AsyncStorage.getItem(SESSION_KEY),
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        ]);
        if (savedUser === null) {
          if (savedToken !== null) await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
          await clearMobileQueryCache();
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(savedUser);
        } catch {
          throw new Error('The saved mobile session is not valid JSON.');
        }
        if (!isStoredSession(parsed)) throw new Error('The saved mobile session has invalid user data or mode.');
        if (DATA_MODE === 'api' && !savedToken) throw new Error('The saved API session has no secure access token.');
        if (!active) return;
        setMobileAccessToken(DATA_MODE === 'api' ? savedToken : null);
        setUser({ id: parsed.user.id, name: parsed.user.name.trim(), role: parsed.user.role });
      } catch (error) {
        console.error('Could not restore the mobile session; the saved session will be cleared.', error);
        setMobileAccessToken(null);
        try {
          await clearStoredSession();
        } catch (clearError) {
          console.error('Could not remove the invalid saved mobile session.', clearError);
        }
        try {
          await clearMobileQueryCache();
        } catch (clearError) {
          console.error('Could not clear the query cache for the invalid mobile session.', clearError);
        }
      } finally {
        if (active) setReady(true);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (nextUser: MobileUser, accessToken?: string) => {
    if (!isMobileUser(nextUser)) throw new Error('The sign-in user data is invalid.');
    if (DATA_MODE === 'api' && !accessToken?.trim()) throw new Error('The API did not provide a secure access token.');
    await clearMobileQueryCache();
    if (Platform.OS === 'web') {
      setMobileAccessToken(accessToken ?? null);
      setUser(nextUser);
      return;
    }
    try {
      if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      else await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, mode: DATA_MODE, user: nextUser }));
    } catch (error) {
      setMobileAccessToken(null);
      try {
        await clearStoredSession();
      } catch (clearError) {
        console.error('Could not clean up an incomplete sign-in.', clearError);
      }
      throw new Error(`Could not securely save the mobile session: ${String(error)}`);
    }
    setMobileAccessToken(accessToken ?? null);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    setMobileAccessToken(null);
    setUser(null);
    const results = await Promise.allSettled([clearStoredSession(), clearMobileQueryCache()]);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length) {
      throw new Error(`Signed out, but local session cleanup was incomplete: ${failures.map((failure) => String(failure.reason)).join('; ')}`);
    }
  }, []);

  const value = useMemo<SessionValue>(() => ({ user, ready, signIn, signOut }), [ready, signIn, signOut, user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used within SessionProvider.');
  return session;
}

interface TankSelection {
  tanks: Tank[];
  tankId: string;
  setTankId: (tankId: string) => void;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const TankContext = createContext<TankSelection | null>(null);

export function TankProvider({ children }: PropsWithChildren) {
  const { user, ready } = useSession();
  const query = useQuery({
    queryKey: ['tanks', user?.id],
    queryFn: () => api.listTanks(),
    enabled: ready && Boolean(user),
  });
  const tanks = query.data ?? [];
  const [selectedId, setSelectedId] = useState('');
  const tankId = tanks.some((tank) => tank.id === selectedId) ? selectedId : tanks[0]?.id ?? '';
  const value = useMemo<TankSelection>(() => ({
    tanks,
    tankId,
    setTankId: setSelectedId,
    isLoading: Boolean(user) && (!ready || query.isLoading),
    error: query.error instanceof Error ? query.error : query.isError ? new Error('Could not load tanks.') : null,
    refetch: () => { void query.refetch(); },
  }), [query.error, query.isError, query.isLoading, query.refetch, ready, tanks, tankId, user]);
  return <TankContext.Provider value={value}>{children}</TankContext.Provider>;
}

export function useTankSelection() {
  const selection = useContext(TankContext);
  if (!selection) throw new Error('useTankSelection must be used within TankProvider.');
  return selection;
}
