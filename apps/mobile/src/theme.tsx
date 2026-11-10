import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { parseThemeChoice, resolveTheme } from './themePreference';
import type { ThemeChoice, ThemeMode } from './themePreference';

export type { ThemeChoice } from './themePreference';
export const THEME_KEY = 'hydrosense.mobile.theme';

export const palettes = {
  light: {
    ink: '#0b1b33', muted: '#41526e', surface: '#ffffff', canvas: '#eaf3ff',
    border: '#c4d2e8', teal: '#2563eb', warning: '#855000', critical: '#b51c1c',
    offline: '#fff3d4', selected: '#e5eeff', card: 'rgba(255,255,255,0.82)',
    cardBorder: '#ffffff', backgroundVia: '#dfeafe', backgroundTo: '#f3eefe',
    normal: '#146b35', overlay: 'rgba(5,11,26,0.65)', onPrimary: '#ffffff',
  },
  dark: {
    ink: '#eaf1ff', muted: '#b6c4e0', surface: '#182a54', canvas: '#050b1a',
    border: '#506588', teal: '#6aa2ff', warning: '#fcd34d', critical: '#fca5a5',
    offline: '#493b1e', selected: '#243d6d', card: '#122040',
    cardBorder: '#43567c', backgroundVia: '#0a1a38', backgroundTo: '#0b1030',
    normal: '#86efac', overlay: 'rgba(0,0,0,0.75)', onPrimary: '#ffffff',
  },
} as const;

export type Palette = { [K in keyof typeof palettes.light]: string };
interface ThemeValue {
  choice: ThemeChoice;
  mode: ThemeMode;
  colors: Palette;
  setChoice: (choice: ThemeChoice) => Promise<void>;
  error: string | null;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [error, setError] = useState<string | null>(null);
  const changed = useRef(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (active && !changed.current) setChoiceState(parseThemeChoice(value));
    }).catch((failure: unknown) => {
      console.error('Could not load appearance preference.', failure);
      if (active) setError('Could not load the saved appearance preference.');
    });
    return () => { active = false; };
  }, []);
  const setChoice = useCallback(async (next: ThemeChoice) => {
    changed.current = true;
    setChoiceState(next);
    setError(null);
    const write = writeQueue.current.then(() => AsyncStorage.setItem(THEME_KEY, next));
    writeQueue.current = write.catch(() => undefined);
    try {
      await write;
    } catch (failure) {
      console.error('Could not save appearance preference.', failure);
      setError('Could not save the appearance preference. It may reset after restarting.');
    }
  }, []);
  const mode = resolveTheme(choice, system);
  const value = useMemo(() => ({ choice, mode, colors: palettes[mode], setChoice, error }), [choice, mode, setChoice, error]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider.');
  return value;
}
