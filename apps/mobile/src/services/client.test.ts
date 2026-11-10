import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('mobile pending account review', () => {
  it('uses the signed-in token to list and review requests, including admin approval', async () => {
    vi.stubEnv('EXPO_PUBLIC_DATA_MODE', 'api');
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://example.test/api');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: '1', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.test' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Forbidden.' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const { setMobileAccessToken, listPendingAccounts, reviewPendingAccount } = await import('./client');
    setMobileAccessToken('token');
    expect(await listPendingAccounts()).toHaveLength(1);
    await reviewPendingAccount('1', 'admin');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.test/api/v1/admin/users/1', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      body: JSON.stringify({ status: 'approved', role: 'admin' }),
    }));
    await expect(reviewPendingAccount('1', null)).rejects.toThrow('Forbidden.');
  });

  it('reports that review is unavailable in demo mode instead of pretending success', async () => {
    vi.stubEnv('EXPO_PUBLIC_DATA_MODE', 'mock');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { listPendingAccounts, reviewPendingAccount } = await import('./client');
    await expect(listPendingAccounts()).rejects.toThrow('unavailable in mobile demo mode');
    await expect(reviewPendingAccount('1', 'operator')).rejects.toThrow('unavailable in mobile demo mode');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
