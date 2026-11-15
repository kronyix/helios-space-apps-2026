/**
 * Captures every app state to review/<round>/ (screenshots + console log + one video).
 *   npm run build && npm run preview   (in another terminal)
 *   npx tsx scripts/review/capture.ts <round> [--only=1440,390]
 * States are reached through URL deep links (see initialFromUrl in the store).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Browser, BrowserContextOptions, Page } from 'playwright';
import { BASE, VIEWPORTS, launch } from './browser.ts';
import missions from '../../src/data/missions.json' with { type: 'json' };

const round = process.argv[2] ?? 'before';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const out = `review/${round}`;
mkdirSync(out, { recursive: true });

type Shot = { name: string; url: string; wait?: number; act?: (p: Page) => Promise<void>; desktopOnly?: boolean };

const shots: Shot[] = [
  { name: '00-loader', url: '/', wait: 250 },
  { name: '01-archive', url: '/', wait: 7000 },
  {
    name: '01-archive-moon',
    url: '/',
    wait: 6000,
    act: async (p) => {
      await p.getByRole('radio', { name: /moon/i }).click();
      await p.waitForTimeout(2500);
    },
  },
  {
    name: '01-archive-beacon-hover',
    url: '/',
    wait: 6000,
    desktopOnly: true,
    act: async (p) => {
      await p.locator('.beacon').first().hover({ force: true });
      await p.waitForTimeout(1500);
    },
  },
  { name: '09-badges', url: '/?stage=badges', wait: 2500 },
];

for (const m of missions) {
  const n = String(m.issueNumber).padStart(2, '0');
  shots.push(
    { name: `${n}-${m.id}-story-illustrated`, url: `/?stage=story&mission=${m.id}&mode=illustrated`, wait: 3000 },
    { name: `${n}-${m.id}-story-archival`, url: `/?stage=story&mission=${m.id}&mode=archival`, wait: 3000 },
    { name: `${n}-${m.id}-hardware`, url: `/?stage=hardware&mission=${m.id}`, wait: 7000 },
    { name: `${n}-${m.id}-game-intro`, url: `/?stage=hardware&mission=${m.id}&game=intro`, wait: 5000 },
    { name: `${n}-${m.id}-reward`, url: `/?stage=reward&mission=${m.id}&mode=illustrated`, wait: 4000 },
  );
  for (const h of m.hotspots)
    shots.push({ name: `${n}-${m.id}-hardware-hotspot-${h.id}`, url: `/?stage=hardware&mission=${m.id}&hotspot=${h.id}`, wait: 7000, desktopOnly: true });
}

const consoleLog: Record<string, string[]> = {};

async function capture(browser: Browser, vpKey: string, ctxOpts: BrowserContextOptions, suffix = '', subset?: string[]) {
  const vp = VIEWPORTS[vpKey as keyof typeof VIEWPORTS];
  const ctx = await browser.newContext({ viewport: vp, ...ctxOpts });
  for (const s of shots) {
    if (s.desktopOnly && vpKey !== '1440') continue;
    if (subset && !subset.some((x) => s.name.includes(x))) continue;
    const page = await ctx.newPage();
    const key = `${s.name}-${vpKey}${suffix}`;
    const msgs: string[] = [];
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('THREE.Clock')) msgs.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}`));
    try {
      await page.goto(BASE + s.url + (suffix.includes('nowebgl') ? (s.url.includes('?') ? '&' : '?') + 'nowebgl' : ''), { waitUntil: s.wait && s.wait < 1000 ? 'commit' : 'load' });
      await page.waitForTimeout(s.wait ?? 3000);
      if (s.act) await s.act(page);
      await page.screenshot({ path: `${out}/${key}.png` });
    } catch (e) {
      msgs.push(`[capture-error] ${(e as Error).message.split('\n')[0]}`);
    }
    if (msgs.length) consoleLog[key] = msgs;
    await page.close();
    process.stdout.write('.');
  }
  await ctx.close();
}

async function video(browser: Browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS['1440'], recordVideo: { dir: `${out}/video`, size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForTimeout(6000);
  await p.getByRole('button', { name: /begin the journey/i }).click();
  await p.waitForTimeout(5000);
  await p.getByRole('button', { name: /explore the hardware/i }).click();
  await p.waitForTimeout(6000);
  await ctx.close();
}

const browser = await launch();
const vps = (only ?? Object.keys(VIEWPORTS)).filter((v) => v in VIEWPORTS);
await Promise.all(vps.map((v) => capture(browser, v, {})));
if (!only || only.includes('1440')) {
  await capture(browser, '1440', { reducedMotion: 'reduce' }, '-reduced', ['archive', 'story-illustrated', 'hardware', 'reward']);
  await capture(browser, '1440', {}, '-nowebgl', ['01-archive', '-hardware', 'reward']);
  await video(browser).catch((e: Error) => console.warn(`video skipped: ${e.message.split("\n")[0]}`));
}
await browser.close();
writeFileSync(`${out}/console.json`, JSON.stringify(consoleLog, null, 2));
console.log(`\n${out}: done. Console issues in ${Object.keys(consoleLog).length} state(s).`);
