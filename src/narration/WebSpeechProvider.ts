import { getLanguage } from '../i18n/languages';
import { CannotSpeak, type SpeakLine, type SpeakOptions, type VoiceProvider } from './VoiceProvider';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

/** Higher is better: exact region, then natural-sounding engines, then the OS default. */
function score(v: SpeechSynthesisVoice, bcp47: string) {
  let s = 0;
  if (v.lang.replace('_', '-').toLowerCase() === bcp47.toLowerCase()) s += 10;
  if (/natural|neural|premium|enhanced|google/i.test(v.name)) s += 5;
  if (v.localService) s += 1;
  if (v.default) s += 1;
  return s;
}

/** Character voices: same engine, slightly different pitch (and a different voice if there are several). */
const PITCH: Record<string, number> = { narrator: 1 };
function pitchFor(voice: string) {
  if (voice in PITCH) return PITCH[voice];
  let h = 0;
  for (const c of voice) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [1.15, 0.9, 1.25, 0.8][Math.abs(h) % 4];
}

/** Browser speechSynthesis fallback. Only speaks a language it actually has a voice for. */
export class WebSpeechProvider implements VoiceProvider {
  private voices: SpeechSynthesisVoice[] = [];
  /** Kept referenced so Chrome doesn't garbage-collect it mid-line (and drop `onend`). */
  private utterance: SpeechSynthesisUtterance | null = null;
  private finish: (() => void) | null = null;

  constructor(onChange: () => void) {
    if (!synth) return;
    const load = () => {
      this.voices = synth.getVoices();
      onChange();
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
  }

  private candidates(lang: string) {
    const bcp47 = getLanguage(lang).bcp47;
    const base = bcp47.split('-')[0].toLowerCase();
    return this.voices
      .filter((v) => v.lang.replace('_', '-').toLowerCase().split('-')[0] === base)
      .sort((a, b) => score(b, bcp47) - score(a, bcp47));
  }

  isAvailable(lang: string) {
    return this.candidates(lang).length > 0;
  }

  speak(line: SpeakLine, lang: string, opts?: SpeakOptions): Promise<void> {
    this.stop();
    const list = this.candidates(lang);
    if (!synth || !list.length) return Promise.reject(new CannotSpeak(`no ${lang} voice installed`));
    // Narrator gets the best voice; characters may get the runner-up when it is equally good.
    const best = list[0];
    const alt = list.find((v) => v !== best && score(v, getLanguage(lang).bcp47) === score(best, getLanguage(lang).bcp47));
    const u = new SpeechSynthesisUtterance(line.text);
    u.voice = line.voice !== 'narrator' && alt ? alt : best;
    u.lang = u.voice.lang;
    u.rate = opts?.rate ?? 1;
    u.pitch = pitchFor(line.voice);
    this.utterance = u;
    return new Promise<void>((resolve, reject) => {
      const done = () => {
        u.onend = u.onerror = null;
        if (this.utterance === u) this.utterance = null;
        this.finish = null;
      };
      this.finish = () => {
        done();
        resolve();
      };
      u.onend = () => this.finish?.();
      u.onerror = (e) => {
        done();
        // "interrupted"/"canceled" come from stop(); treat as a normal end.
        if (e.error === 'interrupted' || e.error === 'canceled') resolve();
        else reject(new CannotSpeak(e.error));
      };
      synth.speak(u);
    });
  }

  stop() {
    this.finish?.();
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
  }
}
