import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import {
  AlertCircle, AlertTriangle, Battery, CheckCircle2, ChevronRight, CircleHelp,
  Info, LoaderCircle, Wifi, WifiOff, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Advisory, Level } from '@hydrosense/shared';

type Children = { children: ReactNode };
const levelIcons: Record<Level, LucideIcon> = { normal: CheckCircle2, warning: AlertTriangle, critical: AlertCircle };

export function GlassCard({ title, action, children, className = '' }: Children & { title?: string; action?: ReactNode; className?: string }) {
  return <section className={`glass ds-card ${className}`}>
    {(title || action) && <header className="ds-card-header">{title && <h2>{title}</h2>}{action}</header>}
    {children}
  </section>;
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' }) {
  return <button {...props} className={`ds-button ds-button--${variant} ${className}`} />;
}

export function StatusBadge({ level }: { level: Level }) {
  const Icon = levelIcons[level];
  return <span className={`ds-status ds-status--${level}`}><Icon aria-hidden="true" size={15} strokeWidth={1.5} />{level[0].toUpperCase() + level.slice(1)}</span>;
}

export function AdvisoryChip({ kind, level, explanation }: { kind: string; level: Advisory; explanation: string }) {
  return <details className="ds-advisory">
    <summary className={`ds-status ds-advisory--${level}`}><Info size={15} strokeWidth={1.5} aria-hidden="true" />Advisory · {kind} · {level}<CircleHelp size={15} strokeWidth={1.5} aria-hidden="true" /></summary>
    <div className="ds-advisory-detail"><strong>Why this level?</strong><p>{explanation}</p><small>Advisory only — not a sensor measurement.</small></div>
  </details>;
}

export function HeroReading({ label, value, unit, level, detail }: { label: string; value: string; unit: string; level: Level; detail: string }) {
  return <GlassCard title={label} action={<StatusBadge level={level} />}>
    <div className="ds-hero-value">{value} <span>{unit}</span></div>
    <p className="ds-helper">{detail}</p>
  </GlassCard>;
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="ds-tile"><span className="ds-helper">{label}</span><strong>{value}</strong><span className="ds-helper">{detail}</span></div>;
}

export function ListRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="ds-list-row"><Icon size={18} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span><span className="ds-list-value">{value}</span><ChevronRight size={16} aria-hidden="true" /></div>;
}

export function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className="ds-toggle-row"><span>{label}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="ds-switch" aria-hidden="true" /></label>;
}

export function SegmentedControl<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>; value: T; onChange: (value: T) => void }) {
  return <div className="ds-segmented" role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" aria-pressed={option.value === value} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export function Tabs<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ value: T; label: string; content: ReactNode }>; value: T; onChange: (value: T) => void }) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return <div>
    <div className="ds-segmented" role="tablist" aria-label={label}>
      {options.map((option, index) => <button key={option.value} ref={(element) => { refs.current[index] = element; }} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={value === option.value} tabIndex={value === option.value ? 0 : -1} onClick={() => onChange(option.value)} onKeyDown={(event) => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % options.length;
        else if (event.key === 'ArrowLeft') next = (index + options.length - 1) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else return;
        event.preventDefault();
        onChange(options[next].value);
        refs.current[next]?.focus();
      }}>{option.label}</button>)}
    </div>
    {options.map((option, index) => <div key={option.value} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={value !== option.value} tabIndex={0}><p className="ds-helper">{option.content}</p></div>)}
  </div>;
}

export function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="ds-field">{label}<input {...props} /></label>;
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Children & { label: string }) {
  return <label className="ds-field">{label}<select {...props}>{children}</select></label>;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: { from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void }) {
  return <div className="ds-form-grid"><Input label="From" type="date" value={from} max={to} onChange={(event) => onFromChange(event.target.value)} /><Input label="To" type="date" value={to} min={from} onChange={(event) => onToChange(event.target.value)} /></div>;
}

function boundedPercent(value: number) {
  if (!Number.isFinite(value)) throw new Error('Progress must be a finite number.');
  return Math.min(100, Math.max(0, value));
}

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const percent = boundedPercent(value);
  return <div className="ds-progress-block"><div className="ds-progress-label"><span>{label}</span><strong>{percent}%</strong></div><div className="ds-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span className="ds-progress-fill" style={{ width: `${percent}%` }} /></div></div>;
}

export function Meter({ label, value }: { label: string; value: number }) {
  const percent = boundedPercent(value);
  return <div className="ds-progress-block"><div className="ds-progress-label"><span>{label}</span><strong>{percent}%</strong></div><div className="ds-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span className="ds-meter-marker" style={{ left: `${percent}%` }} /></div><small className="ds-helper">Example position only, not a sensor status.</small></div>;
}

export function BatteryIndicator({ value }: { value: number }) {
  const percent = boundedPercent(value);
  return <span className="ds-indicator"><Battery size={18} strokeWidth={1.5} aria-hidden="true" />Battery {percent}%</span>;
}

export function ConnectionIndicator({ online }: { online: boolean }) {
  const Icon = online ? Wifi : WifiOff;
  return <span className="ds-indicator"><Icon size={18} strokeWidth={1.5} aria-hidden="true" />{online ? 'Online' : 'Offline'}</span>;
}

export function Pill({ children }: Children) {
  return <span className="ds-pill">{children}</span>;
}

export function Skeleton({ label = 'Loading data' }: { label?: string }) {
  return <div role="status" aria-label={label} className="ds-skeleton"><span /><span /><span /></div>;
}

export function EmptyState({ children }: Children) {
  return <div className="ds-empty"><CircleHelp size={24} strokeWidth={1.5} aria-hidden="true" /><p>{children}</p></div>;
}

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="ds-table-wrap"><table className="ds-table"><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function Overlay({ open, onClose, title, side = false, children }: Children & { open: boolean; onClose: () => void; title: string; side?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={`ds-dialog ${side ? 'ds-sheet' : ''}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <header className="ds-card-header"><h2>{title}</h2><Button variant="ghost" aria-label={`Close ${title}`} onClick={onClose}><X size={18} aria-hidden="true" /></Button></header>
    {children}
  </dialog>;
}

export function Toast({ children, onClose }: Children & { onClose: () => void }) {
  return <div className="ds-toast" role="status"><CheckCircle2 size={18} aria-hidden="true" />{children}<button type="button" aria-label="Dismiss notification" onClick={onClose}><X size={16} aria-hidden="true" /></button></div>;
}

export function LoadingIndicator() {
  return <span className="ds-indicator" role="status"><LoaderCircle className="ds-spinner" size={18} aria-hidden="true" />Sync in progress</span>;
}
