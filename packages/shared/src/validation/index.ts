import type { AdvisoryRuleSettings, ManualEntry, MeasuredParameter, Role, ValidationTolerance } from '../types';

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validateManualEntry(entry: Partial<ManualEntry>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!entry.tankId) issues.push({ field: 'tankId', message: 'Select a tank.' });
  if (!entry.type) issues.push({ field: 'type', message: 'Select an entry type.' });
  if (!entry.enteredBy?.trim()) issues.push({ field: 'enteredBy', message: 'The current user is required.' });
  if ((entry.type === 'refractometer_salinity' || entry.type === 'ammonia_test_kit') &&
      (entry.value === undefined || !Number.isFinite(entry.value) || entry.value < 0)) {
    issues.push({ field: 'value', message: 'Enter a valid non-negative measurement.' });
  }
  if (entry.note !== undefined && entry.note.length > 500) {
    issues.push({ field: 'note', message: 'Notes must be 500 characters or fewer.' });
  }
  return issues;
}

export function validateAcknowledgeNote(note: string): ValidationIssue[] {
  if (note.trim().length < 3) return [{ field: 'note', message: 'Add a short note (at least 3 characters).' }];
  if (note.length > 500) return [{ field: 'note', message: 'Notes must be 500 characters or fewer.' }];
  return [];
}

export function validateThresholds(values: Record<MeasuredParameter, { min?: number; max?: number }>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  (Object.keys(values) as MeasuredParameter[]).forEach((parameter) => {
    const { min, max } = values[parameter];
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) {
      issues.push({ field: parameter, message: 'Thresholds must be valid numbers.' });
    } else if (min !== undefined && max !== undefined && min >= max) {
      issues.push({ field: parameter, message: 'Minimum must be lower than maximum.' });
    }
  });
  if (values.temperature.min === undefined || values.temperature.max === undefined ||
      values.do.min === undefined || values.ph.min === undefined || values.ph.max === undefined) {
    issues.push({ field: 'thresholds', message: 'Temperature, DO and pH require the configured threshold bounds.' });
  }
  return issues;
}

export function validateAdvisoryRules(values: AdvisoryRuleSettings): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(values.salinityWatchTemperatureC) || values.salinityWatchTemperatureC < 0) {
    issues.push({ field: 'salinityWatchTemperatureC', message: 'Salinity watch temperature must be a non-negative number.' });
  }
  if (!Number.isFinite(values.salinityHighTemperatureC) || values.salinityHighTemperatureC <= values.salinityWatchTemperatureC) {
    issues.push({ field: 'salinityHighTemperatureC', message: 'Salinity high temperature must exceed its watch temperature.' });
  }
  if (!Number.isFinite(values.ammoniaWatchTemperatureC) || values.ammoniaWatchTemperatureC < 0) {
    issues.push({ field: 'ammoniaWatchTemperatureC', message: 'Ammonia watch temperature must be a non-negative number.' });
  }
  if (!Number.isFinite(values.ammoniaHighPh) || values.ammoniaHighPh < 0 || values.ammoniaHighPh > 14) {
    issues.push({ field: 'ammoniaHighPh', message: 'Ammonia high-pH rule must be between 0 and 14.' });
  }
  return issues;
}

export function validateValidationTolerances(values: ValidationTolerance): ValidationIssue[] {
  return (Object.entries(values) as Array<[keyof ValidationTolerance, number]>)
    .filter(([, value]) => !Number.isFinite(value) || value < 0)
    .map(([parameter]) => ({ field: parameter, message: 'Tolerances must be finite, non-negative numbers.' }));
}

export function canAccessRole(userRole: Role | null, allowed: Role[]): boolean {
  return userRole !== null && allowed.includes(userRole);
}

export const DEFAULT_VALIDATION_TOLERANCES: ValidationTolerance = {
  temperature: 0.5,
  ph: 0.2,
  do: 0.5,
};
