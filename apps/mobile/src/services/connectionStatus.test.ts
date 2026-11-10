import { describe, expect, it } from 'vitest';
import { getConnectionLabel } from './connectionStatus';

describe('mobile connection status', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');

  it('shows Live for a connected client or a reading within 15 minutes', () => {
    expect(getConnectionLabel(true, 'connected', undefined, now)).toBe('Live');
    expect(getConnectionLabel(true, 'disconnected', new Date(now - 15 * 60 * 1000).toISOString(), now)).toBe('Live');
  });

  it('shows Offline without a connection or recent reading', () => {
    expect(getConnectionLabel(true, 'connecting', undefined, now)).toBe('Offline');
    expect(getConnectionLabel(true, 'disconnected', new Date(now - 15 * 60 * 1000 - 1).toISOString(), now)).toBe('Offline');
    expect(getConnectionLabel(true, 'disconnected', 'invalid', now)).toBe('Offline');
  });

  it('shows Offline when the device has no network, even with cached data', () => {
    expect(getConnectionLabel(false, 'connected', new Date(now).toISOString(), now)).toBe('Offline');
  });
});
