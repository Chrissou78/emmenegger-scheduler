// frontend/src/i18n/translations.ts
// DEPRECATED — import from '@/i18n' or '@/i18n/index' instead.
// Kept for backward compatibility with pages that import { T } from './translations'

import { ALL_LANGUAGES, type LangCode } from './index';

// Re-export T with the same shape pages expect
export const T: Record<string, Record<string, any>> = ALL_LANGUAGES;

// Re-export themes and visual constants unchanged (these are NOT i18n)
export { themes, JOB_COLORS, ABS } from './visual';
