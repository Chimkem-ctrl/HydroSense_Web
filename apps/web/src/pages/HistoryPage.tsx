import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MeasuredParameter, Reading } from '@hydrosense/shared';
import { formatManilaDateTime, getManilaDateString } from '@hydrosense/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../app/api';
import { tierConfig } from '../app/config';
import { useSelectedTank } from '../app/tank/TankContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleState } from '../components/common/States';

type SortKey = 'timestamp' | MeasuredParameter;
const parameterValue = (reading: Reading, parameter: MeasuredParameter) => parameter === 'do' ? reading.doMgL : reading[parameter];

export default function HistoryPage() {
  const { tankId } = useSelectedTank();
  const [parameter, setParameter] = useState<MeasuredParameter | 'all'>('all');
  const [from, setFrom] = useState(() => getManilaDateString(new Date(Date.now() - Math.min(7, tierConfig.retentionDays) * 86_400_000)));
  const [to, setTo] = useState(() => getManilaDateString());
  const minimumDate = getManilaDateString(new Date(Date.now() - Math.max(0, tierConfig.retentionDays - 1) * 86_400_000));
  const maximumDate = getManilaDateString();
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['history', tankId, from, to, parameter],
    queryFn: () => api.listReadings({
      tankId,
      from: `${from}T00:00:00+08:00`,
      to: `${to}T23:59:59+08:00`,
      ...(parameter !== 'all' && { parameter }),
    }),
    enabled: Boolean(tankId),
  });
  const rows = useMemo(() => {
    const filtered = (query.data ?? []).filter((row) => parameter === 'all' || Number.isFinite(parameterValue(row, parameter)));
    return filtered.sort((a, b) => {
      const difference = sortKey === 'timestamp'
        ? a.timestamp.localeCompare(b.timestamp)
        : parameterValue(a, sortKey) - parameterValue(b, sortKey);
      return ascending ? difference : -difference;
    });
  }, [ascending, parameter, query.data, sortKey]);
  const pageSize = 20;
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  function changeSort(next: SortKey) {
    if (sortKey === next) setAscending((value) => !value);
    else { setSortKey(next); setAscending(false); }
  }

  function sortButton(label: string, key: SortKey) {
    const Icon = sortKey === key ? ascending ? ChevronUp : ChevronDown : ChevronDown;
    return <button type="button" className="icon-button" aria-label={`Sort by ${label}`} onClick={() => changeSort(key)}>{label}<Icon size={14} /></button>;
  }

  return (
    <div className="stack">
      <PageHeading title="Historical logs" description="Filter and sort the measured water-quality readings." />
      <section className="card inline" aria-label="History filters">
        <label className="field">From<input type="date" value={from} min={minimumDate} max={to} onChange={(event) => { setFrom(event.target.value); setPage(0); }} /></label>
        <label className="field">To<input type="date" value={to} min={from} max={maximumDate} onChange={(event) => { setTo(event.target.value); setPage(0); }} /></label>
        <label className="field">Parameter<select value={parameter} onChange={(event) => { setParameter(event.target.value as MeasuredParameter | 'all'); setPage(0); }}><option value="all">All measured</option><option value="temperature">Temperature</option><option value="do">Dissolved oxygen</option><option value="ph">pH</option></select></label>
        <span className="small muted">{rows.length} readings</span>
      </section>
      {query.dataUpdatedAt && Date.now() - query.dataUpdatedAt > 3 * 3_600_000 && <StaleState updatedAt={query.dataUpdatedAt} />}
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : rows.length === 0 ? <EmptyState>No readings match the selected date range and parameter.</EmptyState> : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>{sortButton('Date / time (PHT)', 'timestamp')}</th><th>Tank</th>{parameter === 'all' ? <><th>{sortButton('Temperature (°C)', 'temperature')}</th><th>{sortButton('DO (mg/L)', 'do')}</th><th>{sortButton('pH', 'ph')}</th></> : <><th>Parameter</th><th>{sortButton(parameter === 'do' ? 'DO (mg/L)' : parameter === 'ph' ? 'pH' : 'Temperature (°C)', parameter)}</th></>}</tr></thead>
              <tbody>{visible.map((row) => <tr key={row.id}><td>{formatManilaDateTime(row.timestamp)}</td><td>{row.tankId}</td>{parameter === 'all' ? <><td>{row.temperature.toFixed(2)}</td><td>{row.doMgL.toFixed(2)}</td><td>{row.ph.toFixed(2)}</td></> : <><td>{parameter === 'do' ? 'Dissolved oxygen' : parameter === 'ph' ? 'pH' : 'Temperature'}</td><td>{parameterValue(row, parameter).toFixed(2)}</td></>}</tr>)}</tbody>
            </table>
          </div>
          <div className="inline" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <span className="small muted">Page {page + 1} of {Math.max(1, Math.ceil(rows.length / pageSize))}</span>
            <span className="inline"><button className="button" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button" type="button" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((value) => value + 1)}>Next</button></span>
          </div>
        </section>
      )}
    </div>
  );
}
