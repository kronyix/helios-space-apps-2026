/**
 * Engine tests. No test runner in the repo, so run with:
 *   npx tsx src/games/roverDrive/engine.test.ts
 */
import { createGame, distToTarget, executeSol, predict, RULES, score, SCORING } from './engine';
import { buildTerrain, generateLevel, heightAt, sandAt } from './terrain';
import type { Command, Rock, RoverState, Terrain } from './types';

let failed = 0;
let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function flat(opts: { height?: (x: number, z: number) => number; sand?: (x: number, z: number) => number; rocks?: Rock[] } = {}): Terrain {
  return buildTerrain({
    seed: 7,
    size: 60,
    res: 121,
    height: opts.height ?? (() => 0),
    sand: opts.sand ?? (() => 0),
    rocks: opts.rocks ?? [],
    start: { x: 0, z: -20, heading: 0 },
    target: { x: 0, z: 10, radius: 3 },
  });
}

const fwd = (m: 1 | 2 | 5): Command => ({ type: 'forward', m });

console.log('Signal Delay engine');

test('flat ground: predict == execute, no slip', () => {
  const g = createGame(flat());
  const q = [fwd(5), fwd(5)];
  const p = predict(g, q);
  const { report } = executeSol(g, q);
  assert(Math.abs(p.actualDistance - 10) < 1e-6, `predicted ${p.actualDistance}`);
  assert(Math.abs(report.actual.actualDistance - 10) < 1e-6, `actual ${report.actual.actualDistance}`);
  assert(report.slip < 1e-6, `slip ${report.slip}`);
});

test('full soft sand: per-step efficiency within 40–70%', () => {
  const g = createGame(flat({ sand: () => 1 }));
  // One metre keeps sinkage negligible (≤0.002), isolating the slip band.
  const { report } = executeSol(g, [fwd(1)]);
  const eff = report.actual.actualDistance / report.actual.commandedDistance;
  assert(eff >= RULES.slipMin * 0.99 && eff <= RULES.slipMax, `efficiency ${eff.toFixed(3)}`);
  const pts = report.actual.path;
  for (let i = 2; i < pts.length; i++) {
    const step = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) / RULES.stepM;
    assert(step >= RULES.slipMin * 0.99 && step <= RULES.slipMax + 1e-6, `step eff ${step.toFixed(3)}`);
  }
  assert(report.actual.events.includes('slip'), 'slip event');
  assert(predict(g, [fwd(1)]).actualDistance > 0.999, 'prediction ignores slip');
});

test('slip is seeded: same sol, same result', () => {
  const t = flat({ sand: () => 1 });
  const a = executeSol(createGame(t), [fwd(5)]).report.actual.actualDistance;
  const b = executeSol(createGame(t), [fwd(5)]).report.actual.actualDistance;
  assert(a === b, `${a} vs ${b}`);
});

test('sand costs extra battery', () => {
  const dry = executeSol(createGame(flat()), [fwd(5)]).report.actual.batteryUsed;
  const wet = executeSol(createGame(flat({ sand: () => 1 })), [fwd(5)]).report.actual.batteryUsed;
  assert(wet > dry * 1.5, `dry ${dry} wet ${wet}`);
});

test('rock in path stops the rover and logs a hazard fault', () => {
  const g = createGame(flat({ rocks: [{ x: 0, z: -17, radius: 0.4 }] }));
  const { game, report } = executeSol(g, [fwd(5), fwd(5)]);
  const r = game.rover;
  assert(report.actual.events.includes('rock_stop'), 'rock_stop event');
  assert(report.actual.haltedAt === 0, `halted at ${report.actual.haltedAt}`);
  assert(r.z + RULES.halfLength <= -17 - 0.4 + 1e-6, `rover front ${r.z + RULES.halfLength} clipped rock`);
  assert(r.hazardFaults === 1 && r.faults[0].code === 'rock', 'fault logged');
  const p = predict(g, [fwd(5)]);
  assert(p.events.includes('rock_stop'), 'prediction also shows the rock');
});

test('steep cliff edge: tip-over loses', () => {
  const t = flat({ height: (_x, z) => (z > -18 ? -(z + 18) * 1.5 : 0) });
  const { game } = executeSol(createGame(t), [fwd(5)]);
  assert(game.rover.status === 'lost' && game.rover.loseReason === 'tipover', `${game.rover.status}/${game.rover.loseReason}`);
});

test('35° slope: auto-stop with tilt fault, no tip', () => {
  const t = flat({ height: (_x, z) => (z > -18 ? (z + 18) * Math.tan((35 * Math.PI) / 180) : 0) });
  const { game, report } = executeSol(createGame(t), [fwd(5), fwd(5)]);
  assert(game.rover.status === 'active', game.rover.status);
  assert(report.actual.events.includes('tilt_stop'), 'tilt_stop');
  assert(report.actual.events.includes('tilt_warning'), 'tilt_warning');
  assert(report.actual.haltedAt === 0, 'halted on first command');
  assert(game.rover.faults.some((f) => f.code === 'tilt'), 'tilt fault');
});

test('scan out of range is a non-hazard fault', () => {
  const { game } = executeSol(createGame(flat()), [{ type: 'scan' }]);
  assert(game.rover.status === 'active', 'still active');
  assert(game.rover.hazardFaults === 0 && game.rover.faults[0].code === 'scan_range', 'scan_range fault');
});

