import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { missions } from '../lib/missions';

/** The four blueprint states, plus the Badges view. */
export type Stage = 'archive' | 'story' | 'hardware' | 'reward' | 'badges';
export type StoryMode = 'illustrated' | 'archival';
export type GamePhase = 'closed' | 'intro' | 'active' | 'success' | 'failure';

export interface GameResult {
  best: number;
  passed: boolean;
  attempts: number;
}

interface Progress {
  issuesOpened: string[];
  hotspotsSeen: Record<string, string[]>;
  gameResults: Record<string, GameResult>;
  artifacts: string[];
  transmissionsRead: string[];
}

interface AppState extends Progress {
  stage: Stage;
  missionId: string | null;
  storyMode: StoryMode;
  /** Comic book reader: `page` is the first visible page (0 = cover); layout-independent. */
  narrative: { page: number; turning: boolean };
  activeHotspot: string | null;
  gamePhase: GamePhase;
  lastScore: number | null;
  soundOn: boolean;
  /** Globe focus while on the archive (does not change stage). */
  focusedMissionId: string | null;
  /** Mission whose beacon the camera is currently diving into. */
  divingTo: string | null;

  go: (stage: Stage, missionId?: string | null) => void;
  openMission: (missionId: string) => void;
  setStoryMode: (m: StoryMode) => void;
  setNarrative: (n: Partial<{ page: number; turning: boolean }>) => void;
  setHotspot: (id: string | null) => void;
  setGamePhase: (p: GamePhase) => void;
  recordGame: (missionId: string, score: number, passed: boolean) => void;
  markTransmission: (missionId: string) => void;
  setSound: (on: boolean) => void;
  setFocused: (id: string | null) => void;
  setDiving: (id: string | null) => void;
  resetProgress: () => void;
}

/**
 * Deep links: ?stage=hardware&mission=apollo11&hotspot=lrrr&game=intro&mode=archival
 * Read once at startup (sharing a chapter, review captures). Invalid values are ignored.
 */
function initialFromUrl(): Partial<Pick<AppState, 'stage' | 'missionId' | 'activeHotspot' | 'gamePhase' | 'storyMode' | 'narrative'>> {
  try {
    const q = new URLSearchParams(window.location.search);
    const out: Partial<Pick<AppState, 'stage' | 'missionId' | 'activeHotspot' | 'gamePhase' | 'storyMode' | 'narrative'>> = {};
    const stage = q.get('stage') as Stage | null;
    if (stage && ['archive', 'story', 'hardware', 'reward', 'badges'].includes(stage)) out.stage = stage;
    const m = missions.find((x) => x.id === q.get('mission'));
    if (m) out.missionId = m.id;
    if (out.stage && ['story', 'hardware', 'reward'].includes(out.stage) && !out.missionId) out.missionId = missions[0].id;
    const mm = missions.find((x) => x.id === out.missionId);
    if (out.stage === 'hardware' && mm) {
      const h = q.get('hotspot');
      if (h && mm.hotspots.some((x) => x.id === h)) out.activeHotspot = h;
      if (q.get('game') === 'intro') out.gamePhase = 'intro';
    }
    const issue = Number(q.get('issue'));
    const im = missions.find((x) => x.issueNumber === issue);
    if (im) {
      out.missionId = im.id;
      if (!out.stage || out.stage === 'archive') out.stage = 'story';
      const page = Number(q.get('page'));
      if (page >= 1) out.narrative = { page: page - 1, turning: false };
    }
    const mode = q.get('mode');
    if (mode === 'archival' || mode === 'illustrated') out.storyMode = mode;
    return out;
  } catch {
    return {};
  }
}
const fromUrl = typeof window !== 'undefined' ? initialFromUrl() : {};

const emptyProgress: Progress = {
  issuesOpened: [],
  hotspotsSeen: {},
  gameResults: {},
  artifacts: [],
  transmissionsRead: [],
};

