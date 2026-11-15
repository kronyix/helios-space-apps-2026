import { useEffect, useRef } from 'react';
import type { ExtraGame } from '../../../data/types';
import { useAppStore } from '../../../store/useAppStore';
import { IconRetry, IconTrophy } from '../../../components/ui/Icons';
import { score } from '../engine';
import { useRoverStore } from '../store';
import type { LoseReason } from '../types';
import { describeSolReport, useRoverUiStore } from './uiStore';

interface Props {
  copy: ExtraGame;
  onExit: () => void;
  exitLabel: string;
}

const LOSE_TITLES: Record<LoseReason, string> = {
  sand: 'Stuck in sand',
  battery: 'Out of power',
  tipover: 'Tipped over',
  sols: 'Out of sols',
};

const LOSE_TIPS: Record<LoseReason, string> = {
  sand: 'Tip: Steer around golden sand ripples before wheels dig in.',
  battery: 'Tip: Keep drives shorter so overnight solar power tops you up.',
  tipover: 'Tip: Stay away from steep crater rims where tilt passes 30°.',
  sols: 'Tip: Chain 5 m forward commands across clear flat terrain.',
};

// Verbatim from Issue 01 comic data (src/data/comics/opportunity-spirit.ts, panel p05 pia19113)
const WIN_FINDING = {
  src: '/images/nasa_real/issue01/pia19113-thumb.webp',
  alt: 'Microscopic Imager close-up of round metallic-gray hematite spherules embedded in fine reddish-brown Martian soil near Fram Crater.',
  caption:
    'Blueberries up close near Fram Crater. This entire patch of soil is only 3 centimeters (1.2 inches) wide, with color added from Pancam.',
  credit: 'NASA/JPL-Caltech/Cornell/USGS',
  sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA19113',
} as const;

// Verbatim from Issue 01 comic data (src/data/comics/opportunity-spirit.ts, panel p03)
const SPIRIT_TROY_FACT =
  'Driving backward on five working wheels, Spirit carved deep tracks across Gusev Crater until soft sand trapped its wheels at "Troy" in May 2009.';
const SPIRIT_WHEEL_FACT =
  "Later in the mission, one of Spirit's six wheels stopped turning. The team kept driving, dragging the stuck wheel behind.";

export function EndScreen({ copy, onExit, exitLabel }: Props) {
  const phase = useRoverStore((s) => s.phase);
  const rover = useRoverStore((s) => s.game.rover);
  const report = useRoverStore((s) => s.report);
  const restart = useRoverStore((s) => s.restart);
  const wins = useAppStore((s) => s.roverResult?.wins ?? 0);
  const detailsOpen = useRoverUiStore((s) => s.detailsOpen);
  const setDetailsOpen = useRoverUiStore((s) => s.setDetailsOpen);

  const primaryBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primaryBtn.current?.focus();
  }, [phase]);

  const won = phase === 'won';
  const s = score(rover);
  const firstWin = won && wins === 1;
  const reason: LoseReason = rover.loseReason ?? 'sols';

  return (
    <div className="rd-center rd-scrim">
      <div className="rd-card rd-card--end" role="dialog" aria-modal="true" aria-labelledby="rd-end-title">
        <p className="rd-label">{won ? 'Mission complete' : 'Mission ended'}</p>
        <h2 id="rd-end-title" className="rd-title">
          {won ? 'Hematite confirmed' : LOSE_TITLES[reason]}
        </h2>

        {won ? (
          <>
            <p className="rd-body">Outcrop reached and scanned! Liquid water once shaped this plain.</p>

            <div className="rd-score">
              <span className="rd-stars" aria-label={`${s.stars} of 3 stars`}>
                {[1, 2, 3].map((i) => (
                  <span key={i} data-on={i <= s.stars || undefined} aria-hidden="true">
                    ★
                  </span>
                ))}
              </span>
              <span className="rd-score__n">{s.points}</span>
            </div>

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

            <div className="rd-end-story">
              <img
                src={WIN_FINDING.src}
                alt={WIN_FINDING.alt}
                width={84}
                height={84}
                loading="lazy"
                decoding="async"
                className="rd-end-story__img"
              />
              <div className="rd-end-story__copy">
                <p className="rd-label">What Opportunity found</p>
                <p className="rd-end-story__cap">{WIN_FINDING.caption}</p>
                <p className="rd-end-story__credit">
                  {WIN_FINDING.credit} ·{' '}
                  <a href={WIN_FINDING.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source ↗
                  </a>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="rd-details-btn"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              {detailsOpen ? 'Hide details' : 'Details'}
            </button>

            {detailsOpen && (
              <div className="rd-details-box">
                <p>
                  Sol {rover.sol} · {Math.round(rover.battery)}% battery · {rover.hazardFaults} hazard fault
                  {rover.hazardFaults === 1 ? '' : 's'}
                </p>
                {report && <p>{describeSolReport(report)}</p>}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="rd-body">{copy.outcomes[reason]}</p>
            <p className="rd-end-tip">{LOSE_TIPS[reason]}</p>
            <div className="rd-end-fact">
              <p className="rd-label">Real rovers hit trouble too</p>
              <p className="rd-end-fact__txt">{reason === 'sand' ? SPIRIT_TROY_FACT : SPIRIT_WHEEL_FACT}</p>
            </div>
          </>
        )}

        <div className="rd-actions">
          <button ref={primaryBtn} type="button" className="rd-send" onClick={restart} aria-keyshortcuts="R">
            <IconRetry size={16} /> {won ? 'Replay' : 'Try again'}
          </button>
          <button type="button" className="rd-ghost" onClick={onExit}>
            {won ? exitLabel : 'Leave'}
          </button>
        </div>
      </div>
    </div>
  );
}
