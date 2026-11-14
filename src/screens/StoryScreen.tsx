import type { MissionData } from '../data/types';
import { pad2 } from '../lib/missions';
import { useAppStore } from '../store/useAppStore';
import { AccentTitle, ScreenFrame } from '../components/ui/Layout';
import { ModeToggle } from '../components/comic/ComicPage';
import { IconCalendar, IconClock, IconPin, IconSignal, IconWeight } from '../components/ui/Icons';
import { ChapterNav } from './ChapterNav';
import Book from '../components/book/Book';
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

  return (
    <ScreenFrame
      kicker={`Issue ${pad2(mission.issueNumber)} · ${mission.coordinates.locationName.split(',')[0]}`}
      title={<AccentTitle text={mission.issueTitle} />}
      status={`Chapter II · The Story`}
      background={
        <div className="story-bg" aria-hidden="true">
          <img src={mission.comicPanels[2].comicImage} alt="" />
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
      <div className="story-reader">
        <div className="story-reader__bar">
          <ModeToggle />
          <p className="font-mono text-[11px] tracking-[0.12em] text-fg-3">{mission.fictionNotice}</p>
        </div>
        <Book
          mission={mission}
          onInspect={() => {
            prefetch(mission.modelPath);
            go('hardware');
          }}
        />
      </div>
      {mission.fieldArchive && <FieldArchive archive={mission.fieldArchive} />}
    </ScreenFrame>
  );
}
