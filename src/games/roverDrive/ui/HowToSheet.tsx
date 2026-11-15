import { useEffect, useRef } from 'react';
import type { ExtraGame } from '../../../data/types';
import { isCoarsePointer } from '../../../lib/device';
import { IconClose } from '../../../components/ui/Icons';
import { RULES } from '../engine';
import { useRoverStore } from '../store';
import { useRoverUiStore } from './uiStore';
import { IconDust, IconPlanStep, IconRock, IconSand, IconScan, IconWarning, TiltGaugeIcon } from './icons';

interface Props {
  copy: ExtraGame;
}

const RULE_ROWS = [
  {
    id: 'sols',
    Icon: () => <IconPlanStep size={20} />,
    text: `Queue up to ${RULES.maxCommands} commands per sol (${RULES.maxSols} sols max).`,
  },
  {
    id: 'tilt',
    Icon: () => <TiltGaugeIcon deg={32} size={22} />,
    text: `Tilt: warn ${RULES.tiltWarnDeg}°, stop ${RULES.tiltStopDeg}° (~0.5 m slide), tip ${RULES.tipOverDeg}°.`,
  },
  {
    id: 'sand',
    Icon: () => <IconSand size={20} />,
    text: 'Soft sand: 40–70% distance, extra power, rover digs deeper.',
  },
  {
    id: 'stuck',
    Icon: () => <IconWarning size={20} />,
    text: `${RULES.stuckSols} stuck sols in sand (<20% progress) ends mission.`,
  },
  {
    id: 'rocks',
    Icon: () => <IconRock size={20} />,
    text: 'Rocks halt drives and block turns — back up first.',
  },
  {
    id: 'dust',
    Icon: () => <IconDust size={20} />,
    text: 'Solar recharge drops slightly each sol as dust settles.',
  },
  {
    id: 'scan',
    Icon: () => <IconScan size={20} />,
    text: `SCAN succeeds only within ${RULES.scanRangeM} m of the outcrop.`,
  },
] as const;

const KEY_ROWS = [
  { keys: 'W / S', label: 'Forward / Back 1 m' },
  { keys: 'A / D', label: 'Turn 15° (Shift = 45°)' },
  { keys: '1 / 2 / 5', label: 'Forward distance' },
  { keys: 'Q', label: 'Add SCAN command' },
  { keys: 'Enter', label: 'Send uplink' },
  { keys: 'Space', label: 'Skip drive playback' },
  { keys: 'Backspace', label: 'Undo last command' },
  { keys: 'C', label: 'Cycle camera view' },
  { keys: 'Alt + Arrows', label: 'Orbit Plan view' },
  { keys: '+ / - / 0', label: 'Zoom or reset Plan view' },
  { keys: 'L', label: 'Toggle hazard lens' },
  { keys: 'H', label: 'Hide / show HUD' },
  { keys: 'Esc', label: 'Pause or close sheet' },
] as const;

export function HowToSheet({ copy }: Props) {
  const open = useRoverUiStore((s) => s.howToOpen);
  const tab = useRoverUiStore((s) => s.howToTab);
  const close = useRoverUiStore((s) => s.closeHowTo);
  const setTab = useRoverUiStore((s) => s.setHowToTab);
  const startTutorial = useRoverUiStore((s) => s.startTutorial);
  const phase = useRoverStore((s) => s.phase);
  const startMission = useRoverStore((s) => s.start);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const touchOnly = isCoarsePointer();
  const activeTab = touchOnly && tab === 'keys' ? 'rules' : tab;

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prevFocus.current?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const handleReplayTutorial = () => {
    if (phase === 'briefing') startMission();
    startTutorial();
  };

  return (
    <div
      className="rd-center rd-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={dialogRef} className="rd-card rd-howto" role="dialog" aria-modal="true" aria-labelledby="rd-howto-title">
        <div className="rd-howto__head">
          <div>
            <p className="rd-label">Field guide</p>
            <h2 id="rd-howto-title" className="rd-title">
              How to play
            </h2>
          </div>
          <button ref={closeRef} type="button" className="rd-icon rd-icon--sq" onClick={close} aria-label="Close how to play">
            <IconClose size={18} />
          </button>
        </div>

        {!touchOnly && (
          <div className="rd-tabs" role="tablist" aria-label="Guide sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rules'}
              className="rd-tab"
              onClick={() => setTab('rules')}
            >
              Rules
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'keys'}
              className="rd-tab"
              onClick={() => setTab('keys')}
            >
              Keys
            </button>
          </div>
        )}

        {activeTab === 'rules' ? (
          <div className="rd-howto__body" role="tabpanel">
            <ul className="rd-rule-list">
              {RULE_ROWS.map(({ id, Icon, text }) => (
                <li key={id} className="rd-rule-item">
                  <span className="rd-rule-item__ico" aria-hidden="true">
                    <Icon />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <div className="rd-howto__notes">
              <p>{copy.rulesNote}</p>
              <p>{copy.timeNote}</p>
            </div>
          </div>
        ) : (
          <div className="rd-howto__body" role="tabpanel">
            <dl className="rd-key-grid">
              {KEY_ROWS.map((row) => (
                <div key={row.keys} className="rd-key-row">
                  <dt>
                    <kbd>{row.keys}</kbd>
                  </dt>
                  <dd>{row.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="rd-howto__foot">
          <button type="button" className="rd-ghost" onClick={handleReplayTutorial}>
            Replay tutorial
          </button>
          <button type="button" className="rd-send" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
