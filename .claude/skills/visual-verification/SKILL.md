---
name: visual-verification
description: How to verify UI and 3D changes in a real browser (Playwright screenshots, console capture, viewports, reduced motion, no-WebGL). Use before claiming any visual or interaction fix works.
---

# Visual verification

A passing build proves nothing visual. Check every change in a browser.

- Run the dev server (`npm run dev`) or the production build (`npm run build && npm run preview`). Use the production preview for performance numbers.
- Playwright: the installed browser revision may lag the package. If launch fails, pass `executablePath` to the cached `~/.cache/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell`. Software GL needs `--use-angle=swiftshader --enable-unsafe-swiftshader`, and it is slow, so wait 6–10 s for scenes.
- Viewports: 1440×900, 1920×1080, 1024×768 and 390×844.
- Also run with `reducedMotion: 'reduce'` and with `?nowebgl`.
- Capture `console` errors and warnings, plus `pageerror`. Any of them is a defect, except the known `THREE.Clock` deprecation from R3F.
- Hotspot markers move during the idle turntable. Click them with `force: true`, or stop the rotation first.
- Store review captures under `review/<round>/`. Videos (`*.webm`) are git-ignored.
