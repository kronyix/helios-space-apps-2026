import { useEffect, useRef, useState } from 'react';
import { blip } from '../../lib/audio';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { TimerBar, useGameLoop, type GameProps } from './useGameLoop';

export default function RpmThrottle({ durationSec, params, successThreshold, onFinish }: GameProps) {
  const T = params.targetRpm ?? 2537;
  const band = params.bandRpm ?? 70;
  const holdSec = params.holdSec ?? 3;
  const maxRpm = params.maxRpm ?? 3000;
  const up = params.spinUpPerSec ?? 900;
  const down = params.spinDownPerSec ?? 650;
  const drainAtT = params.drainAtTargetPerSec ?? 4.5;
  const over = params.overspeedRpm ?? 2700;
  const reduced = useReducedMotion();

  const sim = useRef({ cmd: 0, rpm: 0, battery: 100, hold: 0, angle: 0, held: false });
  const [view, setView] = useState({ rpm: 0, cmd: 0, battery: 100, hold: 0, elapsed: 0 });
  const [held, setHeld] = useState(false);
  const done = useRef(false);
  const rotor = useRef<SVGGElement>(null);

  const finish = (lifted: boolean) => {
    if (done.current) return;
    done.current = true;
    const s = sim.current;
    const score = lifted ? Math.round(30 + 70 * (s.battery / 100)) : Math.round(40 * Math.min(1, s.hold / holdSec));
    blip(lifted ? 'ok' : 'bad');
    onFinish(
      score,
      lifted && score >= successThreshold,
      lifted
        ? `Lift-off with ${Math.round(s.battery)}% battery left`
        : s.battery <= 0
          ? 'Battery depleted before lift-off'
          : `Time up · held the lift band for ${s.hold.toFixed(1)} of ${holdSec} s`,
    );
  };

  useGameLoop(true, (dt) => {
    if (done.current) return;
    const s = sim.current;
    s.cmd = s.held ? Math.min(maxRpm, s.cmd + up * dt) : Math.max(0, s.cmd - down * dt);
    // Rotor inertia: actual RPM lags the command.
    s.rpm += (s.cmd - s.rpm) * (1 - Math.exp(-dt / 0.35));
    // Power rises steeply with rotor speed; overspeed doubles the cost.
    let drain = drainAtT * Math.pow(s.rpm / T, 3);
    if (s.rpm > over) drain *= 2;
    s.battery = Math.max(0, s.battery - drain * dt);
    const inBand = Math.abs(s.rpm - T) <= band;
    s.hold = inBand ? s.hold + dt : Math.max(0, s.hold - dt * 1.5);
    s.angle = (s.angle + (s.rpm / 60) * 360 * dt * 0.02) % 360;
    if (rotor.current && !reduced) rotor.current.setAttribute('transform', `rotate(${s.angle.toFixed(1)})`);
    setView((v) => {
      const elapsed = Math.min(durationSec, v.elapsed + dt);
      if (s.hold >= holdSec) queueMicrotask(() => finish(true));
      else if (s.battery <= 0 || elapsed >= durationSec) queueMicrotask(() => finish(false));
      return { rpm: s.rpm, cmd: s.cmd, battery: s.battery, hold: s.hold, elapsed };
    });
  });

  const setThrottle = (on: boolean) => {
    sim.current.held = on;
    setHeld(on);
  };

  useEffect(() => {
    const isThrottleKey = (k: string) => k === ' ' || k === 'ArrowUp';
    const kd = (e: KeyboardEvent) => {
      if (isThrottleKey(e.key)) {
        if ((e.target as HTMLElement).closest?.('button, a') && e.key === ' ' && (e.target as HTMLElement).dataset.throttle === undefined) return;
        e.preventDefault();
        setThrottle(true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setThrottle(false);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (isThrottleKey(e.key)) setThrottle(false);
    };
    const blur = () => setThrottle(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Gauge geometry: 240° arc.
  const A0 = -210;
  const A1 = 30;
  const ang = (r: number) => A0 + (Math.min(maxRpm, Math.max(0, r)) / maxRpm) * (A1 - A0);
  const pt = (a: number, R: number) => [Math.cos((a * Math.PI) / 180) * R, Math.sin((a * Math.PI) / 180) * R];
  const arc = (a: number, b: number, R: number) => {
    const [x0, y0] = pt(a, R);
    const [x1, y1] = pt(b, R);
    return `M${x0} ${y0} A${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const inBand = Math.abs(view.rpm - T) <= band;
  const [nx, ny] = pt(ang(view.rpm), 70);
  const [cx, cy] = pt(ang(view.cmd), 86);
  const [cx0, cy0] = pt(ang(view.cmd), 72);

  return (
    <div className="flex flex-col gap-4">
      <TimerBar remaining={durationSec - view.elapsed} total={durationSec} />
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_1fr]">
        <svg viewBox="-100 -100 200 152" className="w-full" role="img" aria-label={`Rotor speed ${Math.round(view.rpm)} RPM. Throttle command ${Math.round(view.cmd)} RPM. Target ${T} RPM.`}>
          <path d={arc(A0, A1, 80)} stroke="rgb(255 255 255 / 0.12)" strokeWidth="10" fill="none" />
          <path d={arc(ang(T - band), ang(T + band), 80)} stroke="var(--accent)" strokeWidth="10" fill="none" />
          <path d={arc(ang(over), A1, 80)} stroke="var(--color-bad)" strokeOpacity=".5" strokeWidth="10" fill="none" />
          {/* Throttle command: where the rotors are heading (they lag behind it). */}
          <line x1={cx0} y1={cy0} x2={cx} y2={cy} stroke="var(--accent-2)" strokeWidth="3" strokeLinecap="round" />
          <line x1="0" y1="0" x2={nx} y2={ny} stroke={inBand ? 'var(--color-ok)' : '#f3efe7'} strokeWidth="2.5" strokeLinecap="round" />
          <circle r="5" fill="#f3efe7" />
          <text y="34" textAnchor="middle" fontSize="22" fill="#f3efe7" className="font-mono tabular-nums">
            {Math.round(view.rpm).toLocaleString()}
          </text>
          <text y="48" textAnchor="middle" fontSize="8" letterSpacing="2" fill="var(--color-fg-3)" className="font-mono">
            RPM · TARGET {T.toLocaleString()}
          </text>
          <text y="-88" textAnchor="middle" fontSize="7" letterSpacing="1.5" fill="var(--accent-2)" className="font-mono">
            ▲ THROTTLE {Math.round(view.cmd).toLocaleString()}
          </text>
        </svg>
        <div className="flex flex-col gap-4">
          <svg viewBox="-60 -60 120 120" className="mx-auto w-28" aria-hidden="true">
            <circle r="56" fill="none" stroke="rgb(255 255 255 / 0.08)" />
            <circle
              r="56"
              fill="none"
              stroke="var(--color-ok)"
              strokeWidth="3"
              strokeDasharray={`${(view.hold / holdSec) * 352} 352`}
              transform="rotate(-90)"
            />
            <g ref={rotor} opacity={reduced ? 0.4 + Math.min(0.6, view.rpm / T) * 0.6 : 1}>
              <rect x="-48" y="-3" width="96" height="6" rx="3" fill="#cfd6dd" />
              <rect x="-3" y="-48" width="6" height="96" rx="3" fill="#8fa3b5" />
            </g>
            <circle r="8" fill="#2a2f36" stroke="#cfd6dd" />
          </svg>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[11px] tracking-[0.16em] text-[var(--color-fg-2)]">
              <span>BATTERY</span>
              <span className="tabular-nums">{Math.round(view.battery)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-[var(--color-line-2)]">
              <div
                className="h-full"
                style={{ width: `${view.battery}%`, background: view.battery < 30 ? 'var(--color-bad)' : 'var(--color-ok)' }}
              />
            </div>
            <div className="mt-2 font-mono text-[11px] tracking-[0.16em] text-[var(--color-fg-2)]" aria-live="polite">
              LIFT BAND {view.hold.toFixed(1)} / {holdSec} s {view.rpm > over ? '· OVERSPEED' : ''}
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        data-throttle=""
        className={`btn-primary self-start select-none touch-none ${held ? 'ring-2 ring-[var(--accent-2)]' : ''}`}
        aria-pressed={held}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setThrottle(true);
        }}
        onPointerUp={() => setThrottle(false)}
        onPointerCancel={() => setThrottle(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {held ? 'Throttle up…' : 'Hold to throttle'}
      </button>
    </div>
  );
}
