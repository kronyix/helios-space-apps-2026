import { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useRoverStore } from '../store';
import { useRoverUiStore, type TutorialStep } from './uiStore';

interface StepSpec {
  target: string;
  title: string;
  body: string;
  nextLabel?: string;
}

const STEPS: Record<TutorialStep, StepSpec> = {
  0: {
    target: '[data-coach="forward"]',
    title: 'Step 1 of 5',
    body: 'Tap Forward 2 m.',
  },
  1: {
    target: '.rd-stage',
    title: 'Step 2 of 5',
    body: 'The dashed line is your prediction.',
    nextLabel: 'Next',
  },
  2: {
    target: '[data-coach="turn"]',
    title: 'Step 3 of 5',
    body: 'Add a turn, then another move.',
    nextLabel: 'Next',
  },
  3: {
    target: '[data-coach="send"]',
    title: 'Step 4 of 5',
    body: 'Send uplink. Signals take minutes, so you plan a whole day.',
  },
  4: {
    target: '[data-coach="downlink"]',
    title: 'Step 5 of 5',
    body: 'Sand can slow your wheels. Predicted and actual paths can differ.',
    nextLabel: 'Got it',
  },
};

export function CoachMarks() {
  const active = useRoverUiStore((s) => s.tutorialActive);
  const step = useRoverUiStore((s) => s.tutorialStep);
  const setStep = useRoverUiStore((s) => s.setTutorialStep);
  const dismiss = useRoverUiStore((s) => s.dismissTutorial);
  const setSeen = useAppStore((s) => s.setRoverTutorialSeen);
  const phase = useRoverStore((s) => s.phase);
  const queue = useRoverStore((s) => s.queue);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dockTop, setDockTop] = useState<number | null>(null);
  const [hudBottom, setHudBottom] = useState<number>(0);

  const finish = () => {
    setSeen(true);
    dismiss();
  };

  useEffect(() => {
    if (!active) return;
    if (step === 0 && phase === 'planning' && queue.length >= 1) {
      setStep(1);
    } else if (step === 1 && phase === 'planning' && queue.length >= 2) {
      setStep(2);
    } else if (step === 2 && phase === 'planning' && queue.some((c) => c.type === 'turn') && queue.length >= 3) {
      setStep(3);
    } else if ((step === 1 || step === 2 || step === 3) && phase === 'uplink') {
      setStep(4);
    }
  }, [active, step, phase, queue, setStep]);

  const visibleForPhase =
    active &&
    ((step <= 3 && phase === 'planning') || (step === 4 && phase === 'downlink'));

  useEffect(() => {
    if (!visibleForPhase) {
      setRect(null);
      setDockTop(null);
      return;
    }
    const sel = STEPS[step].target;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(sel);
      setRect(el && sel !== '.rd-stage' ? el.getBoundingClientRect() : null);
      const container = document.querySelector<HTMLElement>(step === 4 ? '[data-coach="downlink"]' : '.rd-dock');
      setDockTop(container ? container.getBoundingClientRect().top : null);
      const topEl = document.querySelector<HTMLElement>('.rd-top') ?? document.querySelector<HTMLElement>('.rd-corner');
      setHudBottom(topEl ? topEl.getBoundingClientRect().bottom : 0);
    };
    measure();
    const id = window.setInterval(measure, 200);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [visibleForPhase, step]);

  if (!visibleForPhase) return null;

  const spec = STEPS[step];
  // Always keep the tutorial card between the top HUD and the dock/downlink sheet so it never blocks controls.
  const cardBottom = dockTop !== null ? Math.max(8, window.innerHeight - dockTop + 6) : undefined;
  const maxCardHeight = dockTop !== null && hudBottom > 0 ? Math.max(96, dockTop - hudBottom - 10) : undefined;
  const cardTop = cardBottom === undefined ? Math.max(120, hudBottom + 8) : undefined;

  return (
    <div className="rd-coach" role="region" aria-label="Mission tutorial">
      {rect && (
        <div
          className="rd-coach__ring"
          aria-hidden="true"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}

      <div
        className="rd-coach__card"
        style={{
          ...(cardBottom !== undefined ? { bottom: `${cardBottom}px` } : { top: `${cardTop}px` }),
          ...(maxCardHeight !== undefined ? { maxHeight: `${maxCardHeight}px`, overflowY: 'auto' } : {}),
        }}
      >
        <div className="rd-coach__top">
          <span className="rd-label">{spec.title}</span>
          {!spec.nextLabel && (
            <button type="button" className="rd-coach__skip" onClick={finish}>
              Skip tutorial
            </button>
          )}
        </div>
        <p className="rd-coach__msg">{spec.body}</p>
        {spec.nextLabel && (
          <div className="rd-coach__actions">
            <button type="button" className="rd-coach__skip" onClick={finish}>
              Skip tutorial
            </button>
            <button
              type="button"
              className="rd-coach__next"
              onClick={() => {
                if (step === 4) finish();
                else setStep((step + 1) as TutorialStep);
              }}
            >
              {spec.nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
