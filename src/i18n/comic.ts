import type { ComicIssue, ComicIssueMeta, ComicPanel, Line } from '../data/comics/opportunity-spirit';
import type { MissionsDict } from './locales';
import { DEFAULT_LANG } from './languages';

/** Looks up a dotted key ("opportunity.comic.p01.lines.p01-c1") in a locale dictionary. */
export function resolveKey(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' && cur.trim() ? cur : undefined;
}

export interface NarratedLine extends Line {
  /** Language the text is actually in (English when the translation is missing). */
  textLang: string;
  /** "narrator" or a character id (lower case). */
  voice: string;
  textKey: string;
}

export interface LocalizedPanel extends Omit<ComicPanel, 'lines'> {
  lines: NarratedLine[];
  /** True when a translation is missing and this panel falls back to English ("EN" tag). */
  untranslated: boolean;
}

export interface LocalizedIssue {
  meta: ComicIssueMeta;
  panels: LocalizedPanel[];
}

export function lineTextKey(missionId: string, panelId: string, line: Line): string {
  return line.narration?.textKey ?? `${missionId}.comic.${panelId}.lines.${line.id}`;
}

export function lineVoice(line: Line): string {
  if (line.narration?.speaker) return line.narration.speaker;
  return line.kind === 'speech' && line.speaker ? line.speaker.toLowerCase() : 'narrator';
}

/**
 * Applies a locale dictionary to a motion comic. Missing strings fall back to the English
 * source, never to blank. `dict` undefined means "still loading": English, no EN tag yet.
 */
export function localizeIssue(issue: ComicIssue, lang: string, dict: MissionsDict | undefined, issueWord?: string): LocalizedIssue {
  const mid = issue.missionId ?? '';
  const loc = dict?.[mid];
  const isEn = lang === DEFAULT_LANG;
  const pick = (key: string, fallback: string) => (isEn ? undefined : resolveKey(dict, key)) ?? fallback;

  const meta: ComicIssueMeta = loc?.meta
    ? {
        ...issue.meta,
        title: pick(`${mid}.meta.title`, issue.meta.title),
        disclaimer: pick(`${mid}.meta.disclaimer`, issue.meta.disclaimer),
        creditsNote: pick(`${mid}.meta.creditsNote`, issue.meta.creditsNote),
      }
    : issue.meta;

  const panels = issue.panels.map((p): LocalizedPanel => {
    let missing = false;
    const lines = p.lines.map((l): NarratedLine => {
      const textKey = lineTextKey(mid, p.id, l);
      const t = isEn ? undefined : resolveKey(dict, textKey);
      if (!isEn && dict && !t) missing = true;
      return { ...l, text: t ?? l.text, textLang: t ? lang : DEFAULT_LANG, voice: lineVoice(l), textKey };
    });
    return {
      ...p,
      stamp: pick(`${mid}.comic.${p.id}.stamp`, p.stamp),
      introBanner: p.introBanner && {
        title: `${issueWord ? issue.meta.issueCode.replace(/^\D+/, `${issueWord} `) : issue.meta.issueCode} · ${meta.title}`,
        disclaimer: meta.disclaimer,
      },
      lines,
      untranslated: missing,
    };
  });
  return { meta, panels };
}
