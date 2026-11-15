/**
 * Signal Delay — pure game engine. No React, no Three.
 * All numbers here are gameplay tuning ("Mission rules"), not real rover specs.
 */
import { mulberry32 } from '../../lib/noise';
import { generateLevel, heightAt, sandAt } from './terrain';
import type {
  Command,
  Fault,
  FaultCode,
  GameState,
  PathPoint,
  RoverState,
  SimEvent,
  SimResult,
  SolReport,
  Terrain,
} from './types';

export const RULES = {
  maxCommands: 6,
  maxSols: 8,
  stepM: 0.1,
  tiltWarnDeg: 20,
  tiltStopDeg: 30,
  tipOverDeg: 40,
  /** Distance the rover keeps rolling after hazard detection trips. */
  brakeM: 0.5,
  slipMin: 0.4, // fraction of commanded distance achieved in full soft sand
  slipMax: 0.7,
  softSandMask: 0.5,
  sinkagePerM: 0.02,
  sinkageMax: 0.9,
  stuckSols: 3,
  stuckProgress: 0.2,
  batteryPerM: 1.4,
  batteryPerMSand: 1.6,
  batteryPerMPerDeg: 0.04,
  batteryPerTurn15: 0.15,
  batteryScan: 2,
  rechargePerSol: 28,
  dustPerSol: 0.05,
  dustMax: 0.6,
  scanRangeM: 3,
  /** Rover footprint half extents (≈1.6 m long, 1.2 m wide). */
  halfLength: 0.8,
  halfWidth: 0.6,
  /** Wheel contact points used for pitch/roll. */
  wheelBaseHalf: 0.6,
  trackHalf: 0.5,
  wheelClearance: 0.25,
} as const;

export const SCORING = {
  base: 1000,
  perUnusedSol: 80,
  perBatteryPct: 5,
  perHazardFault: -50,
  threeStars: 1500,
  twoStars: 1100,
} as const;

const DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Geometry helpers

export function contactPoints(x: number, z: number, heading: number) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = fz; // right vector
  const rz = -fx;
  const L = RULES.wheelBaseHalf;
  const W = RULES.trackHalf;
  return {
    fl: [x + fx * L - rx * W, z + fz * L - rz * W],
    fr: [x + fx * L + rx * W, z + fz * L + rz * W],
    bl: [x - fx * L - rx * W, z - fz * L - rz * W],
    br: [x - fx * L + rx * W, z - fz * L + rz * W],
  } as const;
}

/** Pitch, roll and combined tilt (degrees) plus body height from four wheel contacts. */
export function attitude(t: Terrain, x: number, z: number, heading: number) {
  const c = contactPoints(x, z, heading);
  const h = (p: readonly number[]) => heightAt(t, p[0], p[1]);
  const fl = h(c.fl);
  const fr = h(c.fr);
  const bl = h(c.bl);
  const br = h(c.br);
  const tp = ((fl + fr) / 2 - (bl + br) / 2) / (2 * RULES.wheelBaseHalf);
  const tr = ((fl + bl) / 2 - (fr + br) / 2) / (2 * RULES.trackHalf);
  return {
    pitch: Math.atan(tp) * DEG,
    roll: Math.atan(tr) * DEG,
    tilt: Math.atan(Math.hypot(tp, tr)) * DEG,
    y: (fl + fr + bl + br) / 4,
  };
}

/** Oriented-rectangle footprint vs circle rock. */
export function hitsRock(t: Terrain, x: number, z: number, heading: number) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  for (const r of t.rocks) {
    const dx = r.x - x;
    const dz = r.z - z;
    if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;
    const lf = dx * fx + dz * fz; // along heading
    const lr = dx * fz - dz * fx; // along right
    const cf = Math.max(-RULES.halfLength, Math.min(RULES.halfLength, lf));
    const cr = Math.max(-RULES.halfWidth, Math.min(RULES.halfWidth, lr));
    if ((lf - cf) ** 2 + (lr - cr) ** 2 < r.radius * r.radius) return r;
  }
  return null;
}

export const distToTarget = (t: Terrain, x: number, z: number) => Math.hypot(t.target.x - x, t.target.z - z);

// ---------------------------------------------------------------------------
// State

export function createRover(t: Terrain): RoverState {
  return {
    ...t.start,
    battery: 100,
    sol: 1,
    dust: 0,
    sinkage: 0,
    sandStreak: 0,
    hazardFaults: 0,
    faults: [],
    odometer: 0,
    status: 'active',
  };
}

