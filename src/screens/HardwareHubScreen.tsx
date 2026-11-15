import { motion } from 'motion/react';
import type { MissionData } from '../data/types';
import { missions, pad2 } from '../lib/missions';
import { useAppStore } from '../store/useAppStore';
import { dur, ease } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { ScreenFrame, AccentTitle } from '../components/ui/Layout';
import { IconArrowRight, IconPlay, IconTarget, IconCube } from '../components/ui/Icons';
import { blip } from '../lib/audio';

interface HardwareHubProps {
  onSelectMission: (missionId: string) => void;
  onLaunchGame: (missionId: string) => void;
}

interface MachineMeta {
  subtitle: string;
  coverImage: string;
  description: string;
  hardwareList: string[];
  gameLabel: string;
}

const MACHINE_METAS: Record<string, MachineMeta> = {
  opportunity: {
    subtitle: 'The Mars Exploration Rovers',
    coverImage: '/images/comics/oppy_bold_arm_trench_scan.jpg',
    description: 'Explore the engineering behind the twin Mars rovers and discover how their instruments helped investigate the Red Planet.',
    hardwareList: [
      'Six-wheel mobility system',
      'Solar arrays & dust clearing',
      'Pancam & navcams',
      'Robotic arm & RAT',
      'Mössbauer spectrometer',
      'High-gain antenna',
    ],
    gameLabel: 'Spectrometer Scan (+ Rover Drive)',
  },
  apollo11: {
    subtitle: 'The Lunar Mission Hardware',
    coverImage: '/images/comics/apollo_lm_tranquility.jpg',
    description: 'Discover the engineering that made humanity\'s first crewed lunar landing possible.',
    hardwareList: [
      'Lunar Module Eagle',
      'Descent & ascent stages',
      'Crushable landing gear',
      'Descent propulsion (DPS)',
      'Laser retroreflector (LRRR)',
      'Passive seismic package',
    ],
    gameLabel: 'Laser Bounce (Lunar Ranging)',
  },
  ingenuity: {
    subtitle: 'The Mars Helicopter',
    coverImage: '/images/comics/ingy_over_dunes.jpg',
    description: 'Discover how engineers designed a helicopter capable of flying in the extremely thin atmosphere of Mars.',
    hardwareList: [
      'Coaxial rotors (2,537 RPM)',
      'Rotor mast & swashplates',
      'Solar panel & Li-ion cells',
      'Carbon composite legs',
      'Downward navigation camera',
      'Snapdragon flight computer',
    ],
    gameLabel: 'RPM Throttle (Atmospheric Lift)',
  },
};

export default function HardwareHubScreen({ onSelectMission, onLaunchGame }: HardwareHubProps) {
  const reduced = useReducedMotion();
  const gameResults = useAppStore((s) => s.gameResults);
  const hotspotsSeen = useAppStore((s) => s.hotspotsSeen);

  return (
    <ScreenFrame
      kicker="Silent Pioneers · Chapter III"
      title={<AccentTitle text="Hardware Exploration Hub" />}
      status="Select a Machine · 3 Issues Available"
      background={
        <div className="hub-starfield-bg" aria-hidden="true">
          <div className="hub-grid-overlay" />
        </div>
      }
    >
      <div className="hw-hub">
        <header className="hw-hub__header">
          <p className="kicker">Multi-Mission Engineering Archive</p>
          <h2 className="hw-hub__heading">Choose a Machine to Inspect</h2>
          <p className="hw-hub__subheading">
            Every NASA machine was custom-engineered for extreme interplanetary environments. Select a pioneer to rotate its 3D model, examine scientific components, and test its instruments in mission simulations.
          </p>
        </header>

        <div className="hw-hub__grid" role="list">
          {missions.map((m: MissionData, idx: number) => {
            const meta = MACHINE_METAS[m.id] ?? {
              subtitle: m.issueTitle,
              coverImage: m.comicPanels[2]?.comicImage || m.comicPanels[0]?.comicImage,
              description: m.logline,
              hardwareList: m.hotspots.map((h) => h.label),
              gameLabel: m.miniGame.title ?? 'Field Test',
            };

            const seenCount = hotspotsSeen[m.id]?.length ?? 0;
            const totalHotspots = m.hotspots.length;
            const bestScore = gameResults[m.id]?.best;

            return (
              <motion.article
                key={m.id}
                role="listitem"
                className="hw-card plate"
                initial={{ opacity: 0, y: reduced ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: dur.base,
                  delay: reduced ? 0 : idx * 0.08,
                  ease: ease.out,
                }}
              >
                {/* Comic-style cover artwork */}
                <div className="hw-card__cover-wrap">
                  <img
                    src={meta.coverImage}
                    alt={`${m.shortName} hardware illustration`}
                    className="hw-card__cover-img"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                  <div className="hw-card__cover-overlay" />
                  <div className="hw-card__badges">
                    <span className="hw-card__badge-issue">
                      Issue {pad2(m.issueNumber)}
                    </span>
                    <span className="hw-card__badge-body">
                      {m.celestialBody.toUpperCase()}
                    </span>
                  </div>
                  <div className="hw-card__model-tag">
                    <IconCube size={13} /> 3D Diorama
                  </div>
                </div>

                {/* Machine Details */}
                <div className="hw-card__body">
                  <div className="hw-card__header">
                    <p className="kicker">{meta.subtitle}</p>
                    <h3 className="hw-card__title">{m.shortName}</h3>
                    <p className="hw-card__tech-name font-pixel text-[12px] text-fg-3">
                      {m.hardwareName}
                    </p>
                  </div>

                  <p className="hw-card__desc">{meta.description}</p>

                  {/* Hardware Components to Explore */}
                  <div className="hw-card__section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="label-caps flex items-center gap-1.5 text-[11px]">
                        <IconTarget size={13} /> Hardware to Explore
                      </span>
                      <span className="font-pixel text-[11px] text-fg-3">
                        {seenCount}/{totalHotspots} Inspected
                      </span>
                    </div>
                    <ul className="hw-card__specs">
                      {meta.hardwareList.map((item, i) => (
                        <li key={i} className="hw-card__spec-chip">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Game Connection */}
                  <div className="hw-card__game-tag">
                    <span className="hw-card__game-icon">🎮</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-pixel text-[10px] text-fg-3 uppercase">Mission Field Test</p>
                      <p className="font-pixel text-[12px] text-[var(--accent)] truncate">
                        {meta.gameLabel}
                      </p>
                    </div>
                    {bestScore !== undefined && (
                      <span className="font-pixel text-[11px] text-fg-2">
                        Best {bestScore}%
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="hw-card__actions">
                    <button
                      type="button"
                      className="btn-primary w-full justify-center"
                      onClick={() => {
                        blip('tick');
                        onSelectMission(m.id);
                      }}
                      aria-label={`Explore ${m.shortName} hardware in 3D`}
                    >
                      Explore Hardware <IconArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost w-full justify-center text-[13px] py-1"
                      onClick={() => {
                        blip('tick');
                        onLaunchGame(m.id);
                      }}
                      aria-label={`Play ${m.shortName} field test`}
                    >
                      <IconPlay size={13} /> Launch Field Test
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </ScreenFrame>
  );
}
