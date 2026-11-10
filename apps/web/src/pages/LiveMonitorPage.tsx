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

  return (
    <div className="stack live-screen">
      <header className="glass-greeting"><p>WATER QUALITY MONITORING</p><h2>Welcome, {userName}.</h2></header>
      <PageHeading title="Live monitor" description={tank ? `${tank.name} · ${tank.site} · rearing day ${getRaisingDay(tank.rearingStartDate)}/21` : 'Current water quality and device status'} />
      {tanks.isLoading || reading.isLoading || thresholds.isLoading ? <LoadingState /> :
      tanks.isError ? <ErrorState error={tanks.error} onRetry={() => void tanks.refetch()} /> :
      reading.isError ? <ErrorState error={reading.error} onRetry={() => void reading.refetch()} /> :
      thresholds.isError ? <ErrorState error={thresholds.error} onRetry={() => void thresholds.refetch()} /> :
      !tank || !reading.data ? <EmptyState>No tank or reading is available. Check the tank selector and device status.</EmptyState> : <>
      {reading.dataUpdatedAt && Date.now() - reading.dataUpdatedAt > 3 * 3_600_000 && <StaleState updatedAt={reading.dataUpdatedAt} />}
      <section className="live-section" aria-labelledby="live-readings-title">
        <div className="live-section-heading">
          <div><h2 id="live-readings-title">Current water quality</h2><p>Latest measured readings for the selected tank</p></div>
          <span className="live-update"><Clock3 size={15} aria-hidden="true" /> Updated {formatManilaDateTime(reading.data.timestamp)} PHT</span>
        </div>
        <div className="readings-grid" aria-label="Current measured water quality">
          <ReadingCard parameter="temperature" reading={reading.data} threshold={thresholds.data?.find((item) => item.parameter === 'temperature')} showRangeMeter showUpdatedTimestamp={false} />
          <ReadingCard parameter="do" reading={reading.data} threshold={thresholds.data?.find((item) => item.parameter === 'do')} showRangeMeter showUpdatedTimestamp={false} />
          <ReadingCard parameter="ph" reading={reading.data} threshold={thresholds.data?.find((item) => item.parameter === 'ph')} showRangeMeter showUpdatedTimestamp={false} />
        </div>
      </section>
      <section className="card live-panel" aria-labelledby="live-advisories-title">
        <div className="live-section-heading">
          <div><h2 id="live-advisories-title">Water-quality advisories</h2><p>Salinity and ammonia are not measured by the sensors. These rule-based advisories are not readings.</p></div>
        </div>
        {advisories.isLoading ? <LoadingState label="Loading advisories" /> : advisories.isError ? <ErrorState error={advisories.error} onRetry={() => void advisories.refetch()} /> : (
          advisories.data?.length ? <div className="glass-advisories">{advisories.data.map((item) => <article className="card glass" key={item.kind}><h3>{item.kind === 'salinity' ? 'Salinity risk' : 'Ammonia risk'}</h3><AdvisoryChip advisory={item} tankId={tankId} /></article>)}</div> : <EmptyState>No advisories are available for this tank.</EmptyState>
        )}
      </section>
      <section className="card live-panel" aria-labelledby="live-device-title">
          <div className="live-section-heading"><div><h2 id="live-device-title">Device connection</h2><p>Readings are sampled every 3 hours.</p></div></div>
          {devices.isLoading ? <LoadingState label="Loading device status" /> : devices.isError ? <ErrorState error={devices.error} onRetry={() => void devices.refetch()} /> : device ? (
            <div className="live-device-details">
              <div className="inline">
                <span className={`connection-pill ${deviceOnline ? 'connection-online' : 'connection-offline'}`}><Radio size={15} />{deviceOnline ? 'Online' : 'Offline'}</span>
                <span className="badge"><Gauge size={14} />Battery {device.batteryPct > 0 ? `${device.batteryPct}%` : 'Unavailable'}</span>
                {alerts.isLoading ? <span className="badge">Loading alerts…</span> : alerts.isError ? <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} /> : <span className="badge"><AlertTriangle size={14} />{(alerts.data ?? []).length} open alerts</span>}
              </div>
              <p className="small muted">{device.deviceId && <>Device {device.deviceId} · </>}Wi-Fi {device.wifiRssi} dBm · Last seen {formatManilaDateTime(device.lastSeen)} PHT</p>
            </div>
          ) : <EmptyState>No device is assigned to this tank.</EmptyState>}
      </section>
      {reading.data.ec != null || reading.data.salinity != null || reading.data.tds != null || reading.data.doSaturation != null || reading.data.doProbeTemperature != null ? (
        <section className="card live-panel" aria-labelledby="live-expanded-title">
          <div className="live-section-heading"><div><h2 id="live-expanded-title">Expanded sensor readings</h2><p>Additional measurements from the selected tank</p></div></div>
          <div className="advisory-row">
            {reading.data.ec != null && <span className="badge">EC {reading.data.ec.toFixed(2)} uS/cm</span>}
            {reading.data.salinity != null && <span className="badge">Salinity {reading.data.salinity.toFixed(2)} ppm</span>}
            {reading.data.tds != null && <span className="badge">TDS {reading.data.tds.toFixed(2)} ppm</span>}
            {reading.data.doSaturation != null && <span className="badge">DO saturation {reading.data.doSaturation.toFixed(2)}%</span>}
            {reading.data.doProbeTemperature != null && <span className="badge">DO probe {reading.data.doProbeTemperature.toFixed(2)} °C</span>}
          </div>
        </section>
      ) : null}
      </>}
    </div>
  );
}
