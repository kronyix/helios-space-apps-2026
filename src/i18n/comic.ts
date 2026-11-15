import type {
  ComicIssue,
  ComicIssueMeta,
  ComicPanel,
  Line,
  Photo,
} from '../data/comics/opportunity-spirit';
import type { MissionsDict } from './locales';
import { narrator } from '../narration/narrator';

export interface NarratedLine extends Line {
  /** Speaker id for voice lookup ('narrator', 'spirit', 'opportunity', 'eagle', 'columbia', 'ingenuity'). */
  voice: string;
  /** Language code of `text` (falls back to 'en' when a translation is missing). */
  textLang: string;
}

export interface LocalizedPanel extends Omit<ComicPanel, 'lines'> {
  lines: NarratedLine[];
  /** True when `lang !== 'en'` and this panel has no translated lines yet. */
  untranslated?: boolean;
}

export interface LocalizedIssue {
  missionId?: string;
  meta: ComicIssueMeta;
  panels: LocalizedPanel[];
}

/**
 * Pace = actual audio clip duration + 250ms inter-line gap.
 */
export const NARRATION_GAP_MS = 250;

function speakerFor(line: Line): string {
  if (line.narration?.speaker) return line.narration.speaker.toLowerCase();
  if (line.kind === 'caption') return 'narrator';
  return (line.speaker ?? 'narrator').toLowerCase();
}

/**
 * Localizes a ComicIssue into `lang` and merges pre-generated audio durations
 * (`durationMs + 250ms` gap) from the narration manifest for the active language
 * so Play mode and scroll breakpoints follow the real audio across all 3 issues.
 */
export function localizeIssue(
  issue: ComicIssue,
  lang: string,
  dict?: MissionsDict,
  issueWord = 'ISSUE',
): LocalizedIssue {
  const missionId = issue.missionId ?? 'opportunity';
  const mLoc = lang === 'en' ? undefined : dict?.[missionId];

  const num = issue.meta.issueCode.replace(/^\D+/, '');
  const meta: ComicIssueMeta = {
    ...issue.meta,
    issueCode: num ? `${issueWord} ${num}` : issue.meta.issueCode,
    title: mLoc?.meta?.title ?? issue.meta.title,
    disclaimer: mLoc?.meta?.disclaimer ?? issue.meta.disclaimer,
    creditsNote: mLoc?.meta?.creditsNote ?? issue.meta.creditsNote,
  };

  const panels: LocalizedPanel[] = issue.panels.map((p) => {
    const pLoc = mLoc?.comic?.[p.id];
    const stamp = pLoc?.stamp ?? p.stamp;

    let anyTranslated = lang === 'en';
    const lines: NarratedLine[] = p.lines.map((l) => {
      const translatedText = pLoc?.lines?.[l.id];
      if (translatedText) anyTranslated = true;
      const textLang = translatedText ? lang : 'en';
      const text = translatedText ?? l.text;
      const clipDurationMs = narrator.getDurationMs(missionId, l.id, textLang);
      const audio =
        clipDurationMs !== undefined && clipDurationMs > 0
          ? {
              src: `/audio/${textLang}/${missionId}/${l.id}.mp3`,
              durationMs: clipDurationMs + NARRATION_GAP_MS,
            }
          : l.audio;

      return {
        ...l,
        text,
        textLang,
        voice: speakerFor(l),
        audio,
      };
    });

    const photos: Photo[] = p.photos.map((ph) => {
      const cap = mLoc?.photos?.[ph.id];
      return cap ? { ...ph, caption: cap } : ph;
    });

    const introBanner =
      p.introBanner && (mLoc?.meta?.title || mLoc?.meta?.disclaimer)
        ? {
            title: mLoc?.meta?.title ?? p.introBanner.title,
            disclaimer: mLoc?.meta?.disclaimer ?? p.introBanner.disclaimer,
          }
        : p.introBanner;

    return {
      ...p,
      stamp,
      introBanner,
      lines,
      photos,
      untranslated: lang !== 'en' && !anyTranslated,
    };
  });

  return {
    missionId,
    meta,
    panels,
  };
}
