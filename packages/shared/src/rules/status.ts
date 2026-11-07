import type { Level, MeasuredParameter, Reading, Threshold } from '../types';

export interface ParameterStatus {
  level: Level;
  label: string;
  distance: string;
  icon: 'check' | 'warning' | 'critical';
}

export const DEFAULT_THRESHOLDS: Threshold[] = [
  { parameter: 'temperature', min: 28, max: 32 },
  { parameter: 'do', min: 4 },
  { parameter: 'ph', min: 6, max: 8 },
];

const PARAMETER_UNITS: Record<MeasuredParameter, string> = {
  temperature: '°C',
  do: 'mg/L',
  ph: 'pH',
};

export function readingValue(reading: Reading, parameter: MeasuredParameter): number {
  if (parameter === 'do') return reading.doMgL;
  return reading[parameter];
}

export function getParameterStatus(
  parameter: MeasuredParameter,
  value: number,
  threshold: Threshold | undefined = DEFAULT_THRESHOLDS.find((item) => item.parameter === parameter),
): ParameterStatus {
  if (!threshold) throw new Error(`Threshold configuration is missing for ${parameter}.`);
  const unit = PARAMETER_UNITS[parameter];
  if (!Number.isFinite(value)) {
    return { level: 'critical', label: 'No valid reading', distance: 'Reading unavailable', icon: 'critical' };
  }

  const outsideLow = threshold.min !== undefined && value < threshold.min;
  const outsideHigh = threshold.max !== undefined && value > threshold.max;
  if (outsideLow || outsideHigh) {
    const limit = outsideLow ? threshold.min! : threshold.max!;
    const direction = outsideLow ? 'below minimum' : 'above maximum';
    const difference = Math.abs(value - limit);
    const isNear = difference <= (parameter === 'temperature' ? 0.5 : parameter === 'do' ? 0.5 : 0.2);
    const level = isNear ? 'warning' : 'critical';
    return {
      level,
      label: level === 'warning' ? 'Warning' : 'Critical',
      distance: `${difference.toFixed(1)} ${unit} ${direction}`,
      icon: level,
    };
  }

  const lowMargin = threshold.min === undefined ? Number.POSITIVE_INFINITY : value - threshold.min;
  const highMargin = threshold.max === undefined ? Number.POSITIVE_INFINITY : threshold.max - value;
  const nearestMargin = Math.min(lowMargin, highMargin);
  const warningMargin = parameter === 'temperature' ? 0.5 : parameter === 'do' ? 0.5 : 0.2;
  if (nearestMargin <= warningMargin) {
    const toLimit = lowMargin <= highMargin ? 'minimum' : 'maximum';
    return {
      level: 'warning',
      label: 'Warning',
      distance: `${nearestMargin.toFixed(1)} ${unit} from ${toLimit}`,
      icon: 'warning',
    };
  }
  return {
    level: 'normal',
    label: 'Normal',
    distance: `${nearestMargin.toFixed(1)} ${unit} from nearest limit`,
    icon: 'check',
  };
}

export function getReadingStatuses(
  reading: Reading,
  thresholds: Threshold[] = DEFAULT_THRESHOLDS,
): Record<MeasuredParameter, ParameterStatus> {
  return {
    temperature: getParameterStatus('temperature', reading.temperature, thresholds.find((item) => item.parameter === 'temperature')),
    do: getParameterStatus('do', reading.doMgL, thresholds.find((item) => item.parameter === 'do')),
    ph: getParameterStatus('ph', reading.ph, thresholds.find((item) => item.parameter === 'ph')),
  };
}

export function formatParameter(parameter: MeasuredParameter, value: number): string {
  const precision = parameter === 'ph' ? 2 : 1;
  return `${value.toFixed(precision)} ${PARAMETER_UNITS[parameter]}`;
}
