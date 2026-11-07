import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadingCard } from './ReadingCard';

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
});
