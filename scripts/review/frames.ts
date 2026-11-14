/**
 * Frame strips of transitions plus spot checks for a review round.
 *   npx tsx scripts/review/frames.ts <round>
 */
import { mkdirSync } from 'node:fs';
import { BASE, launch } from './browser.ts';

const round = process.argv[2] ?? 'round-2';
const out = `review/${round}`;
mkdirSync(out, { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

// Story → hardware dissolve (first visit, model not cached).
for (const id of ['apollo11', 'opportunity']) {
  await page.goto(`${BASE}/?stage=story&mission=${id}`);
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /explore the hardware/i }).click();
  for (const t of [150, 600, 1200, 2000, 3200]) {
    await page.waitForTimeout(t - (t === 150 ? 0 : [150, 600, 1200, 2000, 3200][[150, 600, 1200, 2000, 3200].indexOf(t) - 1]));
    await page.screenshot({ path: `${out}/transition-${id}-story-to-hardware-${String(t).padStart(4, '0')}ms.png` });
  }
}

// Spot checks.
const spots: [string, string, { width: number; height: number }][] = [
  ['02-apollo11-hardware-hotspot-kapton-1440', '/?stage=hardware&mission=apollo11&hotspot=kapton', { width: 1440, height: 900 }],
  ['03-ingenuity-hardware-hotspot-blades-1440', '/?stage=hardware&mission=ingenuity&hotspot=blades', { width: 1440, height: 900 }],
  ['01-opportunity-story-illustrated-1440', '/?stage=story&mission=opportunity&mode=illustrated', { width: 1440, height: 900 }],
  ['02-apollo11-reward-1440', '/?stage=reward&mission=apollo11', { width: 1440, height: 900 }],
  ['01-archive-1024', '/', { width: 1024, height: 768 }],
];
for (const [name, url, vp] of spots) {
  await page.setViewportSize(vp);
  await page.goto(BASE + url);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
