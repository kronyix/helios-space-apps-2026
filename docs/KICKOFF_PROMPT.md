# BUILD, THEN CRITICALLY REVIEW — CHRONICLES OF THE SILENT PIONEERS

Team Helios | NASA Space Apps Challenge 2026

This is the **first and only kickoff prompt**. The repository may be empty. Work in two stages:

- **Stage A — Build.** Build the full application exactly as specified in `docs/MASTER_BUILD_PROMPT.md`, using the reference screenshot in `docs/reference/opportunity-ui.png` and the technical blueprint PDF in `docs/`. The master prompt is the spec. This file does not replace it.
- **Stage B — Review and refine.** When the build runs end to end, switch roles and tear it apart using the process below. Then rebuild the weak parts until it holds up.

Do not start Stage B on a half-built app, and do not stop after Stage A. A build that only "renders" is not done.

### Stage A exit gate (before switching to Stage B)

All of these must be true:

- All four application states exist and are reachable: orbital archive → narrative → hardware → reward.
- All three missions are wired through `src/data/missions.json`.
- All three mini-games can be played to success and to failure.
- The `.claude/skills/` files and `CLAUDE.md` exist with real content.
- `tsc --noEmit` and `npm run build` pass, and the app loads in the browser with no console errors.

Commit Stage A as `build: initial complete experience`. That commit is the "before" baseline for every Stage B comparison.

---

---

# STAGE B — CRITICAL REVIEW

## 0. ROLE

From here on you are three people at once:

1. **An extremely critical Awwwards jury member.** You have scored thousands of WebGL sites. You can tell within three seconds when a site came from a template or an AI. You give no credit for effort.
2. **A senior creative director.** You care about composition, restraint, rhythm, typography and story. You can say *why* something looks cheap.
3. **A principal frontend engineer.** You care about frame time, memory, correctness, accessibility and code that the team can maintain.

**Tone rules**

- Do not praise the work. Don't write "great job", "solid foundation" or "looks good overall".
- Every criticism needs evidence: a screenshot path, a file and line, a console log, an FPS reading or a measured number.
- If you can't prove a problem in the running app, don't list it.
- Be specific. "Typography feels weak" is useless. "The H1 on the orbital screen is 48px Inter Medium at the same weight as the body text, so there is no hierarchy, and it collides with the globe silhouette at 1440×900 (see `review/before/01-orbital-1440.png`)" is useful.

---

## 1. GROUND RULES

1. **Read first.** Before touching anything, read `CLAUDE.md`, every `.claude/skills/*/SKILL.md`, `src/data/missions.json`, the store and the three mission flows. Follow the project's conventions.
2. **Evidence before and after.** Every fix needs a "before" screenshot, the change, an "after" screenshot taken at the same viewport and state, and a one-line verdict.
3. **No claimed fixes without verification.** A fix is not done until you have seen it work in the running browser. A passing build is not proof of anything visual.
4. **Don't break what works.** Run `tsc --noEmit` and `npm run build` after each improvement. If either fails, fix it before moving on.
5. **`missions.json` stays the single source of truth.** Don't hardcode mission copy into components while refactoring.
6. **No fabricated facts.** If you rewrite narrative copy, every claim must trace to NASA/JPL sources or the blueprint. Run the `nasa-content-integrity` skill on any copy you change.
7. **No new heavy dependencies** unless a measured problem needs one. Explain the reason in the report.
8. **Work autonomously.** Don't stop to ask for approval between improvements. Stop only for a decision that is destructive or cannot be undone.

---

## 2. PHASE 0 — EVIDENCE HARNESS

Build the tooling before you judge anything.

1. Start the dev server. Also run `npm run build && npm run preview` and use the **production preview** for performance numbers.
2. Create `scripts/review/capture.ts` (Playwright) that visits every app state and saves screenshots to `review/<round>/`:
   - **Viewports:** 1440×900 (desktop), 1920×1080 (large desktop), 1024×768 (tablet), 390×844 (mobile).
   - **States:** loader (mid-load), orbital archive (idle), Mars focused, Moon focused, beacon hover, each mission's narrative (first and last panel, both illustrated and archival modes), each hardware viewer (default view plus every hotspot open), each mini-game (instructions, active, success, failure), each reward screen, and the achievements view.
   - **Also capture:** a `prefers-reduced-motion: reduce` run and a WebGL-disabled run, so you can check the fallback.
   - **Name files predictably**, for example `03-opportunity-hardware-hotspot-arm-1440.png`.
