import { blip } from '../../../lib/audio';
import type { ExtraGame } from '../../../data/types';
import { RULES } from '../engine';
import { usePrediction, useRoverStore } from '../store';
import type { Command } from '../types';
import {
  CommandIcon,
  IconChevron,
  IconRock,
  IconSand,
  IconSlope,
  IconWarning,
} from './icons';
import { PlanStrip } from './PlanStrip';
import { useRoverUiStore } from './uiStore';

interface Props {
  copy: ExtraGame;
}

export function CommandDock({ copy }: Props) {
  const queue = useRoverStore((s) => s.queue);
  const dist = useRoverStore((s) => s.dist);
  const batteryNow = useRoverStore((s) => s.game.rover.battery);
  const add = useRoverStore((s) => s.add);
  const setDist = useRoverStore((s) => s.setDist);
  const send = useRoverStore((s) => s.send);
  const dockExpanded = useRoverUiStore((s) => s.dockExpanded);
  const setDockExpanded = useRoverUiStore((s) => s.setDockExpanded);

  const pred = usePrediction();
  const full = queue.length >= RULES.maxCommands;
  const battEnd = Math.max(0, pred.end.battery);

  const hasRock = pred.events.includes('rock_stop') || pred.events.includes('turn_blocked');
  const hasSlope = pred.end.loseReason === 'tipover' || pred.events.includes('tilt_stop') || pred.maxTilt > RULES.tiltWarnDeg;
  const hasSand = pred.path.some((p) => p.sand > RULES.softSandMask);
  const hasBattOut = pred.end.status === 'lost' && pred.end.loseReason === 'battery';
  const hasHazard = hasRock || hasSlope || hasSand || hasBattOut;

  const hazardBadge = hasBattOut
    ? { label: 'Low power', Icon: IconWarning }
    : hasRock
      ? { label: 'Rock ahead', Icon: IconRock }
      : hasSlope
        ? { label: 'Steep slope', Icon: IconSlope }
        : hasSand
          ? { label: 'Sand ahead', Icon: IconSand }
          : null;

  const contextHint =
    queue.length === 0
      ? 'Tap a move to start.'
      : hasHazard
        ? 'Red path: trouble ahead.'
        : 'Dashed line = your prediction.';

  const palette: { c: Command; label: string; short: string; key: string; coach?: string; kind?: 'main' | 'scan' }[] = [
    { c: { type: 'turn', deg: 45 }, label: 'Left 45°', short: 'L 45°', key: 'Shift+A' },
    { c: { type: 'turn', deg: 15 }, label: 'Left 15°', short: 'L 15°', key: 'A', coach: 'turn' },
    { c: { type: 'forward', m: dist }, label: `Forward ${dist} m`, short: `Fwd ${dist} m`, key: 'W', coach: 'forward', kind: 'main' },
    { c: { type: 'turn', deg: -15 }, label: 'Right 15°', short: 'R 15°', key: 'D' },
    { c: { type: 'turn', deg: -45 }, label: 'Right 45°', short: 'R 45°', key: 'Shift+D' },
    { c: { type: 'back', m: 1 }, label: 'Back 1 m', short: 'Back 1 m', key: 'S' },
    { c: { type: 'scan' }, label: 'SCAN', short: 'SCAN', key: 'Q', kind: 'scan' },
  ];

  const queueCommand = (c: Command) => {
    add(c);
    blip('tick');
  };

  return (
    <section className="rd-dock" data-collapsed={!dockExpanded || undefined} aria-label="Drive plan cockpit">
      <div className="rd-dock__bar">
        <button
          type="button"
          className="rd-dock__toggle"
          onClick={() => setDockExpanded(!dockExpanded)}
          aria-expanded={dockExpanded}
          aria-label={dockExpanded ? 'Collapse command dock' : 'Expand command dock'}
        >
          <span className="rd-label">
            Plan sol · {queue.length}/{RULES.maxCommands}
          </span>
          <IconChevron dir={dockExpanded ? 'down' : 'up'} size={18} />
        </button>
      </div>

      <div className="rd-dock__body">
        <div className="rd-dock__controls">
          <div className="rd-dist-row">
            <span className="rd-dist-row__k">Step</span>
            <div className="rd-seg" role="radiogroup" aria-label="Forward distance">
              {([1, 2, 5] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={dist === m}
                  className="rd-seg__btn"
                  onClick={() => setDist(m)}
                  title={`Forward ${m} m (key ${m})`}
                >
                  {m} m
                </button>
              ))}
            </div>
            {hazardBadge && (
              <span className="rd-hazard-chip" role="status">
                <hazardBadge.Icon size={15} />
                <span>{hazardBadge.label}</span>
              </span>
            )}
          </div>

          <div className="rd-cmds">
            {palette.map(({ c, label, short, key, coach, kind }) => (
              <button
                key={label}
                type="button"
                className={`rd-cmd ${kind === 'main' ? 'rd-cmd--main' : ''} ${kind === 'scan' ? 'rd-cmd--scan' : ''}`}
                disabled={full}
                data-coach={coach}
                onClick={() => queueCommand(c)}
                aria-label={label}
                aria-keyshortcuts={key}
                title={`${label} (${key})`}
              >
                <CommandIcon cmd={c} size={20} />
                <span className="rd-cmd__lbl">{short}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rd-dock__plan">
          <PlanStrip />
        </div>

        <div className="rd-dock__send">
          <div className="rd-batt-pred">
            <div className="rd-batt-pred__row">
              <span className="rd-label">Battery</span>
              <span className="rd-batt-pred__nums">
                {Math.round(batteryNow)}% → <strong data-low={battEnd < 20 || undefined}>{Math.round(battEnd)}%</strong>
              </span>
            </div>
            <div className="rd-batt-bar" aria-hidden="true">
              <span
                className="rd-batt-bar__fill"
                data-low={battEnd < 20 || undefined}
                style={{ width: `${Math.max(0, Math.min(100, battEnd))}%` }}
              />
            </div>
          </div>

          <p className="rd-context-hint" data-warn={hasHazard || undefined}>
            {contextHint}
          </p>

          <button
            type="button"
            className="rd-send"
            data-coach="send"
            onClick={send}
            disabled={queue.length === 0}
            aria-keyshortcuts="Enter"
          >
            Send uplink
          </button>
          <p className="rd-hint rd-uplink-caption">{copy.uplinkNote}</p>
        </div>
      </div>
    </section>
  );
}
