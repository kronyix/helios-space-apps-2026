/**
 * Golden engine verification script for Signal Delay (Phase 1).
 * Exercises createGame, predict, executeSol, and score across deterministic
 * scenarios to guarantee zero engine drift before and after DOM/UX changes.
 */
import assert from 'node:assert/strict';
import { createGame, executeSol, predict, RULES, score } from '../src/games/roverDrive/engine';
import { sandAt } from '../src/games/roverDrive/terrain';
import type { Command, RoverState } from '../src/games/roverDrive/types';

function runScenario(name: string, queue: Command[], mutate?: (r: RoverState, t: ReturnType<typeof createGame>['terrain']) => void) {
  const g = createGame();
  if (mutate) mutate(g.rover, g.terrain);
  const pred = predict(g, queue);
  const { game: next, report } = executeSol(g, queue);
  return {
    name,
    predDist: Number(pred.actualDistance.toFixed(4)),
    actualDist: Number(report.actual.actualDistance.toFixed(4)),
    slip: Number(report.slip.toFixed(4)),
    battBefore: Number(report.batteryBefore.toFixed(4)),
    battAfterDrive: Number(report.batteryAfterDrive.toFixed(4)),
    battAfterRecharge: Number(report.batteryAfterRecharge.toFixed(4)),
    events: report.actual.events,
    outcome: report.outcome,
    loseReason: report.loseReason ?? null,
    x: Number(next.rover.x.toFixed(4)),
    z: Number(next.rover.z.toFixed(4)),
    dust: Number(next.rover.dust.toFixed(4)),
    sinkage: Number(next.rover.sinkage.toFixed(4)),
    faults: next.rover.hazardFaults,
  };
}

const flat = runScenario('sol1-flat', [
  { type: 'forward', m: 2 },
  { type: 'turn', deg: 15 },
  { type: 'forward', m: 2 },
]);
assert.equal(flat.outcome, 'active');
assert.ok(flat.actualDist > 0);
assert.equal(flat.dust, RULES.dustPerSol);

// Find a sand cell to test soft-sand slip & sinkage
const base = createGame();
let sandSpot: { x: number; z: number } | null = null;
for (let z = -30; z <= 30 && !sandSpot; z += 1) {
  for (let x = -30; x <= 30; x += 1) {
    if (sandAt(base.terrain, x, z) > 0.7) {
      sandSpot = { x, z };
      break;
    }
  }
}
assert.ok(sandSpot, 'expected soft sand patch in level');
const sandRun = runScenario(
  'soft-sand',
  [{ type: 'forward', m: 5 }],
  (r) => {
    r.x = sandSpot!.x;
    r.z = sandSpot!.z;
  },
);
assert.ok(sandRun.slip > 0, 'soft sand should produce slip');
assert.ok(sandRun.actualDist < 5, 'soft sand reduces distance');

// Rock collision test
const rockRun = runScenario(
  'rock-stop',
  [{ type: 'forward', m: 5 }],
  (r, t) => {
    const rock = t.rocks[0];
    r.x = rock.x;
    r.z = rock.z - 2.0;
    r.heading = 0;
  },
);
assert.ok(rockRun.events.includes('rock_stop'), 'expected rock_stop');
assert.ok(rockRun.faults >= 1);

// Tilt tip-over on crater
const tipRun = runScenario(
  'crater-tipover',
  [{ type: 'forward', m: 5 }, { type: 'forward', m: 5 }],
  (r, t) => {
    const c = t.crater!;
    r.x = c.x - 12.5;
    r.z = c.z;
    r.heading = Math.PI / 2;
    t.rocks.length = 0;
  },
);
assert.equal(tipRun.outcome, 'lost');
assert.equal(tipRun.loseReason, 'tipover');

// Scan out of range vs win + score
const scanMiss = runScenario('scan-miss', [{ type: 'scan' }]);
assert.ok(scanMiss.events.includes('scan_range'));
assert.equal(scanMiss.outcome, 'active');

const winGame = createGame();
winGame.rover.x = winGame.terrain.target.x - 1;
winGame.rover.z = winGame.terrain.target.z - 1;
const won = executeSol(winGame, [{ type: 'scan' }]);
assert.equal(won.report.outcome, 'won');
const winScore = score(won.game.rover);
assert.equal(winScore.stars, 3);
assert.ok(winScore.points > 1500);

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      scenarios: [flat, sandRun, rockRun, tipRun, scanMiss, { name: 'win', ...winScore }],
    },
    null,
    2,
  ),
);
