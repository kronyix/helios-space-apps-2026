import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useProgress } from '@react-three/drei';
import type { MissionData } from '../data/types';
import { panelsForStage, pad2 } from '../lib/missions';
import { useAppStore } from '../store/useAppStore';
import { hasWebGL } from '../lib/device';
import { dur, ease } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { AccentTitle, ScreenFrame } from '../components/ui/Layout';
import { IconArrowLeft, IconClock, IconClose, IconPlay, IconTarget, IconTrophy } from '../components/ui/Icons';
import { HeliosMark } from '../components/ui/HeliosMark';
import { ChapterNav } from './ChapterNav';
import MiniGameModal from '../components/comic/MiniGameModal';
import HardwareHubScreen from './HardwareHubScreen';

const HOTSPOT_GAMEPLAY: Record<string, Record<string, string>> = {
  opportunity: {
    arm: 'Used in Spectrometer Scan to position the Mössbauer spectrometer against martian soil to identify hematite spherules.',
    wheel: 'Tested in Signal Delay Rover Drive — manage torque across six independent wheels over hazardous Martian dunes.',
    arrays: 'Monitors solar power generation and battery margins before authorizing robotic arm science operations.',
  },
  apollo11: {
    lrrr: 'The target in Laser Bounce! Earth observatories fire laser pulses at these 100 fused-silica prisms to track Moon drift.',
    kapton: 'Multilayer thermal insulation shielding the descent stage from +120°C solar radiation and engine exhaust plume.',
    psep: 'Solar-powered seismic package that transmitted humanity\'s first recorded moonquake data back to Houston.',
  },
  ingenuity: {
    blades: 'The core mechanic in RPM Throttle! Throttle counter-rotating blades to 2,537+ RPM to achieve lift in 1% Martian air.',
    avionics: 'Runs autonomous flight control loops 500 times per second — no joystick on Earth could react fast enough across 15 light-minutes.',
    navcam: 'Downward camera tracking surface features at 30 fps to provide real-time velocity and position estimates.',
  },
};

const HardwareViewer = lazy(() => import('../components/three/HardwareViewer'));

/** Mounts once the lazy viewer chunk has resolved. */
function ChunkReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/**
 * Helios-mark loader shown until the viewer chunk and the model assets have loaded.
 * Cached models never report progress, so an idle grace period also counts as done.
 */
function HardwareLoader({ chunkReady }: { chunkReady: boolean }) {
  const { active, progress } = useProgress();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const sawActive = useRef(false);
  if (active) sawActive.current = true;

  useEffect(() => {
    if (!visible || !chunkReady) return;
    const done = sawActive.current && progress >= 100 && !active;
    if (!done && active) return;
    const id = window.setTimeout(() => setVisible(false), done ? 250 : 900);
    return () => window.clearTimeout(id);
  }, [active, progress, chunkReady, visible]);

  // Safety: never trap the user behind the loader.
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 10000);
    return () => window.clearTimeout(id);
  }, []);

  const pct = Math.round(chunkReady ? progress : 0);
  // Portalled so it sits above the page cards (the stage lives in the z-0 background layer).
  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="hardware-loader"
          role="status"
          aria-live="polite"
          aria-label={`Receiving model, ${pct} percent`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? dur.instant : dur.base, ease: ease.inOut }}
        >
          <div className="flex flex-col items-center gap-5">
            <span className="hardware-loader__mark">
              <HeliosMark size={72} />
            </span>
            <p className="font-pixel text-[12px] uppercase text-fg-2">Receiving model</p>
            <div className="flex w-[200px] items-center gap-3">
              <span className="relative h-px flex-1 bg-[var(--color-line-2)]">
                <span className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width]" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-10 text-right font-pixel text-[12px] tabular-nums text-fg-2">{pct}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default function HardwareScreen({ mission }: { mission: MissionData }) {
  const hwView = useAppStore((s) => s.hwView);
  const setHwView = useAppStore((s) => s.setHwView);
  const openHardware = useAppStore((s) => s.openHardware);
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
  const [chunkReady, setChunkReady] = useState(false);
  const markChunkReady = useCallback(() => setChunkReady(true), []);

  if (hwView === 'hub') {
    return (
      <HardwareHubScreen
        onSelectMission={(id) => openHardware(id)}
        onLaunchGame={(id) => {
          openHardware(id);
          setGamePhase('intro');
        }}
      />
    );
  }

  const gameplayNote = h ? HOTSPOT_GAMEPLAY[mission.id]?.[h.id] : null;

  return (
    <ScreenFrame
      passthrough
      kicker={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hw-back-pill"
            onClick={() => setHwView('hub')}
            aria-label="Return to Hardware Hub"
          >
            <IconArrowLeft size={13} /> ALL MACHINES
          </button>
          <span>Issue {pad2(mission.issueNumber)} · Hardware</span>
        </div>
      }
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
              <ChunkReady onReady={markChunkReady} />
            </Suspense>
            <HardwareLoader key={mission.id} chunkReady={chunkReady} />
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
          onPrev={() => setHwView('hub')}
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
                {gameplayNote && (
                  <div className="mt-4 rounded border border-[var(--color-line-2)] bg-[rgb(var(--accent-rgb)/0.06)] p-3">
                    <h3 className="label-caps text-[var(--accent)] flex items-center gap-1.5">
                      <IconPlay size={12} /> Field Test Connection
                    </h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{gameplayNote}</p>
                  </div>
                )}
              </motion.article>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="hardware-cards">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              className="btn-ghost text-[12px] py-1 px-3"
              onClick={() => setHwView('hub')}
            >
              <IconArrowLeft size={14} /> Back to All Machines
            </button>
            <span className="font-pixel text-[11px] text-fg-3">
              {mission.shortName}
            </span>
          </div>

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
