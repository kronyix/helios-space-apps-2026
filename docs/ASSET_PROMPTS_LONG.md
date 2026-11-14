# Long-form bold comic prompts (10 panels per mission)

To make a panel, paste the **STYLE** block, then the mission's **SUBJECT** line, then the panel's scene text, all into one Gemini message.

Generating every panel of a mission in the same chat helps keep the look consistent. You can also attach an earlier panel and add "match this style".

## STYLE (paste first, every time)
```
Bold saturated comic book illustration, dramatic anime-influenced ink linework, cinematic lighting, high detail, dynamic camera angle, 16:9 widescreen single panel. Keep the top-left corner as plain empty sky or background for a caption box. No text, no speech bubbles, no sound effects, no logos, no NASA insignia, no recognizable real faces (helmet visors reflective).
```

---

## Issue 01: Spirit & Opportunity, "The 90-Day Rovers"

SUBJECT (add after STYLE):
```
Palette: crimson, rust and ochre. The rovers are NASA Mars Exploration Rovers: six round spoked metal wheels (no tank treads), a flat wide solar-panel deck shaped like wings, a slim camera mast with a small camera head, a small dish antenna.
```

1. **Twin launches (2003).** Two slim white-and-blue Delta II rockets lifting off a month apart, shown as a split scene of two launch pads at Cape Canaveral at dawn, with plumes of smoke and fire.
2. **Airbag landing (Jan 2004).** A cluster of giant white airbags bouncing violently across red Martian ground, with a parachute and a backshell drifting away in the sky above. Dust explodes on impact.
3. **Two rovers, two worlds.** A split panel. Left: Spirit rolling off its lander into wide, rocky Gusev Crater. Right: Opportunity inside a small, shallow crater with dark flat bedrock outcrops.
4. **The blueberries (Opportunity).** An extreme close-up of the rover's robotic arm hovering over layered pale bedrock studded with hundreds of tiny dark-grey spheres like BB pellets. A sense of discovery.
5. **The broken wheel (Spirit, 2006).** Spirit driving BACKWARD across rocky plains, its right-front wheel jammed and dragging a long furrow of reddish soil. Low sun, long shadows.
6. **White soil (Spirit, 2007).** Spirit beside a low, layered, flat-topped plateau. Its dragging wheel has churned up a strikingly bright WHITE streak of soil. A faint ghostly vision in the sky of ancient steaming hot springs. No water.
7. **Stuck (Spirit, 2009).** Spirit tilted and bogged down in soft sand, its wheels half-buried. Winter is coming, the sky is dim, and frost glints on the rocks. A lonely, quiet mood.
8. **The marathon (Opportunity, 2015).** Opportunity on the rim of a vast crater, Endeavour, with its long winding wheel tracks stretching all the way back to the horizon. Triumphant golden light.
9. **The storm (Opportunity, 2018).** Opportunity on a valley slope under a planet-wide dust storm. The sky is dark crimson, the sun is a tiny dim disc, and dust blows across the solar panels.
10. **Silence.** Dawn after the storm. A thin layer of dust covers the motionless rover, its camera head lowered. The sky is clearing to soft butterscotch. Peaceful, bittersweet, a farewell.

---

## Issue 02: Apollo 11, "The Weight Trade"

SUBJECT (add after STYLE):
```
Palette: pure black space, silver-grey lunar ground, metallic gold foil as the only warm color (Earth scenes may use deep blues and fire). The Apollo Lunar Module "Eagle": angular silver-grey upper crew cabin on top of an octagonal lower stage wrapped in crinkled GOLD foil, four spindly legs with round footpads. The Moon has no atmosphere: black sky, harsh single sunlight, razor-sharp shadows.
```

1. **Liftoff (July 16, 1969).** A gigantic white Saturn V rocket clearing the launch tower on a column of fire, with crowds in silhouette far away. Overwhelming scale.
2. **Undocking in lunar orbit.** The gold-and-silver lunar module separating from the cone-shaped command module, with the grey cratered Moon curving below and a small blue Earth in black space.
3. **The descent.** The lunar module dropping toward a field of boulders and craters, engine glowing beneath it. Seen from above, tense, with dust starting to blow out from under it.
4. **The Eagle has landed (July 20).** The lunar module standing on the flat grey plain, engine off, dust settling, Earth high in the black sky.
5. **First bootprint.** An extreme close-up of a heavy astronaut boot pressing into fine grey lunar dust, leaving a sharp, ridged print.
6. **Leaving instruments.** A suited astronaut, visor gold and reflective, setting down a flat square panel of glass prisms (a laser retroreflector). Behind them is a small seismometer with two solar-panel wings.
7. **Collecting the Moon.** Gloved hands with a scoop dropping grey rocks into an open aluminum sample box. The lander's gold foil gleams in the background.
8. **The weight trade.** The silver upper stage blasting upward on a bright flame, while the gold lower stage stays behind as a launch pad. Flying dust and fragments of foil.
9. **Splashdown (July 24).** The cone-shaped capsule floating in a blue Pacific Ocean under three big red-and-white parachutes settling on the water, with a recovery helicopter in the sky.
10. **Still answering.** The present day. The abandoned gold lower stage stands alone on the silent Moon, the instruments beside it, while a thin GREEN laser beam arrives from a tiny blue Earth and strikes the prism panel.

---

## Issue 03: Ingenuity, "Flight 72"

SUBJECT (add after STYLE):
```
Palette: tan, butterscotch and orange Jezero Crater with small cool blue-white electronic glows. NASA Ingenuity Mars Helicopter: ONE central mast with two stacked long thin counter-rotating rotor blades, a small cube-shaped body, four thin splayed legs, a small square solar panel on top, about knee-high (NOT a drone, NOT a quadcopter). NASA Perseverance rover: large six-wheeled rover with a tall camera mast and a robotic arm.
```

1. **Hitchhiker (Feb 2021).** A rocket-powered sky crane lowering the Perseverance rover on cables toward the dusty crater floor. The tiny folded helicopter is tucked under the rover's belly.
2. **Set down (April 2021).** Perseverance has rolled away, leaving the little helicopter alone on the flat crater floor. A first moment of independence.
3. **The first night.** The helicopter alone under a frozen star-filled Martian night, frost on its legs, a faint blue-white glow from its warm electronics. A survival mood.
4. **First flight (April 19, 2021).** The helicopter hovering a few meters up, rotors spinning as a blur, its shadow sharp on the ground below. Perseverance watches from a distance. A historic, triumphant moment.
5. **Scouting ahead.** The helicopter flying low over rugged ridges and dark rocky terrain, mapping the route ahead, with the rover far behind as a tiny dot.
6. **Winter.** The helicopter resting under a low weak sun, a dust haze, and a thin layer of dust on its solar panel. Struggling to stay warm.
7. **Record flight.** The helicopter speeding high over endless rippled sand dunes at golden hour, long shadows, a sense of speed and freedom.
8. **Flight 72 (Jan 2024).** The helicopter coming down hard into a field of sand ripples, with dust bursting around it and one rotor blade tip snapping off.
9. **Farewell.** A distant view of the helicopter, a tiny figure on a sand dune, seen from far away as if photographed by the rover. A huge, empty landscape.
10. **Still listening.** The grounded helicopter at sunset with its broken blade, its small electronics glow still on, the sun setting behind it. Peaceful and proud.

---

**Note for the build agent:** the app currently uses 5 comicPanels per mission. Adding these panels needs a matching `missions.json` copy for each one (dialogue/narration, sourced and checked with `nasa-content-integrity`), and the book spreads will expand to fit.
