import { useEffect } from 'react';
import { motion } from 'motion/react';
import type { MissionData } from '../data/types';
import { nextMission, pad2, panelsForStage } from '../lib/missions';
import { useAppStore } from '../store/useAppStore';
import { dur, ease } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { ScreenFrame } from '../components/ui/Layout';
import { ComicPanel, ModeToggle } from '../components/comic/ComicPage';
import ArtifactCard from '../components/comic/ArtifactCard';
import { IconExternal } from '../components/ui/Icons';
import { ChapterNav } from './ChapterNav';

export default function RewardScreen({ mission }: { mission: MissionData }) {
  const go = useAppStore((s) => s.go);
  const setGamePhase = useAppStore((s) => s.setGamePhase);
  const passed = useAppStore((s) => !!s.gameResults[mission.id]?.passed);
  const markTransmission = useAppStore((s) => s.markTransmission);
  const reduced = useReducedMotion();
  const panels = panelsForStage(mission, 'reward');
  const next = nextMission(mission.id);
  const t = mission.telemetry;

  useEffect(() => {
    markTransmission(mission.id);
  }, [mission.id, markTransmission]);

  return (
    <ScreenFrame
      kicker={`Issue ${pad2(mission.issueNumber)} · Transmission`}
      title={
        <>
          Final <span className="text-[var(--accent)]">transmission</span>
        </>
      }
      status="Chapter IV · Transmission"
      background={<div className="reward-bg" aria-hidden="true" />}
      footer={
        <ChapterNav
          mission={mission}
          step={3}
          onPrev={() => go('hardware')}
          onNext={() => (next ? go('story', next.id) : go('badges'))}
          nextLabel={next ? `Issue ${pad2(next.issueNumber)}` : 'Badges'}
        />
      }
    >
      <div className="reward-grid">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ModeToggle />
            <p className="font-mono text-[11px] tracking-[0.12em] text-fg-3">{mission.fictionNotice}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {panels.map((p, i) => (
              <motion.div
                key={p.panelNumber}
                initial={{ opacity: 0, y: reduced ? 0 : 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.12, duration: dur.slow, ease: ease.out }}
              >
                <ComicPanel panel={p} mission={mission} total={mission.comicPanels.length} priority />
              </motion.div>
            ))}
          </div>

          <section className="transmission mt-6" aria-labelledby="tx-h">
            <h2 id="tx-h" className="label-caps !text-[var(--accent)]">
              Decoded · {mission.hardwareName}
            </h2>
            <dl className="mt-3 grid gap-x-8 gap-y-2 font-mono text-[13px] sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-[var(--color-line)] py-1.5">
                <dt className="text-fg-3">PLANNED</dt>
                <dd className="text-right text-fg">{t.plannedLifespan}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--color-line)] py-1.5">
                <dt className="text-fg-3">ACTUAL</dt>
                <dd className="text-right text-fg">{t.actualLifespan}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--color-line)] py-1.5">
                <dt className="text-fg-3">{(t.lastContactLabel ?? 'Last contact').toUpperCase()}</dt>
                <dd className="text-right text-fg">{t.lastContact}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--color-line)] py-1.5">
                <dt className="text-fg-3">{(t.massNote ?? 'Mass').toUpperCase()}</dt>
                <dd className="text-right text-fg">{t.massKg} kg</dd>
              </div>
            </dl>
            <h3 className="label-caps mt-5">Sources</h3>
            <ul className="mt-2 space-y-1.5">
              {mission.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="credit-link text-[13px]">
                    {s.label} <IconExternal size={12} />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <ArtifactCard mission={mission} unlocked={passed} />
          {!passed && (
            <button
              type="button"
              className="btn-primary self-start"
              onClick={() => {
                go('hardware');
                setGamePhase('intro');
              }}
            >
              Take the {mission.miniGame.title}
            </button>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}
