/** Signal Delay — session state (Zustand). Engine stays pure; this wires it to time and UI. */
import { create } from 'zustand';
import { createGame, executeSol, predict, RULES } from './engine';
import { generateLevel } from './terrain';
import type { Command, GameState, PathPoint, SimResult, SolReport } from './types';

export type Phase = 'briefing' | 'planning' | 'uplink' | 'executing' | 'downlink' | 'won' | 'lost';
export type CamMode = 'chase' | 'hazcam' | 'map';
export type Menu = 'pause' | 'rules' | null;

export const UPLINK_SEC = 5;

interface Clock {
  start: number;
  dur: number;
}

interface RoverStore {
  game: GameState;
  phase: Phase;
  queue: Command[];
  dist: 1 | 2 | 5;
  cam: CamMode;
  hud: boolean;
  menu: Menu;
  view: '3d' | '2d';
  report: SolReport | null;
  /** Cumulative playback weights for report.actual.path. */
  timeline: number[];
  clock: Clock | null;
  pausedAt: number | null;
  run: number;

  start: () => void;
  add: (c: Command) => void;
  remove: (i: number) => void;
  move: (i: number, d: -1 | 1) => void;
  clear: () => void;
  setDist: (d: 1 | 2 | 5) => void;
  send: () => void;
  tick: (now: number) => void;
  nextSol: () => void;
  setCam: (c: CamMode) => void;
  cycleCam: () => void;
  toggleHud: () => void;
  setView: (v: '3d' | '2d') => void;
  openMenu: (m: Menu) => void;
  restart: () => void;
}

let terrainCache: ReturnType<typeof generateLevel> | null = null;
export const getTerrain = () => (terrainCache ??= generateLevel());

/** Weight per path point: distance for drive steps, ~0.8 m-equivalent per radian turned. */
export function buildTimeline(path: PathPoint[]) {
  const t = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const w = Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(b.heading - a.heading) * 0.8 + (b.cmd !== a.cmd ? 0.15 : 0);
    t.push(t[i - 1] + Math.max(0.02, w));
  }
  return t;
}

export function playbackSeconds(timeline: number[]) {
  const total = timeline[timeline.length - 1] ?? 0;
  return Math.min(9, Math.max(2.5, 1 + total * 0.22));
}

/** Interpolated pose along a path at normalized time u. */
export function poseAt(path: PathPoint[], timeline: number[], u: number): PathPoint {
  if (path.length === 0) throw new Error('empty path');
  if (path.length === 1 || u <= 0) return path[0];
  const total = timeline[timeline.length - 1];
  const target = Math.min(1, u) * total;
  let lo = 0;
  let hi = timeline.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid] <= target) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
  const span = timeline[hi] - timeline[lo];
  const k = span > 0 ? (target - timeline[lo]) / span : 1;
  return {
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
    y: a.y + (b.y - a.y) * k,
    heading: a.heading + (b.heading - a.heading) * k,
    tilt: a.tilt + (b.tilt - a.tilt) * k,
    sand: a.sand + (b.sand - a.sand) * k,
    cmd: k < 0.5 ? a.cmd : b.cmd,
  };
}

const now = () => performance.now();

