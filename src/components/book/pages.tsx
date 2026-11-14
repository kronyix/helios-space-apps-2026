import type { MissionData } from '../../data/types';
import { formatCoord, pad2, panelsForStage } from '../../lib/missions';
import { ComicPanel } from '../comic/ComicPage';
import { HeliosMark } from '../ui/HeliosMark';
import { IconArrowRight } from '../ui/Icons';

/** A page of the issue's book, built from missions.json (no copy lives here). */
export type BookPage =
  | { kind: 'cover'; key: string }
  | { kind: 'intro'; key: string }
  | { kind: 'panel'; key: string; panelNumber: number }
  | { kind: 'back'; key: string };

/** Cover · mission intro · story panels (State II) · back cover. */
export function buildPages(m: MissionData): BookPage[] {
  return [
    { kind: 'cover', key: 'cover' },
    { kind: 'intro', key: 'intro' },
    ...panelsForStage(m, 'story').map((p) => ({ kind: 'panel' as const, key: `p${p.panelNumber}`, panelNumber: p.panelNumber })),
    { kind: 'back', key: 'back' },
  ];
}

export function PageFace({
  page,
  index,
  total,
  mission,
  onInspect,
  live,
  eager = false,
}: {
  page: BookPage | null;
  index: number;
  total: number;
  mission: MissionData;
  onInspect?: () => void;
  /** false for faces drawn on the turning leaf: decorative copies, hidden from AT and not focusable */
  live: boolean;
  /** load images immediately (offscreen snapshot copies) */
  eager?: boolean;
}) {
  if (!page) return <div className="page page--endpaper" aria-hidden="true" />;
  const folio = (
    <span className="page__folio" aria-hidden="true">
      {index + 1} / {total}
    </span>
  );

  if (page.kind === 'cover') {
    return (
      <div className="page page--cover" data-theme={mission.theme}>
        <div className="page-cover__art" style={{ backgroundImage: `url(${mission.comicPanels[0].comicImage})` }} aria-hidden="true" />
        <div className="page-cover__body">
          <p className="page-cover__issue">
            ISSUE <b>{pad2(mission.issueNumber)}</b>
          </p>
          <h2 className="page-cover__title">{mission.issueTitle}</h2>
          <p className="page-cover__hw">{mission.hardwareName}</p>
          <p className="page-cover__loc">
            {mission.coordinates.locationName}
            <br />
            <span>{formatCoord(mission.coordinates.lat, mission.coordinates.lng)}</span>
          </p>
          <span className="page-cover__mark" aria-hidden="true">
            <HeliosMark size={30} /> Chronicles of the Silent Pioneers
          </span>
        </div>
      </div>
    );
  }

  if (page.kind === 'intro') {
    const t = mission.telemetry;
    return (
      <div className="page page--paper">
        <p className="page__kicker">Mission {pad2(mission.issueNumber)}</p>
        <h3 className="page__title">{mission.hardwareName}</h3>
        <p className="page__lede">{mission.logline}</p>
        <dl className="page__file">
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
          <div>
            <dt>{t.lastContactLabel ?? 'Last contact'}</dt>
            <dd>{t.lastContact}</dd>
          </div>
        </dl>
        <p className="page__note">{mission.fictionNotice}</p>
        {folio}
      </div>
    );
  }

  if (page.kind === 'panel') {
    const panel = mission.comicPanels.find((p) => p.panelNumber === page.panelNumber)!;
    return (
      <div className="page page--paper page--panel">
        <p className="page__kicker">
          {mission.issueTitle} · {panel.beat ?? ''}
        </p>
        <ComicPanel panel={panel} mission={mission} total={mission.comicPanels.length} size="lg" priority={live || eager} />
        {folio}
      </div>
    );
  }

  return (
    <div className="page page--back" data-theme={mission.theme}>
      <p className="page__kicker">Chapter III</p>
      <p className="page-back__lede">Panels 1 and 2 are told. The hardware is waiting.</p>
      {live ? (
        <button type="button" className="btn-primary page-back__cta" onClick={onInspect}>
          Inspect the hardware <IconArrowRight size={18} />
        </button>
      ) : (
        <span className="btn-primary page-back__cta" aria-hidden="true">
          Inspect the hardware <IconArrowRight size={18} />
        </span>
      )}
      <span className="page-cover__mark" aria-hidden="true">
        <HeliosMark size={24} /> Team Helios
      </span>
    </div>
  );
}
