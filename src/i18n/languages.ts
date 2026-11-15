import languages from '../data/locales/languages.json';
import { preloadLocale } from './locales';

export type LangCode = 'en' | 'hi' | 'es' | 'fr' | 'pt-BR' | (string & {});

/** Supported languages. Add or swap a language by editing src/data/locales/languages.json plus its locale folder. */
export interface LanguageDef {
  code: LangCode;
  nativeName: string;
  englishName: string;
  /** Alias used by CLI scripts */
  label?: string;
  englishLabel?: string;
  /** BCP-47 tag used for <html lang> and pre-rendered TTS metadata. */
  bcp47: string;
  numberLocale: string;
  script?: string;
  dir?: 'ltr' | 'rtl';
}

export const DEFAULT_LANG: LangCode = 'en';
export const LANGUAGES: LanguageDef[] = languages.map((l) => ({
  ...l,
  label: l.nativeName,
  englishLabel: l.englishName,
  dir: 'ltr',
}));

export function getLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Supported language matching the browser's preferred languages, if any. */
export function browserLanguage(): string | null {
  if (typeof navigator === 'undefined') return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lower = tag?.toLowerCase().replace('_', '-');
    if (!lower) continue;
    const exact = LANGUAGES.find((l) => l.code.toLowerCase() === lower || l.bcp47.toLowerCase() === lower);
    if (exact) return exact.code;
    const base = lower.split('-')[0];
    const hit = LANGUAGES.find((l) => l.code.toLowerCase().split('-')[0] === base);
    if (hit) return hit.code;
  }
  return null;
}

/** Starts loading a language's text so switching screens doesn't flash English. */
export function preloadLanguage(code: string) {
  if (code !== DEFAULT_LANG) preloadLocale(code);
}
