import { describe, expect, it } from 'vitest';
import { canAccess } from './access';

describe('mobile role access', () => {
  it('matches the web access matrix for restricted mobile views', () => {
    const features = ['history', 'thresholds', 'validation', 'admin'] as const;
    expect(features.map((feature) => canAccess('operator', feature))).toEqual([false, false, false, false]);
    expect(features.map((feature) => canAccess('manager', feature))).toEqual([true, true, true, false]);
    expect(features.map((feature) => canAccess('admin', feature))).toEqual([true, true, true, true]);
    expect(canAccess(null, 'admin')).toBe(false);
  });
});
