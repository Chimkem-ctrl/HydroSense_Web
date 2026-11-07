import { Battery, CloudUpload, Power, Radio, Signal, Sun } from 'lucide-react';
import { formatManilaDateTime } from '@hydrosense/shared';
import { useDeviceStatuses, useTanks } from '../app/data/hooks';
import { tierConfig } from '../app/config';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleState } from '../components/common/States';

function wifiLabel(rssi: number) {
  if (rssi >= -55) return 'Strong';
  if (rssi >= -70) return 'Fair';
  return 'Weak';
}

export default function SystemHealthPage() {
  const devices = useDeviceStatuses();
  const tanks = useTanks();
  const tankList = tanks.data ?? [];
  return (
    <div className="stack">
      <PageHeading title="System health" description="Connection, power, signal and pending synchronization for monitoring devices." />
      {devices.dataUpdatedAt && Date.now() - devices.dataUpdatedAt > 3 * 3_600_000 && <StaleState updatedAt={devices.dataUpdatedAt} />}
      {devices.isLoading || tanks.isLoading ? <LoadingState /> : devices.isError ? <ErrorState error={devices.error} onRetry={() => void devices.refetch()} /> : tanks.isError ? <ErrorState error={tanks.error} onRetry={() => void tanks.refetch()} /> : !devices.data?.length ? <EmptyState>No device status is available.</EmptyState> : (
        <section className="grid grid-2">
          {devices.data.map((device) => {
            const tank = tankList.find((item) => item.deviceId === device.deviceId);
            return (
              <article className="card stack" key={device.deviceId}>
                <header className="inline" style={{ justifyContent: 'space-between' }}>
                  <div><h2 className="card-title">{tank?.name ?? device.deviceId}</h2><span className="small muted">{device.deviceId}</span></div>
                  <span className={`connection-pill ${device.online ? 'connection-online' : 'connection-offline'}`}><Radio size={15} />{device.online ? 'Online' : 'Offline'}</span>
                </header>
                <div className="grid grid-2">
                  <p className="inline"><Battery size={17} />Battery <b>{device.batteryPct}%</b></p>
                  <p className="inline">{device.powerSource === 'solar' ? <Sun size={17} /> : <Power size={17} />}Power <b>{device.powerSource}</b></p>
                  <p className="inline"><Signal size={17} />Wi-Fi <b>{wifiLabel(device.wifiRssi)} ({device.wifiRssi} dBm)</b></p>
                  <p className="inline"><CloudUpload size={17} />Pending sync <b>{device.pendingSyncCount}</b></p>
                </div>
                <p className="small muted">Last seen {formatManilaDateTime(device.lastSeen)} PHT</p>
              </article>
            );
          })}
        </section>
      )}
      <p className="footer-note">Device status is informational. This dashboard does not control hardware.</p>
      <section className="card">
        <h2 className="card-title">Tier and integration status</h2>
        <p>Tier: <b>{tierConfig.tier}</b> · Node limit: <b>{tierConfig.nodeLimit}</b> · Refresh: <b>{tierConfig.refreshIntervalMs / 1000}s</b> · Retention: <b>{tierConfig.retentionDays} days</b></p>
        <p className="small muted">External integrations: {tierConfig.integrations ? 'available when the backend integration is configured' : 'upgrade required'}. This mock dashboard does not send data externally.</p>
      </section>
    </div>
  );
}
