import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileDown,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Waves,
  Wifi,
  X,
} from 'lucide-react';
import Logo from '../common/Logo';
import { dashboardAlerts } from '../../data/mockDashboardData';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, target: 'dashboard-top' },
  { label: 'Monitoring', icon: Waves, target: 'water-quality' },
  { label: 'Alerts', icon: AlertTriangle, target: 'active-alerts' },
  { label: 'Operator Logs', icon: ClipboardList, target: 'operator-activity' },
  { label: 'Devices', icon: Wifi, target: 'connected-devices' },
  { label: 'Reports', icon: FileDown, target: 'water-trends' },
  { label: 'Settings', icon: Settings, target: 'quick-actions' },
];

function useManilaClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    date: new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(now),
    time: new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now),
  };
}

interface AppShellProps {
  pageTitle: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  profileActive?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  children: ReactNode;
}

export default function AppShell({
  pageTitle,
  displayName,
  initials,
  avatarUrl,
  profileActive = false,
  search,
  onSearchChange,
  searchPlaceholder,
  children,
}: AppShellProps) {
  const navigate = useNavigate();
  const clock = useManilaClock();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const unacknowledged = dashboardAlerts.filter((alert) => !alert.acknowledged);

  const avatar = (
    <span className="dashboard-avatar">
      {avatarUrl ? <img src={avatarUrl} alt="" className="avatar-image" /> : initials}
    </span>
  );

  return (
    <div className="dashboard-shell" id="dashboard-top">
      <aside className={`dashboard-sidebar${mobileNavOpen ? ' dashboard-sidebar--open' : ''}`}>
        <div className="dashboard-brand">
          <Logo size={34} className="dashboard-brand-logo" />
          <div><strong>HydroSense</strong><span>ADMIN CONSOLE</span></div>
          <button type="button" className="dashboard-icon-button dashboard-mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <p className="dashboard-nav-label">WORKSPACE</p>
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          {navigation.map(({ label, icon: Icon, target }) => (
            <button
              key={label}
              type="button"
              className="dashboard-nav-item"
              onClick={() => navigate('/dashboard', { state: { target } })}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-system-status">
            <span className="status-pulse" />
            <div><b>System operational</b><span>All sensors responding</span></div>
          </div>
          <button
            type="button"
            className={`sidebar-user${profileActive ? ' is-active' : ''}`}
            aria-label="Open profile"
            onClick={() => { setMobileNavOpen(false); navigate('/profile'); }}
          >
            {avatar}
            <div><b>{displayName}</b><span>System Administrator</span></div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button type="button" className="dashboard-icon-button dashboard-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-page-title"><span>Workspace</span><ChevronRight size={13} /><b>{pageTitle}</b></div>
          <div className="topbar-tools">
            <label className="dashboard-search">
              <Search size={16} />
              <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
              {search && <button type="button" aria-label="Clear search" onClick={() => onSearchChange('')}><X size={14} /></button>}
            </label>
            <div className="topbar-date"><Clock3 size={15} /><span>{clock.date}</span><b>{clock.time} PHT</b></div>
            <div className="notification-wrap">
              <button
                type="button"
                className="dashboard-icon-button notification-button"
                aria-label={`Notifications, ${unacknowledged.length} unacknowledged`}
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell size={18} />
                {unacknowledged.length > 0 && <span className="notification-count">{unacknowledged.length}</span>}
              </button>
              {notificationOpen && (
                <div className="notification-panel">
                  <div className="notification-panel-heading"><b>Notifications</b><span>{unacknowledged.length} unacknowledged</span></div>
                  {dashboardAlerts.map((alert) => (
                    <button key={alert.id} type="button" className="notification-item" onClick={() => navigate('/dashboard', { state: { target: 'active-alerts' } })}>
                      <span className={`notification-dot ${alert.severity === 'CRITICAL' ? 'is-critical' : ''}`} />
                      <span><b>{alert.title}</b><small>{alert.tankName} · {alert.acknowledged ? 'Acknowledged' : 'Needs attention'}</small></span>
                    </button>
                  ))}
                  <button type="button" className="notification-footer" onClick={() => navigate('/dashboard', { state: { target: 'active-alerts' } })}>
                    View active alerts <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="topbar-admin" aria-label="Open profile" onClick={() => navigate('/profile')}>
              {avatar}<div><b>{displayName}</b><span>Administrator</span></div><ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="dashboard-content profile-content">{children}</main>
      </div>
    </div>
  );
}
