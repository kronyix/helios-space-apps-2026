# Stage B: audit (round "before") and top 15

Baseline commit `279711d`. Evidence lives in `review/before/` (127 captures at 1440/1920/1024/390, plus reduced-motion and `?nowebgl` runs, and `metrics.json`).
Metrics were taken on the production preview with a real GPU (Intel Iris Xe, ANGLE GL-ES) at 4× CPU throttle.

## Scores (1–10, against Awwwards SOTD)

| # | Dimension | Before | Worst offender (evidence) |
|---|---|---|---|
| 1 | Visual originality & art direction | 5 | Three equal rounded "cards" under the hero on archive and hardware: the dashboard tell (`01-archive-1440.png`, `01-opportunity-hardware-1440.png`) |
| 2 | Typography & hierarchy | 6 | Hardware name set at 54 px over three lines competes with the issue title (`01-opportunity-story-illustrated-1440.png`) |
| 3 | 3D realism & depth | 6 | Mars dioramas are solid. Opportunity GLB is a 36 KB low-poly stand-in (`01-opportunity-hardware-1440.png`) |
| 4 | Lighting, materials & camera | 6 | Good per-body lighting. No env map, so metals read flat on the LM (`02-apollo11-hardware` earlier capture) |
| 5 | Animation & timing | 5 | The loader overlays pages with no 3D for 2.5–7 s (`09-badges-1440.png`, `03-ingenuity-story-illustrated-1440.png`) |
| 6 | Interaction quality | 6 | Beacon labels clip off-screen at 390 px: "Mare Tr…" (`01-archive-390.png`) |
| 7 | Mission storytelling | 7 | Archival photos are cropped to 16:10, so the Saturn V launch becomes an anonymous plume (`02-apollo11-story-archival-1440.png`) |
| 8 | Mini-game functionality | 7 | All three pass and fail by mouse and keyboard (verified in the Stage A playthrough). Touch was not yet emulated |
| 9 | Responsive behaviour | 5 | Moon view at 390 puts the Moon behind the headline with no contrast protection (`01-archive-moon-390.png`) |
| 10 | Performance & loading | 6 | Apollo diorama 53.6 fps / p95 33 ms with 177 draw calls (`metrics.json`). Initial JS is 1,406 KB |

## Top 15 (ranked: broken > first screen > 3D > de-dashboard > transitions > consistency)

| # | Improvement | Dim. | Evidence | Why a juror cares | Acceptance criteria | Effort |
|---|---|---|---|---|---|---|
| 1 | Loader only gates 3D first paint, and dismisses at 100% | 5, 10 | `09-badges-1440.png`, `03-ingenuity-story-*-1440.png`, `02-apollo11-hardware-1440.png` (loader still up at 7 s) | Content hidden behind a spinner reads as broken | Badges/story deep links show content at ≤ 1.2 s; hardware shows the scene once progress hits 100% | S |
| 2 | Archival photos shown whole (contain + blurred backdrop) | 7 | `02-apollo11-story-archival-1440.png` | Cropping NASA photos misrepresents the record | The Saturn V launch shows the rocket; no archival photo is cropped | S |
| 3 | Merge static LM meshes by material | 10 | `metrics.json`: Apollo 177 calls, 53.6 fps | Fails the ≥ 55 fps gate | Apollo ≥ 55 fps at 4× throttle; draw calls < 60 | M |
| 4 | Beacon labels flip inward near the frame edge | 6, 9 | `01-archive-390.png` | Clipped text looks unfinished | No beacon label crosses the viewport edge at 390 or 1440 | S |
| 5 | Moon view on portrait: frame the Moon above the headline, add a text scrim | 9 | `01-archive-moon-390.png` | Text over busy 3D fails readability | At 390 the Moon's centre sits in the top 40%; headline over a ≥ 60% dark scrim | S |
| 6 | Replace the three-card rows with one ruled annotation strip | 1 | `01-archive-1440.png`, `*-hardware-1440.png` | The dashboard look is the first AI/template tell | One container per row, columns split by hairlines, no per-item box | S |
| 7 | Story ↔ hardware continuity: the panel-3 art dissolves into the scene | 5 | video `review/before/video/*.webm` (hard fade) | Transitions are judged on continuity | One continuous dissolve, no blank frame | M |
| 8 | Environment map for PBR metals (LM foil, Ingenuity) | 4 | earlier Apollo capture: flat gold | Materials look like plastic | Visible specular variation on the Kapton; no FPS regression > 2 | M |
| 9 | Hardware-name typography: cap at two lines and demote to H2 scale | 2 | `01-opportunity-story-illustrated-1440.png` | Competes with the issue title | Title > hardware name in size and weight at every viewport | S |
| 10 | Touch emulation playthrough of all games | 8 | Not yet tested | Mobile jurors | Each game passes and fails with `hasTouch` | S |
| 11 | Split the 3D vendor chunk so drei and its loaders load lazily | 10 | `initialJsKB` 1,406 | First paint | Initial JS ≤ 1,100 KB | M |
| 12 | 1024 archive: the issue list overlaps the globe | 9 | `01-archive-1024.png` | Tablet jurors | Globe and list do not overlap by more than 10% of the globe | S |
| 13 | Artifact-card locked state: show a silhouette rather than an empty void | 1 | `*-reward-1440.png` | Empty 280 px block | The locked card shows a recognisable artifact outline | S |
| 14 | Lighthouse a11y/perf run | 6, 10 | Not available offline | Exit gate | Scores recorded | S |
| 15 | Replace the low-poly Opportunity GLB | 3 | 36 KB model | Realism | Real MER model ≤ 3 MB, hotspots re-placed | L (waiting on asset) |

