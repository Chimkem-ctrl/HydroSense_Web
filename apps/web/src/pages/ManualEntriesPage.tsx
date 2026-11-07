import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatManilaDateTime, validateManualEntry } from '@hydrosense/shared';
import type { ManualEntry } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { useSelectedTank } from '../app/tank/TankContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

const entryLabels: Record<ManualEntry['type'], string> = {
  refractometer_salinity: 'Refractometer salinity',
  ammonia_test_kit: 'Ammonia test-kit result',
  rain_event: 'Rain event',
  freshwater_dosing: 'Freshwater dosing event (log only)',
};

export default function ManualEntriesPage() {
  const { tankId } = useSelectedTank();
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const [type, setType] = useState<ManualEntry['type']>('refractometer_salinity');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['manual-entries', tankId], queryFn: () => api.listManualEntries(tankId), enabled: Boolean(tankId) });
  const mutation = useMutation({
    mutationFn: () => api.createManualEntry({
      tankId,
      type,
      ...(value.trim() && { value: Number(value), unit: type === 'refractometer_salinity' ? 'ppt' : 'mg/L' }),
      enteredBy: userName,
      note: note.trim() || undefined,
    }),
    onSuccess: async () => {
      setValue('');
      setNote('');
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['manual-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['advisories', tankId] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry: Partial<ManualEntry> = { tankId, type, enteredBy: userName, note, ...(value.trim() && { value: Number(value) }) };
    const issues = validateManualEntry(entry);
    if (issues.length) { setError(issues[0].message); return; }
    setError('');
    mutation.mutate();
  }

  return (
    <div className="stack">
      <PageHeading title="Manual entries" description="Record field observations and test-kit measurements separately from sensor readings." />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      <form className="card stack" onSubmit={submit}>
        <h2 className="card-title">Add a manual observation</h2>
        <div className="form-grid">
          <label className="field">Entry type<select value={type} onChange={(event) => { setType(event.target.value as ManualEntry['type']); setValue(''); }}>
            {Object.entries(entryLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select></label>
          {(type === 'refractometer_salinity' || type === 'ammonia_test_kit') && <label className="field">{type === 'refractometer_salinity' ? 'Salinity (ppt)' : 'Ammonia (mg/L)'}<input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} required /></label>}
          <label className="field">Note (optional)<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        </div>
        <p className="small muted">Advisory/event logging only. This form does not operate dosing or other equipment.</p>
        {error && <p role="alert" className="state-error">{error}</p>}
        {mutation.isError && <ErrorState error={mutation.error} />}
        <button className="button button-primary" type="submit" disabled={mutation.isPending}>Save entry</button>
      </form>
      <section className="card stack">
        <h2 className="card-title">Recent entries</h2>
        {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !query.data?.length ? <EmptyState>No manual entries have been recorded for this tank.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Time (PHT)</th><th>Type</th><th>Value</th><th>Entered by</th><th>Note</th></tr></thead><tbody>
            {query.data.map((entry) => <tr key={entry.id}><td>{formatManilaDateTime(entry.timestamp)}</td><td>{entryLabels[entry.type]}</td><td>{entry.value === undefined ? '—' : `${entry.value} ${entry.unit ?? ''}`}</td><td>{entry.enteredBy}</td><td>{entry.note ?? '—'}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
