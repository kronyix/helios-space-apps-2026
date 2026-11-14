import type { FieldArchive as FA } from '../../data/types';
import { IconExternal } from '../ui/Icons';
import { ImageLabel } from './ComicPage';

/**
 * Side-by-side official image catalog (Issue 01: NSSDC Spirit vs Opportunity).
 * Every caption is quoted from the catalog page; each column links its source.
 */
export function FieldArchive({ archive }: { archive: FA }) {
  return (
    <section className="field-archive" aria-labelledby="fa-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Official data source</p>
          <h2 id="fa-h" className="mt-1 font-display text-[26px] font-semibold">
            {archive.title}
          </h2>
        </div>
        <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-fg-2">{archive.note}</p>
      </div>
      <div className="field-archive__cols">
        {archive.rovers.map((r) => (
          <div key={r.rover} className="field-archive__col">
            <header className="field-archive__head">
              <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--accent)]">{r.designation}</span>
              <h3 className="font-display text-[20px] font-semibold">{r.name}</h3>
              <span className="font-mono text-[11px] tracking-[0.12em] text-fg-3">{r.site}</span>
            </header>
            <ul className="flex flex-col gap-4">
              {r.items.map((it) => (
                <li key={it.file}>
                  <figure className="m-0">
                    <a href={it.file} target="_blank" rel="noreferrer noopener" className="field-archive__img">
                      <img src={it.image} alt={it.caption} loading="lazy" decoding="async" />
                      <ImageLabel kind="archival" credit="NASA/JPL" />
                      <span className="sr-only"> (full-resolution image at NSSDC, opens in a new tab)</span>
                    </a>
                    <figcaption className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
                      <span className="mb-1 block font-mono text-[10.5px] tracking-[0.14em] text-fg-3">{it.when}</span>
                      {it.caption}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] text-fg-3">
              Images and captions courtesy NASA/JPL ·{' '}
              <a href={r.catalog} target="_blank" rel="noreferrer noopener" className="credit-link">
                NSSDCA {r.name} catalog <IconExternal size={12} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
