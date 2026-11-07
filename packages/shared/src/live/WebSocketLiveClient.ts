import type { LiveEvent } from '../types';
import type { LiveClient } from './LiveClient';

export class WebSocketLiveClient implements LiveClient {
  private socket: WebSocket | null = null;
  private state: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private listeners = new Map<string, Set<(event: LiveEvent) => void>>();
  private connectionListeners = new Set<(state: 'connecting' | 'connected' | 'disconnected') => void>();

  constructor(private readonly url: string) {}

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.setState('connecting');
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('open', () => this.setState('connected'));
    this.socket.addEventListener('close', () => {
      this.socket = null;
      this.setState('disconnected');
    });
    this.socket.addEventListener('error', () => this.setState('disconnected'));
    this.socket.addEventListener('message', (message) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message.data));
      } catch {
        console.error('Ignored malformed HydroSense WebSocket message.');
        return;
      }
      if (!isLiveEvent(parsed)) {
        console.error('Ignored unsupported HydroSense WebSocket event.');
        return;
      }
      this.listeners.get(parsed.tankId)?.forEach((listener) => listener(parsed));
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.setState('disconnected');
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

  subscribeConnection(listener: (state: 'connecting' | 'connected' | 'disconnected') => void) {
    this.connectionListeners.add(listener);
    listener(this.state);
    return () => this.connectionListeners.delete(listener);
  }

  getConnectionState() { return this.state; }

  private setState(state: 'connecting' | 'connected' | 'disconnected') {
    this.state = state;
    this.connectionListeners.forEach((listener) => listener(state));
  }
}

function isLiveEvent(value: unknown): value is LiveEvent {
  if (typeof value !== 'object' || value === null || !('type' in value) || !('tankId' in value)) return false;
  const event = value as Partial<LiveEvent>;
  if (event.type === 'reading' && 'reading' in event) {
    const reading = event.reading;
    return typeof reading === 'object' && reading !== null &&
      'temperature' in reading && typeof reading.temperature === 'number' &&
      'doMgL' in reading && typeof reading.doMgL === 'number' &&
      'ph' in reading && typeof reading.ph === 'number';
  }
  return event.type === 'device_status' && 'status' in event;
}
