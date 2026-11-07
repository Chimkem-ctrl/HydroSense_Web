import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.removeItem('hydrosense.theme');
  delete document.documentElement.dataset.theme;
});

function Choice() {
  const { choice, setChoice } = useTheme();
  return <button type="button" onClick={() => setChoice('light')}>{choice}</button>;
}

describe('dashboard theme', () => {
  it('defaults to the system preference and responds to system changes', () => {
    let dark = true;
    let change: (() => void) | undefined;
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return dark; },
      addEventListener: (_type: string, callback: () => void) => { change = callback; },
      removeEventListener: vi.fn(),
    }));
    render(<ThemeProvider><Choice /></ThemeProvider>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('hydrosense.theme')).toBe('system');
    dark = false;
    change?.();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('retains explicit choices instead of following the system', () => {
    window.localStorage.setItem('hydrosense.theme', 'dark');
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<ThemeProvider><Choice /></ThemeProvider>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('hydrosense.theme')).toBe('light');
  });
});
