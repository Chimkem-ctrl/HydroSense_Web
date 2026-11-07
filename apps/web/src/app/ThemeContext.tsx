import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
const themeKey = 'hydrosense.theme';
const ThemeContext = createContext<{ choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void } | null>(null);

function readChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(themeKey);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch (error) {
    console.warn('Theme preference could not be loaded:', error);
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    };
    apply();
    try { window.localStorage.setItem(themeKey, choice); }
    catch (error) { console.warn('Theme preference could not be saved:', error); }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
  return <ThemeContext.Provider value={{ choice, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider.');
  return value;
}
