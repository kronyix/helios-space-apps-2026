import { useSyncExternalStore } from 'react';
import { FileVoiceProvider } from './FileVoiceProvider';
import { WebSpeechProvider } from './WebSpeechProvider';
import { CannotSpeak, type SpeakLine, type SpeakOptions, type VoiceProvider } from './VoiceProvider';

const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Pre-generated audio first; browser speech when a file is missing. */
class Narrator implements VoiceProvider {
  readonly files = new FileVoiceProvider(changed);
  readonly speech = new WebSpeechProvider(changed);
  private active: VoiceProvider | null = null;

  isAvailable(lang: string) {
    return this.files.isAvailable(lang) || this.speech.isAvailable(lang);
  }

  /** Can this exact line be voiced in `lang` (file, or an installed browser voice)? */
  canSpeak(line: SpeakLine, lang: string) {
    return this.files.has(line, lang) || this.speech.isAvailable(lang);
  }

  async speak(line: SpeakLine, lang: string, opts?: SpeakOptions) {
    this.stop();
    if (this.files.has(line, lang)) {
      this.active = this.files;
      try {
        return await this.files.speak(line, lang, opts);
      } catch (e) {
        if (!(e instanceof CannotSpeak)) throw e;
        // File missing or broken: fall through to the browser voice.
      }
    }
    this.active = this.speech;
    return this.speech.speak(line, lang, opts);
  }

  stop() {
    this.active?.stop();
    this.active = null;
  }

  /** Audio for the current and next panel only. */
  preload(items: { line: SpeakLine; lang: string }[]) {
    this.files.preload(items);
  }
}

export const narrator = new Narrator();

/** Re-renders when the manifest or browser voices load. Returns a change counter. */
export function useVoicesVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
}
