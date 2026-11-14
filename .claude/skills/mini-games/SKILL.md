---
name: mini-games
description: How the three 15-second field tests (spectrometer_scan, laser_bounce, rpm_throttle) are built, scored and verified. Use when changing games or MiniGameModal.
---

# Mini-games

- The shell is `src/components/comic/MiniGameModal.tsx`, a portalled dialog. Its phases are `intro → active → (signal-lock beat) → success | failure`. It has a focus trap, Esc to close, a double-start guard, and it cancels the pending result if the player leaves mid-game.
- Every game takes `GameProps { durationSec, params, successThreshold, onFinish(score, passed, detail) }` and must call `onFinish` **exactly once** (guard with a `done` ref).
- Use `useGameLoop` for the frame loop. It is a wall-clock timer, and time while the tab is hidden is skipped.
- Tuning lives in `missions.json → miniGame.params`. Don't hardcode it.

| Game | Score | Notes |
|---|---|---|
| spectrometer_scan | found/targets×100 − false locks×penalty | The spectrum scrolls; under reduced motion it is static (one screen). Shaded amber = hematite reference. |
| laser_bounce | 100 − misses×12 − offset/tol×20 | Round trip = 2d/c with d in [363,300, 405,500] km (≈2.4–2.7 s). A pulse in flight at time-up still counts. |
| rpm_throttle | lift-off: 30 + 70×battery% · else 40×hold/3 s | The rotors lag the throttle command (τ 0.35 s), drawn as a ghost needle. Power ∝ rpm³, doubled above 2,700. |

## Input

- Keyboard: Space/Enter act, arrows adjust. Ignore Space/Enter when focus is on another button, to avoid double actions.
- Mouse and touch: use pointer events with `touch-none` on the play surface.

## Verify

Play each game to success and to failure in the browser, with mouse and with keyboard. Check that the result screen's numbers come from your input.
