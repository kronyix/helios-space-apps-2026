import { useEffect, useRef, useState } from 'react';
import { blip } from '../../lib/audio';
import { TimerBar, useGameLoop, type GameProps } from './useGameLoop';

interface ActivePulse {
  id: number;
  t: number;
  rtt: number;
  distanceKm: number;
  aimOffset: number;
  onTarget: boolean;
  state: 'outbound' | 'reflecting' | 'inbound' | 'resolved';
  syncResult?: 'perfect' | 'good' | 'missed';
  timingDeltaMs?: number;
}

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
  const [successfulReturns, setSuccessfulReturns] = useState(0);
  const [totalPrecisionBonus, setTotalPrecisionBonus] = useState(0);
  const [pulse, setPulse] = useState<ActivePulse | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ kind: 'ok' | 'bad' | 'info'; text: string; sub?: string } | null>(null);

  const target = useRef({ a: (Math.random() * 2 - 1) * (half - 1.8), dir: Math.random() < 0.5 ? -1 : 1 });
  const [tgt, setTgt] = useState(target.current.a);
  const done = useRef(false);
  const pulseCounter = useRef(0);

  const offset = Math.abs(tgt - aim);
  const onTarget = offset <= tol;

  const currentScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        successfulReturns > 0
          ? 40 + successfulReturns * 25 + totalPrecisionBonus - misses * penalty
          : 0,
      ),
    ),
  );

  const finish = (finalReturns: number, finalMisses: number, finalPrecision: number, lastDistance?: number) => {
    if (done.current) return;
    done.current = true;

    const baseScore = finalReturns > 0 ? 40 + finalReturns * 25 + finalPrecision - finalMisses * penalty : 0;
    const finalScore = Math.round(Math.max(0, Math.min(100, baseScore)));
    const passed = finalScore >= successThreshold;

    const distStr = lastDistance ? `Distance: ${Math.round(lastDistance).toLocaleString()} km` : 'No echo acquired';
    const detail = `${finalReturns} laser echo${finalReturns === 1 ? '' : 'es'} locked · ${distStr} · ${finalMisses} miss${finalMisses === 1 ? '' : 'es'}`;
    onFinish(finalScore, passed, detail);
  };

  useGameLoop(true, (dt) => {
    if (done.current) return;

    // Moon drifts across telescope field
    const t = target.current;
    t.a += t.dir * drift * dt;
    if (Math.abs(t.a) > half - 0.6) {
      t.dir *= -1;
      t.a = Math.sign(t.a) * (half - 0.6);
    }
    setTgt(t.a);

    setElapsed((e) => {
      const next = Math.min(durationSec, e + dt);
      return next;
    });

    // Update laser pulse in flight
    setPulse((prev) => {
      if (!prev || prev.state === 'resolved') return prev;
      const nt = prev.t + dt;
      const frac = nt / prev.rtt;

      let nextState = prev.state;
      if (frac < 0.48) {
        nextState = 'outbound';
      } else if (frac < 0.52) {
        nextState = 'reflecting';
      } else if (frac < 1.05) {
        nextState = 'inbound';
      } else {
        // Auto-expire pulse if receiver gate was not synchronized in time
        queueMicrotask(() => handleGateMiss(prev));
        return null;
      }

      return { ...prev, t: nt, state: nextState };
    });
  });

  // Time expired check
  useEffect(() => {
    if (elapsed >= durationSec && !pulse) {
      finish(successfulReturns, misses, totalPrecisionBonus);
    }
  });

  const fire = () => {
    if (done.current || pulse || elapsed >= durationSec) return;
    blip('lock');

    const distanceKm = minD + Math.random() * (maxD - minD);
    const rtt = (2 * distanceKm) / c; // ~2.42 - 2.70 seconds

    pulseCounter.current += 1;
    setPulse({
      id: pulseCounter.current,
      t: 0,
      rtt,
      distanceKm,
      aimOffset: offset,
      onTarget,
      state: 'outbound',
    });

    setLastFeedback({
      kind: 'info',
      text: `PULSE TRANSMITTED · c = ${(c / 1000).toFixed(0)}k km/s`,
      sub: onTarget ? 'Target aligned: stand by for lunar reflection' : 'Warning: telescope misaligned with LRRR',
    });
  };

  const handleGateMiss = (p: ActivePulse) => {
    blip('bad');
    const newMisses = misses + 1;
    setMisses(newMisses);
    setLastFeedback({
      kind: 'bad',
      text: p.onTarget ? 'GATE TIMING MISSED' : 'TARGET MISSED: NO REFLECTION',
      sub: p.onTarget ? 'Receiver gate was not synchronized when photon packet returned' : 'Laser beam did not hit Apollo 11 retroreflector array',
    });
  };

  const syncReceiverGate = () => {
    if (done.current || !pulse || pulse.state !== 'inbound') return;

    // Calculate timing difference from the exact return moment
    const deltaSec = pulse.t - pulse.rtt;
    const deltaMs = Math.round(deltaSec * 1000);
    const absDeltaMs = Math.abs(deltaMs);

    if (!pulse.onTarget) {
      blip('bad');
      const newMisses = misses + 1;
      setMisses(newMisses);
      setLastFeedback({
        kind: 'bad',
        text: 'BEAM MISSED RETROREFLECTOR',
        sub: `Aperture offset ${pulse.aimOffset.toFixed(2)}° exceeded reflector tolerance (${tol}°)`,
      });
      setPulse(null);
      return;
    }

    if (absDeltaMs <= 180) {
      // Successful synchronization
      blip('ok');
      const isPerfect = absDeltaMs <= 60;
      const precisionBonus = isPerfect ? 15 : 8;
      const newReturns = successfulReturns + 1;
      const newPrecision = totalPrecisionBonus + precisionBonus;

      setSuccessfulReturns(newReturns);
      setTotalPrecisionBonus(newPrecision);
      setPulse(null);

      setLastFeedback({
        kind: 'ok',
        text: isPerfect ? 'PICOSECOND LOCK · 100% PHOTON HARVEST' : 'SIGNAL LOCKED · PHOTONS DETECTED',
        sub: `Round trip ${pulse.rtt.toFixed(4)} s · Distance: ${Math.round(pulse.distanceKm).toLocaleString()} km (Δt: ${deltaMs > 0 ? '+' : ''}${deltaMs} ms)`,
      });

      // If finished at least 2 clean returns and close to end, or maximum pulses
      if (newReturns >= 3) {
        queueMicrotask(() => finish(newReturns, misses, newPrecision, pulse.distanceKm));
      }
    } else {
      blip('bad');
      const newMisses = misses + 1;
      setMisses(newMisses);
      setPulse(null);
      setLastFeedback({
        kind: 'bad',
        text: deltaSec < 0 ? 'EARLY GATE SYNC' : 'LATE GATE SYNC',
        sub: `Gate triggered ${Math.abs(deltaMs)} ms ${deltaSec < 0 ? 'before' : 'after'} return photon packet arrival`,
      });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        e.preventDefault();
        const step = e.shiftKey ? 0.4 : 0.12;
        setAim((a) => Math.max(-half, Math.min(half, a + (e.key === 'ArrowLeft' ? -step : step))));
      } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !(e.target as HTMLElement).closest?.('button, a')) {
        e.preventDefault();
        if (!pulse) fire();
        else if (pulse.state === 'inbound') syncReceiverGate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const px = 26;
  const dx = (tgt - aim) * px;
  const progress = pulse ? Math.min(1, pulse.t / pulse.rtt) : 0;
  const remainingTime = pulse ? Math.max(0, pulse.rtt - pulse.t) : 0;

  // Receiver gate alignment metric: 0 to 1 during inbound approach
  const gateWindowApproach = pulse && pulse.state === 'inbound' ? Math.max(0, 1 - Math.abs(pulse.t - pulse.rtt) / 0.6) : 0;
  const gateReady = pulse && pulse.state === 'inbound' && remainingTime < 0.25;

  return (
    <div className="flex flex-col gap-3">
      <TimerBar remaining={durationSec - elapsed} total={durationSec} />

      {/* Main Dual-Panel Ranging Console */}
      <div className="grid gap-3 sm:grid-cols-[1fr_210px]">
        {/* Optical Telescope & Ranging Scope */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#030304] shadow-inner">
          <svg viewBox="-200 -125 400 250" className="absolute inset-0 h-full w-full select-none" role="img" aria-label="Lunar telescope view">
            <defs>
              <radialGradient id="moonSurface" cx="40%" cy="35%">
                <stop offset="0%" stopColor="#dedbd3" />
                <stop offset="65%" stopColor="#7a7872" />
                <stop offset="100%" stopColor="#2e2d2a" />
              </radialGradient>
              <filter id="laserGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Drifting Lunar Disk */}
            <g transform={`translate(${dx} 0)`}>
              <circle r="155" cx="-40" cy="40" fill="url(#moonSurface)" />
              {/* Mare Tranquillitatis & Craters */}
              <ellipse cx="-15" cy="20" rx="45" ry="32" fill="#585651" opacity="0.65" />
              <circle r="24" cx="-85" cy="15" fill="#4d4b47" opacity="0.5" />
              <circle r="16" cx="35" cy="65" fill="#4d4b47" opacity="0.5" />

              {/* Tranquility Base Apollo 11 LRRR target array */}
              <g transform="translate(0, 0)">
                <circle r="12" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeDasharray="2 3" />
                <rect x="-7" y="-7" width="14" height="14" fill="#e6f2ff" stroke="#000" strokeWidth="1.2" />
                <rect x="-4" y="-4" width="8" height="8" fill="#5294e2" />
                <text y="-14" textAnchor="middle" fontSize="10" fill="#f0f6fc" className="font-mono font-bold">
                  APOLLO 11 LRRR
                </text>
              </g>
            </g>

            {/* Telescope Crosshair Reticle */}
            <g stroke={onTarget ? 'var(--color-ok)' : 'var(--accent)'} strokeWidth="1.4" fill="none">
              <circle r={tol * px} strokeWidth="1.5" />
              <circle r="42" strokeOpacity="0.35" />
              <circle r="85" strokeOpacity="0.15" />
              <line x1="-75" y1="0" x2="-20" y2="0" />
              <line x1="20" y1="0" x2="75" y2="0" />
              <line x1="0" y1="-75" x2="0" y2="-20" />
              <line x1="0" y1="20" x2="0" y2="75" />
            </g>

            {/* Outbound & Inbound Laser Pulse Wavefront */}
            {pulse && (
              <g filter="url(#laserGlow)">
                {/* Outgoing green pulse travels from center to Moon */}
                {pulse.state === 'outbound' && (
                  <circle
                    cx={dx * progress}
                    cy={0}
                    r={4 + (1 - progress * 2) * 8}
                    fill="#52ff8f"
                    opacity={0.9}
                  />
                )}
                {/* Reflector bounce flash */}
                {pulse.state === 'reflecting' && (
                  <circle cx={dx} cy={0} r={18} fill="#ffffff" opacity={0.95} />
                )}
                {/* Inbound return wave returning to detector */}
                {pulse.state === 'inbound' && (
                  <circle
                    cx={dx * (1 - (progress - 0.5) * 2)}
                    cy={0}
                    r={6 + (progress - 0.5) * 14}
                    fill="#38e8ff"
                    opacity={0.85}
                  />
                )}
              </g>
            )}
          </svg>

          {/* Scope Telemetry Overlay */}
          <div className="absolute left-3 top-3 flex flex-col font-mono text-[11px] tracking-wider text-[var(--color-fg-2)]">
            <span className="flex items-center gap-1.5 font-bold">
              <span className={`inline-block h-2 w-2 rounded-full ${onTarget ? 'bg-[var(--color-ok)] animate-pulse' : 'bg-[var(--accent)]'}`} />
              {pulse
                ? pulse.state === 'outbound'
                  ? 'TRANSMISSION · OUTBOUND BEAM'
                  : pulse.state === 'reflecting'
                    ? 'RETROREFLECTOR INTERACTION'
                    : 'RECEIVER · INBOUND PHOTON PACKET'
                : onTarget
                  ? 'OPTICAL LOCK ACHIEVED · READY TO FIRE'
                  : 'STEER APERTURE TO LRRR'}
            </span>
            <span className="text-[10px] text-[var(--color-fg-3)]">
              {pulse ? `FLIGHT TIME: ${pulse.t.toFixed(3)}s / ${pulse.rtt.toFixed(3)}s` : `LRRR OFFSET: ${offset.toFixed(2)}° (TOL: ±${tol}°)`}
            </span>
          </div>

          {/* Synchronous Gate Cue Alert */}
          {pulse && pulse.state === 'inbound' && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <div className={`rounded border px-3 py-1 font-mono text-[11px] font-bold shadow ${gateReady ? 'border-[var(--color-ok)] bg-[var(--color-ok)]/20 text-[var(--color-ok)] animate-ping' : 'border-[var(--accent)] bg-[#0c0d12]/90 text-[var(--accent)]'}`}>
                {remainingTime < 0.25 ? 'SYNC NOW! [SPACE / ENTER]' : `RETURN ECHO IN ${remainingTime.toFixed(2)}s`}
              </div>
            </div>
          )}
        </div>

        {/* Telemetry & Oscilloscope Station Readout */}
        <div className="flex flex-col justify-between gap-2 rounded border border-[var(--color-line-2)] bg-[#0d0e12] p-3 font-mono text-[12px]">
          <div>
            <div className="border-b border-[var(--color-line-2)] pb-1.5 text-[10px] font-bold tracking-widest text-[var(--color-fg-3)]">
              STATION TELEMETRY
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-[11px]">
              <dt className="text-[var(--color-fg-3)]">ECHOES</dt>
              <dd className="text-right font-bold text-[var(--color-ok)]">{successfulReturns}</dd>
              <dt className="text-[var(--color-fg-3)]">AIM DRIFT</dt>
              <dd className={`text-right tabular-nums ${onTarget ? 'text-[var(--color-ok)]' : 'text-[var(--accent)]'}`}>{aim.toFixed(2)}°</dd>
              <dt className="text-[var(--color-fg-3)]">OFFSET</dt>
              <dd className={`text-right tabular-nums ${onTarget ? 'text-[var(--color-ok)] font-bold' : 'text-[var(--color-fg-2)]'}`}>{offset.toFixed(2)}°</dd>
              <dt className="text-[var(--color-fg-3)]">MISSES</dt>
              <dd className="text-right tabular-nums text-[var(--color-bad)]">{misses}</dd>
              <dt className="text-[var(--color-fg-3)]">EST. SCORE</dt>
              <dd className="text-right font-bold text-white">{currentScore}</dd>
            </dl>
          </div>

          {/* Receiver Photon Gate Oscilloscope Visualizer */}
          <div className="rounded border border-[var(--color-line-2)]/70 bg-[#050608] p-2">
            <div className="mb-1 flex justify-between text-[10px] text-[var(--color-fg-3)]">
              <span>RX PHOTON GATE</span>
              <span>{pulse && pulse.state === 'inbound' ? `${Math.round(gateWindowApproach * 100)}%` : 'STANDBY'}</span>
            </div>
            <div className="relative h-5 overflow-hidden rounded bg-[#10121a]">
              {/* Center target capture sweet spot */}
              <div className="absolute inset-y-0 left-1/2 w-4 -translate-x-1/2 border-x border-[var(--color-ok)]/60 bg-[var(--color-ok)]/20" />
              {/* Sweeping arrival needle */}
              {pulse && pulse.state === 'inbound' && (
                <div
                  className="absolute inset-y-0 w-1 bg-cyan-400 transition-all duration-75"
                  style={{
                    left: `${Math.min(100, Math.max(0, 50 - (pulse.t - pulse.rtt) * 120))}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Feedback Readout Box */}
          <div className="min-h-[46px] rounded bg-[#14161f] p-2">
            {lastFeedback ? (
              <div className={lastFeedback.kind === 'ok' ? 'text-[var(--color-ok)]' : lastFeedback.kind === 'bad' ? 'text-[var(--color-bad)]' : 'text-[var(--accent)]'}>
                <div className="font-bold text-[10px] leading-tight">{lastFeedback.text}</div>
                {lastFeedback.sub && <div className="text-[9.5px] leading-snug text-[var(--color-fg-3)]">{lastFeedback.sub}</div>}
              </div>
            ) : (
              <span className="text-[10px] text-[var(--color-fg-3)]">Align reticle on Apollo 11 LRRR and transmit pulse.</span>
            )}
          </div>
        </div>
      </div>

      {/* Telescope Aiming Slider */}
      <label className="flex flex-col gap-1.5">
        <div className="flex justify-between font-mono text-[11px]">
          <span className="text-[var(--color-fg-3)] tracking-wider">TELESCOPE AZIMUTH ALIGNMENT</span>
          <span className={onTarget ? 'text-[var(--color-ok)] font-semibold' : 'text-[var(--accent)]'}>
            {onTarget ? '✓ RETICLE LOCKED ON RETROREFLECTOR' : `OFF TARGET: ${tgt > aim ? 'ADJUST RIGHT →' : '← ADJUST LEFT'}`}
          </span>
        </div>
        <input
          type="range"
          min={-half}
          max={half}
          step={0.04}
          value={aim}
          onChange={(e) => setAim(Number(e.target.value))}
          className="range"
          aria-valuetext={`${aim.toFixed(2)} degrees`}
        />
      </label>

      {/* Action Trigger Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!pulse ? (
            <button
              type="button"
              className="btn-primary"
              onClick={fire}
              disabled={elapsed >= durationSec}
            >
              Transmit Laser Pulse
            </button>
          ) : pulse.state === 'inbound' ? (
            <button
              type="button"
              className={`btn-primary ${gateReady ? 'ring-2 ring-[var(--color-ok)] bg-[var(--color-ok)] text-black' : ''}`}
              onClick={syncReceiverGate}
            >
              Sync Receiver Gate!
            </button>
          ) : (
            <button type="button" className="btn-primary opacity-60 cursor-not-allowed" disabled>
              Pulse Outbound ({remainingTime.toFixed(1)}s)...
            </button>
          )}
        </div>

        <div className="font-mono text-[11px] text-[var(--color-fg-3)]">
          <span>Keyboard: ← → steer · Space/Enter {pulse?.state === 'inbound' ? 'syncs gate' : 'fires'}</span>
        </div>
      </div>
    </div>
  );
}
