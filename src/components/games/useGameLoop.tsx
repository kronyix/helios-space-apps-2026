import { useEffect, useRef } from 'react';

/**
 * requestAnimationFrame loop for mini-games.
 * - dt is wall-clock time, so the 15 s timer is real seconds even on slow devices.
 * - Time spent with the tab hidden is skipped (the clock resets on visibilitychange).
 */
export function useGameLoop(active: boolean, tick: (dt: number) => void) {
  const cb = useRef(tick);
  cb.current = tick;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      if (!document.hidden) cb.current(dt);
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active]);
}

export interface GameProps {
  durationSec: number;
  params: Record<string, number>;
  successThreshold: number;
  /** Called exactly once with a 0–100 score computed from player input. */
  onFinish: (score: number, passed: boolean, detail: string) => void;
}

export function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const frac = Math.max(0, remaining / total);
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off" aria-label={`${Math.ceil(remaining)} seconds left`}>
      <span className="font-pixel text-[12px] tabular-nums text-[var(--color-fg)] w-[52px]">{Math.max(0, remaining).toFixed(1)}s</span>
      <span className="relative h-[3px] flex-1 overflow-hidden rounded bg-[var(--color-line-2)]">
        <span
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: `${frac * 100}%`, background: frac < 0.25 ? 'var(--color-bad)' : 'var(--accent)' }}
        />
      </span>
    </div>
  );
}
