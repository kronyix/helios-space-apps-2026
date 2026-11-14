import languages from '../data/locales/languages.json';
import { preloadLocale } from './locales';

/** Supported languages. Add a language by adding an entry here (data) plus its locale folder. */
export interface LanguageDef {
  code: string;
  nativeName: string;
  englishName: string;
  /** BCP-47 tag used for <html lang>, speech voices and TTS. */
  bcp47: string;
  numberLocale: string;
  script?: string;
  /** Build-time TTS voices (scripts/generate-narration.ts). Unknown characters use the narrator. */
  tts?: { narrator: TtsVoice; characters?: Record<string, TtsVoice> };
}

export interface TtsVoice {
  name: string;
  /** Semitones, -20..20. */
  pitch?: number;
}

export const DEFAULT_LANG = 'en';
export const LANGUAGES: LanguageDef[] = languages;

export function getLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Supported language matching the browser's preferred languages, if any. */
export function browserLanguage(): string | null {
  if (typeof navigator === 'undefined') return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0];
    const hit = LANGUAGES.find((l) => l.code === base);
    if (hit) return hit.code;
  }
  return null;
}

/** Starts loading a language's text so switching screens doesn't flash English. */
export function preloadLanguage(code: string) {
  if (code !== DEFAULT_LANG) preloadLocale(code);
}
