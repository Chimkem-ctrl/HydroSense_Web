import { useMemo, useState } from 'react';
import { ReferenceArea, ReferenceDot, ResponsiveContainer, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateParameterStatistics, formatManilaDateTime } from '@hydrosense/shared';
import type { MeasuredParameter } from '@hydrosense/shared';
import { useSelectedTank } from '../app/tank/TankContext';
import { tierConfig } from '../app/config';
import { api } from '../app/api';
import { useQuery } from '@tanstack/react-query';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';
import { nightRanges, prepareTrendRows } from './trendData';

type Range = '24h' | '7d' | 'cycle';

const parameters: Array<{ key: MeasuredParameter; title: string; unit: string; color: string; min: number; max: number }> = [
  { key: 'temperature', title: 'Temperature', unit: '°C', color: 'var(--accent)', min: 28, max: 32 },
  { key: 'do', title: 'Dissolved oxygen', unit: 'mg/L', color: 'var(--chart-do)', min: 4, max: 10 },
  { key: 'ph', title: 'pH', unit: 'pH', color: 'var(--chart-ph)', min: 6, max: 8 },
];

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
  const { rows, chartRows } = useMemo(() => prepareTrendRows(query.data ?? []), [query.data]);
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
    <div className="stack trends-screen">
      <PageHeading title="Trend charts" description="Three-hour readings with parameter-safe bands and the overnight window highlighted." actions={
        <div className="tabs" role="group" aria-label="Trend range">
          {([['24h', '24 hours', 1], ['7d', '7 days', 7], ['cycle', 'Full cycle', 21]] as const).map(([value, label, days]) => (
            <button type="button" className="tab" aria-pressed={range === value} disabled={days > tierConfig.retentionDays} key={value} onClick={() => setRange(value)}>{label}</button>
          ))}
        </div>
      } />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      <p className="small muted">Retention available: {tierConfig.retentionDays} days. Safe bands: {safeBandText}. Overnight shading: 22:00–06:00 PHT.</p>
      {!tierConfig.analytics ? <section className="card glass"><h2 className="card-title">Analytics requires an upgrade</h2><p className="muted">Trend charts are available on premium and enterprise tiers.</p></section> :
      query.isLoading || thresholdsQuery.isLoading || alertsQuery.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : thresholdsQuery.isError ? <ErrorState error={thresholdsQuery.error} onRetry={() => void thresholdsQuery.refetch()} /> : alertsQuery.isError ? <ErrorState error={alertsQuery.error} onRetry={() => void alertsQuery.refetch()} /> : rows.length === 0 ? <EmptyState>No readings are available for this range.</EmptyState> : (
        <>
        <section className="card glass">
          <h2 className="card-title">Range statistics</h2>
          <div className="table-wrap"><table><thead><tr><th>Parameter</th><th>Min</th><th>Max</th><th>Mean</th><th>Std dev</th><th>Readings in range</th><th>Excursions</th><th>Longest (h)</th></tr></thead><tbody>
            {summaries.map((summary) => <tr key={summary.parameter}><td>{summary.parameter}</td><td>{summary.min?.toFixed(2) ?? '—'}</td><td>{summary.max?.toFixed(2) ?? '—'}</td><td>{summary.mean?.toFixed(2) ?? '—'}</td><td>{summary.standardDeviation?.toFixed(2) ?? '—'}</td><td>{summary.percentInRange?.toFixed(1) ?? '—'}%</td><td>{summary.excursions}</td><td>{summary.longestExcursionHours.toFixed(1)}</td></tr>)}
          </tbody></table></div>
        </section>
        <section className="trend-charts">
          {chartParameters.map((parameter) => {
            const min = parameter.threshold ? parameter.threshold.min : parameter.min;
            const max = parameter.threshold?.max;
            const safeRange = min !== undefined && max !== undefined ? `${min} to ${max} ${parameter.unit}` : min !== undefined ? `at least ${min} ${parameter.unit}` : max !== undefined ? `at most ${max} ${parameter.unit}` : 'not configured';
            const values = rows.map((row) => parameter.key === 'do' ? row.doMgL : row[parameter.key]);
            const bandMin = min ?? Math.min(max ?? parameter.min, ...values);
            const bandMax = max ?? Math.max(min ?? parameter.max, ...values);
            return (
            <article className="card glass trend-chart-card" key={parameter.key}>
              <h2 className="card-title">{parameter.title}</h2>
              <p className="small muted">Safe range: {safeRange} · Overnight: 22:00–06:00 PHT</p>
              <div className="trend-chart-frame" role="img" aria-label={`${parameter.title} trend chart. Safe range ${safeRange}; overnight windows highlighted.`}>
                <ResponsiveContainer>
                  <LineChart data={chartRows} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="var(--control-border)" strokeDasharray="4 4" />
                    {(min !== undefined || max !== undefined) && <ReferenceArea y1={bandMin} y2={bandMax} ifOverflow="hidden" fill="var(--ok)" fillOpacity={0.09} />}
                    {ranges.map((item) => <ReferenceArea key={item.x1} x1={item.x1} x2={item.x2} fill="var(--chart-night)" fillOpacity={0.12} />)}
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} stroke="var(--text-secondary)" tickFormatter={(value: number) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...(range !== '24h' ? { month: 'short', day: 'numeric' } : {}), hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))} minTickGap={30} />
                    <YAxis domain={['auto', 'auto']} width={48} stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--control-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)' }} labelFormatter={(value) => `${formatManilaDateTime(new Date(Number(value)))} PHT`} formatter={(value) => [`${Number(value).toFixed(2)} ${parameter.unit}`, parameter.title]} />
                    <Line dataKey={parameter.key === 'do' ? 'doMgL' : parameter.key} name={parameter.title} stroke={parameter.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                    {alerts.filter((alert) => alert.parameter.toLowerCase() === parameter.key || (parameter.key === 'do' && ['do', 'dissolved oxygen', 'dissolved_oxygen'].includes(alert.parameter.toLowerCase()))).map((alert) => (
                      <ReferenceDot key={alert.id} x={Date.parse(alert.createdAt)} y={alert.value} r={5} fill={alert.severity === 'critical' ? 'var(--critical-text)' : 'var(--warn-text)'} stroke="var(--glass-bg-strong)" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          );})}
        </section>
        <section className="card glass">
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
