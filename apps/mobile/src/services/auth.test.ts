import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticate, HATCHERY, requestAccount, requestPasswordReset, validateSignUp } from './auth';
import type { SignUpValues } from './auth';

afterEach(() => vi.unstubAllGlobals());

describe('mobile API sign-in', () => {
  it('uses the API base path and returns the approved role and token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'test-token',
      user: { id: '123', firstName: 'Test', lastName: 'Manager', role: 'manager' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(authenticate('https://example.test/functions/v1/api/', 'public-key', ' test@example.test ', 'password'))
      .resolves.toEqual({ accessToken: 'test-token', user: { id: '123', name: 'Test Manager', role: 'manager' } });
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/functions/v1/api/v1/auth/signin', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: 'public-key' },
      body: JSON.stringify({ email: 'test@example.test', password: 'password' }),
    }));
  });

  it('rejects pending and rejected accounts and malformed responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'pending' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'rejected' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: '123', role: 'admin' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(authenticate('https://example.test', 'key', 'test@example.test', 'password')).resolves.toEqual({ status: 'pending' });
    await expect(authenticate('https://example.test', 'key', 'test@example.test', 'password')).rejects.toThrow('Request not approved');
    await expect(authenticate('https://example.test', 'key', 'test@example.test', 'password')).rejects.toThrow('missing an access token');
  });
});

const signup: SignUpValues = {
  firstName: ' Jane ', lastName: ' Smith ', employeeId: ' S-123 ', phone: '+63 912 345 6789',
  email: ' Jane@Example.test ', requestedRole: 'operator', position: 'Hatchery Operator', hatcheryId: HATCHERY.id,
  address: ' Address ', emergencyContactName: ' Contact ', emergencyContactPhone: '+63 912 345 6789',
  password: 'TestPass123', confirmPassword: 'TestPass123', termsAccepted: true,
};

describe('mobile account request', () => {
  it('sends the web signup fields to the backend without form-only values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'pending', user: { id: '123' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestAccount('https://example.test/functions/v1/api/', 'key', signup)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/functions/v1/api/v1/auth/signup', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'jane@example.test', password: 'TestPass123', requestedRole: 'operator',
        firstName: 'Jane', lastName: 'Smith', position: 'Hatchery Operator', employeeId: 'S-123',
        phone: '+63 912 345 6789', address: 'Address', emergencyContactName: 'Contact',
        emergencyContactPhone: '+63 912 345 6789', hatcheryId: HATCHERY.id,
      }),
    }));
  });

  describe('password reset', () => {
    it('uses the same Supabase recovery endpoint as the web app', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await requestPasswordReset('https://example.test/functions/v1/api/', 'key', ' USER@example.test ');
      expect(fetchMock).toHaveBeenCalledWith('https://example.test/auth/v1/recover', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: 'key', Authorization: 'Bearer key' },
        body: JSON.stringify({ email: 'user@example.test' }),
      }));
    });

    it('rejects a non-Supabase API root without sending the email', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(requestPasswordReset('https://example.test', 'key', 'user@example.test')).rejects.toThrow('requires a Supabase');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('rejects invalid fields without sending a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(validateSignUp({ ...signup, confirmPassword: 'wrong' })).toBe('Passwords do not match.');
    await expect(requestAccount('https://example.test', 'key', { ...signup, termsAccepted: false })).rejects.toThrow('Terms and Conditions');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a subscribed hatchery before sending a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const hatcheryId of ['', 'unknown']) {
      await expect(requestAccount('https://example.test', 'key', { ...signup, hatcheryId }))
        .rejects.toThrow('Select your subscribed hatchery.');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces backend errors and requires confirmation of pending status', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Email already registered' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'approved' }), { status: 200 })));
    await expect(requestAccount('https://example.test', 'key', signup)).rejects.toThrow('Email already registered');
    await expect(requestAccount('https://example.test', 'key', signup)).rejects.toThrow('did not confirm');
  });
});
