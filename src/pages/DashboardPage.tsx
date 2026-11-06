import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Droplets,
  FileDown,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Leaf,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Waves,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import Logo from '../components/common/Logo';
import {
  dashboardAlerts,
  deviceSensors,
  operatorActivities,
  tanks,
  trendSeries,
} from '../data/mockDashboardData';
import type {
  DashboardAlert,
  OperatorActivity,
} from '../data/mockDashboardData';

type TrendRange = '24h' | '7d' | '30d';
type AlertFilter = 'ALL' | 'CRITICAL' | 'WARNING';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, target: 'dashboard-top' },
  { label: 'Monitoring', icon: Waves, target: 'water-quality' },
  { label: 'Alerts', icon: AlertTriangle, target: 'active-alerts' },
  { label: 'Operator Logs', icon: ClipboardList, target: 'operator-activity' },
  { label: 'Devices', icon: Wifi, target: 'connected-devices' },
  { label: 'Reports', icon: FileDown, target: 'water-trends' },
  { label: 'Settings', icon: Settings, target: 'quick-actions' },
];

const summaryMetrics = [
  { label: 'Total Tanks', value: '3', note: 'Across this hatchery', icon: Waves, tone: 'aqua' },
  { label: 'Monitoring Devices', value: '3', note: 'Active monitoring', icon: Gauge, tone: 'blue' },
  { label: 'Online Sensors', value: '3', note: 'All systems online', icon: Wifi, tone: 'green' },
  { label: 'Active Alerts', value: '2', note: '1 critical · 1 warning', icon: AlertTriangle, tone: 'orange' },
  { label: 'Critical Alerts', value: '1', note: 'Requires verification', icon: ShieldAlert, tone: 'critical' },
  { label: 'Registered Operators', value: '5', note: 'Team members', icon: ClipboardList, tone: 'violet' },
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

function StatusBadge({
  children,
  tone,
}: {
  children: string;
  tone: 'safe' | 'warning' | 'critical' | 'neutral' | 'online';
}) {
  return <span className={`dashboard-badge dashboard-badge--${tone}`}>{children}</span>;
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dashboard-section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Sparkline({
  values,
  color,
}: {
  values: readonly number[];
  color: string;
}) {
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 33 - ((value - Math.min(...values)) / (Math.max(...values) - Math.min(...values) || 1)) * 25;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="dashboard-sparkline" viewBox="0 0 100 36" role="img" aria-label="Recent trend">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendChart({
  label,
  unit,
  color,
  values,
  range,
}: {
  label: string;
  unit: string;
  color: string;
  values: readonly number[];
  range: TrendRange;
}) {
  const points = useMemo(() => {
    const desiredCount = range === '24h' ? 8 : range === '7d' ? 7 : 10;
    const sampled = Array.from({ length: desiredCount }, (_, index) => {
      const sourceIndex = Math.round((index / (desiredCount - 1)) * (values.length - 1));
      return values[sourceIndex];
    });
    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const padding = (max - min || 1) * 0.22;
    const low = min - padding;
    const high = max + padding;
    const coords = sampled.map((value, index) => ({
      x: 8 + (index / (sampled.length - 1)) * 284,
      y: 82 - ((value - low) / (high - low)) * 66,
      value,
    }));
    return { coords, min, max, average: sampled.reduce((sum, item) => sum + item, 0) / sampled.length };
  }, [range, values]);
  const path = points.coords.map(({ x, y }) => `${x},${y}`).join(' ');
  const current = points.coords[points.coords.length - 1].value;
  const trend = current >= points.coords[0].value ? 'Rising' : 'Falling';

  return (
    <article className="dashboard-card trend-card">
      <div className="trend-card-header">
        <div>
          <p className="dashboard-eyebrow">{label}</p>
          <strong>{current.toFixed(1)} <small>{unit}</small></strong>
        </div>
        <span className={`trend-direction ${trend === 'Rising' ? 'is-rising' : 'is-falling'}`}>
          {trend === 'Rising' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend}
        </span>
      </div>
      <svg className="trend-chart" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label={`${label} trend over ${range}`}>
        <defs>
          <linearGradient id={`fill-${label.replace(/\s/g, '-')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".24" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="8" y1="82" x2="292" y2="82" className="chart-grid-line" />
        <line x1="8" y1="49" x2="292" y2="49" className="chart-grid-line" />
        <line x1="8" y1="16" x2="292" y2="16" className="chart-grid-line" />
        <polygon points={`8,100 ${path} 292,100`} fill={`url(#fill-${label.replace(/\s/g, '-')})`} />
        <polyline points={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.coords.map(({ x, y }, index) => (
          <circle key={`${x}-${index}`} cx={x} cy={y} r={index === points.coords.length - 1 ? 3.5 : 2} fill={color} />
        ))}
      </svg>
      <div className="chart-labels">
        <span>{range === '24h' ? '12 AM' : range === '7d' ? 'Nov 1' : 'Oct 8'}</span>
        <span>{range === '24h' ? '6 AM' : range === '7d' ? 'Nov 4' : 'Oct 23'}</span>
        <span>Now</span>
      </div>
      <div className="trend-stats">
        <span>Avg <b>{points.average.toFixed(1)} {unit}</b></span>
        <span>Min <b>{points.min.toFixed(1)}</b></span>
        <span>Max <b>{points.max.toFixed(1)}</b></span>
      </div>
    </article>
  );
}

function AlertCard({
  alert,
  thresholdValue,
  onAcknowledge,
  onDetails,
}: {
  alert: DashboardAlert;
  thresholdValue: number;
  onAcknowledge: (id: string) => void;
  onDetails: (alert: DashboardAlert) => void;
}) {
  const critical = alert.severity === 'CRITICAL';
  return (
    <article className={`alert-card ${critical ? 'alert-card--critical' : 'alert-card--warning'}`}>
      <div className="alert-card-indicator" aria-hidden="true">
        {critical ? <ShieldAlert size={19} /> : <AlertTriangle size={19} />}
      </div>
      <div className="alert-card-content">
        <div className="alert-title-row">
          <h3>{alert.title}</h3>
          <StatusBadge tone={critical ? 'critical' : 'warning'}>{alert.severity}</StatusBadge>
        </div>
        <p className="alert-tank">{alert.tankName}</p>
        <p className="alert-description">{alert.description}</p>
        <div className="alert-meta">
          <span><Clock3 size={13} />{alert.timestamp}</span>
          <span>{alert.source}</span>
          {alert.sensorReading && (
            <span className="alert-reading">{alert.sensorReading} <small>vs. {thresholdValue.toFixed(1)} mg/L configured</small></span>
          )}
        </div>
        <div className="alert-actions">
          <button type="button" className="dashboard-button dashboard-button--subtle" onClick={() => onDetails(alert)}>
            View Details <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className={`dashboard-button ${alert.acknowledged ? 'dashboard-button--acknowledged' : 'dashboard-button--primary'}`}
            onClick={() => onAcknowledge(alert.id)}
            disabled={alert.acknowledged}
          >
            {alert.acknowledged ? <><Check size={14} /> Acknowledged</> : 'Acknowledge'}
          </button>
        </div>
      </div>
    </article>
  );
}

function ActivityTable({ records }: { records: OperatorActivity[] }) {
  if (!records.length) {
    return <p className="dashboard-empty">No activity matches your search.</p>;
  }
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr><th>Time</th><th>Operator</th><th>Activity</th><th>Tank</th><th>Details</th></tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={`${record.time}-${record.operator}-${index}`}>
              <td className="table-time">{record.time}</td>
              <td>{record.operator}</td>
              <td>{record.activity}</td>
              <td>{record.tank}</td>
              <td>{record.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const clock = useManilaClock();
  const [selectedTankId, setSelectedTankId] = useState(tanks[0].id);
  const [alerts, setAlerts] = useState(dashboardAlerts);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('ALL');
  const [trendRange, setTrendRange] = useState<TrendRange>('24h');
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DashboardAlert | null>(null);
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(4);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [notice, setNotice] = useState('');
  const [activeNavigation, setActiveNavigation] = useState('Dashboard');

  const tank = tanks.find((item) => item.id === selectedTankId) ?? tanks[0];
  const tankAlerts = alerts.filter((alert) => alert.tankId === tank.id);
  const criticalAlert = tankAlerts.some((alert) => alert.severity === 'CRITICAL');
  const overallStatus = criticalAlert ? 'CRITICAL' : tankAlerts.length ? 'WARNING' : 'SAFE';
  const unacknowledgedCount = alerts.filter((alert) => !alert.acknowledged).length;
  const filteredAlerts = tankAlerts.filter((alert) => {
    const matchesSeverity = alertFilter === 'ALL' || alert.severity === alertFilter;
    const matchesSearch = `${alert.title} ${alert.tankName} ${alert.description}`.toLowerCase().includes(search.toLowerCase());
    return matchesSeverity && matchesSearch;
  });
  const filteredActivities = operatorActivities
    .filter((record) =>
      `${record.operator} ${record.activity} ${record.tank} ${record.details}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, activityExpanded ? operatorActivities.length : 4);

  function acknowledgeAlert(id: string) {
    setAlerts((current) =>
      current.map((alert) => alert.id === id ? { ...alert, acknowledged: true } : alert),
    );
    setSelectedAlert((current) =>
      current?.id === id ? { ...current, acknowledged: true } : current,
    );
    setNotice('Alert acknowledged. The underlying condition remains active until verified and resolved.');
  }

  function goToSection(target: string) {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const activeItem = navigation.find((item) => item.target === target);
    if (activeItem) setActiveNavigation(activeItem.label);
    setMobileNavOpen(false);
  }

  function refreshReadings() {
    setLastUpdated(new Date());
    setNotice('Demonstration readings refreshed.');
  }

  function downloadReport() {
    const rows = [
      ['Metric', 'Value', 'Unit', 'Tank'],
      ['Dissolved Oxygen', tank.dissolvedOxygen.toFixed(1), 'mg/L', tank.name],
      ['Temperature', tank.temperature.toFixed(1), '°C', tank.name],
      ['pH', tank.ph.toFixed(1), 'pH', tank.name],
      ['Salinity', 'Not measured', '', tank.name],
      ['Active alerts', String(tankAlerts.length), '', tank.name],
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tank.id}-demonstration-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Demonstration report downloaded.');
  }

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
              className={`dashboard-nav-item${activeNavigation === label ? ' is-active' : ''}`}
              onClick={() => goToSection(target)}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {activeNavigation === label && <span className="nav-active-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-system-status">
            <span className="status-pulse" />
            <div><b>System operational</b><span>All sensors responding</span></div>
          </div>
          <div className="sidebar-user">
            <span className="dashboard-avatar">DM</span>
            <div><b>Dario Miñoza</b><span>System Administrator</span></div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button type="button" className="dashboard-icon-button dashboard-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-page-title"><span>Workspace</span><ChevronRight size={13} /><b>Dashboard</b></div>
          <div className="topbar-tools">
            <label className="dashboard-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dashboard..." aria-label="Search dashboard" />
              {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
            </label>
            <div className="topbar-date"><Clock3 size={15} /><span>{clock.date}</span><b>{clock.time} PHT</b></div>
            <div className="notification-wrap">
              <button
                type="button"
                className="dashboard-icon-button notification-button"
                aria-label={`Notifications, ${unacknowledgedCount} unacknowledged`}
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell size={18} />
                {unacknowledgedCount > 0 && <span className="notification-count">{unacknowledgedCount}</span>}
              </button>
              {notificationOpen && (
                <div className="notification-panel">
                  <div className="notification-panel-heading"><b>Notifications</b><span>{unacknowledgedCount} unacknowledged</span></div>
                  {alerts.map((alert) => (
                    <button key={alert.id} type="button" className="notification-item" onClick={() => { setSelectedAlert(alert); setNotificationOpen(false); }}>
                      <span className={`notification-dot ${alert.severity === 'CRITICAL' ? 'is-critical' : ''}`} />
                      <span><b>{alert.title}</b><small>{alert.tankName} · {alert.acknowledged ? 'Acknowledged' : 'Needs attention'}</small></span>
                    </button>
                  ))}
                  <button type="button" className="notification-footer" onClick={() => { goToSection('active-alerts'); setNotificationOpen(false); }}>
                    View active alerts <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="topbar-admin"><span className="dashboard-avatar">DM</span><div><b>Dario Miñoza</b><span>Administrator</span></div><ChevronDown size={15} /></div>
          </div>
        </header>

        <main className="dashboard-content">
          <div className="dashboard-demo-banner">
            <span className="demo-pulse" /> DEMONSTRATION DATA <span>Sample readings and alerts are for interface demonstration only.</span>
          </div>

          <section className="dashboard-welcome">
            <div>
              <p className="dashboard-kicker">SATURDAY · HATCHERY OVERVIEW</p>
              <h1>Welcome back, Dario<span>.</span></h1>
              <p>Here&apos;s the current monitoring status of your hatchery.</p>
            </div>
            <div className="welcome-controls">
              <label htmlFor="tank-select">CURRENT TANK</label>
              <div className="tank-select-wrap">
                <Waves size={16} />
                <select id="tank-select" value={selectedTankId} onChange={(event) => setSelectedTankId(event.target.value)}>
                  {tanks.map((item) => <option key={item.id} value={item.id}>{item.name} – {item.type}</option>)}
                </select>
                <ChevronDown size={15} />
              </div>
              <span className="last-updated">Last updated {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }).format(lastUpdated)} PHT</span>
            </div>
          </section>

          <section className="summary-grid" aria-label="Monitoring summary">
            {summaryMetrics.map(({ label, value, note, icon: Icon, tone }) => (
              <article className="dashboard-card summary-card" key={label}>
                <div className={`summary-icon summary-icon--${tone}`}><Icon size={17} /></div>
                <div className="summary-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
              </article>
            ))}
          </section>

          <section className="dashboard-section tank-overview-section">
            <SectionHeading title="Current Tank Status" description="A live snapshot of the selected tank." />
            <article className="dashboard-card tank-status-card">
              <div className="tank-status-main">
                <div className="tank-watermark"><Waves size={86} strokeWidth={1} /></div>
                <div className="tank-status-heading">
                  <span className="dashboard-eyebrow">SELECTED TANK</span>
                  <h3>{tank.name} <span>— {tank.type}</span></h3>
                  <div className="tank-badges">
                    <StatusBadge tone={overallStatus === 'CRITICAL' ? 'critical' : overallStatus === 'WARNING' ? 'warning' : 'safe'}>{overallStatus}</StatusBadge>
                    <StatusBadge tone="online">MONITORING ACTIVE</StatusBadge>
                  </div>
                </div>
                <div className="tank-status-facts">
                  <div><span>Connected sensors</span><b><Wifi size={14} /> {tank.sensors} of 3 online</b></div>
                  <div><span>Active alerts</span><b className={tankAlerts.length ? 'fact-warning' : ''}><AlertTriangle size={14} /> {tankAlerts.length} active</b></div>
                  <div><span>Last successful reading</span><b><Clock3 size={14} /> {tank.lastReading}</b></div>
                  <div><span>Last data transmission</span><b><Zap size={14} /> {tank.lastReading}</b></div>
                </div>
              </div>
              <div className="tank-status-footer">
                <span><span className="status-pulse" /> Receiving live sensor data</span>
                <span>Thresholds are configurable demo values, not hatchery standards.</span>
              </div>
            </article>
          </section>

          <section className="dashboard-section" id="water-quality">
            <SectionHeading title="Live Water Quality" description={`${tank.name} · Latest readings at ${tank.lastReading}`} action={<span className="section-live-indicator"><span className="status-pulse" /> LIVE</span>} />
            <div className="parameter-grid">
              <article className="dashboard-card parameter-card">
                <div className="parameter-top">                <span className="parameter-icon parameter-icon--aqua"><Droplets size={18} /></span><StatusBadge tone={tank.dissolvedOxygen > threshold ? 'safe' : 'warning'}>{tank.dissolvedOxygen > threshold ? 'OPTIMAL' : 'LOW'}</StatusBadge></div>
                <span className="dashboard-eyebrow">DISSOLVED OXYGEN</span>
                <div className="parameter-value">{tank.dissolvedOxygen.toFixed(1)} <small>mg/L</small></div>
                <div className="parameter-footer"><span>Configured minimum</span><label className="threshold-control"><input aria-label="Configured dissolved oxygen minimum threshold" type="number" min="0.1" max="20" step="0.1" value={threshold} onChange={(event) => setThreshold(Math.min(20, Math.max(0.1, Number(event.target.value) || 0.1)))} /> mg/L</label></div>
                <Sparkline values={trendSeries.dissolvedOxygen.values} color={trendSeries.dissolvedOxygen.color} />
                <span className="parameter-timestamp"><Clock3 size={12} /> Updated {tank.lastReading}</span>
              </article>
              <article className="dashboard-card parameter-card">
                <div className="parameter-top"><span className="parameter-icon parameter-icon--orange"><Thermometer size={18} /></span><StatusBadge tone="safe">OPTIMAL</StatusBadge></div>
                <span className="dashboard-eyebrow">TEMPERATURE</span>
                <div className="parameter-value">{tank.temperature.toFixed(1)} <small>°C</small></div>
                <div className="parameter-note"><TrendingUp size={13} /> Slight increase over recent hours</div>
                <Sparkline values={trendSeries.temperature.values} color={trendSeries.temperature.color} />
                <span className="parameter-timestamp"><Clock3 size={12} /> Updated {tank.lastReading}</span>
              </article>
              <article className="dashboard-card parameter-card">
                <div className="parameter-top"><span className="parameter-icon parameter-icon--blue"><FlaskConical size={18} /></span><StatusBadge tone="safe">OPTIMAL</StatusBadge></div>
                <span className="dashboard-eyebrow">pH</span>
                <div className="parameter-value">{tank.ph.toFixed(1)} <small>pH units</small></div>
                <div className="parameter-note"><span className="stable-mark">—</span> Stable across recent readings</div>
                <Sparkline values={trendSeries.ph.values} color={trendSeries.ph.color} />
                <span className="parameter-timestamp"><Clock3 size={12} /> Updated {tank.lastReading}</span>
              </article>
              <article className="dashboard-card parameter-card parameter-card--advisory">
                <div className="parameter-top"><span className="parameter-icon parameter-icon--violet"><Waves size={18} /></span><StatusBadge tone="warning">VERIFY</StatusBadge></div>
                <span className="dashboard-eyebrow">SALINITY</span>
                <div className="parameter-value parameter-not-measured">Not measured</div>
                <div className="parameter-note">No directly connected salinity sensor</div>
                <div className="parameter-advice"><AlertTriangle size={13} /> Verify using a calibrated instrument.</div>
              </article>
            </div>
          </section>

          <section className="dashboard-section" id="water-trends">
            <SectionHeading
              title="Water Quality Trends"
              description="Historical demonstration readings · Sample trends, not validated operating limits."
              action={
                <div className="range-switch" role="group" aria-label="Trend time range">
                  {([['24h', '24 Hours'], ['7d', '7 Days'], ['30d', '30 Days']] as const).map(([value, label]) => (
                    <button key={value} type="button" className={trendRange === value ? 'is-active' : ''} aria-pressed={trendRange === value} onClick={() => setTrendRange(value)}>{label}</button>
                  ))}
                </div>
              }
            />
            <div className="trend-grid">
              <TrendChart {...trendSeries.dissolvedOxygen} range={trendRange} />
              <TrendChart {...trendSeries.temperature} range={trendRange} />
              <TrendChart {...trendSeries.ph} range={trendRange} />
            </div>
          </section>

          <section className="dashboard-section" id="active-alerts">
            <SectionHeading
              title="Active Alerts"
              description={`${unacknowledgedCount} unacknowledged · Acknowledging an alert does not resolve its underlying condition.`}
              action={
                <label className="alert-filter">
                  <span>Severity</span>
                  <select value={alertFilter} onChange={(event) => setAlertFilter(event.target.value as AlertFilter)} aria-label="Filter alerts by severity">
                    <option value="ALL">All alerts</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="WARNING">Warning</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              }
            />
            {filteredAlerts.length ? (
              <div className="alert-list">
                {filteredAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} thresholdValue={alert.sensorReading ? threshold : alert.threshold ?? threshold} onAcknowledge={acknowledgeAlert} onDetails={setSelectedAlert} />)}
              </div>
            ) : (
              <div className="dashboard-card dashboard-empty-card">{tankAlerts.length ? 'No alerts match this filter.' : `No active alerts for ${tank.name}.`}</div>
            )}
          </section>

          <section className="dashboard-section" id="risk-advisories">
            <SectionHeading title="Environmental Risk Advisories" description="Rule-based reminders for additional verification. No unmeasured values are inferred." />
            <div className="advisory-grid">
              <article className="dashboard-card advisory-card advisory-card--warning">
                <div className="advisory-icon"><Waves size={18} /></div>
                <div className="advisory-content">
                  <div className="advisory-title-row"><span className="dashboard-eyebrow">SALINITY RISK</span><StatusBadge tone="warning">WARNING</StatusBadge></div>
                  <h3>Possible Increasing Salinity Conditions</h3>
                  <p>Recent environmental patterns and operator observations may indicate conditions that favor increasing salinity.</p>
                  <div className="advisory-evidence"><span>Rising temperature trend</span><span>Reported water-level decline</span><span>Possible evaporation</span></div>
                  <strong className="advisory-action">Recommended: Verify tank salinity using a calibrated instrument.</strong>
                </div>
              </article>
              <article className="dashboard-card advisory-card advisory-card--monitor">
                <div className="advisory-icon"><Leaf size={18} /></div>
                <div className="advisory-content">
                  <div className="advisory-title-row"><span className="dashboard-eyebrow">WATER CHEMISTRY</span><StatusBadge tone="neutral">MONITOR</StatusBadge></div>
                  <h3>Possible Ammonia Accumulation Risk</h3>
                  <p>Current monitoring conditions may warrant additional attention to potential ammonia accumulation.</p>
                  <div className="advisory-evidence"><span>Review pH and temperature trends</span><span>Consider operator observations</span></div>
                  <strong className="advisory-action">Recommended: Consider verifying ammonia using an appropriate water-testing method.</strong>
                </div>
              </article>
            </div>
          </section>

          <div className="dashboard-lower-grid">
            <section className="dashboard-section" id="operator-activity">
              <SectionHeading
                title="Recent Operator Activity"
                description="Latest hatchery observations and activities."
                action={<button type="button" className="dashboard-text-button" onClick={() => setActivityExpanded((expanded) => !expanded)}>{activityExpanded ? 'Show less' : 'View all'} <ChevronRight size={14} /></button>}
              />
              <article className="dashboard-card activity-card">
                <ActivityTable records={filteredActivities} />
              </article>
            </section>
            <section className="dashboard-section" id="connected-devices">
              <SectionHeading title="Connected Devices" description={`${tank.name} sensor connectivity`} action={<span className="device-online-count"><Wifi size={14} /> 3 online</span>} />
              <article className="dashboard-card device-card">
                <div className="device-table-head"><span>DEVICE / SENSOR</span><span>STATUS</span><span>LAST UPDATE</span></div>
                {deviceSensors.map((device) => (
                  <div className="device-row" key={device.sensor}>
                    <span className="device-name"><span className="device-icon"><Activity size={15} /></span>                    <span><b>{device.sensor}</b><small>HS-{String(Number(tank.id.slice(-2))).padStart(3, '0')}</small></span></span>
                    <StatusBadge tone="online">{device.status}</StatusBadge>
                    <span className="device-time">{tank.lastReading}</span>
                  </div>
                ))}
                <div className="device-footer"><span className="status-pulse" /> All connected sensors are transmitting</div>
              </article>
            </section>
          </div>

          <section className="dashboard-section quick-actions-section" id="quick-actions">
            <SectionHeading title="Quick Actions" description="Common monitoring tasks, all within this dashboard." />
            <div className="quick-actions-grid">
              <button type="button" onClick={() => goToSection('active-alerts')}><span><AlertTriangle size={17} /></span><b>View All Alerts</b><ChevronRight size={15} /></button>
              <button type="button" onClick={() => { setActivityExpanded(true); goToSection('operator-activity'); }}><span><ClipboardList size={17} /></span><b>Review Operator Logs</b><ChevronRight size={15} /></button>
              <button type="button" onClick={downloadReport}><span><FileDown size={17} /></span><b>Generate Report</b><ChevronRight size={15} /></button>
              <button type="button" onClick={refreshReadings}><span><Zap size={17} /></span><b>Refresh Readings</b><ChevronRight size={15} /></button>
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>HydroSense Monitoring Console</span>
            <span>Dashboard time: {clock.time} PHT · Data shown for demonstration purposes.</span>
          </footer>
        </main>
      </div>

      {mobileNavOpen && <button type="button" className="dashboard-sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {notice && (
        <div className="dashboard-toast" role="status">
          <Check size={16} /> {notice}
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button>
        </div>
      )}
      {selectedAlert && (
        <div className="dashboard-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAlert(null); }}>
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="alert-modal-title">
            <div className="dashboard-modal-heading">
              <span className={`modal-alert-icon ${selectedAlert.severity === 'CRITICAL' ? 'is-critical' : ''}`}><AlertTriangle size={20} /></span>
              <button type="button" className="dashboard-icon-button" aria-label="Close alert details" onClick={() => setSelectedAlert(null)}><X size={18} /></button>
            </div>
            <StatusBadge tone={selectedAlert.severity === 'CRITICAL' ? 'critical' : 'warning'}>{selectedAlert.severity}</StatusBadge>
            <h2 id="alert-modal-title">{selectedAlert.title}</h2>
            <p className="modal-tank">{selectedAlert.tankName}</p>
            <div className="modal-details-grid">
              <div><span>Timestamp</span><b>{selectedAlert.timestamp}</b></div>
              <div><span>Source</span><b>{selectedAlert.source}</b></div>
              {selectedAlert.operator && <div><span>Operator</span><b>{selectedAlert.operator}</b></div>}
              {selectedAlert.sensorReading && <div><span>Sensor reading</span><b>{selectedAlert.sensorReading} · Configured minimum {threshold.toFixed(1)} mg/L</b></div>}
              <div><span>Alert status</span><b>{selectedAlert.acknowledged ? 'Acknowledged · condition not confirmed resolved' : 'Unacknowledged'}</b></div>
            </div>
            <div className="modal-description"><span>Description</span><p>{selectedAlert.description}</p></div>
            <div className="modal-description"><span>Recommended action</span><p>{selectedAlert.recommendedAction}</p></div>
            {!selectedAlert.acknowledged && <button type="button" className="dashboard-button dashboard-button--primary modal-acknowledge" onClick={() => acknowledgeAlert(selectedAlert.id)}>Acknowledge alert</button>}
            <p className="modal-demo-note">Demonstration alert only. Verify sensor readings and follow established hatchery procedures.</p>
          </section>
        </div>
      )}
    </div>
  );
}
