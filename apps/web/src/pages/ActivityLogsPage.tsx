import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_OPERATION_TYPES,
  formatManilaDateTime,
  validateActivityLog,
} from '@hydrosense/shared';
import type { ActivityLog, ActivityLogKind } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { useSelectedTank } from '../app/tank/TankContext';
import { useTanks } from '../app/data/hooks';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';
import { activityLogCsv, manilaDate } from './activityLogs';

type FormKind = Extract<ActivityLogKind, 'OPERATION' | 'ENVIRONMENT'>;
type ReadingField = 'dissolvedOxygen' | 'temperature' | 'ph' | 'salinity' | 'ammonia';
type RawReadings = Record<ReadingField | 'method', string>;

const initialReadings: RawReadings = {
  dissolvedOxygen: '',
  temperature: '',
  ph: '',
  salinity: '',
  ammonia: '',
  method: '',
};

const readingFields: Array<{ key: ReadingField; label: string; min: number; max: number; unit: string }> = [
  { key: 'dissolvedOxygen', label: 'Dissolved oxygen', min: 0, max: 30, unit: 'mg/L' },
  { key: 'temperature', label: 'Temperature', min: -5, max: 60, unit: '°C' },
  { key: 'ph', label: 'pH', min: 0, max: 14, unit: '' },
  { key: 'salinity', label: 'Salinity', min: 0, max: 100, unit: 'ppt' },
  { key: 'ammonia', label: 'Ammonia test-kit result', min: 0, max: 100, unit: 'mg/L' },
];

function parsedReadings(raw: RawReadings) {
  const readings: NonNullable<ActivityLog['manualReadings']> = {};
  readingFields.forEach(({ key }) => {
    if (raw[key].trim()) readings[key] = Number(raw[key]);
  });
  if (raw.method.trim()) readings.method = raw.method.trim();
  return readings;
}

