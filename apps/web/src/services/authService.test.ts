import { webcrypto } from 'node:crypto';
import type { Role } from '@hydrosense/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authService,
  DEMO_ADMIN_CREDENTIALS,
  getCurrentUser,
  signOut,
  SUBSCRIBED_HATCHERIES,
} from './authService';
import type { RequestedRole, SignUpValues } from '../types/auth.types';

const ACCOUNT_KEY = 'hydrosense.auth.accounts.v2';
const SESSION_KEY = 'hydrosense.auth.session.v2';

function signupValues(overrides: Partial<SignUpValues> = {}): SignUpValues {
  return {
    firstName: 'Taylor',
    lastName: 'Rivera',
    employeeId: 'EMP-001',
    phone: '+63 917 555 0100',
    email: 'taylor@example.com',
    password: 'TestPass!2026',
    requestedRole: 'operator',
    position: 'Hatchery Operator',
    hatcheryId: SUBSCRIBED_HATCHERIES[0].id,
    address: 'Sagay, Camiguin',
    emergencyContactName: 'Alex Rivera',
    emergencyContactPhone: '+63 917 555 0101',
    confirmPassword: 'TestPass!2026',
    termsAccepted: true,
    ...overrides,
  };
}

async function createPendingRequest(values = signupValues()) {
  await authService.signUp(values);
  return JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) ?? '[]')[0].user.id as string;
}

async function signInAsAdmin() {
  await authService.signIn(DEMO_ADMIN_CREDENTIALS.email, DEMO_ADMIN_CREDENTIALS.password);
}

describe('authService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('signs in the configured admin and stores only the user ID in the session', async () => {
    const result = await authService.signIn(DEMO_ADMIN_CREDENTIALS.email, DEMO_ADMIN_CREDENTIALS.password);

    expect(result).toMatchObject({ status: 'approved', redirectPath: '/' });
    expect(getCurrentUser()).toMatchObject({ id: 'demo-admin', role: 'admin', status: 'approved' });
    expect(JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? '{}')).toEqual({ userId: 'demo-admin' });
  });

  it('does not sign in pending accounts and checks the password before reporting pending status', async () => {
    await authService.signUp(signupValues());
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();

    await expect(authService.signIn('taylor@example.com', 'incorrect-password'))
      .rejects.toThrow('Email or password is incorrect.');
    await expect(authService.signIn('taylor@example.com', 'TestPass!2026'))
      .resolves.toMatchObject({ status: 'pending', redirectPath: '/pending-approval' });
    expect(getCurrentUser()).toBeNull();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('blocks rejected accounts after verifying the password', async () => {
    const userId = await createPendingRequest();
    await signInAsAdmin();
    authService.rejectRequest(userId);
    signOut();

    await expect(authService.signIn('taylor@example.com', 'incorrect-password'))
      .rejects.toThrow('Email or password is incorrect.');
    await expect(authService.signIn('taylor@example.com', 'TestPass!2026'))
      .rejects.toThrow('Request not approved.');
  });

  it('approves with the selected role instead of the requested role', async () => {
    const userId = await createPendingRequest();
    await signInAsAdmin();
    authService.approveRequest(userId, 'manager');
    signOut();

    await expect(authService.signIn('taylor@example.com', 'TestPass!2026'))
      .resolves.toMatchObject({ status: 'approved', user: { role: 'manager', requestedRole: 'operator' } });
    expect(getCurrentUser()?.role).toBe('manager');

    const accounts = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) ?? '[]');
    accounts[0].user.role = 'operator';
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
    expect(getCurrentUser()?.role).toBe('operator');
    accounts[0].user.role = null;
    accounts[0].user.status = 'rejected';
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
    expect(getCurrentUser()).toBeNull();
  });

  it('never allows request review to grant the admin role', async () => {
    const userId = await createPendingRequest();
    await signInAsAdmin();

    expect(() => authService.approveRequest(userId, 'admin' as Role))
      .toThrow('Account requests can only be approved as Operator or Manager.');
    expect(authService.listPendingRequests()).toHaveLength(1);
  });

  it('allows only the admin to list and review requests', async () => {
    const firstRequestId = await createPendingRequest();
    const secondRequestId = await createPendingRequest(signupValues({ email: 'second@example.com' }));
    expect(() => authService.listPendingRequests()).toThrow('Only the administrator may review account requests.');

    await signInAsAdmin();
    authService.approveRequest(firstRequestId, 'operator');
    signOut();
    await authService.signIn('taylor@example.com', 'TestPass!2026');

    expect(() => authService.listPendingRequests()).toThrow('Only the administrator may review account requests.');
    expect(() => authService.approveRequest(secondRequestId, 'manager')).toThrow('Only the administrator may review account requests.');
    expect(() => authService.rejectRequest(secondRequestId)).toThrow('Only the administrator may review account requests.');
  });

  it('rejects duplicate emails, including the admin email, and invalid roles', async () => {
    await createPendingRequest();
    await expect(authService.signUp(signupValues({ email: 'TAYLOR@example.com' })))
      .rejects.toThrow('An account with this email already exists.');
    await expect(authService.signUp(signupValues({ email: DEMO_ADMIN_CREDENTIALS.email })))
      .rejects.toThrow('An account with this email already exists.');
    await expect(authService.signUp(signupValues({ requestedRole: 'admin' as RequestedRole })))
      .rejects.toThrow('Select Operator or Manager as your requested role.');
  });
});
