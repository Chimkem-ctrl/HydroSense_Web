import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadingCard } from './ReadingCard';

afterEach(cleanup);

const reading = {
  id: 'reading-1',
  tankId: 'tank-a',
  timestamp: '2025-01-01T00:00:00Z',
  temperature: 29.8,
  doMgL: 6,
  ph: 7.2,
};

describe('ReadingCard', () => {
  it('shows a labeled status, reading value, distance and configured safe range', () => {
    render(<ReadingCard parameter="temperature" reading={reading} threshold={{ parameter: 'temperature', min: 30, max: 32 }} />);
    expect(screen.getByRole('article', { name: 'Temperature reading' })).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('29.8 °C')).toBeInTheDocument();
    expect(screen.getByText('Safe 30–32°C')).toBeInTheDocument();
  });

  it('labels the display scale and clamps an out-of-range marker without changing status', () => {
    const { container } = render(<ReadingCard parameter="temperature" reading={reading} threshold={{ parameter: 'temperature', min: 30, max: 32 }} showRangeMeter />);
    expect(screen.getByText('Display scale 30–32 °C · marker at scale edge')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(container.querySelector('.reading-scale-track span')).toHaveStyle({ left: '0%' });
    expect(screen.getByText(/Updated .* PHT/)).toBeInTheDocument();
  });

  it('keeps the minimum-only DO threshold distinct from its display scale', () => {
    render(<ReadingCard parameter="do" reading={reading} showRangeMeter />);
    expect(screen.getByText('Safe ≥4 mg/L')).toBeInTheDocument();
    expect(screen.getByText('Display scale 0–8 mg/L')).toBeInTheDocument();
  });
});
