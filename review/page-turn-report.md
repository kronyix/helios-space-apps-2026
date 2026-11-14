# Page-turn reader: verification report

Evidence: `review/page-turn/` (screenshots, git-ignored; regenerate with `npx tsx scripts/review/book.ts page-turn`). Real GPU (Intel Iris Xe, ANGLE GL-ES), production preview.

## Decisions on conflicts in the change request

| Conflict | Decision |
|---|---|
| Skills named in the spec don't exist | Mapped instead of invented: `three-scenes` ↔ threejs-worldbuilding; `visual-verification` ↔ performance and accessibility audits; motion follows `src/lib/motion.ts`. |
| Bone-rigged `SkinnedMesh` | Used a 48-segment sheet bent analytically in the vertex shader instead. It gives the same curve (spine leads, free edge lags) with no skeleton and no skinning cost. |
| `html-to-image` dependency | Added (24 KB). It gives exact DOM-to-texture parity; a hand-written compositor would duplicate the panel CSS and drift. |
| 3:2 at 1536×1024 (Task 2) | Not applied yet (Task 2 is on hold). Plan: keep each image's native aspect (bold panels are 16:9); the book frames them with object-fit. |
| Depth Anything V2 (4.1) | Not run; no local model. Open. |

## Results

| Check | Result |
|---|---|
| WebGL leaf used for drag, keyboard, riffle, mobile swipe | Yes |
| Cancelled slow drag springs back | Yes |
| Flick completes a turn | Yes |
| FPS during a turn at 4× CPU throttle | 56 (target ≥ 55); 28 before turn progress moved out of React; 7 at the first build |
| GPU memory after paging all books twice | 3 textures, 0 extra geometries, identical across cycles |
| Reduced motion | 200 ms crossfade + slide; no WebGL leaf |
| `?nowebgl` | CSS-3D leaf, draggable |
| Console | No errors |
| 4.3 archive notes | 3 sourced notes (Opportunity p1, Apollo p1, Ingenuity p2), keyboard and pointer, 44 px hit area |
| 4.5 back cover → hardware | Book tips away and darkens (420 ms) → panel dissolve → camera dolly-in over `dur.cinematic` (1.4 s); no blank frame |

## Remaining issues

1. **Task 2 (watermarks):** on hold at the user's request. The draft reframe script is ready; ink-and-wash files still carry the sparkle.
2. **4.1 depth parallax, 4.2 embedded 3D inserts, 4.4 ambient micro-animation:** not started.
3. **Book→hardware model:** fades in via the scene dissolve; it doesn't yet rise from the exact screen position of the drawn hardware.
4. **Cover/back art:** the snapshot of the first turn after load uses the CSS leaf if textures aren't ready yet (about 1–3 s after load).
5. **3D model provenance:** unknown; the credits entry says sources are being confirmed.
6. **Games:** the teammate's arcade rewrite (045955f) has open review findings: 75 s games, the LaserBounce score/fail contradiction, silica in Opportunity's game, blueberries at Jezero.
