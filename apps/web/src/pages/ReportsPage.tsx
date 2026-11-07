import { useEffect, useMemo, useState } from 'react';
import { buildReport, formatManilaDateTime, getManilaDateString, toCsv } from '@hydrosense/shared';
import type { ReportData, ReportSection } from '@hydrosense/shared';
import { useQuery } from '@tanstack/react-query';
import { tierConfig } from '../app/config';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { useSelectedTank } from '../app/tank/TankContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

type ExportType = 'readings' | 'alerts' | 'activity' | 'calibration' | 'validation';

const reportSections: Array<{ value: ReportSection; label: string }> = [
  { value: 'summary', label: 'Executive summary' },
  { value: 'thresholds', label: 'Thresholds' },
  { value: 'statistics', label: 'Statistics' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'advisories', label: 'Advisories' },
  { value: 'activity', label: 'Activity logs' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'validation', label: 'Validation' },
  { value: 'data-quality', label: 'Data quality' },
  { value: 'raw-readings', label: 'Raw readings' },
];

function manilaStart(date: string) {
  return new Date(`${date}T00:00:00+08:00`).toISOString();
}

function manilaEnd(date: string) {
  return new Date(`${date}T23:59:59.999+08:00`).toISOString();
}

export default function ReportsPage() {
  const { tankId } = useSelectedTank();
  const { userName, role } = useRole();
  const canExport = role === 'manager' || role === 'admin';
  const [type, setType] = useState<ExportType>('readings');
  const [selectedTankIds, setSelectedTankIds] = useState<string[]>([]);
  const [from, setFrom] = useState(() => getManilaDateString(new Date(Date.now() - Math.min(7, tierConfig.retentionDays) * 86_400_000)));
  const [to, setTo] = useState(() => getManilaDateString());
  const minimumDate = getManilaDateString(new Date(Date.now() - Math.max(0, tierConfig.retentionDays - 1) * 86_400_000));
  const maximumDate = getManilaDateString();
  const [sections, setSections] = useState<ReportSection[]>(reportSections.map(({ value }) => value));
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (tankId) setSelectedTankIds([tankId]);
  }, [tankId]);
  const dataQuery = useQuery({
    queryKey: ['report-data'],
    queryFn: async (): Promise<ReportData> => {
      const [tanks, readings, alerts, thresholds, activityLogs, calibrationLogs, validationRows, deviceStatuses] = await Promise.all([
        api.listTanks(),
        api.listReadings(),
        api.listAlerts(),
        api.listThresholds(),
        api.listActivityLogs(),
        api.listCalibrationLogs(),
        api.listValidationRows(),
        api.listDeviceStatuses(),
      ]);
      const advisoryRows = await Promise.all(tanks.map(async (tank) => [tank.id, await api.listAdvisories(tank.id)] as const));
      return {
        tanks,
        readings,
        alerts,
        thresholds,
        advisories: Object.fromEntries(advisoryRows),
        activityLogs,
        calibrationLogs,
        validationRows,
        deviceStatuses,
      };
    },
  });
  const model = useMemo(() => {
    if (!dataQuery.data || !tankId) return null;
    return buildReport({
      tankIds: selectedTankIds.length ? selectedTankIds : [tankId],
      from: manilaStart(from),
      to: manilaEnd(to),
      sections,
      format: 'pdf',
      generatedBy: { name: userName, role },
    }, dataQuery.data);
  }, [dataQuery.data, from, role, sections, selectedTankIds, tankId, to, userName]);
  const rows = useMemo((): unknown[][] => {
    if (!model) return [];
    if (type === 'readings') return model.rawReadings.map((row) => [row.timestamp, row.tankId, row.temperature, row.doMgL, row.ph]);
    if (type === 'alerts') return model.alerts.map((row) => [row.createdAt, row.tankId, row.parameter, row.value, row.threshold, row.severity, row.status, row.acknowledgedBy ?? '', row.note ?? '']);
    if (type === 'activity') return model.activityLogs.map((row) => [row.occurredAt, row.kind, row.type, row.tankId, row.notes, row.operator]);
    if (type === 'calibration') return model.calibrationLogs.map((row) => [row.date, row.tankId, row.parameter, row.standard, row.before, row.after, row.user, row.nextDue]);
    return model.validationRows.map((row) => [row.parameter, row.hydrosenseMean, row.reference, row.error, row.pctError, row.tolerance, row.pass ? 'pass' : 'fail']);
  }, [model, type]);
  const headers: Record<ExportType, string[]> = {
    readings: ['Timestamp (ISO)', 'Tank', 'Temperature °C', 'DO mg/L', 'pH'],
    alerts: ['Created (ISO)', 'Tank', 'Parameter', 'Value', 'Threshold', 'Severity', 'Status', 'Acknowledged by', 'Response note'],
    activity: ['Occurred (ISO)', 'Kind', 'Type', 'Tank / scope', 'Details', 'Operator'],
    calibration: ['Date (ISO)', 'Tank', 'Parameter', 'Standard', 'Before', 'After', 'User', 'Next due (ISO)'],
    validation: ['Parameter', 'HydroSense mean', 'Reference', 'Error', '% error', 'Tolerance', 'Result'],
  };

  useEffect(() => {
    if (!preview) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [preview]);

  function downloadCsv() {
    const csv = toCsv([headers[type], ...rows]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hydrosense-${type}-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('CSV export generated.');
  }

  return (
    <div className="stack">
      <PageHeading title="Export reports" description="Build a structured hatchery report, preview it, print to PDF, or export individual datasets as CSV." />
      <StaleQueryState updatedAt={dataQuery.dataUpdatedAt} />
      <section className="card stack">
        <div className="form-grid">
          <label className="field">CSV dataset<select value={type} onChange={(event) => setType(event.target.value as ExportType)}><option value="readings">Raw readings</option><option value="alerts">Alerts</option><option value="activity">Activity logs</option><option value="calibration">Calibration log</option><option value="validation">Validation</option></select></label>
          <label className="field">From<input type="date" value={from} min={minimumDate} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field">To<input type="date" value={to} min={from} max={maximumDate} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <fieldset className="stack">
          <legend>Tanks</legend>
          <div className="inline">
            {(dataQuery.data?.tanks ?? []).map((tank) => (
              <label className="check-row" key={tank.id}>
                <input type="checkbox" checked={selectedTankIds.includes(tank.id)} disabled={selectedTankIds.length === 1 && selectedTankIds.includes(tank.id)} onChange={(event) => setSelectedTankIds((current) => event.target.checked ? [...current, tank.id] : current.filter((id) => id !== tank.id))} />
                <span>{tank.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="stack">
          <legend>Report sections</legend>
          <div className="inline">
            {reportSections.map(({ value, label }) => (
              <label className="check-row" key={value}>
                <input type="checkbox" checked={sections.includes(value)} onChange={(event) => setSections((current) => event.target.checked ? [...current, value] : current.filter((section) => section !== value))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {dataQuery.isLoading ? <LoadingState /> : dataQuery.isError ? <ErrorState error={dataQuery.error} onRetry={() => void dataQuery.refetch()} /> : !rows.length ? <EmptyState>No records match the selected dataset and date range.</EmptyState> : (
          <>
            <p>{rows.length} records · {from} through {to} · Asia/Manila</p>
            <div className="inline">
              {canExport && <button className="button button-primary" type="button" onClick={downloadCsv}>Download CSV</button>}
              <button className="button" type="button" onClick={() => { setNotice(''); setPreview(true); }}>Report preview</button>
            </div>
          </>
        )}
        {notice && <p role="status">{notice}</p>}
      </section>
      {preview && model && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(false); }}>
        <section className="dialog card stack print-preview" role="dialog" aria-modal="true" aria-labelledby="report-preview-title">
          <h2 id="report-preview-title" className="card-title">HydroSense report preview</h2>
          <p>Report {model.id} · {model.tanks.map((tank) => tank.name).join(', ')} · {from} to {to} PHT</p>
          <p>Prepared by {model.generatedBy.name} ({model.generatedBy.role}) · generated {formatManilaDateTime(model.generatedAt)} PHT</p>
          {sections.includes('summary') && <p>{model.summary}</p>}
          {sections.includes('statistics') && <div className="table-wrap"><table><thead><tr><th>Parameter</th><th>Min</th><th>Max</th><th>Mean</th><th>Std dev</th><th>In range</th><th>Excursions</th><th>Longest (h)</th></tr></thead><tbody>
            {model.statistics.map((row) => <tr key={row.parameter}><td>{row.parameter}</td><td>{row.min?.toFixed(2) ?? '—'}</td><td>{row.max?.toFixed(2) ?? '—'}</td><td>{row.mean?.toFixed(2) ?? '—'}</td><td>{row.standardDeviation?.toFixed(2) ?? '—'}</td><td>{row.percentInRange?.toFixed(1) ?? '—'}%</td><td>{row.excursions}</td><td>{row.longestExcursionHours.toFixed(1)}</td></tr>)}
          </tbody></table></div>}
          {sections.includes('alerts') && <p>Alerts: {model.alertCounts.critical} critical, {model.alertCounts.warning} warning · {model.alertCounts.open} open, {model.alertCounts.acknowledged} acknowledged, {model.alertCounts.resolved} resolved.</p>}
          {sections.includes('data-quality') && <p>Expected readings: {model.dataQuality.expectedReadings} · Received: {model.dataQuality.receivedReadings} ({model.dataQuality.receivedPercent.toFixed(1)}%).</p>}
          {sections.includes('thresholds') && <p>Thresholds used: {model.thresholds.map((threshold) => `${threshold.parameter} ${threshold.min ?? '—'}–${threshold.max ?? '—'}`).join(' · ')}</p>}
          {sections.includes('advisories') && model.tanks.map((tank) => <p key={tank.id}>Current advisories for {tank.name}: {(model.advisories[tank.id] ?? []).map((item) => `${item.kind} ${item.level}`).join(', ') || 'none'}.</p>)}
          {sections.includes('activity') && <p>Activity logs included: {model.activityLogs.length}.</p>}
          {sections.includes('calibration') && <p>Calibration records included: {model.calibrationLogs.length}.</p>}
          {sections.includes('validation') && <p>Validation comparisons included: {model.validationRows.length}.</p>}
          {sections.includes('raw-readings') && model.rawReadings.slice(0, 10).map((row) => <p className="small" key={row.id}>{formatManilaDateTime(row.timestamp)} PHT · {row.tankId} · {row.temperature} °C · {row.doMgL} mg/L · pH {row.ph}</p>)}
          <p className="small muted">Monitoring and alert system only. Salinity and ammonia are rule-based advisories, not measurements.</p>
          <div className="inline"><button className="button" type="button" onClick={() => setPreview(false)}>Close</button>{canExport && <button className="button button-primary" type="button" onClick={() => window.print()}>Print / Save PDF</button>}</div>
          {!canExport && <p className="small muted">Operators may view reports; export is available to managers and administrators.</p>}
        </section>
      </div>}
    </div>
  );
}
