# Pixel-comic pass (branch `design/pixel-comic`)
**Changed:** IBM Plex Mono + Space Grotesk removed (code, package.json, comic SVG font names); Silkscreen self-hosted (400/700, 400 woff2 preloaded) with no-smoothing rules; comic-panel tab sidebar (152 px, fixed tilts, Lucide icons, real `<a>` links, `aria-current`) and a mobile bottom bar under 768 px (5 tabs + More → Drive, Credits); HEL☀OS wordmark, mark, mono/dark variants, favicon SVG + 32/180/512 PNGs + manifest (`scripts/brand/outline-text.mjs`, letters outlined to paths).
**Fonts:** Luckiest Guy: screen/issue cover titles, loader title, game titles, win/lose banners, sidebar tabs. Silkscreen: kickers, labels, headings, buttons, pills, data/HUD, chapter track, globe labels (12/16/24/32/40 px only; audit of rendered text found no off-scale sizes on Home, Issue, Hardware, Badges). Inter: lede, paragraphs, captions, balloons, credits, long game messages.
**Verified:** `tsc -b` + `npm run build` pass; 0 console errors at 1440×900 and 390×844; keyboard focus ring visible; active tab correct on Archive/Story/Hardware/Badges; More menu opens/closes; favicon links resolve. Screens: `review/pixel-comic/`.
**Remaining:**
- Hindi falls back to Inter for Silkscreen/Luckiest roles (neither font has Devanagari).
- Mobile tab labels are 10 px Luckiest Guy so "Hardware" fits in 6 columns.
- Fixed in follow-up: Jezero label flips clear of the issue list; phone globe starts below the title; warm rust backdrop replaces flat black; Home stat cards removed.
- Chapter timeline is still hidden below 900 px; the nav switch moved to 768 px, so 768–899 px shows the sidebar plus the stacked layout.
- Comic panel SVGs name Silkscreen/Luckiest, but `<img>` SVGs can't load web fonts, so they still render with system fallbacks (unchanged look).
