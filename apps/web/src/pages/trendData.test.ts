import { describe, expect, it } from 'vitest';
import type { Reading } from '@hydrosense/shared';
import { nightRanges, prepareTrendRows } from './trendData';

function reading(timestamp: string): Reading {
  return { id: timestamp, tankId: 'tank-a', timestamp, temperature: 30, doMgL: 5, ph: 7 };
}

describe('trend chart data', () => {
  it('sorts readings and converts ISO timestamps to numeric chart coordinates', () => {
    const later = reading('2025-01-02T03:00:00+08:00');
    const earlier = reading('2025-01-02T00:00:00+08:00');
    const result = prepareTrendRows([later, earlier]);
    expect(result.rows).toEqual([earlier, later]);
    expect(result.chartRows.map((row) => row.timestamp)).toEqual([Date.parse(earlier.timestamp), Date.parse(later.timestamp)]);
  });

  it('includes the preceding overnight window when readings begin before 06:00 Manila time', () => {
    const rows = [reading('2025-01-02T03:00:00+08:00'), reading('2025-01-02T09:00:00+08:00')];
    expect(nightRanges(rows)).toEqual([{ x1: Date.parse('2025-01-01T22:00:00+08:00'), x2: Date.parse('2025-01-02T06:00:00+08:00') }]);
    expect(nightRanges([])).toEqual([]);
  });
});