test('win path: drive 30 m over two sols and scan', () => {
  let g = createGame(flat());
  g = executeSol(g, [fwd(5), fwd(5), fwd(5), fwd(5), fwd(5)]).game;
  assert(g.rover.sol === 2 && g.rover.status === 'active', 'sol 2');
  const { game, report } = executeSol(g, [fwd(2), fwd(1), { type: 'scan' }]);
  assert(distToTarget(game.terrain, game.rover.x, game.rover.z) <= RULES.scanRangeM, 'in range');
  assert(game.rover.status === 'won' && report.outcome === 'won', game.rover.status);
  assert(game.rover.sol === 2, 'sol not advanced after win');
});

test('battery recharges between sols, reduced by dust', () => {
  let g = createGame(flat());
  g = executeSol(g, [fwd(5), fwd(5), fwd(5), fwd(5), fwd(5), fwd(5)]).game;
  const r1 = g.reports[0];
  assert(Math.abs(r1.batteryAfterRecharge - r1.batteryAfterDrive - RULES.rechargePerSol) < 1e-6, 'full recharge sol 1');
  g = executeSol(g, [fwd(5), fwd(5), fwd(5), fwd(5), fwd(5)]).game;
  const r2 = g.reports[1];
  const gain = r2.batteryAfterRecharge - r2.batteryAfterDrive;
  assert(gain < RULES.rechargePerSol - 1, `dusty recharge ${gain}`);
});

test('out of battery loses', () => {
  const g = createGame(flat());
  const low: RoverState = { ...g.rover, battery: 3 };
  const { game } = executeSol({ ...g, rover: low }, [fwd(5)]);
  assert(game.rover.status === 'lost' && game.rover.loseReason === 'battery', `${game.rover.loseReason}`);
});

test('out of sols loses', () => {
  let g = createGame(flat());
  for (let i = 0; i < RULES.maxSols; i++) g = executeSol(g, [{ type: 'turn', deg: 15 }]).game;
  assert(g.rover.status === 'lost' && g.rover.loseReason === 'sols', `${g.rover.status}/${g.rover.loseReason}`);
  assert(g.reports.length === RULES.maxSols, 'eight sols');
});

test('three sols ending in sand with <20% progress: stuck', () => {
  let g = createGame(flat({ sand: () => 1 }));
  g = { ...g, rover: { ...g.rover, sinkage: RULES.sinkageMax } };
  for (let i = 0; i < 3; i++) g = executeSol(g, [fwd(2)]).game;
  assert(g.rover.status === 'lost' && g.rover.loseReason === 'sand', `${g.rover.status}/${g.rover.loseReason}`);
});

test('max 6 commands per sol', () => {
  const q = Array.from({ length: 9 }, () => fwd(1));
  const { report } = executeSol(createGame(flat()), q);
  assert(report.queue.length === RULES.maxCommands, `${report.queue.length}`);
});

test('scoring and stars', () => {
  const base = createGame(flat()).rover;
  const won = (o: Partial<RoverState>): RoverState => ({ ...base, status: 'won', ...o });
  const a = score(won({ sol: 3, battery: 60, hazardFaults: 1 }));
  assert(a.points === 1000 + 80 * 5 + 5 * 60 - 50, `points ${a.points}`);
  assert(a.stars === 3, `stars ${a.stars}`);
  assert(score(won({ sol: 6, battery: 20, hazardFaults: 0 })).stars === 2, '2 stars'); // 1260
  assert(score(won({ sol: 8, battery: 5, hazardFaults: 2 })).stars === 1, '1 star'); // 925
  assert(score({ ...base, status: 'lost' }).stars === 0, 'no stars on loss');
  assert(SCORING.threeStars === 1500, 'thresholds');
});

test('level: deterministic, target 70–90 m, behind a hazard, clear start pad', () => {
  const a = generateLevel();
  const b = generateLevel();
  assert(a.heights.every((h, i) => h === b.heights[i]) && a.rocks.length === b.rocks.length, 'deterministic');
  assert(a.rocks.length >= 200 && a.rocks.length <= 250, `rocks ${a.rocks.length}`);
  const d = Math.hypot(a.target.x - a.start.x, a.target.z - a.start.z);
  assert(d >= 70 && d <= 90, `target distance ${d.toFixed(1)}`);
  let hazard = false;
  for (let s = 0; s <= 1; s += 0.01) {
    const x = a.start.x + (a.target.x - a.start.x) * s;
    const z = a.start.z + (a.target.z - a.start.z) * s;
    if (sandAt(a, x, z) > 0.5 || (a.crater && Math.hypot(x - a.crater.x, z - a.crater.z) < a.crater.radius)) hazard = true;
  }
  assert(hazard, 'straight line crosses a hazard');
  const g = createGame(a);
  const p = predict(g, []);
  assert(p.path[0].tilt < 5, `start tilt ${p.path[0].tilt.toFixed(1)}`);
  assert(Number.isFinite(heightAt(a, 0, 0)), 'height finite');
});

test('level: crater lip can tip the rover', () => {
  const t = generateLevel();
  const c = t.crater!;
  // Start 13 m out from the crater centre, facing it.
  let g = createGame(t);
  g = { ...g, terrain: { ...t, rocks: [] }, rover: { ...g.rover, x: c.x - 13, z: c.z, heading: Math.PI / 2 } };
  const { game } = executeSol(g, [fwd(5), fwd(5)]);
  assert(game.rover.status === 'lost' || game.rover.faults.some((f) => f.code === 'tilt'), `crater is harmless: ${game.rover.status}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(`${failed} test(s) failed`);
