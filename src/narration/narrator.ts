import { useSyncExternalStore } from 'react';
import { FileVoiceProvider } from './FileVoiceProvider';
import type { SpeakLine, SpeakOptions } from './VoiceProvider';

/**
 * Coordinates comic voice playback using ONLY pre-generated Gemini TTS static files
 * (`FileVoiceProvider`). Browser Web Speech / runtime TTS calls are never made.
 */
class Narrator {
  private version = 0;
  private listeners = new Set<() => void>();
  readonly files: FileVoiceProvider;

  constructor() {
    this.files = new FileVoiceProvider(() => this.bump());
  }

  private bump(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getVersion = (): number => this.version;

  getDurationMs(missionId: string, lineId: string, lang: string): number | undefined {
    return this.files.getDurationMs(missionId, lineId, lang);
  }

  /**
   * Play mode is available for all languages: when pre-rendered clips exist they
   * play; if a clip is missing, Play mode stays silent and paces that line by
   * reading speed.
   */
  isAvailable(lang: string): boolean {
    return this.files.isAvailable(lang) || true;
  }

  canSpeak(line: SpeakLine, lang: string): boolean {
    return this.files.canSpeak(line, lang);
  }

  speak(line: SpeakLine, lang: string, opts: SpeakOptions): Promise<void> {
    return this.files.speak(line, lang, opts);
  }

  stop(): void {
    this.files.stop();
  }

  preload(items: { line: SpeakLine; lang: string }[]): void {
    this.files.preload(items);
  }
}

export const narrator = new Narrator();

/** Re-renders the caller when the audio manifest finishes loading. */
export function useVoicesVersion(): number {
  return useSyncExternalStore(narrator.subscribe, narrator.getVersion, narrator.getVersion);
}
