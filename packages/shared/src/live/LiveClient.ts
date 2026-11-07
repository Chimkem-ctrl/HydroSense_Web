import type { LiveEvent } from '../types';

export interface LiveClient {
  connect(): void;
  disconnect(): void;
  subscribe(tankId: string, listener: (event: LiveEvent) => void): () => void;
  subscribeConnection(listener: (state: 'connecting' | 'connected' | 'disconnected') => void): () => void;
  getConnectionState(): 'connecting' | 'connected' | 'disconnected';
}
