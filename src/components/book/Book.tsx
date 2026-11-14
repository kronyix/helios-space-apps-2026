import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, type AnimationPlaybackControls } from 'motion/react';
import type { MissionData } from '../../data/types';
import { pad2 } from '../../lib/missions';
import { dur, ease } from '../../lib/motion';
import { useMediaQuery, useReducedMotion } from '../../lib/useReducedMotion';
import { useAppStore } from '../../store/useAppStore';
import { pageTurnSound } from '../../lib/audio';
import { IconArrowLeft, IconArrowRight } from '../ui/Icons';
import { buildPages, PageFace, type BookPage } from './pages';
import { lazy, Suspense } from 'react';
import { hasWebGL } from '../../lib/device';
import { ENDPAPER, useSnapshots } from './useSnapshots';
import type { LeafState } from './BookGL';

const BookGL = lazy(() => import('./BookGL'));

type Turn = { from: number; to: number; p: number };

/**
 * The issue as a book you page through.
 * - Desktop: two-page spreads (cover alone on the right). Mobile: one page at a time.
 * - At rest every page is real DOM. During a turn only the turning leaf is a 3D
 *   transformed copy; the pages underneath stay live DOM, so there is no swap jump.
 * - Drag a page (follows the pointer, flick or >40% completes, otherwise springs back),
 *   click an outer page edge, ←/→ PageUp/PageDown Space, or the scrubber (riffle).
 */
