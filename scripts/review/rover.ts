/**
 * Signal Delay walkthrough: briefing → plan → uplink → execute → downlink → win.
 *   REVIEW_URL=http://localhost:3100 npx tsx scripts/review/rover.ts [1440|390] [--reduced] [--nowebgl] [--video]
 * Screenshots land in review/rover/.
 */
import { mkdirSync } from 'node:fs';
import { launch, BASE, VIEWPORTS } from './browser';

const vpKey = (process.argv.find((a) => a in VIEWPORTS) ?? '1440') as keyof typeof VIEWPORTS;
const reduced = process.argv.includes('--reduced');
const nowebgl = process.argv.includes('--nowebgl');
const video = process.argv.includes('--video');
const out = 'review/rover';
mkdirSync(out, { recursive: true });
const tag = `${vpKey}${reduced ? '-reduced' : ''}${nowebgl ? '-2d' : ''}`;

const browser = await launch();
const ctx = await browser.newContext({
  viewport: VIEWPORTS[vpKey],
  reducedMotion: reduced ? 'reduce' : 'no-preference',
  hasTouch: vpKey === '390',
  isMobile: vpKey === '390',
  ...(video ? { recordVideo: { dir: out, size: VIEWPORTS[vpKey] } } : {}),
});
const page = await ctx.newPage();
const problems: string[] = [];
page.on('console', (m) => {
  if ((m.type() === 'error' || m.type() === 'warning') && !/THREE\.Clock|THREE\.THREE\.Clock/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

const shot = (name: string) => page.screenshot({ path: `${out}/${tag}-${name}.png` });
const state = () =>
  page.evaluate(() => {
    const s = (window as any).__rover.getState();
    return { phase: s.phase, sol: s.game.rover.sol, battery: Math.round(s.game.rover.battery), x: s.game.rover.x, z: s.game.rover.z };
  });

await page.goto(`${BASE}/play/rover-drive?fps${nowebgl ? '&nowebgl' : ''}`);
await page.waitForTimeout(nowebgl ? 1500 : 8000);
await shot('1-briefing');

await page.getByRole('button', { name: 'Start mission' }).click();
await page.waitForTimeout(1500);
for (const k of ['5', 'w', 'w', 'a', 'w']) await page.keyboard.press(k);
await page.waitForTimeout(1500);
await shot('2-planning');
const fps = await page.locator('.rd-fps').textContent().catch(() => null);

await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
await shot('3-uplink');
await page.waitForTimeout(4200);
await page.waitForTimeout(1500);
await shot('4-executing');
for (let i = 0; i < 40 && (await state()).phase === 'executing'; i++) await page.waitForTimeout(250);
await page.waitForTimeout(600);
await shot('5-downlink');
console.log('after sol 1', await state());

// Jump next to the outcrop and SCAN to reach the win screen.
await page.getByRole('button', { name: /Plan sol/ }).click();
await page.evaluate(() => {
  const st = (window as any).__rover;
  const s = st.getState();
  const t = s.game.terrain;
  st.setState({ game: { ...s.game, rover: { ...s.game.rover, x: t.target.x - 1, z: t.target.z - 1 } } });
});
await page.keyboard.press('q');
await page.keyboard.press('Enter');
for (let i = 0; i < 60 && !['won', 'lost'].includes((await state()).phase); i++) await page.waitForTimeout(250);
await page.waitForTimeout(800);
await shot('6-end');
console.log('end', await state(), 'fps', fps);

// Each lose condition, driven through the real UI flow (state seeded via the dev hook).
if (process.argv.includes('--lose')) {
  const cases: Record<string, string> = {
    battery: `r.battery = 2;`,
    tipover: `const c = t.crater; r.x = c.x - 12.5; r.z = c.z; r.heading = Math.PI / 2; g.terrain = { ...t, rocks: [] };`,
    sand: `r.x = -15; r.z = 11; r.sinkage = 0.9; r.sandStreak = 2;`,
    sols: `r.sol = 8;`,
  };
  for (const [name, code] of Object.entries(cases)) {
    await page.evaluate((code) => {
      const st = (window as any).__rover;
      st.getState().restart();
      const s = st.getState();
      const g = { ...s.game, rover: { ...s.game.rover } };
      const r = g.rover;
      const t = g.terrain;
      new Function('r', 't', 'g', code)(r, t, g);
      st.setState({ game: g });
    }, code);
    for (const k of ['5', 'w', 'w']) await page.keyboard.press(k);
    await page.keyboard.press('Enter');
    for (let i = 0; i < 80 && !['won', 'lost', 'downlink'].includes((await state()).phase); i++) await page.waitForTimeout(250);
    const end = await page.evaluate(() => (window as any).__rover.getState().game.rover.loseReason);
    console.log(`lose:${name} ->`, (await state()).phase, end);
    await page.waitForTimeout(500);
    await shot(`7-lose-${name}`);
  }
}

// Pause menu + exit returns to the archive.
await page.getByRole('button', { name: /Exit to archive|Back to/ }).first().click();
await page.waitForTimeout(1200);
console.log('url after exit', page.url());

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'console clean');
await ctx.close();
await browser.close();
