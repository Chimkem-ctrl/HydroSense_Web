import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  CloudRain,
  Droplets,
  Fish,
  FlaskConical,
  Home,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Waves,
  Wifi,
  Wind,
  X,
} from 'lucide-react';
import { getCurrentUser, signOut, SUBSCRIBED_HATCHERIES } from '../services/authService';
import { readTankRegistry, tanks } from '../data/mockDashboardData';
import { ACTIVITY_EVENT_TYPES, ACTIVITY_OPERATION_TYPES } from '@hydrosense/shared';
import {
  getThreeHourReadings,
  operatorAlerts,
  operatorName,
} from '../data/mockOperatorData';
import type {
  OperatorAlert,
  OperatorLog,
  ThreeHourReading,
} from '../data/mockOperatorData';

type ModalType = 'log' | 'resolve' | null;
type LogFormKind = 'OPERATION' | 'ENVIRONMENT';

const DO_DEMO_THRESHOLD = 4;
const STORAGE_KEYS = {
  alerts: 'hydrosense.operator.alerts.v1',
  logs: 'hydrosense.operator.logs.v1',
};

const navigation = [
  { label: 'Overview', icon: Home, target: '/operator' },
  { label: 'Water Quality', icon: Droplets, target: '/operator/readings' },
  { label: 'Reading History', icon: Activity, target: '/operator/history' },
  { label: 'Alerts', icon: AlertTriangle, target: '/operator/alerts' },
  { label: 'Activity Log', icon: ClipboardList, target: '/operator/logs' },
  { label: 'Sensors', icon: Wifi, target: '/operator/sensors' },
  { label: 'Quick Actions', icon: Plus, target: '/operator/actions' },
];

function useManilaTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    now,
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

function formatManilaTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatReadingTimestamp(label: string, now: Date) {
  if (label === 'Latest') return `Latest · ${formatManilaTimestamp(now)} PHT`;
  const elapsedHours = Number(label.split(' ')[0]);
  if (!Number.isFinite(elapsedHours)) return label;
  return `${formatManilaTimestamp(new Date(now.getTime() - elapsedHours * 60 * 60 * 1000))} PHT`;
}

function usePersistedState<T>(
  key: string,
  initialValue: T,
  validate: (value: unknown) => value is T,
  onStorageError: (message: string) => void,
) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);
        if (validate(parsed)) setValue(parsed);
        else onStorageError('Saved operator data has an unexpected format. Demo records are shown instead.');
      }
    } catch (error) {
      onStorageError(`Could not load saved operator data: ${String(error)}`);
    } finally {
      setLoaded(true);
    }
  }, [key, onStorageError, validate]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      onStorageError(`Could not save operator changes in this browser: ${String(error)}`);
    }
  }, [key, loaded, onStorageError, value]);

  return [value, setValue] as const;
}

function isOperatorAlertList(value: unknown): value is OperatorAlert[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === 'object' &&
    item !== null &&
    'id' in item && typeof item.id === 'string' &&
    'tankId' in item && typeof item.tankId === 'string' &&
    'title' in item && typeof item.title === 'string' &&
    'description' in item && typeof item.description === 'string' &&
    'detectedAt' in item && typeof item.detectedAt === 'string' &&
    'severity' in item && ['WARNING', 'CRITICAL'].includes(String(item.severity)) &&
    'status' in item && ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(String(item.status)),
  );
}

function isOperatorLogList(value: unknown): value is OperatorLog[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === 'object' &&
    item !== null &&
    'id' in item && typeof item.id === 'string' &&
    'tankId' in item && typeof item.tankId === 'string' &&
    'kind' in item && ['OPERATION', 'ENVIRONMENT', 'ALERT RESOLUTION'].includes(String(item.kind)) &&
    'type' in item && typeof item.type === 'string' &&
    'occurredAt' in item && typeof item.occurredAt === 'string' &&
    'operator' in item && typeof item.operator === 'string' &&
    'notes' in item && typeof item.notes === 'string',
  );
}

function OperatorBadge({
  children,
  tone,
}: {
  children: string;
  tone: 'safe' | 'warning' | 'critical' | 'muted' | 'online';
}) {
  return <span className={`operator-badge operator-badge--${tone}`}>{children}</span>;
}

function OperatorSectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="operator-section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function ReadingTrend({ values, color }: { values: number[]; color: string }) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 31 - ((value - low) / (high - low || 1)) * 23;
    return `${x},${y}`;
  });
  return (
    <svg className="operator-sparkline" viewBox="0 0 100 34" role="img" aria-label="Recent 3-hour sensor trend">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendPanel({
  readings,
  field,
  title,
  unit,
  color,
  critical,
}: {
  readings: ThreeHourReading[];
  field: 'dissolvedOxygen' | 'temperature' | 'ph';
  title: string;
  unit: string;
  color: string;
  critical?: boolean;
}) {
  const values = readings.map((reading) => reading[field]);
  const latest = values[values.length - 1];
  const earlier = values[values.length - 2];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rising = latest >= earlier;
  return (
    <article className={`operator-card operator-trend-card${critical ? ' operator-trend-card--critical' : ''}`}>
      <div className="operator-trend-topline">
        <span className="operator-overline">{title}</span>
        {critical ? (
          <OperatorBadge tone="critical">CHECK NOW</OperatorBadge>
        ) : (
          <span className={`operator-trend-direction${rising ? ' is-up' : ' is-down'}`}>
            {rising ? '↑' : '↓'} {rising ? 'Rising' : 'Falling'}
          </span>
        )}
      </div>
      <div className="operator-trend-value">{latest.toFixed(1)} <small>{unit}</small></div>
      <ReadingTrend values={values} color={color} />
      <div className="operator-trend-meta">
        <span>24-hour avg <b>{average.toFixed(1)} {unit}</b></span>
        <span>Updated every 3 hours</span>
      </div>
    </article>
  );
}

function OperatorModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="operator-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="operator-modal" role="dialog" aria-modal="true" aria-labelledby="operator-modal-title">
        <div className="operator-modal-heading">
          <div>
            <h2 id="operator-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="operator-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function OperatorDashboardPage() {
  const time = useManilaTime();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = location.pathname === '/operator'
    ? 'overview'
    : location.pathname.split('/')[2] ?? 'overview';
  const signedInUser = getCurrentUser();
  const activeOperatorName = signedInUser?.role === 'operator'
    ? `${signedInUser.firstName} ${signedInUser.lastName}`
    : operatorName;
  const activeOperatorInitials = activeOperatorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const activeHatchery = SUBSCRIBED_HATCHERIES.find((item) => item.id === signedInUser?.hatcheryId);
  const [storageError, setStorageError] = useState('');
  const reportStorageError = useMemo(() => (message: string) => setStorageError(message), []);
  const [alerts, setAlerts] = usePersistedState(
    STORAGE_KEYS.alerts,
    operatorAlerts,
    isOperatorAlertList,
    reportStorageError,
  );
  const [logs, setLogs] = usePersistedState(
    STORAGE_KEYS.logs,
    [] as OperatorLog[],
    isOperatorLogList,
    reportStorageError,
  );
  const [availableTanks, setAvailableTanks] = useState(tanks);
  const [tankId, setTankId] = useState(tanks[0].id);
  const [entryTankId, setEntryTankId] = useState(tanks[0].id);
  const [modal, setModal] = useState<ModalType>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [activityKind, setActivityKind] = useState<LogFormKind>('OPERATION');
  const [activityType, setActivityType] = useState<string>(ACTIVITY_OPERATION_TYPES[0]);
  const [activityNotes, setActivityNotes] = useState('');
  const [waterChangePercent, setWaterChangePercent] = useState('');
  const [waterSource, setWaterSource] = useState('');
  const [manualReadings, setManualReadings] = useState({
    dissolvedOxygen: '',
    temperature: '',
    ph: '',
    salinity: '',
    method: '',
  });
  const [environmentImpact, setEnvironmentImpact] = useState('Moderate');
  const [formError, setFormError] = useState('');
  const [resolutionAlertId, setResolutionAlertId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [verificationReading, setVerificationReading] = useState('');
  const [resolutionError, setResolutionError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  const selectedTank = availableTanks.find((tank) => tank.id === tankId) ?? availableTanks[0] ?? tanks[0];
  const resolvedDoAlert = alerts.find((alert) =>
    alert.id === 'operator-do-critical' &&
    alert.tankId === tankId &&
    alert.status === 'RESOLVED' &&
    alert.verificationReading !== undefined,
  );
  const resolvedDissolvedOxygen = resolvedDoAlert?.verificationReading;
  const readings = getThreeHourReadings(tankId).map((reading, index, list) =>
    index === list.length - 1 && resolvedDissolvedOxygen !== undefined
      ? { ...reading, dissolvedOxygen: resolvedDissolvedOxygen }
      : reading,
  );
  const latestReading = readings[readings.length - 1];
  const activeAlerts = alerts.filter((alert) => alert.tankId === tankId && alert.status !== 'RESOLVED');
  const critical = activeAlerts.some((alert) => alert.severity === 'CRITICAL') ||
    latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD;
  const warning = activeAlerts.some((alert) => alert.severity === 'WARNING');
  const overallStatus = critical ? 'CRITICAL' : warning ? 'WARNING' : 'SAFE';
  const unacknowledgedAlerts = activeAlerts.filter((alert) => alert.status === 'ACTIVE').length;
  const sensorStatus = selectedTank.hardwareConnected === false ? 'OFFLINE' : 'ONLINE';

  useEffect(() => {
    function loadTankRegistry() {
      try {
        const savedTanks = readTankRegistry();
        setAvailableTanks(savedTanks);
        setTankId((current) => savedTanks.some((tank) => tank.id === current) ? current : savedTanks[0]?.id ?? '');
      } catch (error) {
        setStorageError(String(error));
      }
    }
    loadTankRegistry();
    window.addEventListener('storage', loadTankRegistry);
    return () => window.removeEventListener('storage', loadTankRegistry);
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 5500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!modal) return undefined;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setModal(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal]);

  const logsForTank = logs
    .filter((log) => log.tankId === tankId || (log.tankId === 'hatchery' && log.kind === 'ENVIRONMENT'))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  function navigateTo(target: string) {
    const routes: Record<string, string> = {
      'operator-alerts': '/operator/alerts',
      'operator-logs': '/operator/logs',
      'operator-readings': '/operator/readings',
    };
    navigate(routes[target] ?? '/operator');
    setMobileNavOpen(false);
  }

  function openLogModal(kind: LogFormKind) {
    setActivityKind(kind);
    setEntryTankId(kind === 'ENVIRONMENT' ? 'hatchery' : tankId);
    setActivityType(kind === 'OPERATION' ? ACTIVITY_OPERATION_TYPES[0] : ACTIVITY_EVENT_TYPES[0]);
    setActivityNotes('');
    setWaterChangePercent('');
    setWaterSource('');
    setManualReadings({ dissolvedOxygen: '', temperature: '', ph: '', salinity: '', method: '' });
    setFormError('');
    setModal('log');
  }

  function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activityNotes.trim().length < 4) {
      setFormError('Add a short description so the next shift understands what happened.');
      return;
    }
    const parsedPercent = Number(waterChangePercent);
    if (activityKind === 'OPERATION' && activityType === 'Water change / exchange' &&
      (!waterChangePercent || !Number.isFinite(parsedPercent) || parsedPercent <= 0 || parsedPercent > 100)) {
      setFormError('Enter the water-change percentage (greater than 0 and no more than 100).');
      return;
    }

    const readingEntries = [
      ['Dissolved oxygen', manualReadings.dissolvedOxygen, 'mg/L', 0, 30],
      ['Temperature', manualReadings.temperature, '°C', -5, 60],
      ['pH', manualReadings.ph, 'pH', 0, 14],
      ['Salinity', manualReadings.salinity, 'ppt', 0, 100],
    ] as const;
    const recordedManualReadings = readingEntries.flatMap(([label, rawValue, unit, min, max]) => {
      if (!rawValue.trim()) return [];
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < min || value > max) return [];
      return [{ label, value, unit }];
    });
    if (activityKind === 'OPERATION' && activityType === 'Manual water quality check') {
      const enteredReadingCount = readingEntries.filter(([, rawValue]) => rawValue.trim()).length;
      if (enteredReadingCount === 0) {
        setFormError('Enter at least one water-quality measurement from a manual instrument.');
        return;
      }
      if (recordedManualReadings.length !== enteredReadingCount) {
        setFormError('Check that each manual reading is within its allowed numeric range.');
        return;
      }
    }

    const manualReadingSummary = recordedManualReadings.length
      ? ` Manual readings: ${recordedManualReadings.map(({ label, value, unit }) => `${label} ${value} ${unit}`).join(', ')}${manualReadings.method.trim() ? ` (method: ${manualReadings.method.trim()})` : ''}.`
      : '';
    const extraDetails = activityKind === 'OPERATION' &&
      activityType === 'Water change / exchange' && waterSource.trim()
      ? ` Water source: ${waterSource.trim()}.`
      : '';
    const newLog: OperatorLog = {
      id: `log-${Date.now()}`,
      tankId: activityKind === 'ENVIRONMENT' && entryTankId === 'hatchery'
        ? 'hatchery'
        : entryTankId,
      kind: activityKind,
      type: activityType,
      occurredAt: time.now.toISOString(),
      operator: activeOperatorName,
      notes: `${activityNotes.trim()}${extraDetails}${manualReadingSummary}`,
      ...(activityKind === 'OPERATION' && activityType === 'Water change / exchange'
        ? { waterChangePercent: parsedPercent }
        : {}),
      ...(activityKind === 'ENVIRONMENT' ? { impact: environmentImpact } : {}),
      ...(recordedManualReadings.length ? {
        manualReadings: {
          ...(manualReadings.dissolvedOxygen.trim() ? { dissolvedOxygen: Number(manualReadings.dissolvedOxygen) } : {}),
          ...(manualReadings.temperature.trim() ? { temperature: Number(manualReadings.temperature) } : {}),
          ...(manualReadings.ph.trim() ? { ph: Number(manualReadings.ph) } : {}),
          ...(manualReadings.salinity.trim() ? { salinity: Number(manualReadings.salinity) } : {}),
          ...(manualReadings.method.trim() ? { method: manualReadings.method.trim() } : {}),
        },
      } : {}),
    };
    setLogs((current) => [newLog, ...current]);
    setModal(null);
    setMessage(activityKind === 'OPERATION' ? 'Hatchery operation logged.' : 'Environmental event logged.');
  }

  function acknowledgeAlert(alertId: string) {
    setAlerts((current) => current.map((alert) =>
      alert.id === alertId && alert.status === 'ACTIVE'
        ? { ...alert, status: 'ACKNOWLEDGED' }
        : alert,
    ));
    setMessage('Alert acknowledged. Keep monitoring the condition until verified resolved.');
  }

  function openResolution(alert: OperatorAlert) {
    setResolutionAlertId(alert.id);
    setResolutionNotes('');
    setVerificationReading('');
    setResolutionError('');
    setModal('resolve');
  }

  function submitResolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const alert = alerts.find((item) => item.id === resolutionAlertId);
    if (!alert) {
      setResolutionError('This alert is no longer available. Refresh the dashboard and try again.');
      return;
    }
    if (resolutionNotes.trim().length < 8) {
      setResolutionError('Describe the corrective action taken (at least 8 characters).');
      return;
    }
    const isDoAlert = alert.id === 'operator-do-critical';
    const verified = Number(verificationReading);
    if (isDoAlert && (!verificationReading || !Number.isFinite(verified) || verified < DO_DEMO_THRESHOLD)) {
      setResolutionError(`Enter a reference dissolved oxygen measurement of at least ${DO_DEMO_THRESHOLD.toFixed(1)} mg/L to confirm this demo alert is resolved. If still low, keep it active and follow hatchery procedures.`);
      return;
    }

    const resolvedAt = time.now.toISOString();
    setAlerts((current) => current.map((item) => item.id === alert.id ? {
      ...item,
      status: 'RESOLVED',
      resolutionNote: resolutionNotes.trim(),
      resolvedAt,
      ...(isDoAlert ? { verificationReading: verified } : {}),
    } : item));

    setLogs((current) => [{
      id: `resolution-${Date.now()}`,
      tankId: alert.tankId,
      kind: 'ALERT RESOLUTION',
      type: `Resolved: ${alert.title}`,
      occurredAt: resolvedAt,
      operator: activeOperatorName,
      notes: `${resolutionNotes.trim()}${isDoAlert ? ` Reference DO verification: ${verified.toFixed(1)} mg/L.` : ''}`,
    }, ...current]);
    setModal(null);
    setMessage('Alert marked resolved and added to the activity log.');
  }

  function refreshReadings() {
    setLastRefresh(new Date());
    setMessage('Demo sensor view refreshed. Sensors report on a 3-hour cadence; no live hardware was contacted.');
  }

  function downloadLog() {
    const rows = [
      ['Timestamp (PHT)', 'Tank', 'Type', 'Activity', 'Operator', 'Water change (%)', 'Manual salinity (ppt)', 'Manual DO (mg/L)', 'Manual temperature (°C)', 'Manual pH', 'Manual method', 'Impact', 'Notes'],
      ...logsForTank.map((log) => [
        formatManilaTimestamp(new Date(log.occurredAt)),
        log.tankId === 'hatchery'
          ? 'Hatchery-wide'
          : tanks.find((tank) => tank.id === log.tankId)?.name ?? log.tankId,
        log.kind,
        log.type,
        log.operator,
        log.waterChangePercent === undefined ? '' : String(log.waterChangePercent),
        log.manualReadings?.salinity === undefined ? '' : String(log.manualReadings.salinity),
        log.manualReadings?.dissolvedOxygen === undefined ? '' : String(log.manualReadings.dissolvedOxygen),
        log.manualReadings?.temperature === undefined ? '' : String(log.manualReadings.temperature),
        log.manualReadings?.ph === undefined ? '' : String(log.manualReadings.ph),
        log.manualReadings?.method ?? '',
        log.impact ?? '',
        log.notes,
      ]),
    ];
    const csv = rows.map((row) => row.map((field) => {
      const safeField = /^[\s]*[=+\-@]/.test(field) ? `'${field}` : field;
      return `"${safeField.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tankId}-operator-activity.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Operator activity log exported.');
  }

  function renderActivityTypeOptions() {
    return (activityKind === 'OPERATION' ? ACTIVITY_OPERATION_TYPES : ACTIVITY_EVENT_TYPES)
      .map((type) => <option key={type} value={type}>{type}</option>);
  }

  return (
    <div className="operator-shell" id="operator-overview">
      <aside className={`operator-sidebar${mobileNavOpen ? ' operator-sidebar--open' : ''}`}>
        <div className="operator-brand">
          <span className="operator-brand-mark"><Fish size={23} /></span>
          <span><b>HydroSense</b><small>OPERATOR WORKSPACE</small></span>
          <button type="button" className="operator-icon-button operator-mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>
        <div className="operator-hatchery-tag"><Waves size={14} /><span>{activeHatchery?.name ?? 'Camihuin, Sagay Multispecies Hatchery'}</span><ChevronDown size={13} /></div>
        <p className="operator-nav-label">YOUR WORKSPACE</p>
        <nav className="operator-nav" aria-label="Operator dashboard sections">
          {navigation.map(({ label, icon: Icon, target }) => (
            <Link key={label} to={target} className={`operator-nav-item${location.pathname === target ? ' is-active' : ''}`} onClick={() => setMobileNavOpen(false)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Alerts' && unacknowledgedAlerts > 0 && <span className="operator-nav-count">{unacknowledgedAlerts}</span>}
              {location.pathname === target && <span className="operator-nav-mark" />}
            </Link>
          ))}
        </nav>
        <div className="operator-sidebar-tools">
          <Link to="/operator/profile"><ShieldCheck size={16} /><span>My profile</span></Link>
          <Link to="/welcome" onClick={signOut}><ChevronRight size={16} /><span>Sign out</span></Link>
        </div>
        <div className="operator-sidebar-footer">
          <span className="operator-online-dot" />
          <span><b>System online</b><small>Last sync {formatManilaTimestamp(lastRefresh)} PHT</small></span>
        </div>
      </aside>

      <div className="operator-main">
        <header className="operator-topbar">
          <button type="button" className="operator-icon-button operator-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <div className="operator-breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{navigation.find((item) => item.target === location.pathname)?.label ?? 'Operator dashboard'}</b></div>
          <div className="operator-topbar-tools">
            <label className="operator-tank-switcher">
              <Waves size={14} />
              <select aria-label="Select available tank" value={tankId} onChange={(event) => setTankId(event.target.value)}>
                {availableTanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.name}</option>)}
              </select>
            </label>
            <span className="operator-clock"><Clock3 size={14} />{time.date} · {time.time} PHT</span>
            <div className="operator-notification-wrap">
              <button type="button" className="operator-icon-button operator-notification-button" aria-label={`Notifications, ${unacknowledgedAlerts} new`} aria-expanded={notificationOpen} onClick={() => setNotificationOpen((open) => !open)}>
                <Bell size={17} />{unacknowledgedAlerts > 0 && <span className="operator-notification-count">{unacknowledgedAlerts}</span>}
              </button>
              {notificationOpen && (
                <div className="operator-notification-panel">
                  <div className="operator-notification-title"><b>My alerts</b><span>{unacknowledgedAlerts} need attention</span></div>
                  {activeAlerts.map((alert) => (
                    <button key={alert.id} type="button" onClick={() => { navigateTo('operator-alerts'); setNotificationOpen(false); }}>
                      <span className={`operator-notification-dot${alert.severity === 'CRITICAL' ? ' is-critical' : ''}`} />
                      <span><b>{alert.title}</b><small>{selectedTank.name} · {alert.status}</small></span>
                    </button>
                  ))}
                  {!activeAlerts.length && <p className="operator-no-notifications">No active alerts for this tank.</p>}
                </div>
              )}
            </div>
            <Link to="/operator/profile" className="operator-profile-button">
              <span className="operator-avatar">{activeOperatorInitials}</span><span><b>{activeOperatorName}</b><small>{signedInUser?.position ?? 'Hatchery Operator'}</small></span><ChevronDown size={14} />
            </Link>
          </div>
        </header>

        <main className="operator-content">
          <div className="operator-demo-notice"><span /> DEMO SENSOR DATA <span>Values are illustrative, not live readings or validated husbandry thresholds.</span></div>
          {currentPage === 'overview' && <section className="operator-welcome">
            <div>
              <p className="operator-kicker">HATCHERY OPERATIONS · {time.date.toUpperCase()}</p>
              <h1>Good {Number(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(time.now)) < 12 ? 'morning' : 'afternoon'}, {activeOperatorName.split(' ')[0]}.</h1>
              <p>Monitor {selectedTank.name} and leave a clear record for the next shift.</p>
            </div>
          </section>}

          {currentPage === 'overview' && <section className="operator-overview-grid">
            <article className={`operator-card operator-status-card operator-status-card--${overallStatus.toLowerCase()}`}>
              <div className="operator-status-heading">
                <div>
                  <span className="operator-overline">{selectedTank.name} · SYSTEM STATUS</span>
                  <h2>{overallStatus === 'CRITICAL' ? 'Action required' : overallStatus === 'WARNING' ? 'Attention recommended' : 'Conditions look stable'}</h2>
                  <p>{selectedTank.type} · {sensorStatus === 'ONLINE' ? 'Monitoring active' : 'Hardware not connected'}</p>
                </div>
                <span className="operator-status-icon">{overallStatus === 'SAFE' ? <Check size={20} /> : <AlertTriangle size={20} />}</span>
              </div>
              <div className="operator-status-result">
                <span className="operator-status-light" />
                <b>{overallStatus}</b>
                <span>{activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'}</span>
              </div>
              <div className="operator-status-stats">
                <div><span>Last reading</span><b>{formatManilaTimestamp(time.now)} PHT</b></div>
                <div><span>Connected sensors</span><b>{sensorStatus === 'ONLINE' ? '3 online' : 'Disconnected'}</b></div>
                <div><span>Reading interval</span><b>Every 3 hours</b></div>
              </div>
            </article>

            <article className="operator-card operator-shift-card">
              <div className="operator-shift-heading"><span className="operator-shift-icon"><ClipboardList size={17} /></span><span>YOUR SHIFT SUMMARY</span></div>
              <div className="operator-shift-stat"><b>{logsForTank.length}</b><span>Activity records<br />for this tank</span></div>
              <div className="operator-shift-line"><span>Unacknowledged alerts</span><b className={unacknowledgedAlerts ? 'operator-number-alert' : ''}>{unacknowledgedAlerts}</b></div>
              <div className="operator-shift-line"><span>Resolved this shift</span><b>{alerts.filter((alert) => alert.tankId === tankId && alert.status === 'RESOLVED').length}</b></div>
              <button type="button" className="operator-inline-action" onClick={() => openLogModal('OPERATION')}>Log an activity <ChevronRight size={14} /></button>
            </article>
          </section>}

          {currentPage === 'readings' && <section className="operator-section" id="operator-readings">
            <OperatorSectionHeading title="Current Water Quality" detail={`${selectedTank.name} · Sensor readings are collected every 3 hours`} action={<span className="operator-last-sync"><span className="operator-online-dot" /> Last sync {formatManilaTimestamp(lastRefresh)} PHT</span>} />
            <div className="operator-reading-grid">
              <article className={`operator-card operator-reading-card${latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD ? ' has-critical-reading' : ''}`}>
                <div className="operator-reading-card-top"><span className="operator-reading-icon operator-reading-icon--aqua"><Droplets size={18} /></span><OperatorBadge tone={latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD ? 'critical' : 'safe'}>{latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD ? 'LOW' : 'IN RANGE'}</OperatorBadge></div>
                <span className="operator-overline">DISSOLVED OXYGEN</span>
                <div className="operator-reading-value">{latestReading.dissolvedOxygen.toFixed(1)} <small>mg/L</small></div>
                <div className="operator-reading-context">{latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD ? `Below demo minimum of ${DO_DEMO_THRESHOLD.toFixed(1)} mg/L` : 'Compare with your hatchery guidance'}</div>
                <ReadingTrend values={readings.map((item) => item.dissolvedOxygen)} color={latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD ? '#ff777c' : '#55c7e8'} />
                <span className="operator-reading-updated"><Clock3 size={12} /> Latest 3-hour sample</span>
              </article>
              <article className="operator-card operator-reading-card">
                <div className="operator-reading-card-top"><span className="operator-reading-icon operator-reading-icon--orange"><Thermometer size={18} /></span><OperatorBadge tone={sensorStatus === 'ONLINE' ? 'safe' : 'muted'}>{sensorStatus === 'ONLINE' ? 'SENSOR ONLINE' : 'HARDWARE OFFLINE'}</OperatorBadge></div>
                <span className="operator-overline">TEMPERATURE</span>
                <div className="operator-reading-value">{latestReading.temperature.toFixed(1)} <small>°C</small></div>
                <div className="operator-reading-context">Review against tank-specific guidance</div>
                <ReadingTrend values={readings.map((item) => item.temperature)} color="#f0b467" />
                <span className="operator-reading-updated"><Clock3 size={12} /> Latest 3-hour sample</span>
              </article>
              <article className="operator-card operator-reading-card">
                <div className="operator-reading-card-top"><span className="operator-reading-icon operator-reading-icon--blue"><FlaskConical size={18} /></span><OperatorBadge tone={sensorStatus === 'ONLINE' ? 'safe' : 'muted'}>{sensorStatus === 'ONLINE' ? 'SENSOR ONLINE' : 'HARDWARE OFFLINE'}</OperatorBadge></div>
                <span className="operator-overline">pH</span>
                <div className="operator-reading-value">{latestReading.ph.toFixed(1)} <small>pH units</small></div>
                <div className="operator-reading-context">Compare with your hatchery guidance</div>
                <ReadingTrend values={readings.map((item) => item.ph)} color="#88a8ff" />
                <span className="operator-reading-updated"><Clock3 size={12} /> Latest 3-hour sample</span>
              </article>
              <article className="operator-card operator-reading-card operator-salinity-card">
                <div className="operator-reading-card-top"><span className="operator-reading-icon operator-reading-icon--violet"><Waves size={18} /></span><OperatorBadge tone="warning">VERIFY</OperatorBadge></div>
                <span className="operator-overline">SALINITY</span>
                <div className="operator-reading-value operator-not-measured">Not measured</div>
                <div className="operator-reading-context">No direct salinity measurement available.</div>
                <div className="operator-salinity-guidance"><AlertTriangle size={14} /> Check with a calibrated handheld instrument and record the result in your operation log.</div>
              </article>
            </div>
            <div className="operator-trend-grid">
              <TrendPanel readings={readings} field="dissolvedOxygen" title="Dissolved Oxygen" unit="mg/L" color={latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD ? '#f2777e' : '#62cde4'} critical={latestReading.dissolvedOxygen < DO_DEMO_THRESHOLD} />
              <TrendPanel readings={readings} field="temperature" title="Temperature" unit="°C" color="#f0b467" />
              <TrendPanel readings={readings} field="ph" title="pH" unit="pH" color="#91aaff" />
            </div>
          </section>}

          {currentPage === 'alerts' && <section className="operator-section" id="operator-alerts">
            <OperatorSectionHeading title="Active Alerts" detail="Acknowledge means seen; mark resolved only after taking action and verifying the condition." action={<span className="operator-alert-count">{unacknowledgedAlerts} need attention</span>} />
            {activeAlerts.length ? (
              <div className="operator-alert-list">
                {activeAlerts.map((alert) => (
                  <article key={alert.id} className={`operator-card operator-alert-card operator-alert-card--${alert.severity.toLowerCase()}`}>
                    <span className="operator-alert-mark"><AlertTriangle size={18} /></span>
                    <div className="operator-alert-content">
                      <div className="operator-alert-title-row"><h3>{alert.title}</h3><OperatorBadge tone={alert.severity === 'CRITICAL' ? 'critical' : 'warning'}>{alert.severity}</OperatorBadge></div>
                      <p>{alert.description}</p>
                      {alert.id === 'operator-do-critical' && alert.status !== 'RESOLVED' && <p className="operator-alert-reading-note">Latest sample: {latestReading.dissolvedOxygen.toFixed(1)} mg/L · illustrative demo minimum {DO_DEMO_THRESHOLD.toFixed(1)} mg/L. Verify with a reference instrument.</p>}
                      <div className="operator-alert-meta"><span><Clock3 size={12} /> {alert.detectedAt}</span><span>{selectedTank.name}</span><span>{alert.status === 'ACKNOWLEDGED' ? 'Seen by operator' : 'Not acknowledged'}</span></div>
                      <div className="operator-alert-actions">
                        {alert.status === 'ACTIVE' && <button type="button" className="operator-button operator-button--quiet" onClick={() => acknowledgeAlert(alert.id)}>Acknowledge</button>}
                        <button type="button" className="operator-button operator-button--primary" onClick={() => openResolution(alert)}>Log action &amp; resolve</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="operator-card operator-no-alerts"><span><Check size={17} /></span><b>No active alerts for {selectedTank.name}</b><small>Resolved alerts are kept in the activity log for handover.</small></div>
            )}
          </section>}

          {currentPage === 'history' && <section className="operator-section" id="operator-history">
            <OperatorSectionHeading title="3-Hour Sensor Readings" detail="Eight sample intervals cover the last 24 hours. Historical readings are not a substitute for direct verification." action={<button type="button" className="operator-button operator-button--quiet" onClick={refreshReadings}><RefreshCw size={13} /> Refresh view</button>} />
            <div className="operator-card operator-history-card">
              <div className="operator-history-legend"><span><i className="legend-dot legend-dot--do" /> Dissolved Oxygen (mg/L)</span><span><i className="legend-dot legend-dot--temp" /> Temperature (°C)</span><span><i className="legend-dot legend-dot--ph" /> pH</span><span className="operator-cadence"><Clock3 size={12} /> 3-hour cadence</span></div>
              <div className="operator-table-wrap">
                <table className="operator-table">
                  <thead><tr><th>Sample interval</th><th>Dissolved oxygen</th><th>Temperature</th><th>pH</th><th>Salinity</th><th>Sensor status</th></tr></thead>
                  <tbody>
                    {readings.slice().reverse().map((reading, index) => (
                      <tr key={`${reading.timestamp}-${index}`} className={index === 0 && reading.dissolvedOxygen < DO_DEMO_THRESHOLD ? 'operator-row-critical' : ''}>
                        <td>{formatReadingTimestamp(reading.timestamp, time.now)}</td>
                        <td><b>{reading.dissolvedOxygen.toFixed(1)}</b> <small>mg/L</small>{index === 0 && reading.dissolvedOxygen < DO_DEMO_THRESHOLD && <OperatorBadge tone="critical">LOW</OperatorBadge>}</td>
                        <td>{reading.temperature.toFixed(1)} <small>°C</small></td>
                        <td>{reading.ph.toFixed(1)}</td>
                        <td className="operator-table-unmeasured">Not measured</td>
                        <td><span className={`operator-table-online${sensorStatus === 'OFFLINE' ? ' is-offline' : ''}`}><i /> {sensorStatus}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="operator-history-footnote"><AlertTriangle size={13} /> The latest low dissolved oxygen sample needs reference-instrument verification. Escalate according to hatchery procedures.</div>
            </div>
          </section>}

          {currentPage === 'logs' && (
            <section className="operator-section" id="operator-logs">
              <OperatorSectionHeading title="Hatchery Activity &amp; Events" detail="Log operations and environmental observations for shift handover." action={<button type="button" className="operator-button operator-button--primary operator-add-button" onClick={() => openLogModal('OPERATION')}><Plus size={14} /> Add entry</button>} />
              <article className="operator-card operator-log-card">
                {logsForTank.length ? (
                  <div className="operator-log-list">
                    {logsForTank.slice(0, 6).map((log) => (
                      <div className="operator-log-item" key={log.id}>
                        <span className={`operator-log-icon operator-log-icon--${log.kind === 'OPERATION' ? 'operation' : log.kind === 'ENVIRONMENT' ? 'environment' : 'resolved'}`}>
                          {log.kind === 'OPERATION' ? <Activity size={15} /> : log.kind === 'ENVIRONMENT' ? <CloudRain size={15} /> : <Check size={15} />}
                        </span>
                        <div className="operator-log-copy">
                          <div><b>{log.type}</b><OperatorBadge tone={log.kind === 'ALERT RESOLUTION' ? 'safe' : 'muted'}>{log.kind}</OperatorBadge></div>
                          <p>{log.notes}{log.waterChangePercent !== undefined ? ` · ${log.waterChangePercent}% exchanged` : ''}{log.impact ? ` · Impact: ${log.impact}` : ''}</p>
                          <span>{formatManilaTimestamp(new Date(log.occurredAt))} PHT · {log.operator}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="operator-log-empty"><ClipboardList size={24} /><b>No entries recorded for this tank yet</b><span>Log water changes, routine work, weather, or unusual events.</span></div>
                )}
              </article>
              <div className="operator-log-actions">
                <button type="button" className="operator-button operator-button--quiet" onClick={() => openLogModal('OPERATION')}><Droplets size={14} /> Log operation</button>
                <button type="button" className="operator-button operator-button--quiet" onClick={() => openLogModal('ENVIRONMENT')}><CloudRain size={14} /> Log weather / event</button>
                <button type="button" className="operator-text-link" onClick={downloadLog}>Export log <ChevronRight size={13} /></button>
              </div>
            </section>
          )}

          {currentPage === 'sensors' && (
            <section className="operator-section" id="operator-sensors">
              <OperatorSectionHeading title="Connected Sensors" detail={`${selectedTank.name} · Hardware connectivity`} action={<OperatorBadge tone={sensorStatus === 'ONLINE' ? 'online' : 'muted'}>{sensorStatus === 'ONLINE' ? '3 ONLINE' : 'DISCONNECTED'}</OperatorBadge>} />
              <article className="operator-card operator-sensor-list">
                {[
                  { name: 'Dissolved Oxygen', id: `${selectedTank.hardwareId ?? 'HS-001'} · DO probe`, icon: Droplets },
                  { name: 'Temperature', id: `${selectedTank.hardwareId ?? 'HS-001'} · Temp probe`, icon: Thermometer },
                  { name: 'pH', id: `${selectedTank.hardwareId ?? 'HS-001'} · pH probe`, icon: FlaskConical },
                ].map(({ name, id, icon: Icon }) => (
                  <div className="operator-sensor-row" key={name}>
                    <span className="operator-sensor-icon"><Icon size={16} /></span>
                    <span className="operator-sensor-name"><b>{name}</b><small>{id}</small></span>
                    <span className={`operator-table-online${sensorStatus === 'OFFLINE' ? ' is-offline' : ''}`}><i /> {sensorStatus}</span>
                    <small className="operator-sensor-sync">3-hour interval</small>
                  </div>
                ))}
                <div className="operator-device-footer"><span className="operator-online-dot" /> Last transmission {formatManilaTimestamp(lastRefresh)} PHT</div>
              </article>
              <article className="operator-card operator-guidance-card">
                <span className="operator-guidance-icon"><Wind size={17} /></span>
                <div><b>Good shift handover</b><p>Record unusual weather, water exchange, feeding, maintenance, and any corrective action before the next shift.</p></div>
              </article>
            </section>
          )}

          {currentPage === 'actions' && <section className="operator-quick-actions">
            <button type="button" onClick={() => openLogModal('OPERATION')}><span><Plus size={17} /></span><b>Log operation</b><ChevronRight size={14} /></button>
            <button type="button" onClick={() => openLogModal('ENVIRONMENT')}><span><CloudRain size={17} /></span><b>Log weather / event</b><ChevronRight size={14} /></button>
            <button type="button" onClick={() => navigateTo('operator-alerts')}><span><AlertTriangle size={17} /></span><b>Review alerts</b><ChevronRight size={14} /></button>
            <button type="button" onClick={downloadLog}><span><ClipboardList size={17} /></span><b>Export my log</b><ChevronRight size={14} /></button>
          </section>}

          <footer className="operator-footer"><span>HydroSense · Operator workspace</span><span>Time shown in Philippine Time (Asia/Manila) · Demonstration data</span></footer>
        </main>
      </div>

      {mobileNavOpen && <button type="button" className="operator-sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {storageError && <div className="operator-toast operator-toast--error" role="alert">{storageError}<button type="button" aria-label="Dismiss storage warning" onClick={() => setStorageError('')}><X size={14} /></button></div>}
      {message && <div className="operator-toast" role="status"><Check size={15} />{message}<button type="button" aria-label="Dismiss notification" onClick={() => setMessage('')}><X size={14} /></button></div>}

      {modal === 'log' && (
        <OperatorModal title={activityKind === 'OPERATION' ? 'Log hatchery operation' : 'Log weather or event'} description="Entries are saved in this browser for shift handover." onClose={() => setModal(null)}>
          <form className="operator-form" onSubmit={submitLog}>
            <div className="operator-form-tabs">
              <button type="button" className={activityKind === 'OPERATION' ? 'is-selected' : ''} onClick={() => { setActivityKind('OPERATION'); setEntryTankId(tankId); setActivityType(ACTIVITY_OPERATION_TYPES[0]); setFormError(''); }}>Operation</button>
              <button type="button" className={activityKind === 'ENVIRONMENT' ? 'is-selected' : ''} onClick={() => { setActivityKind('ENVIRONMENT'); setEntryTankId('hatchery'); setActivityType(ACTIVITY_EVENT_TYPES[0]); setFormError(''); }}>Weather / event</button>
            </div>
            <label>{activityKind === 'OPERATION' ? 'Tank' : 'Event scope'}<select value={entryTankId} onChange={(event) => setEntryTankId(event.target.value)}>
              {activityKind === 'ENVIRONMENT' && <option value="hatchery">Entire hatchery</option>}
              {availableTanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.name} — {tank.type}</option>)}
            </select></label>
            <label>{activityKind === 'OPERATION' ? 'Operation type' : 'Event type'}<select value={activityType} onChange={(event) => setActivityType(event.target.value)}>{renderActivityTypeOptions()}</select></label>
            {activityKind === 'OPERATION' && activityType === 'Water change / exchange' && (
              <div className="operator-form-two-columns">
                <label>Water replaced (%)<input type="number" min="0.1" max="100" step="0.1" value={waterChangePercent} onChange={(event) => setWaterChangePercent(event.target.value)} placeholder="e.g. 20" required /></label>
                <label>Water source (optional)<input value={waterSource} onChange={(event) => setWaterSource(event.target.value)} placeholder="e.g. treated reservoir" /></label>
              </div>
            )}
            {activityKind === 'OPERATION' && activityType === 'Manual water quality check' && (
              <>
                <div className="operator-manual-reading-grid">
                  <label>Dissolved oxygen (mg/L)<input type="number" min="0" max="30" step="0.1" value={manualReadings.dissolvedOxygen} onChange={(event) => setManualReadings((current) => ({ ...current, dissolvedOxygen: event.target.value }))} placeholder="Optional" /></label>
                  <label>Temperature (°C)<input type="number" min="-5" max="60" step="0.1" value={manualReadings.temperature} onChange={(event) => setManualReadings((current) => ({ ...current, temperature: event.target.value }))} placeholder="Optional" /></label>
                  <label>pH<input type="number" min="0" max="14" step="0.1" value={manualReadings.ph} onChange={(event) => setManualReadings((current) => ({ ...current, ph: event.target.value }))} placeholder="Optional" /></label>
                  <label>Salinity (ppt)<input type="number" min="0" max="100" step="0.1" value={manualReadings.salinity} onChange={(event) => setManualReadings((current) => ({ ...current, salinity: event.target.value }))} placeholder="Optional" /></label>
                </div>
                <label>Instrument / method (optional)<input value={manualReadings.method} onChange={(event) => setManualReadings((current) => ({ ...current, method: event.target.value }))} placeholder="e.g. calibrated handheld refractometer" /></label>
                <small className="operator-field-help">Enter readings you actually measured. Manual values are logged as operator observations, separate from sensor readings.</small>
              </>
            )}
            {activityKind === 'ENVIRONMENT' && <label>Observed impact<select value={environmentImpact} onChange={(event) => setEnvironmentImpact(event.target.value)}><option>Low</option><option>Moderate</option><option>High</option><option>Unknown</option></select></label>}
            <label>Notes<textarea value={activityNotes} onChange={(event) => setActivityNotes(event.target.value)} placeholder={activityKind === 'OPERATION' ? 'What was done? Include observations or follow-up needed.' : 'When did it occur? What changed around the tank?'} rows={4} required /></label>
            <div className="operator-form-meta">Recorded by <b>{activeOperatorName}</b> · {time.date}, {time.time} PHT</div>
            {formError && <p className="operator-form-error" role="alert">{formError}</p>}
            <div className="operator-modal-actions"><button type="button" className="operator-button operator-button--quiet" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="operator-button operator-button--primary"><Check size={14} /> Save entry</button></div>
          </form>
        </OperatorModal>
      )}

      {modal === 'resolve' && (
        <OperatorModal title="Record corrective action" description="Only mark the alert resolved after action and verification. The resolution is added to your activity log." onClose={() => setModal(null)}>
          <form className="operator-form" onSubmit={submitResolution}>
            {(() => {
              const alert = alerts.find((item) => item.id === resolutionAlertId);
              return alert ? <div className={`operator-resolution-summary operator-resolution-summary--${alert.severity.toLowerCase()}`}><OperatorBadge tone={alert.severity === 'CRITICAL' ? 'critical' : 'warning'}>{alert.severity}</OperatorBadge><b>{alert.title}</b><p>{alert.description}</p></div> : null;
            })()}
            <label>Corrective action taken<textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} placeholder="Describe what you inspected or changed, and any follow-up needed." rows={4} required /></label>
            {resolutionAlertId === 'operator-do-critical' && (
              <label>Reference-instrument dissolved oxygen (mg/L)<input type="number" min={DO_DEMO_THRESHOLD} max="30" step="0.1" value={verificationReading} onChange={(event) => setVerificationReading(event.target.value)} placeholder={`At least ${DO_DEMO_THRESHOLD.toFixed(1)} to confirm resolved`} required /><small className="operator-field-help">Demo threshold: {DO_DEMO_THRESHOLD.toFixed(1)} mg/L. This illustrative value is not a universal husbandry standard. If verification is still low, keep the alert active and follow hatchery procedures.</small></label>
            )}
            <div className="operator-form-meta">Resolution by <b>{activeOperatorName}</b> · {time.time} PHT</div>
            {resolutionError && <p className="operator-form-error" role="alert">{resolutionError}</p>}
            <div className="operator-modal-actions"><button type="button" className="operator-button operator-button--quiet" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="operator-button operator-button--primary"><Check size={14} /> Confirm resolution</button></div>
          </form>
        </OperatorModal>
      )}

    </div>
  );
}
