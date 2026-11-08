import { AlertTriangle, Clock3, Gauge, Radio } from 'lucide-react';
import { formatManilaDateTime, getRaisingDay } from '@hydrosense/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../app/api';
import { useAdvisories, useDeviceStatuses, useLatestReading, useOpenAlerts, useTanks } from '../app/data/hooks';
import { useSelectedTank } from '../app/tank/TankContext';
import { useRole } from '../app/auth/RoleContext';
import { AdvisoryChip } from '../components/readings/AdvisoryChip';
import { ReadingCard } from '../components/readings/ReadingCard';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleState } from '../components/common/States';

export default function LiveMonitorPage() {
  const { tankId } = useSelectedTank();
  const { userName } = useRole();
  const tanks = useTanks();
  const tank = tanks.data?.find((item) => item.id === tankId);
  const reading = useLatestReading(tankId);
  const advisories = useAdvisories(tankId);
  const alerts = useOpenAlerts(tankId);
  const devices = useDeviceStatuses();
  const thresholds = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds() });
  const device = devices.data?.find((item) => item.deviceId === tank?.deviceId);
  const hasRecentReading = Boolean(reading.data && Date.now() - new Date(reading.data.timestamp).getTime() <= 15 * 60 * 1000);
  const deviceOnline = Boolean(device?.online || hasRecentReading);

  if (tanks.isLoading || reading.isLoading || thresholds.isLoading) return <LoadingState />;
  if (tanks.isError) return <ErrorState error={tanks.error} onRetry={() => void tanks.refetch()} />;
  if (reading.isError) return <ErrorState error={reading.error} onRetry={() => void reading.refetch()} />;
  if (thresholds.isError) return <ErrorState error={thresholds.error} onRetry={() => void thresholds.refetch()} />;
  if (!tank || !reading.data) return <EmptyState>No tank or reading is available. Check the tank selector and device status.</EmptyState>;

  return (
    <div className="stack live-screen">
      <header className="glass-greeting"><p>WATER QUALITY MONITORING</p><h2>Welcome, {userName}.</h2></header>
      <PageHeading title="Live monitor" description={`${tank.name} · ${tank.site} · rearing day ${getRaisingDay(tank.rearingStartDate)}/21`} />
      {reading.dataUpdatedAt && Date.now() - reading.dataUpdatedAt > 3 * 3_600_000 && <StaleState updatedAt={reading.dataUpdatedAt} />}
      <section className="readings-grid" aria-label="Current measured water quality">
        <ReadingCard parameter="temperature" reading={reading.data} threshold={thresholds.data?.find((item) => item.parameter === 'temperature')} showRangeMeter />
        <ReadingCard parameter="do" reading={reading.data} threshold={thresholds.data?.find((item) => item.parameter === 'do')} showRangeMeter />
        <ReadingCard parameter="ph" reading={reading.data} threshold={thresholds.data?.find((item) => item.parameter === 'ph')} showRangeMeter />
      </section>
      {reading.data.ec != null || reading.data.salinity != null || reading.data.tds != null || reading.data.doSaturation != null || reading.data.doProbeTemperature != null ? (
        <section className="card">
          <h2 className="card-title">Expanded sensor readings</h2>
          <div className="advisory-row">
            {reading.data.ec != null && <span className="badge">EC {reading.data.ec.toFixed(2)} uS/cm</span>}
            {reading.data.salinity != null && <span className="badge">Salinity {reading.data.salinity.toFixed(2)} ppm</span>}
            {reading.data.tds != null && <span className="badge">TDS {reading.data.tds.toFixed(2)} ppm</span>}
            {reading.data.doSaturation != null && <span className="badge">DO saturation {reading.data.doSaturation.toFixed(2)}%</span>}
            {reading.data.doProbeTemperature != null && <span className="badge">DO probe {reading.data.doProbeTemperature.toFixed(2)} °C</span>}
          </div>
        </section>
      ) : null}
      <section className="card">
        <h2 className="card-title">Water-quality advisories</h2>
        <p className="muted small">Salinity and ammonia are not measured by the sensors. These rule-based advisories are not readings.</p>
        {advisories.isLoading ? <LoadingState label="Loading advisories" /> : advisories.isError ? <ErrorState error={advisories.error} onRetry={() => void advisories.refetch()} /> : (
          advisories.data?.length ? <div className="glass-advisories">{advisories.data.map((item) => <article className="card glass" key={item.kind}><h3>{item.kind === 'salinity' ? 'Salinity risk' : 'Ammonia risk'}</h3><AdvisoryChip advisory={item} tankId={tankId} /></article>)}</div> : <EmptyState>No advisories are available for this tank.</EmptyState>
        )}
      </section>
      <section className="grid grid-2">
        <article className="card glass stack">
          <h2 className="card-title">Last update</h2>
          <p className="inline"><Clock3 size={18} /><strong>{formatManilaDateTime(reading.data.timestamp)}</strong> PHT</p>
          <p className="small muted">Readings are sampled every 3 hours. Live mock updates refresh automatically.</p>
        </article>
        <article className="card glass stack">
          <h2 className="card-title">Device connection</h2>
          {devices.isLoading ? <LoadingState label="Loading device status" /> : devices.isError ? <ErrorState error={devices.error} onRetry={() => void devices.refetch()} /> : device ? (
            <div className="stack">
              <div className="inline">
                <span className={`connection-pill ${deviceOnline ? 'connection-online' : 'connection-offline'}`}><Radio size={15} />{deviceOnline ? 'Online' : 'Offline'}</span>
                <span className="badge"><Gauge size={14} />Battery {device.batteryPct > 0 ? `${device.batteryPct}%` : 'Unavailable'}</span>
                {alerts.isLoading ? <span className="badge">Loading alerts…</span> : alerts.isError ? <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} /> : <span className="badge"><AlertTriangle size={14} />{(alerts.data ?? []).length} open alerts</span>}
              </div>
              {device.deviceId && <p className="small muted">Device {device.deviceId}</p>}
              <p className="small muted">Wi-Fi {device.wifiRssi} dBm · Last seen {formatManilaDateTime(device.lastSeen)} PHT</p>
            </div>
          ) : <EmptyState>No device is assigned to this tank.</EmptyState>}
        </article>
      </section>
    </div>
  );
}
