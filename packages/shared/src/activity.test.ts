import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_OPERATION_TYPES,
  mapManualEntryToActivityLog,
  validateActivityLog,
} from './activity';
import type { ManualEntry } from './types';

describe('activity log validation', () => {
  const validEntry = {
    tankId: 'tank-a',
    kind: 'OPERATION' as const,
    type: 'Water change / exchange',
    operator: 'Operator',
    notes: 'Changed water',
    waterChangePercent: 20,
  };

  it('requires valid notes and a water-change percentage greater than zero and at most 100', () => {
    expect(validateActivityLog({ ...validEntry, notes: 'No' })[0].message)
      .toBe('Add a short description so the next shift understands what happened.');
    expect(validateActivityLog({ ...validEntry, waterChangePercent: 0 })[0].message)
      .toBe('Enter the water-change percentage (greater than 0 and no more than 100).');
    expect(validateActivityLog({ ...validEntry, waterChangePercent: 100.1 })).toHaveLength(1);
    expect(validateActivityLog(validEntry)).toHaveLength(0);
  });

  it('requires an in-range manual reading for manual water quality checks', () => {
    const base = { ...validEntry, type: 'Manual water quality check', waterChangePercent: undefined };
    expect(validateActivityLog(base)[0].message)
      .toBe('Enter at least one water-quality measurement from a manual instrument.');
    expect(validateActivityLog({
      ...base,
      manualReadings: { ammonia: 101 },
    })[0].message).toBe('Check that each manual reading is within its allowed numeric range.');
    expect(validateActivityLog({
      ...base,
      manualReadings: { ammonia: 0.1, salinity: 30.2 },
    })).toHaveLength(0);
  });

  it('shares the operation and event choices with both logging forms', () => {
    expect(ACTIVITY_OPERATION_TYPES).toContain('Freshwater dosing (log only)');
    expect(ACTIVITY_EVENT_TYPES).toContain('Rainfall');
  });
});

describe('legacy measurement conversion', () => {
  it.each([
    {
      type: 'refractometer_salinity',
      value: 30.2,
      expected: { salinity: 30.2, method: 'Refractometer' },
    },
    {
      type: 'ammonia_test_kit',
      value: 0.1,
      expected: { ammonia: 0.1, method: 'Ammonia test kit' },
    },
  ] as const)('maps $type into a manual water-quality activity', ({ type, value, expected }) => {
    const entry: ManualEntry = {
      id: 'legacy-1',
      tankId: 'tank-a',
      type,
      value,
      unit: type === 'refractometer_salinity' ? 'ppt' : 'mg/L',
      timestamp: '2025-01-01T00:00:00.000Z',
      enteredBy: 'Operator',
      note: 'Morning check',
    };
    expect(mapManualEntryToActivityLog(entry)).toMatchObject({
      id: 'legacy-1',
      tankId: 'tank-a',
      kind: 'OPERATION',
      type: 'Manual water quality check',
      occurredAt: '2025-01-01T00:00:00.000Z',
      operator: 'Operator',
      notes: 'Morning check',
      manualReadings: expected,
    });
  });
});
