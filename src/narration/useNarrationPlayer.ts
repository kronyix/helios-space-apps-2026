import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { lineDurationMs } from '../data/comics/opportunity-spirit';
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
  /** Smoothly reveals the panel's archival NASA photo stage silently for a short moment between panels. */
  revealPanelPhotos: (panelIdx: number, rate: number, isCancelled: () => boolean) => Promise<void>;
  jumpToPanel: (panelIdx: number) => void;
}

export type NarrationStatus =
  | { kind: 'idle' }
  | { kind: 'reading'; panel: number }
  | { kind: 'paused' }
  | { kind: 'done' }
  | { kind: 'unavailable' };

type PlaySession = {
  active: boolean;
  mode: 'story' | 'panel';
  panel: number | null;
  runId: number;
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

const toSpeak = (missionId: string, panelId: string, l: NarratedLine): SpeakLine => ({
  missionId,
  panelId,
  id: l.id,
  text: l.text,
  voice: l.voice,
});

/**
 * Supports two playback behaviors:
 * - Story Play (`toggle` / `start` from the corner Play button): plays continuously
 *   from the current panel all the way through the last panel of the issue, briefly
 *   showing each panel's archival NASA photo stage silently in between panels.
 * - Single-panel Play (`speakPanel` from a panel's corner speaker icon): reads only
 *   that specific panel aloud and stops at the end of that panel.
 * Also supports single-line playback (`speakLine`) when tapping a caption or balloon in Read mode.
 */
export function useNarrationPlayer({
  missionId,
  panels,
  activeIndex,
  ready,
  reduced,
  revealLine,
  revealPanelPhotos,
  jumpToPanel,
}: Options) {
  const { lang, rate, narrationOn, textOnly, soundOn } = useAppStore(
    useShallow((s) => ({
      lang: s.lang,
      rate: s.rate,
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

  const [playSession, setPlaySession] = useState<PlaySession>({
    active: false,
    mode: 'story',
    panel: null,
    runId: 0,
  });
  const [status, setStatus] = useState<NarrationStatus>({ kind: 'idle' });
  const pos = useRef({ panel: 0, line: 0 });
  const singleLineToken = useRef(0);
  const suppressScrollStopUntil = useRef(0);

  const narrating = playSession.active;
  const speakingPanel =
    playSession.active && playSession.mode === 'panel' ? playSession.panel : null;

  // Latest values for the async loop, without restarting it.
  const live = useRef({ panels, revealLine, revealPanelPhotos, jumpToPanel, reduced, status });
  live.current = { panels, revealLine, revealPanelPhotos, jumpToPanel, reduced, status };

  const stop = useCallback(
    (kind: NarrationStatus['kind'] = 'paused') => {
      singleLineToken.current += 1;
      narrator.stop();
      setCurrentLine(null);
      setPlaySession((s) => ({ ...s, active: false, panel: null }));
      setStatus({ kind } as NarrationStatus);
    },
    [setCurrentLine],
  );

  /** Corner Play button: plays continuously through the very last panel. */
  const start = useCallback(() => {
    if (!canNarrate) return;
    singleLineToken.current += 1;
    if (!soundOn) {
      // Pressing Play is an explicit user gesture requesting audio.
      setSoundEnabled(true);
      setSound(true);
    }
    const lastPanelIdx = Math.max(0, live.current.panels.length - 1);
    if (live.current.status.kind === 'done' && activeIndex >= lastPanelIdx) {
      pos.current = { panel: 0, line: 0 };
      suppressScrollStopUntil.current = Date.now() + 1200;
      live.current.jumpToPanel(0);
    } else if (pos.current.panel !== activeIndex) {
      pos.current = { panel: activeIndex, line: 0 };
    }
    setPlaySession((s) => ({
      active: true,
      mode: 'story',
      panel: null,
      runId: s.runId + 1,
    }));
  }, [activeIndex, canNarrate, setSound, soundOn]);

  const toggle = useCallback(() => (narrating ? stop() : start()), [narrating, start, stop]);

  /** Panel corner speaker icon: reads ONLY the requested panel aloud (or toggles it off). */
  const speakPanel = useCallback(
    (panelIdx: number) => {
      if (!canNarrate) return;
      if (playSession.active && playSession.mode === 'panel' && playSession.panel === panelIdx) {
        stop('paused');
        return;
      }
      singleLineToken.current += 1;
      narrator.stop();
      setCurrentLine(null);
      if (!soundOn) {
        setSoundEnabled(true);
        setSound(true);
      }
      pos.current = { panel: panelIdx, line: 0 };
      suppressScrollStopUntil.current = Date.now() + 1200;
      if (panelIdx !== activeIndex) {
        live.current.jumpToPanel(panelIdx);
      }
      setPlaySession((s) => ({
        active: true,
        mode: 'panel',
        panel: panelIdx,
        runId: s.runId + 1,
      }));
    },
    [activeIndex, canNarrate, playSession.active, playSession.mode, playSession.panel, setCurrentLine, setSound, soundOn, stop],
  );

  /**
   * In Read mode, tapping a caption or speech balloon plays that single line
   * after the user gesture.
   */
  const speakLine = useCallback(
    (panelIdx: number, lineIdx: number) => {
      if (!canNarrate || narrating) return;
      const panel = live.current.panels[panelIdx];
      const l = panel?.lines[lineIdx];
      if (!panel || !l) return;

      if (!soundOn) {
        setSoundEnabled(true);
        setSound(true);
      }

      const token = ++singleLineToken.current;
      pos.current = { panel: panelIdx, line: lineIdx };
      setCurrentLine(l.id);
      const spoken = toSpeak(missionId, panel.id, l);

      const finish = () => {
        if (singleLineToken.current === token) {
          setCurrentLine(null);
        }
      };

      if (narrator.canSpeak(spoken, l.textLang)) {
        narrator
          .speak(spoken, l.textLang, { rate, reduced: live.current.reduced })
          .then(finish)
          .catch(() => {
            const fallbackMs = Math.max(400, Math.round(lineDurationMs(l) / rate));
            window.setTimeout(finish, fallbackMs);
          });
      } else {
        const fallbackMs = Math.max(400, Math.round(lineDurationMs(l) / rate));
        window.setTimeout(finish, fallbackMs);
      }
    },
    [canNarrate, missionId, narrating, rate, setCurrentLine, setSound, soundOn],
  );

  // The read loop. Restarts when session/mode/panel/lang/speed changes.
  useEffect(() => {
    if (!playSession.active || !ready) return;
    let cancelled = false;
    const isSinglePanel = playSession.mode === 'panel';

    (async () => {
      let { panel: pi, line: li } = pos.current;
      while (!cancelled) {
        const { panels: ps } = live.current;
        const panel = ps[pi];
        if (!panel) break;
        setStatus({ kind: 'reading', panel: pi });
        const next = isSinglePanel ? undefined : ps[pi + 1];
        narrator.preload(
          [panel, next].flatMap((p) =>
            p ? p.lines.map((l) => ({ line: toSpeak(missionId, p.id, l), lang: l.textLang })) : [],
          ),
        );
        for (; li < panel.lines.length; li++) {
          pos.current = { panel: pi, line: li };
          const l = panel.lines[li];
          live.current.revealLine(pi, li);
          setCurrentLine(l.id);
          const spoken = toSpeak(missionId, panel.id, l);
          const fallbackReadMs = Math.max(400, Math.round(lineDurationMs(l) / rate));
          if (narrator.canSpeak(spoken, l.textLang)) {
            try {
              await narrator.speak(spoken, l.textLang, {
                rate,
                reduced: live.current.reduced,
              });
              // Add 250ms inter-line gap after real audio finishes
              await wait(250);
            } catch {
              // Missing or failed clip: stay silent, keep captions, time by reading speed
              await wait(fallbackReadMs);
            }
          } else {
            await wait(fallbackReadMs);
          }
          if (cancelled) return;
        }
        setCurrentLine(null);
        pos.current = { panel: pi, line: 0 };

        // Single-panel speaker mode stops at the end of that panel's lines.
        if (isSinglePanel) break;

        // In Story Play mode, silently reveal this panel's archival NASA photo stage
        // for a short time before moving on to the next panel.
        suppressScrollStopUntil.current = Date.now() + 5000;
        await live.current.revealPanelPhotos(pi, rate, () => cancelled);
        if (cancelled) return;

        if (pi >= ps.length - 1) break;

        // Advance to the next panel until the very end.
        pi += 1;
        li = 0;
        pos.current = { panel: pi, line: 0 };
        suppressScrollStopUntil.current = Date.now() + 1400;
        live.current.jumpToPanel(pi);
        await wait(live.current.reduced ? 50 : 600);
        if (cancelled) return;
      }
      if (!cancelled) {
        setPlaySession((s) => ({ ...s, active: false, panel: null }));
        setStatus({ kind: isSinglePanel ? 'idle' : 'done' });
      }
    })();

    return () => {
      cancelled = true;
      narrator.stop();
      setCurrentLine(null);
    };
  }, [
    lang,
    missionId,
    playSession.active,
    playSession.mode,
    playSession.panel,
    playSession.runId,
    rate,
    ready,
    setCurrentLine,
  ]);

  // The reader moved to another panel manually: stop narration.
  useEffect(() => {
    if (
      narrating &&
      Date.now() > suppressScrollStopUntil.current &&
      activeIndex !== pos.current.panel
    ) {
      stop();
    }
  }, [activeIndex, narrating, stop]);

  // Mute, text-only or narration-off stops the voice; captions stay.
  useEffect(() => {
    if (narrating && (!soundOn || !canNarrate)) stop();
  }, [canNarrate, narrating, soundOn, stop]);

  // Preload ONLY current + next panel audio while idle.
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

  const shownStatus: NarrationStatus =
    narrationOn && !textOnly && !voiceAvailable ? { kind: 'unavailable' } : status;
  return {
    narrating,
    speakingPanel,
    canNarrate,
    toggle,
    start,
    stop,
    speakPanel,
    speakLine,
    status: shownStatus,
  };
}
