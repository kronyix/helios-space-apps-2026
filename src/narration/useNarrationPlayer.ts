import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { setSoundEnabled } from '../lib/audio';
import type { LocalizedPanel, NarratedLine } from '../i18n/comic';
import { narrator, useVoicesVersion } from './narrator';
import type { SpeakLine } from './VoiceProvider';

interface Options {
  missionId: string;
  panels: LocalizedPanel[];
  activeIndex: number;
  /** False while the selected language's text is still loading. */
  ready: boolean;
  reduced: boolean;
  /** Scrolls so that line `lineIdx` of panel `panelIdx` is on screen. */
  revealLine: (panelIdx: number, lineIdx: number) => void;
  jumpToPanel: (panelIdx: number) => void;
}

export type NarrationStatus =
  | { kind: 'idle' }
  | { kind: 'reading'; panel: number }
  | { kind: 'paused' }
  | { kind: 'done' }
  | { kind: 'unavailable' };

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

const toSpeak = (missionId: string, panelId: string, l: NarratedLine): SpeakLine => ({
  missionId,
  panelId,
  id: l.id,
  text: l.text,
  voice: l.voice,
});

/**
 * Reads the active panel aloud, line by line, highlighting each line (store.currentLineId).
 * Stops on unmount, mute, panel change by the user, or language change (then resumes the
 * same line in the new language).
 */
export function useNarrationPlayer({ missionId, panels, activeIndex, ready, reduced, revealLine, jumpToPanel }: Options) {
  const { lang, rate, autoAdvance, narrationOn, textOnly, soundOn } = useAppStore(
    useShallow((s) => ({
      lang: s.lang,
      rate: s.rate,
      autoAdvance: s.autoAdvance,
      narrationOn: s.narrationOn,
      textOnly: s.textOnly,
      soundOn: s.soundOn,
    })),
  );
  const setCurrentLine = useAppStore((s) => s.setCurrentLine);
  const setSound = useAppStore((s) => s.setSound);
  useVoicesVersion();

  const voiceAvailable = narrator.isAvailable(lang);
  const canNarrate = narrationOn && !textOnly && voiceAvailable;

  const [narrating, setNarrating] = useState(false);
  const [status, setStatus] = useState<NarrationStatus>({ kind: 'idle' });
  const pos = useRef({ panel: 0, line: 0 });

  // Latest values for the async loop, without restarting it.
  const live = useRef({ panels, autoAdvance, revealLine, jumpToPanel, reduced });
  live.current = { panels, autoAdvance, revealLine, jumpToPanel, reduced };

  const stop = useCallback((kind: NarrationStatus['kind'] = 'paused') => {
    setNarrating(false);
    setStatus({ kind } as NarrationStatus);
  }, []);

  const start = useCallback(() => {
    if (!canNarrate) return;
    if (!soundOn) {
      // Pressing Play is an explicit request for audio.
      setSoundEnabled(true);
      setSound(true);
    }
    const p = pos.current;
    if (p.panel !== activeIndex) pos.current = { panel: activeIndex, line: 0 };
    setNarrating(true);
  }, [activeIndex, canNarrate, setSound, soundOn]);

  const toggle = useCallback(() => (narrating ? stop() : start()), [narrating, start, stop]);

  // The read loop. Restarts the current line when the language or speed changes.
  useEffect(() => {
    if (!narrating || !ready) return;
    let cancelled = false;
    (async () => {
      let { panel: pi, line: li } = pos.current;
      while (!cancelled) {
        const { panels: ps } = live.current;
        const panel = ps[pi];
        if (!panel) break;
        setStatus({ kind: 'reading', panel: pi });
        const next = ps[pi + 1];
        narrator.preload(
          [panel, next].flatMap((p) => (p ? p.lines.map((l) => ({ line: toSpeak(missionId, p.id, l), lang: l.textLang })) : [])),
        );
        for (; li < panel.lines.length; li++) {
          pos.current = { panel: pi, line: li };
          const l = panel.lines[li];
          live.current.revealLine(pi, li);
          setCurrentLine(l.id);
          const spoken = toSpeak(missionId, panel.id, l);
          if (narrator.canSpeak(spoken, l.textLang)) {
            try {
              await narrator.speak(spoken, l.textLang, { rate });
            } catch {
              await wait(300); // this line can't be voiced here: show it briefly and move on
            }
          } else {
            await wait(300);
          }
          if (cancelled) return;
        }
        setCurrentLine(null);
        pos.current = { panel: pi, line: 0 };
        if (!live.current.autoAdvance || pi >= ps.length - 1) break;
        await wait(live.current.reduced ? 500 : 1200);
        if (cancelled) return;
        pi += 1;
        li = 0;
        pos.current = { panel: pi, line: 0 };
        live.current.jumpToPanel(pi);
        await wait(live.current.reduced ? 50 : 700);
        if (cancelled) return;
      }
      if (!cancelled) {
        setNarrating(false);
        setStatus({ kind: 'done' });
      }
    })();
    return () => {
      cancelled = true;
      narrator.stop();
      setCurrentLine(null);
    };
  }, [lang, missionId, narrating, rate, ready, setCurrentLine]);

  // The reader moved to another panel (scroll, keys): stop, per panel-change rule.
  useEffect(() => {
    if (narrating && activeIndex !== pos.current.panel) stop();
  }, [activeIndex, narrating, stop]);

  // Mute, text-only or narration-off stops the voice; captions stay.
  useEffect(() => {
    if (narrating && (!soundOn || !canNarrate)) stop();
  }, [canNarrate, narrating, soundOn, stop]);

  // Preload current + next panel audio while idle too (files only; nothing further ahead).
  useEffect(() => {
    if (!canNarrate || narrating) return;
    const items = [panels[activeIndex], panels[activeIndex + 1]].flatMap((p) =>
      p ? p.lines.map((l) => ({ line: toSpeak(missionId, p.id, l), lang: l.textLang })) : [],
    );
    narrator.preload(items);
  }, [activeIndex, canNarrate, missionId, narrating, panels]);

  // Unmount / screen change: silence everything.
  useEffect(
    () => () => {
      narrator.stop();
      narrator.preload([]);
    },
    [],
  );

  const shownStatus: NarrationStatus = narrationOn && !textOnly && !voiceAvailable ? { kind: 'unavailable' } : status;
  return { narrating, canNarrate, toggle, start, stop, status: shownStatus };
}
