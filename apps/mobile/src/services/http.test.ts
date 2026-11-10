import { HttpApiClient } from '@hydrosense/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('shared HTTP client used by mobile', () => {
  it('sends the current bearer token and publishable key to the API root', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpApiClient('https://example.test/functions/v1/api/', () => 'test-token', 'public-key');
    await expect(client.listTanks()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/functions/v1/api/v1/tanks', expect.objectContaining({
      headers: { 'Content-Type': 'application/json', apikey: 'public-key', Authorization: 'Bearer test-token' },
    }));
  });

  it('surfaces expired sessions instead of returning empty data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Invalid or expired session.', { status: 401 })));
    const client = new HttpApiClient('https://example.test', () => 'expired');
    await expect(client.listTanks()).rejects.toThrow('401');
  });
});
