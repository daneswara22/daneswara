'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = (localStorage.getItem('pos_theme') as Theme) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(saved);
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_theme', t);
      document.documentElement.classList.toggle('dark', t === 'dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => apply(theme === 'dark' ? 'light' : 'dark'), setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
