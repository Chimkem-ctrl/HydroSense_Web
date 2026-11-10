import { describe, expect, it } from 'vitest';
import { bottomBarRoutes, isBottomBarRoute } from './navigation';

describe('mobile bottom navigation', () => {
  it('shows only the five monitoring routes', () => {
    expect(bottomBarRoutes).toEqual(['Home', 'Alerts', 'Trends', 'History', 'Status']);
    expect(['Home', 'Alerts', 'Trends', 'History', 'Status', 'Review', 'Settings'].filter(isBottomBarRoute))
      .toEqual(bottomBarRoutes);
  });
});
