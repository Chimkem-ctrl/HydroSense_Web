import type { MeasuredParameter, Reading, Threshold } from '@hydrosense/shared';
import { DEFAULT_THRESHOLDS, formatParameter, getParameterStatus } from '@hydrosense/shared';
import { StatusBadge } from './StatusBadge';

const config: Record<MeasuredParameter, { title: string; unit: string }> = {
  temperature: { title: 'Temperature', unit: '°C' },
  do: { title: 'Dissolved oxygen', unit: 'mg/L' },
  ph: { title: 'pH', unit: 'pH' },
};

export function ReadingCard({ parameter, reading, threshold }: { parameter: MeasuredParameter; reading: Reading; threshold?: Threshold }) {
  const value = parameter === 'do' ? reading.doMgL : reading[parameter];
  const configuredThreshold = threshold ?? DEFAULT_THRESHOLDS.find((item) => item.parameter === parameter);
  const status = getParameterStatus(parameter, value, configuredThreshold);
  const safeRange = configuredThreshold?.min !== undefined && configuredThreshold.max !== undefined
    ? `Safe ${configuredThreshold.min}–${configuredThreshold.max}${parameter === 'temperature' ? '°C' : parameter === 'do' ? ' mg/L' : ' pH'}`
    : configuredThreshold?.min !== undefined
      ? `Safe ≥${configuredThreshold.min}${parameter === 'temperature' ? '°C' : parameter === 'do' ? ' mg/L' : ' pH'}`
      : `Safe ≤${configuredThreshold?.max ?? '—'}`;
  return (
    <article className="card reading-card" aria-label={`${config[parameter].title} reading`}>
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <span className="reading-label">{config[parameter].title}</span>
        <StatusBadge level={status.level} label={status.label} />
      </div>
      <strong className="reading-number">{formatParameter(parameter, value)}</strong>
      <div className="reading-meta">
        <span>{status.distance}</span>
        <span>{safeRange}</span>
      </div>
    </article>
  );
}
