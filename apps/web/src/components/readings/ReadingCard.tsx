import type { MeasuredParameter, Reading, Threshold } from '@hydrosense/shared';
import { DEFAULT_THRESHOLDS, formatManilaDateTime, formatParameter, getParameterStatus } from '@hydrosense/shared';
import { StatusBadge } from './StatusBadge';

const config: Record<MeasuredParameter, { title: string; unit: string }> = {
  temperature: { title: 'Temperature', unit: '°C' },
  do: { title: 'Dissolved oxygen', unit: 'mg/L' },
  ph: { title: 'pH', unit: 'pH' },
};

export function ReadingCard({ parameter, reading, threshold, showRangeMeter = false, showUpdatedTimestamp = true }: { parameter: MeasuredParameter; reading: Reading; threshold?: Threshold; showRangeMeter?: boolean; showUpdatedTimestamp?: boolean }) {
  const value = parameter === 'do' ? reading.doMgL : reading[parameter];
  const configuredThreshold = threshold ?? DEFAULT_THRESHOLDS.find((item) => item.parameter === parameter);
  const status = getParameterStatus(parameter, value, configuredThreshold);
  const safeRange = configuredThreshold?.min !== undefined && configuredThreshold.max !== undefined
    ? `Safe ${configuredThreshold.min}–${configuredThreshold.max}${parameter === 'temperature' ? '°C' : parameter === 'do' ? ' mg/L' : ' pH'}`
    : configuredThreshold?.min !== undefined
      ? `Safe ≥${configuredThreshold.min}${parameter === 'temperature' ? '°C' : parameter === 'do' ? ' mg/L' : ' pH'}`
      : `Safe ≤${configuredThreshold?.max ?? '—'}`;
  const min = configuredThreshold?.min;
  const max = configuredThreshold?.max;
  const scaleMin = min !== undefined && max !== undefined ? min : min !== undefined ? Math.min(0, min) : max !== undefined ? Math.min(0, max) : undefined;
  const scaleMax = min !== undefined && max !== undefined ? max : min !== undefined ? Math.max(min * 2, min + 1) : max !== undefined ? Math.max(max, 1) : undefined;
  const showScale = showRangeMeter && Number.isFinite(value) && scaleMin !== undefined && scaleMax !== undefined && scaleMax > scaleMin;
  const position = showScale ? Math.max(0, Math.min(100, (value - scaleMin) / (scaleMax - scaleMin) * 100)) : 0;
  return (
    <article className={`card reading-card${showRangeMeter ? ' glass' : ''}`} aria-label={`${config[parameter].title} reading`}>
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <span className="reading-label">{config[parameter].title}</span>
        <StatusBadge level={status.level} label={status.label} />
      </div>
      <strong className="reading-number">{formatParameter(parameter, value)}</strong>
      <div className="reading-meta">
        <span>{status.distance}</span>
        <span>{safeRange}</span>
      </div>
      {showScale && <div className="reading-scale">
        <div className="reading-scale-track" aria-hidden="true"><span style={{ left: `${position}%` }} /></div>
        <span>Display scale {scaleMin}–{scaleMax} {config[parameter].unit}{value < scaleMin || value > scaleMax ? ' · marker at scale edge' : ''}</span>
      </div>}
      {showRangeMeter && showUpdatedTimestamp && <p className="reading-updated">Updated {formatManilaDateTime(reading.timestamp)} PHT</p>}
    </article>
  );
}
