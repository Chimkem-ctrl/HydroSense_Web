import type { LiveClient } from './LiveClient';
import type { LiveEvent } from '../types';
import { mockDevices, mockReadings, mockTanks } from '../mock/data';

export class MockLiveClient implements LiveClient {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Map<string, Set<(event: LiveEvent) => void>>();
  private connectionListeners = new Set<(state: 'connecting' | 'connected' | 'disconnected') => void>();
  private connected = false;
  private sequence = 0;

  constructor(private readonly refreshIntervalMs = 5_000) {
    if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs < 1_000) {
      throw new Error('Mock live refresh interval must be at least 1000 ms.');
    }
  }

  connect() {
    if (this.timer) return;
    this.connected = true;
    this.timer = setInterval(() => this.emit(), this.refreshIntervalMs);
    this.connectionListeners.forEach((listener) => listener('connected'));
  }
  disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.connected = false;
    this.connectionListeners.forEach((listener) => listener('disconnected'));
  }
  subscribeConnection(listener: (state: 'connecting' | 'connected' | 'disconnected') => void) {
    this.connectionListeners.add(listener);
    listener(this.getConnectionState());
    return () => this.connectionListeners.delete(listener);
  }
  subscribe(tankId: string, listener: (event: LiveEvent) => void) {
    const tankListeners = this.listeners.get(tankId) ?? new Set();
    tankListeners.add(listener);
    this.listeners.set(tankId, tankListeners);
    return () => {
      tankListeners.delete(listener);
      if (!tankListeners.size) this.listeners.delete(tankId);
    };
  }
  getConnectionState() { return this.connected ? 'connected' : 'disconnected'; }

  private emit() {
    this.sequence += 1;
    for (const tank of mockTanks) {
      const history = mockReadings.filter((row) => row.tankId === tank.id);
      const previous = history[history.length - 1];
      const reading = {
        ...previous,
        id: `${tank.id}-live-${this.sequence}`,
        timestamp: new Date().toISOString(),
        temperature: Number((previous.temperature + Math.sin(this.sequence / 3) * 0.04).toFixed(2)),
        doMgL: Number((previous.doMgL + Math.sin(this.sequence / 2) * 0.08).toFixed(2)),
        ph: Number((previous.ph + Math.sin(this.sequence / 5) * 0.02).toFixed(2)),
      };
      const event: LiveEvent = { type: 'reading', tankId: tank.id, emittedAt: reading.timestamp, reading };
      this.listeners.get(tank.id)?.forEach((listener) => listener(event));
    }
    if (this.sequence % 3 === 0) {
      const status = mockDevices[this.sequence % mockDevices.length];
      const event: LiveEvent = { type: 'device_status', tankId: mockTanks.find((tank) => tank.deviceId === status.deviceId)?.id ?? '', emittedAt: new Date().toISOString(), status };
      this.listeners.get(event.tankId)?.forEach((listener) => listener(event));
    }
  }
}
