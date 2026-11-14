/**
 * Shared Playwright launcher for review scripts.
 * Uses the real GPU through ANGLE (gl-egl) so frame rates mean something. If the
 * Playwright-pinned browser is missing, it falls back to any cached Chromium build.
 */
import { chromium, type Browser } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function cachedChrome(): string | undefined {
  for (const root of ['/ms-playwright', join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root)
      .filter((x) => /^(chromium|chromium_headless_shell)-\d+$/.test(x))
      .sort()
      .reverse()) {
      for (const rel of ['chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
        const p = join(root, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

export async function launch(opts: { software?: boolean } = {}): Promise<Browser> {
  const args = opts.software
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'];
  try {
    return await chromium.launch({ args });
  } catch {
    return chromium.launch({ executablePath: cachedChrome(), args });
  }
}

export const BASE = process.env.REVIEW_URL ?? 'http://localhost:4173';

export const VIEWPORTS = {
  '1440': { width: 1440, height: 900 },
  '1920': { width: 1920, height: 1080 },
  '1024': { width: 1024, height: 768 },
  '390': { width: 390, height: 844 },
} as const;
