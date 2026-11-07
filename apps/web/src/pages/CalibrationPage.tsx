import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatManilaDateTime, getManilaDateString } from '@hydrosense/shared';
import type { CalibrationLog } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { useSelectedTank } from '../app/tank/TankContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

const maintenanceItems = [
  'Inspect device enclosure and cable seals',
  'Check sensor probe for fouling or damage',
  'Verify device clock and data transmission status',
  'Review the latest manual reference measurement',
];

export default function CalibrationPage() {
  const { tankId } = useSelectedTank();
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const [parameter, setParameter] = useState<CalibrationLog['parameter']>('ph');
  const [standard, setStandard] = useState('pH 7.00 buffer');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [date, setDate] = useState(getManilaDateString());
  const [nextDue, setNextDue] = useState(getManilaDateString(new Date(Date.now() + 30 * 86_400_000)));
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['calibrations', tankId], queryFn: () => api.listCalibrationLogs(tankId), enabled: Boolean(tankId) });
  const mutation = useMutation({
    mutationFn: () => api.createCalibrationLog({
      tankId,
      parameter,
      standard: standard.trim(),
      before: Number(before),
      after: Number(after),
      date: new Date(`${date}T12:00:00+08:00`).toISOString(),
      user: userName,
      nextDue: new Date(`${nextDue}T12:00:00+08:00`).toISOString(),
    }),
    onSuccess: async () => {
      setBefore('');
      setAfter('');
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['calibrations'] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tankId || !standard.trim() || !Number.isFinite(Number(before)) || !Number.isFinite(Number(after)) ||
        !before || !after || !date || !nextDue || new Date(`${nextDue}T00:00:00`) <= new Date(`${date}T00:00:00`)) {
      setError('Enter a calibration standard, valid before/after readings, and a due date after the calibration date.');
      return;
    }
    setError('');
    mutation.mutate();
  }

  return (
    <div className="stack">
      <PageHeading title="Calibration & maintenance" description="Record pH and dissolved-oxygen calibration results and track due dates. Checklist items are observations only." />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      <form className="card stack" onSubmit={submit}>
        <h2 className="card-title">Log calibration</h2>
        <div className="form-grid">
          <label className="field">Parameter<select value={parameter} onChange={(event) => {
            const next = event.target.value as CalibrationLog['parameter'];
            setParameter(next);
            setStandard(next === 'ph' ? 'pH 7.00 buffer' : 'Air-saturated water');
          }}><option value="ph">pH</option><option value="do">Dissolved oxygen</option></select></label>
          <label className="field">Calibration standard<input value={standard} onChange={(event) => setStandard(event.target.value)} required /></label>
          <label className="field">Before<input type="number" step="0.01" value={before} onChange={(event) => setBefore(event.target.value)} required /></label>
          <label className="field">After<input type="number" step="0.01" value={after} onChange={(event) => setAfter(event.target.value)} required /></label>
          <label className="field">Calibration date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label className="field">Next due<input type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} required /></label>
        </div>
        {error && <p className="state-error" role="alert">{error}</p>}
        {mutation.isError && <ErrorState error={mutation.error} />}
        <button className="button button-primary" type="submit" disabled={mutation.isPending}>Save calibration log</button>
      </form>
      <section className="card stack">
        <h2 className="card-title">Maintenance checklist</h2>
        {maintenanceItems.map((item) => <label key={item} className="check-row"><input type="checkbox" checked={checked.includes(item)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{item}</label>)}
      </section>
      <section className="card stack">
        <h2 className="card-title">Calibration due dates</h2>
        {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !query.data?.length ? <EmptyState>No calibration records are available.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Parameter</th><th>Standard</th><th>Before</th><th>After</th><th>Date (PHT)</th><th>Next due</th><th>Technician</th></tr></thead><tbody>
            {query.data.map((log) => {
              const overdue = new Date(log.nextDue) < new Date();
              return <tr key={log.id}><td>{log.parameter.toUpperCase()}</td><td>{log.standard}</td><td>{log.before}</td><td>{log.after}</td><td>{formatManilaDateTime(log.date)}</td><td className={overdue ? 'row-overdue' : ''}>{formatManilaDateTime(log.nextDue)}{overdue ? ' · OVERDUE' : ''}</td><td>{log.user}</td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
