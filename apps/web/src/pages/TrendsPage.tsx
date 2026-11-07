import { useMemo, useState } from 'react';
import { ReferenceArea, ReferenceDot, ResponsiveContainer, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateParameterStatistics, formatManilaDateTime } from '@hydrosense/shared';
import type { MeasuredParameter, Reading } from '@hydrosense/shared';
import { useSelectedTank } from '../app/tank/TankContext';
import { tierConfig } from '../app/config';
import { api } from '../app/api';
import { useQuery } from '@tanstack/react-query';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

type Range = '24h' | '7d' | 'cycle';

const parameters: Array<{ key: MeasuredParameter; title: string; unit: string; color: string; min: number; max: number }> = [
  { key: 'temperature', title: 'Temperature', unit: '°C', color: '#cf6b25', min: 28, max: 32 },
  { key: 'do', title: 'Dissolved oxygen', unit: 'mg/L', color: '#087c78', min: 4, max: 10 },
  { key: 'ph', title: 'pH', unit: 'pH', color: '#536fca', min: 6, max: 8 },
];

function nightRanges(rows: Reading[]) {
  if (!rows.length) return [];
  const start = new Date(rows[0].timestamp);
  const end = new Date(rows[rows.length - 1].timestamp);
  const ranges: Array<{ x1: number; x2: number }> = [];
  for (let day = 0; day <= 22; day += 1) {
    const date = new Date(start.getTime() + day * 86_400_000);
    const localDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const x1 = Date.parse(`${localDate}T22:00:00+08:00`);
    const next = new Date(Date.parse(`${localDate}T00:00:00+08:00`) + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const x2 = Date.parse(`${next}T06:00:00+08:00`);
    if (x2 >= start.getTime() && x1 <= end.getTime()) ranges.push({ x1, x2 });
  }
  return ranges;
}

export default function TrendsPage() {
  const { tankId } = useSelectedTank();
  const [range, setRange] = useState<Range>('24h');
  const dates = useMemo(() => {
    const to = new Date();
    const days = range === '24h' ? 1 : range === '7d' ? Math.min(7, tierConfig.retentionDays) : Math.min(21, tierConfig.retentionDays);
    return { from: new Date(to.getTime() - days * 86_400_000).toISOString(), to: to.toISOString() };
  }, [range]);
  const query = useQuery({
    queryKey: ['trend-readings', tankId, dates.from, dates.to],
    queryFn: () => api.listReadings({ tankId, ...dates }),
    enabled: Boolean(tankId) && tierConfig.analytics,
  });
  const thresholdsQuery = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds(), enabled: tierConfig.analytics });
  const alertsQuery = useQuery({ queryKey: ['trend-alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: Boolean(tankId) && tierConfig.analytics });
  const rows = query.data ?? [];
  const alerts = (alertsQuery.data ?? []).filter((alert) => {
    const timestamp = Date.parse(alert.createdAt);
    return timestamp >= Date.parse(dates.from) && timestamp <= Date.parse(dates.to);
  });
  const ranges = useMemo(() => nightRanges(rows), [rows]);
  const chartParameters = parameters.map((parameter) => ({
    ...parameter,
    threshold: thresholdsQuery.data?.find((item) => item.parameter === parameter.key),
  }));
  const safeBandText = chartParameters.map(({ title, unit, threshold, min, max }) => {
    if (threshold?.min !== undefined && threshold.max !== undefined) return `${title} ${threshold.min}–${threshold.max} ${unit}`;
    if (threshold?.min !== undefined) return `${title} ≥${threshold.min} ${unit}`;
    if (threshold?.max !== undefined) return `${title} ≤${threshold.max} ${unit}`;
    return `${title} ${min}–${max} ${unit}`;
  }).join(' · ');
  const summaries = chartParameters.map((parameter) => calculateParameterStatistics(parameter.key, rows, thresholdsQuery.data ?? []));
  const alertsByDay = alerts.reduce<Record<string, { warning: number; critical: number }>>((counts, alert) => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(alert.createdAt));
    counts[day] ??= { warning: 0, critical: 0 };
    counts[day][alert.severity] += 1;
    return counts;
  }, {});

  return (
    <div className="stack">
      <PageHeading title="Trend charts" description="Three-hour readings with parameter-safe bands and the overnight window highlighted." actions={
        <div className="tabs" role="group" aria-label="Trend range">
          {([['24h', '24 hours', 1], ['7d', '7 days', 7], ['cycle', 'Full cycle', 21]] as const).map(([value, label, days]) => (
            <button type="button" className="tab" aria-pressed={range === value} disabled={days > tierConfig.retentionDays} key={value} onClick={() => setRange(value)}>{label}</button>
          ))}
        </div>
      } />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      <p className="small muted">Retention available: {tierConfig.retentionDays} days. Safe bands: {safeBandText}. Overnight shading: 22:00–06:00 PHT.</p>
      {!tierConfig.analytics ? <section className="card"><h2 className="card-title">Analytics requires an upgrade</h2><p className="muted">Trend charts are available on premium and enterprise tiers.</p></section> :
      query.isLoading || thresholdsQuery.isLoading || alertsQuery.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : thresholdsQuery.isError ? <ErrorState error={thresholdsQuery.error} onRetry={() => void thresholdsQuery.refetch()} /> : alertsQuery.isError ? <ErrorState error={alertsQuery.error} onRetry={() => void alertsQuery.refetch()} /> : rows.length === 0 ? <EmptyState>No readings are available for this range.</EmptyState> : (
        <>
        <section className="card">
          <h2 className="card-title">Range statistics</h2>
          <div className="table-wrap"><table><thead><tr><th>Parameter</th><th>Min</th><th>Max</th><th>Mean</th><th>Std dev</th><th>Readings in range</th><th>Excursions</th><th>Longest (h)</th></tr></thead><tbody>
            {summaries.map((summary) => <tr key={summary.parameter}><td>{summary.parameter}</td><td>{summary.min?.toFixed(2) ?? '—'}</td><td>{summary.max?.toFixed(2) ?? '—'}</td><td>{summary.mean?.toFixed(2) ?? '—'}</td><td>{summary.standardDeviation?.toFixed(2) ?? '—'}</td><td>{summary.percentInRange?.toFixed(1) ?? '—'}%</td><td>{summary.excursions}</td><td>{summary.longestExcursionHours.toFixed(1)}</td></tr>)}
          </tbody></table></div>
        </section>
        <section className="grid grid-3">
          {chartParameters.map((parameter) => {
            const min = parameter.threshold?.min ?? parameter.min;
            const max = parameter.threshold?.max;
            const safeRange = max === undefined ? `at least ${min} ${parameter.unit}` : `${min} to ${max} ${parameter.unit}`;
            return (
            <article className="card" key={parameter.key}>
              <h2 className="card-title">{parameter.title}</h2>
              <div style={{ width: '100%', height: 300 }} role="img" aria-label={`${parameter.title} trend chart. Safe range ${safeRange}; overnight windows highlighted.`}>
                <ResponsiveContainer>
                  <LineChart data={rows} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                    <ReferenceArea y1={min} y2={max ?? 'dataMax'} fill="var(--normal)" fillOpacity={0.09} />
                    {ranges.map((item) => <ReferenceArea key={item.x1} x1={item.x1} x2={item.x2} fill="#637a8a" fillOpacity={0.10} />)}
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(value: number) => new Date(value).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false })} minTickGap={30} />
                    <YAxis domain={['auto', 'auto']} width={48} />
                    <Tooltip labelFormatter={(value) => `${formatManilaDateTime(new Date(Number(value)))} PHT`} formatter={(value) => [`${Number(value).toFixed(2)} ${parameter.unit}`, parameter.title]} />
                    <Line dataKey={parameter.key === 'do' ? 'doMgL' : parameter.key} name={parameter.title} stroke={parameter.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                    {alerts.filter((alert) => alert.parameter.toLowerCase() === parameter.key || (parameter.key === 'do' && ['do', 'dissolved oxygen', 'dissolved_oxygen'].includes(alert.parameter.toLowerCase()))).map((alert) => (
                      <ReferenceDot key={alert.id} x={Date.parse(alert.createdAt)} y={alert.value} r={5} fill={alert.severity === 'critical' ? 'var(--critical)' : 'var(--warning)'} stroke="var(--surface)" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          );})}
        </section>
        <section className="card">
          <h2 className="card-title">Alert frequency by day</h2>
          {!Object.keys(alertsByDay).length ? <EmptyState>No alerts occurred in this range.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Date (PHT)</th><th>Warning</th><th>Critical</th></tr></thead><tbody>
            {Object.entries(alertsByDay).sort(([left], [right]) => left.localeCompare(right)).map(([day, counts]) => <tr key={day}><td>{day}</td><td>{counts.warning}</td><td>{counts.critical}</td></tr>)}
          </tbody></table></div>}
        </section>
        </>
      )}
    </div>
  );
}
