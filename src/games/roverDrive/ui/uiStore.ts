/**
 * UI-only state, presentation playhead helpers, and pure view helpers for Signal Delay.
 * Simulation state stays strictly in src/games/roverDrive/store.ts.
 */
import { create } from 'zustand';
import { isCoarsePointer, isSmallScreen } from '../../../lib/device';
import { RULES } from '../engine';
import type { Command, SimEvent, SolReport } from '../types';

export type HowToTab = 'rules' | 'keys';
export type ToastKind = 'tilt' | 'sand' | 'rock' | 'battery' | 'dust';
export type ToastTone = 'warn' | 'bad' | 'info';
export type QualityTier = 'high' | 'medium' | 'low';
export type CaptionKey = 'intro' | 'firstUplink' | 'firstSandSlip' | 'rockStop' | 'lowBattery' | 'win' | 'lose';

export interface TierSpec {
  dpr: number;
  shadowSize: number;
  rocks: number;
  pebbles: number;
  dust: number;
  motes: number;
  detailTex: boolean;
  trackQuads: number;
}

export const TIER_SPECS: Record<QualityTier, TierSpec> = {
  high: {
    dpr: 2,
    shadowSize: 2048,
    rocks: 250,
    pebbles: 600,
    dust: 200,
    motes: 140,
    detailTex: true,
    trackQuads: 600,
  },
  medium: {
    dpr: 1.5,
    shadowSize: 1024,
    rocks: 200,
    pebbles: 300,
    dust: 120,
    motes: 80,
    detailTex: true,
    trackQuads: 400,
  },
  low: {
    dpr: 1,
    shadowSize: 0,
    rocks: 120,
    pebbles: 0,
    dust: 60,
    motes: 0,
    detailTex: false,
    trackQuads: 180,
  },
};

export interface OutcropCue {
  visible: boolean;
  xPct: number;
  yPct: number;
  angleDeg: number;
  distM: number;
}

export interface PerfStats {
  fps: number;
  calls: number;
  triangles: number;
}

// ---------------------------------------------------------------------------
// Presentation Playhead (wraps store.tick without editing store.ts)

const execPlayhead = {
  clockStart: -1,
  virtualMs: 0,
  skip: false,
  slowMoUntilRealMs: 0,
};

export function resetExecPlayhead() {
  execPlayhead.clockStart = -1;
  execPlayhead.virtualMs = 0;
  execPlayhead.skip = false;
  execPlayhead.slowMoUntilRealMs = 0;
}

export function requestSkipExec() {
  execPlayhead.skip = true;
}

export function consumeSkipExec(): boolean {
  const s = execPlayhead.skip;
  execPlayhead.skip = false;
  return s;
}

export function triggerTipoverSlowMo(realNow = performance.now()) {
  execPlayhead.slowMoUntilRealMs = realNow + 1500;
}

export function advanceExecClock(clockStart: number, realDtMs: number, realNow: number, speed: 1 | 2): number {
  if (execPlayhead.clockStart !== clockStart) {
    execPlayhead.clockStart = clockStart;
    execPlayhead.virtualMs = 0;
    execPlayhead.slowMoUntilRealMs = 0;
  }
  const slow = realNow < execPlayhead.slowMoUntilRealMs ? 0.4 : 1;
  const dt = Math.min(80, Math.max(0, realDtMs));
  execPlayhead.virtualMs += dt * speed * slow;
  return clockStart + execPlayhead.virtualMs;
}

/** Normalized clock progress (0..1) respecting virtual 1x/2x/slow-mo playback during executing. */
export function getExecProgress(
  s: { phase: string; clock: { start: number; dur: number } | null; pausedAt: number | null },
  t = performance.now(),
): number {
  if (!s.clock) return 0;
  if (s.phase === 'executing' && execPlayhead.clockStart === s.clock.start) {
    return Math.min(1, Math.max(0, execPlayhead.virtualMs / 1000 / s.clock.dur));
  }
  const ref = s.pausedAt ?? t;
  return Math.min(1, Math.max(0, (ref - s.clock.start) / 1000 / s.clock.dur));
}

// ---------------------------------------------------------------------------
// Interactive Plan camera orbit & zoom offsets (Plan default matches Phase 2)

export const DEFAULT_PLAN_PITCH = Math.atan2(1, 0.7); // ~55 deg elevation
export const MIN_PLAN_PITCH = (25 * Math.PI) / 180;
export const MAX_PLAN_PITCH = (70 * Math.PI) / 180;
export const MAX_PLAN_YAW = (60 * Math.PI) / 180;

export const planOrbit = {
  yaw: 0,
  pitch: DEFAULT_PLAN_PITCH,
  zoom: 1,
};

export function resetPlanOrbit() {
  planOrbit.yaw = 0;
  planOrbit.pitch = DEFAULT_PLAN_PITCH;
  planOrbit.zoom = 1;
}

