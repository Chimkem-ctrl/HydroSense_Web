import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RoleProvider } from './RoleContext';
import { RoleGuard } from './RoleGuard';

const ACCOUNT_KEY = 'hydrosense.auth.accounts.v2';
const SESSION_KEY = 'hydrosense.auth.session.v2';

function signInAs(role: 'operator' | 'admin') {
  const user = {
    id: role === 'admin' ? 'demo-admin' : `test-${role}`,
    firstName: 'Test',
    lastName: role,
    email: `${role}@example.com`,
    role,
    requestedRole: role === 'admin' ? null : 'operator',
    status: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  if (role !== 'admin') {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify([{
      user,
      passwordSalt: 'salt',
      passwordHash: 'hash',
    }]));
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
}

describe('RoleGuard', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows protected content to an authorized role from the stored account', () => {
    signInAs('admin');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <RoleProvider><Routes>
          <Route path="/" element={<p>Dashboard</p>} />
          <Route path="/admin" element={<RoleGuard roles={['admin']}><p>Admin content</p></RoleGuard>} />
        </Routes></RoleProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('redirects an operator away from admin-only content', async () => {
    signInAs('operator');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <RoleProvider><Routes>
          <Route path="/" element={<p>Dashboard</p>} />
          <Route path="/admin" element={<RoleGuard roles={['admin']}><p>Admin content</p></RoleGuard>} />
        </Routes></RoleProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Admin content')).not.toBeInTheDocument());
  });
});
