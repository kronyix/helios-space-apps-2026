/**
 * Types for the master data contract in src/data/missions.json.
 * Blueprint fields (Technical Blueprint §6) must never be renamed or removed.
 * Fields marked `ext` are additive extensions used by this build.
 */

export type CelestialBody = 'mars' | 'moon';
export type MiniGameType = 'spectrometer_scan' | 'laser_bounce' | 'rpm_throttle';
export type Vec3 = [number, number, number];
export type StoryBeat =
  | 'hook'
  | 'stakes'
  | 'turning_point'
  | 'cost'
  | 'legacy'
  | 'setup'
  | 'struggle'
  | 'hardware'
  | 'discovery';

export interface ComicPanelLine {
  id: string;
  kind: 'caption' | 'speech';
  speaker?: string;
  text: string;
}

/** ext: one narrated line. Text resolves from `textKey` (locale file, then English source). */
export interface NarrationLine {
  id: string;
  /** Dotted path, e.g. "opportunity.comicPanels.1.caption". */
  textKey: string;
  /** Overrides the block speaker (e.g. "narrator" for the caption box). */
  speaker?: string;
}

/** ext: narration for a panel. `speaker` is "narrator" or a character id. */
export interface Narration {
  speaker: string;
  lines: NarrationLine[];
  /** Optional explicit audio per language; otherwise public/audio/manifest.json is used. */
  audio?: Record<string, string>;
}

export interface Coordinates {
  lat: number;
  lng: number;
  locationName: string;
}

export interface Telemetry {
  launchDate: string;
  landingDate: string;
  lastContact: string;
  plannedLifespan: string;
  actualLifespan: string;
  massKg: number;
  /** ext: what the mass figure refers to */
  massNote?: string;
  /** ext: UI label for `lastContact` when "last contact" is not literal */
  lastContactLabel?: string;
}

export interface HotspotData {
  id: string;
  position: Vec3;
  label: string;
  engineeringFact: string;
  scienceDiscovery: string;
  /** ext: short label for chips */
  shortLabel?: string;
  /** ext: instrument / part designation shown in mono */
  designation?: string;
  /** ext: camera position used to frame this part */
  cameraPosition?: Vec3;
  /** ext: attribution note (e.g. "This is Spirit's story") */
  attribution?: string;
}

export interface ComicPanel {
  panelNumber: number;
  comicImage: string;
  realNasaImage: string;
  nasaImageCaption: string;
  dialogue: string;
  speaker: string;
  /** ext */
  beat?: StoryBeat;
  /** ext: structured caption and speech lines */
  lines?: ComicPanelLine[];
  /** ext: voice narration (text keys into src/data/locales) */
  narration?: Narration;
  // Phase 2/4
  reveal?: Record<string, unknown>;
  // Phase 2/4
  camera?: Record<string, unknown>;
  // Phase 2/4
  evidence?: Record<string, unknown>;
  /** ext: narrator caption box (historical fact) */
  caption?: string;
  /** ext: image credit line */
  nasaImageCredit?: string;
  /** ext: link to the source record */
  nasaImageSource?: string;
  /** ext: date of the archival image */
  nasaImageDate?: string;
  /** ext: direct link to the full-resolution file */
  nasaImageFile?: string;
  /** ext: alt text for the illustration */
  comicAlt?: string;
  /** ext: what `comicImage` is. The UI labels it ILLUSTRATION (archival mode labels the NASA photo). */
  imageKind?: 'illustration' | 'archival';
  /** ext: CSS object-position for the illustration crop (e.g. "30% 50%") */
  comicFocus?: string;
}

export interface MiniGame {
  type: MiniGameType;
  targetValue: string;
  /** ext */
  title?: string;
  tagline?: string;
  instructions?: string[];
  controls?: string;
  science?: string;
  durationSec?: number;
  successThreshold?: number;
  badgeThreshold?: number;
  params?: Record<string, number>;
}

export interface Artifact {
  name: string;
  designation: string;
  description: string;
  badgeId: string;
  badgeName: string;
  badgeCriteria: string;
}

export interface Source {
  label: string;
  url: string;
}

/** ext: how the hardware diorama frames the model. */
export interface SceneConfig {
  environment: CelestialBody;
  /** Largest horizontal extent of the model after normalization (scene units). */
  fitSize: number;
  rotationY: number;
  camera: Vec3;
  target: Vec3;
  /** Hide model parts whose centre sits above this height (e.g. Apollo's ascent stage, which left). */
  hideAboveY?: number;
}

/** ext: side-by-side official catalog (e.g. NSSDC Spirit / Opportunity images). */
export interface FieldArchiveItem {
  image: string;
  file: string;
  when: string;
  caption: string;
}
export interface FieldArchive {
  title: string;
  note: string;
  rovers: { rover: string; name: string; designation: string; site: string; catalog: string; items: FieldArchiveItem[] }[];
}

/** ext: optional, clearly labelled speculative image (e.g. "Imagined future") paired with a real fact. */
export interface Epilogue {
  label: string;
  image: string;
  alt: string;
  caption: string;
  source: Source;
}

export interface MissionData {
  id: string;
  issueNumber: number;
  title: string;
  hardwareName: string;
  celestialBody: CelestialBody;
  coordinates: Coordinates;
  modelPath: string;
  /** ext */
  scene: SceneConfig;
  telemetry: Telemetry;
  hotspots: HotspotData[];
  comicPanels: ComicPanel[];
  /** ext: optional long-form story chapter. When present, the story book reads these instead of the State II panels. */
  longPanels?: ComicPanel[];
  miniGame: MiniGame;
  /** ext: optional full-screen game launched from the hardware screen (e.g. Signal Delay). */
  extraGame?: ExtraGame;
  /** ext */
  issueTitle: string;
  shortName: string;
  theme: 'rust' | 'silver' | 'jezero';
  logline: string;
  fictionNotice?: string;
  artifact: Artifact;
  sources: Source[];
  fieldArchive?: FieldArchive;
  epilogue?: Epilogue;
}

/** ext: full-screen game copy. Numbers in `rules` are gameplay tuning, labelled as such in the UI. */
export interface ExtraGame {
  id: 'rover_drive';
  route: string;
  title: string;
  kicker: string;
  tagline: string;
  ctaLabel: string;
  briefing: string[];
  rulesTitle: string;
  rulesNote: string;
  rules: string[];
  uplinkNote: string;
  timeNote: string;
  events: Record<'clean' | 'slip' | 'rock_stop' | 'turn_blocked' | 'tilt_stop' | 'tilt_warning' | 'edge_stop' | 'scan_range' | 'scan_ok', string>;
  outcomes: Record<'won' | 'sand' | 'battery' | 'tipover' | 'sols', string>;
  badge: { id: string; name: string; criteria: string };
}
