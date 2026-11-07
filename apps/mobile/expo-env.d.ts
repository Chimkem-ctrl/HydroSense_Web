/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_DATA_MODE?: 'mock' | 'api';
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_WS_URL?: string;
  }
}