export function isPlanOrbitDefault(): boolean {
  return (
    Math.abs(planOrbit.yaw) < 0.01 &&
    Math.abs(planOrbit.pitch - DEFAULT_PLAN_PITCH) < 0.01 &&
    Math.abs(planOrbit.zoom - 1) < 0.02
  );
}

export function nudgePlanOrbit(dYaw: number, dPitch: number, zoomMul = 1) {
  planOrbit.yaw = Math.max(-MAX_PLAN_YAW, Math.min(MAX_PLAN_YAW, planOrbit.yaw + dYaw));
  planOrbit.pitch = Math.max(MIN_PLAN_PITCH, Math.min(MAX_PLAN_PITCH, planOrbit.pitch + dPitch));
  planOrbit.zoom = Math.max(0.6, Math.min(1.65, planOrbit.zoom * zoomMul));
  useRoverUiStore.getState().setOrbitModified(!isPlanOrbitDefault());
}

export function detectInitialQualityTier(): { tier: QualityTier; locked: boolean } {
  if (typeof window !== 'undefined') {
    const raw = new URLSearchParams(window.location.search).get('quality')?.toLowerCase();
    if (raw === 'high') return { tier: 'high', locked: true };
    if (raw === 'med' || raw === 'medium') return { tier: 'medium', locked: true };
    if (raw === 'low') return { tier: 'low', locked: true };

    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
    const mobile = isCoarsePointer() || isSmallScreen();
    if (cores <= 2 || mem <= 2) return { tier: 'low', locked: false };
    if (mobile || cores <= 4 || mem <= 4) return { tier: 'medium', locked: false };
  }
  return { tier: 'high', locked: false };
}

const INITIAL_QUALITY = detectInitialQualityTier();

export interface ToastItem {
  id: string;
  kind: ToastKind;
  text: string;
  tone: ToastTone;
}

export type TutorialStep = 0 | 1 | 2 | 3 | 4;

interface RoverUiState {
  howToOpen: boolean;
  howToTab: HowToTab;
  tutorialActive: boolean;
  tutorialStep: TutorialStep;
  toasts: ToastItem[];
  shownToasts: Partial<Record<ToastKind, true>>;
  dockExpanded: boolean;
  detailsOpen: boolean;

  hazardLens: boolean;
  qualityTier: QualityTier;
  qualityLocked: boolean;
  outcropCue: OutcropCue;
  perfStats: PerfStats;

  // Phase 3 presentation state
  execSpeed: 1 | 2;
  solBannerSol: number | null;
  orbitModified: boolean;
  resetOrbitVersion: number;
  lastDownlinkAt: number;
  activeCaption: { key: CaptionKey; text: string } | null;
  shownCaptions: Partial<Record<CaptionKey, true>>;

