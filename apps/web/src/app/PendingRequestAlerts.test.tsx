import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { authService } from '../services/authService';
import { tierConfig } from './config';
import { queryClient } from './query';

const accountsKey = 'hydrosense.auth.accounts.v2';
const sessionKey = 'hydrosense.auth.session.v2';
const pendingAccount = {
  user: {
    id: 'pending-user',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.test',
    role: null,
    requestedRole: null,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  passwordSalt: 'salt',
  passwordHash: 'hash',
};
const operatorAccount = {
  ...pendingAccount,
  user: { ...pendingAccount.user, id: 'operator', email: 'operator@example.test', role: 'operator', status: 'approved' },
};
const queryDefaults = queryClient.getDefaultOptions();

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  queryClient.setDefaultOptions({ ...queryDefaults, queries: { ...queryDefaults.queries, retry: false } });
  window.localStorage.setItem(sessionKey, JSON.stringify({ userId: 'demo-admin' }));
  window.history.replaceState({}, '', '/alerts');
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  queryClient.setDefaultOptions(queryDefaults);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.removeItem(accountsKey);
  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem('hydrosense.theme');
});

describe('admin account request alerts', () => {
  it('detects a new request while the admin is on the alerts page', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Alerts center' });
    await waitFor(() => expect(screen.getByRole('link', { name: /^\d+ open alerts?$/ })).not.toBeNull());

    window.localStorage.setItem(accountsKey, JSON.stringify([pendingAccount]));

    expect(await screen.findByText('New account request: Jane Smith', {}, { timeout: tierConfig.refreshIntervalMs + 3000 })).not.toBeNull();
    expect(screen.getByRole('link', { name: /including 1 pending account request/ })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Review account requests' }).getAttribute('href')).toBe('/admin/users');
  }, tierConfig.refreshIntervalMs + 5000);

  it.each(['Approve', 'Reject'] as const)('removes a request alert after an admin selects %s', async (action) => {
    window.localStorage.setItem(accountsKey, JSON.stringify([pendingAccount]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await screen.findByText('New account request: Jane Smith');
    fireEvent.click(screen.getByRole('link', { name: 'Review account requests' }));
    await screen.findByRole('heading', { name: 'Users & roles' });
    if (action === 'Approve') {
      fireEvent.change(screen.getByRole('combobox', { name: 'Approval role for Jane Smith' }), { target: { value: 'operator' } });
    }
    fireEvent.click(screen.getByRole('button', { name: action }));
    await screen.findByText('No account requests are awaiting review.');
    await waitFor(() => expect(screen.getByRole('link', { name: /^\d+ open alerts?$/ })).not.toBeNull());
    fireEvent.click(screen.getByRole('link', { name: 'Alerts center' }));
    await screen.findByRole('heading', { name: 'Alerts center' });
    expect(screen.queryByText('New account request: Jane Smith')).toBeNull();
  });

  it('does not fetch or display requests for a non-admin', async () => {
    window.localStorage.setItem(accountsKey, JSON.stringify([pendingAccount, operatorAccount]));
    window.localStorage.setItem(sessionKey, JSON.stringify({ userId: 'operator' }));
    const listRequests = vi.spyOn(authService, 'listPendingRequests');
    render(<App />);
    await screen.findByRole('heading', { name: 'Alerts center' });
    expect(listRequests).not.toHaveBeenCalled();
    expect(screen.queryByText('New account request: Jane Smith')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Review account requests' })).toBeNull();
  });

  it('hides cached account requests when the session changes to an operator', async () => {
    window.localStorage.setItem(accountsKey, JSON.stringify([pendingAccount, operatorAccount]));
    const listRequests = vi.spyOn(authService, 'listPendingRequests');
    render(<App />);
    await screen.findByText('New account request: Jane Smith');
    listRequests.mockClear();

    window.localStorage.setItem(sessionKey, JSON.stringify({ userId: 'operator' }));
    fireEvent(window, new Event('hydrosense:auth-change'));

    await waitFor(() => expect(screen.queryByText('New account request: Jane Smith')).toBeNull());
    expect(screen.queryByRole('link', { name: /pending account request/ })).toBeNull();
    expect(listRequests).not.toHaveBeenCalled();
  });

  it('reports an error when account requests cannot be loaded', async () => {
    vi.spyOn(authService, 'listPendingRequests').mockRejectedValue(new Error('Account requests could not be loaded.'));
    render(<App />);
    expect(await screen.findByText('Account requests could not be loaded.')).not.toBeNull();
    expect(screen.getByRole('link', { name: /account requests unavailable/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Retry/ })).not.toBeNull();
  });
});