3. Record short videos (Playwright `recordVideo`) of:
   - loader → orbital → beacon click → narrative;
   - narrative → hardware;
   - game completion → reward.
   Transitions can't be judged from stills.
4. Capture the browser console on every state. Any error or warning is a defect.
5. Measure performance on the production preview:
   - FPS over 5 seconds on the orbital screen and on each hardware viewer, using a `requestAnimationFrame` sampler injected through Playwright. Use CPU throttling 4× as a stand-in for a student laptop.
   - `renderer.info` (draw calls, triangles, geometries, textures) per scene, and again after leaving a mission. Check that geometries and textures go back down; if they don't, resources are leaking.
   - Initial JS bundle size, time to first meaningful paint, and the size of each GLB and texture.
   - A Lighthouse run (performance and accessibility) on desktop and mobile.
6. Save all numbers to `review/<round>/metrics.json`.

---

## 3. PHASE 1 — THE AUDIT

Open the screenshots and videos and look at them yourself. Score each dimension from 1 to 10 against **Awwwards Site of the Day level**, not against "a hackathon project". A 7 means it would get through a jury pre-screen. Most first builds score 3–5. Score honestly.

For each dimension, give a score, 3–6 concrete findings with evidence, and the single worst offender.

### 1. Visual originality & art direction
- Does it look like a NASA Space Apps template, a SaaS dashboard or a Dribbble shot? Name the exact element that gives it away.
- Count the rounded glass cards per screen. More than three of the same treatment counts as dashboard aesthetics.
- Is the "NASA Archival Futurism" language actually visible? Look for archival grain, technical annotation, registration marks, mission-document typography and print-like textures. Or is it just dark mode plus orange?
- Does each mission have its own identity (palette shift, texture, panel grammar), or are they three copies of one layout?
- **Branding check:** the NASA insignia ("meatball") and logotype may not be used as site branding without NASA's permission. If either appears as the app's logo, flag it and replace it with a Team Helios mark. Keep "NASA" only in source credits.

### 2. Typography & hierarchy
- Can you tell the reading order of every screen within one second?
- Are Luckiest Guy / Silkscreen / Inter doing distinct jobs, or used interchangeably?
- Check the type scale ratio, line length (45–75 characters for body text), tracking on uppercase labels, and mono metadata alignment.
- Look for orphans, ragged comic captions, text over busy 3D with no contrast protection, and fluid type that breaks at 1024px.

### 3. 3D realism & environmental depth
- Is the globe a real lit sphere with normal/bump detail, a terminator line, atmosphere/rim, and believable specular response? Or is it a flat-lit texture ball?
- In the dioramas, check for ground contact shadows, terrain displacement, scattered rocks at several scales, aerial perspective (fog), and a horizon. Hardware floating on a flat plane is a fail.
- Is the Moon scene lit like the Moon (one hard sun, black sky, no atmospheric haze, very high contrast)? Is Mars lit like Mars (warm dusty haze, soft shadows, butterscotch sky)? Mixing them up is a credibility failure.
- Are placeholder models obviously placeholders? Are they at least art-directed (correct proportions, PBR materials, bevels, panel-line detail) and labeled as such in the documentation?

### 4. Lighting, materials & camera
- Check renderer setup: color space sRGB, tone mapping ACES Filmic or AgX with a tuned exposure, physically correct lights, and an environment map for reflections.
- Materials: is the Kapton gold foil crinkled and anisotropic-looking, or flat yellow? Do the solar arrays read as cells under dust? Do the carbon-fiber rotor blades show a weave or sheen?
- Camera: check field of view (tight FOV, around 30–40°, reads as cinematic; wide FOV reads as a game engine), focal targets, damping, and orbit limits (no going under the ground). Is camera motion eased, or does it snap?

### 5. Animation quality & timing
- Is there a shared motion system (duration and easing tokens), or ad-hoc values per component?
- Transitions between states: is there continuity (the camera dives into the beacon and the narrative emerges from that point), or just a cross-fade or hard cut?
- Look for things that animate for no reason, things that should animate but pop, staggered reveals that drag past about 600ms total, and scroll-jacking that fights the user.
- Is reduced motion respected everywhere, including GSAP timelines, Lenis and camera tweens?

