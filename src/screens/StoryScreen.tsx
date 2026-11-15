import { AiMark } from '../components/comic/ComicPage';
import type { MissionData } from '../data/types';
import { formatCoord, pad2, panelsForStage } from '../lib/missions';
import { useAppStore } from '../store/useAppStore';
import { AccentTitle, ScreenFrame } from '../components/ui/Layout';
import { ScrollComic } from '../components/comic/ScrollComic';
import { IssueComic } from '../components/comic/IssueComic';
import { ISSUE_01, type ComicIssue } from '../data/comics/opportunity-spirit';
import { ISSUE_02 } from '../data/comics/apollo11';
import { ISSUE_03 } from '../data/comics/ingenuity';

const MOTION_COMICS: Record<number, ComicIssue> = { 1: ISSUE_01, 2: ISSUE_02, 3: ISSUE_03 };
import { IconArrowRight, IconCalendar, IconClock, IconPin, IconSignal, IconWeight } from '../components/ui/Icons';
import { ChapterNav } from './ChapterNav';
import { FieldArchive } from '../components/comic/FieldArchive';
import { hasWebGL } from '../lib/device';

/** Warm the hardware chunk and model before the user commits to the click. */
function prefetch(path: string) {
  if (!hasWebGL()) return;
  void import('../components/three/HardwareViewer').then((m) => m.preloadModel(path));
}

export function MissionFile({ mission }: { mission: MissionData }) {
  const t = mission.telemetry;
  const rows = [
    { icon: <IconCalendar size={18} />, k: 'Launched', v: t.launchDate },
    { icon: <IconPin size={18} />, k: 'Landed', v: `${t.landingDate} · ${mission.coordinates.locationName.split(',')[0]}` },
    { icon: <IconClock size={18} />, k: 'Planned → actual', v: `${t.plannedLifespan} → ${t.actualLifespan}` },
    { icon: <IconSignal size={18} />, k: t.lastContactLabel ?? 'Last contact', v: t.lastContact },
    { icon: <IconWeight size={18} />, k: t.massNote ?? 'Mass', v: `${t.massKg.toLocaleString()} kg` },
  ];
  return (
    <section className="mission-file" aria-labelledby={`mf-${mission.id}`}>
      <h2 id={`mf-${mission.id}`} className="label-caps !text-fg-2">
        Mission file
      </h2>
      <dl className="mt-3 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
        {rows.map((r) => (
          <div key={r.k} className="grid grid-cols-[22px_1fr] gap-3 py-2.5">
            <span className="mt-0.5 text-[var(--accent)]">{r.icon}</span>
            <div>
              <dt className="text-[12px] text-fg-3">{r.k}</dt>
              <dd className="text-[14px] leading-snug text-fg">{r.v}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function StoryScreen({ mission }: { mission: MissionData }) {
  const go = useAppStore((s) => s.go);

  const motionComic = MOTION_COMICS[mission.issueNumber];
  if (motionComic) {
    return (
      <IssueComic
        key={mission.id}
        issue={motionComic}
        onContinue={() => {
          prefetch(mission.modelPath);
          go('hardware');
        }}
      />
    );
  }

  const panels = panelsForStage(mission, 'story');
  const t = mission.telemetry;

  return (
    <ScreenFrame
      kicker={`Issue ${pad2(mission.issueNumber)} · ${mission.coordinates.locationName.split(',')[0]}`}
      title={<AccentTitle text={mission.issueTitle} />}
      status={`Chapter II · The Story`}
      background={
        <div className="story-bg" aria-hidden="true">
          <img src={mission.comicPanels[2].comicImage} alt="" width={1280} height={720} decoding="async" />
          <AiMark />
        </div>
      }
      footer={
        <ChapterNav
          mission={mission}
          step={1}
          onPrev={() => go('archive', null)}
          onNext={() => go('hardware')}
          nextLabel="Hardware"
        />
      }
    >
      <ScrollComic
        mission={mission}
        panels={panels}
        header={
          <div className="scroll-comic__brief">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="kicker">{mission.hardwareName}</p>
              <span className="font-pixel text-[12px] text-fg-3">
                {mission.coordinates.locationName} · {formatCoord(mission.coordinates.lat, mission.coordinates.lng)}
              </span>
            </div>
            <p className="mt-2 text-[15.5px] leading-relaxed text-fg-2">{mission.logline}</p>
            <dl className="scroll-comic__telemetry">
              <div>
                <dt>Launched</dt>
                <dd>{t.launchDate}</dd>
              </div>
              <div>
                <dt>Landed</dt>
                <dd>{t.landingDate}</dd>
              </div>
              <div>
                <dt>Planned</dt>
                <dd>{t.plannedLifespan}</dd>
              </div>
              <div>
                <dt>Actual</dt>
                <dd>{t.actualLifespan}</dd>
              </div>
            </dl>
          </div>
        }
        footer={
          <div className="scroll-comic__cta-card">
            <div>
              <p className="kicker">Chapter III · Hardware</p>
              <p className="scroll-comic__cta-lede">Panels 1 and 2 are told. The hardware is waiting.</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              aria-label="Inspect the hardware — Explore the hardware"
              onMouseEnter={() => prefetch(mission.modelPath)}
              onFocus={() => prefetch(mission.modelPath)}
              onClick={() => {
                prefetch(mission.modelPath);
                go('hardware');
              }}
            >
              Inspect the hardware <IconArrowRight size={18} />
            </button>
          </div>
        }
      />
      {mission.fieldArchive && <FieldArchive archive={mission.fieldArchive} />}
    </ScreenFrame>
  );
}

