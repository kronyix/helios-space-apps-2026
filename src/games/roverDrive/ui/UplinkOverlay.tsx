import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../../lib/useReducedMotion';
import { UPLINK_SEC, useRoverStore } from '../store';
import { IconEarth, IconMars } from './icons';
import { getExecProgress, requestSkipExec, useRoverUiStore } from './uiStore';

const FACTS = [
  'Radio waves cross space at light speed — minutes away.',
  'Drivers pack a full sol of moves into one signal.',
  'No joystick works when Mars is millions of kilometres out.',
] as const;

export function UplinkOverlay() {
  const reduced = useReducedMotion();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const st = useRoverStore.getState();
  const u = getExecProgress(st);
  const left = Math.max(0, UPLINK_SEC * (1 - u));
  const factIdx = Math.min(FACTS.length - 1, Math.floor((u * UPLINK_SEC) / 1.7));

  const r = 34;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - u);

  return (
    <div className="rd-center" role="status" aria-live="polite">
      <div className="rd-uplink-card" data-reduced={reduced || undefined}>
        <div className="rd-uplink__ring" aria-hidden="true">
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="4" />
            <circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              stroke="#9fe2ff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 42 42)"
            />
          </svg>
          <span className="rd-uplink__sec">{left.toFixed(1)}s</span>
        </div>

        <p className="rd-uplink__title">Sending to Mars...</p>

        <div className="rd-relay rd-relay--compact" aria-hidden="true">
          <div className="rd-relay__row">
            <span className="rd-relay__planet">
              <IconEarth size={22} />
            </span>
            <span className="rd-relay__track">
              <span className="rd-relay__line" />
              <span className="rd-relay__pulse" style={{ left: `${Math.min(100, u * 100)}%` }} />
            </span>
            <span className="rd-relay__planet">
              <IconMars size={22} />
            </span>
          </div>
        </div>

        <p className="rd-uplink__fact">{FACTS[factIdx]}</p>
      </div>
    </div>
  );
}

/** 1.2s title card at execution start ("SOL n begins"). Omitted under reduced motion. */
export function SolStartCard() {
  const reduced = useReducedMotion();
  const phase = useRoverStore((s) => s.phase);
  const solBannerSol = useRoverUiStore((s) => s.solBannerSol);
  const setSolBannerSol = useRoverUiStore((s) => s.setSolBannerSol);

  useEffect(() => {
    if (solBannerSol === null) return;
    if (reduced || phase !== 'executing') {
      setSolBannerSol(null);
      return;
    }
    const id = window.setTimeout(() => setSolBannerSol(null), 1200);
    return () => window.clearTimeout(id);
  }, [solBannerSol, phase, reduced, setSolBannerSol]);

  if (reduced || solBannerSol === null || phase !== 'executing') return null;

  return (
    <div className="rd-sol-card" role="status" aria-live="polite">
      <span className="rd-sol-card__k">MERIDIANI PLANUM</span>
      <strong className="rd-sol-card__t">SOL {solBannerSol} begins</strong>
    </div>
  );
}

export function ExecutingChip() {
  const sol = useRoverStore((s) => s.report?.sol);
  const execSpeed = useRoverUiStore((s) => s.execSpeed);
  const toggleExecSpeed = useRoverUiStore((s) => s.toggleExecSpeed);

  return (
    <div className="rd-chip" role="group" aria-label={`Sol ${sol} playback controls`}>
      <span className="rd-dot" aria-hidden="true" />
      <span>Sol {sol} · Driving</span>
      <button
        type="button"
        className="rd-chip__btn"
        aria-pressed={execSpeed === 2}
        aria-label={`Playback speed ${execSpeed}x. Toggle 1x or 2x`}
        onClick={toggleExecSpeed}
      >
        {execSpeed}×
      </button>
      <button
        type="button"
        className="rd-chip__btn rd-chip__btn--skip"
        aria-keyshortcuts="Space"
        aria-label="Skip drive playback"
        onClick={() => requestSkipExec()}
      >
        Skip
      </button>
    </div>
  );
}
