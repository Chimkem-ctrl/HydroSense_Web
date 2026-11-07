import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { queryClient } from './query';

const routes = [
  ['/', 'Live monitor'],
  ['/tanks', 'Tank overview'],
  ['/health', 'System health'],
  ['/trends', 'Trend charts'],
  ['/history', 'Historical logs'],
  ['/alerts', 'Alerts center'],
  ['/entries', 'Activity logs'],
  ['/reports', 'Export reports'],
  ['/calibration', 'Calibration & maintenance'],
  ['/validation', 'Validation view'],
  ['/settings/thresholds', 'Thresholds & advisory rules'],
  ['/admin/users', 'Users & roles'],
  ['/admin/logs', 'Audit & system logs'],
  ['/profile', 'My profile'],
  ['/fleet', 'Multi-site fleet view · Coming soon'],
  ['/batch', 'Batch tracking · Coming soon'],
] as const;

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.localStorage.setItem('hydrosense.auth.session.v2', JSON.stringify({ userId: 'demo-admin' }));
  window.localStorage.setItem('hydrosense.theme', 'dark');
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  window.localStorage.removeItem('hydrosense.auth.session.v2');
  window.localStorage.removeItem('hydrosense.theme');
});

describe('themed dashboard routes', () => {
  it.each(routes.flatMap(([path, title]) => (['light', 'dark'] as const).map((theme) => [path, title, theme] as const)))('renders %s in the shared shell (%s, %s)', async (path, title, theme) => {
    window.history.replaceState({}, '', path);
    window.localStorage.setItem('hydrosense.theme', theme);
    const { container } = render(<App />);
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    expect(container.querySelector('.glass-shell .glass-screen')).toBeInTheDocument();
    expect(container.querySelector('main .page-controls')).toBeInTheDocument();
    expect(container.querySelector('.topbar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Theme')).toHaveValue(theme);
    expect(document.documentElement).toHaveAttribute('data-theme', theme);
  });

  it('keeps the navigation drawer and account controls available in the shared layout', async () => {
    window.history.replaceState({}, '', '/tanks');
    render(<App />);
    await screen.findByRole('heading', { name: 'Tank overview', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    fireEvent.click(screen.getByRole('button', { name: /Account menu for/ }));
    expect(screen.getByRole('menuitem', { name: 'My profile' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Select tank' })).toBeInTheDocument();
  });
});

describe('themed authentication routes', () => {
  const authRoutes = [
    ['/signin', 'Welcome Back'],
    ['/signup', 'Request an account'],
    ['/forgot-password', 'Reset your password'],
    ['/pending-approval', 'Request submitted'],
  ] as const;
  it.each(authRoutes.flatMap(([path, title]) => (['light', 'dark'] as const).map((theme) => [path, title, theme] as const)))('renders %s with glass (%s, %s)', async (path, title, theme) => {
    window.localStorage.removeItem('hydrosense.auth.session.v2');
    window.localStorage.setItem('hydrosense.theme', theme);
    window.history.replaceState({}, '', path);
    const { container } = render(<App />);
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    expect(container.querySelector('.auth-background .glass-panel')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('data-theme', theme);
  });
});
