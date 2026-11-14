import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLocaleDict, type UiDict } from './locales';
import EN from '../data/locales/en/ui.json';

const en: UiDict = EN;

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}

/** Interface text: current language, then English, then the key itself. */
export function useT(): TFunc {
  const lang = useAppStore((s) => s.lang);
  const dict = useLocaleDict<UiDict>('ui', lang);
  return useCallback<TFunc>((k, vars) => fill(dict?.[k] ?? en[k] ?? k, vars), [dict]);
}