export function createGame(terrain: Terrain = generateLevel()): GameState {
  return { terrain, rover: createRover(terrain), reports: [] };
}

export function canAddCommand(queue: Command[]) {
  return queue.length < RULES.maxCommands;
}

// ---------------------------------------------------------------------------
// Simulation

interface SimOpts {
  slip: boolean;
  rng: () => number;
}

function seededRng(t: Terrain, sol: number) {
  return mulberry32(t.seed * 1009 + sol * 7919);
}

function simulate(t: Terrain, start: RoverState, queue: Command[], opts: SimOpts): SimResult {
  const s: RoverState = { ...start, faults: [...start.faults] };
  const path: PathPoint[] = [];
  const events: SimEvent[] = [];
  let commandedDistance = 0;
  let actualDistance = 0;
  let maxTilt = 0;
  let haltedAt: number | null = null;
  const battery0 = s.battery;
  const half = t.size / 2 - 1.5;

  const push = (cmd: number, tilt: number) => {
    const a = attitude(t, s.x, s.z, s.heading);
    path.push({ x: s.x, z: s.z, y: a.y, heading: s.heading, tilt, sand: sandAt(t, s.x, s.z), cmd });
  };
  const fault = (code: FaultCode, hazard = true) => {
    const f: Fault = { sol: s.sol, code, x: s.x, z: s.z };
    s.faults.push(f);
    if (hazard) s.hazardFaults++;
  };
  const note = (e: SimEvent) => {
    if (!events.includes(e)) events.push(e);
  };
  const drain = (pct: number) => {
    s.battery = Math.max(0, s.battery - pct);
    if (s.battery <= 0) {
      s.status = 'lost';
      s.loseReason = 'battery';
      note('battery_dead');
    }
  };

  push(-1, attitude(t, s.x, s.z, s.heading).tilt);

  for (let ci = 0; ci < queue.length && s.status === 'active' && haltedAt === null; ci++) {
    const cmd = queue[ci];

    if (cmd.type === 'scan') {
      drain(RULES.batteryScan);
      if (s.status !== 'active') break;
      if (distToTarget(t, s.x, s.z) <= RULES.scanRangeM) {
        s.status = 'won';
        note('scan_ok');
      } else {
        fault('scan_range', false);
        note('scan_range');
      }
      push(ci, attitude(t, s.x, s.z, s.heading).tilt);
      continue;
    }

    if (cmd.type === 'turn') {
      const next = s.heading + (cmd.deg * Math.PI) / 180;
      drain((Math.abs(cmd.deg) / 15) * RULES.batteryPerTurn15);
      if (s.status !== 'active') break;
      if (hitsRock(t, s.x, s.z, next)) {
        fault('turn_blocked');
        note('turn_blocked');
        haltedAt = ci;
      } else {
        s.heading = next;
      }
      const a = attitude(t, s.x, s.z, s.heading);
      maxTilt = Math.max(maxTilt, a.tilt);
      if (a.tilt > RULES.tipOverDeg) {
        s.status = 'lost';
        s.loseReason = 'tipover';
        note('tipover');
      } else if (a.tilt > RULES.tiltStopDeg && haltedAt === null) {
        fault('tilt');
        note('tilt_stop');
        haltedAt = ci;
      }
      push(ci, a.tilt);
      continue;
    }

    // forward / back
    const dir = cmd.type === 'forward' ? 1 : -1;
    const steps = Math.round(cmd.m / RULES.stepM);
    let brake = -1; // remaining brake steps once a tilt stop trips
    for (let k = 0; k < steps || brake > 0; k++) {
      if (brake === 0) break;
      const sand = sandAt(t, s.x, s.z);
      let eff = 1;
      let drift = 0;
      if (opts.slip && sand > 0.05) {
        const base = RULES.slipMin + (RULES.slipMax - RULES.slipMin) * opts.rng();
        eff = 1 - sand * (1 - base);
        eff *= 1 - s.sinkage;
        drift = (opts.rng() - 0.5) * 0.03 * sand;
        s.sinkage = Math.min(RULES.sinkageMax, s.sinkage + RULES.sinkagePerM * RULES.stepM * sand);
        if (eff < 0.95) note('slip');
      } else if (opts.slip && sand < 0.05) {
        s.sinkage = Math.max(0, s.sinkage - 0.01);
      }

      const a0 = attitude(t, s.x, s.z, s.heading);
      const cost =
        RULES.stepM *
        (RULES.batteryPerM + RULES.batteryPerMSand * sand + RULES.batteryPerMPerDeg * Math.max(0, a0.pitch * dir));
      drain(cost);
      commandedDistance += RULES.stepM;
      if (s.status !== 'active') break;

      const d = RULES.stepM * eff * dir;
      const heading = s.heading + drift;
      const nx = s.x + Math.sin(heading) * d;
      const nz = s.z + Math.cos(heading) * d;

      if (Math.abs(nx) > half || Math.abs(nz) > half) {
        fault('edge');
        note('edge_stop');
        haltedAt = ci;
        break;
      }
      if (hitsRock(t, nx, nz, heading)) {
        fault('rock');
        note('rock_stop');
        haltedAt = ci;
        break;
      }

      s.x = nx;
      s.z = nz;
      s.heading = heading;
      s.odometer += Math.abs(d);
      actualDistance += Math.abs(d);

      const a = attitude(t, s.x, s.z, s.heading);
      maxTilt = Math.max(maxTilt, a.tilt);
      push(ci, a.tilt);

      if (a.tilt > RULES.tipOverDeg) {
        s.status = 'lost';
        s.loseReason = 'tipover';
        note('tipover');
        break;
      }
      if (a.tilt > RULES.tiltWarnDeg) note('tilt_warning');
      if (a.tilt > RULES.tiltStopDeg && brake < 0) {
        fault('tilt');
        note('tilt_stop');
        haltedAt = ci;
        brake = Math.round(RULES.brakeM / RULES.stepM);
      } else if (brake > 0) brake--;
    }
  }

  return {
    path,
    end: s,
    commandedDistance,
    actualDistance,
    batteryUsed: battery0 - s.battery,
    maxTilt,
    events,
    haltedAt,
  };
}

