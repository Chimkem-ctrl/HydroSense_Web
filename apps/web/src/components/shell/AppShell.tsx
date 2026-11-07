import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Bell,
  ChevronDown,
  ClipboardList,
  Database,
  FileDown,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  Waves,
  UserRound,
  Wifi,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { liveClient } from '../../app/api';
import { NAV_ITEMS, tierConfig } from '../../app/config';
import { useRole } from '../../app/auth/RoleContext';
import { signOut } from '../../services/authService';
import { useSelectedTank } from '../../app/tank/TankContext';
import { useOpenAlerts, useTanks } from '../../app/data/hooks';
import { ErrorState, LoadingState } from '../common/States';
import { useTheme } from '../../app/ThemeContext';
import type { ThemeChoice } from '../../app/ThemeContext';

const icons: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/tanks': Waves,
  '/health': Wifi,
  '/trends': Activity,
  '/history': Database,
  '/alerts': AlertTriangle,
  '/entries': Beaker,
  '/calibration': FlaskConical,
  '/reports': FileDown,
  '/validation': Gauge,
  '/settings/thresholds': Settings,
  '/admin/users': Users,
  '/admin/logs': ClipboardList,
  '/profile': UserRound,
};

const soonItems = [
  { path: '/fleet', label: 'Multi-site fleet', icon: Waves },
  { path: '/batch', label: 'Batch tracking', icon: Database },
];

export function AppShell() {
  const { role, userName } = useRole();
  const { tankId, setTankId } = useSelectedTank();
  const tanks = useTanks();
  const alerts = useOpenAlerts();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [connection, setConnection] = useState(liveClient.getConnectionState());
  const { choice: theme, setChoice: setTheme } = useTheme();

  useEffect(() => {
    const unsubscribe = liveClient.subscribeConnection(setConnection);
    liveClient.connect();
    return () => {
      unsubscribe();
      liveClient.disconnect();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [accountMenuOpen]);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const openAlerts = (alerts.data ?? []).filter((alert) => alert.status === 'open');
  const criticalAlerts = openAlerts.filter((alert) => alert.severity === 'critical');
  return (
    <div className="app-shell glass-shell">
      {menuOpen && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
        <Link to="/" className="brand" aria-label="HydroSense home">
          <span className="brand-mark"><Waves size={21} /></span>
          <span>HydroSense<small>MILKFISH LARVAL MONITOR</small></span>
        </Link>
        <button type="button" className="icon-button sidebar-close mobile-menu" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        <nav className="side-nav">
          {(['Monitor', 'Records', 'Manage'] as const).map((group) => (
            <section key={group} aria-label={`${group} pages`}>
              <p className="nav-group">{group}</p>
              {visibleItems.filter((item) => item.group === group).map((item) => {
                const Icon = icons[item.path];
                return (
                  <NavLink key={item.path} to={item.path} end={item.path === '/'} className="nav-link" aria-label={item.label}>
                    <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
                  </NavLink>
                );
              })}
            </section>
          ))}
          {(role === 'admin' || role === 'manager') && (tierConfig.fleetView || tierConfig.batchTracking) && (
            <section aria-label="Enterprise features">
              <p className="nav-group">Enterprise · coming soon</p>
              {soonItems.filter(({ path }) => path === '/fleet' ? tierConfig.fleetView : tierConfig.batchTracking).map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} className="nav-link"><Icon size={18} /><span>{label}</span></NavLink>)}
            </section>
          )}
        </nav>
        <div className="sidebar-footer">
          <span className="small muted">Pilot workspace · {role.toUpperCase()}</span>
          <span className="small muted">Days 0–21 · 3-hour sampling</span>
        </div>
      </aside>

      <div className="main-area">
        {criticalAlerts.length > 0 && (
          <div className="critical-banner" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{criticalAlerts.length} unacknowledged critical {criticalAlerts.length === 1 ? 'alert' : 'alerts'} need attention.</span>
            <Link to="/alerts">Review alerts</Link>
          </div>
        )}
        <main className="page-content glass-screen">
          <div className="page-controls" aria-label="Dashboard controls">
            <button type="button" className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
            {tanks.isLoading ? <LoadingState label="Loading tanks" /> : tanks.isError ? <ErrorState error={tanks.error} /> : (
              <label className="inline small" aria-label="Selected tank">
                <Waves size={16} aria-hidden="true" />
                <select className="select-control" aria-label="Select tank" value={tankId} onChange={(event) => setTankId(event.target.value)}>
                  {(tanks.data ?? []).map((tank) => <option value={tank.id} key={tank.id}>{tank.name}</option>)}
                </select>
              </label>
            )}
            <span className={`connection-pill ${connection === 'connected' ? 'connection-online' : 'connection-offline'}`} aria-label={`Connection ${connection}`}>
              <span aria-hidden="true">●</span><span>{connection === 'connected' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Offline'}</span>
            </span>
            <Link to="/alerts" className="icon-button" aria-label={`${openAlerts.length} open alerts`}>
              <Bell size={18} /><span>{openAlerts.length}</span>
            </Link>
            <label className="theme-control"><Sun size={16} aria-hidden="true" /><span className="sr-only">Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value as ThemeChoice)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><Moon size={16} aria-hidden="true" /></label>
            <div className="account-menu">
              <button type="button" className="small muted user-name" aria-haspopup="menu" aria-expanded={accountMenuOpen} aria-label={`Account menu for ${userName}`} onClick={() => setAccountMenuOpen((open) => !open)}><ChevronDown size={14} />{userName}</button>
              {accountMenuOpen && <div className="account-menu-popover" role="menu" aria-label="Account options">
                <Link to="/profile" role="menuitem"><UserRound size={15} />My profile</Link>
                <Link to="/signin" role="menuitem" onClick={signOut}><LogOut size={15} />Sign out</Link>
              </div>}
            </div>
          </div>
          <div className="page-view"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
