import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export const THEMES = {
  purple: {
    name: "Classic Omareyah",
    primary: "bg-indigo-600",
    secondary: "bg-indigo-50",
    text: "text-indigo-600",
    border: "border-indigo-100",
    accent: "ring-indigo-300",
    hover: "hover:bg-indigo-700",
    lightText: "text-indigo-500",
    bg: "bg-slate-50",
    card: "bg-white"
  },
  blue: {
    name: "Deep Sea",
    primary: "bg-blue-700",
    secondary: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-100",
    accent: "ring-blue-300",
    hover: "hover:bg-blue-800",
    lightText: "text-blue-500",
    bg: "bg-slate-50",
    card: "bg-white"
  },
  dark: {
    name: "Midnight Mode",
    primary: "bg-slate-800",
    secondary: "bg-slate-900",
    text: "text-slate-200",
    border: "border-slate-700",
    accent: "ring-slate-500",
    hover: "hover:bg-slate-700",
    lightText: "text-slate-400",
    bg: "bg-slate-950",
    card: "bg-slate-900"
  }
};

export type ThemeKey = keyof typeof THEMES;

interface ThemeContextType {
  theme: typeof THEMES[ThemeKey];
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>('purple');

  useEffect(() => {
    const saved = localStorage.getItem('omareyah_theme') as ThemeKey;
    if (saved && THEMES[saved]) {
      setThemeKey(saved);
    }
  }, []);

  const setTheme = (key: ThemeKey) => {
    setThemeKey(key);
    localStorage.setItem('omareyah_theme', key);
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
