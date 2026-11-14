import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import type { MissionData, MiniGameType } from '../../data/types';
import { useAppStore } from '../../store/useAppStore';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { blip } from '../../lib/audio';
import { IconArrowRight, IconClose, IconRetry } from '../ui/Icons';
import type { GameProps } from '../games/useGameLoop';

const GAMES: Record<MiniGameType, React.LazyExoticComponent<(p: GameProps) => React.JSX.Element>> = {
  spectrometer_scan: lazy(() => import('../games/SpectrometerScan')),
  laser_bounce: lazy(() => import('../games/LaserBounce')),
  rpm_throttle: lazy(() => import('../games/RpmThrottle')),
};

export default function MiniGameModal({ mission }: { mission: MissionData }) {
  const phase = useAppStore((s) => s.gamePhase);
  const setPhase = useAppStore((s) => s.setGamePhase);
  const recordGame = useAppStore((s) => s.recordGame);
  const lastScore = useAppStore((s) => s.lastScore);
  const result = useAppStore((s) => s.gameResults[mission.id]);
  const go = useAppStore((s) => s.go);
  const reduced = useReducedMotion();
  const [locking, setLocking] = useState<null | { passed: boolean }>(null);
  const [detail, setDetail] = useState('');
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const lockTimer = useRef<number | undefined>(undefined);

  const g = mission.miniGame;
  const Game = GAMES[g.type];
  const open = phase !== 'closed';

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const id = requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
    return () => {
      cancelAnimationFrame(id);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
  }, [phase, open]);

  // Leaving mid-game (close, navigation, unmount) cancels a pending result.
  useEffect(() => {
    if (phase !== 'active') window.clearTimeout(lockTimer.current);
  }, [phase]);
  useEffect(() => () => window.clearTimeout(lockTimer.current), []);

  const close = () => {
    window.clearTimeout(lockTimer.current);
    setLocking(null);
    setPhase('closed');
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && dialog.current) {
        const f = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]')];
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const start = () => {
    if (phase === 'active') return; // double-click guard
    blip('tick');
    setLocking(null);
    setAttempt((a) => a + 1);
    setPhase('active');
  };

  const onFinish = (score: number, passed: boolean, d: string) => {
    setDetail(d);
    setLocking({ passed });
    // Signal-lock beat: freeze, then record the result.
    window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => {
      recordGame(mission.id, score, passed);
      setLocking(null);
    }, reduced ? 150 : 900);
  };

  const threshold = g.successThreshold ?? 60;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(4_4_6/0.84)] p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.fast }}
          onPointerDown={(e) => e.target === e.currentTarget && phase !== 'active' && close()}
        >
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-title"
            className="game-sheet relative max-h-[100dvh] w-full max-w-[760px] overflow-y-auto"
            initial={{ y: reduced ? 0 : 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduced ? 0 : 12, opacity: 0 }}
            transition={{ duration: dur.base, ease: ease.out }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-6 pb-4 pt-5">
              <div>
                <p className="kicker">Field test · Issue {String(mission.issueNumber).padStart(2, '0')} · {g.durationSec ?? 15}s</p>
                <h2 id="game-title" className="mt-1 font-display text-[28px] font-semibold leading-tight">
                  {g.title}
                </h2>
              </div>
              <button type="button" className="btn-icon shrink-0" onClick={close} aria-label="Close field test">
                <IconClose />
              </button>
            </header>

            <div className="px-6 py-5">
              {phase === 'intro' && (
                <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
                  <div>
                    <p className="text-[17px] text-fg">{g.tagline}</p>
                    <ol className="mt-4 space-y-3">
                      {g.instructions?.map((s, i) => (
                        <li key={i} className="grid grid-cols-[28px_1fr] gap-2 text-[15px] leading-relaxed text-fg-2">
                          <span className="font-mono text-[12px] text-[var(--accent)]">0{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                    <p className="mt-4 font-mono text-[11.5px] leading-relaxed tracking-[0.06em] text-fg-3">{g.controls}</p>
                  </div>
                  <aside className="science-note">
                    <p className="label-caps mb-2 !text-[var(--accent)]">The science</p>
                    <p className="text-[14px] leading-relaxed text-fg-2">{g.science}</p>
                    <p className="mt-3 font-mono text-[11px] text-fg-3">Pass: {threshold}% · Badge: {g.badgeThreshold ?? 80}%</p>
                  </aside>
                  <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                    <button type="button" className="btn-primary" onClick={start} data-autofocus>
                      Start the {g.durationSec ?? 15}-second test <IconArrowRight size={18} />
                    </button>
                    {result && (
                      <span className="font-mono text-[12px] text-fg-3">
                        Best {result.best}% · {result.attempts} attempt{result.attempts === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {phase === 'active' && (
                <div className="relative">
                  <Suspense fallback={<p className="label-caps">Booting instrument…</p>}>
                    <div inert={!!locking || undefined} data-autofocus tabIndex={-1} className="outline-none">
                      <Game
                        key={attempt}
                        durationSec={g.durationSec ?? 15}
                        params={g.params ?? {}}
                        successThreshold={threshold}
                        onFinish={onFinish}
                      />
                    </div>
                  </Suspense>
                  <AnimatePresence>
                    {locking && (
                      <motion.div
                        className="absolute inset-0 grid place-items-center bg-[rgb(6_6_8/0.7)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: dur.fast }}
                        role="status"
                      >
                        <span className={`signal-lock ${locking.passed ? 'text-[var(--color-ok)]' : 'text-[var(--color-bad)]'}`}>
                          {locking.passed ? 'SIGNAL LOCKED' : 'SIGNAL LOST'}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {(phase === 'success' || phase === 'failure') && (
                <div className="grid gap-6 md:grid-cols-[auto_1fr]" role="status">
                  <div className="score-dial" data-pass={phase === 'success' || undefined}>
                    <span className="font-display text-[56px] font-semibold tabular-nums leading-none">{lastScore ?? 0}</span>
                    <span className="font-mono text-[11px] tracking-[0.2em] text-fg-3">/ 100</span>
                  </div>
                  <div>
                    <p className={`kicker ${phase === 'success' ? '!text-[var(--color-ok)]' : '!text-[var(--color-bad)]'}`}>
                      {phase === 'success' ? 'Test passed' : `Below ${threshold}% · test failed`}
                    </p>
                    <p className="mt-2 text-[17px] text-fg">{detail}</p>
                    <p className="mt-3 text-[14px] leading-relaxed text-fg-2">{g.science}</p>
                    {result && (
                      <p className="mt-3 font-mono text-[12px] text-fg-3">
                        Best {result.best}% · badge at {g.badgeThreshold ?? 80}% · {result.attempts} attempt{result.attempts === 1 ? '' : 's'}
                      </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-3">
                      {phase === 'success' ? (
                        <>
                          <button type="button" className="btn-primary" data-autofocus onClick={() => go('reward', mission.id)}>
                            Receive the transmission <IconArrowRight size={18} />
                          </button>
                          <button type="button" className="btn-ghost" onClick={start}>
                            <IconRetry size={18} /> Try for a higher score
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn-primary" data-autofocus onClick={start}>
                            <IconRetry size={18} /> Try again
                          </button>
                          <button type="button" className="btn-ghost" onClick={close}>
                            Back to the hardware
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
