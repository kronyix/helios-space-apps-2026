/** Signal Delay — rover drive game types. Pure data, no React / Three. */

export type Command =
  | { type: 'forward'; m: 1 | 2 | 5 }
  | { type: 'back'; m: 1 }
  | { type: 'turn'; deg: -45 | -15 | 15 | 45 }
  | { type: 'scan' };

export interface Rock {
  x: number;
  z: number;
  radius: number;
}

export interface Pose {
  x: number;
  z: number;
  /** Radians. Forward vector is (sin h, cos h) in the x/z plane. */
  heading: number;
}

export interface Terrain {
  seed: number;
  /** Side length in metres; world spans [-size/2, size/2] on x and z. */
  size: number;
  /** Grid vertices per side (e.g. 129). */
  res: number;
  heights: Float32Array;
  /** Soft-sand mask 0..1 on the same grid. */
  sand: Float32Array;
  rocks: Rock[];
  start: Pose;
  target: { x: number; z: number; radius: number };
  crater: { x: number; z: number; radius: number } | null;
}

export type FaultCode = 'rock' | 'tilt' | 'edge' | 'turn_blocked' | 'scan_range';

export interface Fault {
  sol: number;
  code: FaultCode;
  x: number;
  z: number;
}

export type LoseReason = 'sand' | 'battery' | 'tipover' | 'sols';

export type GameStatus = 'active' | 'won' | 'lost';

export interface RoverState extends Pose {
  battery: number; // 0..100
  sol: number; // 1-based, current sol being planned
  dust: number; // 0..1, reduces recharge
  sinkage: number; // 0..0.9, grows while driving in soft sand
  sandStreak: number; // consecutive sols ending stuck-ish in sand
  hazardFaults: number;
  faults: Fault[];
  odometer: number;
  status: GameStatus;
  loseReason?: LoseReason;
}

export interface PathPoint {
  x: number;
  z: number;
  y: number;
  heading: number;
  tilt: number; // degrees
  sand: number; // mask 0..1
  /** Which queue command produced this point. */
  cmd: number;
}

export type SimEvent = 'tilt_warning' | 'tilt_stop' | 'rock_stop' | 'edge_stop' | 'turn_blocked' | 'scan_ok' | 'scan_range' | 'tipover' | 'battery_dead' | 'slip';

export interface SimResult {
  path: PathPoint[];
  end: RoverState;
  /** Sum of |commanded| drive distance actually attempted. */
  commandedDistance: number;
  /** Ground distance actually covered. */
  actualDistance: number;
  batteryUsed: number;
  maxTilt: number;
  events: SimEvent[];
  /** Index of the command that halted the sol, if any. */
  haltedAt: number | null;
}

export interface SolReport {
  sol: number;
  queue: Command[];
  predicted: SimResult;
  actual: SimResult;
  /** 0..1 fraction of commanded distance lost to slip. */
  slip: number;
  batteryBefore: number;
  batteryAfterDrive: number;
  batteryAfterRecharge: number;
  endedInSand: boolean;
  outcome: GameStatus;
  loseReason?: LoseReason;
}

export interface GameState {
  terrain: Terrain;
  rover: RoverState;
  reports: SolReport[];
}
