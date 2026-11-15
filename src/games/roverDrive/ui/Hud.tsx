import { useEffect, useState } from 'react';
import { IconClose, IconMute, IconSound } from '../../../components/ui/Icons';
import { distToTarget, RULES } from '../engine';
import { poseAt, usePrediction, useRoverStore, type CamMode } from '../store';
import { getExecProgress, useRoverUiStore } from './uiStore';
import {
  BatteryRing,
  IconCamera,
  IconCompassArrow,
  IconFullscreen,
  IconHazardLens,
  IconHelp,
  IconMap2D,
  IconPause,
  IconResetView,
  TiltGaugeIcon,
} from './icons';

interface HudProps {
  gl: boolean;
  use3d: boolean;
  soundOn: boolean;
  fs: boolean;
  canFs: boolean;
  exitLabel: string;
  onToggleSound: () => void;
  onToggleFs: () => void;
  onToggleView: () => void;
  onExit: () => void;
}

const CAM_LABEL: Record<CamMode, string> = {
  map: 'Plan',
  chase: 'Chase',
  hazcam: 'Hazcam',
};

function useLiveTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [active]);
}

export function Hud({
  gl,
  use3d,
  soundOn,
  fs,
  canFs,
  exitLabel,
  onToggleSound,
  onToggleFs,
  onToggleView,
  onExit,
}: HudProps) {
  const phase = useRoverStore((s) => s.phase);
  const cam = useRoverStore((s) => s.cam);
  const hud = useRoverStore((s) => s.hud);
  const view = useRoverStore((s) => s.view);
  const rover = useRoverStore((s) => s.game.rover);
  const terrain = useRoverStore((s) => s.game.terrain);
  const cycleCam = useRoverStore((s) => s.cycleCam);
  const setCam = useRoverStore((s) => s.setCam);
  const openMenu = useRoverStore((s) => s.openMenu);
  const openHowTo = useRoverUiStore((s) => s.openHowTo);
  const hazardLens = useRoverUiStore((s) => s.hazardLens);
  const toggleHazardLens = useRoverUiStore((s) => s.toggleHazardLens);
  const outcropCue = useRoverUiStore((s) => s.outcropCue);
  const orbitModified = useRoverUiStore((s) => s.orbitModified);
  const triggerResetOrbit = useRoverUiStore((s) => s.triggerResetOrbit);

  useLiveTicker(phase === 'executing');
  const pred = usePrediction();

  const st = useRoverStore.getState();
  let battery = rover.battery;
  let tilt = 0;
  let x = rover.x;
  let z = rover.z;

  if (phase === 'executing' && st.report) {
    const u = getExecProgress(st);
    const p = poseAt(st.report.actual.path, st.timeline, u);
    battery = st.report.batteryBefore + (st.report.batteryAfterDrive - st.report.batteryBefore) * u;
    tilt = p.tilt;
    x = p.x;
    z = p.z;
  } else {
    const path = st.report?.actual.path;
    tilt = phase === 'planning' || !path ? (pred.path[0]?.tilt ?? 0) : (path[path.length - 1]?.tilt ?? 0);
  }

  const dist = distToTarget(terrain, x, z);
  const batteryLow = battery < 25;
  const batteryCrit = battery < 20;
  const tiltState = tilt > RULES.tiltStopDeg ? 'bad' : tilt > RULES.tiltWarnDeg ? 'warn' : 'ok';
  const showTelemetry = hud && phase !== 'briefing';

  return (
    <>
      {showTelemetry && (
        <div className="rd-top" role="group" aria-label="Rover telemetry">
          <div className="rd-stat" aria-label={`Sol ${rover.sol} of ${RULES.maxSols}`}>
            <span className="rd-stat__k">Sol</span>
            <span className="rd-stat__v">
              {rover.sol}
              <small>/{RULES.maxSols}</small>
            </span>
          </div>

          <div
            className="rd-stat rd-stat--row"
            data-state={batteryCrit ? 'bad' : batteryLow ? 'warn' : undefined}
            aria-label={`Battery ${Math.round(battery)} percent`}
          >
            <BatteryRing pct={battery} size={26} />
            <div>
              <span className="rd-stat__k">Power</span>
              <span className="rd-stat__v">{Math.round(battery)}%</span>
            </div>
          </div>

          <div className="rd-stat rd-stat--row" data-state={tiltState} aria-label={`Tilt ${tilt.toFixed(0)} degrees`}>
            <TiltGaugeIcon deg={tilt} size={26} />
            <div>
              <span className="rd-stat__k">Tilt</span>
              <span className="rd-stat__v">{tilt.toFixed(0)}°</span>
            </div>
          </div>

          <div className="rd-stat" aria-label={`Target distance ${dist.toFixed(dist < 10 ? 1 : 0)} metres`}>
            <span className="rd-stat__k">Target</span>
            <span className="rd-stat__v">
              {dist.toFixed(dist < 10 ? 1 : 0)}
              <small> m</small>
            </span>
          </div>
        </div>
      )}

      <div className="rd-corner" role="toolbar" aria-label="Game controls">
        <button
          type="button"
          className="rd-icon rd-icon--sq"
          onClick={() => openHowTo('rules')}
          aria-label="How to play"
          title="How to play"
        >
          <IconHelp size={20} />
        </button>

        {phase !== 'briefing' && (
          <button
            type="button"
            className="rd-icon rd-icon--cam"
            onClick={toggleHazardLens}
            aria-pressed={hazardLens}
            aria-keyshortcuts="L"
            aria-label={hazardLens ? 'Hazard lens on. Turn off' : 'Hazard lens off. Show slope and sand overlay'}
            title="Hazard lens (L)"
          >
            <IconHazardLens size={18} />
            <span className="rd-icon__tag">Hazards</span>
          </button>
        )}

        {phase !== 'briefing' && use3d && (
          <button
            type="button"
            className="rd-icon rd-icon--cam"
            onClick={cycleCam}
            aria-keyshortcuts="C"
            aria-label={`Camera: ${CAM_LABEL[cam]}. Switch camera`}
            title={`View: ${CAM_LABEL[cam]} (C)`}
          >
            <IconCamera size={18} />
            <span className="rd-icon__tag">{CAM_LABEL[cam]}</span>
          </button>
        )}

        {phase !== 'briefing' && use3d && cam === 'map' && orbitModified && (
          <button
            type="button"
            className="rd-icon rd-icon--cam"
            onClick={triggerResetOrbit}
            aria-keyshortcuts="0"
            aria-label="Reset Plan camera view"
            title="Reset view (0)"
          >
            <IconResetView size={18} />
            <span className="rd-icon__tag">Reset</span>
          </button>
        )}

        {phase !== 'briefing' && gl && (
          <button
            type="button"
            className="rd-icon rd-icon--sq"
            onClick={onToggleView}
            aria-label={view === '3d' ? 'Switch to 2D map' : 'Switch to 3D view'}
            title={view === '3d' ? '2D map' : '3D view'}
          >
            <IconMap2D size={19} />
          </button>
        )}

        <button
          type="button"
          className="rd-icon rd-icon--sq"
          onClick={onToggleSound}
          aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}
          title={soundOn ? 'Mute (M)' : 'Sound on (M)'}
          aria-keyshortcuts="M"
        >
          {soundOn ? <IconSound size={19} /> : <IconMute size={19} />}
        </button>

        {canFs && (
          <button
            type="button"
            className="rd-icon rd-icon--sq rd-icon--fs"
            onClick={onToggleFs}
            aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}
            title={fs ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            aria-keyshortcuts="F"
          >
            <IconFullscreen active={fs} size={18} />
          </button>
        )}

        {phase !== 'briefing' && (
          <button
            type="button"
            className="rd-icon rd-icon--sq"
            onClick={() => openMenu('pause')}
            aria-label="Pause"
            title="Pause (Esc)"
            aria-keyshortcuts="Escape"
          >
            <IconPause size={18} />
          </button>
        )}

        <button
          type="button"
          className="rd-icon rd-icon--sq"
          onClick={onExit}
          aria-label={exitLabel}
          title={exitLabel}
        >
          <IconClose size={19} />
        </button>
      </div>

      {showTelemetry && use3d && outcropCue.visible && (
        <button
          type="button"
          className="rd-outcrop-cue"
          style={{ left: `${outcropCue.xPct}%`, top: `${outcropCue.yPct}%` }}
          onClick={() => setCam('map')}
          aria-label={`Outcrop ${Math.round(outcropCue.distM)} metres away. Switch to Plan view`}
          title="Show outcrop in Plan view"
        >
          <span
            className="rd-outcrop-cue__arrow"
            style={{ transform: `rotate(${outcropCue.angleDeg}deg)` }}
            aria-hidden="true"
          >
            <IconCompassArrow size={15} />
          </span>
          <span className="rd-outcrop-cue__lbl">Outcrop · {Math.round(outcropCue.distM)} m</span>
        </button>
      )}
    </>
  );
}
