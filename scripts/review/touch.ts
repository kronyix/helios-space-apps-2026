/**
 * Touch playthrough: each mini-game played to success with touch input only.
 *   npx tsx scripts/review/touch.ts <round>
 * Runs with reduced motion so the spectrometer trace is static (one screen).
 */
import { mkdirSync } from 'node:fs';
import { BASE, launch } from './browser.ts';

const out = `review/${process.argv[2] ?? 'round-2'}`;
mkdirSync(out, { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const result = () => page.evaluate(`document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').slice(0, 160)`);

async function open(id: string) {
  await page.goto(`${BASE}/?stage=hardware&mission=${id}&game=intro`);
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /start the/i }).tap();
  await page.waitForTimeout(800);
}

// Spectrometer: tap each reference peak.
await open('opportunity');
const svg = page.locator('[role=dialog] svg[role=img]');
const box = (await svg.boundingBox())!;
const xs = (await page.evaluate(`(() => {
  const d = document.querySelectorAll('[role=dialog] svg[role=img] path')[1].getAttribute('d');
  const pts = [...d.matchAll(/[ML]([\\d.-]+) ([\\d.-]+)/g)].map((m) => [+m[1], +m[2]]);
  const o = [];
  for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < 225 && pts[i][1] <= pts[i-1][1] && pts[i][1] < pts[i+1][1]) o.push(pts[i][0]);
  return o;
})()`)) as number[];
for (const x of xs) {
  await page.touchscreen.tap(box.x + (x / 1000) * box.width, box.y + box.height / 2);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(1800);
console.log('SPECTROMETER (touch):', await result());
await page.screenshot({ path: `${out}/touch-spectrometer-390.png` });

// Laser: tap the slider where the reflector is, then tap Fire.
await open('apollo11');
for (let i = 0; i < 6; i++) {
  const label = (await page.evaluate(`document.querySelector('[role=dialog] svg[role=img]').getAttribute('aria-label')`)) as string;
  if (label.includes('Reticle on the reflector')) break;
  const aim = Number(await page.locator('input[type=range]').inputValue());
  const m = label.match(/(right|left) of the reticle by ([\d.]+)/);
  if (!m) break;
  const target = aim + (m[1] === 'right' ? 1 : -1) * Number(m[2]);
  const r = (await page.locator('input[type=range]').boundingBox())!;
  const frac = (target + 6) / 12;
  // Range thumbs inset by ~half a thumb; small correction loop handles the rest.
  await page.touchscreen.tap(r.x + 8 + frac * (r.width - 16), r.y + r.height / 2);
  await page.waitForTimeout(120);
}
await page.getByRole('button', { name: /fire laser/i }).tap();
await page.waitForTimeout(4500);
console.log('LASER (touch):', await result());
await page.screenshot({ path: `${out}/touch-laser-390.png` });

// RPM: hold the throttle with touch pointer events, feathering on the command needle.
await open('ingenuity');
const btn = page.getByRole('button', { name: /hold to throttle|throttle up/i });
let held = false;
const t0 = Date.now();
while (Date.now() - t0 < 16000) {
  const cmd = (await page.evaluate(`(() => { const l = document.querySelector('[role=dialog] svg[role=img]')?.getAttribute('aria-label') || ''; const m = l.match(/command (\\d+)/); return m ? +m[1] : -1; })()`)) as number;
  if (cmd < 0) break;
  const want = cmd < 2537;
  if (want !== held) {
    await btn.dispatchEvent(want ? 'pointerdown' : 'pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
    held = want;
  }
  await page.waitForTimeout(25);
}
await page.waitForTimeout(2000);
console.log('RPM (touch):', await result());
await page.screenshot({ path: `${out}/touch-rpm-390.png` });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
