# Chronicles of the Silent Pioneers

**Team Helios · NASA Space Apps Challenge 2026 · "Abandoned but Not Forgotten"**

An interactive 3D living comic for learners aged 10–16. It follows three pieces of hardware left behind on Mars and the Moon, and what they discovered:

| Issue | Hardware | Site | Field test |
|---|---|---|---|
| 01 · The 90-Day Rovers | MER-A Spirit & MER-B Opportunity | Gusev Crater / Meridiani Planum | Spectrometer Scan (hematite) |
| 02 · The Weight Trade | Apollo 11 LM *Eagle* descent stage | Mare Tranquillitatis | Laser Bounce (≈2.5 s round trip) |
| 03 · Flight 72 | Ingenuity Mars Helicopter | Jezero Crater | RPM Throttle (2,537 RPM) |

Flow: **I · Archive** (3D globe) → **II · Story** (comic panels with an illustrated/archival toggle, plus the NSSDC field archive) → **III · Hardware** (3D diorama, hotspots, 15 s game) → **IV · Transmission** (final panels and a 3D artifact). Badges track progress.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview
```

Add `?nowebgl` to the URL to see the no-WebGL fallback.

## Data & credits

- All mission content lives in `src/data/missions.json`, with a source link for every fact and image.
- Archival images: NASA, NASA/JPL-Caltech and partner institutions. Issue 01 uses the official NSSDCA Spirit (MER-A) and Opportunity (MER-B) image catalogs.
- Comic art is by Team Helios. Most comic panels are AI-generated (Google Gemini) and labeled on each panel; the rest are generated SVGs.
- Not affiliated with or endorsed by NASA.

See `CLAUDE.md` for architecture and contributor rules.
