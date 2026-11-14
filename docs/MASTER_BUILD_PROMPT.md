# MASTER BUILD PROMPT: CHRONICLES OF THE SILENT PIONEERS

Team Helios · NASA Space Apps Challenge 2026 · Challenge: *Abandoned but Not Forgotten*

> **Provenance.** The kickoff prompt refers to this file as the spec, but no copy was supplied. It was reconstructed from three sources the team provided:
> 1. `docs/Chronicles of the Silent Pioneers - Technical Blueprint.pdf`, the **Master Technical Architecture**: state flow, episode matrix, folder hierarchy, prop contracts and the `missions.json` contract.
> 2. `docs/reference/*.png` and the UI/UX selection, which give the visual direction for the Archive and Story screens.
> 3. `docs/KICKOFF_PROMPT.md`, which gives the build/review process and quality bar.
>
> The general blueprint `docs/forgotten_machines_hackathon_blueprint.pdf` supplies the product principles: fact, explanation and fiction kept apart; no fabricated data; credits on every image.
>
> Where these sources conflict, the order of authority is: Technical Blueprint > UI/UX selection > this file.

---

## 1. Product

An **Interactive 3D Living Comic** for learners aged 10–16. It reframes three pieces of NASA hardware that were left behind, not as space debris but as engineering sacrifices. A 2D, DOM-based comic reading experience is combined with WebGL scenes embedded in the comic layout.

## 2. The four application states (sequential loop)

| # | State | Roman label | Content |
|---|---|---|---|
| 1 | **Orbital Archive** | I · Archive | 3D star chart: Mars globe and Moon. The user drags the globe and selects a coordinate beacon. |
| 2 | **Narrative** | II · Story | Comic panels 1 and 2. DOM reading, with an Illustrated ↔ Archival photo toggle. |
| 3 | **Hardware** | III · Hardware | Comic panel 3: embedded 3D hardware diorama, 3 hotspots, and a 15-second micro-game. |
| 4 | **Reward** | IV · Transmission | Comic panels 4 and 5: the unlocked final transmission and a 3D holographic artifact card. |

Supporting views include an achievements view (Badges), a loader ("transmission acquisition"), and fallbacks for no WebGL and for reduced motion.

## 3. Missions (from the blueprint matrix)

| Issue | Hardware | Body / site | Coordinates | Model | Hotspots | Game |
|---|---|---|---|---|---|---|
| 01 "The 90-Day Rovers" | MER Opportunity & Spirit | Mars, Meridiani Planum | 1.9462°S 354.4734°E | `opportunity.glb` | Robotic arm (spectrometer) · locked right-front wheel (**Spirit's**) · dust-covered solar arrays | `spectrometer_scan`: crosshair locks hematite "blueberry" spikes on a waveform |
| 02 "The Weight Trade" | Apollo 11 LM descent stage | Moon, Mare Tranquillitatis | 0.6741°N 23.4730°E | `apollo_lm.glb` | Gold Kapton blanket · Laser Ranging Retroreflector · Passive Seismic Experiment Package | `laser_bounce`: an angle slider aims at the LRRR; the player measures the ≈2.5 s round trip |
| 03 "Flight 72" | Ingenuity helicopter | Mars, Jezero Crater | 18.4447°N 77.4508°E | `ingenuity.glb` | Damaged carbon-fiber blades · Snapdragon processor / solar panel · navigation camera | `rpm_throttle`: balance battery drain against rotor RPM to reach 2,537 RPM in thin air |

Keep these blueprint values: **21.55 kg** of lunar samples, a laser round trip of **about 2.5 s**, and a **2,537 RPM** target. Each game lasts **15 s**.

**Content-integrity rule.** Spirit and Opportunity were twins, so the shared model is acceptable. The copy and the hotspot must still say clearly that the locked wheel and the silica discovery belong to **Spirit**, and that the hematite "blueberries" belong to **Opportunity**.

## 4. Stack

Vite + React + TypeScript (strict) · Tailwind CSS v4 + CSS design tokens · Three.js + React Three Fiber + Drei · Motion (Framer Motion) · Zustand. Deploy to Vercel. Next.js is optional in the blueprint, and Vite was chosen because the kickoff's `npm run preview` implies it.

## 5. Folder hierarchy (blueprint, adapted to TSX)

```
public/models/{opportunity,apollo_lm,ingenuity}.glb   ≤ 3 MB each
public/textures/{mars_map,moon_map}.jpg
public/images/comics/        comic panel illustrations
public/images/nasa_real/     archival photography (credited)
src/data/missions.json       MASTER DATA CONTRACT: single source of truth
src/components/three/OrbitalGlobe.tsx, HardwareViewer.tsx
src/components/comic/ComicPage.tsx, MiniGameModal.tsx, ArtifactCard.tsx
src/App.tsx                  state router
```

## 6. Prop contracts (blueprint §5)

```ts
interface OrbitalGlobeProps { missions: MissionData[]; selectedBody: 'moon' | 'mars'; onSelectMission: (id: string) => void }
interface HardwareViewerProps { modelPath: string; hotspots: HotspotData[]; onHotspotClick: (id: string) => void }
```

## 7. `missions.json` contract

Preserve the blueprint structure strictly: `id, issueNumber, title, hardwareName, celestialBody, coordinates{lat,lng,locationName}, modelPath, telemetry{launchDate, landingDate, lastContact, plannedLifespan, actualLifespan, massKg}, hotspots[{id, position, label, engineeringFact, scienceDiscovery}], comicPanels[{panelNumber, comicImage, realNasaImage, nasaImageCaption, dialogue, speaker}], miniGame{type, targetValue}`.

Fields may be **added** but never renamed or removed. Additions used by this build include issue subtitle, theme, per-panel narration and credit/source link, game copy and tuning, artifact and badge definitions, and a source list.

## 8. Visual direction: "NASA Archival Futurism"

- Deep-space near-black, with warm Helios amber as the accent. Archival grain, hairline rules, registration marks, mono technical annotation and mission-document typography.
- **Space Grotesk** for display, **Inter** for body, **IBM Plex Mono** for metadata, coordinates and telemetry.
- Each mission gets its own voice:
  - 01: rust and ochre, field-notebook feel.
  - 02: silver and black, 1969 technical manual, Kapton gold as the only accent.
  - 03: Jezero tan, with blue-white avionics accents.
- Branding is a **Team Helios** sun mark. The NASA insignia must not be used as the app's logo. "NASA" appears only in credits.
- Layout reference: a left nav rail (Archive / Story / Hardware / Games / Badges), a title lockup at top-left, the issue list on the right, and the roman-numeral state track at the bottom.

## 9. Quality bar

- **Interactivity:** every control works. Everything is keyboard-completable. Touch targets are 44 px or larger.
- **Motion:** reduced motion is respected everywhere, and there is a shared motion token file.
- **Performance:** one live canvas per state. DPR is capped at 1.5 on mobile. Resources are disposed on unmount.
- **Console:** zero errors. `tsc --noEmit` and `npm run build` pass.
- **Content:** no fabricated facts. Every archival image is credited and linked to its NASA source. First-person machine dialogue is labeled as fictionalized narration.
