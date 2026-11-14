# Asset prompts: bold comic panels

These are the Gemini prompts for the bold, saturated comic style that Team Helios chose for all three issues. Use them to regenerate any panel, for example a panel flagged REGENERATE in `review/watermark-audit.md`.

Panels for Issue 01 that already exist in this style:
- `oppy_bold_airbag_landing` (p1)
- `oppy_bold_arm_trench_scan` (p3)
- `oppy_bold_dust_storm` (p5)
- `oppy_bold_future_explorer` (epilogue)

**Specs for every panel:**
- 16:9 aspect, delivered at 1280×720.
- Under 300 KB each.
- Keep the top-left corner plain, since the caption goes there.
- Keep the balloon corner plain: bottom-right on odd panels, bottom-left on even panels.
- No text, no logos, no NASA insignia.

**Accuracy guards:**
- The MER rovers have **six round wheels and no treads**.
- Ingenuity is a **coaxial helicopter with one mast and two stacked rotors**, not a quadcopter.
- The Moon has **no atmosphere**: black sky and hard shadows. Earth sits high in the sky as seen from Tranquility Base.

**Fixes to send Gemini if a result is wrong:**
- Treads on a rover: "redo with six round spoked wheels, no treads".
- Ingenuity drawn as a quadcopter: "only ONE mast with two stacked rotors on top".

---

## Issue 01: The 90-Day Rovers

### oppy_p2: Spirit drags its locked wheel (2006)
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, rich red and rust palette, cinematic lighting, 16:9 widescreen. NASA Spirit Mars Exploration Rover — six round metal wheels (no tank treads), flat wide solar-panel deck, a slim camera mast with a small camera head — driving BACKWARD across rocky reddish Martian plains with low hills behind. One front wheel is jammed and not turning; it drags through the soil and carves a long shallow furrow behind the rover. Dusty sky, late afternoon light. Keep the top-left corner and bottom-left corner as plain sky and empty ground for text overlays. No text, no speech bubbles, no logos, no NASA insignia, no humans, no holograms.
```

### oppy_p4: The wheel exposes white silica (2007)
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, rich red and rust palette, cinematic lighting, 16:9 widescreen. NASA Spirit Mars Exploration Rover — six round metal wheels (no tank treads), flat solar-panel deck, slim camera mast — parked beside a low, flat-topped plateau of layered pale rock. Behind the rover, its dragging front wheel has churned up a strikingly bright WHITE streak of powdery soil that glows against the red ground, the focal point of the image. Optional: a faint, ghostly translucent vision in the sky of steaming hot-spring vents. Absolutely no ocean, no waves, no standing water. Keep the top-left and bottom-left corners as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia, no humans.
```

## Issue 02: The Weight Trade (Apollo 11)

### apollo_p1: Eagle at Tranquility Base
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, high-contrast palette of pure black sky, silver-grey lunar ground and metallic gold foil, cinematic lighting, 16:9 widescreen. The Apollo 11 Lunar Module "Eagle" standing on the Moon on four spindly legs with round footpads: an angular silver-grey upper crew cabin on top of an octagonal lower stage wrapped in crinkled GOLD foil. Flat grey cratered lunar plain, harsh single sunlight, very sharp black shadows, no atmosphere, no haze. Earth visible HIGH in the black sky. Keep the top-left corner and bottom-right corner as plain black sky and empty grey ground. No text, no speech bubbles, no logos, no NASA insignia, no flag in the foreground.
```

### apollo_p2: The ascent stage leaves the descent stage behind
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, high-contrast palette of pure black sky, silver-grey lunar ground and metallic gold foil, 16:9 widescreen. The silver-grey angular upper half of the Apollo 11 Lunar Module blasting off from the Moon with a bright engine flame, leaving its gold-foil-wrapped lower stage with four legs standing behind on the grey surface as a launch pad. Flying grey dust and bits of foil, harsh sunlight, sharp black shadows, black starless sky, no atmosphere. Strong upward motion. Keep the top-left corner and bottom-left corner as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia.
```

