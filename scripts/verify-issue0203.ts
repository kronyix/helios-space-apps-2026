/** Smoke check of the Issue 02/03 motion comics: every panel's art and photos load,
 *  no console errors, Continue reaches hardware. Screens go to review/issue0203/. */
import { mkdirSync } from 'node:fs';
import { launch } from './review/browser.ts';

const BASE = process.env.REVIEW_URL ?? 'http://localhost:3000';
const OUT = 'review/issue0203';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const errors: string[] = [];
  const shots = new Set(['p01', 'p06', 'p11']);

  for (const issue of [2, 3]) {
    for (const vp of [{ n: '1440', w: 1440, h: 900 }, { n: '390', w: 390, h: 844 }]) {
      for (const reduced of [false, true]) {
        const ctx = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          reducedMotion: reduced ? 'reduce' : 'no-preference',
        });
        const page = await ctx.newPage();
        const tag = `i${issue}-${vp.n}${reduced ? '-rm' : ''}`;
        page.on('console', (m) => {
          if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('THREE.Clock'))
            errors.push(`[${tag}] ${m.type()}: ${m.text()}`);
        });
        page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
        await page.goto(`${BASE}/?stage=story&issue=${issue}&nowebgl`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        const ids: string[] = await page.$$eval('section[id^="p"]', (els) => els.map((e) => e.id));
        if (ids.length !== 11) errors.push(`[${tag}] expected 11 panels, got ${ids.length}`);

        for (const id of ids) {
          for (const attr of ['data-art-p', 'data-photo-p']) {
            const y = await page.evaluate(
              ([pid, a]) => {
                const el = document.getElementById(pid)!;
                const p = Number(el.getAttribute(a) || '0.3');
                return Math.round(el.offsetTop + Math.max(1, el.offsetHeight - innerHeight) * p);
              },
              [id, attr] as const,
            );
            await page.evaluate((yy) => window.scrollTo(0, yy), y);
            await page.waitForTimeout(250);
            if (!reduced && shots.has(id))
              await page.screenshot({ path: `${OUT}/${tag}-${id}-${attr.slice(5, -2)}.png` });
          }
          const broken = await page.evaluate(async (pid) => {
            const imgs = [...document.querySelectorAll<HTMLImageElement>(`#${pid} img`)];
            await Promise.all(imgs.map((i) => (i.complete ? null : i.decode().catch(() => null))));
            return imgs.filter((i) => i.currentSrc && i.naturalWidth === 0).map((i) => i.currentSrc);
          }, id);
          if (broken.length) errors.push(`[${tag}] #${id} broken images: ${broken.join(', ')}`);
        }

        const cont = page.locator('.issue-continue-btn');
        if (!(await cont.isVisible())) errors.push(`[${tag}] Continue button not visible on last panel`);
        else if (vp.n === '1440' && !reduced) {
          await cont.click();
          await page.waitForTimeout(1500);
          if (!page.url().includes('hardware') && (await page.locator('.issue-continue-btn').count()))
            errors.push(`[${tag}] Continue did not leave the story`);
        }
        await ctx.close();
        console.log(`[done] ${tag}`);
      }
    }
  }
  await browser.close();
  if (errors.length) {
    console.log(`FAIL (${errors.length})\n${errors.slice(0, 30).join('\n')}`);
    process.exit(1);
  }
  console.log('PASS');
}
main();
