'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  // Kalıcılık: localStorage'dan oku, <html> class'ını ayarla
  useEffect(() => {
    const saved = (localStorage.getItem('panel_theme') as Theme) ?? 'light';
    setTheme(saved);
    document.documentElement.classList.toggle('dark-mode', saved === 'dark');
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('panel_theme', next);
      document.documentElement.classList.toggle('dark-mode', next === 'dark');
      return next;
    });
  };

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

// --- Renk paleti ---
const DARK = {
  bg:        '#0d1526',
  card:      '#162035',
  cardAlt:   '#1d2a3f',
  border:    'rgba(148,163,184,0.12)',
  text:      '#e2e8f0',
  secondary: '#94a3b8',
  muted:     '#64748b',
  blue:      '#60a5fa',
  green:     '#34d399',
  amber:     '#fbbf24',
  red:       '#f87171',
  orange:    '#fb923c',
  purple:    '#a78bfa',
  cyan:      '#22d3ee',
  sidebarBg: '#0f1a2e',
  sidebarBorder: 'rgba(148,163,184,0.10)',
};

const LIGHT = {
  bg:        '#f1f5f9',
  card:      '#ffffff',
  cardAlt:   '#f8fafc',
  border:    'rgba(15,23,42,0.08)',
  text:      '#0f172a',
  secondary: '#475569',
  muted:     '#94a3b8',
  blue:      '#2563eb',
  green:     '#059669',
  amber:     '#d97706',
  red:       '#dc2626',
  orange:    '#ea580c',
  purple:    '#7c3aed',
  cyan:      '#0891b2',
  sidebarBg: '#1e293b',
  sidebarBorder: 'rgba(255,255,255,0.08)',
};

export function useColors() {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}
