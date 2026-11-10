import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { queryClient } from './query';
import { api } from './api';
import { authService } from '../services/authService';

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
  vi.restoreAllMocks();
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

  it('groups the selected tank readings, advisories and device details', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    const readings = await screen.findByRole('region', { name: 'Current water quality' });
    expect(within(readings).getByRole('article', { name: 'Temperature reading' })).toBeInTheDocument();
    expect(within(readings).getByRole('article', { name: 'Dissolved oxygen reading' })).toBeInTheDocument();
    expect(within(readings).getByRole('article', { name: 'pH reading' })).toBeInTheDocument();
    const advisories = await screen.findByRole('region', { name: 'Water-quality advisories' });
    const advisory = within(advisories).getByRole('button', { name: /Advisory · Salinity/ });
    fireEvent.click(advisory);
    expect(advisory).toHaveAttribute('aria-expanded', 'true');
    expect(within(advisories).getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Device connection' })).toBeInTheDocument();
  });

  it('retains the page heading when no tank is available', async () => {
    vi.spyOn(api, 'listTanks').mockResolvedValue([]);
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(await screen.findByText('No tank or reading is available. Check the tank selector and device status.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live monitor', level: 1 })).toBeInTheDocument();
  });

  it('keeps account settings controls available in their sections', async () => {
    window.history.replaceState({}, '', '/settings');
    render(<App />);
    const profile = await screen.findByRole('region', { name: 'Account profile' });
    const security = screen.getByRole('region', { name: 'Privacy & Security' });
    const devices = screen.getByRole('region', { name: 'Connected Devices' });
    const criticalAlerts = within(profile).getByRole('switch', { name: 'Critical Alerts' });
    expect(criticalAlerts).toBeChecked();
    fireEvent.click(criticalAlerts);
    expect(criticalAlerts).not.toBeChecked();
    expect(within(devices).getByLabelText('Tank ID')).toBeInTheDocument();
    expect(within(devices).getByLabelText('Wi-Fi password')).toHaveAttribute('type', 'password');
    fireEvent.click(within(security).getByRole('button', { name: /Account Audit Trail/ }));
    expect(screen.getByRole('dialog', { name: 'Account Audit Trail' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Account Audit Trail' })).not.toBeInTheDocument();
  });

  it('groups profile details and keeps linked preference tabs functional', async () => {
    window.history.replaceState({}, '', '/profile?tab=alerts');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Alert preferences', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alert preferences' })).toHaveAttribute('aria-selected', 'true');
    const email = screen.getByRole('checkbox', { name: 'Email alerts' });
    expect(email).toBeChecked();
    fireEvent.click(email);
    expect(email).not.toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
    fireEvent.click(screen.getByRole('radio', { name: /Light/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    for (const name of ['Contact details', 'Role & assignment', 'Emergency contact', 'Account']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(window.location.search).toBe('');
  });

  it('keeps pending review and team role controls accessible', async () => {
    const request = {
      id: 'pending-test', firstName: 'Test', lastName: 'User', email: 'test@example.com',
      role: null, requestedRole: null, status: 'pending', createdAt: '2026-01-01T00:00:00Z',
    } as const;
    vi.spyOn(authService, 'listPendingRequests').mockResolvedValue([request]);
    const approve = vi.spyOn(authService, 'approveRequest').mockResolvedValue({ ...request, role: 'manager', status: 'approved' });
    window.history.replaceState({}, '', '/admin/users');
    render(<App />);
    const pending = await screen.findByRole('region', { name: 'Pending requests' });
    expect(await within(pending).findByText('1 pending')).toBeInTheDocument();
    const approveButton = within(pending).getByRole('button', { name: 'Approve' });
    expect(approveButton).toBeDisabled();
    fireEvent.change(within(pending).getByRole('combobox', { name: 'Approval role for Test User' }), { target: { value: 'manager' } });
    fireEvent.click(approveButton);
    await waitFor(() => expect(approve).toHaveBeenCalledWith('pending-test', 'manager'));
    const team = screen.getByRole('region', { name: 'Team accounts' });
    expect(await within(team).findByRole('combobox', { name: 'Role for Juan Dela Cruz' })).toBeInTheDocument();
  });

  it('preserves role updates and account removal confirmation', async () => {
    const updateRole = vi.spyOn(api, 'updateUserRole').mockRejectedValue(new Error('Role update failed'));
    const remove = vi.spyOn(authService, 'removeAccount').mockRejectedValue(new Error('Removal failed'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.history.replaceState({}, '', '/admin/users');
    render(<App />);
    const role = await screen.findByRole('combobox', { name: 'Role for Juan Dela Cruz' });
    fireEvent.change(role, { target: { value: 'manager' } });
    await waitFor(() => expect(updateRole).toHaveBeenCalledWith(expect.any(String), 'manager', expect.any(String)));
    expect(await screen.findByText('Role update failed')).toBeInTheDocument();
    const row = role.closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(within(row!).getByRole('button', { name: 'Remove account' }));
    expect(confirm).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['/fleet', '/batch'])('places the heading outside the coming-soon card on %s', async (path) => {
    window.history.replaceState({}, '', path);
    const { container } = render(<App />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.closest('.card')).toBeNull();
    expect(container.querySelector('.coming-soon-page > .page-heading')).toContainElement(heading);
    expect(screen.getByRole('heading', { name: 'Not available yet' })).toBeInTheDocument();
    expect(screen.getByText('No batch or fleet data is displayed until the feature is implemented.')).toBeInTheDocument();
  });

  it('opens the selected activity form without duplicate kind buttons', async () => {
    window.history.replaceState({}, '', '/entries');
    render(<App />);
    await screen.findByRole('heading', { name: 'Activity logs' });
    fireEvent.click(screen.getByRole('button', { name: 'Log operation' }));
    let dialog = screen.getByRole('dialog', { name: 'Log hatchery operation' });
    expect(within(dialog).getByLabelText('Operation type')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Operation' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Weather / event' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log weather / event' }));
    dialog = screen.getByRole('dialog', { name: 'Log weather or event' });
    expect(within(dialog).getByLabelText('Event type')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Observed impact')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Operation' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Weather / event' })).not.toBeInTheDocument();
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

  it.each(['/signin', '/signup'])('shows the mobile-style brand on %s', async (path) => {
    window.localStorage.removeItem('hydrosense.auth.session.v2');
    window.history.replaceState({}, '', path);
    const { container } = render(<App />);
    const header = container.querySelector('.auth-header--branded');
    expect(await screen.findByText('WATER QUALITY MONITORING')).toBeInTheDocument();
    expect(header).toHaveTextContent('HydroSense');
    expect(header?.querySelector('img')).toHaveAttribute('src', '/assets/logos/hydrosense-logo.png');
  });
});
