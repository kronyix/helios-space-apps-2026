/**
 * Pre-generates narration MP3s with Google Cloud Text-to-Speech.
 *
 *   GOOGLE_TTS_API_KEY=… npx tsx scripts/generate-narration.ts [--dry] [--lang=hi]
 *
 * Reads the comic lines (src/data/comics), the translations (src/data/locales/<lang>/missions.json)
 * and the voices (src/data/locales/languages.json → tts). Writes public/audio/<lang>/<mission>/<panel>-<line>.mp3
 * and public/audio/manifest.json. Lines whose text and voice are unchanged (same hash) are skipped.
 * A missing translation is skipped too: the app then falls back to English text and voice.
 * The key is read from the environment or .env only; it never reaches client code.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PROVIDER = 'Google Cloud Text-to-Speech';
const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const MANIFEST = 'public/audio/manifest.json';

interface Voice { name: string; pitch?: number }
interface Lang { code: string; bcp47: string; tts?: { narrator: Voice; characters?: Record<string, Voice> } }
interface Line { id: string; kind: 'caption' | 'speech'; speaker?: string; text: string; narration?: { speaker?: string; textKey?: string } }
interface Issue { missionId?: string; panels: { id: string; lines: Line[] }[] }
interface Manifest { version: number; provider: string; lines: Record<string, { src: string; hash: string }> }

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const onlyLang = args.find((a) => a.startsWith('--lang='))?.slice(7);

try {
  process.loadEnvFile('.env');
} catch {
  /* no .env: use the environment */
}
const KEY = process.env.GOOGLE_TTS_API_KEY;
if (!KEY && !dry) {
  console.error('GOOGLE_TTS_API_KEY is not set (see .env.example). Use --dry to list what would be generated.');
  process.exit(1);
}

// Same rules as src/i18n/comic.ts and src/narration/VoiceProvider.ts (app code uses bundler-style imports).
function resolveKey(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined;
  return typeof cur === 'string' && cur.trim() ? cur : undefined;
}
const textKey = (mid: string, pid: string, l: Line) => l.narration?.textKey ?? `${mid}.comic.${pid}.lines.${l.id}`;
const voiceId = (l: Line) => l.narration?.speaker ?? (l.kind === 'speech' && l.speaker ? l.speaker.toLowerCase() : 'narrator');
const audioKey = (lang: string, mid: string, pid: string, id: string) => `${lang}/${mid}/${id.startsWith(`${pid}-`) ? id : `${pid}-${id}`}`;

const load = async (f: string, name: string): Promise<Issue> => (await import(`../src/data/comics/${f}.ts`))[name];
const issues = await Promise.all([load('opportunity-spirit', 'ISSUE_01'), load('apollo11', 'ISSUE_02'), load('ingenuity', 'ISSUE_03')]);
const langs: Lang[] = JSON.parse(readFileSync('src/data/locales/languages.json', 'utf8'));
const old: Manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { version: 1, provider: '', lines: {} };
const next: Manifest = { version: 1, provider: PROVIDER, lines: {} };

async function synthesize(text: string, lang: Lang, v: Voice): Promise<Buffer> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY! },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: lang.bcp47, name: v.name },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1, pitch: v.pitch ?? 0 },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const { audioContent } = (await res.json()) as { audioContent: string };
  return Buffer.from(audioContent, 'base64');
}

let made = 0, kept = 0, skipped = 0;
const failed: string[] = [];
for (const lang of langs) {
  if (onlyLang && lang.code !== onlyLang) {
    // Keep other languages' entries untouched.
    for (const [k, e] of Object.entries(old.lines)) if (k.startsWith(`${lang.code}/`)) next.lines[k] = e;
    continue;
  }
  if (!lang.tts) {
    console.warn(`! ${lang.code}: no tts voices in languages.json, skipped`);
    continue;
  }
  const dict = lang.code === 'en' ? null : existsSync(`src/data/locales/${lang.code}/missions.json`) ? JSON.parse(readFileSync(`src/data/locales/${lang.code}/missions.json`, 'utf8')) : {};
  for (const issue of issues) {
    const mid = issue.missionId!;
    for (const p of issue.panels) {
      for (const l of p.lines) {
        const text = dict ? resolveKey(dict, textKey(mid, p.id, l)) : l.text;
        if (!text) {
          skipped++;
          continue;
        }
        const voice = lang.tts.characters?.[voiceId(l)] ?? lang.tts.narrator;
        const hash = createHash('sha1').update(JSON.stringify([text, lang.bcp47, voice.name, voice.pitch ?? 0])).digest('hex');
        const key = audioKey(lang.code, mid, p.id, l.id);
        const src = `/audio/${key}.mp3`;
        const file = `public${src}`;
        if (old.lines[key]?.hash === hash && existsSync(file)) {
          next.lines[key] = old.lines[key];
          kept++;
          continue;
        }
        if (dry) {
          console.log(`would generate ${key} (${voice.name})`);
          made++;
          continue;
        }
        try {
          const mp3 = await synthesize(text, lang, voice);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, mp3);
          next.lines[key] = { src, hash };
          made++;
          console.log(`✓ ${key}`);
        } catch (e) {
          failed.push(`${key}: ${(e as Error).message}`);
        }
      }
    }
  }
}

if (!dry) {
  // Remove files for lines that no longer exist.
  for (const [k, e] of Object.entries(old.lines)) if (!next.lines[k] && !failed.some((f) => f.startsWith(`${k}:`)) && existsSync(`public${e.src}`)) unlinkSync(`public${e.src}`);
  writeFileSync(MANIFEST, JSON.stringify(next, null, 2) + '\n');
}
console.log(`${dry ? 'would generate' : 'generated'} ${made}, unchanged ${kept}, untranslated ${skipped}${failed.length ? `, FAILED ${failed.length}` : ''}`);
if (failed.length) {
  console.error(failed.join('\n'));
  process.exit(1);
}
