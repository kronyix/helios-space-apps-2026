/**
 * Signal Delay — orchestrator for the full-screen rover drive game.
 * Combines the 3D/2D stage, virtual presentation playhead & audio mixer, keyboard handler, and ui/* modules.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import type { ExtraGame } from '../../data/types';
import { useAppStore } from '../../store/useAppStore';
import { hasWebGL } from '../../lib/device';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import {
  blip,
  lostSignalTone,
  rockThunk,
  scanPing,
  setMasterVolume,
  setRoverAmbientActive,
  setSoundEnabled,
  startRoverDriveAudio,
  triggerHaptic,
  uplinkStatic,
  winChime,
} from '../../lib/audio';
import { score } from '../../games/roverDrive/engine';
import { poseAt, resetRoverSession, useRoverStore } from '../../games/roverDrive/store';
import type { Command } from '../../games/roverDrive/types';
import { IntroScreen } from '../../games/roverDrive/ui/IntroScreen';
import { HowToSheet } from '../../games/roverDrive/ui/HowToSheet';
import { Hud } from '../../games/roverDrive/ui/Hud';
import { CommandDock } from '../../games/roverDrive/ui/CommandDock';
import { CoachMarks } from '../../games/roverDrive/ui/CoachMarks';
import { Toasts } from '../../games/roverDrive/ui/Toasts';
import { Captions } from '../../games/roverDrive/ui/Captions';
import { ExecutingChip, SolStartCard, UplinkOverlay } from '../../games/roverDrive/ui/UplinkOverlay';
import { DownlinkReport } from '../../games/roverDrive/ui/DownlinkReport';
import { EndScreen } from '../../games/roverDrive/ui/EndScreen';
import { PauseMenu } from '../../games/roverDrive/ui/PauseMenu';
import {
  advanceExecClock,
  consumeSkipExec,
  describeSolReport,
  getExecProgress,
  nudgePlanOrbit,
  requestSkipExec,
  resetExecPlayhead,
  resetPlanOrbit,
  triggerTipoverSlowMo,
  useRoverUiStore,
} from '../../games/roverDrive/ui/uiStore';
import './roverDrive.css';

const RoverDriveScene = lazy(() => import('../three/RoverDriveScene'));
const RoverDrive2D = lazy(() => import('./RoverDrive2D'));

export interface RoverExitOutcome {
  won: boolean;
  stars: number;
  points: number;
  sols: number;
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

/** Drives uplink/execution clock (with 1x/2x/slow-mo/skip), layered audio cues, and ARIA live announcements. */
function useGameFlow(copy: ExtraGame, announce: (s: string) => void, tabHidden: boolean) {
  const { phase, paused } = useRoverStore(
    useShallow((s) => ({
      phase: s.phase,
      paused: s.pausedAt !== null,
    })),
  );
  const recordRover = useAppStore((s) => s.recordRover);
  const stopSound = useRef<() => void>(() => {});
  const driveAudio = useRef<ReturnType<typeof startRoverDriveAudio> | null>(null);

  useEffect(() => {
    if ((phase !== 'uplink' && phase !== 'executing') || paused || tabHidden) return;
    let raf = 0;
    let prevReal = performance.now();
    let prevX = 0;
    let prevZ = 0;
    let hasPrevPos = false;
    let tipoverSlowFired = false;

    const loop = (t: number) => {
      const realDtMs = Math.min(80, Math.max(0, t - prevReal));
      prevReal = t;
      const st = useRoverStore.getState();

      if (st.phase === 'uplink') {
        st.tick(t);
      } else if (st.phase === 'executing' && st.clock) {
        const ui = useRoverUiStore.getState();
        if (consumeSkipExec()) {
          st.tick(st.clock.start + st.clock.dur * 1000 + 25);
          return;
        }
        const vNow = advanceExecClock(st.clock.start, realDtMs, t, ui.execSpeed);
        if (st.report) {
          const u = getExecProgress(st, vNow);
          if (!tipoverSlowFired && st.report.actual.events.includes('tipover') && u >= 0.78) {
            tipoverSlowFired = true;
            triggerTipoverSlowMo(t);
          }
          if (driveAudio.current) {
            const p = poseAt(st.report.actual.path, st.timeline, u);
            const dtSec = Math.max(0.008, realDtMs / 1000);
            const speed = hasPrevPos ? Math.hypot(p.x - prevX, p.z - prevZ) / dtSec : 0;
            prevX = p.x;
            prevZ = p.z;
            hasPrevPos = true;
            driveAudio.current.update(speed, p.sand);
          }
        }
        st.tick(vNow);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, paused, tabHidden]);

  // Sol banner & ambient audio cues per phase
  useEffect(() => {
    stopSound.current();
    stopSound.current = () => {};
    driveAudio.current?.stop();
    driveAudio.current = null;

    if (paused || tabHidden) return;
    if (phase === 'uplink') {
      stopSound.current = uplinkStatic();
      announce(`Uplink sent. ${copy.uplinkNote}.`);
    } else if (phase === 'executing') {
      const sol = useRoverStore.getState().report?.sol ?? useRoverStore.getState().game.rover.sol;
      useRoverUiStore.getState().setSolBannerSol(sol);
      const handle = startRoverDriveAudio();
      driveAudio.current = handle;
      stopSound.current = handle.stop;
    }
    return () => {
      stopSound.current();
      stopSound.current = () => {};
      driveAudio.current = null;
    };
  }, [phase, paused, tabHidden, copy.uplinkNote, announce]);

  // Phase transition SFX, haptics & ARIA announcements
  useEffect(() => {
    const st = useRoverStore.getState();
    const r = st.report;
    const hapticsOn = useAppStore.getState().hapticsOn;
    if (!r) return;

    if (phase === 'downlink') {
      useRoverUiStore.getState().markDownlinkAt(performance.now());
      const evs = r.actual.events;
      const hitRock = evs.includes('rock_stop') || evs.includes('turn_blocked');
      const scannedOk = evs.includes('scan_ok');
      const scannedBad = evs.includes('scan_range');
      const faults = hitRock || evs.includes('tilt_stop') || evs.includes('edge_stop');

      if (hitRock) {
        rockThunk();
        triggerHaptic('rock', hapticsOn);
      } else if (scannedOk || scannedBad) {
        scanPing(scannedOk);
      } else {
        blip(faults ? 'bad' : 'ok');
      }

      announce(
        `Downlink, sol ${r.sol}. Planned ${r.predicted.actualDistance.toFixed(1)} metres, drove ${r.actual.actualDistance.toFixed(1)}. ` +
          `Slip ${Math.round(r.slip * 100)} percent. Battery ${Math.round(r.batteryAfterRecharge)} percent. ${describeSolReport(r)}`,
      );
    } else if (phase === 'won' || phase === 'lost') {
      useRoverUiStore.getState().markDownlinkAt(performance.now());
      const s = score(st.game.rover);
      recordRover(s.points, s.stars, phase === 'won');
      if (phase === 'won') {
        scanPing(true);
        winChime();
        announce(`Mission complete. Score ${s.points}, ${s.stars} stars. ${copy.outcomes.won}`);
      } else {
        if (r.actual.events.includes('rock_stop')) rockThunk();
        lostSignalTone();
        announce(`Mission lost. ${copy.outcomes[st.game.rover.loseReason ?? 'sols']}`);
      }
    }
  }, [phase, copy.outcomes, announce, recordRover]);
}

export default function RoverDriveGame({
  copy,
  onExit,
  exitLabel,
}: {
  copy: ExtraGame;
  onExit: (outcome?: RoverExitOutcome) => void;
  exitLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { phase, cam, hud, menu, view } = useRoverStore(
    useShallow((s) => ({
      phase: s.phase,
      cam: s.cam,
      hud: s.hud,
      menu: s.menu,
      view: s.view,
    })),
  );
  const howToOpen = useRoverUiStore((s) => s.howToOpen);
  const perfStats = useRoverUiStore((s) => s.perfStats);
  const qualityTier = useRoverUiStore((s) => s.qualityTier);
  const { soundOn, masterVolume, setSound, setRoverView } = useAppStore(
    useShallow((s) => ({
      soundOn: s.soundOn,
      masterVolume: s.masterVolume,
      setSound: s.setSound,
      setRoverView: s.setRoverView,
    })),
  );

  const reduced = useReducedMotion();
  const gl = hasWebGL();
  const use3d = gl && view === '3d';
  const [liveMsg, setLiveMsg] = useState('');
  const [fs, setFs] = useState(false);
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const showPerf = !!searchParams && (searchParams.has('perf') || searchParams.has('fps'));
  const fps = useFps(showPerf && !use3d);

  const announce = useCallback((s: string) => setLiveMsg(s), []);
  useGameFlow(copy, announce, tabHidden);

  const handleExit = useCallback(() => {
    const st = useRoverStore.getState();
    if (st.phase === 'won' || st.phase === 'lost') {
      const s = score(st.game.rover);
      onExit({ won: st.phase === 'won', stars: s.stars, points: s.points, sols: st.game.rover.sol });
    } else {
      onExit();
    }
  }, [onExit]);

  // Fresh game, audio bed & UI session on mount.
  useEffect(() => {
    resetRoverSession();
    resetPlanOrbit();
    resetExecPlayhead();
    const appState = useAppStore.getState();
    setMasterVolume(appState.masterVolume);
    setRoverAmbientActive(true);
    useRoverStore.getState().setView(gl ? appState.roverView : '2d');
    useRoverUiStore.getState().resetUiSession(!appState.roverTutorialSeen);
    return () => {
      setRoverAmbientActive(false);
    };
  }, [gl]);

  // Keep master volume synced when sound turns on/off
  useEffect(() => {
    setMasterVolume(masterVolume);
  }, [masterVolume]);

  // Pause 3D render loop & RAF playhead when browser tab is backgrounded
  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

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
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const toggleSound = useCallback(() => {
    const next = !useAppStore.getState().soundOn;
    setSound(next);
    setSoundEnabled(next);
    if (next) setMasterVolume(useAppStore.getState().masterVolume);
  }, [setSound]);

  const toggleView = useCallback(() => {
    if (!gl) return;
    const next = useRoverStore.getState().view === '3d' ? '2d' : '3d';
    useRoverStore.getState().setView(next);
    setRoverView(next);
  }, [gl, setRoverView]);

  // Global keyboard shortcuts (including Space skip & Alt+Arrow / +- / 0 Plan orbit)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (useRoverUiStore.getState().howToOpen) return;
      const st = useRoverStore.getState();
      const k = e.key;

      // Alt+Arrows orbit Plan view
      if (e.altKey) {
        if (use3d && st.cam === 'map' && st.phase !== 'briefing' && !st.menu) {
          if (k === 'ArrowLeft') {
            e.preventDefault();
            nudgePlanOrbit(-0.14, 0, 1);
          } else if (k === 'ArrowRight') {
            e.preventDefault();
            nudgePlanOrbit(0.14, 0, 1);
          } else if (k === 'ArrowUp') {
            e.preventDefault();
            nudgePlanOrbit(0, 0.1, 1);
          } else if (k === 'ArrowDown') {
            e.preventDefault();
            nudgePlanOrbit(0, -0.1, 1);
          }
        }
        return;
      }

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

      if (k === ' ' && st.phase === 'executing' && !onButton) {
        e.preventDefault();
        requestSkipExec();
        return;
      }
      if (use3d && st.cam === 'map' && st.phase !== 'briefing') {
        if (k === '+' || k === '=') {
          e.preventDefault();
          return nudgePlanOrbit(0, 0, 0.88);
        }
        if (k === '-' || k === '_') {
          e.preventDefault();
          return nudgePlanOrbit(0, 0, 1.14);
        }
        if (k === '0') {
          e.preventDefault();
          return useRoverUiStore.getState().triggerResetOrbit();
        }
      }

      if (lower === 'h') return st.toggleHud();
      if (lower === 'l' && st.phase !== 'briefing') return useRoverUiStore.getState().toggleHazardLens();
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

  const paused = menu !== null || howToOpen;
  const showHudContent = hud && phase !== 'briefing';
  const ended = phase === 'won' || phase === 'lost';
  const canOrbitCanvas = use3d && cam === 'map' && phase !== 'briefing' && !paused;

  return (
    <div
      ref={rootRef}
      className="rd rd-root"
      data-cam={use3d ? cam : 'map2d'}
      data-orbit={canOrbitCanvas ? 'true' : undefined}
      data-reduced={reduced || undefined}
    >
      <div className="rd-stage">
        <Suspense fallback={<div className="rd-loading" role="status">Acquiring signal…</div>}>
          {use3d ? <RoverDriveScene paused={tabHidden || (paused && phase !== 'briefing')} /> : <RoverDrive2D />}
        </Suspense>
        {use3d && cam === 'hazcam' && phase !== 'briefing' && <div className="rd-hazcam" aria-hidden="true" />}
      </div>

      <AnimatePresence>
        {phase === 'briefing' && (
          <motion.div
            key="brief"
            className="rd-layer"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: reduced ? dur.instant : dur.fast, ease: ease.out },
            }}
            exit={{ opacity: 0, transition: { duration: dur.instant } }}
          >
            <IntroScreen onExit={handleExit} />
          </motion.div>
        )}
      </AnimatePresence>

      <Hud
        gl={gl}
        use3d={use3d}
        soundOn={soundOn}
        fs={fs}
        canFs={canFs}
        exitLabel={exitLabel}
        onToggleSound={toggleSound}
        onToggleFs={toggleFs}
        onToggleView={toggleView}
        onExit={handleExit}
      />

      {showHudContent && (
        <>
          {phase === 'planning' && <CommandDock copy={copy} />}
          {phase === 'uplink' && <UplinkOverlay />}
          {phase === 'executing' && <ExecutingChip />}
          {phase === 'downlink' && <DownlinkReport />}
        </>
      )}

      {!hud && phase === 'downlink' && <DownlinkReport />}

      <SolStartCard />
      <Captions />
      <Toasts />
      <CoachMarks />

      {ended && <EndScreen copy={copy} onExit={handleExit} exitLabel={exitLabel} />}

      {menu && (
        <PauseMenu
          copy={copy}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onExit={handleExit}
          exitLabel={exitLabel}
        />
      )}

      <HowToSheet copy={copy} />

      {showPerf && (
        <div className="rd-fps" aria-hidden="true">
          {use3d
            ? `${perfStats.fps} fps · ${perfStats.calls} calls · ${(perfStats.triangles / 1000).toFixed(1)}k tris · ${qualityTier}`
            : `${fps} fps · 2D`}
        </div>
      )}

      <div className="sr-only" aria-live="polite" role="status">
        {liveMsg}
      </div>
    </div>
  );
}
