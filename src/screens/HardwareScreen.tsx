import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useProgress } from '@react-three/drei';
import type { MissionData } from '../data/types';
import { panelsForStage, pad2 } from '../lib/missions';
import { useAppStore } from '../store/useAppStore';
import { hasWebGL } from '../lib/device';
import { dur, ease } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { AccentTitle, ScreenFrame } from '../components/ui/Layout';
import { IconClock, IconClose, IconPlay, IconTarget, IconTrophy } from '../components/ui/Icons';
import { ChapterNav } from './ChapterNav';
import MiniGameModal from '../components/comic/MiniGameModal';

const HardwareViewer = lazy(() => import('../components/three/HardwareViewer'));

function ModelProgress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute bottom-28 right-10 font-pixel text-[12px] text-fg-2" role="status">
      RECEIVING MODEL · {Math.round(progress)}%
    </div>
  );
}

export default function HardwareScreen({ mission }: { mission: MissionData }) {
  const active = useAppStore((s) => s.activeHotspot);
  const setHotspot = useAppStore((s) => s.setHotspot);
  const seen = useAppStore((s) => s.hotspotsSeen[mission.id]);
  const result = useAppStore((s) => s.gameResults[mission.id]);
  const setGamePhase = useAppStore((s) => s.setGamePhase);
  const openPlay = useAppStore((s) => s.openPlay);
  const roverBest = useAppStore((s) => s.roverResult?.best ?? 0);
  const go = useAppStore((s) => s.go);
  const reduced = useReducedMotion();
  const gl = hasWebGL();
  const panel = panelsForStage(mission, 'hardware')[0];
  const h = mission.hotspots.find((x) => x.id === active) ?? null;
  const hIndex = mission.hotspots.findIndex((x) => x.id === active);
  const g = mission.miniGame;
  const badgeAt = g.badgeThreshold ?? 80;

  return (
    <ScreenFrame
      passthrough
      kicker={`Issue ${pad2(mission.issueNumber)} · Hardware`}
      title={<AccentTitle text={mission.issueTitle} />}
      status="Chapter III · The Hardware"
      background={
        gl ? (
          <div className="hardware-stage">
            <Suspense fallback={null}>
              <HardwareViewer
                modelPath={mission.modelPath}
                hotspots={mission.hotspots}
                onHotspotClick={(id) => setHotspot(active === id ? null : id)}
                activeHotspot={active}
                scene={mission.scene}
                missionId={mission.id}
                onBackgroundClick={() => setHotspot(null)}
              />
            </Suspense>
            <ModelProgress />
            <div className="hardware-scrim" aria-hidden="true" />
          </div>
        ) : (
          <div className="story-bg" aria-hidden="true">
            <img src={panel.realNasaImage} alt="" />
          </div>
        )
      }
      footer={
        <ChapterNav
          mission={mission}
          step={2}
          onPrev={() => go('story')}
          onNext={() => go('reward')}
          nextLabel="Transmission"
        />
      }
    >
      <div className="hardware-grid">
        <div className="hardware-left">
          <AnimatePresence mode="wait" initial={false}>
            {h ? (
              <motion.article
                key={h.id}
                className="hotspot-card"
                aria-live="polite"
                initial={{ opacity: 0, x: reduced ? 0 : -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduced ? 0 : -8 }}
                transition={{ duration: dur.base, ease: ease.out }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-pixel text-[12px] text-[var(--accent)]">
                      {pad2(hIndex + 1)} · {h.designation}
                    </p>
                    <h2 className="mt-1 font-pixel text-[24px] leading-tight">{h.label}</h2>
                  </div>
                  <button type="button" className="btn-icon shrink-0" onClick={() => setHotspot(null)} aria-label="Close hotspot">
                    <IconClose />
                  </button>
                </div>
                {h.attribution && <p className="attribution">{h.attribution}</p>}
                <h3 className="label-caps mt-4">Engineering</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-fg">{h.engineeringFact}</p>
                <h3 className="label-caps mt-4">Discovery</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-fg-2">{h.scienceDiscovery}</p>
              </motion.article>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="hardware-cards">
          <div className="plate">
            <div className="flex items-center justify-between">
              <p className="kicker">Field test</p>
              <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] px-2.5 py-1 font-pixel text-[12px] text-fg-2">
                <IconClock size={14} /> {g.durationSec ?? 15}s
              </span>
            </div>
            <h3 className="plate__title">{g.title}</h3>
            <p className="plate__text">{g.tagline}</p>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="btn-primary" onClick={() => setGamePhase('intro')}>
                {result ? 'Play again' : 'Play now'} <IconPlay size={14} />
              </button>
              {result && <span className="font-pixel text-[12px] text-fg-3">Best {result.best}%</span>}
            </div>
          </div>

          {mission.extraGame && (
            <div className="plate">
              <p className="kicker">{mission.extraGame.kicker}</p>
              <h3 className="plate__title">{mission.extraGame.title}</h3>
              <p className="plate__text">{mission.extraGame.tagline}</p>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" className="btn-primary" onClick={() => openPlay('rover-drive')}>
                  {mission.extraGame.ctaLabel} <IconPlay size={14} />
                </button>
                {roverBest > 0 && <span className="font-pixel text-[12px] text-fg-3">Best {roverBest}</span>}
              </div>
            </div>
          )}

          <div className="plate">
            <div className="flex items-center justify-between">
              <p className="kicker flex items-center gap-2">
                <IconTarget size={14} /> Inspect the hardware
              </p>
              <span className="font-pixel text-[12px] text-fg-3">
                {seen?.length ?? 0}/{mission.hotspots.length} SEEN
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {mission.hotspots.map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className="hotspot-chip"
                    aria-pressed={active === x.id}
                    data-seen={seen?.includes(x.id) || undefined}
                    onClick={() => setHotspot(active === x.id ? null : x.id)}
                  >
                    <span className="font-pixel text-[12px] text-[var(--accent)]">{pad2(i + 1)}</span>
                    <span className="text-[13px] leading-tight">{x.shortLabel ?? x.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="plate plate--dashed flex items-center gap-4">
            <span className="badge-orb" aria-hidden="true">
              <IconTrophy size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="kicker">{(result?.best ?? 0) >= badgeAt ? 'Badge earned' : 'Next badge'}</p>
              <h3 className="plate__title">{mission.artifact.badgeName}</h3>
              <p className="plate__text">{mission.artifact.badgeCriteria}</p>
              <span className="mt-2 block h-[3px] overflow-hidden rounded bg-[var(--color-line-2)]" aria-hidden="true">
                <span className="block h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, ((result?.best ?? 0) / badgeAt) * 100)}%` }} />
              </span>
            </div>
          </div>
        </div>
      </div>
      <MiniGameModal mission={mission} />
    </ScreenFrame>
  );
}
