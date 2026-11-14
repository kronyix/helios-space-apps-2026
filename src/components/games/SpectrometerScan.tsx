import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32, fbm } from '../../lib/noise';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { blip } from '../../lib/audio';
import { TimerBar, useGameLoop, type GameProps } from './useGameLoop';

type MineralType = 'hematite' | 'pyroxene' | 'olivine' | 'jarosite' | 'basalt';

interface SpectralFeature {
  id: number;
  u: number;
  type: MineralType;
  label: string;
  chemical: string;
  peaks: { du: number; h: number; w: number }[];
}

const SPAN_SCROLL = 2.4;
const W = 1000;
const H = 300;
const BASE = 240;

function createFeatures(seed: number, targetsCount: number, decoysCount: number, span: number): SpectralFeature[] {
  const rnd = mulberry32(seed);
  const features: SpectralFeature[] = [];
  const minGap = 0.11;

  const mineralProfiles: Record<Exclude<MineralType, 'hematite'>, { label: string; chemical: string; makePeaks: () => { du: number; h: number; w: number }[] }> = {
    pyroxene: {
      label: 'Pyroxene',
      chemical: '(Mg,Fe)SiO₃',
      makePeaks: () => [
        { du: -0.016, h: 0.52 + rnd() * 0.15, w: 0.012 },
        { du: 0.018, h: 0.38 + rnd() * 0.12, w: 0.014 },
      ],
    },
    olivine: {
      label: 'Olivine',
      chemical: '(Mg,Fe)₂SiO₄',
      makePeaks: () => [
        { du: 0.0, h: 0.72 + rnd() * 0.18, w: 0.022 },
      ],
    },
    jarosite: {
      label: 'Jarosite',
      chemical: 'KFe₃(SO₄)₂(OH)₆',
      makePeaks: () => [
        { du: -0.012, h: 0.65 + rnd() * 0.15, w: 0.007 },
        { du: 0.0, h: 0.85 + rnd() * 0.1, w: 0.006 },
        { du: 0.013, h: 0.58 + rnd() * 0.15, w: 0.007 },
      ],
    },
    basalt: {
      label: 'Basalt Matrix',
      chemical: 'Ca-Al Silicate',
      makePeaks: () => [
        { du: -0.02, h: 0.35 + rnd() * 0.1, w: 0.025 },
        { du: 0.02, h: 0.32 + rnd() * 0.1, w: 0.025 },
      ],
    },
  };

  const decoyTypes: Exclude<MineralType, 'hematite'>[] = ['pyroxene', 'olivine', 'jarosite', 'basalt'];

  const place = (type: MineralType) => {
    for (let tries = 0; tries < 300; tries++) {
      const u = span > 1 ? 0.3 + rnd() * (span - 0.5) : 0.08 + rnd() * 0.84;
      if (features.every((f) => Math.abs(f.u - u) > minGap)) {
        if (type === 'hematite') {
          features.push({
            id: features.length,
            u,
            type: 'hematite',
            label: 'Hematite (Blueberry)',
            chemical: 'Fe₂O₃',
            peaks: [
              { du: -0.013, h: 0.75 + rnd() * 0.15, w: 0.009 },
              { du: 0.013, h: 0.62 + rnd() * 0.12, w: 0.009 },
            ],
          });
        } else {
          const profile = mineralProfiles[type];
          features.push({
            id: features.length,
            u,
            type,
            label: profile.label,
            chemical: profile.chemical,
            peaks: profile.makePeaks(),
          });
        }
        return;
      }
    }
  };

  for (let i = 0; i < targetsCount; i++) place('hematite');
  for (let i = 0; i < decoysCount; i++) place(decoyTypes[i % decoyTypes.length]);

  return features.sort((a, b) => a.u - b.u);
}

function evaluateSignal(u: number, features: SpectralFeature[], seed: number, timeSec: number, noiseLevel: number) {
  const baseNoise = (fbm(u * 14 + seed * 0.1, timeSec * 0.6, 3, seed) - 0.5) * 0.14 * noiseLevel;
  const highFreqJitter = Math.sin(u * 180 + timeSec * 8) * 0.018 * noiseLevel;
  let val = 0.06 + baseNoise + highFreqJitter;

  for (const f of features) {
    for (const p of f.peaks) {
      const pu = f.u + p.du;
      const dist = u - pu;
      val += p.h * Math.exp(-(dist * dist) / (2 * p.w * p.w));
    }
  }
  return Math.max(0.01, val);
}

