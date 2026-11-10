import { describe, expect, it } from 'vitest';
import { parseThemeChoice, resolveTheme } from './themePreference';

describe('appearance preference', () => {
  it('accepts saved choices and defaults invalid or absent values to system', () => {
    expect(['system', 'light', 'dark', null, 'invalid'].map(parseThemeChoice))
      .toEqual(['system', 'light', 'dark', 'system', 'system']);
  });

  it('follows device changes in system mode and respects explicit overrides', () => {
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });
});
