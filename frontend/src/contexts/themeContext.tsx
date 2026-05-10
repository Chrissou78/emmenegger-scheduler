// frontend/src/contexts/themeContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  type LangCode,
  ALL_LANG_CODES,
  DEFAULT_ENABLED_LANGS,
  DEFAULT_LANG,
  getTranslations,
  detectBrowserLang,
} from '../i18n';
import { themes } from '../i18n/visual';

/* ------------------------------------------------------------------ */
/*  Context types                                                      */
/* ------------------------------------------------------------------ */
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  th: Record<string, any>;  
  t: Record<string, any>;
  mode: 'dark' | 'light';
  lang: LangCode;
  setLanguage: (l: LangCode) => void;
  /** Languages currently enabled by the admin (stored in DB / localStorage) */
  enabledLangs: LangCode[];
  setEnabledLangs: (langs: LangCode[]) => void;
  /** The system default language (for new / guest users) */
  defaultLang: LangCode;
  setDefaultLang: (l: LangCode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* ------------------------------------------------------------------ */
/*  Re-export themes for backward compat                               */
/* ------------------------------------------------------------------ */
export { themes };

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */
export function ThemeProvider({ children }: { children: ReactNode }) {
  /* ---- theme ---- */
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : true;
  });

  /* ---- enabled languages (admin configurable) ---- */
  const [enabledLangs, setEnabledLangsState] = useState<LangCode[]>(() => {
    try {
      const saved = localStorage.getItem('enabledLangs');
      if (saved) {
        const parsed = JSON.parse(saved) as LangCode[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_ENABLED_LANGS;
  });

  /* ---- default language ---- */
  const [defaultLang, setDefaultLangState] = useState<LangCode>(() => {
    const saved = localStorage.getItem('defaultLang') as LangCode | null;
    if (saved && ALL_LANG_CODES.includes(saved)) return saved;
    return DEFAULT_LANG;
  });

  /* ---- active language ---- */
  const [lang, setLang] = useState<LangCode>(() => {
    const saved = localStorage.getItem('lang') as LangCode | null;
    if (saved && enabledLangs.includes(saved)) return saved;
    return detectBrowserLang(enabledLangs);
  });

  /* ---- persistence ---- */
  useEffect(() => { localStorage.setItem('theme', JSON.stringify(isDark)); }, [isDark]);
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('enabledLangs', JSON.stringify(enabledLangs)); }, [enabledLangs]);
  useEffect(() => { localStorage.setItem('defaultLang', defaultLang); }, [defaultLang]);

  /* If current lang gets disabled, fall back */
  useEffect(() => {
    if (!enabledLangs.includes(lang)) {
      setLang(enabledLangs[0] ?? DEFAULT_LANG);
    }
  }, [enabledLangs, lang]);

  const th = isDark ? themes.dark : themes.light;
  const t = getTranslations(lang);

  const setLanguage = (l: LangCode) => {
    if (enabledLangs.includes(l)) setLang(l);
  };

  const setEnabledLangs = (langs: LangCode[]) => {
    if (langs.length === 0) return; // guard
    setEnabledLangsState(langs);
  };

  const setDefaultLang = (l: LangCode) => {
    if (enabledLangs.includes(l)) {
      setDefaultLangState(l);
    }
  };

  return (
    <ThemeContext.Provider value={{
      isDark,
      toggleTheme: () => setIsDark(prev => !prev),
      th, t,
      mode: isDark ? 'dark' : 'light',
      lang,
      setLanguage,
      enabledLangs,
      setEnabledLangs,
      defaultLang,
      setDefaultLang,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
