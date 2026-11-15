import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ComicPanel, MissionData } from '../../data/types';
import { getPanelLines, pad2 } from '../../lib/missions';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { useAppStore } from '../../store/useAppStore';
import { IconArrowLeft, IconArrowRight, IconExternal } from '../ui/Icons';
import { ImageLabel, ModeToggle } from './ComicPage';

export interface ScrollComicProps {
  mission: MissionData;
  panels: ComicPanel[];
  /** Optional header block rendered inside the centered scroll column before panels */
  header?: ReactNode;
  /** Optional CTA / footer block rendered at the end of the panel stream */
  footer?: ReactNode;
}

function formatBeat(beat?: string): string {
  if (!beat) return '';
  return beat.replace(/_/g, ' ');
}

export function ScrollComic({ mission, panels, header, footer }: ScrollComicProps) {
  const mode = useAppStore((s) => s.storyMode);
  const reduced = useReducedMotion();
  const archival = mode === 'archival';
  const total = mission.comicPanels.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [inViewMap, setInViewMap] = useState<Record<number, boolean>>({ 0: true });
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  // Reset active index when mission or panel subset changes
  useEffect(() => {
    setActiveIndex(0);
    setInViewMap({ 0: true });
  }, [mission.id, panels]);

  // Ensure panels already within the viewport when the screen clip-path finishes also reveal
  useEffect(() => {
    const checkVisible = () => {
      const vh = window.innerHeight || 800;
      const next: Record<number, boolean> = { 0: true };
      panelRefs.current.forEach((node, idx) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        if (rect.top < vh * 0.92 && rect.bottom > 0) {
          next[idx] = true;
        }
      });
      setInViewMap((prev) => ({ ...prev, ...next }));
    };
    checkVisible();
    const t1 = window.setTimeout(checkVisible, 250);
    const t2 = window.setTimeout(checkVisible, 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [mission.id, panels]);

  // Track which panel is most in view for the sticky progress rail
  useEffect(() => {
    const nodes = panelRefs.current.filter((n): n is HTMLElement => n !== null);
    if (!nodes.length || typeof IntersectionObserver === 'undefined') return;

    const ratios = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.intersectionRatio);
          if (entry.isIntersecting) {
            const idx = nodes.indexOf(entry.target as HTMLElement);
            if (idx >= 0) {
              setInViewMap((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }));
            }
          }
        }
        let bestIdx = -1;
        let bestRatio = 0;
        nodes.forEach((node, idx) => {
          const r = ratios.get(node) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0 && bestRatio > 0.15) {
          setActiveIndex(bestIdx);
        }
      },
      { threshold: [0, 0.15, 0.4, 0.6, 0.8, 1] },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [panels, mission.id]);

  const scrollToPanel = useCallback(
    (idx: number, focusPanel = false) => {
      const clamped = Math.max(0, Math.min(panels.length - 1, idx));
      const el = panelRefs.current[clamped];
      if (!el) return;
      setActiveIndex(clamped);
      setInViewMap((prev) => ({ ...prev, [clamped]: true }));
      el.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      });
      if (focusPanel) {
        el.focus({ preventScroll: true });
      }
    },
    [panels.length, reduced],
  );

  // Ensure keyboard scrolling and panel navigation work reliably on desktop (.screen__scroll) and mobile (window)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [role="dialog"]')) return;
      const onInteractive = !!target?.closest?.('button, a, [role="radio"]');

      if (e.key === 'ArrowRight' && !onInteractive) {
        if (activeIndex < panels.length - 1) {
          e.preventDefault();
          scrollToPanel(activeIndex + 1, true);
        }
        return;
      }
      if (e.key === 'ArrowLeft' && !onInteractive) {
        if (activeIndex > 0) {
          e.preventDefault();
          scrollToPanel(activeIndex - 1, true);
        }
        return;
      }

      // Desktop uses .screen__scroll with overflow-y: auto while body is overflow: hidden.
      // Route native vertical scroll keys to .screen__scroll if it isn't already the active target.
      const scroller = document.querySelector<HTMLElement>('.screen__scroll');
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;

      const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
      if (e.key === 'PageDown' || (e.key === ' ' && !onInteractive && !e.shiftKey)) {
        e.preventDefault();
        scroller.scrollBy({ top: Math.round(scroller.clientHeight * 0.8), behavior });
      } else if (e.key === 'PageUp' || (e.key === ' ' && !onInteractive && e.shiftKey)) {
        e.preventDefault();
        scroller.scrollBy({ top: -Math.round(scroller.clientHeight * 0.8), behavior });
      } else if (e.key === 'ArrowDown' && !onInteractive) {
        e.preventDefault();
        scroller.scrollBy({ top: 120, behavior });
      } else if (e.key === 'ArrowUp' && !onInteractive) {
        e.preventDefault();
        scroller.scrollBy({ top: -120, behavior });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, panels.length, reduced, scrollToPanel]);

  return (
    <div className="scroll-comic">
      <div className="scroll-comic__sticky">
        <div className="scroll-comic__toolbar">
          <ModeToggle />

          <nav aria-label="Comic panel progress" className="scroll-comic__rail">
            <ol className="scroll-comic__steps">
              {panels.map((p, idx) => {
                const beatText = formatBeat(p.beat);
                const isCurrent = idx === activeIndex;
                return (
                  <li key={p.panelNumber}>
                    <button
                      type="button"
                      className="scroll-comic__step"
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-label={`Jump to Panel ${p.panelNumber} of ${total}${beatText ? `, ${beatText}` : ''}`}
                      onClick={() => scrollToPanel(idx, true)}
                    >
                      <span className="scroll-comic__step-num">{pad2(p.panelNumber)}</span>
                      {beatText && <span className="scroll-comic__step-beat">{beatText}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="scroll-comic__nav-btns">
              <button
                type="button"
                className="btn-icon"
                onClick={() => scrollToPanel(activeIndex - 1, true)}
                disabled={activeIndex <= 0}
                aria-label="Previous panel"
              >
                <IconArrowLeft size={18} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => scrollToPanel(activeIndex + 1, true)}
                disabled={activeIndex >= panels.length - 1}
                aria-label="Next panel"
              >
                <IconArrowRight size={18} />
              </button>
            </div>
          </nav>
        </div>
      </div>

      {mission.fictionNotice && (
        <p className="scroll-comic__disclaimer">{mission.fictionNotice}</p>
      )}

      {header && <div className="scroll-comic__header">{header}</div>}

      <div className="scroll-comic__stream">
        {panels.map((panel, idx) => {
          const beatLabel = formatBeat(panel.beat);
          const sectionName = `Panel ${panel.panelNumber} of ${total}${beatLabel ? `, ${beatLabel}` : ''}`;
          const lines = getPanelLines(panel, `${mission.id}-p${panel.panelNumber}`);
          const isFirst = idx === 0;
          const isVisible = !!inViewMap[idx];

          return (
            <motion.section
              key={panel.panelNumber}
              ref={(el) => {
                panelRefs.current[idx] = el;
              }}
              aria-label={sectionName}
              tabIndex={0}
              data-beat={panel.beat}
              data-panel={panel.panelNumber}
              className="scroll-panel"
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
              animate={isVisible ? { opacity: 1, y: 0 } : undefined}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: reduced ? dur.instant : dur.base, ease: ease.out }}
              onFocus={() => setActiveIndex(idx)}
            >
              <header className="scroll-panel__head">
                <span className="scroll-panel__index">
                  PANEL {pad2(panel.panelNumber)} / {pad2(total)}
                </span>
                {beatLabel && <span className="scroll-panel__beat">{beatLabel}</span>}
              </header>

              <figure className="scroll-panel__figure">
                <div className="comic-panel__frame scroll-panel__frame">
                  <AnimatePresence initial={false} mode="sync">
                    <motion.div
                      key={archival ? 'archival' : 'illustrated'}
                      className="absolute inset-0"
                      initial={{ opacity: 0, scale: reduced ? 1 : 1.02 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? dur.instant : dur.base, ease: ease.out }}
                    >
                      {archival && (
                        <img
                          src={panel.realNasaImage}
                          alt=""
                          aria-hidden="true"
                          width={1280}
                          height={720}
                          className="archival-backdrop"
                          loading={isFirst ? 'eager' : 'lazy'}
                          decoding="async"
                        />
                      )}
                      <img
                        src={archival ? panel.realNasaImage : panel.comicImage}
                        alt={archival ? panel.nasaImageCaption : (panel.comicAlt ?? '')}
                        width={1280}
                        height={720}
                        className={`scroll-panel__img ${archival ? 'archival-photo object-contain' : 'object-cover'}`}
                        style={!archival && panel.comicFocus ? { objectPosition: panel.comicFocus } : undefined}
                        loading={isFirst ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {!archival && <div className="scroll-panel__scrim" aria-hidden="true" />}

                  <ImageLabel
                    kind={archival ? 'archival' : (panel.imageKind ?? 'illustration')}
                    credit={panel.nasaImageCredit ?? 'NASA'}
                    href={archival ? panel.nasaImageSource : undefined}
                  />
                </div>

                <div className={`scroll-panel__lines ${archival ? 'scroll-panel__lines--archival' : ''}`}>
                  {lines.map((line) =>
                    line.kind === 'caption' ? (
                      <div key={line.id} className="caption-box scroll-panel__caption">
                        <span className="scroll-panel__log-tag">Mission Log · Documented History</span>
                        <p className="scroll-panel__caption-text">{line.text}</p>
                      </div>
                    ) : (
                      <div
                        key={line.id}
                        className="balloon scroll-panel__balloon"
                        data-side={panel.panelNumber % 2 ? 'right' : 'left'}
                      >
                        <span className="comic-speaker">
                          {line.speaker ?? mission.shortName}
                          <span className="scroll-panel__fiction-tag"> · Fictionalized narration</span>
                        </span>
                        <p className="scroll-panel__speech-text">{line.text}</p>
                      </div>
                    ),
                  )}
                </div>

                <figcaption className="comic-credit scroll-panel__credit">
                  {archival ? (
                    <>
                      <span className="text-fg-2">{panel.nasaImageCaption}</span>{' '}
                      <span className="font-pixel text-[12px] text-fg-3">
                        Credit: {panel.nasaImageCredit ?? 'NASA'}
                        {panel.nasaImageDate ? ` · ${panel.nasaImageDate}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="font-pixel text-[12px] text-fg-3">
                      Illustrated dramatization · Archival reference: {panel.nasaImageCredit ?? 'NASA'}
                    </span>
                  )}
                  {panel.nasaImageSource && (
                    <>
                      {' · '}
                      <a href={panel.nasaImageSource} target="_blank" rel="noreferrer noopener" className="credit-link">
                        Source <IconExternal size={12} />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  )}
                  {archival && panel.nasaImageFile && (
                    <>
                      {' · '}
                      <a href={panel.nasaImageFile} target="_blank" rel="noreferrer noopener" className="credit-link">
                        Full-res <IconExternal size={12} />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  )}
                </figcaption>
              </figure>
            </motion.section>
          );
        })}
      </div>

      {footer && <div className="scroll-comic__footer">{footer}</div>}
    </div>
  );
}

export default ScrollComic;
