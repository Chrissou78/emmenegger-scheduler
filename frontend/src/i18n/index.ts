// frontend/src/i18n/index.ts

import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pl from './locales/pl.json';
import ro from './locales/ro.json';
import hr from './locales/hr.json';
import sq from './locales/sq.json';
import sr from './locales/sr.json';
import tr from './locales/tr.json';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type LangCode =
  | 'de' | 'en' | 'fr' | 'pt' | 'nl' | 'it' | 'es'
  | 'pl' | 'ro' | 'hr' | 'sq' | 'sr' | 'tr';

export interface LangMeta {
  code: LangCode;
  name: string;
  flag: string;
}

export const ALL_LANGUAGES: Record<LangCode, Record<string, any>> = {
  de, en, fr, pt, nl, it, es,
  pl, ro, hr, sq, sr, tr,
};

/** Metadata extracted from _meta key in each JSON file */
export const LANG_META: LangMeta[] = Object.values(ALL_LANGUAGES).map(
  (l) => l._meta as LangMeta
);

/** Ordered list of all available language codes */
export const ALL_LANG_CODES: LangCode[] = [
  'de', 'en', 'fr', 'pt', 'nl', 'it', 'es',
  'pl', 'ro', 'hr', 'sq', 'sr', 'tr',
];

/** Default enabled languages (if no settings from DB yet) */
export const DEFAULT_ENABLED_LANGS: LangCode[] = ['de', 'en', 'fr', 'pt'];

export const DEFAULT_LANG: LangCode = 'de';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns translations for a given language code.
 * Falls back to German if the code is unknown.
 */
export function getTranslations(lang: LangCode): Record<string, any> {
  return ALL_LANGUAGES[lang] ?? ALL_LANGUAGES.de;
}

/**
 * Detects the best matching supported language from the browser.
 * Respects the enabledLangs list.
 */
export function detectBrowserLang(enabledLangs?: LangCode[]): LangCode {
  const allowed = enabledLangs ?? ALL_LANG_CODES;
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const raw of candidates) {
    const code = raw.toLowerCase();
    if (allowed.includes(code as LangCode)) return code as LangCode;
    const prefix = code.split('-')[0] as LangCode;
    if (allowed.includes(prefix)) return prefix;
  }

  // Fallback: first enabled lang, or 'de'
  return allowed[0] ?? 'de';
}

/**
 * Gets flag emoji for a language code
 */
export function getLangFlag(code: LangCode): string {
  return ALL_LANGUAGES[code]?._meta?.flag ?? '';
}

/**
 * Gets display name for a language code
 */
export function getLangName(code: LangCode): string {
  return ALL_LANGUAGES[code]?._meta?.name ?? code;
}
