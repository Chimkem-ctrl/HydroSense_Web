import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RoleProvider } from './RoleContext';
import { RoleGuard } from './RoleGuard';

describe('RoleGuard', () => {
  let storage: Storage;

  afterEach(cleanup);

  beforeEach(() => {
    const values = new Map<string, string>();
    storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => Array.from(values.keys())[index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    storage.clear();
  });

  it('shows protected content to an authorized role', () => {
    storage.setItem('hydrosense.dashboard.role.v1', 'admin');
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
    storage.setItem('hydrosense.dashboard.role.v1', 'operator');
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
