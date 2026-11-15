import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { missions, pad2 } from '../lib/missions';
import { selectBadges, useAppStore } from '../store/useAppStore';
import { ScreenFrame } from '../components/ui/Layout';
import { IconExternal, IconLock, IconTrophy } from '../components/ui/Icons';
import { useT } from '../i18n/useT';
import { HeliosWordmark } from '../components/ui/HeliosMark';
import { narrator, useVoicesVersion } from '../narration/narrator';

/** Names the voice source: pre-rendered Google Gemini TTS static audio files. */
function NarrationCredit() {
  const t = useT();
  useVoicesVersion();
  const provider = narrator.files.providerName ?? 'Google Gemini TTS';
  return (
    <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-fg-2">
      {t('credits.narration', { provider })}
    </p>
  );
}

export default function BadgesScreen() {
  const progress = useAppStore(
    useShallow((s) => ({
      issuesOpened: s.issuesOpened,
      hotspotsSeen: s.hotspotsSeen,
      gameResults: s.gameResults,
      artifacts: s.artifacts,
      transmissionsRead: s.transmissionsRead,
      roverResult: s.roverResult,
    })),
  );
  const t = useT();
  const reset = useAppStore((s) => s.resetProgress);
  const go = useAppStore((s) => s.go);
  const [confirm, setConfirm] = useState(false);
  const badges = selectBadges(progress);
  const earned = badges.filter((b) => b.earned).length;
  const totalHotspots = missions.reduce((n, m) => n + m.hotspots.length, 0);
  /** Interface keys exist for the built-in badges; mission badges keep their mission copy. */
  const tOr = (key: string, fallback: string, vars?: Record<string, number>) => {
    const v = t(key, vars);
    return v === key ? fallback : v;
  };

  return (
    <ScreenFrame
      kicker={t('badges.kicker')}
      title={
        <>
          {t('badges.titleA')} <span className="text-[var(--accent)]">{t('badges.titleB')}</span>
        </>
      }
      status={t('badges.status', { earned, total: badges.length })}
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
                <h2 className="font-pixel text-[16px]">{tOr(`badge.${b.id}.name`, b.name)}</h2>
                <p className="mt-1 text-[14px] text-fg-2">{tOr(`badge.${b.id}.criteria`, b.criteria, { n: totalHotspots })}</p>
                <p className="mt-2 font-pixel text-[12px]" style={{ color: b.earned ? 'var(--color-ok)' : 'var(--color-fg-3)' }}>
                  {t(b.earned ? 'badges.earned' : 'badges.lockedCaps').toLocaleUpperCase()}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <h2 className="label-caps mt-10 !text-fg-2">{t('badges.issues')}</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {missions.map((m) => {
            const r = progress.gameResults[m.id];
            return (
              <li key={m.id} className="plate" data-theme={m.theme}>
                <p className="kicker">{t('nav.issue', { n: pad2(m.issueNumber) })}</p>
                <h3 className="plate__title">{m.shortName}</h3>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 font-pixel text-[12px] text-fg-2">
                  <dt>{t('badges.opened')}</dt>
                  <dd className="text-right">{progress.issuesOpened.includes(m.id) ? t('badges.yes') : '—'}</dd>
                  <dt>{t('badges.hotspots')}</dt>
                  <dd className="text-right">
                    {progress.hotspotsSeen[m.id]?.length ?? 0}/{m.hotspots.length}
                  </dd>
                  <dt>{t('badges.best')}</dt>
                  <dd className="text-right">{r ? `${r.best}%` : '—'}</dd>
                  <dt>{t('badges.artifact')}</dt>
                  <dd className="text-right">{progress.artifacts.includes(m.id) ? m.artifact.name : t('badges.locked')}</dd>
                </dl>
                <button type="button" className="btn-ghost mt-4" onClick={() => go('story', m.id)}>
                  {t('badges.openIssue')}
                </button>
              </li>
            );
          })}
        </ul>

        <section id="credits" className="mt-10 grid scroll-mt-6 gap-8 md:grid-cols-[1.4fr_1fr]" aria-labelledby="credits-h">
          <div>
            <HeliosWordmark width={180} title="Team Helios" />
            <h2 id="credits-h" className="label-caps mt-4 !text-fg-2">
              {t('credits.title')}
            </h2>
            <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-fg-2">{t('credits.art')}</p>
            <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-fg-2">{t('credits.labels')}</p>
            <NarrationCredit />
            <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-fg-2">{t('credits.translation')}</p>
            <ul className="mt-4 space-y-1.5">
              {missions.flatMap((m) => m.sources).map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="credit-link text-[13px]">
                    {s.label} <IconExternal size={12} />
                    <span className="sr-only"> {t('credits.newTab')}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label-caps !text-fg-2">{t('progress.title')}</h2>
            <p className="mt-2 text-[14px] text-fg-2">{t('progress.saved')}</p>
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
                  {t('progress.erase')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
                  {t('progress.cancel')}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-ghost mt-4" onClick={() => setConfirm(true)}>
                {t('progress.reset')}
              </button>
            )}
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}
