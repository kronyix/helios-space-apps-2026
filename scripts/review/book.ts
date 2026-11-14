/**
 * Page-turn verification (Task 5 subset): drag-turn, flick, cancelled drag, keyboard,
 * riffle, mobile swipe, reduced motion, no-WebGL; screenshots + FPS during turns.
 *   npx tsx scripts/review/book.ts [round]
 */
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { BASE, launch } from './browser.ts';

const out = `review/${process.argv[2] ?? 'page-turn'}`;
mkdirSync(out, { recursive: true });
const browser = await launch();
const errors: string[] = [];
const watch = (p: Page) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('THREE.Clock') && errors.push(m.text()));
};
const state = (p: Page) =>
  p.evaluate(`({ label: document.querySelector('.book')?.getAttribute('aria-label'), glLeaf: !!document.querySelector('.book-gl-wrap canvas'), cssLeaf: !!document.querySelector('.book__leaf') })`);

// Desktop
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
watch(page);
const cdp = await ctx.newCDPSession(page);
await page.goto(BASE + '/?issue=01&page=1&mode=illustrated');
await page.waitForTimeout(6000); // snapshots warm up on idle
console.log('start', JSON.stringify(await state(page)));
const r = (await page.locator('.book').boundingBox())!;
const midY = r.y + r.height * 0.5;

// 1. slow drag turn, captured mid-drag
await page.mouse.move(r.x + r.width - 20, midY);
await page.mouse.down();
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(r.x + r.width - 20 - (r.width * 0.55 * i) / 20, midY - 10, { steps: 2 });
  await page.waitForTimeout(25);
  if (i === 10) await page.screenshot({ path: `${out}/turn-drag-mid-1440.png` });
}
console.log('mid-drag', JSON.stringify(await state(page)));
await page.mouse.up();
await page.waitForTimeout(1300);
console.log('after slow drag', JSON.stringify(await state(page)));
await page.screenshot({ path: `${out}/turn-after-drag-1440.png` });

// 2. cancelled drag (springs back)
await page.waitForTimeout(1500);
const before = (await state(page)) as { label: string };
await page.mouse.move(r.x + r.width - 20, midY);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(r.x + r.width - 20 - i * 12, midY);
  await page.waitForTimeout(40);
}
await page.waitForTimeout(250); // hold still: no flick
await page.mouse.up();
await page.waitForTimeout(1200);
const afterCancel = (await state(page)) as { label: string };
console.log('cancelled drag springs back:', before.label === afterCancel.label);

// 3. keyboard back, FPS during the turn at 4x CPU throttle (after snapshots settle)
await page.waitForTimeout(4000);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.locator('.book').focus();
const fpsP = page.evaluate(`new Promise((res) => { let n = 0; const t0 = performance.now(); const f = (t) => { n++; if (t - t0 < 850) requestAnimationFrame(f); else res(Math.round(n * 1000 / (t - t0))); }; requestAnimationFrame(f); })`);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/turn-keyboard-mid-1440.png` });
console.log('FPS during keyboard turn (4x throttle):', await fpsP);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.waitForTimeout(1200);
console.log('after ←', JSON.stringify(await state(page)));

// 4. riffle via scrubber to the last spread
await page.getByRole('button', { name: /^Pages 4/ }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/turn-riffle-1440.png` });
await page.waitForTimeout(1200);
console.log('after riffle', JSON.stringify(await state(page)));

// 5. renderer.info after paging all three books twice
const info = () => page.evaluate(`(() => { const g = window.__heliosGL; return g ? { geometries: g.info.memory.geometries, textures: g.info.memory.textures } : null; })()`);
const cycle = async () => {
  for (const issue of ['01', '02', '03']) {
    await page.goto(`${BASE}/?issue=${issue}&page=1`);
    await page.waitForTimeout(3500);
    for (let k = 0; k < 2; k++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(1300);
    }
  }
};
await cycle();
const i1 = await info();
await cycle();
const i2 = await info();
console.log('renderer.info after cycle 1 / 2:', JSON.stringify(i1), JSON.stringify(i2));
await ctx.close();

// Mobile swipe
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const mp = await m.newPage();
watch(mp);
await mp.goto(BASE + '/?issue=02&page=1&mode=illustrated');
await mp.waitForTimeout(5000);
const mb = (await mp.locator('.book').boundingBox())!;
await mp.locator('.book').dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch', isPrimary: true, button: 0, clientX: mb.x + mb.width - 20, clientY: mb.y + mb.height / 2 });
for (let i = 1; i <= 8; i++) {
  await mp.locator('.book').dispatchEvent('pointermove', { pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: mb.x + mb.width - 20 - i * 30, clientY: mb.y + mb.height / 2 });
  await mp.waitForTimeout(16);
}
await mp.screenshot({ path: `${out}/turn-swipe-mid-390.png` });
await mp.locator('.book').dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: mb.x + mb.width - 260, clientY: mb.y + mb.height / 2 });
await mp.waitForTimeout(1300);
console.log('mobile after swipe', JSON.stringify(await state(mp)));
await mp.screenshot({ path: `${out}/turn-swipe-after-390.png` });
await m.close();

// Reduced motion + no WebGL
for (const [name, opts, q] of [
  ['reduced', { reducedMotion: 'reduce' as const }, ''],
  ['nowebgl', {}, '&nowebgl'],
] as const) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const p = await c.newPage();
  watch(p);
  await p.goto(`${BASE}/?issue=03&page=1${q}`);
  await p.waitForTimeout(3000);
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(name === 'reduced' ? 100 : 400);
  await p.screenshot({ path: `${out}/turn-${name}-mid-1440.png` });
  await p.waitForTimeout(1200);
  console.log(name, JSON.stringify(await state(p)));
  await c.close();
}
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].slice(0, 15).join('\n') : 'no console errors/warnings');
await browser.close();
