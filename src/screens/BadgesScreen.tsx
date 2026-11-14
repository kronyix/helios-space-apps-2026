import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { missions, pad2 } from '../lib/missions';
import { selectBadges, useAppStore } from '../store/useAppStore';
import { ScreenFrame } from '../components/ui/Layout';
import { IconExternal, IconLock, IconTrophy } from '../components/ui/Icons';

export default function BadgesScreen() {
  const progress = useAppStore(
    useShallow((s) => ({
      issuesOpened: s.issuesOpened,
      hotspotsSeen: s.hotspotsSeen,
      gameResults: s.gameResults,
      artifacts: s.artifacts,
      transmissionsRead: s.transmissionsRead,
    })),
  );
  const reset = useAppStore((s) => s.resetProgress);
  const go = useAppStore((s) => s.go);
  const [confirm, setConfirm] = useState(false);
  const badges = selectBadges(progress);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <ScreenFrame
      kicker="Expedition log"
      title={
        <>
          Badges &amp; <span className="text-[var(--accent)]">artifacts</span>
        </>
      }
      status={`${earned} / ${badges.length} badges`}
      background={<div className="reward-bg" aria-hidden="true" />}
    >
      <div className="badges-wrap">
        <ul className="badge-grid">
          {badges.map((b) => (
            <li key={b.id} className="badge-tile" data-earned={b.earned || undefined}>
              <span className="badge-orb" aria-hidden="true">
                {b.earned ? <IconTrophy size={22} /> : <IconLock size={20} />}
              </span>
              <div>
                <h2 className="font-display text-[19px] font-semibold">{b.name}</h2>
                <p className="mt-1 text-[14px] text-fg-2">{b.criteria}</p>
                <p className="mt-2 font-mono text-[10.5px] tracking-[0.2em]" style={{ color: b.earned ? 'var(--color-ok)' : 'var(--color-fg-3)' }}>
                  {b.earned ? 'EARNED' : 'LOCKED'}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <h2 className="label-caps mt-10 !text-fg-2">Issues</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {missions.map((m) => {
            const r = progress.gameResults[m.id];
            return (
              <li key={m.id} className="plate" data-theme={m.theme}>
                <p className="kicker">Issue {pad2(m.issueNumber)}</p>
                <h3 className="plate__title">{m.shortName}</h3>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 font-mono text-[12px] text-fg-2">
                  <dt>Opened</dt>
                  <dd className="text-right">{progress.issuesOpened.includes(m.id) ? 'yes' : '—'}</dd>
                  <dt>Hotspots</dt>
                  <dd className="text-right">
                    {progress.hotspotsSeen[m.id]?.length ?? 0}/{m.hotspots.length}
                  </dd>
                  <dt>Best score</dt>
                  <dd className="text-right">{r ? `${r.best}%` : '—'}</dd>
                  <dt>Artifact</dt>
                  <dd className="text-right">{progress.artifacts.includes(m.id) ? m.artifact.name : 'locked'}</dd>
                </dl>
                <button type="button" className="btn-ghost mt-4" onClick={() => go('story', m.id)}>
                  Open issue
                </button>
              </li>
            );
          })}
        </ul>

        <section className="mt-10 grid gap-8 md:grid-cols-[1.4fr_1fr]" aria-labelledby="credits-h">
          <div>
            <h2 id="credits-h" className="label-caps !text-fg-2">
              Credits &amp; sources
            </h2>
            <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-fg-2">
              Archival photographs courtesy of NASA, NASA/JPL-Caltech and their partner institutions, credited on each panel. Comic
              illustrations and 3D dioramas are by Team Helios; most panels are AI-generated (Google Gemini) and labeled as such on the
              panel. Speech balloons are fictionalized narration; caption boxes and hotspot
              facts are documented history. This project is not affiliated with or endorsed by NASA.
            </p>
            <ul className="mt-4 space-y-1.5">
              {missions.flatMap((m) => m.sources).map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="credit-link text-[13px]">
                    {s.label} <IconExternal size={12} />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label-caps !text-fg-2">Progress</h2>
            <p className="mt-2 text-[14px] text-fg-2">Progress is saved in this browser only.</p>
            {confirm ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-ghost !border-[var(--color-bad)]"
                  onClick={() => {
                    reset();
                    setConfirm(false);
                  }}
                >
                  Yes, erase progress
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn-ghost mt-4" onClick={() => setConfirm(true)}>
                Reset progress
              </button>
            )}
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}
