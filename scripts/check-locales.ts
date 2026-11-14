/**
 * Fact-integrity check for translations: every comic line is translated, names stay in English,
 * and every number keeps its value (formatting may differ per language).
 *   npx tsx scripts/check-locales.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

// Loaded by path so tsc (nodenext) does not type-check the app's bundler-style imports.
interface Line { id: string; text: string; narration?: { textKey?: string } }
interface Issue { missionId?: string; panels: { id: string; stamp: string; lines: Line[] }[] }
const load = async (f: string, name: string): Promise<Issue> => (await import(`../src/data/comics/${f}.ts`))[name];

// Same rules as src/i18n/comic.ts (kept inline: app code uses bundler-style imports).
function resolveKey(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined;
  return typeof cur === 'string' && cur.trim() ? cur : undefined;
}
const lineTextKey = (mid: string, panelId: string, l: Line) => l.narration?.textKey ?? `${mid}.comic.${panelId}.lines.${l.id}`;

const ISSUES = await Promise.all([load('opportunity-spirit', 'ISSUE_01'), load('apollo11', 'ISSUE_02'), load('ingenuity', 'ISSUE_03')]);
const NAMES = ['Spirit', 'Opportunity', 'Eagle', 'Columbia', 'Ingenuity', 'Perseverance', 'Home Plate', 'Tranquility Base', 'Apollo 11', 'Saturn V', 'USS Hornet', 'NASA', 'RPM'];
const LANGS: { code: string; numberLocale: string }[] = JSON.parse(readFileSync('src/data/locales/languages.json', 'utf8'));

function numbers(text: string, locale: string): number[] {
  const dec = (1.5).toLocaleString(locale).charAt(1);
  const group = dec === ',' ? '.' : ',';
  const re = new RegExp(`\\d+(?:[${group}\\u202f\\u00a0]\\d{3})*(?:\\${dec}\\d+)?`, 'g');
  return (text.match(re) ?? [])
    .map((m) => Number(m.replace(new RegExp(`[${group}\\u202f\\u00a0]`, 'g'), '').replace(dec, '.')))
    .sort((a, b) => a - b);
}

let errors = 0;
const fail = (msg: string) => {
  errors++;
  console.error('✗', msg);
};

for (const { code, numberLocale } of LANGS) {
  if (code === 'en') continue;
  const file = `src/data/locales/${code}/missions.json`;
  if (!existsSync(file)) {
    console.warn(`! ${code}: no missions.json (falls back to English)`);
    continue;
  }
  const dict = JSON.parse(readFileSync(file, 'utf8'));
  let n = 0;
  for (const issue of ISSUES) {
    const mid = issue.missionId!;
    if (!resolveKey(dict, `${mid}.meta.disclaimer`)) fail(`${code} ${mid}: missing fictionalized-narration disclaimer`);
    for (const p of issue.panels) {
      const pairs: [string, string, string | undefined][] = [[`${p.id} stamp`, p.stamp, resolveKey(dict, `${mid}.comic.${p.id}.stamp`)]];
      for (const l of p.lines) pairs.push([l.id, l.text, resolveKey(dict, lineTextKey(mid, p.id, l))]);
      for (const [id, en, tr] of pairs) {
        n++;
        const where = `${code} ${mid} ${id}`;
        if (!tr) {
          fail(`${where}: missing`);
          continue;
        }
        for (const name of NAMES) if (en.toLowerCase().includes(name.toLowerCase()) && !tr.toLowerCase().includes(name.toLowerCase())) fail(`${where}: name "${name}" lost`);
        const a = numbers(en, 'en-US').join(' ');
        const b = numbers(tr, numberLocale).join(' ');
        if (a !== b) fail(`${where}: numbers differ\n    en: ${a}\n    ${code}: ${b}`);
      }
    }
  }
  console.log(`${code}: ${n} strings checked`);
}
for (const dir of readdirSync('src/data/locales', { withFileTypes: true })) {
  if (dir.isDirectory() && !LANGS.some((l) => l.code === dir.name)) fail(`locale folder "${dir.name}" is not in languages.json`);
}
if (errors) {
  console.error(`\n${errors} problem(s)`);
  process.exit(1);
}
console.log('locales OK');
