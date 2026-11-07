import { describe, expect, it } from 'vitest';
import { activityLogCsv } from './activityLogs';
import type { ActivityLog } from '@hydrosense/shared';

describe('activity log CSV export', () => {
  it('uses Manila timestamps and escapes formula-like cell values', () => {
    const logs: ActivityLog[] = [{
      id: 'log-1',
      tankId: 'tank-a',
      kind: 'OPERATION',
      type: 'Feeding',
      occurredAt: '2025-01-01T16:30:00.000Z',
      operator: '=HYPERLINK("https://example.test")',
      notes: '@SUM(1,2)',
    }];

    const csv = activityLogCsv(logs, [{
      id: 'tank-a',
      name: '+Tank A',
      site: 'Sagay',
      rearingStartDate: '2025-01-01',
      deviceId: 'HS-001',
    }]);

    expect(csv).toContain('"Jan 2, 2025, 12:30 AM"');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain('"\'@SUM(1,2)"');
    expect(csv).toContain(`"'+Tank A"`);
  });
});
