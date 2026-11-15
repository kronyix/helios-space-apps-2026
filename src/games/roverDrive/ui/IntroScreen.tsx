import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../../lib/useReducedMotion';
import { useRoverStore } from '../store';
import { useRoverUiStore } from './uiStore';
import { IconEarth, IconMars, IconPlanStep, IconScan, IconSendStep, IconWatchStep } from './icons';

interface Props {
  onExit: () => void;
}

export function IntroScreen({ onExit }: Props) {
  const start = useRoverStore((s) => s.start);
  const openHowTo = useRoverUiStore((s) => s.openHowTo);
  const reduced = useReducedMotion();
  const startBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startBtn.current?.focus();
  }, []);

  return (
    <section className="rd-intro" aria-labelledby="rd-intro-title" data-reduced={reduced || undefined}>
      <div className="rd-intro__panel">
        <p className="rd-label">ISSUE 01 · DRIVE THE ROVER</p>
        <h1 id="rd-intro-title" className="rd-intro__title">
          Signal Delay
        </h1>
        <p className="rd-intro__lead">You can't joystick a rover on Mars. Plan the day, send it, and watch.</p>

        <div className="rd-relay" aria-label="Earth to Mars radio delay, up to 22 minutes">
          <div className="rd-relay__row">
            <span className="rd-relay__planet">
              <IconEarth size={24} />
              <span>Earth</span>
            </span>
            <span className="rd-relay__track" aria-hidden="true">
              <span className="rd-relay__line" />
              <span className="rd-relay__pulse" />
            </span>
            <span className="rd-relay__planet">
              <IconMars size={24} />
              <span>Mars</span>
            </span>
          </div>
          <span className="rd-relay__caption">up to 22 min</span>
        </div>

        <ol className="rd-steps">
          <li className="rd-step">
            <span className="rd-step__ico" aria-hidden="true">
              <IconPlanStep size={18} />
            </span>
            <div>
              <strong>PLAN</strong>
              <span>Queue up to 6 moves</span>
            </div>
          </li>
          <li className="rd-step">
            <span className="rd-step__ico" aria-hidden="true">
              <IconSendStep size={18} />
            </span>
            <div>
              <strong>SEND</strong>
              <span>Beam them to Mars</span>
            </div>
          </li>
          <li className="rd-step">
            <span className="rd-step__ico" aria-hidden="true">
              <IconWatchStep size={18} />
            </span>
            <div>
              <strong>WATCH</strong>
              <span>Rover drives itself</span>
            </div>
          </li>
        </ol>

        <p className="rd-goal-chip">
          <IconScan size={16} />
          <span>Goal: SCAN the pale outcrop within 8 sols</span>
        </p>

        <div className="rd-intro__actions">
          <button ref={startBtn} type="button" className="rd-start" onClick={start}>
            Start mission
          </button>
          <button type="button" className="rd-link-btn" onClick={() => openHowTo('rules')}>
            How to play
          </button>
          <button type="button" className="rd-link-btn rd-link-btn--muted" onClick={onExit}>
            Back
          </button>
        </div>
      </div>
    </section>
  );
}
