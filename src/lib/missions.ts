import raw from '../data/missions.json';
import type { ComicPanel, ComicPanelLine, MissionData } from '../data/types';

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

/**
 * Pure helper that returns `panel.lines` if present, otherwise derives lines[]
 * from the existing caption/dialogue/speaker fields with stable ids (`${panelId}-c1`, `${panelId}-s1`).
 */
export function getPanelLines(panel: ComicPanel, panelId = `p${panel.panelNumber}`): ComicPanelLine[] {
  if (panel.lines && panel.lines.length > 0) return panel.lines;
  const derived: ComicPanelLine[] = [];
  if (panel.caption) {
    derived.push({
      id: `${panelId}-c1`,
      kind: 'caption',
      text: panel.caption,
    });
  }
  if (panel.dialogue) {
    derived.push({
      id: `${panelId}-s1`,
      kind: 'speech',
      speaker: panel.speaker,
      text: panel.dialogue,
    });
  }
  return derived;
}

