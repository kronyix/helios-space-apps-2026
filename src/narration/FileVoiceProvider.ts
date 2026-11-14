import { CannotSpeak, audioKey, type SpeakLine, type SpeakOptions, type VoiceProvider } from './VoiceProvider';

/** Written by scripts/generate-narration.ts. */
export interface AudioManifest {
  version: number;
  provider: string;
  lines: Record<string, { src: string; hash: string }>;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Plays pre-generated MP3s listed in /audio/manifest.json. */
export class FileVoiceProvider implements VoiceProvider {
  private manifest: AudioManifest | null = null;
  private langs = new Set<string>();
  private audio: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null;
  /** Preloaded elements for the current and next panel only. */
  private cache = new Map<string, HTMLAudioElement>();
  readonly ready: Promise<void>;

  constructor(onChange: () => void) {
    this.ready = fetch(`${BASE}/audio/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : null))
      .catch(() => null)
      .then((m) => {
        this.manifest = m;
        for (const k of Object.keys(m?.lines ?? {})) this.langs.add(k.split('/')[0]);
        onChange();
      });
  }

  get providerName() {
    return this.manifest?.provider ?? '';
  }

  has(line: SpeakLine, lang: string) {
    return Boolean(this.manifest?.lines[audioKey(line, lang)]);
  }

  private src(line: SpeakLine, lang: string) {
    const e = this.manifest?.lines[audioKey(line, lang)];
    return e ? `${BASE}${e.src}?v=${e.hash.slice(0, 8)}` : null;
  }

  isAvailable(lang: string) {
    return this.langs.has(lang);
  }

  /** Keeps audio for these lines only (current + next panel); drops everything else. */
  preload(items: { line: SpeakLine; lang: string }[]) {
    const keep = new Map<string, HTMLAudioElement>();
    for (const { line, lang } of items) {
      const src = this.src(line, lang);
      if (!src) continue;
      const el = this.cache.get(src) ?? new Audio();
      if (!el.src) {
        el.preload = 'auto';
        el.src = src;
      }
      keep.set(src, el);
    }
    for (const [src, el] of this.cache) if (!keep.has(src) && el !== this.audio) el.removeAttribute('src');
    this.cache = keep;
  }

  speak(line: SpeakLine, lang: string, opts?: SpeakOptions): Promise<void> {
    this.stop();
    const src = this.src(line, lang);
    if (!src) return Promise.reject(new CannotSpeak('no audio file'));
    const el = this.cache.get(src) ?? new Audio(src);
    this.audio = el;
    el.currentTime = 0;
    el.playbackRate = opts?.rate ?? 1;
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        el.onended = el.onerror = null;
        if (this.audio === el) this.audio = null;
        this.finish = null;
      };
      this.finish = () => {
        cleanup();
        resolve();
      };
      el.onended = () => this.finish?.();
      el.onerror = () => {
        cleanup();
        reject(new CannotSpeak('audio file failed to load'));
      };
      el.play().catch((err: unknown) => {
        cleanup();
        // AbortError = stopped before it started; anything else = can't play this file.
        if (err instanceof DOMException && err.name === 'AbortError') resolve();
        else reject(new CannotSpeak(String(err)));
      });
    });
  }

  stop() {
    const el = this.audio;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    this.finish?.();
  }
}
