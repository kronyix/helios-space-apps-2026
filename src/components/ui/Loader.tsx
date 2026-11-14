import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useProgress } from '@react-three/drei';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { hasWebGL } from '../../lib/device';
import { HeliosMark } from './HeliosMark';

/**
 * "Transmission acquisition" loader driven by real asset progress (drei useProgress).
 * Signal noise resolves as progress climbs; it dismisses once loading settles.
 */
export function Loader() {
  const { progress, active, total } = useProgress();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const started = useRef(performance.now());
  const canvas = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  progressRef.current = hasWebGL() ? progress : 100;

  const sawActive = useRef(false);
  if (active) sawActive.current = true;

  useEffect(() => {
    if (active) return;
    // The globe chunk loads lazily, so "nothing loading yet" is not "done": wait for a
    // real load cycle, or fall through after a grace period (e.g. everything cached).
    const settled = !hasWebGL() || (sawActive.current && (progress >= 100 || total === 0));
    const grace = settled ? 0 : 2600;
    const wait = Math.max(grace, (reduced ? 200 : 1100)) - (performance.now() - started.current);
    const id = window.setTimeout(() => {
      if (!useProgress.getState().active) setVisible(false);
    }, Math.max(0, wait));
    return () => window.clearTimeout(id);
  }, [active, progress, total, reduced]);

  // Safety: never trap the user behind the loader.
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 9000);
    return () => window.clearTimeout(id);
  }, []);

  // Signal noise that thins out as progress rises.
  useEffect(() => {
    if (!visible || reduced) return;
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    let raf = 0;
    const draw = () => {
      const w = (c.width = 220);
      const h = (c.height = 40);
      g.clearRect(0, 0, w, h);
      const p = progressRef.current / 100;
      g.strokeStyle = 'rgba(246,180,107,0.9)';
      g.lineWidth = 1.2;
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const clean = Math.sin(x * 0.09) * 6;
        const noise = (Math.random() - 0.5) * 30 * (1 - p);
        const y = h / 2 + clean * p + noise;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduced]);

  const pct = Math.round(hasWebGL() ? progress : 100);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="loader"
          role="status"
          aria-live="polite"
          aria-label={`Acquiring transmission, ${pct} percent`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? dur.instant : dur.slow, ease: ease.inOut }}
        >
          <div className="flex flex-col items-center gap-6">
            <HeliosMark size={52} />
            <p className="font-mono text-[11px] tracking-[0.42em] text-fg-2">ACQUIRING TRANSMISSION</p>
            <canvas ref={canvas} width={220} height={40} className="h-10 w-[220px]" aria-hidden="true" />
            <p className="font-display text-[34px] font-medium tracking-[0.12em] text-fg">
              SILENT <span className="text-[var(--accent)]">PIONEERS</span>
            </p>
            <div className="flex w-[220px] items-center gap-3">
              <span className="relative h-px flex-1 bg-[var(--color-line-2)]">
                <span className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-10 text-right font-mono text-[11px] tabular-nums text-fg-2">{pct}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