### apollo_p3: The two instruments left behind
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, high-contrast palette of black sky, silver-grey lunar ground and gold foil accents, 16:9 widescreen. On the grey lunar surface: a flat, square, tilted panel covered in a grid of small round glass prisms (a laser retroreflector) and, beside it, a compact cylindrical seismometer instrument with two flat rectangular solar-panel wings. The gold-foil Lunar Module lower stage stands in the background. Astronaut bootprints in the dust, harsh sunlight, sharp shadows, black sky. Keep the top-left corner and bottom-right corner as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia, no people.
```

### apollo_p4: Twenty-one kilograms of Moon
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, high-contrast palette of black, silver-grey and warm gold accents, 16:9 widescreen. Close-up of two bulky white spacesuit gloves holding an open rugged aluminum sample box, packed with dark grey lunar rocks and dust. Reflective metal, dramatic hard light, black background. Feeling of a treasure carried home. Keep the top-left corner and bottom-left corner plain and dark. No text, no speech bubbles, no logos, no NASA insignia, no faces.
```

### apollo_p5: Firing the laser
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, deep night-blue and black palette with a vivid green accent, 16:9 widescreen. A domed astronomical observatory on a dark mountain top on Earth at night, firing a thin bright GREEN laser beam up into a starry sky toward a large full Moon. Silhouetted ridgeline, glowing dome slit, scattered stars. Keep the top-left corner and bottom-right corner as plain night sky and dark ground. No text, no speech bubbles, no logos, no NASA insignia, no people.
```

## Issue 03: Flight 72 (Ingenuity)

### ingy_p1: Dropped off by Perseverance
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, warm tan and orange Martian palette with small cool blue-white electronic glows, 16:9 widescreen. NASA Ingenuity Mars Helicopter — two stacked long thin rotor blades on one central mast, a small cube-shaped body, four thin splayed legs, a small square solar panel on top, about knee-high (NOT a drone, NOT a quadcopter) — sitting alone on flat tan Martian ground. In the background the six-wheeled NASA Perseverance rover drives away. Jezero Crater rim on the horizon, soft dusty light. Keep the top-left corner and bottom-right corner as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia, no humans.
```

### ingy_p2: The first flight
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, warm tan and orange Martian palette with small cool blue-white electronic glows, 16:9 widescreen. NASA Ingenuity Mars Helicopter — two stacked long thin rotor blades spinning as motion-blurred discs, small cube body, four thin legs, small solar panel on top — hovering a few meters above flat tan ground, its sharp shadow beneath it, a little dust kicked up. Historic, triumphant moment, low camera angle. Keep the top-left corner and bottom-left corner as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia, no humans.
```

### ingy_p3: Small body, loud ideas
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, warm tan and orange Martian palette with cool blue-white electronic glows, 16:9 widescreen. Dramatic low-angle heroic close-up of the NASA Ingenuity Mars Helicopter — two stacked long thin rotor blades, small cube body with a faint blue-white glow from its electronics, four thin legs, small square solar panel on top — standing on Martian sand, towering over the viewer. Detailed carbon-fiber blades. Keep the top-left corner and bottom-right corner as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia, no humans.
```

### ingy_p4: Seventy-two flights
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, golden-hour tan and orange Martian palette with cool blue-white electronic glows, 16:9 widescreen. NASA Ingenuity Mars Helicopter — two stacked thin rotor blades in motion blur, small cube body, four thin legs — flying high over rippled sand dunes and a distant crater rim at golden hour, long shadows across the dunes. Sense of freedom and a long journey. Keep the top-left corner and bottom-left corner as plain sky and empty dunes. No text, no speech bubbles, no logos, no NASA insignia, no humans.
```

### ingy_p5: Grounded, still listening
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, deep sunset orange and dusky red Martian palette with one small blue-white electronic glow, 16:9 widescreen. NASA Ingenuity Mars Helicopter resting permanently on a sand ripple at sunset — two stacked rotor blades, one blade with its tip snapped off, small cube body, four thin legs, small solar panel on top. Quiet, bittersweet, peaceful mood, the small sun setting behind it. Keep the top-left corner and bottom-right corner as plain sky and empty ground. No text, no speech bubbles, no logos, no NASA insignia, no humans.
```
