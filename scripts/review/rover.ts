/**
 * Signal Delay Phase 3 automated E2E walkthrough, Story handoff check,
 * accessibility/viewport checks, 4x CPU throttle benchmark, and screenshot suite.
 *
 * Usage:
 *   REVIEW_URL=http://localhost:3000 npm run review:rover
 *   REVIEW_URL=http://localhost:3000 npx tsx scripts/review/rover.ts [1440|1280|768|390|360] [--reduced] [--nowebgl] [--lose]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Browser, BrowserContext, Page } from 'playwright';
import { BASE, launch } from './browser.ts';

const EXTRA_VIEWPORTS = {
  '1440': { width: 1440, height: 900 },
  '1280': { width: 1280, height: 800 },
  '768': { width: 768, height: 1024 },
  '390': { width: 390, height: 844 },
  '360': { width: 360, height: 640 },
} as const;

const OUT = 'review/phase3';
mkdirSync(OUT, { recursive: true });

interface PerfRow {
  label: string;
  tier: string;
  viewport: string;
  throttled4x: boolean;
  fps: number;
  p95FrameMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

function attachConsoleWatch(page: Page, problems: string[]) {
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const txt = m.text();
    if (/THREE\.Clock|THREE\.THREE\.Clock|GL Driver Message.*ReadPixels/.test(txt)) return;
    problems.push(`${m.type()}: ${txt}`);
  });
  page.on('pageerror', (e: Error) => problems.push(`pageerror: ${e.message}`));
}

async function dismissTutorialIfOpen(page: Page) {
  const skip = page.locator('.rd-coach__skip');
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(200);
  }
}

async function readRoverState(page: Page) {
  return page.evaluate(`(() => {
    const s = window.__rover && window.__rover.getState();
    return s ? {
      phase: s.phase,
      sol: s.game.rover.sol,
      battery: Math.round(s.game.rover.battery),
      x: s.game.rover.x,
      z: s.game.rover.z,
      loseReason: s.game.rover.loseReason
    } : null;
  })()`) as Promise<{
    phase: string;
    sol: number;
    battery: number;
    x: number;
    z: number;
    loseReason?: string;
  } | null>;
}

async function waitForPhase(page: Page, target: string | string[], timeoutMs = 15000) {
  const targets = Array.isArray(target) ? target : [target];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await readRoverState(page);
    if (st && targets.includes(st.phase)) return st;
    await page.waitForTimeout(150);
  }
  const last = await readRoverState(page);
  throw new Error(`Timed out waiting for phase ${targets.join('/')}; got ${last?.phase}`);
}

async function measureFpsAndInfo(page: Page, seconds = 2.5) {
  const perf = (await page.evaluate(`new Promise((resolve) => {
    const times = [];
    let last = performance.now();
    const end = last + ${seconds} * 1000;
    const step = (now) => {
      times.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(step);
      else {
        const sorted = [...times].sort((a, b) => a - b);
        const fps = Math.round((times.length / ${seconds}) * 10) / 10;
        const p95 = Math.round((sorted[Math.floor(sorted.length * 0.95)] || 0) * 10) / 10;
        resolve({ fps, p95FrameMs: p95 });
      }
    };
    requestAnimationFrame(step);
  })`)) as { fps: number; p95FrameMs: number };

  const gl = (await page.evaluate(`(() => {
    const g = window.__heliosGL;
    if (!g) return { calls: 0, triangles: 0, geometries: 0, textures: 0 };
    return {
      calls: g.info.render.calls,
      triangles: g.info.render.triangles,
      geometries: g.info.memory.geometries,
      textures: g.info.memory.textures,
    };
  })()`)) as { calls: number; triangles: number; geometries: number; textures: number };

  return { ...perf, ...gl };
}

async function checkLayoutAndTargets(page: Page, label: string) {
  return page.evaluate(`(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const docOverflow = document.documentElement.scrollWidth > vw + 1;
    const smallTargets = [];
    const btns = document.querySelectorAll('.rd-wrap button');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) {
        smallTargets.push((b.getAttribute('aria-label') || b.textContent || 'btn').trim() + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    }
    return { label: ${JSON.stringify(label)}, vw, vh, docOverflow, smallTargets };
  })()`) as Promise<{
    label: string;
    vw: number;
    vh: number;
    docOverflow: boolean;
    smallTargets: string[];
  }>;
}

async function runDesktopFlow(browser: Browser, problems: string[]) {
  const ctx = await browser.newContext({ viewport: EXTRA_VIEWPORTS['1280'] });
  const page = await ctx.newPage();
  attachConsoleWatch(page, problems);

  await page.goto(`${BASE}/play/rover-drive?fps&quality=high`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/1280x800-briefing.png` });

  await page.getByRole('button', { name: 'Start mission' }).click();
  await page.waitForTimeout(800);
  await dismissTutorialIfOpen(page);
  await page.waitForTimeout(600);

  for (const k of ['5', 'w', 'w', 'a', 'w']) await page.keyboard.press(k);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/1280x800-plan.png` });

  const layoutDesktop = await checkLayoutAndTargets(page, '1280x800-plan');

  // Test Plan interactive orbit (Alt+Arrow & wheel/zoom) + Reset view
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Equal');
  await page.waitForTimeout(350);
  const resetBtn = page.getByRole('button', { name: 'Reset Plan camera view' });
  const resetAppeared = await resetBtn.isVisible().catch(() => false);
  await page.screenshot({ path: `${OUT}/1280x800-plan-orbit.png` });
  if (resetAppeared) {
    await resetBtn.click();
    await page.waitForTimeout(350);
  }
  const resetCleared = !(await resetBtn.isVisible().catch(() => false));

  // Uplink night cycle + stars + antenna beacon
  console.log('[review] desktop: uplink -> executing -> downlink');
  await page.keyboard.press('Enter');
  await waitForPhase(page, 'uplink', 6000);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/1280x800-uplink-night.png` });

  // Wait for executing -> SolStartCard -> toggle 2x -> Skip (Space)
  await waitForPhase(page, 'executing', 8000);
  await page.screenshot({ path: `${OUT}/1280x800-executing-solcard.png` });

  const speedBtn = page.getByRole('button', { name: /Playback speed/i });
  await speedBtn.click();
  const speed2xPressed = await speedBtn.getAttribute('aria-pressed');
  await page.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/1280x800-executing.png` });

  await page.keyboard.press('Space');
  await waitForPhase(page, 'downlink', 5000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/1280x800-downlink.png` });

  // Hazard Lens + simulated Deuteranopia color-blind filter check
  await page.getByRole('button', { name: /Hazard lens/i }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/1280x800-hazards.png` });
  await page.evaluate(`(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = '__cb_svg';
    svg.style.position = 'fixed';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.innerHTML = '<filter id="__deut"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"/></filter>';
    document.body.appendChild(svg);
    document.documentElement.style.filter = 'url(#__deut)';
  })()`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/1280x800-deuteranopia.png` });
  await page.evaluate(`(() => {
    document.documentElement.style.filter = '';
    const el = document.getElementById('__cb_svg');
    if (el) el.remove();
  })()`);
  await page.getByRole('button', { name: /Hazard lens/i }).click();

  // Win flow -> PIA19113 finding card verification (clicking Skip button)
  await page.getByRole('button', { name: /Next sol/i }).click();
  await page.waitForTimeout(400);
  await page.evaluate(`(() => {
    const st = window.__rover;
    const s = st.getState();
    const t = s.game.terrain;
    st.setState({ game: { ...s.game, rover: { ...s.game.rover, x: t.target.x - 1, z: t.target.z - 1 } } });
  })()`);
  await page.keyboard.press('q');
  await page.keyboard.press('Enter');
  await waitForPhase(page, 'executing', 8000);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Skip drive playback' }).click();
  await waitForPhase(page, 'won', 5000);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/1280x800-win.png` });

  const winImgOk = await page.evaluate(`(() => {
    const img = document.querySelector('.rd-end-story__img');
    return Boolean(img && img.complete && img.naturalWidth > 0);
  })()`);

  // Pause menu volume + vibration check + 5x rapid restarts
  await page.getByRole('button', { name: 'Replay' }).click();
  await page.waitForTimeout(500);
  await dismissTutorialIfOpen(page);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/1280x800-pause.png` });
  await page.getByRole('button', { name: /Vibration:/ }).click();
  await page.getByRole('slider', { name: 'Master volume' }).fill('50');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(200);

  // 5x rapid Pause -> Restart mission
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    await page.getByRole('button', { name: 'Restart mission' }).click();
    await page.waitForTimeout(160);
    await dismissTutorialIfOpen(page);
  }
  await page.waitForTimeout(300);

  // Lose states (sand, battery, tipover, sols)
  const loseCases: Record<string, string> = {
    sand: `r.x = -15; r.z = 11; r.sinkage = 0.9; r.sandStreak = 2;`,
    battery: `r.battery = 2;`,
    tipover: `const c = t.crater; r.x = c.x - 12.5; r.z = c.z; r.heading = Math.PI / 2; g.terrain = { ...t, rocks: [] };`,
    sols: `r.sol = 8;`,
  };
  const loseResults: Record<string, string | undefined> = {};
  for (const [name, code] of Object.entries(loseCases)) {
    await page.evaluate(`((code) => {
      const st = window.__rover;
      st.getState().restart();
      const s = st.getState();
      const g = { ...s.game, rover: { ...s.game.rover } };
      new Function('r', 't', 'g', code)(g.rover, g.terrain, g);
      st.setState({ game: g });
    })(${JSON.stringify(code)})`);
    await page.waitForTimeout(150);
    for (const k of ['5', 'w', 'w']) await page.keyboard.press(k);
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'executing', 8000);
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    const st = await waitForPhase(page, ['lost', 'downlink'], 6000);
    loseResults[name] = `${st?.phase}:${st?.loseReason ?? 'none'}`;
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/1280x800-lose-${name}.png` });
  }

  await ctx.close();
  return {
    layoutDesktop,
    resetAppeared,
    resetCleared,
    speed2xPressed,
    winImgOk,
    loseResults,
  };
}

async function runStoryHandoff(browser: Browser, problems: string[]) {
  console.log('[review] story p05 handoff');
  const ctx = await browser.newContext({ viewport: EXTRA_VIEWPORTS['1280'] });
  const page = await ctx.newPage();
  attachConsoleWatch(page, problems);

  await page.goto(`${BASE}/?quality=low`);
  await page.waitForTimeout(1600);
  // Open Opportunity (first issue row) -> Story stage opens automatically
  await page.locator('.issue-row').first().click();
  await page.waitForTimeout(1400);

  // Jump directly to p05 inside Issue 01 using dot indicator
  const p05Dot = page.getByRole('button', { name: /Panel 5:/i });
  if (await p05Dot.isVisible().catch(() => false)) {
    await p05Dot.click();
    await page.waitForTimeout(800);
  }
  const handoffCard = page.locator('.issue-handoff');
  await handoffCard.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/story-p05-handoff.png` });

  const playBtn = page.getByRole('button', { name: /Drive the rover/i });
  const handoffVisible = await playBtn.isVisible().catch(() => false);
  let returnOnStory = false;
  let winBannerVisible = false;

  if (handoffVisible) {
    await playBtn.click();
    await page.getByRole('button', { name: 'Start mission' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(500);
    await dismissTutorialIfOpen(page);
    await page.evaluate(`(() => {
      const st = window.__rover;
      const s = st.getState();
      const t = s.game.terrain;
      st.setState({ game: { ...s.game, rover: { ...s.game.rover, x: t.target.x - 1, z: t.target.z - 1 } } });
    })()`);
    await page.keyboard.press('q');
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'executing', 10000);
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Skip drive playback' }).click();
    await waitForPhase(page, 'won', 6000);
    await page.waitForTimeout(500);

    await page.locator('.rd-card--end').getByRole('button', { name: /Back to the issue/i }).click();
    await page.waitForTimeout(1000);
    returnOnStory = await page.locator('.issue-handoff').isVisible().catch(() => false);
    winBannerVisible = await page.locator('.issue-handoff__outcome[data-won="true"]').isVisible().catch(() => false);
    await page.screenshot({ path: `${OUT}/story-p06-return.png` });
  }

  await ctx.close();
  return { handoffVisible, returnOnStory, winBannerVisible };
}

async function runResponsiveAndModes(browser: Browser, problems: string[]) {
  console.log('[review] responsive + 2d + reduced');
  const layoutReports = [];

  // 390x844 mobile portrait (Plan + Downlink)
  {
    const ctx = await browser.newContext({ viewport: EXTRA_VIEWPORTS['390'], hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    attachConsoleWatch(page, problems);
    await page.goto(`${BASE}/play/rover-drive?fps`);
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(700);
    await dismissTutorialIfOpen(page);
    for (const k of ['5', 'w', 'a', 'w']) await page.keyboard.press(k);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/390x844-plan.png` });
    layoutReports.push(await checkLayoutAndTargets(page, '390x844-plan'));

    await page.keyboard.press('Enter');
    await waitForPhase(page, 'executing', 8000);
    await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await waitForPhase(page, 'downlink', 5000);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/390x844-downlink.png` });
    layoutReports.push(await checkLayoutAndTargets(page, '390x844-downlink'));
    await ctx.close();
  }

  // 360x640 compact portrait
  {
    const ctx = await browser.newContext({ viewport: EXTRA_VIEWPORTS['360'], hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    attachConsoleWatch(page, problems);
    await page.goto(`${BASE}/play/rover-drive`);
    await page.waitForTimeout(1600);
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(600);
    await dismissTutorialIfOpen(page);
    await page.keyboard.press('5');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/360x640-plan.png` });
    layoutReports.push(await checkLayoutAndTargets(page, '360x640-plan'));
    await ctx.close();
  }

  // ?nowebgl 2D fallback (Plan + Downlink)
  {
    const ctx = await browser.newContext({ viewport: EXTRA_VIEWPORTS['1280'] });
    const page = await ctx.newPage();
    attachConsoleWatch(page, problems);
    await page.goto(`${BASE}/play/rover-drive?nowebgl`);
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(500);
    await dismissTutorialIfOpen(page);
    for (const k of ['5', 'w', 'w', 'a', 'w']) await page.keyboard.press(k);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/1280x800-2d-plan.png` });
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'executing', 8000);
    await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await waitForPhase(page, 'downlink', 5000);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/1280x800-2d-downlink.png` });
    await ctx.close();
  }

  // Reduced motion check: SolStartCard must NOT appear under reduced motion
  let solCardHiddenInReduced = false;
  {
    const ctx = await browser.newContext({ viewport: EXTRA_VIEWPORTS['1280'], reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    attachConsoleWatch(page, problems);
    await page.goto(`${BASE}/play/rover-drive`);
    await page.waitForTimeout(1400);
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(500);
    await dismissTutorialIfOpen(page);
    await page.keyboard.press('5');
    await page.keyboard.press('w');
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'executing', 8000);
    await page.waitForTimeout(200);
    solCardHiddenInReduced = !(await page.locator('.rd-sol-card').isVisible().catch(() => false));
    await ctx.close();
  }

  return { layoutReports, solCardHiddenInReduced };
}

async function runBenchmarks(browser: Browser, problems: string[]): Promise<PerfRow[]> {
  const rows: PerfRow[] = [];
  const configs: Array<{ viewport: '1280' | '390'; tier: 'high' | 'med' | 'low' }> = [
    { viewport: '1280', tier: 'high' },
    { viewport: '1280', tier: 'med' },
    { viewport: '1280', tier: 'low' },
    { viewport: '390', tier: 'med' },
    { viewport: '390', tier: 'low' },
  ];

  for (const cfg of configs) {
    console.log(`[review] bench ${cfg.viewport} ${cfg.tier}`);
    const isMob = cfg.viewport === '390';
    const ctx: BrowserContext = await browser.newContext({
      viewport: EXTRA_VIEWPORTS[cfg.viewport],
      hasTouch: isMob,
      isMobile: isMob,
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    attachConsoleWatch(page, problems);

    await page.goto(`${BASE}/play/rover-drive?fps&quality=${cfg.tier}`);
    await page.getByRole('button', { name: 'Start mission' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: 'Start mission' }).click();
    await page.waitForTimeout(500);
    await dismissTutorialIfOpen(page);
    for (const k of ['5', 'w', 'w', 'w']) await page.keyboard.press(k);
    await page.waitForTimeout(400);

    // Unthrottled planning measurement (with orbit nudge so active frames run cleanly)
    await page.keyboard.press('Alt+ArrowRight');
    const norm = await measureFpsAndInfo(page, 2.0);
    rows.push({
      label: `plan-${cfg.viewport}-${cfg.tier}`,
      tier: cfg.tier,
      viewport: `${EXTRA_VIEWPORTS[cfg.viewport].width}x${EXTRA_VIEWPORTS[cfg.viewport].height}`,
      throttled4x: false,
      ...norm,
    });

    // Trigger execution cleanly, then apply 4x CPU throttle during active Mars drive playback
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'executing', 10000);
    await page.waitForTimeout(250);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const thr = await measureFpsAndInfo(page, 2.0);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    rows.push({
      label: `exec-${cfg.viewport}-${cfg.tier}-4xcpu`,
      tier: cfg.tier,
      viewport: `${EXTRA_VIEWPORTS[cfg.viewport].width}x${EXTRA_VIEWPORTS[cfg.viewport].height}`,
      throttled4x: true,
      ...thr,
    });

    await ctx.close();
  }

  return rows;
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] ?? 'all';
const runAll = onlyArg === 'all';
const problems: string[] = [];
const browser = await launch();

const desktop = runAll || onlyArg === 'desktop' ? await runDesktopFlow(browser, problems) : null;
const handoff = runAll || onlyArg === 'handoff' ? await runStoryHandoff(browser, problems) : null;
const responsive = runAll || onlyArg === 'responsive' ? await runResponsiveAndModes(browser, problems) : null;
const perf = runAll || onlyArg === 'bench' ? await runBenchmarks(browser, problems) : null;

await browser.close();

const summary = {
  baseUrl: BASE,
  only: onlyArg,
  desktop,
  handoff,
  responsive,
  perf,
  problems,
};
writeFileSync(`${OUT}/metrics${runAll ? '' : `-${onlyArg}`}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

if (problems.length > 0) {
  console.error(`Found ${problems.length} console/page errors!`);
  process.exitCode = 1;
}
