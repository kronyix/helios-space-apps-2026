# Attribution audit (Task 1)

Command (from the change request; the CHANGE_REQUEST and ASSET_PROMPTS docs themselves are excluded):

```bash
grep -rniE "gemini|ai[- ]?generated|generated (by|with)|imagen|midjourney|dall-?e|\bai\b art" \
  src public index.html README.md docs --include=*.{ts,tsx,json,md,html,css}
```

Also checked: `\bAI\b`/"artificial" in `src` and `index.html`, every `comicAlt`, `title` attributes, loader copy and `<meta>` tags.

## Hits before the change

| Location | Text | Rendered? |
|---|---|---|
| `src/data/missions.json` — `comicCredit` on 14 panels (Opportunity p1, p3, p4, p5; Apollo p1–5; Ingenuity p1–5) | "AI-generated illustration (Google Gemini), art-directed by Team Helios. Not NASA imagery." | Yes: as a line under every illustrated panel |
| `src/data/missions.json:299` — `epilogue.credit` | same string | Yes: under the imagined-future image |
| `src/screens/BadgesScreen.tsx:88` | "…most panels are AI-generated (Google Gemini) and labeled as such on the panel." | Yes: credits paragraph |
| `src/data/types.ts:68` | comment "credit for the illustration (e.g. AI-generated art)" | No (code comment) |
| `README.md:28` | "Most comic panels are AI-generated (Google Gemini) and labeled on each panel…" | No (repo doc) |

- **Alt text:** none names a vendor.
- **Elsewhere:** no hits in `title` attributes, the loader copy, `index.html` or `<meta>`.
- **Docs:** `docs/` mentions (CLAUDE.md, ASSET_PROMPTS, CHANGE_REQUEST) are internal documentation, not UI, so they are left as they are.

## After the change

- **Fields removed:** `comicCredit` is gone from data and types, and the epilogue's `credit` field is removed.
- **Labels:** every panel now has `imageKind: "illustration"` and renders one UI label:
  - `ILLUSTRATION` in illustrated mode;
  - `ARCHIVAL · <exact credit>` linked to the source in archival mode.
  - The NSSDC field-archive images carry `ARCHIVAL · NASA/JPL`.
  - The epilogue carries `ILLUSTRATION · IMAGINED FUTURE`.
- **Credits entry:** there is one, at Badges → Credits, reachable from the sidebar "Credits" link. It's the only place the tool is named, and the README has a "Use of AI" section.
- **Exempt (documented):** images that are `aria-hidden` and decorative carry no label:
  - the blurred story background;
  - the full-bleed dissolve overlay, which shows the panel just labelled;
  - the 76 px issue-list thumbnails.

  Re-run the grep: the only rendered hit is the credits entry.
