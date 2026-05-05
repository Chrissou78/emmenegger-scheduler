import { createContext, useContext, useState, ReactNode } from 'react';
import { T, themes } from '../i18n/translations';

type Theme = 'dark' | 'light';
type Language = 'de' | 'en' | 'fr' | 'pt';

interface ThemeContextType {
  mode: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (typeof T)['de'];
  th: (typeof themes)['dark'];
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>('de');

  const t = T[lang];
  const th = themes[mode];
  const isDark = mode === 'dark';

  return (
    <ThemeContext.Provider value={{
      mode,
      lang,
      toggleTheme: () => setMode(m => m === 'dark' ? 'light' : 'dark'),
      setLanguage: setLang,
      t,
      th,
      isDark,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
