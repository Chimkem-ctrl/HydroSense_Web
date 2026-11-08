import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatManilaDateTime, getRaisingDay } from '@hydrosense/shared';
import type { AdvisoryState, AlertItem, Reading, Tank } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { DATA_MODE, tierConfig } from '../app/config';
import { useSelectedTank } from '../app/tank/TankContext';
import { useDeviceStatuses } from '../app/data/hooks';
import { AdvisoryChip } from '../components/readings/AdvisoryChip';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

interface TankSummary {
  tank: Tank;
  reading: Reading | null;
  advisories: AdvisoryState[];
  alerts: AlertItem[];
}

export default function TankOverviewPage() {
  const { role, userName } = useRole();
  const { setTankId } = useSelectedTank();
  const queryClient = useQueryClient();
  const devices = useDeviceStatuses();
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const query = useQuery({
    queryKey: ['tank-overview'],
    queryFn: async (): Promise<TankSummary[]> => {
      const tanks = await api.listTanks();
      return Promise.all(tanks.map(async (tank) => {
        const [reading, advisories, alerts] = await Promise.all([api.getLatestReading(tank.id), api.listAdvisories(tank.id), api.listAlerts(tank.id)]);
        return { tank, reading, advisories, alerts: alerts.filter((alert) => alert.status === 'open') };
      }));
    },
  });
  const createTank = useMutation({
    mutationFn: ({ tank, changedBy }: { tank: Omit<Tank, 'id'>; changedBy: string }) => api.createTank(tank, changedBy),
    onSuccess: async (tank) => {
      setFormError('');
      setFormMessage(`${tank.name} registered and hardware ${tank.deviceId} linked. ${DATA_MODE === 'mock' ? 'Mock monitoring data is active.' : 'The device will appear online after its first heartbeat.'}`);
      setTankId(tank.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tank-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['tanks'] }),
        queryClient.invalidateQueries({ queryKey: ['device-status'] }),
        queryClient.invalidateQueries({ queryKey: ['latest-reading', tank.id] }),
        queryClient.invalidateQueries({ queryKey: ['audit-logs'] }),
      ]);
    },
  });
  const deleteTank = useMutation({
    mutationFn: ({ tankId, changedBy }: { tankId: string; changedBy: string }) => api.deleteTank(tankId, changedBy),
    onSuccess: async () => {
      setFormError('');
      setFormMessage('Tank and its hardware association were removed.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tank-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['tanks'] }),
        queryClient.invalidateQueries({ queryKey: ['device-status'] }),
        queryClient.invalidateQueries({ queryKey: ['audit-logs'] }),
      ]);
    },
  });
  const isAdmin = role === 'admin';
  const submitTank = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFormMessage('');
    setFormError('');
    createTank.mutate({
      tank: {
        name: String(data.get('name')).trim(),
        site: String(data.get('site')).trim(),
        rearingStartDate: String(data.get('rearingStartDate')),
        deviceId: String(data.get('deviceId')).trim(),
      },
      changedBy: userName,
    }, { onError: (error) => setFormError(error.message) });
    event.currentTarget.reset();
  };
  const removeTank = (tank: Tank) => {
    if (window.confirm(`Remove ${tank.name} and unlink hardware ${tank.deviceId}? This cannot be undone.`)) {
      setFormMessage('');
      deleteTank.mutate({ tankId: tank.id, changedBy: userName }, { onError: (error) => setFormError(error.message) });
    }
  };

  return (
    <div className="stack">
      <PageHeading title="Tank overview" description="Current readings and rearing status for available larval tanks." />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      {devices.isError && <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />}
      {isAdmin && (
        <section className="card stack">
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <h2 className="card-title">Tank and hardware management</h2>
            <span className="small muted">{query.data?.length ?? 0} / {tierConfig.nodeLimit} tanks</span>
          </div>
          <p className="small muted">Register a monitoring node by assigning its hardware ID. Mock devices start with sample data; API devices remain offline until their first status update. No device controls are available.</p>
          <form className="grid grid-2" onSubmit={submitTank}>
            <label className="field">Tank name<input name="name" required maxLength={80} placeholder="Larval Tank C" /></label>
            <label className="field">Hatchery / site<input name="site" required maxLength={120} placeholder="Hatchery name and location" /></label>
            <label className="field">Rearing start date<input name="rearingStartDate" type="date" required /></label>
            <label className="field">Monitoring hardware ID<input name="deviceId" required maxLength={80} placeholder="HS-MF-003" /></label>
            <button type="submit" className="button button-primary" disabled={createTank.isPending || (query.data?.length ?? 0) >= tierConfig.nodeLimit}>Register tank and link hardware</button>
          </form>
          {(query.data?.length ?? 0) >= tierConfig.nodeLimit && <p className="small muted">The configured tier node limit has been reached.</p>}
          {formError && <p className="state-error" role="alert">{formError}</p>}
          {formMessage && <p role="status">{formMessage}</p>}
        </section>
      )}
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !query.data?.length ? <EmptyState>No tanks are registered.</EmptyState> : (
        <section className="grid grid-2">
          {query.data.map(({ tank, reading, advisories, alerts }) => {
            const device = devices.data?.find((item) => item.deviceId === tank.deviceId);
            const hasRecentReading = Boolean(reading && Date.now() - new Date(reading.timestamp).getTime() <= 15 * 60 * 1000);
            const deviceStatus = device?.online || hasRecentReading ? 'Online' : device ? 'Offline' : 'Status unavailable';
            return (
            <article key={tank.id} className="card stack" aria-label={tank.name}>
              <header className="inline" style={{ justifyContent: 'space-between' }}>
                <div><h2 className="card-title" style={{ marginBottom: 0 }}>{tank.name}</h2><p className="small muted">{tank.site} · Node {tank.deviceId} · {deviceStatus}</p></div>
                <span className="badge"><strong>Day {getRaisingDay(tank.rearingStartDate)}</strong> / 21</span>
              </header>
              {reading ? (
                <>
                  <div className="grid grid-3">
                    <div><span className="small muted">Temperature</span><strong className="inline">{reading.temperature.toFixed(1)}°C</strong></div>
                    <div><span className="small muted">Dissolved oxygen</span><strong className="inline">{reading.doMgL.toFixed(1)} mg/L</strong></div>
                    <div><span className="small muted">pH</span><strong className="inline">{reading.ph.toFixed(2)}</strong></div>
                  </div>
                  <p className="small muted">Updated {formatManilaDateTime(reading.timestamp)} PHT</p>
                </>
              ) : <EmptyState>No reading available.</EmptyState>}
              <div className="advisory-row">{advisories.map((item) => <AdvisoryChip key={item.kind} advisory={item} />)}</div>
              <span className={`badge ${alerts.length ? 'level-warning' : 'level-normal'}`}>{alerts.length} open alerts</span>
              {isAdmin && <button className="button button-danger" type="button" disabled={deleteTank.isPending || query.data.length <= 1} title={query.data.length <= 1 ? 'At least one tank must remain registered.' : undefined} onClick={() => removeTank(tank)}>Remove tank</button>}
            </article>
          );})}
        </section>
      )}
    </div>
  );
}
