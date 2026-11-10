import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_DATA_MODE', 'api');
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('API account review', () => {
  it('lists unassigned pending requests and sends the selected admin role', async () => {
    window.localStorage.setItem('hydrosense.auth.user', JSON.stringify({ id: 'admin', role: 'admin' }));
    window.localStorage.setItem('hydrosense.auth.access-token', 'token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: '1', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.test', status: 'pending', role: null, requestedRole: null, createdAt: '2026-01-01' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '1', status: 'approved', role: 'admin' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { authService } = await import('./authService');
    expect(await authService.listPendingRequests()).toMatchObject([{ firstName: 'Jane', lastName: 'Smith', role: null }]);
    await authService.approveRequest('1', 'admin');
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ status: 'approved', role: 'admin' }));
  });

  it('does not present a rejected account as pending', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: '1' }, access_token: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ status: 'rejected', role: null }]), { status: 200 })));
    const { authService } = await import('./authService');
    await expect(authService.signIn('jane@example.test', 'password')).rejects.toThrow('Request not approved.');
  });
});