export const useRoverStore = create<RoverStore>()((set, get) => ({
  game: createGame(getTerrain()),
  phase: 'briefing',
  queue: [],
  dist: 2,
  cam: 'map',
  hud: true,
  menu: null,
  view: '3d',
  report: null,
  timeline: [],
  clock: null,
  pausedAt: null,
  run: 0,

  start: () => set({ phase: 'planning', cam: 'map', menu: null }),
  add: (c) => {
    const { phase, queue } = get();
    if (phase !== 'planning' || queue.length >= RULES.maxCommands) return;
    set({ queue: [...queue, c] });
  },
  remove: (i) => set((s) => (s.phase === 'planning' ? { queue: s.queue.filter((_, k) => k !== i) } : s)),
  move: (i, d) =>
    set((s) => {
      const j = i + d;
      if (s.phase !== 'planning' || j < 0 || j >= s.queue.length) return s;
      const q = [...s.queue];
      [q[i], q[j]] = [q[j], q[i]];
      return { queue: q };
    }),
  clear: () => set((s) => (s.phase === 'planning' ? { queue: [] } : s)),
  setDist: (dist) => set({ dist }),

  send: () => {
    const { phase, queue } = get();
    if (phase !== 'planning' || queue.length === 0) return;
    set({ phase: 'uplink', clock: { start: now(), dur: UPLINK_SEC }, pausedAt: null });
  },

  tick: (t) => {
    const s = get();
    if (!s.clock || s.pausedAt !== null) return;
    if ((t - s.clock.start) / 1000 < s.clock.dur) return;
    if (s.phase === 'uplink') {
      const { game, report } = executeSol(s.game, s.queue);
      const timeline = buildTimeline(report.actual.path);
      set({
        game,
        report,
        timeline,
        phase: 'executing',
        cam: s.cam === 'map' ? 'chase' : s.cam,
        clock: { start: t, dur: playbackSeconds(timeline) },
      });
    } else if (s.phase === 'executing') {
      const r = s.report!;
      set({
        phase: r.outcome === 'won' ? 'won' : r.outcome === 'lost' ? 'lost' : 'downlink',
        clock: null,
        queue: [],
      });
    }
  },

  nextSol: () => set((s) => (s.phase === 'downlink' ? { phase: 'planning', cam: 'map' } : s)),
  setCam: (cam) => set({ cam }),
  cycleCam: () => set((s) => ({ cam: s.cam === 'chase' ? 'hazcam' : s.cam === 'hazcam' ? 'map' : 'chase' })),
  toggleHud: () => set((s) => ({ hud: !s.hud })),
  setView: (view) => set({ view }),

  openMenu: (menu) =>
    set((s) => {
      const t = now();
      // Pausing freezes the uplink/playback clock; resuming shifts it forward.
      if (menu && s.pausedAt === null) return { menu, pausedAt: t };
      if (!menu && s.pausedAt !== null) {
        return { menu, pausedAt: null, clock: s.clock ? { ...s.clock, start: s.clock.start + (t - s.pausedAt) } : null };
      }
      return { menu };
    }),

  restart: () =>
    set((s) => ({
      game: createGame(getTerrain()),
      phase: 'planning',
      queue: [],
      cam: 'map',
      menu: null,
      report: null,
      timeline: [],
      clock: null,
      pausedAt: null,
      run: s.run + 1,
    })),
}));

/** Normalized clock progress (0..1), frozen while paused. */
export function clockProgress(s: Pick<RoverStore, 'clock' | 'pausedAt'>, t = now()) {
  if (!s.clock) return 0;
  const ref = s.pausedAt ?? t;
  return Math.min(1, Math.max(0, (ref - s.clock.start) / 1000 / s.clock.dur));
}

/** Memoized ghost-path prediction for the current queue. */
let predCache: { game: GameState; queue: Command[]; result: SimResult } | null = null;
export function usePrediction(): SimResult {
  const game = useRoverStore((s) => s.game);
  const queue = useRoverStore((s) => s.queue);
  if (!predCache || predCache.game !== game || predCache.queue !== queue) {
    predCache = { game, queue, result: predict(game, queue) };
  }
  return predCache.result;
}

export function resetRoverSession() {
  useRoverStore.setState({
    game: createGame(getTerrain()),
    phase: 'briefing',
    queue: [],
    cam: 'map',
    hud: true,
    menu: null,
    report: null,
    timeline: [],
    clock: null,
    pausedAt: null,
  });
}

// Review hook (dev builds only): lets scripts/review/rover.ts drive the game.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __rover?: typeof useRoverStore }).__rover = useRoverStore;
}
