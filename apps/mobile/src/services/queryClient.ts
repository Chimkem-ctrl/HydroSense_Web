import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { DATA_MODE } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnReconnect: true,
      refetchInterval: DATA_MODE === 'api' ? 30_000 : false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'hydrosense.mobile.query-cache.v1',
});

export async function clearMobileQueryCache() {
  queryClient.clear();
  await queryPersister.removeClient();
}
