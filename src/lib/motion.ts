/**
 * Shared motion tokens. Every Motion/Framer transition and every camera
 * tween routes through these values. Do not hardcode durations elsewhere.
 */
export const dur = {
  instant: 0.12,
  fast: 0.24,
  base: 0.42,
  slow: 0.7,
  cinematic: 1.4,
  /** One animated page turn. */
  pageTurn: 0.9,
  /** Whole multi-page riffle from the scrubber (split across the turns). */
  riffle: 0.6,
  /** Reduced-motion page change (crossfade + slight slide). */
  pageFade: 0.2,
} as const;

export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  in: [0.55, 0, 1, 0.45] as [number, number, number, number],
  /** Paper: fast lift off the spine, slow settle onto the other side. */
  pageTurn: [0.3, 0.75, 0.2, 1] as [number, number, number, number],
};

/** Total budget for staggered reveals, so a list never drags past ~600ms. */
export const stagger = (count: number, total = 0.5) => Math.min(0.08, total / Math.max(1, count));

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Cubic in-out easing for imperative tweens (camera). */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
