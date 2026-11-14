import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32, fbm } from '../../lib/noise';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { blip } from '../../lib/audio';
import { TimerBar, useGameLoop, type GameProps } from './useGameLoop';

type Peak = { u: number; h: number; w: number; target: boolean; found?: boolean; wrong?: boolean };

const SPAN_SCROLL = 2.2; // spectrum length in screen-widths when it scrolls
const W = 1000;
const H = 300;
const BASE = 250;

function makePeaks(seed: number, targets: number, decoys: number, span: number): Peak[] {
  const rnd = mulberry32(seed);
  const peaks: Peak[] = [];
  const minGap = 0.09;
  const place = (target: boolean) => {
    for (let tries = 0; tries < 200; tries++) {
      // Keep everything inside the part of the spectrum that passes through view.
      const u = span > 1 ? 0.35 + rnd() * (span - 0.55) : 0.08 + rnd() * 0.84;
      if (peaks.every((p) => Math.abs(p.u - u) > minGap)) {
        peaks.push({ u, h: 0.55 + rnd() * 0.35, w: 0.008 + rnd() * 0.004, target });
        return;
      }
    }
  };
  for (let i = 0; i < targets; i++) place(true);
  for (let i = 0; i < decoys; i++) place(false);
  return peaks.sort((a, b) => a.u - b.u);
}

function signal(u: number, peaks: Peak[], seed: number) {
  let y = 0.08 + (fbm(u * 18, 0.5, 3, seed) - 0.5) * 0.12;
  for (const p of peaks) y += p.h * Math.exp(-((u - p.u) ** 2) / (2 * p.w * p.w));
  return y;
}

