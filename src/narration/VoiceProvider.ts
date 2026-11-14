/** One line to narrate. `text` is already in `lang` (or English when it fell back). */
export interface SpeakLine {
  missionId: string;
  panelId: string;
  /** Comic line id, e.g. "p01-c1". */
  id: string;
  text: string;
  /** "narrator" or a character id. */
  voice: string;
}

export interface SpeakOptions {
  /** Playback speed: 0.75, 1 or 1.25. */
  rate?: number;
}

/**
 * Swappable voice source. `speak` resolves when the line ends or is stopped, and rejects when
 * this provider cannot voice the line (so a fallback provider can try).
 */
export interface VoiceProvider {
  speak(line: SpeakLine, lang: string, opts?: SpeakOptions): Promise<void>;
  stop(): void;
  isAvailable(lang: string): boolean;
}

export class CannotSpeak extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CannotSpeak';
  }
}

/** "<panel>-<line>" file stem: line ids already start with the panel id ("p01-c1"). */
export function audioKey(line: Pick<SpeakLine, 'missionId' | 'panelId' | 'id'>, lang: string) {
  const stem = line.id.startsWith(`${line.panelId}-`) ? line.id : `${line.panelId}-${line.id}`;
  return `${lang}/${line.missionId}/${stem}`;
}
