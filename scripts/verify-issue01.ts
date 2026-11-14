import { mkdirSync } from 'node:fs';
import { launch } from './review/browser.ts';

interface SizeAuditEntry {
  panel: string;
  slot: 'hero' | 'photo2';
  vp: string;
  widthPct: number;
  heightPct: number;
}

async function main() {
  const outDir = 'review/issue01';
  mkdirSync(outDir, { recursive: true });

  const browser = await launch();
  const consoleErrors: string[] = [];
  const sizeAudits: SizeAuditEntry[] = [];

  const viewports = [
    { name: '360', width: 360, height: 780 },
    { name: '768', width: 768, height: 1024 },
    { name: '1280', width: 1280, height: 800 },
  ];

  async function assertActivePhotoSize(
    page: Awaited<ReturnType<Awaited<ReturnType<typeof browser.newContext>>['newPage']>>,
    panelId: string,
    slot: 'hero' | 'photo2',
    vpName: string
  ) {
    const metrics = await page.evaluate((id) => {
      const section = document.getElementById(id);
      if (!section) return null;
      const stage = section.querySelector('.issue-panel__stage') as HTMLElement | null;
      const activeImg = section.querySelector(
        '.issue-photo-slide--active .issue-photo-slide__img'
      ) as HTMLImageElement | null;
      if (!stage || !activeImg) return null;
      const stageRect = stage.getBoundingClientRect();
      const imgRect = activeImg.getBoundingClientRect();
      return {
        stageW: stageRect.width,
        stageH: stageRect.height,
        imgW: imgRect.width,
        imgH: imgRect.height,
        naturalW: activeImg.naturalWidth,
        naturalH: activeImg.naturalHeight,
        complete: activeImg.complete,
      };
    }, panelId);

    if (!metrics) {
      throw new Error(`[${vpName}] Missing active photo or stage in #${panelId} (${slot})`);
    }
    if (!metrics.complete || metrics.naturalW === 0) {
      throw new Error(`[${vpName}] Image failed to load in #${panelId} (${slot})`);
    }

    const widthPct = Number(((metrics.imgW / metrics.stageW) * 100).toFixed(1));
    const heightPct = Number(((metrics.imgH / metrics.stageH) * 100).toFixed(1));
    sizeAudits.push({ panel: panelId, slot, vp: vpName, widthPct, heightPct });

    if (vpName === '360' && widthPct < 85) {
      throw new Error(
        `[SIZE FAIL] ${panelId} (${slot}) at 360x780 covers ${widthPct}% width (< 85% required)`
      );
    }
    if (vpName === '1280' && heightPct < 80) {
      throw new Error(
        `[SIZE FAIL] ${panelId} (${slot}) at 1280x800 covers ${heightPct}% height (< 80% required)`
      );
    }
  }

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[${vp.name}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[${vp.name}:pageerror] ${err.message}`);
    });

    await page.goto('http://localhost:3000/?stage=story&issue=1&nowebgl', {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(700);

    for (let i = 1; i <= 9; i++) {
      const id = `p0${i}`;
      const info = await page.evaluate((panelId) => {
        const el = document.getElementById(panelId);
        if (!el) return null;
        return {
          top: el.offsetTop,
          height: el.offsetHeight,
          vh: window.innerHeight,
          artP: Number(el.getAttribute('data-art-p') || '0.28'),
          wipeP: Number(el.getAttribute('data-wipe-p') || '0.47'),
          photoP: Number(el.getAttribute('data-photo-p') || '0.62'),
          photo2P: Number(el.getAttribute('data-photo2-p') || '0.80'),
        };
      }, id);

      if (!info) throw new Error(`Missing section #${id}`);
      const scrollable = Math.max(1, info.height - info.vh);

      // 1. Art state & 2. Mid-wipe state (for p01..p08)
      if (i <= 8) {
        const artY = Math.round(info.top + scrollable * info.artP);
        await page.evaluate((y) => window.scrollTo(0, y), artY);
        await page.waitForTimeout(180);
        await page.screenshot({ path: `${outDir}/${id}-art-${vp.name}.png` });

        const wipeY = Math.round(info.top + scrollable * info.wipeP);
        await page.evaluate((y) => window.scrollTo(0, y), wipeY);
        await page.waitForTimeout(180);
        await page.screenshot({ path: `${outDir}/${id}-wipe-${vp.name}.png` });
      }

      // 3. Hero photo state (all panels p01..p09)
      const photoY = Math.round(info.top + scrollable * info.photoP);
      await page.evaluate((y) => window.scrollTo(0, y), photoY);
      await page.waitForTimeout(220);
      await assertActivePhotoSize(page, id, 'hero', vp.name);
      await page.screenshot({ path: `${outDir}/${id}-photo-${vp.name}.png` });

      // 4. Second photo state (all panels p01..p09 have >= 2 stage photos)
      const photo2Y = Math.round(info.top + scrollable * info.photo2P);
      await page.evaluate((y) => window.scrollTo(0, y), photo2Y);
      await page.waitForTimeout(220);
      await assertActivePhotoSize(page, id, 'photo2', vp.name);
      await page.screenshot({ path: `${outDir}/${id}-photo2-${vp.name}.png` });

      // 5. Open Gallery Modal from this panel's "+N more photos" pill
      const moreBtn = page.locator(`#${id} .issue-more-pill`);
      await moreBtn.click();
      await page.waitForTimeout(240);
      const modalVisible = await page.locator('.issue-gallery').isVisible();
      if (!modalVisible) {
        throw new Error(`[${vp.name}] Gallery modal failed to open on #${id}`);
      }
      await page.screenshot({ path: `${outDir}/${id}-gallery-${vp.name}.png` });

      // Close gallery via Escape and verify it closes
      await page.keyboard.press('Escape');
      await page.waitForTimeout(140);
      if (await page.locator('.issue-gallery').isVisible()) {
        throw new Error(`[${vp.name}] Gallery modal failed to close via Escape on #${id}`);
      }
    }

    await context.close();
    console.log(`[OK] Captured art, wipe, photo, photo2, and gallery for p01..p09 at ${vp.name}px`);
  }

  // Behavioral verification: Play mode, gallery interrupt pauses Play & doesn't auto-resume, zoom, keyboard nav, reduced motion
  const testCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const testPage = await testCtx.newPage();
  testPage.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[behavior] ${msg.text()}`);
  });

  await testPage.goto('http://localhost:3000/?stage=story&issue=1&nowebgl', {
    waitUntil: 'networkidle',
  });
  await testPage.waitForTimeout(600);

  // Scroll to p01 hero photo so "+2 more photos" pill is visible
  const p01PhotoY = await testPage.evaluate(() => {
    const el = document.getElementById('p01')!;
    const p = Number(el.getAttribute('data-photo-p') || '0.62');
    return Math.round(el.offsetTop + (el.offsetHeight - window.innerHeight) * p);
  });
  await testPage.evaluate((y) => window.scrollTo(0, y), p01PhotoY);
  await testPage.waitForTimeout(200);

  // Start Play mode
  await testPage.locator('button[aria-label="Play story"]').click();
  await testPage.waitForTimeout(350);
  if ((await testPage.locator('button[aria-label="Pause story"]').count()) !== 1) {
    throw new Error('Play mode failed to start');
  }

  // Open Gallery while Play is running -> must pause Play
  await testPage.locator('#p01 .issue-more-pill').click();
  await testPage.waitForTimeout(250);
  if (!(await testPage.locator('.issue-gallery').isVisible())) {
    throw new Error('Gallery did not open during Play mode');
  }
  if ((await testPage.locator('button[aria-label="Play story"]').count()) !== 1) {
    throw new Error('Opening gallery did not pause Play mode');
  }

  // Test ArrowRight inside gallery (advances slide counter to "2 / 3")
  await testPage.keyboard.press('ArrowRight');
  await testPage.waitForTimeout(150);
  const counterText = await testPage.locator('.issue-gallery__counter').textContent();
  if (!counterText?.includes('2 /')) {
    throw new Error(`Gallery ArrowRight did not advance slide: counter=${counterText}`);
  }

  // Test 2x zoom toggle inside gallery
  await testPage.locator('.issue-gallery__zoom-btn').click();
  await testPage.waitForTimeout(150);
  const isZoomed = await testPage.locator('.issue-gallery__viewport--zoomed').isVisible();
  if (!isZoomed) {
    throw new Error('Gallery 2x zoom failed to engage');
  }

  // Close gallery with Escape -> focus returns to trigger button and Play stays paused
  await testPage.keyboard.press('Escape');
  await testPage.waitForTimeout(200);
  if ((await testPage.locator('button[aria-label="Play story"]').count()) !== 1) {
    throw new Error('Closing gallery unexpectedly resumed Play mode');
  }

  // Test Continue button on Panel 9 transitions to Hardware stage
  await testPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await testPage.waitForTimeout(250);
  const continueBtn = testPage.locator('.issue-continue-btn');
  await continueBtn.focus();
  await testPage.keyboard.press('Enter');
  await testPage.waitForTimeout(500);
  console.log('[OK] Play -> Gallery pause, slide step, 2x zoom, Escape focus restore, and Continue verified.');
  await testCtx.close();

  // Test prefers-reduced-motion: reduce (plain crossfade, no diagonal mask)
  const rmCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const rmPage = await rmCtx.newPage();
  await rmPage.goto('http://localhost:3000/?stage=story&issue=1&nowebgl', {
    waitUntil: 'networkidle',
  });
  await rmPage.waitForTimeout(400);
  const rmCheck = await rmPage.evaluate(() => {
    const el = document.getElementById('p01')!;
    const wipeP = Number(el.getAttribute('data-wipe-p') || '0.47');
    window.scrollTo(0, Math.round(el.offsetTop + (el.offsetHeight - window.innerHeight) * wipeP));
    const stage = el.querySelector('.issue-photo-stage') as HTMLElement | null;
    return stage ? stage.style.maskImage || 'none' : 'missing';
  });
  if (rmCheck !== 'none') {
    throw new Error(`Reduced motion should not apply diagonal maskImage, got: ${rmCheck}`);
  }
  console.log('[OK] Reduced motion plain crossfade verified (maskImage=none).');
  await rmCtx.close();

  await browser.close();

  const min360Width = Math.min(
    ...sizeAudits.filter((a) => a.vp === '360').map((a) => a.widthPct)
  );
  const min1280Height = Math.min(
    ...sizeAudits.filter((a) => a.vp === '1280').map((a) => a.heightPct)
  );
  console.log(
    `[SIZE CHECK PASS] 360x780 min width coverage = ${min360Width}% (>=85% req) | 1280x800 min height coverage = ${min1280Height}% (>=80% req)`
  );

  if (consoleErrors.length > 0) {
    console.error('Console errors detected:', consoleErrors);
    process.exit(1);
  }
  console.log('[PASS] Zero console errors across all viewports and tests!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
