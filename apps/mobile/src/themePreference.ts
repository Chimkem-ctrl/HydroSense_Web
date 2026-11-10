export type ThemeChoice = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

export function resolveTheme(choice: ThemeChoice, system: 'light' | 'dark' | null | undefined): ThemeMode {
  return choice === 'system' ? system === 'dark' ? 'dark' : 'light' : choice;
}

export function parseThemeChoice(value: string | null): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}