/** localStorage can throw (private mode, blocked storage); fall back to memory. */
const safeStorage = createJSONStorage(() => {
  try {
    const k = '__helios_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyProgress,
      stage: 'archive',
      missionId: null,
      storyMode: 'illustrated',
      activeHotspot: null,
      gamePhase: 'closed',
      lastScore: null,
      soundOn: false,
      focusedMissionId: null,
      divingTo: null,
      narrative: { page: 0, turning: false },
      ...fromUrl,

      go: (stage, missionId) => {
        const id = missionId === undefined ? get().missionId : missionId;
        const needsMission = stage === 'story' || stage === 'hardware' || stage === 'reward';
        const resolved = needsMission ? (id ?? missions[0].id) : id;
        set((s) => ({
          stage,
          missionId: resolved,
          activeHotspot: null,
          gamePhase: 'closed',
          divingTo: null,
          narrative: resolved !== s.missionId ? { page: 0, turning: false } : { ...s.narrative, turning: false },
          issuesOpened:
            needsMission && resolved && !s.issuesOpened.includes(resolved) ? [...s.issuesOpened, resolved] : s.issuesOpened,
        }));
      },

      openMission: (missionId) => get().go('story', missionId),

      setStoryMode: (storyMode) => set({ storyMode }),
      setNarrative: (n) => set((s) => ({ narrative: { ...s.narrative, ...n } })),

      setHotspot: (id) =>
        set((s) => {
          if (!id || !s.missionId) return { activeHotspot: id };
          const seen = s.hotspotsSeen[s.missionId] ?? [];
          return {
            activeHotspot: id,
            hotspotsSeen: seen.includes(id) ? s.hotspotsSeen : { ...s.hotspotsSeen, [s.missionId]: [...seen, id] },
          };
        }),

      setGamePhase: (gamePhase) => set({ gamePhase }),

      recordGame: (missionId, score, passed) =>
        set((s) => {
          const prev = s.gameResults[missionId];
          return {
            lastScore: score,
            gamePhase: passed ? 'success' : 'failure',
            gameResults: {
              ...s.gameResults,
              [missionId]: {
                best: Math.max(prev?.best ?? 0, score),
                passed: (prev?.passed ?? false) || passed,
                attempts: (prev?.attempts ?? 0) + 1,
              },
            },
            artifacts: passed && !s.artifacts.includes(missionId) ? [...s.artifacts, missionId] : s.artifacts,
          };
        }),

      markTransmission: (missionId) =>
        set((s) =>
          s.transmissionsRead.includes(missionId) ? s : { transmissionsRead: [...s.transmissionsRead, missionId] },
        ),

      setSound: (soundOn) => set({ soundOn }),
      setFocused: (focusedMissionId) => set({ focusedMissionId }),
      setDiving: (divingTo) => set({ divingTo }),
      resetProgress: () => set({ ...emptyProgress }),
    }),
    {
      name: 'helios-progress-v1',
      storage: safeStorage,
      merge: (persisted, current) => ({ ...current, ...(persisted as object), ...(fromUrl.storyMode ? { storyMode: fromUrl.storyMode } : {}) }),
      partialize: (s) => ({
        issuesOpened: s.issuesOpened,
        hotspotsSeen: s.hotspotsSeen,
        gameResults: s.gameResults,
        artifacts: s.artifacts,
        transmissionsRead: s.transmissionsRead,
        storyMode: s.storyMode,
      }),
    },
  ),
);

/** Badge definitions are derived from missions.json plus global milestones. */
export interface Badge {
  id: string;
  name: string;
  criteria: string;
  earned: boolean;
}

export function selectBadges(s: Pick<AppState, keyof Progress>): Badge[] {
  const totalHotspots = missions.reduce((n, m) => n + m.hotspots.length, 0);
  const seenHotspots = Object.values(s.hotspotsSeen).reduce((n, a) => n + a.length, 0);
  return [
    { id: 'first-contact', name: 'First Contact', criteria: 'Open any issue.', earned: s.issuesOpened.length > 0 },
    ...missions.map((m) => ({
      id: m.artifact.badgeId,
      name: m.artifact.badgeName,
      criteria: m.artifact.badgeCriteria,
      earned: (s.gameResults[m.id]?.best ?? 0) >= (m.miniGame.badgeThreshold ?? 80),
    })),
    {
      id: 'inspector',
      name: 'Hardware Inspector',
      criteria: `Inspect all ${totalHotspots} hotspots across the three issues.`,
      earned: seenHotspots >= totalHotspots,
    },
    {
      id: 'archivist',
      name: 'Archivist',
      criteria: 'Recover all three artifacts.',
      earned: missions.every((m) => s.artifacts.includes(m.id)),
    },
  ];
}
