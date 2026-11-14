import { useEffect, useRef, useState } from 'react';
import { blip } from '../../lib/audio';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { TimerBar, useGameLoop, type GameProps } from './useGameLoop';

interface GustEvent {
  name: string;
  loadDelta: number; // RPM disturbance
  duration: number;
  remaining: number;
}

export default function RpmThrottle({ durationSec, params, successThreshold, onFinish }: GameProps) {
  const T = params.targetRpm ?? 2537;
  const band = params.bandRpm ?? 70;
  const holdSec = params.holdSec ?? 3;
  const maxRpm = params.maxRpm ?? 3000;
  const up = params.spinUpPerSec ?? 950;
  const down = params.spinDownPerSec ?? 700;
  const drainAtT = params.drainAtTargetPerSec ?? 4.2;
  const over = params.overspeedRpm ?? 2700;
  const reduced = useReducedMotion();

  // Simulation state
  const sim = useRef({
    cmd: 0,
    rpm: 0,
    battery: 100,
    hold: 0,
    angleTop: 0,
    angleBottom: 0,
    held: false,
    fineTrim: false,
    gust: null as GustEvent | null,
    nextGustTimer: 2.2,
    harmonicBonus: 0,
  });

  const [view, setView] = useState({
    rpm: 0,
    cmd: 0,
    battery: 100,
    hold: 0,
    elapsed: 0,
    gustText: null as string | null,
    isHarmonic: false,
  });

  const [throttleInput, setThrottleInput] = useState(0); // 0 to 1 continuous throttle slider
  const [held, setHeld] = useState(false);
  const done = useRef(false);
  const topRotor = useRef<SVGGElement>(null);
  const bottomRotor = useRef<SVGGElement>(null);

  const finish = (lifted: boolean) => {
    if (done.current) return;
    done.current = true;
    const s = sim.current;

    // Score calculation: 30 base + 70 * battery% + harmonic precision bonus
    const batteryScore = 30 + 70 * (s.battery / 100);
    const score = lifted
      ? Math.round(Math.min(100, batteryScore + s.harmonicBonus))
      : Math.round(40 * Math.min(1, s.hold / holdSec));

    blip(lifted ? 'ok' : 'bad');
    const passed = lifted && score >= successThreshold;
    const detail = lifted
      ? `Stable lift-off achieved · ${Math.round(s.battery)}% battery preserved · ${(s.hold).toFixed(1)}s stable envelope`
      : s.battery <= 0
        ? 'Battery depleted before aerodynamic lift-off'
        : `Time expired · held lift band for ${s.hold.toFixed(1)} of ${holdSec} s`;

    onFinish(score, passed, detail);
  };

  useGameLoop(true, (dt) => {
    if (done.current) return;
    const s = sim.current;

    // Atmospheric disturbances generator (Mars wind gusts & thermal downdrafts)
    s.nextGustTimer -= dt;
    if (s.nextGustTimer <= 0) {
      const gustPool = [
        { name: 'MARTIAN GUST: +130 RPM SURGE', loadDelta: 130, duration: 1.6, remaining: 1.6 },
        { name: 'THIN CO₂ POCKET: -110 RPM SINK', loadDelta: -110, duration: 1.8, remaining: 1.8 },
        { name: 'THERMAL UPDRAFT: +80 RPM LOAD', loadDelta: 80, duration: 1.4, remaining: 1.4 },
        { name: 'CROSSWIND SHEAR: -90 RPM DRAFT', loadDelta: -90, duration: 1.5, remaining: 1.5 },
      ];
      s.gust = gustPool[Math.floor(Math.random() * gustPool.length)];
      s.nextGustTimer = 3.2 + Math.random() * 2.5;
    }

    let gustLoad = 0;
    if (s.gust) {
      s.gust.remaining -= dt;
      // Parabolic gust envelope
      const gFrac = 1 - s.gust.remaining / s.gust.duration;
      const gWeight = Math.sin(gFrac * Math.PI);
      gustLoad = s.gust.loadDelta * gWeight;
      if (s.gust.remaining <= 0) s.gust = null;
    }

    // Command update: if button held or slider active
    if (s.held) {
      s.cmd = Math.min(maxRpm, s.cmd + up * dt);
    } else if (throttleInput > 0) {
      // Direct slider targeting
      const targetFromSlider = throttleInput * maxRpm;
      if (s.cmd < targetFromSlider) s.cmd = Math.min(targetFromSlider, s.cmd + up * dt);
      else s.cmd = Math.max(targetFromSlider, s.cmd - down * dt);
    } else {
      s.cmd = Math.max(0, s.cmd - down * dt);
    }

    // Rotor aerodynamic inertia: rotor speed smoothly lags the throttle command + gust disturbance
    const targetWithGust = Math.max(0, s.cmd + gustLoad);
    s.rpm += (targetWithGust - s.rpm) * (1 - Math.exp(-dt / 0.35));

    // Power consumption: cubic with RPM; doubled when transonic overspeed (>2700 RPM)
    let drain = drainAtT * Math.pow(s.rpm / T, 3);
    if (s.rpm > over) drain *= 2.2;
    s.battery = Math.max(0, s.battery - drain * dt);

    // Stability & lift band check (around 2,537 RPM)
    const rpmDelta = Math.abs(s.rpm - T);
    const inBand = rpmDelta <= band;
    const isHarmonic = rpmDelta <= 20;

    if (inBand) {
      const holdRate = isHarmonic ? dt * 1.25 : dt;
      s.hold += holdRate;
      if (isHarmonic) s.harmonicBonus = Math.min(8, s.harmonicBonus + dt * 2.5);
    } else {
      // Degrade hold progress if falling out of flight envelope
      s.hold = Math.max(0, s.hold - dt * 1.2);
    }

    // Rotate coaxial blades in opposite directions
    const revsPerSec = s.rpm / 60;
    s.angleTop = (s.angleTop + revsPerSec * 360 * dt * 0.25) % 360;
    s.angleBottom = (s.angleBottom - revsPerSec * 360 * dt * 0.25) % 360;

    if (!reduced) {
      if (topRotor.current) topRotor.current.setAttribute('transform', `rotate(${s.angleTop.toFixed(1)})`);
      if (bottomRotor.current) bottomRotor.current.setAttribute('transform', `rotate(${s.angleBottom.toFixed(1)})`);
    }

    setView((v) => {
      const elapsed = Math.min(durationSec, v.elapsed + dt);
      if (s.hold >= holdSec) {
        queueMicrotask(() => finish(true));
      } else if (s.battery <= 0 || elapsed >= durationSec) {
        queueMicrotask(() => finish(false));
      }

      return {
        rpm: s.rpm,
        cmd: s.cmd,
        battery: s.battery,
        hold: s.hold,
        elapsed,
        gustText: s.gust ? s.gust.name : null,
        isHarmonic,
      };
    });
  });

  const setThrottleButton = (on: boolean) => {
    sim.current.held = on;
    setHeld(on);
    if (on) setThrottleInput(1);
    else setThrottleInput(sim.current.cmd / maxRpm);
  };

  const adjustThrottleDelta = (deltaRpm: number) => {
    sim.current.cmd = Math.min(maxRpm, Math.max(0, sim.current.cmd + deltaRpm));
    setThrottleInput(sim.current.cmd / maxRpm);
  };

  useEffect(() => {
    const isThrottleKey = (k: string) => k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W';
    const kd = (e: KeyboardEvent) => {
      if (isThrottleKey(e.key)) {
        if ((e.target as HTMLElement).closest?.('button, a') && e.key === ' ' && (e.target as HTMLElement).dataset.throttle === undefined) return;
        e.preventDefault();
        setThrottleButton(true);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setThrottleButton(false);
        adjustThrottleDelta(-120);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        adjustThrottleDelta(50);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        adjustThrottleDelta(-50);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (isThrottleKey(e.key)) setThrottleButton(false);
    };
    const blur = () => setThrottleButton(false);

    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Tachometer geometry: 240° arc
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
  const [nx, ny] = pt(ang(view.rpm), 72);
  const [cx, cy] = pt(ang(view.cmd), 86);
  const [cx0, cy0] = pt(ang(view.cmd), 74);

  const liftFraction = Math.min(1, view.hold / holdSec);

  return (
    <div className="flex flex-col gap-3">
      <TimerBar remaining={durationSec - view.elapsed} total={durationSec} />

      {/* Main Flight Avionics Grid */}
      <div className="grid items-center gap-3 sm:grid-cols-[1.2fr_1fr]">
        {/* Dual-Needle Avionics Tachometer */}
        <div className="relative overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#080a0e] p-3 shadow-inner">
          <svg viewBox="-105 -100 210 155" className="w-full select-none" role="img" aria-label={`Rotor tachometer: ${Math.round(view.rpm)} RPM`}>
            {/* Background Arc */}
            <path d={arc(A0, A1, 80)} stroke="rgba(255, 255, 255, 0.12)" strokeWidth="12" fill="none" strokeLinecap="round" />

            {/* Target Lift Band: 2,537 RPM ± 70 */}
            <path d={arc(ang(T - band), ang(T + band), 80)} stroke="var(--accent)" strokeWidth="12" fill="none" />
            {/* Center Sweet Spot 2,537 */}
            <path d={arc(ang(T - 15), ang(T + 15), 80)} stroke="var(--color-ok)" strokeWidth="12" fill="none" />

            {/* Overspeed Danger Zone (>2,700 RPM) */}
            <path d={arc(ang(over), A1, 80)} stroke="var(--color-bad)" strokeOpacity="0.6" strokeWidth="12" fill="none" strokeLinecap="round" />

            {/* Commanded Throttle (Ghost needle) */}
            <line x1={cx0} y1={cy0} x2={cx} y2={cy} stroke="var(--accent-2)" strokeWidth="3.5" strokeLinecap="round" />

            {/* Actual Rotor RPM Needle */}
            <line
              x1="0"
              y1="0"
              x2={nx}
              y2={ny}
              stroke={view.isHarmonic ? 'var(--color-ok)' : inBand ? '#fff' : view.rpm > over ? 'var(--color-bad)' : '#e2dbcd'}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <circle r="6" fill="#1e222a" stroke="#fff" strokeWidth="1.5" />

            {/* Digital Readout */}
            <text y="32" textAnchor="middle" fontSize="24" fill={inBand ? 'var(--color-ok)' : '#ffffff'} className="font-mono font-bold tabular-nums">
              {Math.round(view.rpm).toLocaleString()}
            </text>
            <text y="46" textAnchor="middle" fontSize="8" letterSpacing="1.8" fill="var(--color-fg-3)" className="font-mono">
              ROTOR RPM · TARGET {T}
            </text>
            <text y="-88" textAnchor="middle" fontSize="8" letterSpacing="1.2" fill="var(--accent-2)" className="font-mono font-semibold">
              CMD THROTTLE {Math.round(view.cmd).toLocaleString()} RPM
            </text>
          </svg>

          {/* Wind Gust / Environmental Alert Banner */}
          {view.gustText && (
            <div className="absolute inset-x-2 top-2 rounded bg-[#1e1510]/90 px-2 py-1 text-center font-mono text-[10px] font-bold text-amber-400 border border-amber-600/60 animate-pulse">
              {view.gustText}
            </div>
          )}
        </div>

        {/* Counter-Rotating Rotor Model & Telemetry Panel */}
        <div className="flex flex-col justify-between gap-3 rounded-md border border-[var(--color-line-2)] bg-[#0b0d13] p-3 font-mono text-[12px]">
          {/* Dual Coaxial Rotor Animation */}
          <div className="flex items-center justify-center gap-4">
            <svg viewBox="-60 -60 120 120" className="w-24 select-none" aria-hidden="true">
              {/* Lift progress ring */}
              <circle r="54" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="4" />
              <circle
                r="54"
                fill="none"
                stroke="var(--color-ok)"
                strokeWidth="4"
                strokeDasharray={`${liftFraction * 339} 339`}
                transform="rotate(-90)"
              />

              {/* Upper Carbon-Fiber Rotor */}
              <g ref={topRotor} opacity={reduced ? 0.8 : 0.95}>
                <rect x="-48" y="-3.5" width="96" height="7" rx="3.5" fill="#cfd6dd" />
                <rect x="-48" y="-1.5" width="96" height="3" fill="#1b222a" />
              </g>

              {/* Lower Counter-Rotating Rotor */}
              <g ref={bottomRotor} opacity={reduced ? 0.7 : 0.85}>
                <rect x="-3.5" y="-48" width="7" height="96" rx="3.5" fill="#8fa3b5" />
                <rect x="-1.5" y="-48" width="3" height="96" fill="#151b22" />
              </g>

              {/* Rotor Mast Hub */}
              <circle r="7" fill="#242c36" stroke="#cfd6dd" strokeWidth="1.5" />
            </svg>

            {/* Flight Envelope Status Box */}
            <div className="flex flex-col gap-1 text-[11px]">
              <span className="text-[10px] tracking-wider text-[var(--color-fg-3)]">FLIGHT REGIME</span>
              <span className={`font-bold ${view.isHarmonic ? 'text-[var(--color-ok)]' : inBand ? 'text-white' : view.rpm > over ? 'text-[var(--color-bad)]' : 'text-amber-400'}`}>
                {view.isHarmonic ? 'HARMONIC LOCK' : inBand ? 'LIFT ENVELOPE' : view.rpm > over ? 'TRANSONIC OVERSPEED' : 'BELOW AERODYNAMIC LIFT'}
              </span>
              <span className="text-[10px] text-[var(--color-fg-3)]">
                LIFT ACCUM: <b>{(view.hold).toFixed(1)}s</b> / {holdSec}s
              </span>
            </div>
          </div>

          {/* Battery Consumption Gauge */}
          <div>
            <div className="mb-1 flex justify-between font-mono text-[11px] tracking-wider text-[var(--color-fg-2)]">
              <span>BATTERY CAPACITY</span>
              <span className={`tabular-nums font-bold ${view.battery < 30 ? 'text-[var(--color-bad)]' : 'text-[var(--color-ok)]'}`}>
                {Math.round(view.battery)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-[var(--color-line-2)]">
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${view.battery}%`,
                  background: view.battery < 30 ? 'var(--color-bad)' : view.battery < 55 ? 'var(--accent)' : 'var(--color-ok)',
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-[var(--color-fg-3)]">
              <span>DRAIN: {view.rpm > over ? 'HIGH (2.2x)' : inBand ? 'NOMINAL' : 'LOW'}</span>
              <span>{view.rpm > over ? 'TIP SHOCKWAVES DETECTED' : 'CO₂ DENSITY: 0.020 kg/m³'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Continuous Throttle Slider */}
      <label className="flex flex-col gap-1.5">
        <div className="flex justify-between font-mono text-[11px]">
          <span className="text-[var(--color-fg-3)] tracking-wider">VARIABLE THROTTLE TRIM LEVER</span>
          <span className="text-[var(--accent)] font-semibold">
            {Math.round(throttleInput * maxRpm)} RPM COMMAND
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={throttleInput}
          onChange={(e) => {
            const val = Number(e.target.value);
            setThrottleInput(val);
            sim.current.cmd = val * maxRpm;
          }}
          className="range"
          aria-label="Throttle command slider"
        />
      </label>

      {/* Interactive Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-throttle=""
            className={`btn-primary select-none touch-none ${held ? 'ring-2 ring-[var(--accent-2)] bg-[var(--accent-2)]' : ''}`}
            aria-pressed={held}
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* synthetic or already-released pointer */
              }
              setThrottleButton(true);
            }}
            onPointerUp={() => setThrottleButton(false)}
            onPointerCancel={() => setThrottleButton(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {held ? 'Holding Boost Throttle…' : 'Hold Throttle Boost'}
          </button>

          <button
            type="button"
            className="btn-ghost text-[11px] font-mono"
            onClick={() => adjustThrottleDelta(60)}
            title="Step throttle up"
          >
            +60 RPM
          </button>
          <button
            type="button"
            className="btn-ghost text-[11px] font-mono"
            onClick={() => adjustThrottleDelta(-60)}
            title="Step throttle down"
          >
            −60 RPM
          </button>
        </div>

        <div className="font-mono text-[11px] text-[var(--color-fg-3)]">
          <span>Keyboard: ↑ / Space boost · ↓ / S cut · ← / → trim</span>
        </div>
      </div>
    </div>
  );
}
