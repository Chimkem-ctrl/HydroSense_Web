import { Info } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MeasuredParameter, Reading, Threshold } from '@hydrosense/shared';
import { DEFAULT_THRESHOLDS, formatManilaDateTime, formatParameter, getParameterStatus } from '@hydrosense/shared';
import { StatusBadge } from './StatusBadge';

const config: Record<MeasuredParameter, { title: string; unit: string }> = {
  temperature: { title: 'Temperature', unit: '°C' },
  do: { title: 'Dissolved oxygen', unit: 'mg/L' },
  ph: { title: 'pH', unit: 'pH' },
};

const pct = (value: number, from: number, to: number) => Math.max(0, Math.min(100, (value - from) / (to - from) * 100));

export function ReadingCard({ parameter, reading, threshold, showRangeMeter = false, showUpdatedTimestamp = true }: { parameter: MeasuredParameter; reading: Reading; threshold?: Threshold; showRangeMeter?: boolean; showUpdatedTimestamp?: boolean }) {
  const value = parameter === 'do' ? reading.doMgL : reading[parameter];
  const configuredThreshold = threshold ?? DEFAULT_THRESHOLDS.find((item) => item.parameter === parameter);
  const status = getParameterStatus(parameter, value, configuredThreshold);
  const unit = config[parameter].unit;
  const min = configuredThreshold?.min;
  const max = configuredThreshold?.max;
  const safeRange = min !== undefined && max !== undefined
    ? `Safe ${min}–${max} ${unit}`
    : min !== undefined
      ? `Safe ≥${min} ${unit}`
      : `Safe ≤${max ?? '—'} ${unit}`;
  const padding = min !== undefined && max !== undefined ? (max - min) / 2 : 0;
  const scaleMin = min !== undefined && max !== undefined ? min - padding : min !== undefined ? Math.min(0, min) : max !== undefined ? Math.min(0, max) : undefined;
  const scaleMax = min !== undefined && max !== undefined ? max + padding : min !== undefined ? Math.max(min * 2, min + 1) : max !== undefined ? Math.max(max * 1.5, max + 1) : undefined;
  const showScale = showRangeMeter && Number.isFinite(value) && scaleMin !== undefined && scaleMax !== undefined && scaleMax > scaleMin;
  const position = showScale ? pct(value, scaleMin, scaleMax) : 0;
  const safeStart = showScale ? (min !== undefined ? pct(min, scaleMin, scaleMax) : 0) : 0;
  const safeEnd = showScale ? (max !== undefined ? pct(max, scaleMin, scaleMax) : 100) : 100;
  const scaleNote = showScale ? `Display scale ${scaleMin}–${scaleMax} ${unit}${value < scaleMin || value > scaleMax ? ' · marker at scale edge' : ''}` : '';
  const distance = status.distance.replace('minimum', 'min').replace('maximum', 'max');
  return (
    <article className={`card reading-card${showRangeMeter ? ' glass' : ''}`} aria-label={`${config[parameter].title} reading`}>
      <div className="reading-head">
        <span className="reading-label">{config[parameter].title}</span>
        <StatusBadge level={status.level} label={status.label} />
      </div>
      <strong className="reading-number">{formatParameter(parameter, value)}</strong>
      <p className="reading-status">{distance}</p>
      {showScale ? (
        <div className="reading-scale">
          <div className="reading-scale-track" role="img" aria-label={`${safeRange}. Current value ${formatParameter(parameter, value)}`} style={{ '--safe-start': `${safeStart}%`, '--safe-end': `${safeEnd}%` } as CSSProperties}>
            <i className="reading-scale-dim" style={{ left: 0, width: `${safeStart}%` }} />
            <i className="reading-scale-dim" style={{ right: 0, width: `${100 - safeEnd}%` }} />
            <span style={{ left: `${position}%` }} />
          </div>
          <div className="reading-scale-labels" aria-hidden="true">
            {min !== undefined && <span style={{ left: `${safeStart}%` }}>{min}</span>}
            {max !== undefined && <span style={{ left: `${safeEnd}%` }}>{max}</span>}
          </div>
          <button type="button" className="info-tip" aria-label={scaleNote} title={scaleNote}><Info size={14} aria-hidden="true" /></button>
        </div>
      ) : <p className="reading-caption">{safeRange}</p>}
      {showRangeMeter && showUpdatedTimestamp && <p className="reading-updated">Updated {formatManilaDateTime(reading.timestamp)} PHT</p>}
    </article>
  );
}