export default function SpectrometerScan({ durationSec, params, successThreshold, onFinish }: GameProps) {
  const targets = params.targets ?? 3;
  const decoys = params.decoys ?? 4;
  const tolerance = params.tolerance ?? 0.022;
  const penalty = params.missPenalty ?? 15;

  // Reduced motion: the spectrum is static (one screen wide) instead of scrolling past.
  const reduced = useReducedMotion();
  const [span] = useState(() => (reduced ? 1 : SPAN_SCROLL));
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const peaks = useMemo(() => makePeaks(seed, targets, decoys, span), [seed, targets, decoys, span]);
  const [x, setXState] = useState(0.5);
  // Mirror in a ref so a key press right after a pointer move locks at the new position.
  const xRef = useRef(0.5);
  const setX = (v: number | ((p: number) => number)) => {
    const n = typeof v === 'function' ? v(xRef.current) : v;
    xRef.current = n;
    setXState(n);
  };
  const [elapsed, setElapsed] = useState(0);
  const [found, setFound] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'bad'; key: number } | null>(null);
  const done = useRef(false);
  const svg = useRef<SVGSVGElement>(null);

  const offset = Math.min(1, elapsed / durationSec) * (span - 1);
  const score = Math.round(Math.max(0, Math.min(100, (found / targets) * 100 - wrong * penalty)));

  const finish = (f: number, w: number) => {
    if (done.current) return;
    done.current = true;
    const s = Math.round(Math.max(0, Math.min(100, (f / targets) * 100 - w * penalty)));
    onFinish(s, s >= successThreshold, `${f} of ${targets} hematite features locked · ${w} false lock${w === 1 ? '' : 's'}`);
  };

  useGameLoop(!done.current, (dt) => {
    setElapsed((e) => {
      const n = e + dt;
      if (n >= durationSec) {
        // Defer so state updates settle before the result is recorded.
        queueMicrotask(() => finish(found, wrong));
        return durationSec;
      }
      return n;
    });
  });

  const lock = (sx = xRef.current) => {
    if (done.current) return;
    const u = offset + sx;
    let best: Peak | null = null;
    let bestD = Infinity;
    for (const p of peaks) {
      const d = Math.abs(p.u - u);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best && bestD <= tolerance && best.target && !best.found) {
      best.found = true;
      blip('ok');
      const f = found + 1;
      setFound(f);
      setFlash({ kind: 'ok', key: Date.now() });
      if (f >= targets) finish(f, wrong);
    } else {
      if (best && bestD <= tolerance && !best.target) best.wrong = true;
      blip('bad');
      setWrong((w) => w + 1);
      setFlash({ kind: 'bad', key: Date.now() });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.012;
        setX((v) => Math.min(0.98, Math.max(0.02, v + (e.key === 'ArrowLeft' ? -step : step))));
      } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !(e.target as HTMLElement).closest?.('button, input, a')) {
        e.preventDefault();
        lock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toLocal = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect();
    return Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width));
  };

  // Visible window of the spectrum.
  const samples = 260;
  let d = '';
  let ghost = '';
  const targetPeaks = peaks.filter((p) => p.target);
  for (let i = 0; i <= samples; i++) {
    const sx = i / samples;
    const u = offset + sx;
    const y = signal(u, peaks, seed % 97);
    d += `${i ? 'L' : 'M'}${(sx * W).toFixed(1)} ${(BASE - y * 200).toFixed(1)}`;
    let g = 0;
    for (const p of targetPeaks) g += (p.h + 0.12) * Math.exp(-((u - p.u) ** 2) / (2 * (p.w * 1.8) ** 2));
    ghost += `${i ? 'L' : 'M'}${(sx * W).toFixed(1)} ${(BASE - g * 200).toFixed(1)}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <TimerBar remaining={durationSec - elapsed} total={durationSec} />
      <div className="relative overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#0d0a08] graph-paper">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none select-none"
          role="img"
          aria-label={`Soil spectrum. Crosshair at ${Math.round(x * 100)}% across. ${found} of ${targets} hematite features locked.`}
          onPointerMove={(e) => setX(toLocal(e.clientX))}
          onPointerDown={(e) => {
            const nx = toLocal(e.clientX);
            setX(nx);
            lock(nx);
          }}
        >
          <path d={`${ghost} L${W} ${BASE} L0 ${BASE} Z`} fill="rgb(var(--accent-rgb) / 0.13)" stroke="none" />
          <path d={ghost} fill="none" stroke="var(--accent)" strokeOpacity="0.6" strokeDasharray="5 6" strokeWidth="2" />
          <path d={d} fill="none" stroke="#f3e2c7" strokeWidth="2" strokeLinejoin="round" />
          {peaks
            .filter((p) => p.found || p.wrong)
            .map((p, i) => {
              const px = (p.u - offset) * W;
              if (px < -20 || px > W + 20) return null;
              return (
                <g key={i} transform={`translate(${px} ${BASE - p.h * 200 - 26})`}>
                  <circle r="9" fill="none" stroke={p.found ? 'var(--color-ok)' : 'var(--color-bad)'} strokeWidth="2" />
                  <text y="-16" textAnchor="middle" className="font-mono" fontSize="15" fill={p.found ? 'var(--color-ok)' : 'var(--color-bad)'}>
                    {p.found ? 'Fe₂O₃' : '✕'}
                  </text>
                </g>
              );
            })}
          <g transform={`translate(${x * W} 0)`} className="pointer-events-none">
            <line y1="0" y2={H} stroke="var(--accent)" strokeWidth="1.5" />
            <circle cy="70" r="16" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            <line x1="-26" x2="26" y1="70" y2="70" stroke="var(--accent)" strokeWidth="1.5" />
          </g>
          <line x1="0" x2={W} y1={BASE} y2={BASE} stroke="rgb(255 255 255 / 0.15)" />
        </svg>
        {flash && (
          <span
            key={flash.key}
            className={`pointer-events-none absolute right-3 top-3 font-mono text-xs tracking-[0.18em] game-flash ${flash.kind === 'ok' ? 'text-[var(--color-ok)]' : 'text-[var(--color-bad)]'}`}
          >
            {flash.kind === 'ok' ? 'HEMATITE LOCKED' : `FALSE LOCK −${penalty}`}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[12px] tracking-[0.12em] text-[var(--color-fg-2)]">
        <span>
          LOCKED <b className="text-[var(--color-ok)]">{found}</b>/{targets} · FALSE <b className="text-[var(--color-bad)]">{wrong}</b> · SCORE{' '}
          <b className="text-[var(--color-fg)]">{score}</b>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-px w-6 border-t-2 border-dashed border-[rgb(var(--accent-rgb)/0.5)]" /> hematite reference
        </span>
      </div>
      <button type="button" className="btn-primary self-start" onClick={() => lock()}>
        Lock crosshair
      </button>
    </div>
  );
}