### 6. Interaction quality
- Click **every** control. List every one that does nothing, does the wrong thing, or gives no feedback.
- Hotspots: are they findable? Do hover, focus and active states exist? Does the camera actually move to frame the part? Does clicking off close the hotspot?
- Globe: drag inertia, touch rotate, pinch zoom, zoom limits, and beacon hit areas large enough for a finger (44px or more).
- Keyboard: can the whole experience be completed with Tab, Enter, Space and arrow keys, including the globe and the games?

### 7. Mission storytelling
- Does each issue have a narrative arc (setup → struggle → discovery → legacy), or is it a fact sheet in comic panels?
- Does the illustrated ↔ archival toggle compare the same moment, or just swap unrelated images?
- Is every archival image credited (NASA/JPL-Caltech, etc.) with its source link?
- Content integrity checks:
  - The blueprint attaches Spirit's locked right-front wheel and the silica discovery to `opportunity.glb`. Spirit and Opportunity were twin rovers, so the shared model is fine, but the copy and hotspot must say clearly that the wheel and silica story belong to **Spirit**, while the hematite "blueberries" belong to **Opportunity**.
  - Keep the blueprint values: 21.55 kg of lunar samples, about 2.5 s laser round trip, 2,537 RPM target.

### 8. Mini-game functionality
For **each** of `spectrometer_scan`, `laser_bounce` and `rpm_throttle`, play it to success **and** to failure, using mouse, touch emulation and keyboard. Check:
- instructions → start → active → timer (15 s per the blueprint) → score → success/fail → retry → reward;
- that the scoring is actually computed from player input, not hardcoded;
- edge cases: double-clicking start, leaving mid-game, resizing mid-game, a background tab pausing the timer, and finishing at exactly 0.0 s;
- that it teaches the science (hematite spectral signature; light-time to the Moon; the rotor speed vs. power trade-off in thin air).

### 9. Responsive behavior
- At 390px, is it a deliberately designed single-column story, or the desktop squeezed down?
- Do the comic panels reflow into a vertical reading order that still makes sense?
- Do 3D canvases get a lower DPR (`dpr={[1, 1.5]}`), fewer particles and simpler shadows on mobile?
- Look for horizontal overflow, overlapping fixed UI, unreachable controls, and safe-area issues with notches.

### 10. Performance & loading
- Is there one canvas per state, or several running at the same time?
- Are mission GLBs and textures lazy-loaded through dynamic imports and `useGLTF.preload` only when needed? Is each model under 3 MB? Are textures KTX2 or WebP at sensible sizes?
- Is the loader honest (real `useProgress`), and does it feel crafted, or is it a spinner?
- Are resources disposed on unmount? Check `renderer.info` before and after.
- Are there React re-render storms? Profile the store subscriptions and use selectors.

---

## 4. PHASE 2 — THE TOP 15

From the audit, pick the **15 most important improvements**, ranked by combined visual and functional impact. Weight them toward these priorities, in this order:

1. Making the **first screen unforgettable**.
2. Improving the **realism of the 3D environments**.
3. **Eliminating generic dashboard aesthetics.**
4. Making **transitions feel cinematic**.
5. **Visual consistency** across all three missions, while each keeps its own identity.
6. Making **every interactive element genuinely functional**.

Broken functionality always ranks above polish. A mini-game that can't be completed is #1 regardless.

Write `review/TOP15.md` as a table:

| # | Improvement | Dimension(s) | Evidence | Why it matters to a juror | Acceptance criteria (measurable / visible) | Effort (S/M/L) |
|---|---|---|---|---|---|---|

Acceptance criteria must be checkable. For example: "Orbital screen holds ≥ 55 FPS at 4× CPU throttle", "At 1440×900 the title lockup, globe and primary call to action form one composition with nothing overlapping", or "Beacon click → narrative transition is one continuous camera move of 1.2–1.8 s with no blank frame".

### Directions to consider (not a checklist; use the ones the evidence supports)

**First screen**
- Replace any "hero + cards" layout with a single composed frame: a huge typographic lockup ("CHRONICLES OF THE SILENT PIONEERS" set as an archival title plate), a lit globe partly cropped by the frame edge, and one clear way in.
- Turn the loader into a "transmission acquisition" sequence driven by real load progress: signal noise resolving into the title, then the stars, then the globe's terminator line sweeping into light. Keep it under 3 seconds once assets are cached.
- Use a slow, deliberate camera drift. Draw the beacons as thin technical reticles with mono coordinates that resolve on hover, not as glowing dots.

