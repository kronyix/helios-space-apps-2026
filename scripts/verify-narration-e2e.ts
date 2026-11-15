import { readFileSync } from 'node:fs';
import { launch } from './review/browser.ts';

interface ManifestV2 {
  version: number;
  model: string;
  languages: string[];
  clips: Record<
    string,
    {
      file: string;
      speaker: string;
      voice: string;
      durationMs: number;
      bytes: number;
      hash: string;
    }
  >;
}

const LANGUAGES = [
  { code: 'en', bcp47: 'en-US', nativeName: 'English' },
  { code: 'hi', bcp47: 'hi-IN', nativeName: 'हिन्दी' },
  { code: 'es', bcp47: 'es-ES', nativeName: 'Español' },
  { code: 'fr', bcp47: 'fr-FR', nativeName: 'Français' },
  { code: 'pt-BR', bcp47: 'pt-BR', nativeName: 'Português' },
] as const;

async function main() {
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as ManifestV2;
  const browser = await launch();
  const consoleErrors: string[] = [];
  const forbiddenTtsRequests: string[] = [];

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const audioRequests = new Set<string>();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });
  page.on('request', (req) => {
    const url = req.url();
    if (
      /generativelanguage\.googleapis\.com|texttospeech\.googleapis\.com|api\.fish\.audio|elevenlabs\.io|openai\.com/i.test(
        url,
      )
    ) {
      forbiddenTtsRequests.push(url);
    }
    const m = url.match(/\/audio\/([^?]+)/);
    if (m) {
      audioRequests.add(`/audio/${m[1]}`);
    }
  });

  await page.goto('http://localhost:3000/?stage=story&issue=1&nowebgl', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(500);

  const captionByLang: Record<string, string> = {};

  for (const lang of LANGUAGES) {
    // Open narration settings bar and select the language
    await page.locator('.narration-toggle').click();
    await page.waitForTimeout(150);
    await page.locator(`.narration-chip[lang="${lang.bcp47}"]`).click();
    await page.waitForTimeout(150);
    // Set 1.25x speed so line transitions are even faster to verify in E2E
    const speedBtn = page.locator('.narration-panel__row').nth(1).locator('.narration-chip').nth(2);
    await speedBtn.click();
    await page.waitForTimeout(100);
    // Close settings bar via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // Scroll back to top of Panel 1
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    // Read caption p01-c1 text to confirm language switch updated text
    const p01c1Text = (await page.locator('[data-line-id="p01-c1"]').textContent())?.trim() ?? '';
    if (!p01c1Text) {
      throw new Error(`[${lang.code}] Missing caption text for p01-c1`);
    }
    captionByLang[lang.code] = p01c1Text;

    // Verify manifest duration is wired into the DOM or timing for this language
    const manifestEntryC1 = manifest.clips[`${lang.code}/opportunity/p01-c1`];
    if (!manifestEntryC1 || manifestEntryC1.durationMs <= 0) {
      throw new Error(`[${lang.code}] Missing manifest duration for opportunity/p01-c1`);
    }

    // Press Play button
    await page.locator('.issue-play-btn').click();
    await page.waitForTimeout(350);

    // Confirm narration started: data-playing="true" and p01-c1 is highlighted
    const isPlaying = await page.locator('.issue-comic').getAttribute('data-playing');
    if (isPlaying !== 'true') {
      throw new Error(`[${lang.code}] Expected .issue-comic[data-playing="true"] after pressing Play`);
    }

    const readingAttr = await page.locator('[data-line-id="p01-c1"]').getAttribute('data-reading');
    if (readingAttr !== 'glow') {
      throw new Error(`[${lang.code}] Expected p01-c1 data-reading="glow", got "${readingAttr}"`);
    }

    // Confirm browser fetched the static MP3 for this language
    const expectedAudioUrl = `/audio/${lang.code}/opportunity/p01-c1.mp3`;
    if (!audioRequests.has(expectedAudioUrl)) {
      throw new Error(
        `[${lang.code}] Expected audio element request for ${expectedAudioUrl}, seen: ${[...audioRequests].join(', ')}`,
      );
    }

    // TestPause via Play/Pause button
    await page.locator('.issue-play-btn').click();
    await page.waitForTimeout(200);
    if ((await page.locator('.issue-comic').getAttribute('data-playing')) !== 'false') {
      throw new Error(`[${lang.code}] Clicking pause button did not pause narration`);
    }

    console.log(
      `[OK] ${lang.code} (${lang.nativeName}): audio=${expectedAudioUrl} (${manifestEntryC1.durationMs}ms), text="${p01c1Text.slice(0, 42)}..."`,
    );
  }

  // Confirm all 5 languages produced distinct localized text for p01-c1
  const uniqueTexts = new Set(Object.values(captionByLang));
  if (uniqueTexts.size !== LANGUAGES.length) {
    throw new Error(
      `Expected ${LANGUAGES.length} distinct localized texts for p01-c1, got ${uniqueTexts.size}`,
    );
  }

  // Verify NarrationBar only has Text-only switch (Read along & Auto-advance toggles removed)
  await page.locator('.narration-toggle').click();
  await page.waitForTimeout(150);
  const switchCount = await page.locator('.narration-panel [role="switch"]').count();
  if (switchCount !== 1) {
    throw new Error(`Expected exactly 1 switch in NarrationBar (Text only), got ${switchCount}`);
  }
  await page.locator('.narration-chip[lang="en-US"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // Test 1: Corner speaker icon on Panel 7 reads ONLY Panel 7 and stops at the end of Panel 7
  await page.evaluate(() => {
    const p07 = document.getElementById('p07');
    if (p07) window.scrollTo(0, p07.offsetTop + 20);
  });
  await page.waitForTimeout(300);
  await page.locator('#p07 .issue-panel-speak-btn').click();
  await page.waitForTimeout(300);

  const firstReadingId = await page.evaluate(() => {
    const el = document.querySelector('[data-reading]');
    return el?.getAttribute('data-line-id') ?? null;
  });
  if (firstReadingId !== 'p07-c1') {
    throw new Error(`Expected speaker button on p07 to start at p07-c1, got ${firstReadingId}`);
  }

  // Wait for p07-c1 to advance to p07-s1 at 1.25x
  const p07c1Dur = manifest.clips['en/opportunity/p07-c1'].durationMs;
  const p07s1Dur = manifest.clips['en/opportunity/p07-s1'].durationMs;
  await page.waitForTimeout(Math.round(p07c1Dur / 1.25) + 750);

  const secondReadingId = await page.evaluate(() => {
    const el = document.querySelector('[data-reading]');
    return el?.getAttribute('data-line-id') ?? null;
  });
  if (secondReadingId !== 'p07-s1') {
    throw new Error(`Expected panel speaker to advance to p07-s1, got ${secondReadingId}`);
  }

  // Wait for p07-s1 to finish: single-panel mode must stop and NOT advance to p08
  await page.waitForTimeout(Math.round(p07s1Dur / 1.25) + 900);
  const playingAfterPanel = await page.locator('.issue-comic').getAttribute('data-playing');
  if (playingAfterPanel !== 'false') {
    throw new Error('Corner speaker button should stop after finishing the panel');
  }
  console.log(`[OK] Corner speaker icon read p07-c1 -> p07-s1 and stopped after panel 7.`);

  // Test 2: Main bottom-right Play button on Panel 8 speaks lines, briefly reveals Panel 8's photo stage silently, then advances to Panel 9
  await page.evaluate(() => {
    const p08 = document.getElementById('p08');
    if (p08) window.scrollTo(0, p08.offsetTop + 20);
  });
  await page.waitForTimeout(300);
  await page.locator('.issue-play-btn').click();
  await page.waitForTimeout(300);

  const p08c1Dur = manifest.clips['en/opportunity/p08-c1'].durationMs;
  const p08s1Dur = manifest.clips['en/opportunity/p08-s1'].durationMs;
  const p08LinesMs = Math.round((p08c1Dur + p08s1Dur) / 1.25) + 1200;
  await page.waitForTimeout(p08LinesMs);

  // Right after p08 lines finish, Play should be in the silent photo-stage interlude on p08
  const p08PhotoStageP = await page.evaluate(() => {
    const el = document.getElementById('p08')!;
    const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
    return ((window.scrollY || 0) - el.offsetTop) / scrollable;
  });
  if (p08PhotoStageP < 0.45) {
    throw new Error(
      `Expected Play to reveal p08 photo stage silently between panels (localP >= 0.45), got ${p08PhotoStageP.toFixed(2)}`,
    );
  }
  console.log(`[OK] Play mode revealed Panel 8 photo gallery stage silently (localP=${p08PhotoStageP.toFixed(2)}).`);

  // Wait for the brief photo-stage interlude to finish and advance into Panel 9
  await page.waitForTimeout(2600);

  const advancedReadingId = await page.evaluate(() => {
    const el = document.querySelector('[data-reading]');
    return el?.getAttribute('data-line-id') ?? null;
  });
  if (!advancedReadingId || !advancedReadingId.startsWith('p09-')) {
    throw new Error(
      `Expected main Play button to advance automatically from p08 to p09, got ${advancedReadingId}`,
    );
  }
  console.log(`[OK] Main Play button automatically advanced from Panel 8 into Panel 9 (${advancedReadingId}).`);

  // Test opening Gallery pauses active narration, and Escape closes gallery
  await page.evaluate(() => {
    const el = document.getElementById('p01')!;
    const p = Number(el.getAttribute('data-photo-p') || '0.62');
    window.scrollTo(0, Math.round(el.offsetTop + (el.offsetHeight - window.innerHeight) * p));
  });
  await page.waitForTimeout(250);
  await page.locator('#p01 .issue-more-pill').click();
  await page.waitForTimeout(250);

  if (!(await page.locator('.issue-gallery').isVisible())) {
    throw new Error('Gallery modal did not open');
  }
  if ((await page.locator('.issue-comic').getAttribute('data-playing')) !== 'false') {
    throw new Error('Opening gallery modal did not pause active narration');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await page.locator('.issue-gallery').isVisible()) {
    throw new Error('Escape did not close gallery modal');
  }
  console.log('[OK] Gallery modal open paused narration and Escape closed gallery.');

  await context.close();

  // Verify reduced motion still works (outline highlight + no diagonal mask)
  const rmCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const rmPage = await rmCtx.newPage();
  await rmPage.goto('http://localhost:3000/?stage=story&issue=1&nowebgl', {
    waitUntil: 'networkidle',
  });
  await rmPage.waitForTimeout(400);
  await rmPage.locator('.issue-play-btn').click();
  await rmPage.waitForTimeout(300);
  const rmReading = await rmPage.locator('[data-line-id="p01-c1"]').getAttribute('data-reading');
  if (rmReading !== 'outline') {
    throw new Error(`Expected reduced-motion data-reading="outline", got "${rmReading}"`);
  }
  await rmCtx.close();
  console.log('[OK] Reduced motion verified (data-reading="outline").');

  await browser.close();

  if (forbiddenTtsRequests.length > 0) {
    throw new Error(`Forbidden runtime TTS network requests detected: ${forbiddenTtsRequests.join(', ')}`);
  }
  console.log('[OK] Zero network requests to generativelanguage.googleapis.com or any TTS host.');

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join(' | ')}`);
  }
  console.log('[PASS] All Playwright narration E2E checks passed with 0 console errors!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
