import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useT } from '../../../i18n/useT';
import { useReducedMotion } from '../../../lib/useReducedMotion';
import { narrator } from '../../../narration/narrator';
import { useRoverStore } from '../store';
import { getExecProgress, useRoverUiStore, type CaptionKey } from './uiStore';
import { IconClose } from '../../../components/ui/Icons';

const CAPTION_I18N: Record<CaptionKey, string> = {
  intro: 'rover.caption.intro',
  firstUplink: 'rover.caption.firstUplink',
  firstSandSlip: 'rover.caption.firstSandSlip',
  rockStop: 'rover.caption.rockStop',
  lowBattery: 'rover.caption.lowBattery',
  win: 'rover.caption.win',
  lose: 'rover.caption.lose',
};

const CAPTION_TTL_MS = 4200;

/**
 * Single non-overlapping Mission Control voice/caption strip.
 * Plays pre-rendered Gemini TTS clips when present in /audio/manifest.json; otherwise stays silent.
 */
export function Captions() {
  const t = useT();
  const reduced = useReducedMotion();
  const lang = useAppStore((s) => s.lang);
  const soundOn = useAppStore((s) => s.soundOn);
  const narrationOn = useAppStore((s) => s.narrationOn);
  const textOnly = useAppStore((s) => s.textOnly);

  const phase = useRoverStore((s) => s.phase);
  const hud = useRoverStore((s) => s.hud);
  const report = useRoverStore((s) => s.report);
  const battery = useRoverStore((s) => s.game.rover.battery);

  const activeCaption = useRoverUiStore((s) => s.activeCaption);
  const tutorialActive = useRoverUiStore((s) => s.tutorialActive);
  const tutorialStep = useRoverUiStore((s) => s.tutorialStep);
  const triggerCaption = useRoverUiStore((s) => s.triggerCaption);
  const clearCaption = useRoverUiStore((s) => s.clearCaption);

  const fire = (key: CaptionKey) => {
    const text = t(CAPTION_I18N[key]);
    const opened = triggerCaption(key, text);
    if (!opened) return;
    const line = { id: `rover-${key}`, missionId: 'opportunity', panelId: 'rover-drive', text };
    if (!textOnly && narrationOn && soundOn && narrator.canSpeak(line, lang)) {
      void narrator.speak(line, lang, { rate: 1, reduced }).catch(() => {});
    }
  };

  // Trigger lifecycle captions once per run
  useEffect(() => {
    if (phase === 'planning' && !tutorialActive) {
      fire('intro');
    } else if (phase === 'uplink') {
      fire('firstUplink');
    } else if (phase === 'downlink' && report) {
      const evs = report.actual.events;
      if (evs.includes('rock_stop') || evs.includes('turn_blocked')) {
        fire('rockStop');
      } else if (evs.includes('slip') || report.endedInSand) {
        fire('firstSandSlip');
      } else if (battery < 25) {
        fire('lowBattery');
      }
    } else if (phase === 'won') {
      fire('win');
    } else if (phase === 'lost') {
      fire('lose');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tutorialActive, report, battery]);

  // Trigger sand slip caption live while executing if entering loose sand
  useEffect(() => {
    if (phase !== 'executing') return;
    const id = window.setInterval(() => {
      const st = useRoverStore.getState();
      if (st.phase !== 'executing' || !st.report) return;
      const u = getExecProgress(st);
      if (u > 0.25 && st.report.actual.events.includes('slip')) {
        fire('firstSandSlip');
      }
    }, 350);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Auto-dismiss after reading duration
  useEffect(() => {
    if (!activeCaption) return;
    const id = window.setTimeout(() => clearCaption(), CAPTION_TTL_MS);
    return () => window.clearTimeout(id);
  }, [activeCaption, clearCaption]);

  // Never visually collide with active coach marks or end/briefing modals
  const coachBlocking =
    tutorialActive && ((tutorialStep <= 3 && phase === 'planning') || (tutorialStep === 4 && phase === 'downlink'));
  if (!activeCaption || !hud || phase === 'briefing' || phase === 'won' || phase === 'lost' || coachBlocking) {
    return null;
  }

  return (
    <div className="rd-caption" role="status" aria-live="polite" data-phase={phase}>
      <span className="rd-caption__tag">CAPCOM</span>
      <p className="rd-caption__text">{activeCaption.text}</p>
      <button type="button" className="rd-caption__close" onClick={clearCaption} aria-label="Dismiss caption">
        <IconClose size={14} />
      </button>
    </div>
  );
}
