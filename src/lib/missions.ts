import raw from '../data/missions.json';
import type { MissionData } from '../data/types';

/** Typed, validated view of src/data/missions.json (the single source of truth). */
// JSON arrays widen to number[]; the dev checks below guard the shape.
export const missions: MissionData[] = raw as unknown as MissionData[];

if (import.meta.env.DEV) {
  for (const m of missions) {
    if (m.comicPanels.length !== 5) console.warn(`[missions.json] ${m.id} should have 5 comic panels (blueprint state flow).`);
    if (m.hotspots.length !== 3) console.warn(`[missions.json] ${m.id} should have 3 hotspots.`);
  }
}

export const getMission = (id: string | null | undefined) => missions.find((m) => m.id === id) ?? null;

export const nextMission = (id: string) => {
  const i = missions.findIndex((m) => m.id === id);
  return i >= 0 && i < missions.length - 1 ? missions[i + 1] : null;
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const formatCoord = (lat: number, lng: number) => {
  const ns = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(4)}°${ns} ${lng.toFixed(4)}°E`;
};

/** Panels shown per application state (Technical Blueprint §2). */
export const panelsForStage = (m: MissionData, stage: 'story' | 'hardware' | 'reward') => {
  const map = { story: [1, 2], hardware: [3], reward: [4, 5] } as const;
  return m.comicPanels.filter((p) => (map[stage] as readonly number[]).includes(p.panelNumber));
};
