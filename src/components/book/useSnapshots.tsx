import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { getFontEmbedCSS, toCanvas } from 'html-to-image';
import type { MissionData } from '../../data/types';
import { PageFace, type BookPage } from './pages';
import { useAppStore } from '../../store/useAppStore';

const END = -1; // endpaper (back of a single-page leaf)

/**
 * Renders the nearby pages offscreen as real DOM and snapshots them into textures for
 * the WebGL leaf, so the turning sheet shows exactly what the resting DOM page shows.
 * - Only pages within ±2 of the current spread are kept; others are disposed.
 * - Snapshots are taken one at a time, on idle, after fonts and images have loaded.
 * - Long edge ≈ 2048 px on desktop, ≈ 1024 px on mobile.
 */
export function useSnapshots({
  enabled,
  pages,
  mission,
  pageW,
  pageH,
  mode,
  wanted,
  mobile,
}: {
  enabled: boolean;
  pages: BookPage[];
  mission: MissionData;
  pageW: number;
  pageH: number;
  mode: string;
  wanted: number[];
  mobile: boolean;
}): { get: (i: number) => THREE.Texture | null; host: ReactNode } {
  const cache = useRef(new Map<string, THREE.CanvasTexture>());
  const font = useRef<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [, setVersion] = useState(0);
  const sizeKey = `${Math.round(pageW)}x${Math.round(pageH)}`;
  const keyOf = (i: number) => `${mission.id}:${i}:${mode}:${sizeKey}`;
  const want = enabled ? [...wanted, END] : [];
  const wantSig = want.join(',');

  useEffect(() => {
    if (!enabled || pageW < 50) return;
    let cancelled = false;
    const keep = new Set(want.map(keyOf));
    for (const [k, t] of cache.current) {
      if (!keep.has(k)) {
        t.dispose();
        cache.current.delete(k);
      }
    }
    // Snapshotting is main-thread work: never during a page turn, only when idle.
    const idle = async () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      do {
        await new Promise<void>((r) => (ric ? ric(() => r(), { timeout: 1500 }) : window.setTimeout(r, 60)));
      } while (useAppStore.getState().narrative.turning && !cancelled);
    };
    (async () => {
      await document.fonts?.ready;
      for (const i of want) {
        await idle();
        if (cancelled) return;
        const key = keyOf(i);
        if (cache.current.has(key)) continue;
        const node = host.current?.querySelector<HTMLElement>(`[data-snap="${i}"]`);
        if (!node) continue;
        await Promise.all(
          [...node.querySelectorAll('img')].map((img) =>
            img.complete
              ? null
              : new Promise((r) => {
                  img.addEventListener('load', r, { once: true });
                  img.addEventListener('error', r, { once: true });
                }),
          ),
        );
        try {
          if (!font.current) font.current = await getFontEmbedCSS(node);
          const ratio = Math.min(2.5, (mobile ? 1024 : 2048) / Math.max(pageW, pageH));
          const canvas = await toCanvas(node, { pixelRatio: ratio, fontEmbedCSS: font.current, width: pageW, height: pageH, cacheBust: false });
          if (cancelled) return;
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          cache.current.set(key, tex);
          setVersion((v) => v + 1);
        } catch {
          /* snapshot failed: the CSS leaf is used for this page */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // keyOf is derived from these values.
  }, [enabled, wantSig, mode, sizeKey, mission.id, mobile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      for (const t of cache.current.values()) t.dispose();
      cache.current.clear();
    },
    [],
  );

  const hostNode = enabled ? (
    <div ref={host} className="book-snaps" aria-hidden="true" inert>
      {want.map((i) => (
        <div key={i} data-snap={i} className="book-snap" style={{ width: pageW, height: pageH }}>
          <PageFace page={i === END ? null : pages[i]} index={i} total={pages.length} mission={mission} live={false} eager />
        </div>
      ))}
    </div>
  ) : null;

  return { get: (i: number) => cache.current.get(keyOf(i)) ?? null, host: hostNode };
}

export const ENDPAPER = END;
