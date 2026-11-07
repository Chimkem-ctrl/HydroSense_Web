import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdvisoryChip, Meter, SegmentedControl, StatusBadge, Tabs, Toggle } from './components';

afterEach(cleanup);

describe('glass design-system components', () => {
  it('labels measured status with text and an icon', () => {
    render(<StatusBadge level="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Critical').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('discloses advisory evidence without implying a sensor measurement', () => {
    render(<AdvisoryChip kind="Salinity" level="watch" explanation="Temperature reached the watch threshold." />);
    const summary = screen.getByText('Advisory · Salinity · watch');
    fireEvent.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Temperature reached the watch threshold.')).toBeInTheDocument();
    expect(screen.getByText('Advisory only — not a sensor measurement.')).toBeInTheDocument();
  });

  it('exposes and bounds the meter value', () => {
    render(<Meter label="Sample reading position" value={140} />);
    expect(screen.getByRole('meter', { name: 'Sample reading position' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('reports toggle changes and respects disabled choices', () => {
    const change = vi.fn();
    render(<><Toggle label="Notifications" checked={false} onChange={change} /><Toggle label="Unavailable" checked={false} onChange={change} disabled /></>);
    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }));
    screen.getByRole('switch', { name: 'Unavailable' }).click();
    expect(screen.getByRole('switch', { name: 'Unavailable' })).toBeDisabled();
    expect(change).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledWith(true);
  });

  it('identifies the active segmented option and reports selection', () => {
    const change = vi.fn();
    render(<SegmentedControl label="Range" value="day" onChange={change} options={[{ value: 'day', label: '24 hours' }, { value: 'week', label: '7 days' }]} />);
    expect(screen.getByRole('button', { name: '24 hours' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(change).toHaveBeenCalledWith('week');
  });

  it('navigates tabs with the keyboard and displays the selected panel', () => {
    function Example() {
      const [value, setValue] = useState('open');
      return <Tabs label="Alerts" value={value} onChange={setValue} options={[{ value: 'open', label: 'Open', content: 'Open alerts' }, { value: 'resolved', label: 'Resolved', content: 'Resolved alerts' }]} />;
    }
    render(<Example />);
    const first = screen.getByRole('tab', { name: 'Open' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Resolved' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Resolved' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Resolved alerts');
  });
});