function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ActivityLogsPage() {
  const { tankId } = useSelectedTank();
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const tanks = useTanks();
  const logs = useQuery({ queryKey: ['activity-logs'], queryFn: () => api.listActivityLogs() });
  const [modalKind, setModalKind] = useState<FormKind | null>(null);
  const [scope, setScope] = useState(tankId);
  const [activityType, setActivityType] = useState<string>(ACTIVITY_OPERATION_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [waterChangePercent, setWaterChangePercent] = useState('');
  const [waterSource, setWaterSource] = useState('');
  const [readings, setReadings] = useState<RawReadings>(initialReadings);
  const [impact, setImpact] = useState('Moderate');
  const [formError, setFormError] = useState('');
  const [kindFilter, setKindFilter] = useState<ActivityLogKind | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const createLog = useMutation({
    mutationFn: (entry: Omit<ActivityLog, 'id' | 'occurredAt'>) => api.createActivityLog(entry),
    onSuccess: async (created) => {
      setModalKind(null);
      setNotes('');
      setWaterChangePercent('');
      setWaterSource('');
      setReadings(initialReadings);
      setFormError('');
      setStatusMessage(created.kind === 'OPERATION' ? 'Hatchery operation logged.' : 'Environmental event logged.');
      await queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      if (created.tankId !== 'hatchery') {
        await queryClient.invalidateQueries({ queryKey: ['advisories', created.tankId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['advisories'] });
      }
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  useEffect(() => {
    if (!modalKind) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalKind(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modalKind]);

  const filteredLogs = (logs.data ?? [])
    .filter((log) => kindFilter === 'all' || log.kind === kindFilter)
    .filter((log) => {
      const date = manilaDate(log.occurredAt);
      return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const tankNames = new Map((tanks.data ?? []).map((tank) => [tank.id, tank.name]));

  function openLog(kind: FormKind) {
    setModalKind(kind);
    setScope(kind === 'ENVIRONMENT' ? 'hatchery' : tankId);
    setActivityType(kind === 'OPERATION' ? ACTIVITY_OPERATION_TYPES[0] : ACTIVITY_EVENT_TYPES[0]);
    setNotes('');
    setWaterChangePercent('');
    setWaterSource('');
    setReadings(initialReadings);
    setImpact('Moderate');
    setFormError('');
  }

  function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalKind) return;
    const rawPercent = waterChangePercent.trim();
    const parsedPercent = rawPercent ? Number(rawPercent) : undefined;
    const manualReadings = modalKind === 'OPERATION' && activityType === 'Manual water quality check'
      ? parsedReadings(readings)
      : undefined;
    const entry: Omit<ActivityLog, 'id' | 'occurredAt'> = {
      tankId: scope,
      kind: modalKind,
      type: activityType,
      operator: userName,
      notes: notes.trim(),
      ...(modalKind === 'OPERATION' && activityType === 'Water change / exchange' ? {
        waterChangePercent: parsedPercent ?? Number.NaN,
        ...(waterSource.trim() ? { waterSource: waterSource.trim() } : {}),
      } : {}),
      ...(manualReadings ? { manualReadings } : {}),
      ...(modalKind === 'ENVIRONMENT' ? { impact } : {}),
    };
    const issues = validateActivityLog(entry);
    if (issues.length) {
      setFormError(issues[0].message);
      return;
    }
    const detailSuffix = [
      entry.waterSource ? `Water source: ${entry.waterSource}.` : '',
      entry.manualReadings ? `Manual readings: ${readingFields.flatMap(({ key, label, unit }) => {
        const value = entry.manualReadings?.[key];
        return value === undefined ? [] : [`${label} ${value}${unit ? ` ${unit}` : ''}`];
      }).join(', ')}${entry.manualReadings.method ? ` (method: ${entry.manualReadings.method})` : ''}.` : '',
    ].filter(Boolean).join(' ');
    createLog.mutate({
      ...entry,
      notes: `${entry.notes}${detailSuffix ? ` ${detailSuffix}` : ''}`,
    });
  }

  function exportLogs() {
    if (!filteredLogs.length) return;
    downloadCsv(activityLogCsv(filteredLogs, tanks.data ?? []), 'hydrosense-activity-logs.csv');
    setStatusMessage('Activity logs exported.');
  }

  return (
    <div className="stack">
      <PageHeading
        title="Activity logs"
        description="Record hatchery operations, water-quality observations and environmental events for shift handover."
      />
      <div className="inline">
        <button type="button" className="button button-primary" onClick={() => openLog('OPERATION')}>Log operation</button>
        <button type="button" className="button" onClick={() => openLog('ENVIRONMENT')}>Log weather / event</button>
        <button type="button" className="button" disabled={!filteredLogs.length} onClick={exportLogs}>Export CSV</button>
      </div>
      {statusMessage && <p className="small muted" role="status">{statusMessage}</p>}
      <StaleQueryState updatedAt={logs.dataUpdatedAt} />
      <section className="card stack">
        <h2 className="card-title">Activity records</h2>
        <div className="form-grid">
          <label className="field">Kind
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as ActivityLogKind | 'all')}>
              <option value="all">All kinds</option>
              <option value="OPERATION">Operation</option>
              <option value="ENVIRONMENT">Environment</option>
              <option value="ALERT RESOLUTION">Alert resolution</option>
            </select>
          </label>
          <label className="field">From date (PHT)<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="field">To date (PHT)<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        </div>
        {logs.isLoading ? <LoadingState /> : logs.isError ? <ErrorState error={logs.error} onRetry={() => void logs.refetch()} /> : !filteredLogs.length ? <EmptyState>No activity logs match the selected filters.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Time (PHT)</th><th>Kind</th><th>Type</th><th>Tank/scope</th><th>Details</th><th>Operator</th></tr></thead><tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td>{formatManilaDateTime(log.occurredAt)} PHT</td>
                <td>{log.kind}</td>
                <td>{log.type}</td>
                <td>{log.tankId === 'hatchery' ? 'Hatchery-wide' : tankNames.get(log.tankId) ?? log.tankId}</td>
                <td>{log.notes}{log.waterChangePercent !== undefined ? ` · ${log.waterChangePercent}% exchanged` : ''}{log.impact ? ` · Impact: ${log.impact}` : ''}</td>
                <td>{log.operator}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      {modalKind && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalKind(null); }}>
          <section className="dialog card stack" role="dialog" aria-modal="true" aria-labelledby="activity-log-title">
            <header>
              <h2 id="activity-log-title" className="card-title">{modalKind === 'OPERATION' ? 'Log hatchery operation' : 'Log weather or event'}</h2>
              <p className="small muted">Add an activity record for shift handover.</p>
            </header>
            <form className="stack" onSubmit={submitLog}>
              <label className="field">{modalKind === 'OPERATION' ? 'Tank or scope' : 'Event scope'}
                <select value={scope} onChange={(event) => setScope(event.target.value)}>
                  <option value="hatchery">Entire hatchery</option>
                  {(tanks.data ?? []).map((tank) => <option value={tank.id} key={tank.id}>{tank.name}</option>)}
                </select>
              </label>
              <label className="field">{modalKind === 'OPERATION' ? 'Operation type' : 'Event type'}
                <select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
                  {(modalKind === 'OPERATION' ? ACTIVITY_OPERATION_TYPES : ACTIVITY_EVENT_TYPES).map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              {modalKind === 'OPERATION' && activityType === 'Water change / exchange' && (
                <div className="form-grid">
                  <label className="field">Water replaced (%)<input type="number" min="0.1" max="100" step="0.1" value={waterChangePercent} onChange={(event) => setWaterChangePercent(event.target.value)} placeholder="e.g. 20" required /></label>
                  <label className="field">Water source (optional)<input value={waterSource} onChange={(event) => setWaterSource(event.target.value)} placeholder="e.g. treated reservoir" /></label>
                </div>
              )}
              {modalKind === 'OPERATION' && activityType === 'Manual water quality check' && (
                <>
                  <div className="form-grid">
                    {readingFields.map(({ key, label, min, max, unit }) => (
                      <label className="field" key={key}>{label}{unit ? ` (${unit})` : ''}
                        <input type="number" min={min} max={max} step="0.1" value={readings[key]} onChange={(event) => setReadings((current) => ({ ...current, [key]: event.target.value }))} placeholder="Optional" />
                      </label>
                    ))}
                  </div>
                  <label className="field">Instrument / method (optional)<input value={readings.method} onChange={(event) => setReadings((current) => ({ ...current, method: event.target.value }))} placeholder="e.g. calibrated handheld refractometer" /></label>
                  <p className="small muted">Enter readings actually measured. Manual values are logged separately from sensor readings.</p>
                </>
              )}
              {modalKind === 'ENVIRONMENT' && <label className="field">Observed impact<select value={impact} onChange={(event) => setImpact(event.target.value)}><option>Low</option><option>Moderate</option><option>High</option><option>Unknown</option></select></label>}
              <label className="field">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={modalKind === 'OPERATION' ? 'What was done? Include observations or follow-up needed.' : 'When did it occur? What changed around the tank?'} rows={4} required /></label>
              {formError && <p className="state-error" role="alert">{formError}</p>}
              {createLog.isError && <ErrorState error={createLog.error} />}
              <footer className="inline">
                <button type="button" className="button" onClick={() => setModalKind(null)}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={createLog.isPending}>{createLog.isPending ? 'Saving…' : 'Save entry'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
