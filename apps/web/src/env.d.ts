/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'mock' | 'api';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_TIER?: 'free' | 'premium' | 'enterprise';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