**3D realism**
- Mars: displaced terrain from a heightmap or noise, three scales of instanced rocks, height fog tinted to the sky, a warm low key light with a long soft shadow, and a dust layer on horizontal faces.
- Moon: one hard key light, no fill except faint earthshine, a pure black sky, crisp shadows, regolith with high-frequency normal detail, and Earth in the sky (which the laser game needs anyway).
- Ground contact: `ContactShadows` or baked AO under the hardware, so it never floats.
- Restrained post-processing only: tone mapping, subtle bloom on genuinely emissive items, vignette, and film grain that ties the scene to the archival look. No chromatic aberration.

**Killing the dashboard look**
- Fewer containers. Let the 3D be the layout. Info should sit on the scene as technical annotation (leader lines, mono labels, hairline rules), not in boxes.
- One surface treatment for the rare panels that are needed. Vary the composition between missions instead of repeating card grids.
- Comic panels should use real panel grammar: gutters, bleed panels, irregular frames, captions vs. speech balloons, and an issue cover per mission.

**Cinematic transitions**
- Use one shared motion token file (durations, easings) and route every GSAP and Framer Motion value through it.
- Orbital → narrative: the camera dives to the beacon, a flash of archival grain, then the issue cover assembles from that point.
- Narrative → hardware: the last comic panel's illustration dissolves into the live 3D scene from the same angle.
- Game complete → reward: the game freezes, a signal-lock beat, then the artifact card materializes. The reward should be earned through timing, not a modal pop-up.

**Mission identity** (same system, different voice)
- Issue 01 Opportunity & Spirit: rust and ochre, field-geology notebook textures, spectrometer graph paper.
- Issue 02 Apollo 11: high-contrast silver and black, 1969 technical-manual typography, Kapton gold as the only accent.
- Issue 03 Ingenuity: Jezero tans, flight-log telemetry, thin blue-white avionics accents.

---

## 5. PHASE 3 — IMPLEMENT

Work through the 15 improvements in rank order. For each one:

1. Re-read the relevant `.claude/skills/*/SKILL.md`.
2. Implement it in small, reviewable commits (one improvement per commit, message `review(#N): <summary>`).
3. Run `tsc --noEmit` and `npm run build`.
4. Re-run the capture script for the affected states and viewports, into `review/round-N/`.
5. Compare before and after side by side. Check every acceptance criterion against the running app.
6. Write a verdict in `review/TOP15.md`: **VERIFIED** (with screenshot paths and metrics), **PARTIAL** (what's still missing), or **REVERTED** (why).

If a fix makes something else worse (an FPS drop, a layout break at another viewport, a console error), it isn't done.

---

## 6. PHASE 4 — ITERATE

After all 15 improvements, run the full Phase 1 audit again on fresh captures, with fresh eyes.

- Re-score all 10 dimensions.
- Write a new ranked list of what is now the weakest.
- Keep looping: improve, verify, re-audit.

**Exit criteria** (all must hold):

- No dimension below 7, and the first screen at 8 or above.
- Every interactive control works, verified by clicking it in the browser.
- All three mini-games can be completed and failed with mouse, touch and keyboard.
- Zero console errors in every captured state.
- At least 55 FPS on the orbital and hardware scenes at 4× CPU throttle on desktop. No GPU memory growth after visiting all three missions twice.
- Lighthouse accessibility at 95 or above; performance at 80 or above on mobile.
- Reduced-motion and no-WebGL fallbacks both work end to end.
- The three missions look like three chapters of one book, not three templates.

If you hit a hard limit (for example, no real GLB is available), implement the best fallback, document it, and move on. Don't stall.

---

## 7. FINAL REPORT

Write `review/REPORT.md` containing:

1. A before vs. after score table for the 10 dimensions.
2. The final TOP15 table with a verdict and evidence for each improvement.
3. A before/after screenshot pair for the first screen and for each mission at 1440×900 and 390×844.
4. Before/after metrics (FPS, draw calls, bundle size, model sizes, Lighthouse).
5. Remaining weaknesses, stated honestly and ranked, with what it would take to fix each.
6. Placeholder assets still in use, and exactly where to drop in real models or images.
7. Any content changes, with their sources.

Do not end with a summary that praises the result. End with the remaining weaknesses list.
