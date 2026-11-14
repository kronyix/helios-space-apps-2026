/**
 * Performance metrics against the production preview (npm run build && npm run preview).
 *   npx tsx scripts/review/metrics.ts <round>
 * - FPS over 5 s on the archive globe and each hardware diorama, CPU throttled 4×.
 * - renderer.info per scene (draw calls, triangles, geometries, textures).
 * - Leak check: JS heap + live WebGL contexts after visiting all missions twice.
 * - Bundle, model and texture sizes; first-paint timings.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { BASE, launch } from './browser.ts';
import missions from '../../src/data/missions.json' with { type: 'json' };

const round = process.argv[2] ?? 'before';
const out = `review/${round}`;
mkdirSync(out, { recursive: true });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

// In-page code is passed as strings: tsx would otherwise inject helpers (__name) the page lacks.
async function fps(p: Page, seconds = 5): Promise<{ fps: number; p95FrameMs: number }> {
  return p.evaluate(`new Promise((resolve) => {
    const times = []; let last = performance.now(); const end = last + ${seconds} * 1000;
    const tick = (now) => {
      times.push(now - last); last = now;
      if (now < end) requestAnimationFrame(tick);
      else {
        const sorted = [...times].sort((a, b) => a - b);
        resolve({ fps: Math.round((times.length / ${seconds}) * 10) / 10, p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10 });
      }
    };
    requestAnimationFrame(tick);
  })`);
}

const info = (p: Page) =>
  p.evaluate(`(() => {
    const gl = window.__heliosGL;
    return gl ? { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, liveContexts: document.querySelectorAll('canvas').length } : null;
  })()`);

const heap = async () => {
  await cdp.send('HeapProfiler.collectGarbage');
  const m = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
  return Math.round(m.usedSize / 1e5) / 10;
};

const result: Record<string, unknown> = { gpu: '', scenes: {} as Record<string, unknown> };

// First paint / load timings (no throttling).
await page.goto(BASE + '/');
result.gpu = await page.evaluate(`(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  const e = g && g.getExtension('WEBGL_debug_renderer_info');
  return g && e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
})()`);
result.paint = await page.evaluate(`Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]))`);
await page.waitForTimeout(6000);

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const scenes = result.scenes as Record<string, unknown>;
const visit = async (key: string, url: string) => {
  await page.goto(BASE + url);
  await page.waitForTimeout(8000);
  const f = await fps(page);
  scenes[key] = { ...f, renderer: await info(page) };
  process.stdout.write('.');
};
await visit('archive', '/');
for (const m of missions) await visit(`hardware-${m.id}`, `/?stage=hardware&mission=${m.id}`);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

// Leak check inside one page session: navigate through the app twice via the store.
await page.goto(BASE + '/');
await page.waitForTimeout(5000);
const heapStart = await heap();
const cycle = async () => {
  for (const m of missions) {
    for (const label of ['Story', 'Hardware']) {
      await page.evaluate(`document.activeElement && document.activeElement.blur()`);
      await page.locator('nav[aria-label=Primary]').getByRole('button', { name: 'Archive', exact: true }).click();
      await page.waitForTimeout(1500);
      await page.locator('.issue-row').nth(m.issueNumber - 1).click();
      await page.waitForTimeout(3500);
      if (label === 'Hardware') {
        await page.locator('nav[aria-label=Primary]').getByRole('button', { name: 'Hardware', exact: true }).click();
        await page.waitForTimeout(4500);
      }
    }
  }
};
await cycle();
const heapAfter1 = await heap();
const info1 = await info(page);
await cycle();
const heapAfter2 = await heap();
const info2 = await info(page);
result.leak = { heapMBStart: heapStart, heapMBAfterCycle1: heapAfter1, heapMBAfterCycle2: heapAfter2, rendererAfter1: info1, rendererAfter2: info2 };

// Sizes.
const kb = (p: string) => Math.round(statSync(p).size / 1024);
const list = (dir: string, re: RegExp) =>
  Object.fromEntries(readdirSync(dir).filter((f) => re.test(f)).map((f) => [f, kb(join(dir, f))]));
result.bundleKB = list('dist/assets', /\.(js|css)$/);
result.initialJsKB = Object.entries(result.bundleKB as Record<string, number>)
  .filter(([f]) => /^(index|three|react|rolldown)/.test(f) && f.endsWith('.js'))
  .reduce((n, [, v]) => n + v, 0);
result.modelsKB = list('public/models', /\.glb$/);
result.texturesKB = list('public/textures', /./);

writeFileSync(`${out}/metrics.json`, JSON.stringify(result, null, 2));
console.log('\n' + JSON.stringify(result, null, 2));
await browser.close();
