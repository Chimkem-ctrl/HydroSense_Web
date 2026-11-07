import type {
  ActivityLog,
  AdvisoryState,
  AlertItem,
  CalibrationLog,
  DeviceStatus,
  Reading,
  Role,
  Tank,
  Threshold,
  ValidationRow,
} from './types';

export type ReportSection =
  | 'summary'
  | 'thresholds'
  | 'statistics'
  | 'alerts'
  | 'advisories'
  | 'activity'
  | 'calibration'
  | 'validation'
  | 'data-quality'
  | 'raw-readings';

export interface ReportSpec {
  tankIds: string[];
  from: string;
  to: string;
  sections: ReportSection[];
  format: 'pdf' | 'csv' | 'xlsx';
  generatedBy: { name: string; role: Role };
}

export interface ReportData {
  tanks: Tank[];
  readings: Reading[];
  alerts: AlertItem[];
  thresholds: Threshold[];
  advisories: Record<string, AdvisoryState[]>;
  activityLogs: ActivityLog[];
  calibrationLogs: CalibrationLog[];
  validationRows: ValidationRow[];
  deviceStatuses: DeviceStatus[];
}

export interface ParameterStatistics {
  parameter: 'temperature' | 'do' | 'ph';
  unit: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  standardDeviation: number | null;
  percentInRange: number | null;
  excursions: number;
  longestExcursionHours: number;
  readings: number;
}

export interface ReportModel {
  id: string;
  sections: ReportSection[];
  format: ReportSpec['format'];
  generatedAt: string;
  generatedBy: ReportSpec['generatedBy'];
  range: { from: string; to: string };
  tanks: Tank[];
  thresholds: Threshold[];
  statistics: ParameterStatistics[];
  alertCounts: { warning: number; critical: number; open: number; acknowledged: number; resolved: number };
  alerts: AlertItem[];
  advisories: Record<string, AdvisoryState[]>;
  activityLogs: ActivityLog[];
  calibrationLogs: CalibrationLog[];
  validationRows: ValidationRow[];
  deviceStatuses: DeviceStatus[];
  dataQuality: { expectedReadings: number; receivedReadings: number; receivedPercent: number };
  rawReadings: Reading[];
  summary: string;
}

const parameterDefinitions = {
  temperature: { unit: '°C', min: 28, max: 32, read: (reading: Reading) => reading.temperature },
  do: { unit: 'mg/L', min: 4, max: Number.POSITIVE_INFINITY, read: (reading: Reading) => reading.doMgL },
  ph: { unit: 'pH', min: 6, max: 8, read: (reading: Reading) => reading.ph },
} as const;

function isWithinRange(timestamp: string, from: number, to: number) {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) && value >= from && value <= to;
}

export function calculateParameterStatistics(
  parameter: keyof typeof parameterDefinitions,
  readings: Reading[],
  thresholds: Threshold[],
): ParameterStatistics {
  const definition = parameterDefinitions[parameter];
  const threshold = thresholds.find((item) => item.parameter === parameter);
  const min = threshold?.min ?? definition.min;
  const max = threshold?.max ?? definition.max;
  const samples = readings
    .map((reading) => ({ timestamp: Date.parse(reading.timestamp), value: definition.read(reading) }))
    .filter((sample) => Number.isFinite(sample.timestamp) && Number.isFinite(sample.value))
    .sort((left, right) => left.timestamp - right.timestamp);
  if (!samples.length) {
    return {
      parameter,
      unit: definition.unit,
      min: null,
      max: null,
      mean: null,
      standardDeviation: null,
      percentInRange: null,
      excursions: 0,
      longestExcursionHours: 0,
      readings: 0,
    };
  }
  const values = samples.map((sample) => sample.value);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const standardDeviation = Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
  const inRange = (value: number) => value >= min && value <= max;
  let excursions = 0;
  let longestExcursionMs = 0;
  let currentExcursionMs = 0;
  samples.forEach((sample, index) => {
    const outside = !inRange(sample.value);
    if (outside && (index === 0 || inRange(samples[index - 1].value))) excursions += 1;
    if (!outside) {
      longestExcursionMs = Math.max(longestExcursionMs, currentExcursionMs);
      currentExcursionMs = 0;
      return;
    }
    const next = samples[index + 1];
    const interval = next ? next.timestamp - sample.timestamp : 0;
    currentExcursionMs += interval > 0 && interval <= 3.5 * 60 * 60 * 1000 ? interval : 0;
  });
  longestExcursionMs = Math.max(longestExcursionMs, currentExcursionMs);
  return {
    parameter,
    unit: definition.unit,
    min: Math.min(...values),
    max: Math.max(...values),
    mean,
    standardDeviation,
    percentInRange: values.filter(inRange).length / values.length * 100,
    excursions,
    longestExcursionHours: longestExcursionMs / 3_600_000,
    readings: values.length,
  };
}

