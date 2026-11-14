import { useEffect, useSyncExternalStore } from 'react';

/**
 * Lazy per-language locale loader. Locale files live in src/data/locales/<lang>/{ui,missions}.json
 * and are picked up by glob, so a new language needs no code changes.
 */
export type UiDict = Record<string, string>;

export interface MissionLocale {
  meta?: { title?: string; disclaimer?: string; creditsNote?: string };
  photos?: Record<string, string>;
  panels?: Record<string, Record<string, string>>;
  comicPanels?: Record<string, { caption?: string; dialogue?: string }>;
  longPanels?: Record<string, { caption?: string; dialogue?: string }>;
  /** Motion-comic panels, keyed by panel id (p01…), then line id. */
  comic?: Record<string, { stamp?: string; lines?: Record<string, string> }>;
  artifact?: Record<string, string>;
  [field: string]: unknown;
}
export type MissionsDict = Record<string, MissionLocale>;

type Kind = 'ui' | 'missions';

const loaders: Record<Kind, Record<string, () => Promise<unknown>>> = {
  ui: import.meta.glob('../data/locales/*/ui.json', { import: 'default' }),
  missions: import.meta.glob('../data/locales/*/missions.json', { import: 'default' }),
};

const cache = new Map<string, unknown>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function key(kind: Kind, lang: string) {
  return `${kind}:${lang}`;
}

function load(kind: Kind, lang: string) {
  const k = key(kind, lang);
  if (cache.has(k) || pending.has(k)) return;
  const loader = loaders[kind][`../data/locales/${lang}/${kind}.json`];
  if (!loader) {
    cache.set(k, {});
    listeners.forEach((l) => l());
    return;
  }
  pending.add(k);
  loader()
    .then((d) => cache.set(k, d ?? {}))
    .catch(() => cache.set(k, {}))
    .finally(() => {
      pending.delete(k);
      listeners.forEach((l) => l());
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Returns the dictionary once loaded, or undefined while loading. */
export function useLocaleDict<T>(kind: Kind, lang: string): T | undefined {
  useEffect(() => load(kind, lang), [kind, lang]);
  return useSyncExternalStore(subscribe, () => cache.get(key(kind, lang)) as T | undefined);
}

export function preloadLocale(lang: string) {
  load('ui', lang);
  load('missions', lang);
}

/** For build scripts (Node) that cannot use import.meta.glob. */
export function hasLocale(kind: Kind, lang: string) {
  return Boolean(loaders[kind][`../data/locales/${lang}/${kind}.json`]);
}
