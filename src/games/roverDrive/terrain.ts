/**
 * Seeded terrain for Signal Delay. Shared by the engine (collision, tilt, slip)
 * and the renderer (mesh displacement, sand tint, rock instances).
 */
import { fbm, mulberry32 } from '../../lib/noise';
import type { Pose, Rock, Terrain } from './types';

export const LEVEL_SEED = 2004; // Opportunity landed at Meridiani Planum in Jan 2004
export const LEVEL_SIZE = 120;
export const LEVEL_RES = 129;

export interface TerrainSpec {
  seed: number;
  size: number;
  res: number;
  height: (x: number, z: number) => number;
  sand: (x: number, z: number) => number;
  rocks: Rock[];
  start: Pose;
  target: { x: number; z: number; radius: number };
  crater?: { x: number; z: number; radius: number } | null;
}

/** Bake height + sand functions onto a grid. Used by the level and by tests. */
export function buildTerrain(spec: TerrainSpec): Terrain {
  const { size, res } = spec;
  const heights = new Float32Array(res * res);
  const sand = new Float32Array(res * res);
  const step = size / (res - 1);
  for (let j = 0; j < res; j++) {
    const z = -size / 2 + j * step;
    for (let i = 0; i < res; i++) {
      const x = -size / 2 + i * step;
      heights[j * res + i] = spec.height(x, z);
      sand[j * res + i] = Math.min(1, Math.max(0, spec.sand(x, z)));
    }
  }
  return {
    seed: spec.seed,
    size,
    res,
    heights,
    sand,
    rocks: spec.rocks,
    start: spec.start,
    target: spec.target,
    crater: spec.crater ?? null,
  };
}

function sampleGrid(t: Terrain, grid: Float32Array, x: number, z: number) {
  const step = t.size / (t.res - 1);
  const max = t.res - 1;
  const gx = Math.min(max, Math.max(0, (x + t.size / 2) / step));
  const gz = Math.min(max, Math.max(0, (z + t.size / 2) / step));
  const i0 = Math.min(max - 1, Math.floor(gx));
  const j0 = Math.min(max - 1, Math.floor(gz));
  const fx = gx - i0;
  const fz = gz - j0;
  const a = grid[j0 * t.res + i0];
  const b = grid[j0 * t.res + i0 + 1];
  const c = grid[(j0 + 1) * t.res + i0];
  const d = grid[(j0 + 1) * t.res + i0 + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export const heightAt = (t: Terrain, x: number, z: number) => sampleGrid(t, t.heights, x, z);
export const sandAt = (t: Terrain, x: number, z: number) => sampleGrid(t, t.sand, x, z);

/** Unit surface normal [nx, ny, nz] via central differences. */
export function normalAt(t: Terrain, x: number, z: number): [number, number, number] {
  const e = 0.25;
  const dx = (heightAt(t, x + e, z) - heightAt(t, x - e, z)) / (2 * e);
  const dz = (heightAt(t, x, z + e) - heightAt(t, x, z - e)) / (2 * e);
  const len = Math.hypot(dx, 1, dz);
  return [-dx / len, 1 / len, -dz / len];
}

// ---------------------------------------------------------------------------
// The level: a Meridiani-style plain.

const START: Pose = { x: -30, z: -28, heading: 0 };
const TARGET = { x: 28, z: 26, radius: 3 };
const CRATER = { x: -1, z: -1, radius: 9 };
const CRATER_DEPTH = 4.5;
const CRATER_RIM = 0.9;

interface SandField {
  x: number;
  z: number;
  rx: number;
  rz: number;
  angle: number;
}

const SAND_FIELDS: SandField[] = [
  { x: -15, z: 11, rx: 13, rz: 6, angle: 0.75 },
  { x: 13, z: -15, rx: 13, rz: 6, angle: 0.75 },
  { x: 19, z: 13, rx: 6, rz: 3.5, angle: -0.6 },
];

function sandField(x: number, z: number) {
  let m = 0;
  for (const f of SAND_FIELDS) {
    const c = Math.cos(f.angle);
    const s = Math.sin(f.angle);
    const u = ((x - f.x) * c - (z - f.z) * s) / f.rx;
    const v = ((x - f.x) * s + (z - f.z) * c) / f.rz;
    const d = Math.sqrt(u * u + v * v);
    // Soft edge: full sand inside 0.6, fading to 0 at 1.0
    const k = Math.min(1, Math.max(0, (1 - d) / 0.4));
    m = Math.max(m, k * k * (3 - 2 * k));
  }
  return m;
}

function levelHeight(seed: number) {
  return (x: number, z: number) => {
    let h = (fbm(x * 0.015 + 10, z * 0.015 + 10, 4, seed) - 0.5) * 6;
    h += (fbm(x * 0.12, z * 0.12, 3, seed + 7) - 0.5) * 0.5;

    // Crater: parabolic bowl + gaussian rim
    const r = Math.hypot(x - CRATER.x, z - CRATER.z);
    const R = CRATER.radius;
    if (r < R) h -= CRATER_DEPTH * (1 - (r / R) ** 2);
    h += CRATER_RIM * Math.exp(-(((r - R) / 1.6) ** 2));

    // Sand ripples, crests perpendicular to the field's long axis
    const m = sandField(x, z);
    if (m > 0) {
      const u = x * Math.cos(0.75) - z * Math.sin(0.75);
      h += m * 0.22 * Math.sin((u / 2.6) * Math.PI * 2);
    }

    // Flatten the start pad and the outcrop slab
    const ds = Math.hypot(x - START.x, z - START.z);
    const ws = Math.min(1, Math.max(0, (6 - ds) / 3));
    const hs = (fbm(START.x * 0.015 + 10, START.z * 0.015 + 10, 4, seed) - 0.5) * 6;
    h = h * (1 - ws) + hs * ws;

    const dt = Math.hypot(x - TARGET.x, z - TARGET.z);
    const wt = Math.min(1, Math.max(0, (5 - dt) / 2.5));
    const ht = (fbm(TARGET.x * 0.015 + 10, TARGET.z * 0.015 + 10, 4, seed) - 0.5) * 6 + 0.25;
    h = h * (1 - wt) + ht * wt;
    return h;
  };
}

function levelRocks(seed: number, count = 250): Rock[] {
  const rng = mulberry32(seed * 31 + 5);
  const rocks: Rock[] = [];
  const half = LEVEL_SIZE / 2 - 2;
  let guard = 0;
  while (rocks.length < count && guard++ < 20000) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const radius = 0.15 + 0.55 * rng() ** 3;
    if (Math.hypot(x - START.x, z - START.z) < 6) continue;
    if (Math.hypot(x - TARGET.x, z - TARGET.z) < 5) continue;
    // Soft sand buries most rocks
    if (sandField(x, z) > 0.4 && rng() < 0.85) continue;
    if (rocks.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + radius + 0.3)) continue;
    rocks.push({ x, z, radius });
  }
  return rocks;
}

export function generateLevel(seed = LEVEL_SEED): Terrain {
  const start: Pose = {
    ...START,
    heading: Math.atan2(TARGET.x - START.x, TARGET.z - START.z),
  };
  return buildTerrain({
    seed,
    size: LEVEL_SIZE,
    res: LEVEL_RES,
    height: levelHeight(seed),
    sand: sandField,
    rocks: levelRocks(seed),
    start,
    target: TARGET,
    crater: CRATER,
  });
}