export default function Book({ mission, onInspect }: { mission: MissionData; onInspect: () => void }) {
  const pages = useMemo(() => buildPages(mission), [mission]);
  const N = pages.length;
  const spreadMode = useMediaQuery('(min-width: 900px)');
  const reduced = useReducedMotion();
  const page = useAppStore((s) => s.narrative.page);
  const setNarrative = useAppStore((s) => s.setNarrative);

  const spreadCount = spreadMode ? Math.floor(N / 2) + 1 : N;
  const spreadOf = useCallback((pg: number) => (spreadMode ? Math.ceil(pg / 2) : pg), [spreadMode]);
  const firstPageOf = useCallback((s: number) => (spreadMode ? Math.max(0, 2 * s - 1) : s), [spreadMode]);
  const spread = Math.min(spreadCount - 1, spreadOf(Math.min(page, N - 1)));

  const L = (s: number): BookPage | null => (spreadMode ? (s === 0 ? null : (pages[2 * s - 1] ?? null)) : null);
  const R = (s: number): BookPage | null => (spreadMode ? (pages[2 * s] ?? null) : (pages[s] ?? null));
  const idxL = (s: number) => 2 * s - 1;
  const idxR = (s: number) => (spreadMode ? 2 * s : s);

  /** Which turn is happening (React state, changes twice per turn). Progress lives in pRef. */
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnRef = useRef<Turn | null>(null);
  turnRef.current = turn;
  const pRef = useRef(0);
  const leafEl = useRef<HTMLDivElement>(null);
  const foldF = useRef<HTMLDivElement>(null);
  const foldB = useRef<HTMLDivElement>(null);
  const sheenEl = useRef<HTMLDivElement>(null);
  const shadowL = useRef<HTMLDivElement>(null);
  const shadowR = useRef<HTMLDivElement>(null);
  const glRef = useRef<LeafState | null>(null);

  /** Per-frame update without React: CSS leaf transform, shading, shadows, GL uniforms. */
  const paint = useCallback((p: number) => {
    pRef.current = p;
    const t = turnRef.current;
    if (!t) return;
    const fwd = t.to > t.from;
    const single = !spreadMode;
    const angle = spreadMode ? (fwd ? -180 * p : 180 * p) : fwd ? -180 * p : -180 * (1 - p);
    const shade = Math.sin(p * Math.PI);
    const leafOpacity = single ? 1 - Math.max(0, (Math.abs(angle) - 120) / 60) : 1;
    if (leafEl.current) {
      leafEl.current.style.transform = `rotateY(${angle.toFixed(2)}deg)`;
      leafEl.current.style.opacity = String(leafOpacity);
    }
    if (foldF.current) foldF.current.style.opacity = String(shade * 0.55);
    if (foldB.current) foldB.current.style.opacity = String(shade * 0.55);
    if (sheenEl.current) {
      sheenEl.current.style.opacity = String(shade * 0.5);
      sheenEl.current.style.setProperty('--sheen', `${(p * 160 - 30).toFixed(1)}%`);
    }
    if (shadowL.current) shadowL.current.style.opacity = String(shade * (spreadMode && !fwd ? 0.5 : 0.35));
    if (shadowR.current) shadowR.current.style.opacity = String(shade * 0.5);
    const g = glRef.current;
    if (g) {
      g.p = single && !fwd ? 1 - p : p;
      g.opacity = leafOpacity;
    }
  }, [spreadMode]);
  const [fadeDir, setFadeDir] = useState(1);
  const [announce, setAnnounce] = useState('');
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const [pageW, setPageW] = useState(400);
  const [pageH, setPageH] = useState(540);
  const queue = useRef<number[]>([]);
  const storyMode = useAppStore((s) => s.storyMode);
  const gl = useMemo(() => hasWebGL(), []) && !reduced;

  useEffect(() => {
    const el = bookRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPageW(el.clientWidth / (spreadMode ? 2 : 1));
      setPageH(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [spreadMode]);

  // Pages near the current spread get WebGL textures for the turning leaf.
  const firstVisible = spreadMode ? Math.max(0, 2 * spread - 1) : spread;
  const wanted = useMemo(() => {
    const out: number[] = [];
    for (let i = Math.max(0, firstVisible - 2); i <= Math.min(N - 1, firstVisible + 3); i++) out.push(i);
    return out;
  }, [firstVisible, N]);
  const snaps = useSnapshots({ enabled: gl, pages, mission, pageW, pageH, mode: storyMode, wanted, mobile: !spreadMode });


  const settle = useCallback(
    (to: number) => {
      const first = firstPageOf(to);
      setNarrative({ page: first, turning: false });
      const vis = spreadMode && to > 0 && to * 2 < N ? `pages ${first + 1}–${first + 2}` : `page ${first + 1}`;
      setAnnounce(`${mission.issueTitle}: ${vis} of ${N}`);
    },
    [firstPageOf, setNarrative, spreadMode, N, mission.issueTitle],
  );

  /** Animate the current (or a new) turn to completion (target 1) or back (target 0). */
  const run = useCallback(
    (t: Turn, target: 0 | 1, duration: number) => {
      anim.current?.stop();
      turnRef.current = t;
      setTurn(t);
      setNarrative({ turning: true });
      paint(t.p);
      anim.current = animate(t.p, target, {
        duration: Math.max(0.12, duration * Math.max(0.35, Math.abs(target - t.p))),
        ease: ease.pageTurn,
        onUpdate: paint,
        onComplete: () => {
          setTurn(null);
          settle(target === 1 ? t.to : t.from);
          const next = queue.current.shift();
          if (next !== undefined && target === 1) stepTo(next, true);
        },
      });
    },
    // stepTo (declared below) is only called after the animation completes.
    [setNarrative, settle, paint],
  );

  const stepTo = useCallback(
    (to: number, riffle = false) => {
      const from = spreadOf(useAppStore.getState().narrative.page);
      if (to < 0 || to >= spreadCount || to === from) return;
      const dir = to > from ? 1 : -1;
      const nextTo = from + dir;
      if (reduced) {
        setFadeDir(dir);
        settle(to);
        return;
      }
      pageTurnSound();
      const remaining = Math.abs(to - from);
      if (remaining > 1) queue.current = Array.from({ length: remaining - 1 }, (_, i) => nextTo + dir * (i + 1));
      const per = riffle || remaining > 1 ? Math.max(0.14, dur.riffle / Math.max(remaining + queue.current.length, 1)) : dur.pageTurn;
      run({ from, to: nextTo, p: 0 }, 1, per);
    },
    [spreadOf, spreadCount, reduced, settle, run],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      if (turn || queue.current.length) return;
      stepTo(spread + dir);
    },
    [turn, spread, stepTo],
  );

  // Keyboard: ← → PageUp PageDown Space (Space only when focus isn't on a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('input, textarea, [role=dialog]')) return;
      const onControl = !!t.closest?.('button, a');
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onControl && !e.shiftKey)) {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && !onControl && e.shiftKey)) {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Drag / flick / click-the-edge.
  const drag = useRef<{ x: number; t: number; dir: 1 | -1; started: boolean; samples: [number, number][] } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (turn || reduced || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, [role=radiogroup]')) return;
    const r = bookRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const dir: 1 | -1 = x > r.width / 2 ? 1 : -1;
    if ((dir === 1 && spread >= spreadCount - 1) || (dir === -1 && spread <= 0)) return;
    drag.current = { x: e.clientX, t: performance.now(), dir, started: false, samples: [[e.clientX, performance.now()]] };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.started && Math.abs(dx) < 6) return;
    if (!d.started) {
      d.started = true;
      const t = { from: spread, to: spread + d.dir, p: 0 };
      turnRef.current = t;
      setTurn(t);
      setNarrative({ turning: true });
    }
    d.samples.push([e.clientX, performance.now()]);
    if (d.samples.length > 6) d.samples.shift();
    const p = Math.min(1, Math.max(0, (-dx * d.dir) / (pageW * (spreadMode ? 1.7 : 1.1))));
    paint(p);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.started) {
      // A click: turn if it landed on the outer edge of a page.
      const r = bookRef.current!.getBoundingClientRect();
      const x = e.clientX - r.left;
      const edge = Math.min(90, pageW * 0.2);
      if ((d.dir === 1 && x > r.width - edge) || (d.dir === -1 && x < edge)) {
        pageTurnSound();
        run({ from: spread, to: spread + d.dir, p: 0 }, 1, dur.pageTurn);
      }
      return;
    }
    const [x0, t0] = d.samples[0];
    const v = (e.clientX - x0) / Math.max(1, performance.now() - t0); // px/ms
    const p = pRef.current;
    const flick = -v * d.dir > 0.5;
    const t: Turn = { from: spread, to: spread + d.dir, p };
    if (p > 0.4 || flick) {
      pageTurnSound();
      run(t, 1, dur.pageTurn);
    } else run(t, 0, dur.pageTurn * 0.8);
  };

  useEffect(() => () => anim.current?.stop(), []);

  // Leaf geometry for the current turn.
  const leaf = (() => {
    if (!turn) return null;
    const { from, to } = turn;
    const fwd = to > from;
    if (spreadMode) {
      return fwd
        ? { side: 'right' as const, front: R(from), frontIdx: idxR(from), back: L(to), backIdx: idxL(to), underL: L(from), underLIdx: idxL(from), underR: R(to), underRIdx: idxR(to) }
        : { side: 'left' as const, front: L(from), frontIdx: idxL(from), back: R(to), backIdx: idxR(to), underL: L(to), underLIdx: idxL(to), underR: R(from), underRIdx: idxR(from) };
    }
    return fwd
      ? { side: 'single' as const, front: R(from), frontIdx: from, back: null, backIdx: -1, underL: null, underLIdx: -1, underR: R(to), underRIdx: to }
      : { side: 'single' as const, front: R(to), frontIdx: to, back: null, backIdx: -1, underL: null, underLIdx: -1, underR: R(from), underRIdx: from };
  })();

  // WebGL leaf when both faces have textures; otherwise the CSS 3D leaf is used.
  const glLeaf: LeafState | null = (() => {
    if (!gl || !leaf || !turn) return null;
    const front = snaps.get(leaf.front ? leaf.frontIdx : ENDPAPER);
    const back = snaps.get(leaf.back ? leaf.backIdx : ENDPAPER);
    if (!front || !back) return null;
    const prev = glRef.current;
    const p = prev?.p ?? (leaf.side === 'single' && turn.to < turn.from ? 1 : 0);
    return { p, side: leaf.side === 'left' ? -1 : 1, front, back, spineX: pageW, opacity: prev?.opacity ?? 1 };
  })();
  glRef.current = glLeaf;
  const M = Math.round(pageH * 0.14);

  const shade = turn ? Math.sin(pRef.current * Math.PI) : 0;
  const p0 = pRef.current;
  const angle0 = !turn ? 0 : spreadMode ? (turn.to > turn.from ? -180 * p0 : 180 * p0) : turn.to > turn.from ? -180 * p0 : -180 * (1 - p0);
  const face = (pg: BookPage | null, i: number, live: boolean) => (
    <PageFace page={pg} index={i} total={N} mission={mission} onInspect={onInspect} live={live} />
  );

  const restL = L(spread);
  const restR = R(spread);
  const label = `${mission.issueTitle} comic, ${
    spreadMode && spread > 0 && restR ? `pages ${idxL(spread) + 1}–${idxR(spread) + 1}` : `page ${(spreadMode ? (spread === 0 ? 0 : idxL(spread)) : spread) + 1}`
  } of ${N}`;

  return (
    <div className="book-wrap">
      <div
        ref={bookRef}
        className={`book ${spreadMode ? 'book--spread' : 'book--single'} ${turn ? 'is-turning' : ''}`}
        role="region"
        aria-roledescription="book"
        aria-label={label}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-theme={mission.theme}
      >
        {reduced ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={spread}
              className="book__pages"
              initial={{ opacity: 0, x: 16 * fadeDir }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 * fadeDir }}
              transition={{ duration: dur.pageFade, ease: ease.out }}
            >
              {spreadMode && <div className="book__half book__half--left">{face(restL, idxL(spread), true)}</div>}
              <div className="book__half book__half--right">{face(restR, idxR(spread), true)}</div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="book__pages">
            {spreadMode && (
              <div className="book__half book__half--left">
                {leaf ? face(leaf.underL, leaf.underLIdx, false) : face(restL, idxL(spread), true)}
                {leaf && <div ref={shadowL} className="book__shadow book__shadow--from-spine-l" style={{ opacity: shade * (leaf.side === 'left' ? 0.5 : 0.35) }} />}
              </div>
            )}
            <div className="book__half book__half--right">
              {leaf ? face(leaf.underR, leaf.underRIdx, false) : face(restR, idxR(spread), true)}
              {leaf && (leaf.side === 'right' || leaf.side === 'single') && (
                <div ref={shadowR} className="book__shadow book__shadow--from-spine" style={{ opacity: shade * 0.5 }} />
              )}
            </div>

            {leaf && !glLeaf && (
              <div
                ref={leafEl}
                className={`book__leaf book__leaf--${leaf.side}`}
                style={{
                  transform: `rotateY(${angle0}deg)`,
                  opacity: leaf.side === 'single' ? 1 - Math.max(0, (Math.abs(angle0) - 120) / 60) : 1,
                }}
                aria-hidden="true"
                inert
              >
                <div className="book__face book__face--front">
                  {face(leaf.front, leaf.frontIdx, false)}
                  <div ref={foldF} className="book__fold" style={{ opacity: shade * 0.55 }} />
                  <div ref={sheenEl} className="book__sheen" style={{ opacity: shade * 0.5, ['--sheen' as string]: `${(p0 * 160 - 30).toFixed(1)}%` }} />
                </div>
                <div className="book__face book__face--back">
                  {face(leaf.back, leaf.backIdx, false)}
                  <div ref={foldB} className="book__fold book__fold--back" style={{ opacity: shade * 0.55 }} />
                </div>
              </div>
            )}
          </div>
        )}
        {spreadMode && <div className="book__spine" aria-hidden="true" />}
        {gl && pageW > 50 && (
          <div className="book-gl-wrap" style={{ top: -M, bottom: -M, left: spreadMode ? 0 : -pageW, right: 0 }}>
            <Suspense fallback={null}>
              <BookGL leafRef={glRef} active={!!glLeaf} pageW={pageW} pageH={pageH} overlayW={pageW * 2} overlayH={pageH + 2 * M} />
            </Suspense>
          </div>
        )}
      </div>
      {snaps.host}

      <div className="book-controls">
        <button type="button" className="btn-icon" onClick={() => go(-1)} disabled={spread <= 0 || !!turn} aria-label="Previous page">
          <IconArrowLeft />
        </button>
        <ol className="book-scrubber" aria-label="Jump to page">
          {Array.from({ length: spreadCount }, (_, s) => {
            const first = spreadMode ? (s === 0 ? 0 : 2 * s - 1) : s;
            const last = spreadMode && s > 0 ? Math.min(N - 1, 2 * s) : first;
            const name = first === last ? `Page ${first + 1}` : `Pages ${first + 1}–${last + 1}`;
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-current={s === spread ? 'page' : undefined}
                  aria-label={name}
                  disabled={!!turn}
                  onClick={() => stepTo(s, true)}
                >
                  <span>{s === 0 ? 'Cover' : first === last ? pad2(first + 1) : `${pad2(first + 1)}–${pad2(last + 1)}`}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="btn-icon"
          onClick={() => go(1)}
          disabled={spread >= spreadCount - 1 || !!turn}
          aria-label="Next page"
        >
          <IconArrowRight />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