export default function SpectrometerScan({ durationSec, params, successThreshold, onFinish }: GameProps) {
  const targets = params.targets ?? 3;
  const decoys = params.decoys ?? 4;
  const tolerance = params.tolerance ?? 0.024;
  const penalty = params.missPenalty ?? 15;

  const reduced = useReducedMotion();
  const [span] = useState(() => (reduced ? 1 : SPAN_SCROLL));
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const features = useMemo(() => createFeatures(seed, targets, decoys, span), [seed, targets, decoys, span]);

  const [x, setXState] = useState(0.5);
  const xRef = useRef(0.5);
  const setX = (v: number | ((p: number) => number)) => {
    const n = typeof v === 'function' ? v(xRef.current) : v;
    xRef.current = n;
    setXState(n);
  };

  const [filterBand, setFilterBand] = useState<'normal' | 'fine'>('normal');
  const [elapsed, setElapsed] = useState(0);
  const [foundIds, setFoundIds] = useState<number[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [combo, setCombo] = useState(1);
  const [precisionPoints, setPrecisionPoints] = useState(0);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'bad'; text: string; key: number } | null>(null);
  const [isDone, setIsDone] = useState(false);
  const doneRef = useRef(false);
  const svg = useRef<SVGSVGElement>(null);

  const foundCount = foundIds.length;

  const noiseScale = 0.8 + (foundCount / targets) * 0.7;
  const offset = Math.min(1, elapsed / durationSec) * (span - 1);

  const rawScore = (foundCount / targets) * 80 + precisionPoints - wrongCount * penalty;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const finish = (fCount: number, wCount: number, pPts: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setIsDone(true);
    const finalScore = Math.round(Math.max(0, Math.min(100, (fCount / targets) * 80 + pPts - wCount * penalty)));
    const pass = finalScore >= successThreshold;
    const detail = `${fCount} of ${targets} hematite signatures verified · ${pPts} precision pts · ${wCount} false lock${wCount === 1 ? '' : 's'}`;
    onFinish(finalScore, pass, detail);
  };

  useGameLoop(!isDone, (dt) => {
    setElapsed((e) => {
      const next = e + dt;
      if (next >= durationSec) {
        queueMicrotask(() => finish(foundIds.length, wrongCount, precisionPoints));
        return durationSec;
      }
      return next;
    });
  });

  // Calculate real-time cross-correlation with Hematite reference under crosshair
  const currentU = offset + x;
  let nearestFeature: SpectralFeature | null = null;
  let nearestDist = Infinity;
  for (const f of features) {
    const d = Math.abs(f.u - currentU);
    if (d < nearestDist) {
      nearestDist = d;
      nearestFeature = f;
    }
  }

  let correlation = 0;
  let classifiedMineral = 'SCANNING NOISE...';
  let isHematite = false;

  const currentTol = filterBand === 'fine' ? tolerance * 1.3 : tolerance;

  if (nearestFeature && nearestDist < currentTol * 2.2) {
    const proximity = Math.max(0, 1 - nearestDist / (currentTol * 2.2));
    if (nearestFeature.type === 'hematite') {
      correlation = Math.round((0.55 + 0.45 * proximity) * 100);
      classifiedMineral = foundIds.includes(nearestFeature.id) ? 'Fe₂O₃ (ALREADY LOGGED)' : 'Fe₂O₃ HEMATITE MATCH';
      isHematite = true;
    } else if (nearestFeature.type === 'pyroxene') {
      correlation = Math.round((0.25 + 0.35 * proximity) * 100);
      classifiedMineral = `${nearestFeature.label} DECOY (${nearestFeature.chemical})`;
    } else if (nearestFeature.type === 'olivine') {
      correlation = Math.round((0.15 + 0.25 * proximity) * 100);
      classifiedMineral = `${nearestFeature.label} (${nearestFeature.chemical})`;
    } else {
      correlation = Math.round((0.1 + 0.2 * proximity) * 100);
      classifiedMineral = `${nearestFeature.label} (${nearestFeature.chemical})`;
    }
  }

  const lock = (sx = xRef.current) => {
    if (doneRef.current) return;
    const u = offset + sx;
    let best: SpectralFeature | null = null;
    let bestD = Infinity;
    for (const f of features) {
      const d = Math.abs(f.u - u);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }

    if (best && bestD <= currentTol && best.type === 'hematite' && !foundIds.includes(best.id)) {
      blip('ok');
      const newFoundIds = [...foundIds, best.id];
      setFoundIds(newFoundIds);

      const accuracy = 1 - bestD / currentTol;
      const bonus = Math.round(5 * accuracy * combo);
      const newPrecision = Math.min(20, precisionPoints + bonus);
      setPrecisionPoints(newPrecision);
      setCombo((c) => Math.min(3, c + 1));

      setFlash({
        kind: 'ok',
        text: `HEMATITE VERIFIED +${Math.round(80 / targets) + bonus} PTS (${Math.round(accuracy * 100)}% ALIGN)`,
        key: Date.now(),
      });

      if (newFoundIds.length >= targets) {
        queueMicrotask(() => finish(newFoundIds.length, wrongCount, newPrecision));
      }
    } else {
      blip('bad');
      setWrongCount((w) => w + 1);
      setCombo(1);
      setFlash({
        kind: 'bad',
        text: best && best.type !== 'hematite' ? `FALSE LOCK: ${best.label.toUpperCase()} −${penalty}` : `SIGNAL LOST / NOISE −${penalty}`,
        key: Date.now(),
      });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 0.005 : filterBand === 'fine' ? 0.01 : 0.02;
        setX((v) => Math.min(0.98, Math.max(0.02, v + (e.key === 'ArrowLeft' ? -step : step))));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFilterBand((b) => (b === 'normal' ? 'fine' : 'normal'));
      } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !(e.target as HTMLElement).closest?.('button, input, a')) {
        e.preventDefault();
        lock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toLocal = (clientX: number) => {
    if (!svg.current) return 0.5;
    const r = svg.current.getBoundingClientRect();
    return Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width));
  };

  const samples = 220;
  let d = '';
  let ghost = '';
  const hematites = features.filter((f) => f.type === 'hematite');

  for (let i = 0; i <= samples; i++) {
    const sx = i / samples;
    const u = offset + sx;
    const y = evaluateSignal(u, features, seed % 97, elapsed, noiseScale);
    d += `${i ? 'L' : 'M'}${(sx * W).toFixed(1)} ${(BASE - y * 190).toFixed(1)}`;

    let g = 0;
    for (const h of hematites) {
      for (const p of h.peaks) {
        const pu = h.u + p.du;
        const dist = u - pu;
        g += (p.h + 0.08) * Math.exp(-(dist * dist) / (2 * (p.w * 1.6) ** 2));
      }
    }
    ghost += `${i ? 'L' : 'M'}${(sx * W).toFixed(1)} ${(BASE - g * 190).toFixed(1)}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <TimerBar remaining={durationSec - elapsed} total={durationSec} />

      {/* Spectrometer Scope View */}
      <div className="relative overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#0a0807] graph-paper shadow-inner">
        {/* Scope Header / Telemetry Bar */}
        <div className="flex items-center justify-between border-b border-[var(--color-line-2)]/60 bg-[#140e0b]/80 px-3 py-1.5 font-mono text-[11px] tracking-wider text-[var(--color-fg-2)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${isHematite && correlation > 70 ? 'bg-[var(--color-ok)] animate-pulse' : 'bg-[var(--accent)]'}`} />
              ALPHA-PARTICLE X-RAY / MÖSSBAUER CH-1
            </span>
            <span className="text-[var(--color-fg-3)]">·</span>
            <span>FILTER: <b className="text-[var(--accent)] uppercase">{filterBand}</b></span>
          </div>
          <div className="flex items-center gap-3">
            <span>NOISE: <b className="text-[var(--color-fg-3)]">{(noiseScale * 100).toFixed(0)}%</b></span>
            <span>MATCH: <b className={correlation > 70 ? 'text-[var(--color-ok)] font-bold' : correlation > 40 ? 'text-[var(--accent)]' : 'text-[var(--color-fg-3)]'}>{correlation}%</b></span>
          </div>
        </div>

        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none select-none cursor-crosshair"
          role="img"
          aria-label={`Spectrometer scope. Reticle at ${Math.round(x * 100)}%. ${foundCount} of ${targets} hematite features locked.`}
          onPointerMove={(e) => setX(toLocal(e.clientX))}
          onPointerDown={(e) => {
            const nx = toLocal(e.clientX);
            setX(nx);
            lock(nx);
          }}
        >
          <defs>
            <linearGradient id="specGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="laserBlur">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>

          {/* Reference Ghost Curve (Hematite fingerprint) */}
          <path d={`${ghost} L${W} ${BASE} L0 ${BASE} Z`} fill="url(#specGlow)" stroke="none" />
          <path d={ghost} fill="none" stroke="var(--accent)" strokeOpacity="0.55" strokeDasharray="4 6" strokeWidth="2" />

          {/* Active Real-time Signal Curve */}
          <path d={d} fill="none" stroke="#f6dec2" strokeWidth="2.2" strokeLinejoin="round" />
          <path d={d} fill="none" stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="4" strokeLinejoin="round" filter="url(#laserBlur)" />

          {/* Locked Feature Markers */}
          {features
            .filter((f) => foundIds.includes(f.id))
            .map((f) => {
              const px = (f.u - offset) * W;
              if (px < -30 || px > W + 30) return null;
              return (
                <g key={f.id} transform={`translate(${px} ${BASE - 160})`}>
                  <line y1="0" y2="150" stroke="var(--color-ok)" strokeDasharray="2 3" strokeWidth="1.2" />
                  <circle r="12" fill="#140e0b" stroke="var(--color-ok)" strokeWidth="2" />
                  <text y="4" textAnchor="middle" className="font-mono font-bold" fontSize="11" fill="var(--color-ok)">
                    Fe₂O₃
                  </text>
                  <text y="-18" textAnchor="middle" className="font-mono text-[10px]" fill="var(--color-ok)">
                    VERIFIED
                  </text>
                </g>
              );
            })}

          {/* Scanning Window & Reticle */}
          <g transform={`translate(${x * W} 0)`} className="pointer-events-none">
            {/* Bandpass aperture window */}
            <rect
              x={-currentTol * W}
              y="0"
              width={currentTol * 2 * W}
              height={H}
              fill={isHematite && correlation > 70 ? 'rgb(var(--color-ok-rgb, 125 255 154) / 0.12)' : 'rgb(var(--accent-rgb) / 0.08)'}
              stroke={isHematite && correlation > 70 ? 'var(--color-ok)' : 'var(--accent)'}
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            {/* Centerline and crosshair sights */}
            <line y1="0" y2={H} stroke={isHematite && correlation > 70 ? 'var(--color-ok)' : 'var(--accent)'} strokeWidth="1.5" />
            <circle cy="80" r="18" fill="none" stroke={isHematite && correlation > 70 ? 'var(--color-ok)' : 'var(--accent)'} strokeWidth="1.5" />
            <line x1="-30" x2="30" y1="80" y2="80" stroke={isHematite && correlation > 70 ? 'var(--color-ok)' : 'var(--accent)'} strokeWidth="1.5" />
            {/* Correlation badge directly on crosshair */}
            <g transform="translate(0, 115)">
              <rect x="-34" y="-10" width="68" height="18" rx="3" fill="#0d0907" stroke={correlation > 70 ? 'var(--color-ok)' : 'var(--accent)'} strokeWidth="1" />
              <text y="3" textAnchor="middle" className="font-mono font-bold text-[10px]" fill={correlation > 70 ? 'var(--color-ok)' : '#f6dec2'}>
                {correlation}% MATCH
              </text>
            </g>
          </g>

          <line x1="0" x2={W} y1={BASE} y2={BASE} stroke="rgb(255 255 255 / 0.15)" strokeWidth="1" />
        </svg>

        {/* Live Status Notification Flash */}
        {flash && (
          <div
            key={flash.key}
            className={`pointer-events-none absolute right-3 top-9 rounded bg-[#100b08]/90 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider shadow game-flash ${
              flash.kind === 'ok' ? 'border border-[var(--color-ok)] text-[var(--color-ok)]' : 'border border-[var(--color-bad)] text-[var(--color-bad)]'
            }`}
          >
            {flash.text}
          </div>
        )}
      </div>

      {/* Real-Time Mineral Analyzer HUD */}
      <div className="grid grid-cols-1 gap-2 rounded border border-[var(--color-line-2)] bg-[#120d0a] p-2.5 font-mono text-[12px] sm:grid-cols-3 sm:items-center">
        <div>
          <span className="text-[10px] tracking-widest text-[var(--color-fg-3)]">SENSOR READOUT</span>
          <div className="font-semibold text-[var(--color-fg)] truncate">{classifiedMineral}</div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px] tracking-wider text-[var(--color-fg-2)]">
            <span>CORRELATION</span>
            <span className={correlation > 70 ? 'text-[var(--color-ok)]' : 'text-[var(--accent)]'}>{correlation}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-[var(--color-line-2)]">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${correlation}%`,
                background: correlation > 70 ? 'var(--color-ok)' : correlation > 40 ? 'var(--accent)' : 'var(--color-fg-3)',
              }}
            />
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] tracking-widest text-[var(--color-fg-3)]">PROGRESS & SCORE</span>
          <div className="text-[var(--color-fg)]">
            LOCKED <b className="text-[var(--color-ok)]">{foundCount}</b>/{targets} · COMBO <b className="text-[var(--accent)]">{combo}x</b> · SCORE <b className="text-white">{score}</b>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => lock()}
          >
            Lock Spectral Fingerprint
          </button>
          <button
            type="button"
            className="btn-ghost text-[11px] font-mono"
            onClick={() => setFilterBand((b) => (b === 'normal' ? 'fine' : 'normal'))}
            title="Toggle between wide and fine aperture"
          >
            Bandpass: <b className="text-[var(--accent)] uppercase">{filterBand}</b>
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--color-fg-3)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-5 border-t border-dashed border-[var(--accent)]" /> Hematite Reference
          </span>
          <span>·</span>
          <span>Arrows move · Space to lock</span>
        </div>
      </div>
    </div>
  );
}
