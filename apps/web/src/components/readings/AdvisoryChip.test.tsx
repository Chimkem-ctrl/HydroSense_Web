import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../app/api';
import { AdvisoryChip } from './AdvisoryChip';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AdvisoryChip', () => {
  it('separates the fired rule from seven-day trend and activity context', async () => {
    const now = Date.now();
    const timestamp = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
    vi.spyOn(api, 'listReadings').mockResolvedValue([
      { id: 'later', tankId: 'tank-a', timestamp: timestamp(3), temperature: 31, doMgL: 5, ph: 7.4 },
      { id: 'earlier', tankId: 'tank-a', timestamp: timestamp(6), temperature: 30, doMgL: 6, ph: 7.2 },
      { id: 'other', tankId: 'tank-b', timestamp: timestamp(3), temperature: 40, doMgL: 5, ph: 8 },
    ]);
    vi.spyOn(api, 'listActivityLogs').mockResolvedValue([
      { id: 'rain', tankId: 'hatchery', kind: 'ENVIRONMENT', type: 'Rainfall', occurredAt: timestamp(12), operator: 'Operator', notes: 'Rain recorded.' },
      { id: 'manual', tankId: 'tank-a', kind: 'OPERATION', type: 'Manual water quality check', occurredAt: timestamp(6), operator: 'Operator', notes: 'Sample taken.', manualReadings: { salinity: 30, method: 'Refractometer' } },
      { id: 'old', tankId: 'tank-a', kind: 'OPERATION', type: 'Feeding', occurredAt: timestamp(200), operator: 'Operator', notes: 'Old event.' },
      { id: 'other', tankId: 'tank-b', kind: 'OPERATION', type: 'Feeding', occurredAt: timestamp(3), operator: 'Operator', notes: 'Other tank event.' },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdvisoryChip tankId="tank-a" advisory={{
      kind: 'salinity',
      level: 'watch',
      inputs: { temperatureC: 31, recentRainEvent: 'no' },
      firedRule: 'Temperature at or above the watch threshold',
      updatedAt: '2025-01-01T00:00:00Z',
    }} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Advisory · Salinity · Watch' }));
    const dialog = screen.getByRole('dialog', { name: 'Why Salinity advisory is Watch' });
    expect(screen.getByText('Reference target: 28–33 ppt. This target is not a sensor measurement.')).toBeInTheDocument();
    expect(screen.getByText('Temperature at or above the watch threshold')).toBeInTheDocument();
    expect(screen.getByText('Advisory only — not a sensor measurement.')).toBeInTheDocument();
    expect(await screen.findByText('Temperature: 30.0 to 31.0 °C; observed range 30.0–31.0 °C.')).toBeInTheDocument();
    expect(screen.getByText(/These observations provide context only/)).toBeInTheDocument();
    expect(screen.getByText('Rainfall').closest('li')).toHaveTextContent('Hatchery-wide');
    expect(screen.getByText('Manual salinity: 30 ppt · Refractometer')).toBeInTheDocument();
    expect(screen.queryByText('Old event.')).not.toBeInTheDocument();
    expect(screen.queryByText('Other tank event.')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close explanation' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advisory · Salinity · Watch' })).toHaveFocus();
  });

  it('surfaces failures to load contextual data without changing the advisory level', async () => {
    vi.spyOn(api, 'listReadings').mockRejectedValue(new Error('Readings unavailable'));
    vi.spyOn(api, 'listActivityLogs').mockRejectedValue(new Error('Logs unavailable'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdvisoryChip tankId="tank-a" advisory={{
      kind: 'ammonia', level: 'low', inputs: { ph: 7 }, firedRule: 'Existing rule', updatedAt: '2025-01-01T00:00:00Z',
    }} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Advisory · Ammonia · Low' }));
    expect(await screen.findByText('Readings unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Logs unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advisory · Ammonia · Low' })).toBeInTheDocument();
    expect(screen.getByText('Existing rule')).toBeInTheDocument();
  });
});
