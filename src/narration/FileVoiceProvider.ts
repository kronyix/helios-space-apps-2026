import { setNarrationDucking } from '../lib/audio';
import {
  CannotSpeak,
  type SpeakLine,
  type SpeakOptions,
  type VoiceProvider,
} from './VoiceProvider';

export interface ManifestClipEntry {
  file: string;
  speaker?: string;
  voice?: string;
  durationMs?: number;
  bytes: number;
  hash?: string;
}

export interface NarrationManifest {
  version: number;
  model?: string;
  provider?: string;
  generatedAt?: string;
  languages?: string[];
  clips?: Record<string, ManifestClipEntry>;
  lines?: Record<string, { file: string; bytes: number; durationMs?: number }>;
}

const warnedMissing = new Set<string>();
function warnOnceDev(key: string, msg: string): void {
  if (!import.meta.env.DEV) return;
  if (warnedMissing.has(key)) return;
  warnedMissing.add(key);
  console.warn(msg);
}

/**
 * Plays pre-generated Gemini TTS MP3 files listed in `/audio/manifest.json`.
 *
 * FileVoiceProvider is the ONLY narration provider at runtime. Visitors never
 * trigger browser TTS or external API calls. If a clip is missing or fails to
 * load, `speak` rejects with `CannotSpeak` so the caller stays silent and falls
 * back to reading-speed line timing.
 */
export class FileVoiceProvider implements VoiceProvider {
  readonly id = 'file' as const;
  private manifest: NarrationManifest | null = null;
  private loading = false;
  private audio: HTMLAudioElement | null = null;
  private settle: (() => void) | null = null;
  private preloaded = new Map<string, HTMLAudioElement>();
  private onChange: () => void;

  constructor(onChange: () => void) {
    this.onChange = onChange;
    if (typeof window !== 'undefined') {
      this.loadManifest();
    }
  }

  private loadManifest(): void {
    if (this.loading || this.manifest) return;
    this.loading = true;
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
    fetch(`${base}/audio/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<NarrationManifest>) : null))
      .catch(() => null)
      .then((m) => {
        this.manifest = m ?? { version: 2, clips: {} };
        this.onChange();
      });
  }

  get providerName(): string | null {
    if (!this.manifest) return null;
    if (this.manifest.model) return `Google Gemini TTS (${this.manifest.model})`;
    if (this.manifest.provider) return this.manifest.provider;
    return 'Google Gemini TTS';
  }

  private entryFor(key: string): ManifestClipEntry | undefined {
    if (!this.manifest) return undefined;
    if (this.manifest.clips && this.manifest.clips[key]) {
      return this.manifest.clips[key];
    }
    if (this.manifest.lines && this.manifest.lines[key]) {
      return this.manifest.lines[key];
    }
    return undefined;
  }

  private keyFor(line: SpeakLine, lang: string): string {
    return `${lang}/${line.missionId}/${line.id}`;
  }

  getDurationMs(missionId: string, lineId: string, lang: string): number | undefined {
    return this.entryFor(`${lang}/${missionId}/${lineId}`)?.durationMs;
  }

  /**
   * True when the manifest has loaded. Even if a specific language's clips have
   * not been generated yet, Play mode remains available and falls back to silent
   * reading-speed timing per missing clip.
   */
  isAvailable(lang: string): boolean {
    if (!this.manifest) return false;
    const prefix = `${lang}/`;
    const hasClip =
      (this.manifest.clips && Object.keys(this.manifest.clips).some((k) => k.startsWith(prefix))) ||
      (this.manifest.lines && Object.keys(this.manifest.lines).some((k) => k.startsWith(prefix)));
    return Boolean(hasClip);
  }

  canSpeak(line: SpeakLine, lang: string): boolean {
    return Boolean(this.entryFor(this.keyFor(line, lang)));
  }

  private urlFor(line: SpeakLine, lang: string): string | null {
    const entry = this.entryFor(this.keyFor(line, lang));
    if (!entry) return null;
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
    return `${base}${entry.file}`;
  }

  preload(items: { line: SpeakLine; lang: string }[]): void {
    if (!this.manifest) return;
    const keep = new Set<string>();
    for (const { line, lang } of items) {
      const url = this.urlFor(line, lang);
      if (!url) continue;
      keep.add(url);
      if (!this.preloaded.has(url)) {
        const a = new Audio();
        a.preload = 'auto';
        a.src = url;
        this.preloaded.set(url, a);
      }
    }
    for (const [url] of this.preloaded) {
      if (!keep.has(url)) this.preloaded.delete(url);
    }
  }

  speak(line: SpeakLine, lang: string, opts: SpeakOptions): Promise<void> {
    const key = this.keyFor(line, lang);
    const url = this.urlFor(line, lang);
    if (!url) {
      warnOnceDev(
        key,
        `[narration] Missing pre-generated clip for ${key}; timing line by reading speed.`,
      );
      return Promise.reject(new CannotSpeak(`missing clip: ${key}`));
    }

    this.stop();

    return new Promise<void>((resolve, reject) => {
      const a = this.preloaded.get(url) ?? new Audio(url);
      try {
        a.currentTime = 0;
      } catch {
        /* not yet seekable */
      }
      a.preservesPitch = true;
      a.playbackRate = opts.rate;
      this.audio = a;

      setNarrationDucking(true, opts.reduced);

      const done = (fn: () => void) => {
        a.onended = null;
        a.onerror = null;
        if (this.audio === a) this.audio = null;
        this.settle = null;
        setNarrationDucking(false, opts.reduced);
        fn();
      };

      this.settle = () => done(resolve);
      a.onended = () => done(resolve);
      a.onerror = () => {
        warnOnceDev(
          key,
          `[narration] Failed to load audio clip ${url}; timing line by reading speed.`,
        );
        done(() => reject(new CannotSpeak(`audio load error: ${url}`)));
      };

      const p = a.play();
      if (p) {
        p.catch(() => {
          warnOnceDev(
            key,
            `[narration] Audio playback blocked or failed for ${url}; timing line by reading speed.`,
          );
          done(() => reject(new CannotSpeak(`play() rejected: ${url}`)));
        });
      }
    });
  }

  stop(): void {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (this.settle) {
      this.settle();
    } else {
      setNarrationDucking(false);
    }
  }
}