export function buildReport(spec: ReportSpec, data: ReportData, generatedAt = new Date().toISOString()): ReportModel {
  const from = Date.parse(spec.from);
  const to = Date.parse(spec.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    throw new Error('Report date range is invalid.');
  }
  if (spec.tankIds.length === 0) throw new Error('Select at least one tank for the report.');
  const tankIds = new Set(spec.tankIds);
  const tanks = data.tanks.filter((tank) => tankIds.has(tank.id));
  if (tanks.length !== tankIds.size) throw new Error('One or more selected tanks could not be found.');
  const readings = data.readings.filter((reading) => tankIds.has(reading.tankId) && isWithinRange(reading.timestamp, from, to));
  const alerts = data.alerts.filter((alert) => tankIds.has(alert.tankId) && isWithinRange(alert.createdAt, from, to));
  const activityLogs = data.activityLogs.filter((log) => (log.tankId === 'hatchery' || tankIds.has(log.tankId)) && isWithinRange(log.occurredAt, from, to));
  const calibrationLogs = data.calibrationLogs.filter((log) => tankIds.has(log.tankId) && isWithinRange(log.date, from, to));
  const thresholds = data.thresholds;
  const statisticsRows = (['temperature', 'do', 'ph'] as const).map((parameter) => calculateParameterStatistics(parameter, readings, thresholds));
  const durationHours = (to - from) / 3_600_000;
  const expectedReadings = Math.max(0, (Math.floor(durationHours / 3) + 1) * tanks.length);
  const alertCounts = {
    warning: alerts.filter((alert) => alert.severity === 'warning').length,
    critical: alerts.filter((alert) => alert.severity === 'critical').length,
    open: alerts.filter((alert) => alert.status === 'open').length,
    acknowledged: alerts.filter((alert) => alert.status === 'acknowledged').length,
    resolved: alerts.filter((alert) => alert.status === 'resolved').length,
  };
  const safePercentages = statisticsRows.filter((item) => item.percentInRange !== null).map((item) => `${item.parameter} ${item.percentInRange!.toFixed(1)}%`);
  const summary = `${readings.length} readings and ${alerts.length} alerts were recorded for ${tanks.map((tank) => tank.name).join(', ')}. ` +
    `${alertCounts.critical} critical and ${alertCounts.warning} warning alerts; in-range reading percentages: ${safePercentages.join(', ') || 'not available'}.`;
  return {
    id: `HS-${generatedAt.replace(/\D/g, '').slice(0, 14)}-${tanks.map((tank) => tank.id).join('-')}`,
    sections: [...spec.sections],
    format: spec.format,
    generatedAt,
    generatedBy: spec.generatedBy,
    range: { from: spec.from, to: spec.to },
    tanks,
    thresholds,
    statistics: statisticsRows,
    alertCounts,
    alerts,
    advisories: Object.fromEntries(tanks.map((tank) => [tank.id, data.advisories[tank.id] ?? []])),
    activityLogs,
    calibrationLogs,
    validationRows: data.validationRows,
    deviceStatuses: data.deviceStatuses.filter((status) => tanks.some((tank) => tank.deviceId === status.deviceId)),
    dataQuality: {
      expectedReadings,
      receivedReadings: readings.length,
      receivedPercent: expectedReadings === 0 ? 0 : readings.length / expectedReadings * 100,
    },
    rawReadings: readings,
    summary,
  };
}
