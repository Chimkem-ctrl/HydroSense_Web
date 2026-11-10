import { toByteArray } from 'base64-js';

if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (encoded: string) => {
    const bytes = toByteArray(encoded);
    let result = '';
    for (const byte of bytes) result += String.fromCharCode(byte);
    return result;
  };
}
