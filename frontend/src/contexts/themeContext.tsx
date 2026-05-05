import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeColors {
  bg: string;
  bgCard: string;
  bgHeader: string;
  gold: string;
  goldDim: string;
  goldFaint: string;
  goldGhost: string;
  text: string;
  textMuted: string;
  textDim: string;
  textGhost: string;
  border: string;
  borderFaint: string;
  rowHover: string;
  cellHover: string;
  empName: string;
  empNameSel: string;
  modalBg: string;
  modalCard: string;
  btnBg: string;
  btnBgHover: string;
  scrollThumb: string;
  toastBg: string;
  toastErrBg: string;
  toastText: string;
  toastErrText: string;
  toastBorder: string;
  toastErrBorder: string;
  statColors: string[];
  switchBg: string;
  switchActive: string;
  roleV: string;
  roleM: string;
  logoRotateBorder: string;
  emptyJobBg: string;
  emptyJobText: string;
  legendCountActive: string;
  legendCountInactive: string;
  legendItemBg: string;
}

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  th: ThemeColors;
  t: any;
  mode?: string;
  lang?: string;
  setLanguage?: (lang: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(isDark));
  }, [isDark]);

  const themes = {
    dark: {
      bg: '#0a0a0a',
      bgCard: '#1a1a1a',
      bgHeader: '#0f0f0f',
      gold: '#d4af37',
      goldDim: '#b8941f',
      goldFaint: '#8b7c1f',
      goldGhost: '#2a2415',
      text: '#ffffff',
      textMuted: '#b0b0b0',
      textDim: '#707070',
      textGhost: '#404040',
      border: '#333333',
      borderFaint: '#222222',
      primary: '#d4af37',
      cellHover: '#1a1a2e',
      rowHover: '#161625',
      switchActive: '#2a2a3e',
      headerBg: '#0f0f0f',
      buttonBg: '#1a1a1a',
      buttonBgHover: '#252525',
      modalBg: 'rgba(0,0,0,0.7)',
      modalCard: '#1a1a1a',
      toastBg: '#2a2a2a',
      toastText: '#ffffff',
      toastBorder: '#444444',
      toastErrBg: '#4d1a1a',
      toastErrText: '#ff6b6b',
      toastErrBorder: '#8b3333',
      scrollThumb: '#555555',
      empName: '#ffffff',
      empNameSel: '#d4af37',
      roleV: '#4ecdc4',
      roleM: '#ff6b9d',
      legendItemBg: '#1a1a1a',
      legendCountActive: '#d4af37',
      legendCountInactive: '#707070',
      btnBg: '#2a2a2a',
      btnBgHover: '#3a3a3a',
      switchBg: '#1a1a1a',
      logoRotateBorder: '#d4af37',
      toast: '#333333',
      legend: '#1a1a1a',
      legendText: '#ffffff',
      emptyJobBg: '#333333',
      emptyJobText: '#999999',
      statColors: ['#d4af37', '#4ecdc4', '#ff6b9d', '#95e1d3'],
    } as ThemeColors,
    light: {
      bg: '#ffffff',
      bgCard: '#f5f5f5',
      bgHeader: '#ffffff',
      gold: '#c9a961',
      goldDim: '#9d7f3e',
      goldFaint: '#d4af37',
      goldGhost: '#f0e6d2',
      text: '#000000',
      textMuted: '#666666',
      textDim: '#999999',
      textGhost: '#cccccc',
      border: '#dddddd',
      borderFaint: '#eeeeee',
      primary: '#c9a961',
      cellHover: '#f0f0f0',
      rowHover: '#f8f8f8',
      switchActive: '#e8e8e8',
      headerBg: '#ffffff',
      buttonBg: '#f5f5f5',
      buttonBgHover: '#e8e8e8',
      modalBg: 'rgba(0,0,0,0.5)',
      modalCard: '#ffffff',
      toastBg: '#f8f8f8',
      toastText: '#000000',
      toastBorder: '#dddddd',
      toastErrBg: '#f8d7da',
      toastErrText: '#721c24',
      toastErrBorder: '#f5c6cb',
      scrollThumb: '#cccccc',
      empName: '#000000',
      empNameSel: '#c9a961',
      roleV: '#2c9b8b',
      roleM: '#d85b8f',
      legendItemBg: '#f5f5f5',
      legendCountActive: '#c9a961',
      legendCountInactive: '#999999',
      btnBg: '#f5f5f5',
      btnBgHover: '#e0e0e0',
      switchBg: '#ffffff',
      logoRotateBorder: '#c9a961',
      toast: '#f5f5f5',
      legend: '#ffffff',
      legendText: '#000000',
      emptyJobBg: '#f0f0f0',
      emptyJobText: '#cccccc',
      statColors: ['#c9a961', '#2c9b8b', '#d85b8f', '#7ac74f'],
    } as ThemeColors,
  };

  const translations = {
    de: {
      brand: 'Emmenegger',
      sub: 'Disposition & Planung',
      employees: 'Mitarbeiter',
      assignments: 'Zuweisungen',
      absences: 'Absenzen',
      objects: 'Objekte',
      today: 'Heute',
      days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    },
  };

  const th = isDark ? themes.dark : themes.light;
  const t = translations.de;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(!isDark), th, t, mode: isDark ? 'dark' : 'light', lang: 'de' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