## Verdicts

Round 1 (`review/round-1/`, metrics in `review/round-1/metrics.json`, same GPU and 4× throttle):

| # | Verdict | Evidence |
|---|---|---|
| 1 | **VERIFIED** | `09-badges-1440.png` shows content (before: loader at 2.5 s). `02-apollo11-hardware-1440.png` shows the scene at 7 s (before: loader at 100%). The loader now gates only archive/hardware first loads and dismisses at 100%. |
| 2 | **VERIFIED** | `02-apollo11-story-archival-1440.png`: the whole photo is shown (object-contain over a blurred copy) and the Saturn V is visible. In archival mode the narrative caption moves beneath the photo so nothing covers NASA imagery. |
| 3 | **VERIFIED** | Apollo: 177 → 45 draw calls, 53.6 → 59.8 fps, p95 33.3 → 16.8 ms. No other scene regressed (archive 60.4, Opportunity 60.2, Ingenuity 60.2). Leak check stable (renderer counts identical across two cycles). |
| 4 | **VERIFIED** | `01-archive-390.png`: "Mare Tranquillitatis" and "Jezero Crater" labels flip inward; no label crosses the edge. |
| 5 | **VERIFIED** | Portrait archive: the globe canvas scrolls with the page (64vh) instead of sitting fixed behind the text, and a bottom scrim protects the headline. `01-archive-moon-390.png` and `01-archive-390.png`: the headline no longer overlaps 3D. |
| 6 | **PARTIAL** | Archive and hardware rows are now one ruled strip with hairline dividers (`01-archive-1440.png`). Still the same three-column information design; a stronger editorial treatment is open. |
| 7–15 | Open | Not started in round 1 (see round 2). |

Still weak after round 1 (honest): Mars reads dim on portrait in early frames (sun sweep); the story→hardware transition is a plain fade; no env map, so metals look flat; initial JS is 1,410 KB; the Opportunity GLB is a low-poly stand-in; Lighthouse was not run (no offline Lighthouse available).


Round 2 (`review/round-2/`, real GPU, 4× CPU throttle):

| # | Verdict | Evidence |
|---|---|---|
| 7 | **VERIFIED** | `transition-apollo11-story-to-hardware-{0150..3200}ms.png`: the panel-3 art goes full-bleed at 600 ms and dissolves (fade + blur + push, `dur.cinematic`) into the live scene once the model has loaded, which also hides the model download. The 150 ms frame is still dark (screen exit before the new screen mounts). |
| 8 | **VERIFIED** | Procedural PMREM room environment (no download), intensity 0.40 on Mars and 0.22 on the Moon. `02-apollo11-hardware-hotspot-kapton-1440.png`: the foil shows specular variation. FPS: Apollo 59.8 → 58.6, others within 0.6 (`round-2/metrics.json`). |
| 9 | **VERIFIED** | Hardware name is now 24–36 px / weight 500 under a 46 px issue title (`01-opportunity-story-illustrated-1440.png`). |
| 10 | **VERIFIED** | `scripts/review/touch.ts` at 390×844 with `hasTouch`: Spectrometer 100 (tap), Laser 96 (tap slider + tap Fire), RPM 88 (touch pointer hold). No console errors. `setPointerCapture` is guarded for synthetic pointers. |
| 11 | **NOT DONE (reasoned)** | Initial JS is 1,413 KB, of which three/R3F/drei is 1,002 KB. The first screen *is* the 3D globe, so that chunk is required for first meaningful paint; splitting it would add a waterfall, not remove bytes. First paint is 244 ms. Revisit with a static poster frame if mobile Lighthouse fails. |
| 12 | **VERIFIED** | `01-archive-1024.png`: compact 230 px issue list and hero; strip clears the chapter track (before: overlapped). 1440×900 and 1920×1080 have no page scroll (scrollHeight = clientHeight). |
| 13 | **VERIFIED** | Locked artifact renders a wireframe silhouette with an ENCRYPTED tag instead of an empty block (`02-apollo11-reward-1440.png`). |

Re-score after round 2 (same evidence standard): 1 Art direction 6 · 2 Type 7 · 3 3D 6 · 4 Lighting 7 · 5 Animation 6 · 6 Interaction 7 · 7 Story 7 · 8 Games 8 · 9 Responsive 7 · 10 Performance 7.

Weakest now, ranked:
1. Art direction (6): the hardware screen is still "scene + bottom strip + floating panel"; mission identity is mostly palette. The upcoming all-bold comic art is the biggest lever.
2. 3D realism (6): Opportunity GLB is a 36 KB low-poly stand-in.
3. Animation (6): archive → story is an iris, but the story → reward and game → reward beats are plain fades.
4. Lighthouse not run (no offline Lighthouse); accessibility and performance scores unknown.
