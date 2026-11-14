---
name: nasa-content-integrity
description: Check any change to mission copy, captions, hotspot facts, telemetry or images in src/data/missions.json for factual accuracy, attribution and credits. Use before committing content edits.
---

# NASA content integrity

Run this on every change to `src/data/missions.json`, comic panels or on-screen copy.

## Checklist

1. **Traceable.** Every caption box, hotspot fact and telemetry value must trace to a NASA/JPL/NSSDC page, or to the Technical Blueprint. Add the page to the mission's `sources` if it is new. Do not invent numbers, dates or quotes.
2. **Spirit vs Opportunity** (twin rovers sharing `opportunity.glb`):
   - Spirit (MER-A): Gusev Crater, the locked right-front wheel (2006), silica-rich soil near Home Plate (2007), Columbia Hills, Adirondack, Bonneville.
   - Opportunity (MER-B): Meridiani Planum, Eagle and Endurance craters, hematite "blueberries", the 2018 dust storm, last contact June 10, 2018.
   - A Spirit image is never captioned as Opportunity, and vice versa. The `wheel` hotspot keeps its `attribution` note.
3. **Blueprint values stay:** 21.55 kg lunar samples · ≈2.5 s laser round trip · 2,537 RPM · 15 s games.
4. **Images:**
   - Archival images need `nasaImageCaption`, `nasaImageCredit`, `nasaImageSource` (record page) and ideally `nasaImageFile`. Keep files under ~300 KB in `public/images/nasa_real/`.
   - NSSDC catalog captions are quoted from the page. The credit is "Images and captions courtesy NASA/JPL".
   - AI-generated illustrations carry `comicCredit` stating they are not NASA imagery.
5. **Fiction label:** speech balloons are fictionalized first-person narration (`fictionNotice`). Caption boxes are documented history only.
6. **Branding:** no NASA insignia or logotype as the app's mark.

## Official data sources

- NSSDCA Spirit images: https://nssdc.gsfc.nasa.gov/planetary/mars/mars_exploration_rovers/mera_images.html
- NSSDCA Opportunity images: https://nssdc.gsfc.nasa.gov/planetary/mars/mars_exploration_rovers/merb_images.html
- These catalogs cover early 2004 only. Later events (the 2006 wheel, 2007 silica, the 2018 storm) use images.nasa.gov / Photojournal records.