/** Ghost path: same rules, no slip. Does not mutate state. */
export function predict(game: GameState, queue: Command[]): SimResult {
  return simulate(game.terrain, game.rover, queue.slice(0, RULES.maxCommands), {
    slip: false,
    rng: () => 0.5,
  });
}

/** Run one sol with slip, then end the sol (stuck check, recharge, sol counter). */
export function executeSol(game: GameState, queue: Command[]): { game: GameState; report: SolReport } {
  const t = game.terrain;
  const q = queue.slice(0, RULES.maxCommands);
  const before = game.rover;
  const predicted = predict(game, q);
  const actual = simulate(t, before, q, { slip: true, rng: seededRng(t, before.sol) });
  const r: RoverState = { ...actual.end };
  const batteryAfterDrive = r.battery;

  const slip = actual.commandedDistance > 0 ? Math.max(0, 1 - actual.actualDistance / actual.commandedDistance) : 0;
  const endedInSand = sandAt(t, r.x, r.z) >= RULES.softSandMask;

  if (r.status === 'active') {
    const progress = actual.commandedDistance > 0 ? actual.actualDistance / actual.commandedDistance : 0;
    r.sandStreak = endedInSand && progress < RULES.stuckProgress ? r.sandStreak + 1 : 0;
    if (r.sandStreak >= RULES.stuckSols) {
      r.status = 'lost';
      r.loseReason = 'sand';
    } else if (r.sol >= RULES.maxSols) {
      r.status = 'lost';
      r.loseReason = 'sols';
    } else {
      r.battery = Math.min(100, r.battery + RULES.rechargePerSol * (1 - r.dust));
      r.dust = Math.min(RULES.dustMax, r.dust + RULES.dustPerSol);
      r.sol += 1;
    }
  }

  const report: SolReport = {
    sol: before.sol,
    queue: q,
    predicted,
    actual,
    slip,
    batteryBefore: before.battery,
    batteryAfterDrive,
    batteryAfterRecharge: r.battery,
    endedInSand,
    outcome: r.status,
    loseReason: r.loseReason,
  };
  return { game: { ...game, rover: r, reports: [...game.reports, report] }, report };
}

// ---------------------------------------------------------------------------
// Scoring

export function score(r: RoverState) {
  if (r.status !== 'won') return { points: 0, stars: 0 };
  const points = Math.round(
    SCORING.base +
      SCORING.perUnusedSol * (RULES.maxSols - r.sol) +
      SCORING.perBatteryPct * r.battery +
      SCORING.perHazardFault * r.hazardFaults,
  );
  const stars = points >= SCORING.threeStars ? 3 : points >= SCORING.twoStars ? 2 : 1;
  return { points, stars };
}
