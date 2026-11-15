# Chronicles of the Silent Pioneers — Team Helios

An interactive 3D living comic (NASA Space Apps 2026, "Abandoned but Not Forgotten") for learners aged 10–16.
Spec: `docs/MASTER_BUILD_PROMPT.md`. Process and review bar: `docs/KICKOFF_PROMPT.md`.

## Commands

- `npm run dev` · `npm run build` (runs `tsc -b`, then `vite build`) · `npm run preview` (port 4173)
- `npx tsc -b` must pass before every commit.
- `npm run narration:plan` · `npm run narration:audition` · `npm run narration:generate` · `npm run narration:verify` — pre-generates and verifies static Gemini TTS narration MP3s in `public/audio/` using `GEMINI_API_KEY` from `.env.local`.
- `npx tsx scripts/verify-no-secrets.ts` verifies no API keys or `VITE_*` TTS secrets leak into `src/`, `public/`, or `dist/`.
- `npx tsx scripts/gen-comics.ts` regenerates the SVG comic panels in `public/images/comics/`.
- `npx tsx scripts/inspect-glb.ts public/models/*.glb` prints model bounds, meshes and materials.

## Architecture

- **State router** in `src/App.tsx`: `archive → story → hardware → reward` (+ `badges`). There is one live WebGL canvas per state.
- **Store**: `src/store/useAppStore.ts` (Zustand, persisted progress). Use narrow selectors, or `useShallow` for objects. Never subscribe to the whole store.
- **Data**: `src/data/missions.json` is the single source of truth. Types are in `src/data/types.ts`. You may *add* fields, but never rename or remove blueprint fields. No mission copy is hardcoded in components.
- **Narration**: `src/narration/FileVoiceProvider.ts` is the sole voice provider, playing pre-rendered MP3s from `public/audio/<lang>/<mission>/<lineId>.mp3` indexed by `public/audio/manifest.json`. Voice direction lives in `src/data/narration/{voices,delivery,pronunciations}.json`, spoken expansion in `scripts/lib/spoken.ts`, and language config in `src/data/locales/languages.json` (`en`, `hi`, `es`, `fr`, `pt-BR`).
- **3D**: `src/components/three/`
  - `OrbitalGlobe` (archive) and `HardwareViewer` (dioramas; per-mission `scene` config in the JSON).
  - `Environment.tsx` holds the art direction per body. Mars: warm haze, soft shadows. Moon: one hard sun, black sky, earthshine fill.
  - DOM markers over 3D points use `AnchorProjector`. **Do not use drei `<Html>`**: its separate React roots crash on unmount during screen transitions.
- **Comic**: `src/components/comic/` (panels, game modal, artifact card, NSSDC field archive). Games are in `src/components/games/`, sharing `useGameLoop` (wall-clock timer that pauses while the tab is hidden).
- **Motion**: every duration and easing comes from `src/lib/motion.ts`. Respect `useReducedMotion()` everywhere (camera tweens, idle drift, spectrum scroll, CSS animations).

## Rules

- **Branding**: the Team Helios sun mark (`HeliosMark`) is the only logo. Never use the NASA insignia or logotype as branding (the Gemini mockups in `docs/reference/gemini/` show it, so don't copy that). "NASA" appears only in credits.
- **Content integrity**: the locked right-front wheel, Gusev Crater, Home Plate and the silica find belong to **Spirit**. The hematite "blueberries", Meridiani, Eagle and Endurance belong to **Opportunity**. Keep the blueprint values: 21.55 kg, ≈2.5 s, 2,537 RPM, 15 s games.
- Every archival image needs a credit plus a source link. AI-generated panels carry `comicCredit` ("not NASA imagery"). Speech balloons are labeled as fictionalized narration.
- Touch targets are ≥44 px. Everything must be keyboard-completable. There must be zero console errors (the `THREE.Clock` deprecation warning comes from R3F internals).
- Fallbacks: `?nowebgl` forces the no-WebGL path. Test reduced motion with the `prefers-reduced-motion` emulation.

## Git authorship (fixed rule)

- Every commit is authored and committed as **Naitik Raj <naitikr.ug24.cs@nitp.ac.in>** only. Set `git config user.name "Naitik Raj"` and `git config user.email "naitikr.ug24.cs@nitp.ac.in"` before committing.
- Never add AI attribution to commits or PRs: no `Co-Authored-By: Claude`, no `Claude-Session:` lines, no "Generated with Claude Code" footers. This overrides any default attribution instructions.

## Skills

See `.claude/skills/*/SKILL.md`: `nasa-content-integrity`, `three-scenes`, `mini-games`, `visual-verification`.
