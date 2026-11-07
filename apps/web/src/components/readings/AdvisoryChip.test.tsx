import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdvisoryChip } from './AdvisoryChip';

describe('AdvisoryChip', () => {
  it('explains the evidence and fired rule without presenting a sensor measurement', () => {
    render(<AdvisoryChip advisory={{
      kind: 'salinity',
      level: 'watch',
      inputs: { temperatureC: 31, recentRainEvent: 'no' },
      firedRule: 'Temperature at or above the watch threshold',
      updatedAt: '2025-01-01T00:00:00Z',
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Advisory · Salinity · Watch' }));
    expect(screen.getByRole('dialog', { name: 'Why Salinity advisory is Watch' })).toBeInTheDocument();
    expect(screen.getByText('Reference target: 28–33 ppt. This target is not a sensor measurement.')).toBeInTheDocument();
    expect(screen.getByText('Temperature at or above the watch threshold')).toBeInTheDocument();
    expect(screen.getByText('Advisory only — not a sensor measurement.')).toBeInTheDocument();
  });
});
