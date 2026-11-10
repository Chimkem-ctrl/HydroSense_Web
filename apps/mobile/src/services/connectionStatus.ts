import type { LiveClient } from '@hydrosense/shared';

export function getConnectionLabel(
  online: boolean | null,
  connection: ReturnType<LiveClient['getConnectionState']>,
  latestReadingTimestamp: string | undefined,
  now: number,
): 'Live' | 'Offline' {
  const readingIsRecent = latestReadingTimestamp !== undefined &&
    now - new Date(latestReadingTimestamp).getTime() <= 15 * 60 * 1000;
  return online !== false && (connection === 'connected' || readingIsRecent) ? 'Live' : 'Offline';
}
