import { useEffect, useRef, useState } from 'react';
import { blip } from '../../lib/audio';
import { TimerBar, useGameLoop, type GameProps } from './useGameLoop';

type Pulse = { t: number; rtt: number; hit: boolean; offset: number; distanceKm: number };

export default function LaserBounce({ durationSec, params, successThreshold, onFinish }: GameProps) {
  const tol = params.toleranceDeg ?? 0.6;
  const drift = params.driftDegPerSec ?? 0.35;
  const range = params.rangeDeg ?? 12;
  const penalty = params.missPenalty ?? 12;
  const c = params.speedOfLightKmS ?? 299792.458;
  const minD = params.minDistanceKm ?? 363300;
  const maxD = params.maxDistanceKm ?? 405500;
  const half = range / 2;

  const [aim, setAim] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [misses, setMisses] = useState(0);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const target = useRef({ a: (Math.random() * 2 - 1) * (half - 1.5), dir: Math.random() < 0.5 ? -1 : 1 });
  const [tgt, setTgt] = useState(target.current.a);
  const done = useRef(false);

  const offset = Math.abs(tgt - aim);
  const onTarget = offset <= tol;

  const finish = (score: number, detail: string) => {
    if (done.current) return;
    done.current = true;
    const s = Math.round(Math.max(0, Math.min(100, score)));
    onFinish(s, s >= successThreshold, detail);
  };

  useGameLoop(true, (dt) => {
    if (done.current) return;
    // The Moon (and the reflector on it) drifts across the telescope's field.
    const t = target.current;
    t.a += t.dir * drift * dt;
    if (Math.abs(t.a) > half - 0.6) {
      t.dir *= -1;
      t.a = Math.sign(t.a) * (half - 0.6);
    }
    setTgt(t.a);
    setElapsed((e) => Math.min(durationSec, e + dt));
    setPulse((p) => {
      if (!p) return p;
      const nt = p.t + dt;
      if (nt >= p.rtt) {
        queueMicrotask(() => resolvePulse(p));
        return null;
      }
      return { ...p, t: nt };
    });
  });

  const resolvePulse = (p: Pulse) => {
    if (p.hit) {
      blip('ok');
      const score = 100 - misses * penalty - (p.offset / tol) * 20;
      finish(score, `Return after ${p.rtt.toFixed(3)} s → distance ≈ ${Math.round(p.distanceKm).toLocaleString()} km · ${misses} missed pulse${misses === 1 ? '' : 's'}`);
    } else {
      blip('bad');
      setMisses((m) => m + 1);
      setLast(`No return after ${p.rtt.toFixed(2)} s. The pulse missed the reflector.`);
    }
  };

  // Time out, unless a pulse is still in flight (its return still counts).
  useEffect(() => {
    if (elapsed >= durationSec && !pulse) finish(0, `No clean return in ${durationSec} s · ${misses} missed pulse${misses === 1 ? '' : 's'}`);
  });

  const fire = () => {
    if (done.current || pulse || elapsed >= durationSec) return;
    blip('lock');
    const distanceKm = minD + Math.random() * (maxD - minD);
    setLast(null);
    setPulse({ t: 0, rtt: (2 * distanceKm) / c, hit: onTarget, offset, distanceKm });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if ((e.target as HTMLElement).tagName === 'INPUT') return; // the slider handles its own arrows
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.1;
        setAim((a) => Math.max(-half, Math.min(half, a + (e.key === 'ArrowLeft' ? -step : step))));
      } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !(e.target as HTMLElement).closest?.('button, a')) {
        e.preventDefault();
        fire();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const px = 26; // pixels per degree inside the telescope view
  const dx = (tgt - aim) * px;
  const prog = pulse ? pulse.t / pulse.rtt : 0;

  return (
    <div className="flex flex-col gap-4">
      <TimerBar remaining={durationSec - elapsed} total={durationSec} />
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-[var(--color-line-2)] bg-black">
          <svg viewBox="-200 -125 400 250" className="absolute inset-0 h-full w-full" role="img" aria-label={`Telescope view. ${onTarget ? 'Reticle on the reflector.' : `Reflector is ${tgt > aim ? 'right' : 'left'} of the reticle by ${offset.toFixed(1)} degrees.`}`}>
            <defs>
              <radialGradient id="lb-moon" cx="40%" cy="35%">
                <stop offset="0" stopColor="#e9e6df" />
                <stop offset=".7" stopColor="#8d8a83" />
                <stop offset="1" stopColor="#3b3a37" />
              </radialGradient>
            </defs>
            <g transform={`translate(${dx} 0)`}>
              <circle r="150" cx="-40" cy="40" fill="url(#lb-moon)" />
              <circle r="22" cx="-90" cy="10" fill="#6f6c66" opacity=".5" />
              <circle r="14" cx="40" cy="70" fill="#6f6c66" opacity=".45" />
              {/* Tranquility Base reflector */}
              <rect x="-5" y="-5" width="10" height="10" fill="#d8e4ee" stroke="#0b0b0b" strokeWidth="1" />
              <text y="-12" textAnchor="middle" fontSize="9" fill="#111" className="font-mono">LRRR</text>
            </g>
            {/* reticle */}
            <g stroke={onTarget ? 'var(--color-ok)' : 'var(--accent)'} strokeWidth="1.2" fill="none">
              <circle r={tol * px} />
              <circle r="40" strokeOpacity=".4" />
              <path d="M-60 0h40M20 0h40M0-60v40M0 20v40" />
            </g>
            {pulse && (
              <circle
                r={3 + 4 * (prog < 0.5 ? 1 - prog * 2 : (prog - 0.5) * 2)}
                fill="#7dff9a"
                opacity={prog < 0.5 ? 1 - prog : prog}
              />
            )}
          </svg>
          <span className="absolute left-3 top-3 font-mono text-[11px] tracking-[0.18em] text-[var(--color-fg-2)]">
            {pulse ? `PULSE IN FLIGHT · ${pulse.t.toFixed(2)} s` : onTarget ? 'ON TARGET · FIRE' : 'ACQUIRING'}
          </span>
        </div>
        <div className="flex flex-col justify-between gap-3 font-mono text-[12px] text-[var(--color-fg-2)]">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt>AIM</dt>
            <dd className="text-right tabular-nums text-[var(--color-fg)]">{aim.toFixed(2)}°</dd>
            <dt>OFFSET</dt>
            <dd className={`text-right tabular-nums ${onTarget ? 'text-[var(--color-ok)]' : ''}`}>{offset.toFixed(2)}°</dd>
            <dt>MISSES</dt>
            <dd className="text-right tabular-nums">{misses}</dd>
            <dt>LIGHT</dt>
            <dd className="text-right tabular-nums">{(c / 1000).toFixed(0)}k km/s</dd>
          </dl>
          <p aria-live="polite" className="min-h-[3em] text-[12px] leading-snug text-[var(--color-bad)]">
            {last}
          </p>
        </div>
      </div>
      <label className="flex flex-col gap-2">
        <span className="label-caps">Aim angle</span>
        <input
          type="range"
          min={-half}
          max={half}
          step={0.05}
          value={aim}
          onChange={(e) => setAim(Number(e.target.value))}
          className="range"
          aria-valuetext={`${aim.toFixed(2)} degrees`}
        />
      </label>
      <button type="button" className="btn-primary self-start" onClick={fire} disabled={!!pulse}>
        {pulse ? 'Waiting for return…' : 'Fire laser'}
      </button>
    </div>
  );
}
