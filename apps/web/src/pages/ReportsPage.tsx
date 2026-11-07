import { useEffect, useMemo, useState } from 'react';
import { formatManilaDateTime, getManilaDateString, toCsv } from '@hydrosense/shared';
import type { CalibrationLog, Reading, AlertItem } from '@hydrosense/shared';
import { useQuery } from '@tanstack/react-query';
import { DATA_MODE, tierConfig } from '../app/config';
import { api } from '../app/api';
import { useSelectedTank } from '../app/tank/TankContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

type ExportType = 'readings' | 'alerts' | 'calibration';

function inRange(timestamp: string, from: string, to: string) {
  const time = new Date(timestamp).getTime();
  return time >= Date.parse(`${from}T00:00:00+08:00`) && time <= Date.parse(`${to}T23:59:59+08:00`);
}

export default function ReportsPage() {
  const { tankId } = useSelectedTank();
  const [type, setType] = useState<ExportType>('readings');
  const [from, setFrom] = useState(() => getManilaDateString(new Date(Date.now() - Math.min(7, tierConfig.retentionDays) * 86_400_000)));
  const [to, setTo] = useState(() => getManilaDateString());
  const minimumDate = getManilaDateString(new Date(Date.now() - Math.max(0, tierConfig.retentionDays - 1) * 86_400_000));
  const maximumDate = getManilaDateString();
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const readings = useQuery({ queryKey: ['report-readings', tankId], queryFn: () => api.listReadings({ tankId }), enabled: type === 'readings' && Boolean(tankId) });
  const alerts = useQuery({ queryKey: ['report-alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: type === 'alerts' && Boolean(tankId) });
  const calibration = useQuery({ queryKey: ['report-calibrations', tankId], queryFn: () => api.listCalibrationLogs(tankId), enabled: type === 'calibration' && Boolean(tankId) });
  const selectedQuery = type === 'readings' ? readings : type === 'alerts' ? alerts : calibration;
  const rows = useMemo((): unknown[][] => {
    if (type === 'readings') return ((readings.data ?? []) as Reading[]).filter((row) => inRange(row.timestamp, from, to)).map((row) => [row.timestamp, row.tankId, row.temperature, row.doMgL, row.ph]);
    if (type === 'alerts') return ((alerts.data ?? []) as AlertItem[]).filter((row) => inRange(row.createdAt, from, to)).map((row) => [row.createdAt, row.tankId, row.parameter, row.value, row.threshold, row.severity, row.status, row.note ?? '']);
    return ((calibration.data ?? []) as CalibrationLog[]).filter((row) => inRange(row.date, from, to)).map((row) => [row.date, row.tankId, row.parameter, row.standard, row.before, row.after, row.user, row.nextDue]);
  }, [alerts.data, calibration.data, from, readings.data, to, type]);
  const headers: Record<ExportType, string[]> = {
    readings: ['Timestamp (ISO)', 'Tank', 'Temperature °C', 'DO mg/L', 'pH'],
    alerts: ['Created (ISO)', 'Tank', 'Parameter', 'Value', 'Threshold', 'Severity', 'Status', 'Note'],
    calibration: ['Date (ISO)', 'Tank', 'Parameter', 'Standard', 'Before', 'After', 'User', 'Next due (ISO)'],
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
      <PageHeading title="Export reports" description="Choose a report dataset and date range. CSV is generated in the browser; PDF uses a printable preview." />
      <StaleQueryState updatedAt={selectedQuery.dataUpdatedAt} />
      <section className="card stack">
        <div className="form-grid">
          <label className="field">Report type<select value={type} onChange={(event) => setType(event.target.value as ExportType)}><option value="readings">Readings</option><option value="alerts">Alerts</option><option value="calibration">Calibration log</option></select></label>
          <label className="field">From<input type="date" value={from} min={minimumDate} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field">To<input type="date" value={to} min={from} max={maximumDate} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        {selectedQuery.isLoading ? <LoadingState /> : selectedQuery.isError ? <ErrorState error={selectedQuery.error} onRetry={() => void selectedQuery.refetch()} /> : !rows.length ? <EmptyState>No report rows match the selected date range.</EmptyState> : (
          <>
            <p>{rows.length} records · {from} through {to}</p>
            <div className="inline">
              <button className="button button-primary" type="button" onClick={downloadCsv}>Download CSV</button>
              <button className="button" type="button" onClick={() => { setNotice(''); setPreview(true); }}>PDF preview</button>
            </div>
          </>
        )}
        {notice && <p role="status">{notice}</p>}
      </section>
      {preview && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(false); }}>
        <section className="dialog card stack print-preview" role="dialog" aria-modal="true" aria-labelledby="report-preview-title">
          <h2 id="report-preview-title" className="card-title">HydroSense report preview</h2>
          <p>Dataset: {type} · Tank: {tankId} · {from} to {to} (Asia/Manila)</p>
          <p>{rows.length} records included. Preview timestamps use PHT where shown.</p>
          {rows.slice(0, 6).map((row, index) => <p className="small" key={index}>{row.map((cell) => typeof cell === 'string' && cell.includes('T') ? formatManilaDateTime(cell) : String(cell)).join(' · ')}</p>)}
          <div className="inline"><button className="button" type="button" onClick={() => setPreview(false)}>Close</button><button className="button button-primary" type="button" disabled={DATA_MODE !== 'mock'} title={DATA_MODE !== 'mock' ? 'PDF preview is available in mock mode only.' : undefined} onClick={() => window.print()}>Print / Save PDF</button></div>
          {DATA_MODE !== 'mock' && <p className="small muted">PDF generation is mock-mode only; use CSV while connected to a live API.</p>}
        </section>
      </div>}
    </div>
  );
}