  openHowTo: (tab?: HowToTab) => void;
  closeHowTo: () => void;
  setHowToTab: (tab: HowToTab) => void;
  startTutorial: () => void;
  setTutorialStep: (step: TutorialStep) => void;
  dismissTutorial: () => void;
  pushToast: (kind: ToastKind, text: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  setDockExpanded: (open: boolean) => void;
  setDetailsOpen: (open: boolean) => void;
  toggleHazardLens: () => void;
  setHazardLens: (on: boolean) => void;
  setQualityTier: (tier: QualityTier) => void;
  downgradeQualityTier: () => void;
  setOutcropCue: (cue: OutcropCue) => void;
  setPerfStats: (stats: PerfStats) => void;

  toggleExecSpeed: () => void;
  setSolBannerSol: (sol: number | null) => void;
  setOrbitModified: (modified: boolean) => void;
  triggerResetOrbit: () => void;
  markDownlinkAt: (ms: number) => void;
  triggerCaption: (key: CaptionKey, text: string) => boolean;
  clearCaption: () => void;
  resetUiSession: (showTutorial: boolean) => void;
}

export const useRoverUiStore = create<RoverUiState>()((set, get) => ({
  howToOpen: false,
  howToTab: 'rules',
  tutorialActive: false,
  tutorialStep: 0,
  toasts: [],
  shownToasts: {},
  dockExpanded: true,
  detailsOpen: false,

  hazardLens: false,
  qualityTier: INITIAL_QUALITY.tier,
  qualityLocked: INITIAL_QUALITY.locked,
  outcropCue: { visible: false, xPct: 50, yPct: 24, angleDeg: 0, distM: 0 },
  perfStats: { fps: 0, calls: 0, triangles: 0 },

  execSpeed: 1,
  solBannerSol: null,
  orbitModified: false,
  resetOrbitVersion: 0,
  lastDownlinkAt: 0,
  activeCaption: null,
  shownCaptions: {},

  openHowTo: (tab = 'rules') => set({ howToOpen: true, howToTab: tab }),
  closeHowTo: () => set({ howToOpen: false }),
  setHowToTab: (howToTab) => set({ howToTab }),
  startTutorial: () => set({ tutorialActive: true, tutorialStep: 0, howToOpen: false, dockExpanded: true }),
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
  dismissTutorial: () => set({ tutorialActive: false }),

  pushToast: (kind, text, tone = 'warn') => {
    const s = get();
    if (s.shownToasts[kind]) return;
    const id = `${kind}-${Date.now()}`;
    set({
      shownToasts: { ...s.shownToasts, [kind]: true },
      toasts: [...s.toasts.slice(-2), { id, kind, text, tone }],
    });
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setDockExpanded: (dockExpanded) => set({ dockExpanded }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  toggleHazardLens: () => set((s) => ({ hazardLens: !s.hazardLens })),
  setHazardLens: (hazardLens) => set({ hazardLens }),
  setQualityTier: (qualityTier) => set({ qualityTier }),
  downgradeQualityTier: () => {
    const { qualityTier, qualityLocked } = get();
    if (qualityLocked) return;
    if (qualityTier === 'high') set({ qualityTier: 'medium' });
    else if (qualityTier === 'medium') set({ qualityTier: 'low' });
  },
  setOutcropCue: (outcropCue) => set({ outcropCue }),
  setPerfStats: (perfStats) => set({ perfStats }),

  toggleExecSpeed: () => set((s) => ({ execSpeed: s.execSpeed === 1 ? 2 : 1 })),
  setSolBannerSol: (solBannerSol) => set({ solBannerSol }),
  setOrbitModified: (orbitModified) => {
    if (get().orbitModified !== orbitModified) set({ orbitModified });
  },
  triggerResetOrbit: () => set((s) => ({ resetOrbitVersion: s.resetOrbitVersion + 1, orbitModified: false })),
  markDownlinkAt: (lastDownlinkAt) => set({ lastDownlinkAt }),
  triggerCaption: (key, text) => {
    const s = get();
    if (s.shownCaptions[key]) return false;
    set({
      shownCaptions: { ...s.shownCaptions, [key]: true },
      activeCaption: { key, text },
    });
    return true;
  },
  clearCaption: () => set({ activeCaption: null }),
  resetUiSession: (showTutorial) => {
    resetExecPlayhead();
    set({
      howToOpen: false,
      howToTab: 'rules',
      tutorialActive: showTutorial,
      tutorialStep: 0,
      toasts: [],
      shownToasts: {},
      dockExpanded: true,
      detailsOpen: false,
      hazardLens: false,
      execSpeed: 1,
      solBannerSol: null,
      orbitModified: false,
      lastDownlinkAt: 0,
      activeCaption: null,
      shownCaptions: {},
      outcropCue: { visible: false, xPct: 50, yPct: 24, angleDeg: 0, distM: 0 },
    });
  },
}));

export function formatCommandLabel(c: Command): string {
  switch (c.type) {
    case 'forward':
      return `Forward ${c.m} m`;
    case 'back':
      return `Back ${c.m} m`;
    case 'turn':
      return `Turn ${c.deg > 0 ? 'left' : 'right'} ${Math.abs(c.deg)}°`;
    case 'scan':
      return 'SCAN';
  }
}

export function formatCommandShort(c: Command): string {
  switch (c.type) {
    case 'forward':
      return `${c.m}m`;
    case 'back':
      return `${c.m}m`;
    case 'turn':
      return `${Math.abs(c.deg)}°`;
    case 'scan':
      return 'SCAN';
  }
}

const REPORT_PRIORITY: (SimEvent | 'clean')[] = [
  'scan_ok',
  'rock_stop',
  'turn_blocked',
  'tilt_stop',
  'edge_stop',
  'scan_range',
  'slip',
  'tilt_warning',
];

/** Single plain-language downlink sentence chosen deterministically from SolReport. */
export function describeSolReport(r: SolReport): string {
  const e = REPORT_PRIORITY.find((k) => r.actual.events.includes(k as SimEvent));
  switch (e) {
    case 'scan_ok':
      return 'SCAN complete: hematite confirmed at the outcrop.';
    case 'rock_stop':
      return 'A rock stopped the drive.';
    case 'turn_blocked':
      return 'A rock blocked the turn. Back up before turning.';
    case 'tilt_stop':
      return 'Steep slope: the rover braked.';
    case 'edge_stop':
      return 'The rover stopped at the mapped area boundary.';
    case 'scan_range':
      return `SCAN failed: outcrop is more than ${RULES.scanRangeM} m away.`;
    case 'slip':
      return `Soft sand ate about ${Math.max(1, Math.round(r.slip * 100))}% of your distance.`;
    case 'tilt_warning':
      return `The rover leaned past ${RULES.tiltWarnDeg}° on this drive.`;
    default:
      return 'Drive completed cleanly as planned.';
  }
}

export function countReportHazards(r: SolReport): number {
  const hazardEvents: SimEvent[] = ['rock_stop', 'turn_blocked', 'tilt_stop', 'edge_stop', 'tipover'];
  return r.actual.events.filter((e) => hazardEvents.includes(e)).length;
}
