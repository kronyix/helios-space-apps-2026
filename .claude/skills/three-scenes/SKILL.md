---
name: three-scenes
description: Conventions for the React Three Fiber scenes (orbital globe, hardware dioramas, artifact card) — framing, lighting per body, hotspots, performance and disposal. Use when editing src/components/three/.
---

# 3D scenes

## Framing a model

- `missions.json → scene` sets `fitSize` (largest horizontal extent after normalization), `rotationY`, the default `camera` and `target`, and the optional `hideAboveY` (Apollo hides the ascent stage, which left the Moon).
- `HardwareViewer` normalizes every GLB: it scales to `fitSize`, sets the model on y=0 and centres it in x/z.
- Hotspot `position` and `cameraPosition` are in the *model's rotated group frame*. To place them, measure part bounds per material with a gltf-transform script (see `scripts/inspect-glb.ts`), then verify with a screenshot.
- `FrameOffset` uses `camera.setViewOffset` so the hardware sits in the open area of the layout. Don't move the orbit target to fake that.

## Art direction (`Environment.tsx`)

- Mars: butterscotch sky gradient, fog tinted to the horizon, a warm low sun, soft PCF shadows, rocks at three instanced scales.
- Moon: pure black sky with stars, one hard white sun, a faint blue earthshine fill, crisp shadows, Earth in the sky (the laser game's origin).
- Use `ContactShadows` under the hardware so it never floats.

## Rules

- One canvas per state. `HardwareViewer` sets `frameloop='never'` while a field test is open.
- DPR is `[1, 1.5]` on touch or small screens. Shadow maps are 1024 on mobile and 2048 on desktop.
- DOM labels over 3D: render normal React elements in `.anchor-layer` and register them with `AnchorProjector` (an object named `${prefix}${id}` in the scene). **Never use drei `<Html>`.**
- Camera tweens use `easeInOutCubic` and `dur.*`, and jump instantly under reduced motion.
- Declarative geometries and materials are disposed by R3F on unmount. GLTFs are cached by drei (`useGLTF.preload` on hover of the CTA).
