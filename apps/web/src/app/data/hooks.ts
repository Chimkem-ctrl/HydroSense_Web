import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdvisoryState, DeviceStatus, Reading, Tank } from '@hydrosense/shared';
import { api, liveClient } from '../api';
import { DATA_MODE, tierConfig } from '../config';

export function useTanks() {
  return useQuery({ queryKey: ['tanks'], queryFn: () => api.listTanks() });
}

export function useLatestReading(tankId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['latest-reading', tankId],
    queryFn: () => api.getLatestReading(tankId),
    enabled: Boolean(tankId),
    refetchInterval: DATA_MODE === 'api' ? false : tierConfig.refreshIntervalMs,
  });
  useEffect(() => {
    if (!tankId) return undefined;
    return liveClient.subscribe(tankId, (event) => {
      if (event.type === 'reading') {
        queryClient.setQueryData<Reading | null>(['latest-reading', tankId], event.reading);
      }
    });
  }, [queryClient, tankId]);
  return query;
}

export function useDeviceStatuses() {
  const queryClient = useQueryClient();
  const tanks = useTanks();
  const query = useQuery({ queryKey: ['device-status'], queryFn: () => api.listDeviceStatuses() });
  useEffect(() => {
    if (!tanks.data?.length) return undefined;
    const subscriptions = tanks.data.map((tank) => liveClient.subscribe(tank.id, (event) => {
      if (event.type !== 'device_status') return;
      queryClient.setQueryData<DeviceStatus[]>(['device-status'], (current = []) => [
        ...current.filter((status) => status.deviceId !== event.status.deviceId),
        event.status,
      ]);
    }));
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [queryClient, tanks.data]);
  return query;
}

export function useOpenAlerts(tankId?: string) {
  return useQuery({
    queryKey: ['alerts', tankId ?? 'all'],
    queryFn: async () => (await api.listAlerts(tankId)).filter((alert) => alert.status === 'open'),
  });
}

export function useAdvisories(tankId: string) {
  return useQuery<AdvisoryState[]>({
    queryKey: ['advisories', tankId],
    queryFn: () => api.listAdvisories(tankId),
    enabled: Boolean(tankId),
  });
}

export function getTank(tanks: Tank[] | undefined, tankId: string) {
  return tanks?.find((tank) => tank.id === tankId);
}
