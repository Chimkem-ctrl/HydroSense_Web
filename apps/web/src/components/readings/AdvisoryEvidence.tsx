import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatManilaDateTime } from '@hydrosense/shared';
import type { AdvisoryState, Reading } from '@hydrosense/shared';
import { api } from '../../app/api';
import { DATA_MODE, tierConfig } from '../../app/config';
import { EmptyState, ErrorState, LoadingState } from '../common/States';

const dayMs = 86_400_000;

export function summarizeReadings(readings: Reading[], kind: AdvisoryState['kind']) {
  const rows = [...readings].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const fields: Array<{ key: 'temperature' | 'ph'; label: string; unit: string }> = [
    { key: 'temperature', label: 'Temperature', unit: '°C' },
    ...(kind === 'ammonia' ? [{ key: 'ph' as const, label: 'pH', unit: 'pH' }] : []),
  ];
  return fields.map(({ key, label, unit }) => {
    const values = rows.map((row) => row[key]).filter(Number.isFinite);
    if (!values.length) return `${label}: no valid readings.`;
    const digits = key === 'ph' ? 2 : 1;
    const format = (value: number) => value.toFixed(digits);
    return `${label}: ${format(values[0])} to ${format(values[values.length - 1])} ${unit}; observed range ${format(Math.min(...values))}–${format(Math.max(...values))} ${unit}.`;
  });
}

export function AdvisoryEvidence({ tankId, kind }: { tankId: string; kind: AdvisoryState['kind'] }) {
  const [end] = useState(() => Date.now());
  const start = end - 7 * dayMs;
  const readingStart = end - Math.min(7, tierConfig.retentionDays) * dayMs;
  const readings = useQuery({
    queryKey: ['advisory-context-readings', tankId, readingStart, end],
    queryFn: () => api.listReadings({ tankId, from: new Date(readingStart).toISOString(), to: new Date(end).toISOString() }),
    enabled: Boolean(tankId) && tierConfig.analytics,
  });
  const logs = useQuery({
    queryKey: ['activity-logs', tankId],
    queryFn: () => api.listActivityLogs(tankId),
    enabled: Boolean(tankId),
  });
  const rows = (readings.data ?? []).filter((row) => row.tankId === tankId && Date.parse(row.timestamp) >= readingStart && Date.parse(row.timestamp) <= end)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const entries = (logs.data ?? []).filter((log) => (log.tankId === tankId || log.tankId === 'hatchery') && Date.parse(log.occurredAt) >= start && Date.parse(log.occurredAt) <= end)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return <section className="advisory-evidence" aria-label="Seven-day advisory context">
    <h3>Seven-day context</h3>
    <p>These observations provide context only; they do not determine or explain the rule that fired above.</p>
    {DATA_MODE === 'mock' && <p>Mock rule inputs may include older water events or a preset feeding load; they are not derived from this seven-day summary.</p>}
    <h4>Measured trends</h4>
    {!tierConfig.analytics ? <p>Trend context requires an analytics upgrade.</p> : readings.isLoading ? <LoadingState label="Loading trend context" /> : readings.isError ? <ErrorState error={readings.error} onRetry={() => void readings.refetch()} /> : !rows.length ? <EmptyState>No measured readings are available in the retained period.</EmptyState> : <>
      <p>{rows.length} available readings · first {formatManilaDateTime(rows[0].timestamp)} to last {formatManilaDateTime(rows[rows.length - 1].timestamp)} PHT. Sampling cadence is three hours; missing samples are not estimated.</p>
      {tierConfig.retentionDays < 7 && <p>Reading history is limited to {tierConfig.retentionDays} days by the current tier.</p>}
      <ul>{summarizeReadings(rows, kind).map((summary) => <li key={summary}>{summary}</li>)}</ul>
    </>}
    <h4>Operator and environmental logs</h4>
    {logs.isLoading ? <LoadingState label="Loading activity context" /> : logs.isError ? <ErrorState error={logs.error} onRetry={() => void logs.refetch()} /> : !entries.length ? <EmptyState>No tank or hatchery-wide activity logs in the last seven days.</EmptyState> : <ul>
      {entries.map((entry) => <li key={entry.id}>
        <strong>{entry.type}</strong> · {entry.tankId === 'hatchery' ? 'Hatchery-wide' : 'Selected tank'} · {entry.operator} · {formatManilaDateTime(entry.occurredAt)} PHT
        {entry.notes && <p>{entry.notes}</p>}
        {entry.waterChangePercent !== undefined && <p>Logged water change: {entry.waterChangePercent}%{entry.waterSource ? ` · ${entry.waterSource}` : ''}</p>}
        {entry.manualReadings?.salinity !== undefined && <p>Manual salinity: {entry.manualReadings.salinity} ppt{entry.manualReadings.method ? ` · ${entry.manualReadings.method}` : ''}</p>}
        {entry.manualReadings?.ammonia !== undefined && <p>Manual ammonia: {entry.manualReadings.ammonia} mg/L{entry.manualReadings.method ? ` · ${entry.manualReadings.method}` : ''}</p>}
      </li>)}
    </ul>}
  </section>;
}
