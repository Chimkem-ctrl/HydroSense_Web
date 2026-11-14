import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ASSETS } from '../../config/assets';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Bell,
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
import { useLatestReading, useOpenAlerts, usePendingRequests, useTanks } from '../../app/data/hooks';
import { ErrorState, LoadingState } from '../common/States';

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
  '/settings': Settings,
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
  const latestReading = useLatestReading(tankId);
  const alerts = useOpenAlerts();
  const pendingRequests = usePendingRequests();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [connection, setConnection] = useState(liveClient.getConnectionState());
  const latestReadingIsRecent = Boolean(
    latestReading.data &&
    Date.now() - new Date(latestReading.data.timestamp).getTime() <= 15 * 60 * 1000,
  );
  const displayConnection = connection === 'connected' || latestReadingIsRecent ? 'connected' : connection;

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
  const pendingCount = role === 'admin' ? (pendingRequests.data?.length ?? 0) : 0;
  const alertCount = openAlerts.length + pendingCount;
  const alertLabel = `${alertCount} open ${alertCount === 1 ? 'alert' : 'alerts'}${role === 'admin' && pendingRequests.isError
    ? ', account requests unavailable'
    : role === 'admin' && pendingRequests.isLoading
      ? ', loading account requests'
      : pendingCount ? `, including ${pendingCount} pending account ${pendingCount === 1 ? 'request' : 'requests'}` : ''}`;
  return (
    <div className="app-shell glass-shell" data-role={role}>
      {menuOpen && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
        <Link to="/" className="brand" aria-label="HydroSense home">
          <img src={ASSETS.logo} alt="" className="brand-logo" />
          <span>HydroSense<small> WATER QUALITY MONITORING</small></span>
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
          <span className="small muted sidebar-role">Pilot workspace · {role.toUpperCase()}</span>
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
            <span className={`connection-pill ${displayConnection === 'connected' ? 'connection-online' : 'connection-offline'}`} aria-label={`Connection ${displayConnection}`}>
              <span aria-hidden="true">●</span><span>{displayConnection === 'connected' ? 'Live' : displayConnection === 'connecting' ? 'Connecting' : 'Offline'}</span>
            </span>
            <Link to="/alerts" className="icon-button" aria-label={alertLabel} title={alertLabel}>
              <Bell size={18} /><span>{alertCount}</span>
              {role === 'admin' && pendingRequests.isError && <span aria-hidden="true">!</span>}
              {role === 'admin' && pendingRequests.isLoading && <span aria-hidden="true">…</span>}
            </Link>
            <div className="account-menu">
               <button type="button" className="icon-button" aria-haspopup="menu" aria-expanded={accountMenuOpen} aria-label={`Account menu for ${userName}`} title={userName} onClick={() => setAccountMenuOpen((open) => !open)}>
                <span aria-hidden="true">{userName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                </button>              {accountMenuOpen && <div className="account-menu-popover" role="menu" aria-label="Account options">
                
                <Link to="/profile" role="menuitem"><UserRound size={15} />My profile</Link>
                <Link to="/profile?tab=alerts" role="menuitem"><Bell size={15} />Alert preferences</Link>
                <Link to="/profile?tab=appearance" role="menuitem"><Moon size={15} />Appearance</Link>
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
