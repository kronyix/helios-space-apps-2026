export interface SpeakLine {
  missionId: string;
  panelId: string;
  id: string;
  text: string;
  voice?: string;
  speaker?: string;
  kind?: 'caption' | 'speech';
}

export interface SpeakOptions {
  rate: number;
  reduced?: boolean;
}

export type ProviderId = 'file';

export interface VoiceProvider {
  readonly id: ProviderId;
  isAvailable(lang: string): boolean;
  canSpeak(line: SpeakLine, lang: string): boolean;
  speak(line: SpeakLine, lang: string, opts: SpeakOptions): Promise<void>;
  stop(): void;
  preload?(items: { line: SpeakLine; lang: string }[]): void;
}

export class CannotSpeak extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CannotSpeak';
  }
}
