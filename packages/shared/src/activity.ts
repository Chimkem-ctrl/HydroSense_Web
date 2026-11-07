import type { ActivityLog, ManualEntry } from './types';

export const ACTIVITY_OPERATION_TYPES = [
  'Water change / exchange',
  'Manual water quality check',
  'Feeding',
  'Tank inspection',
  'Mortality observation',
  'Equipment maintenance',
  'Stocking / transfer',
  'Water treatment',
  'Freshwater dosing (log only)',
  'Other operation',
] as const;

export const ACTIVITY_EVENT_TYPES = [
  'Rainfall',
  'Unusually hot weather',
  'Power interruption',
  'Strong wind / storm',
  'Unusual water appearance',
  'Unusual fish behavior',
  'Other environmental event',
] as const;

export interface ActivityLogValidationIssue {
  field: string;
  message: string;
}

export function mapManualEntryToActivityLog(entry: ManualEntry): ActivityLog {
  const isSalinity = entry.type === 'refractometer_salinity';
  const isAmmonia = entry.type === 'ammonia_test_kit';
  const isRain = entry.type === 'rain_event';
  const isFreshwater = entry.type === 'freshwater_dosing';
  const hasManualMeasurement = isSalinity || isAmmonia;

  return {
    id: entry.id,
    tankId: entry.tankId,
    kind: isRain ? 'ENVIRONMENT' : 'OPERATION',
    type: isSalinity || isAmmonia
      ? 'Manual water quality check'
      : isRain
        ? 'Rainfall'
        : isFreshwater
          ? 'Freshwater dosing (log only)'
          : entry.type,
    occurredAt: entry.timestamp,
    operator: entry.enteredBy,
    notes: entry.note ?? (hasManualMeasurement ? 'Manual measurement recorded.' : 'Activity recorded.'),
    ...(isSalinity && entry.value !== undefined ? { manualReadings: { salinity: entry.value, method: 'Refractometer' } } : {}),
    ...(isAmmonia && entry.value !== undefined ? { manualReadings: { ammonia: entry.value, method: 'Ammonia test kit' } } : {}),
  };
}

export function validateActivityLog(entry: Partial<ActivityLog>): ActivityLogValidationIssue[] {
  const issues: ActivityLogValidationIssue[] = [];
  if (!entry.tankId?.trim()) issues.push({ field: 'tankId', message: 'Select a tank or hatchery-wide scope.' });
  if (entry.kind !== 'OPERATION' && entry.kind !== 'ENVIRONMENT') {
    issues.push({ field: 'kind', message: 'Select an operation or event.' });
  } else {
    const allowedTypes: readonly string[] = entry.kind === 'OPERATION' ? ACTIVITY_OPERATION_TYPES : ACTIVITY_EVENT_TYPES;
    if (!entry.type || !allowedTypes.includes(entry.type)) {
      issues.push({ field: 'type', message: 'Select an activity type.' });
    }
  }
  if (!entry.operator?.trim()) issues.push({ field: 'operator', message: 'The current user is required.' });
  if ((entry.notes ?? '').trim().length < 4) {
    issues.push({ field: 'notes', message: 'Add a short description so the next shift understands what happened.' });
  }
  if (entry.kind === 'OPERATION' && entry.type === 'Water change / exchange' &&
      (entry.waterChangePercent === undefined || !Number.isFinite(entry.waterChangePercent) ||
        entry.waterChangePercent <= 0 || entry.waterChangePercent > 100)) {
    issues.push({ field: 'waterChangePercent', message: 'Enter the water-change percentage (greater than 0 and no more than 100).' });
  }

  const readings = entry.manualReadings;
  if (readings) {
    const limits = {
      dissolvedOxygen: [0, 30],
      temperature: [-5, 60],
      ph: [0, 14],
      salinity: [0, 100],
      ammonia: [0, 100],
    } as const;
    const values = Object.entries(limits) as Array<[keyof typeof limits, readonly [number, number]]>;
    const entered = values.filter(([key]) => readings[key] !== undefined);
    if (entered.some(([key, [min, max]]) => {
      const value = readings[key];
      return value === undefined || !Number.isFinite(value) || value < min || value > max;
    })) {
      issues.push({ field: 'manualReadings', message: 'Check that each manual reading is within its allowed numeric range.' });
    }
    if (entry.kind === 'OPERATION' && entry.type === 'Manual water quality check' && entered.length === 0) {
      issues.push({ field: 'manualReadings', message: 'Enter at least one water-quality measurement from a manual instrument.' });
    }
  } else if (entry.kind === 'OPERATION' && entry.type === 'Manual water quality check') {
    issues.push({ field: 'manualReadings', message: 'Enter at least one water-quality measurement from a manual instrument.' });
  }
  return issues;
}
