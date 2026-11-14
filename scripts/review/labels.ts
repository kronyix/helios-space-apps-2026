/**
 * Task 1 check: scan the rendered text of every screen for vendor or "AI generated"
 * strings, and count image labels against visible content images.
 *   npx tsx scripts/review/labels.ts <round>
 */
import { mkdirSync } from 'node:fs';
import { BASE, launch } from './browser.ts';
import missions from '../../src/data/missions.json' with { type: 'json' };

const out = `review/${process.argv[2] ?? 'page-turn'}`;
mkdirSync(out, { recursive: true });
const urls = ['/', '/?stage=badges'];
for (const m of missions)
  for (const mode of ['illustrated', 'archival'])
    urls.push(`/?stage=story&mission=${m.id}&mode=${mode}`, `/?stage=hardware&mission=${m.id}&mode=${mode}`, `/?stage=reward&mission=${m.id}&mode=${mode}`);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let bad = 0;
for (const u of urls) {
  await page.goto(BASE + u);
  await page.waitForTimeout(2200);
  const r = (await page.evaluate(`(() => {
    const t = document.body.innerText;
    const hits = (t.match(/gemini|ai[- ]?generated|generated (by|with)/gi) || []);
    const imgs = [...document.querySelectorAll('.comic-panel__frame, .field-archive__img, .epilogue')];
    const unlabeled = imgs.filter((f) => f.querySelectorAll('.image-label').length !== 1).length;
    return { hits, frames: imgs.length, unlabeled };
  })()`)) as { hits: string[]; frames: number; unlabeled: number };
  const allowed = u.includes('badges') ? 1 : 0;
  const ok = r.hits.length <= allowed && r.unlabeled === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${u}  vendor-strings=${r.hits.length} frames=${r.frames} unlabeled=${r.unlabeled}`);
}
await page.goto(BASE + '/?stage=story&mission=apollo11&mode=illustrated');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/labels-story-illustrated-1440.png` });
await page.goto(BASE + '/?stage=story&mission=apollo11&mode=archival');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/labels-story-archival-1440.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/?stage=reward&mission=opportunity&mode=illustrated');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/labels-reward-390.png`, fullPage: false });
console.log(bad ? `${bad} screen(s) failed` : 'all screens pass');
await browser.close();
