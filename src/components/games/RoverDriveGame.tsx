/**
 * Signal Delay — full-screen rover drive game. DOM HUD + command dock over the
 * 3D scene (or the 2D map). Copy comes from missions.json `extraGame`.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ExtraGame } from '../../data/types';
import { useAppStore } from '../../store/useAppStore';
import { hasWebGL } from '../../lib/device';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { blip, motorHum, setSoundEnabled, uplinkStatic, winChime } from '../../lib/audio';
import { distToTarget, RULES, score } from '../../games/roverDrive/engine';
import {
  clockProgress,
  poseAt,
  resetRoverSession,
  UPLINK_SEC,
  usePrediction,
  useRoverStore,
} from '../../games/roverDrive/store';
import type { Command, SimEvent, SolReport } from '../../games/roverDrive/types';
import { IconClose, IconMute, IconRetry, IconSound, IconTrophy } from '../ui/Icons';
import './roverDrive.css';

const RoverDriveScene = lazy(() => import('../three/RoverDriveScene'));
const RoverDrive2D = lazy(() => import('./RoverDrive2D'));

// ---------------------------------------------------------------------------
// Helpers

const cmdLabel = (c: Command) => {
  switch (c.type) {
    case 'forward':
      return `Forward ${c.m} m`;
    case 'back':
      return `Back ${c.m} m`;
    case 'turn':
      return `Turn ${c.deg > 0 ? 'left' : 'right'} ${Math.abs(c.deg)}°`;
    case 'scan':
      return 'SCAN';
  }
};

const cmdGlyph = (c: Command) =>
  c.type === 'forward' ? '↑' : c.type === 'back' ? '↓' : c.type === 'turn' ? (c.deg > 0 ? '↶' : '↷') : '◎';

const EVENT_PRIORITY: (SimEvent | 'clean')[] = ['scan_ok', 'rock_stop', 'turn_blocked', 'tilt_stop', 'edge_stop', 'scan_range', 'slip', 'tilt_warning'];

function whatHappened(r: SolReport, copy: ExtraGame) {
  const e = EVENT_PRIORITY.find((k) => r.actual.events.includes(k as SimEvent));
  return copy.events[(e ?? 'clean') as keyof ExtraGame['events']];
}

/** Re-render at ~10 Hz while the playback clock runs (HUD values during a drive). */
function useTicker(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => set((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [active]);
}

function useFps(enabled: boolean) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (t: number) => {
      frames++;
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
  return fps;
}

/** Drives the uplink/playback clock and the phase side effects (audio, results, announcements). */
function useFlow(copy: ExtraGame, announce: (s: string) => void) {
  const phase = useRoverStore((s) => s.phase);
  const paused = useRoverStore((s) => s.pausedAt !== null);
  const recordRover = useAppStore((s) => s.recordRover);
  const stopSound = useRef<() => void>(() => {});

  useEffect(() => {
    if ((phase !== 'uplink' && phase !== 'executing') || paused) return;
    let raf = 0;
    const loop = (t: number) => {
      useRoverStore.getState().tick(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, paused]);

  useEffect(() => {
    stopSound.current();
    stopSound.current = () => {};
    if (paused) return;
    if (phase === 'uplink') {
      stopSound.current = uplinkStatic();
      announce(`Uplink sent. ${copy.uplinkNote}.`);
    } else if (phase === 'executing') {
      stopSound.current = motorHum();
    }
    return () => {
      stopSound.current();
      stopSound.current = () => {};
    };
  }, [phase, paused, copy, announce]);

  useEffect(() => {
    const st = useRoverStore.getState();
    const r = st.report;
    if (!r) return;
    if (phase === 'downlink') {
      const faults = r.actual.events.some((e) => e === 'rock_stop' || e === 'tilt_stop' || e === 'turn_blocked' || e === 'edge_stop');
      blip(faults ? 'bad' : 'ok');
      announce(
        `Downlink, sol ${r.sol}. Planned ${r.predicted.actualDistance.toFixed(1)} metres, drove ${r.actual.actualDistance.toFixed(1)}. ` +
          `Slip ${Math.round(r.slip * 100)} percent. Battery ${Math.round(r.batteryAfterRecharge)} percent. ${whatHappened(r, copy)}`,
      );
    } else if (phase === 'won' || phase === 'lost') {
      const s = score(st.game.rover);
      recordRover(s.points, s.stars, phase === 'won');
      if (phase === 'won') {
        winChime();
        announce(`Mission complete. Score ${s.points}, ${s.stars} stars. ${copy.outcomes.won}`);
      } else {
        blip('bad');
        announce(`Mission lost. ${copy.outcomes[st.game.rover.loseReason ?? 'sols']}`);
      }
    }
  }, [phase, copy, announce, recordRover]);
}

// ---------------------------------------------------------------------------
// HUD pieces

function TopBar({ copy }: { copy: ExtraGame }) {
  const phase = useRoverStore((s) => s.phase);
  const rover = useRoverStore((s) => s.game.rover);
  const t = useRoverStore((s) => s.game.terrain);
  useTicker(phase === 'executing');
  const pred = usePrediction();
  const st = useRoverStore.getState();
  let battery = rover.battery;
  let tilt = 0;
  let x = rover.x;
  let z = rover.z;
  if (phase === 'executing' && st.report) {
    const u = clockProgress(st);
    const p = poseAt(st.report.actual.path, st.timeline, u);
    battery = st.report.batteryBefore + (st.report.batteryAfterDrive - st.report.batteryBefore) * u;
    tilt = p.tilt;
    x = p.x;
    z = p.z;
  } else {
    const path = st.report?.actual.path;
    tilt = phase === 'planning' || !path ? (pred.path[0]?.tilt ?? 0) : (path[path.length - 1]?.tilt ?? 0);
  }
  const dist = distToTarget(t, x, z);
  const low = battery < 20;
  const tiltState = tilt > RULES.tiltStopDeg ? 'bad' : tilt > RULES.tiltWarnDeg ? 'warn' : 'ok';
  return (
    <div className="rd-top" role="group" aria-label="Rover status">
      <div className="rd-stat">
        <span className="rd-stat__k">Sol</span>
        <span className="rd-stat__v">
          {rover.sol}
          <small>/{RULES.maxSols}</small>
        </span>
      </div>
      <div className="rd-stat rd-stat--wide" data-state={low ? 'bad' : undefined}>
        <span className="rd-stat__k">Battery</span>
        <span className="rd-battery" aria-hidden="true">
          <span style={{ width: `${Math.max(0, battery)}%` }} />
        </span>
        <span className="rd-stat__v">{Math.round(battery)}%</span>
      </div>
      <div className="rd-stat" data-state={tiltState}>
        <span className="rd-stat__k">Tilt</span>
        <span className="rd-tilt" aria-hidden="true" style={{ transform: `rotate(${Math.min(45, tilt)}deg)` }} />
        <span className="rd-stat__v">{tilt.toFixed(0)}°</span>
      </div>
      <div className="rd-stat">
        <span className="rd-stat__k">Target</span>
        <span className="rd-stat__v">
          {dist.toFixed(dist < 10 ? 1 : 0)}
          <small> m</small>
        </span>
      </div>
      <span className="sr-only">{copy.title}</span>
    </div>
  );
}

function FaultLog() {
  const faults = useRoverStore((s) => s.game.rover.faults);
  const phase = useRoverStore((s) => s.phase);
  if (!faults.length || phase === 'executing') return null;
  const labels: Record<string, string> = {
    rock: 'Rock hazard',
    tilt: 'Tilt limit',
    edge: 'Map edge',
    turn_blocked: 'Turn blocked',
    scan_range: 'Scan out of range',
  };
  return (
    <div className="rd-faults">
      <p className="rd-label">Fault log</p>
      <ol>
        {faults.slice(-4).map((f, i) => (
          <li key={i}>
            <span>Sol {f.sol}</span> {labels[f.code]}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Dock({ copy }: { copy: ExtraGame }) {
  const queue = useRoverStore((s) => s.queue);
  const dist = useRoverStore((s) => s.dist);
  const { add, remove, move, clear, setDist, send } = useRoverStore.getState();
  const pred = usePrediction();
  const full = queue.length >= RULES.maxCommands;
  const battEnd = pred.end.battery;
  const warn =
    pred.end.status === 'lost'
      ? pred.end.loseReason === 'tipover'
        ? 'Predicted: tip-over!'
        : 'Predicted: battery runs out!'
      : pred.events.includes('rock_stop')
        ? 'Predicted: a rock stops the drive.'
        : pred.events.includes('turn_blocked')
          ? 'Predicted: a rock blocks a turn.'
          : pred.events.includes('tilt_stop')
            ? 'Predicted: tilt over 30°, rover will stop.'
            : pred.maxTilt > RULES.tiltWarnDeg
              ? `Predicted tilt ${pred.maxTilt.toFixed(0)}°.`
              : pred.path.some((p) => p.sand > 0.5)
                ? 'Route crosses soft sand: expect slip.'
                : null;

  const palette: { c: Command; label: string; key: string }[] = [
    { c: { type: 'turn', deg: 45 }, label: 'Left 45°', key: 'Shift+A' },
    { c: { type: 'turn', deg: 15 }, label: 'Left 15°', key: 'A' },
    { c: { type: 'forward', m: dist }, label: `Forward ${dist} m`, key: 'W' },
    { c: { type: 'turn', deg: -15 }, label: 'Right 15°', key: 'D' },
    { c: { type: 'turn', deg: -45 }, label: 'Right 45°', key: 'Shift+D' },
    { c: { type: 'back', m: 1 }, label: 'Back 1 m', key: 'S' },
    { c: { type: 'scan' }, label: 'SCAN', key: 'Q' },
  ];

  return (
    <div className="rd-dock" role="region" aria-label="Drive plan">
      <div className="rd-dock__palette">
        <div className="rd-seg" role="radiogroup" aria-label="Forward distance">
          {([1, 2, 5] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={dist === m}
              className="rd-seg__btn"
              onClick={() => setDist(m)}
              title={`Key ${m}`}
            >
              {m} m
            </button>
          ))}
        </div>
        <div className="rd-cmds">
          {palette.map(({ c, label, key }) => (
            <button
              key={label}
              type="button"
              className={`rd-cmd ${c.type === 'forward' ? 'rd-cmd--main' : ''} ${c.type === 'scan' ? 'rd-cmd--scan' : ''}`}
              disabled={full}
              onClick={() => {
                add(c);
                blip('tick');
              }}
              aria-keyshortcuts={key.replace('Shift+', 'Shift+')}
            >
              <span aria-hidden="true" className="rd-cmd__g">
                {cmdGlyph(c)}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rd-dock__queue">
        <div className="rd-dock__head">
          <p className="rd-label">
            Sol plan <span className="rd-count">{queue.length}/{RULES.maxCommands}</span>
          </p>
          <button type="button" className="rd-link" onClick={clear} disabled={!queue.length}>
            Clear
          </button>
        </div>
        {queue.length === 0 ? (
          <p className="rd-empty">Add up to {RULES.maxCommands} commands. The dashed ghost path shows the predicted route.</p>
        ) : (
          <ol className="rd-queue" aria-label="Command queue">
            {queue.map((c, i) => (
              <li key={i} className="rd-queue__item" data-bad={pred.haltedAt === i || undefined}>
                <span className="rd-queue__n">{i + 1}</span>
                <span className="rd-queue__t">{cmdLabel(c)}</span>
                <button type="button" className="rd-mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${cmdLabel(c)} up`}>
                  ▲
                </button>
                <button
                  type="button"
                  className="rd-mini"
                  onClick={() => move(i, 1)}
                  disabled={i === queue.length - 1}
                  aria-label={`Move ${cmdLabel(c)} down`}
                >
                  ▼
                </button>
                <button type="button" className="rd-mini" onClick={() => remove(i)} aria-label={`Remove ${cmdLabel(c)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rd-dock__send">
        <p className="rd-predict">
          <span className="rd-label">Predicted battery</span>
          <span>
            {Math.round(useRoverStore.getState().game.rover.battery)}% → <b data-low={battEnd < 20 || undefined}>{Math.round(battEnd)}%</b>
          </span>
        </p>
        <p className="rd-warn" data-on={!!warn || undefined} aria-live="off">
          {warn ?? `${pred.actualDistance.toFixed(1)} m planned`}
        </p>
        <button type="button" className="rd-send" onClick={send} disabled={!queue.length} aria-keyshortcuts="Enter">
          Send uplink <span aria-hidden="true">⟶</span>
        </button>
        <p className="rd-hint">{copy.uplinkNote}</p>
      </div>
    </div>
  );
}

function UplinkOverlay({ copy }: { copy: ExtraGame }) {
  useTicker(true);
  const st = useRoverStore.getState();
  const u = clockProgress(st);
  const left = Math.max(0, UPLINK_SEC * (1 - u));
  return (
    <div className="rd-center rd-uplink" role="status">
      <p className="rd-label">Uplink in transit</p>
      <p className="rd-uplink__t">{left.toFixed(1)}s</p>
      <span className="rd-uplink__bar" aria-hidden="true">
        <span style={{ width: `${u * 100}%` }} />
      </span>
      <p className="rd-hint">{copy.uplinkNote}</p>
    </div>
  );
}

function ExecutingChip() {
  const sol = useRoverStore((s) => s.report?.sol);
  return (
    <div className="rd-chip" role="status">
      <span className="rd-dot" aria-hidden="true" /> Executing sol {sol} · downlink pending
    </div>
  );
}

function Summary({ r, copy }: { r: SolReport; copy: ExtraGame }) {
  const delta = r.batteryAfterDrive - r.batteryBefore;
  return (
    <dl className="rd-sum">
      <div>
        <dt>Planned</dt>
        <dd>{r.predicted.actualDistance.toFixed(1)} m</dd>
      </div>
      <div>
        <dt>Actual</dt>
        <dd>{r.actual.actualDistance.toFixed(1)} m</dd>
      </div>
      <div>
        <dt>Slip</dt>
        <dd>{Math.round(r.slip * 100)}%</dd>
      </div>
      <div>
        <dt>Battery</dt>
        <dd>
          {delta.toFixed(0)}%
          {r.batteryAfterRecharge > r.batteryAfterDrive && (
            <small className="rd-sum__sub">+{(r.batteryAfterRecharge - r.batteryAfterDrive).toFixed(0)}% overnight</small>
          )}
        </dd>
      </div>
      <p className="rd-sum__what">{whatHappened(r, copy)}</p>
    </dl>
  );
}

function DownlinkCard({ copy }: { copy: ExtraGame }) {
  const r = useRoverStore((s) => s.report);
  const sol = useRoverStore((s) => s.game.rover.sol);
  const nextSol = useRoverStore((s) => s.nextSol);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  if (!r) return null;
  return (
    <div className="rd-card rd-card--side" role="dialog" aria-label={`Downlink, sol ${r.sol}`}>
      <p className="rd-label">Downlink · sol {r.sol}</p>
      <Summary r={r} copy={copy} />
      <button ref={btn} type="button" className="rd-send" onClick={nextSol}>
        Plan sol {sol} <span aria-hidden="true">⟶</span>
      </button>
    </div>
  );
}

function EndCard({ copy, onExit, exitLabel }: { copy: ExtraGame; onExit: () => void; exitLabel: string }) {
  const phase = useRoverStore((s) => s.phase);
  const rover = useRoverStore((s) => s.game.rover);
  const r = useRoverStore((s) => s.report);
  const restart = useRoverStore((s) => s.restart);
  const wins = useAppStore((s) => s.roverResult?.wins ?? 0);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  const won = phase === 'won';
  const s = score(rover);
  const firstWin = won && wins === 1;
  return (
    <div className="rd-center">
      <div className="rd-card rd-card--end" role="dialog" aria-modal="true" aria-labelledby="rd-end-title">
        <p className="rd-label">{won ? 'Mission complete' : 'Mission lost'}</p>
        <h2 id="rd-end-title" className="rd-title">
          {won ? 'Hematite confirmed' : { sand: 'Stuck in sand', battery: 'Out of power', tipover: 'Tipped over', sols: 'Out of sols' }[rover.loseReason ?? 'sols']}
        </h2>
        <p className="rd-body">{won ? copy.outcomes.won : copy.outcomes[rover.loseReason ?? 'sols']}</p>
        {won && (
          <div className="rd-score">
            <span className="rd-stars" aria-label={`${s.stars} of 3 stars`}>
              {[1, 2, 3].map((i) => (
                <span key={i} data-on={i <= s.stars || undefined} aria-hidden="true">
                  ★
                </span>
              ))}
            </span>
            <span className="rd-score__n">{s.points}</span>
            <span className="rd-hint">
              Sol {rover.sol} · {Math.round(rover.battery)}% battery · {rover.hazardFaults} hazard fault{rover.hazardFaults === 1 ? '' : 's'}
            </span>
          </div>
        )}
        {firstWin && (
          <div className="rd-badge">
            <span className="badge-orb" aria-hidden="true">
              <IconTrophy size={20} />
            </span>
            <div>
              <p className="rd-label">Badge unlocked</p>
              <p className="rd-badge__n">{copy.badge.name}</p>
            </div>
          </div>
        )}
        {r && <Summary r={r} copy={copy} />}
        <div className="rd-actions">
          <button ref={btn} type="button" className="rd-send" onClick={restart} aria-keyshortcuts="R">
            <IconRetry size={16} /> Retry
          </button>
          <button type="button" className="rd-ghost" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Rules({ copy }: { copy: ExtraGame }) {
  return (
    <div className="rd-rules">
      <p className="rd-label">{copy.rulesTitle}</p>
      <ul>
        {copy.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="rd-hint">{copy.rulesNote}</p>
    </div>
  );
}

function Briefing({ copy, onExit }: { copy: ExtraGame; onExit: () => void }) {
  const start = useRoverStore((s) => s.start);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="rd-brief">
      <div className="rd-brief__inner">
        <p className="rd-label">Issue 01 · {copy.kicker}</p>
        <h1 className="rd-brief__title">{copy.title}</h1>
        <div className="rd-brief__lines">
          {copy.briefing.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <Rules copy={copy} />
        <p className="rd-hint">{copy.timeNote}</p>
        <div className="rd-actions">
          <button ref={btn} type="button" className="rd-start" onClick={start}>
            Start mission
          </button>
          <button type="button" className="rd-ghost" onClick={onExit}>
            Back
          </button>
        </div>
        <p className="rd-keys">W/S drive · A/D turn (Shift = 45°) · 1/2/5 distance · Q scan · Enter send · Backspace undo · C camera · H hide HUD · Esc pause</p>
      </div>
    </div>
  );
}

function PauseMenu({ copy, onExit, exitLabel }: { copy: ExtraGame; onExit: () => void; exitLabel: string }) {
  const menu = useRoverStore((s) => s.menu);
  const { openMenu, restart } = useRoverStore.getState();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [menu]);
  return (
    <div className="rd-center rd-scrim">
      <div className="rd-card rd-card--menu" role="dialog" aria-modal="true" aria-label={menu === 'rules' ? copy.rulesTitle : 'Paused'}>
        {menu === 'rules' ? (
          <>
            <Rules copy={copy} />
            <button ref={first} type="button" className="rd-send" onClick={() => openMenu('pause')}>
              Back
            </button>
          </>
        ) : (
          <>
            <p className="rd-label">Paused</p>
            <h2 className="rd-title">{copy.title}</h2>
            <div className="rd-menu">
              <button ref={first} type="button" className="rd-send" onClick={() => openMenu(null)}>
                Resume
              </button>
              <button type="button" className="rd-ghost" onClick={restart}>
                Restart
              </button>
              <button type="button" className="rd-ghost" onClick={() => openMenu('rules')}>
                {copy.rulesTitle}
              </button>
              <button type="button" className="rd-ghost" onClick={onExit}>
                {exitLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function RoverDriveGame({ copy, onExit, exitLabel }: { copy: ExtraGame; onExit: () => void; exitLabel: string }) {
  const root = useRef<HTMLDivElement>(null);
  const phase = useRoverStore((s) => s.phase);
  const cam = useRoverStore((s) => s.cam);
  const hud = useRoverStore((s) => s.hud);
  const menu = useRoverStore((s) => s.menu);
  const view = useRoverStore((s) => s.view);
  const soundOn = useAppStore((s) => s.soundOn);
  const setSound = useAppStore((s) => s.setSound);
  const reduced = useReducedMotion();
  const gl = hasWebGL();
  const use3d = gl && view === '3d';
  const [live, setLive] = useState('');
  const [fs, setFs] = useState(false);
  const [rotateHint, setRotateHint] = useState(true);
  const showFps = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fps');
  const fps = useFps(showFps);

  const announce = useCallback((s: string) => setLive(s), []);
  useFlow(copy, announce);

  // Fresh session on mount; nothing leaks between visits.
  useEffect(() => {
    resetRoverSession();
    if (!gl) useRoverStore.getState().setView('2d');
  }, [gl]);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  const canFs = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void root.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const toggleSound = useCallback(() => {
    const next = !useAppStore.getState().soundOn;
    setSound(next);
    setSoundEnabled(next);
  }, [setSound]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useRoverStore.getState();
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
        if (st.phase === 'briefing') return;
        st.openMenu(st.menu ? null : 'pause');
        return;
      }
      if (st.menu) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const onButton = tag === 'BUTTON';
      const lower = k.toLowerCase();
      if (lower === 'h') return st.toggleHud();
      if (lower === 'c' && use3d) return st.cycleCam();
      if (lower === 'm') return toggleSound();
      if (lower === 'f' && canFs) return toggleFs();
      if (lower === 'r' && (st.phase === 'won' || st.phase === 'lost')) return st.restart();
      if (st.phase !== 'planning') return;
      if (k === '1' || k === '2' || k === '5') return st.setDist(Number(k) as 1 | 2 | 5);
      const add = (c: Command) => {
        e.preventDefault();
        st.add(c);
        blip('tick');
      };
      if (lower === 'w' || k === 'ArrowUp') return add({ type: 'forward', m: st.dist });
      if (lower === 's' || k === 'ArrowDown') return add({ type: 'back', m: 1 });
      if (lower === 'a' || k === 'ArrowLeft') return add({ type: 'turn', deg: e.shiftKey ? 45 : 15 });
      if (lower === 'd' || k === 'ArrowRight') return add({ type: 'turn', deg: e.shiftKey ? -45 : -15 });
      if (lower === 'q') return add({ type: 'scan' });
      if (k === 'Backspace') {
        e.preventDefault();
        return st.remove(st.queue.length - 1);
      }
      if (k === 'Enter' && !onButton) {
        e.preventDefault();
        return st.send();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [use3d, toggleFs, toggleSound, canFs]);

  const paused = menu !== null;
  const showHud = hud && phase !== 'briefing';
  const ended = phase === 'won' || phase === 'lost';

  return (
    <div ref={root} className="rd" data-cam={use3d ? cam : 'map2d'} data-reduced={reduced || undefined}>
      <div className="rd-stage">
        <Suspense fallback={<div className="rd-loading" role="status">Acquiring signal…</div>}>
          {use3d ? <RoverDriveScene paused={paused && phase !== 'briefing'} /> : <RoverDrive2D />}
        </Suspense>
        {use3d && cam === 'hazcam' && phase !== 'briefing' && <div className="rd-hazcam" aria-hidden="true" />}
      </div>

      <AnimatePresence>
        {phase === 'briefing' && (
          <motion.div
            key="brief"
            className="rd-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduced ? dur.fast : dur.slow, delay: reduced ? 0 : dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
          >
            <Briefing copy={copy} onExit={onExit} />
          </motion.div>
        )}
      </AnimatePresence>

      {showHud && (
        <>
          <TopBar copy={copy} />
          <FaultLog />
          {phase === 'planning' && <Dock copy={copy} />}
          {phase === 'uplink' && <UplinkOverlay copy={copy} />}
          {phase === 'executing' && <ExecutingChip />}
          {phase === 'downlink' && <DownlinkCard copy={copy} />}
        </>
      )}
      {!hud && phase !== 'briefing' && phase === 'downlink' && <DownlinkCard copy={copy} />}
      {ended && <EndCard copy={copy} onExit={onExit} exitLabel={exitLabel} />}

      <div className="rd-corner" role="toolbar" aria-label="Game controls">
        {phase !== 'briefing' && gl && (
          <button type="button" className="rd-icon" onClick={() => useRoverStore.getState().setView(view === '3d' ? '2d' : '3d')} aria-label={view === '3d' ? 'Switch to 2D map' : 'Switch to 3D view'}>
            <span className="rd-l-full">{view === '3d' ? '2D map' : '3D view'}</span>
            <span className="rd-l-short" aria-hidden="true">{view === '3d' ? '2D' : '3D'}</span>
          </button>
        )}
        {phase !== 'briefing' && use3d && (
          <button type="button" className="rd-icon" onClick={() => useRoverStore.getState().cycleCam()} aria-keyshortcuts="C" aria-label={`Camera: ${cam}. Switch camera`}>
            <span className="rd-l-full">{cam === 'chase' ? 'Chase' : cam === 'hazcam' ? 'Hazcam' : 'Map'}</span>
            <span className="rd-l-short" aria-hidden="true">{cam === 'chase' ? 'Chs' : cam === 'hazcam' ? 'Haz' : 'Map'}</span>
          </button>
        )}
        {phase !== 'briefing' && (
          <button type="button" className="rd-icon" onClick={() => useRoverStore.getState().toggleHud()} aria-label={hud ? 'Hide HUD' : 'Show HUD'} aria-keyshortcuts="H">
            <span className="rd-l-full">{hud ? 'Hide HUD' : 'Show HUD'}</span>
            <span className="rd-l-short" aria-hidden="true">HUD</span>
          </button>
        )}
        <button type="button" className="rd-icon rd-icon--sq" onClick={toggleSound} aria-label={soundOn ? 'Mute sound' : 'Turn sound on'} aria-keyshortcuts="M">
          {soundOn ? <IconSound size={18} /> : <IconMute size={18} />}
        </button>
        {canFs && (
          <button type="button" className="rd-icon rd-icon--sq" onClick={toggleFs} aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'} aria-keyshortcuts="F">
            <span aria-hidden="true">{fs ? '⤡' : '⤢'}</span>
          </button>
        )}
        {phase !== 'briefing' && (
          <button type="button" className="rd-icon rd-icon--sq" onClick={() => useRoverStore.getState().openMenu('pause')} aria-label="Pause" aria-keyshortcuts="Escape">
            <span aria-hidden="true">❚❚</span>
          </button>
        )}
        <button type="button" className="rd-icon rd-icon--sq" onClick={onExit} aria-label={exitLabel}>
          <IconClose size={18} />
        </button>
      </div>

      {showFps && <div className="rd-fps">{fps} fps</div>}

      {rotateHint && (
        <button type="button" className="rd-rotate" onClick={() => setRotateHint(false)}>
          Rotate your device for the best view <span aria-hidden="true">✕</span>
        </button>
      )}

      {menu && <PauseMenu copy={copy} onExit={onExit} exitLabel={exitLabel} />}

      <div className="sr-only" aria-live="polite" role="status">
        {live}
      </div>
    </div>
  );
}
