import { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { missions, pad2, formatCoord } from '../lib/missions';
import { useAppStore, selectBadges } from '../store/useAppStore';
import { hasWebGL } from '../lib/device';
import { dur, ease, stagger } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { ScreenFrame } from '../components/ui/Layout';
import { IconArrowRight, IconLock, IconPlay, IconTrophy } from '../components/ui/Icons';
import { blip } from '../lib/audio';

const OrbitalGlobe = lazy(() => import('../components/three/OrbitalGlobe'));

/** No-WebGL fallback: flat maps (one per body) with the same beacons. */
function FlatChart({ onSelect }: { onSelect: (id: string) => void }) {
  const bodies = [
    { id: 'mars', label: 'Mars', map: '/textures/mars_map.jpg' },
    { id: 'moon', label: 'Moon', map: '/textures/moon_map.jpg' },
  ] as const;
  return (
    <div className="flat-chart" role="group" aria-label="Mission sites (static maps)">
      {bodies.map((b) => (
        <div key={b.id} className="flat-globe" style={{ backgroundImage: `url(${b.map})` }}>
          <span className="flat-globe__label">{b.label}</span>
          {missions
            .filter((m) => m.celestialBody === b.id)
            .map((m) => {
              const x = ((m.coordinates.lng + 180) % 360) / 360;
              const y = 0.5 - m.coordinates.lat / 180;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="flat-beacon"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                  onClick={() => onSelect(m.id)}
                  aria-label={`Issue ${pad2(m.issueNumber)}: ${m.issueTitle}, ${m.coordinates.locationName}`}
                >
                  <span>{m.coordinates.locationName.split(',')[0]}</span>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}

export default function ArchiveScreen() {
  const openMission = useAppStore((s) => s.openMission);
  const setDiving = useAppStore((s) => s.setDiving);
  const divingTo = useAppStore((s) => s.divingTo);
  const focused = useAppStore((s) => s.focusedMissionId);
  const setFocused = useAppStore((s) => s.setFocused);
  const opened = useAppStore((s) => s.issuesOpened);
  const artifacts = useAppStore((s) => s.artifacts);
  const progress = useAppStore(
    useShallow((s) => ({
      issuesOpened: s.issuesOpened,
      hotspotsSeen: s.hotspotsSeen,
      gameResults: s.gameResults,
      artifacts: s.artifacts,
      transmissionsRead: s.transmissionsRead,
    })),
  );
  const reduced = useReducedMotion();
  const [body, setBody] = useState<'mars' | 'moon'>('mars');
  const [flash, setFlash] = useState(false);
  const gl = hasWebGL();

  const badges = selectBadges(progress);
  const nextBadge = badges.find((b) => !b.earned);
  const pct = Math.round(((opened.length + artifacts.length) / (missions.length * 2)) * 100);

  const select = (id: string) => {
    if (divingTo) return;
    const m = missions.find((x) => x.id === id)!;
    if (!gl || reduced) {
      openMission(id);
      return;
    }
    setBody(m.celestialBody);
    setDiving(id);
  };

  const onDiveComplete = (id: string) => {
    setFlash(true);
    blip('lock');
    window.setTimeout(() => openMission(id), 140);
  };

  const begin = () => {
    const next = missions.find((m) => !opened.includes(m.id)) ?? missions[0];
    select(next.id);
  };

  return (
    <ScreenFrame
      passthrough
      kicker="Chronicles of the"
      title={
        <>
          Silent <span className="text-[var(--accent)]">Pioneers</span>
        </>
      }
      status={`Archive · ${missions.length} issues`}
      background={
        <>
          {gl ? (
            <Suspense fallback={null}>
              <OrbitalGlobe
                missions={missions}
                selectedBody={body}
                onSelectMission={select}
                divingTo={divingTo}
                onDiveComplete={onDiveComplete}
                focusedId={focused}
                onFocus={setFocused}
              />
            </Suspense>
          ) : (
            <FlatChart onSelect={select} />
          )}
          <div className="archive-vignette" aria-hidden="true" />
          {flash && <div className="dive-flash" aria-hidden="true" />}
        </>
      }
    >
      <div className={`archive-grid ${divingTo ? 'is-diving' : ''}`}>
        <div className="archive-hero">
          <p className="kicker">Explore · Learn · Discover</p>
          <h2 className="archive-headline">
            Abandoned.
            <br />
            Not <span className="text-[var(--accent)]">forgotten.</span>
          </h2>
          <p className="archive-lede">They were left behind. Their discoveries moved humanity forward.</p>
          <span className="hairline mt-5 block w-24" aria-hidden="true" />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" className="btn-primary h-14 px-8 text-[17px]" onClick={begin}>
              <IconPlay size={16} /> Begin the journey <IconArrowRight size={18} />
            </button>
          </div>
          <p className="mt-5 label-caps">{gl ? 'Drag the globe · select a glowing site' : 'Select a site on the map'}</p>

          <div className="body-switch mt-6" role="radiogroup" aria-label="Celestial body">
            {(['mars', 'moon'] as const).map((b) => (
              <button key={b} type="button" role="radio" aria-checked={body === b} onClick={() => setBody(b)}>
                {b === 'mars' ? 'Mars · 2 issues' : 'Moon · 1 issue'}
              </button>
            ))}
          </div>
        </div>

        <aside className="issue-list" aria-labelledby="issues-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="issues-h" className="label-caps !text-fg-2">
              The issues
            </h2>
            <span className="font-mono text-[11px] tracking-[0.18em] text-fg-3">
              {opened.length} / {missions.length} READ
            </span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {missions.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, x: reduced ? 0 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * stagger(missions.length), duration: dur.base, ease: ease.out }}
              >
                <button
                  type="button"
                  className="issue-row"
                  data-theme={m.theme}
                  data-focused={focused === m.id || undefined}
                  onClick={() => select(m.id)}
                  onPointerEnter={() => {
                    setFocused(m.id);
                    setBody(m.celestialBody);
                  }}
                  onPointerLeave={() => setFocused(null)}
                  onFocus={() => {
                    setFocused(m.id);
                    setBody(m.celestialBody);
                  }}
                  onBlur={() => setFocused(null)}
                >
                  <img src={m.comicPanels[2].comicImage} alt="" className="issue-row__thumb" loading="lazy" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-mono text-[10.5px] tracking-[0.18em] text-[var(--accent)]">
                      ISSUE {pad2(m.issueNumber)}
                      {opened.includes(m.id) && <span className="ml-2 text-fg-3">· READ</span>}
                    </span>
                    <span className="mt-0.5 block font-display text-[18px] font-semibold leading-tight text-fg">{m.shortName}</span>
                    <span className="block text-[13px] text-fg-2">{m.issueTitle}</span>
                    <span className="mt-1 block font-mono text-[10px] tracking-[0.08em] text-fg-3">
                      {formatCoord(m.coordinates.lat, m.coordinates.lng)}
                    </span>
                  </span>
                  <IconArrowRight size={18} className="shrink-0 text-[var(--accent)]" />
                </button>
              </motion.li>
            ))}
          </ul>
        </aside>

        <p className="archive-scale" aria-hidden="true">
          Mars · 2 issues / Moon · 1 issue / not to scale
        </p>

        <div className="archive-cards">
          <div className="plate">
            <p className="kicker">Field tests</p>
            <h3 className="plate__title">Three 15-second trials</h3>
            <p className="plate__text">Scan for hematite, bounce a laser off the Moon, spin rotors in thin air.</p>
            <svg viewBox="0 0 260 60" className="plate__spark" aria-hidden="true">
              <path
                d="M0 50 L40 48 L55 30 L65 49 L110 47 L120 38 L128 49 L170 46 L182 6 L194 48 L230 47 L238 36 L246 49 L260 48"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
              />
              <circle cx="182" cy="6" r="6" fill="none" stroke="var(--accent)" />
            </svg>
          </div>
          <div className="plate flex items-center gap-5">
            <div className="progress-ring" style={{ ['--p' as string]: pct }} role="img" aria-label={`Expedition ${pct}% complete`}>
              <span>{pct}%</span>
            </div>
            <div>
              <p className="kicker">Your expedition</p>
              <p className="mt-2 text-[15px] text-fg-2">
                Issues read <b className="font-mono font-normal text-fg">{opened.length}/{missions.length}</b>
              </p>
              <p className="text-[15px] text-fg-2">
                Artifacts recovered <b className="font-mono font-normal text-fg">{artifacts.length}/{missions.length}</b>
              </p>
            </div>
          </div>
          <div className="plate plate--dashed flex items-center gap-5">
            <span className="badge-orb" aria-hidden="true">
              {nextBadge ? <IconLock size={22} /> : <IconTrophy size={22} />}
            </span>
            <div>
              <p className="kicker">{nextBadge ? 'Next badge' : 'All badges earned'}</p>
              <h3 className="plate__title">{nextBadge?.name ?? 'Archivist'}</h3>
              <p className="plate__text">{nextBadge?.criteria ?? 'Every artifact is recovered.'}</p>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}
