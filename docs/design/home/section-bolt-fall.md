# Home sections: bolt and fall (workstream S3)

Silverbolt flies across the screen with the doll on its head, hovers while the five pair names turn, throws the doll off, and the camera follows her down while "5 Phases" and "10 Characters" stand either side of her. Two sections (`sections/bolt/` 4 screens, `sections/fall/` 2.6 screens, both with a half screen of lead and tail) that draw one shared scene. Design: `docs/superpowers/specs/2026-11-18-home-page-redesign.md` (section 4 and joints 4.1). Actors: `actor-silverbolt.md`, `actor-doll.md`, `fx-marks.md`. Reference: `home-reference/ref-psychoactive-tib.md` (tibdigital half).

## 1. What the visitor gets (beat by beat)

`t` is the position in screens since the start of the bolt section (bolt 0 to 4, fall 4 to 6.6). Every number below is a constant of `bolt/journey.ts` (`BEAT`, `WHEEL_*`).

| t                       | what happens                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| -0.5 to 0.3             | The ground turns dark green-black (a DOM layer over the storm ground) and a green bloom rises from the bottom. The strip's previews are still flying off to the bottom right.                                                                                                                                                                                                                                         |
| 0.12                    | Silverbolt starts to come in from beyond the lower right corner, head first, with the doll on its head (arms up, laughing). Four wavy lines (two white, two mint) draw on from the right.                                                                                                                                                                                                                             |
| 0.5 to 1.05             | One barrel roll on the way in. The doll screams, then is dizzy when it lands. Speed streaks lie behind the dragon, wing and tail trails follow it.                                                                                                                                                                                                                                                                    |
| 1.2 to 3.25             | The dwell: the dragon hovers at the centre (small sway, head follows the pointer, fully interactive). The wheel of the five pairs turns, one name in focus every 0.53 screens from t 1.1 (Layla & Fanny, Ruby & Angela, Lesley & Chang'e, Guinevere & Vexana, Selena & Obsidia), standing in the upper third over the dragon's head. The doll has a face for each pair (grin, smug, sparkle, determined, heart eyes). |
| 2.65 to 3.9             | The dragon rears (fright), the doll clings (scream blend).                                                                                                                                                                                                                                                                                                                                                            |
| 3.9                     | The sneeze: jaw open, steam, a poof and a bang over the head; the doll is thrown up and off, tumbling once. The dragon is at 75 percent of its path (t 4.0, upper left, scale 1.3) and leaves the top left during the first fifth of the fall.                                                                                                                                                                        |
| 4.0 to 4.9              | The camera (a 2D camera on the pixel plane: positions and heights scale, so the hit shapes stay right) follows the doll and zooms about 1.8 times (2.6 times on a 390 x 844 phone, where the dragon is sized by the width). Air streaks (`air`), two clouds from the lower corners and the pose fall, flail 1, a scream.                                                                                              |
| fall local 0.1 to 0.5   | "5 Phases": the 5 slides in from the left edge, Phases from the right, they leave to the edges.                                                                                                                                                                                                                                                                                                                       |
| fall local 0.47 to 0.97 | "10 Characters": rises from below, leaves upward.                                                                                                                                                                                                                                                                                                                                                                     |
| 6.6                     | J6: the doll upright at the middle top, feet at 0.10 H, 0.26 H tall, resigned face, falling slowly. The hand's fingertips show at the bottom edge (the hand section draws them).                                                                                                                                                                                                                                      |

Interactions (all by the actors' own hit targets, nothing of mine): five on the dragon (head PET, jaw BOOP, body POKE, wings FLAP, tail DRAG with IK), one on the doll (POKE). The scene turns the dragon's mark events into comic marks (spark, steam, vein, sweat, starburst, speed, poof, heart, flash) and startles the doll (shocked, or dizzy after stars). Five pokes make the dragon annoyed (4.5 s); the doll then shows the worried face. Pressing the doll throws stars, three presses make her dizzy (sweat marks). A touch tap does the same as a press (looked at on a 390 px touch page). The canvas is aria-hidden and the 3D pokes are decoration (no control depends on them); the five names are a real `ul` in reading order, the two lines of the fall are real text (`h2` for screen readers).

## 2. Files

```
bolt/index.ts      registry entry (4 screens, lead 0.5, tail 0.5, ground storm, nav storm)
bolt/preload.ts    silverboltItems({priority 36}) + dollItems({priority 37}): both deferred (reached at about 11 screens)
bolt/view.tsx      server markup: below = tint, band and glow; text = h2 (screen readers) + the ul of five pairs
bolt/runtime.ts    BoltRuntime: scene.update(t), the wheel, the tint and the bloom (transform and opacity only)
bolt/scene.ts      BoltScene: the shared scene (dragon, doll, marks, trails, lines). One per stage, refcounted by the two sections
bolt/journey.ts    Journey: the whole choreography as a pure function of t (path, beats, camera, doll state, J6)
bolt/path.ts       the tib path: Catmull-Rom through 8 keys, arc length table, beyond-the-ends along the tangents
bolt/wheel.ts      the barrel: item place, opacity envelope and place of the wheel at t (pure)
bolt/lines.ts      WaveLines actor: four wavy strokes, one ShaderMaterial each, in an ortho pass (order 24) under the cast
fall/index.ts      registry entry (2.6 screens)
fall/preload.ts    []  (the scene's files are bolt's)
fall/view.tsx      the two lines as real text (left and right half of each)
fall/runtime.ts    FallRuntime: scene.update(4 + local x 2.6) and the two lines
```

Tests (`npx vitest run src/features/home/sections/bolt`): path, journey (pure in t, joints, J5, J6 pinned against the hand section's `J6`, `fallEnd`, `handGeometry`, `FACES`), wheel, lines. The registry lengths are tested against `BOLT_SCREENS` and `FALL_SCREENS`. If the integrator changes a length, change the two constants in `journey.ts` too (the test says so).

## 3. How the scene works

- The two runtimes call `BoltScene.update(t, frame)` with `t = local x screens (+ 4 for the fall)`. In the fall's lead and the bolt's tail both run with the same `t`; the second call in a frame is skipped. After a jump the kernel replays `update(1)` of the passed sections: `BoltScene` reads only `t`, so any order gives the same picture.
- The dragon and the doll arrive late (deferred files). Until then `update` draws what it has (the lines) and the text goes on: a quiet stage, no error. A part that fails to build is logged and left out.
- The build order is marks and trails, then the dragon, then the doll, then a warm-up (`compileAsync` of the cast scene, one texture upload a frame, one real draw into a scissor of one pixel). Measured: the dragon and the doll show with no hitch.
- The doll rides by `doll.attach(sb.socket("headTop"))` with `keepWorld: false` and a seat (`SEAT` in `scene.ts`, calibrated by eye). It is attached and detached by the state of `t` each frame, idempotently. A throw that the scroll crosses slowly hides the seam (an offset from the head to the free place that fades over 0.35 screens); a jump has no seam to hide.
- The kernel hides every actor each frame; the scene sets `visible` and the whole target state every frame. Setters that the actors take as objects (`place`, `fly`, the gaze) reuse objects. Nothing is allocated in a frame except three small strings for each wheel name that can be seen.
- The wheel items, tint, glow and band are written only as transform and opacity, only when the value changed (`put` of `scroll-kit`). A name that cannot be seen only gets its opacity.

## 4. Numbers to tune

`journey.ts`: `BEAT` (enter 0.12, rollFrom 0.5, arrive 1.2, leave 3.25, launch 3.9, at75 4.0), `WHEEL_FROM` 1.1 and `WHEEL_STEP` 0.53, `BASE_HEIGHT` 0.24 (the dragon's body block as a share of `ref`, `ref = min(h, 1.5 w)`), `RIDE_SHARE` 0.46, `FALL_SPEED`, `FALL_DRAG`, `THROW_UP`, `CAMERA_SETTLE` 0.9, `TUMBLE` 1.9, `END_HEIGHT` 0.26 and `END_FEET_Y` 0.10 (J6), `PAIR_FACES`, `FALL_MOODS`. `path.ts`: `KEYS` (x and y as fractions of the viewport, y up, and the size), `KEY_CENTRE` 3, `KEY_FALL` 5. `wheel.ts`: `SPACING` 1.12 em, the depth, scale and tilt per step, the opacity. `scene.ts`: `SEAT`, `STARTLE` 0.9 s, the mark sizes, trail widths and lives. `bolt.module.css`: `--wheel-y` (25 percent: where the focus line stands), the font size clamp of the names. `fall.module.css`: the row's `padding-bottom` (46 lvh: the doll's centre at 0.23 H), the middle column (0.34 of the height) and the font clamp (the word "Characters" is about 4.5 em wide and must fit its side of the doll). `fall/runtime.ts`: `TIMES` of the two lines.

## 5. END STATES (the joints)

Stage pixels, y up, origin at the middle of the viewport. `H` is the viewport height, `W` the width, `ref = min(H, 1.5 W)`.

**Bolt at local 0 (t 0, J4 from the strip).** Silverbolt: not shown (it enters at t 0.12, shown from t 0.08, off screen beyond the lower right). Doll: hidden (it appears with the dragon, attached to its head). Lines: not drawn (from t 0.15). Wheel: opacity 0. Marks and trails: none. Ground: `storm` for the kernel; my tint layer is at 0.68 and the bloom at 0.16 (both rising from 0 at t -0.5). Drone, field, logo: not used.

**Bolt at local 1 = fall at local 0 (t 4.0, J5).** Silverbolt: shown at 75 percent of its path, x about -0.30 W, y about +0.24 H, body block 1.3 x 0.24 ref tall, head toward the upper left, flight amplitude 1.25, rearing eased out, annoyance whatever the visitor made it. Doll: free (detached), thrown 0.1 screens ago: above the dragon's head, tumbling (about 85 percent of one turn left), pose between scream and fall, flail rising, mood `shocked`, same size as on the head. Camera: identity (zoom 1). Lines: nearly erased (drawn until t 4.3). Wheel: opacity 0. Tint 0.30, bloom 0.26 (both going to 0 by t 4.5). Air marks: starting.

**Fall at local 1 (t 6.6, J6, read by the hand section).** Pinned in both directions by tests (`bolt/journey.test.ts` imports the hand's `J6`, `fallEnd`, `handGeometry`, `FACES`; `hand/timeline.test.ts` imports my `END_HEIGHT`, `END_FEET_Y`, `HIPS_ABOVE_FEET`). Change a number in both places.

- Doll: visible, detached, upright, hips as the pivot: `place({ x: 0, y: (0.10 + 0.233 x 0.26) H, height: 0.26 H, yaw 0, pitch 0, roll 0, z 60, pivot: "hips" })`, so her feet are at +0.10 H. `setPose("fall", "stand", 0.7)`, flail 0.2 at rate 0.6, no squash, no talk, blink on, no look. Face: `gloom` (the mood sequence holds its last step). No bob (it fades to 0 with `settle`).
- Silverbolt: not shown (it left in the first fifth of the fall). Lines, wheel, tint, bloom: 0. Trails: gone (no `track` call: they dissolve).
- Air marks: `air` at 0.25 and two clouds at 0.1; they fade to 0 by t 6.95 (a third of a screen into the hand's section) and stop by themselves.
- Camera: zoom about 1.8 x (2.6 x on a phone), settled. Ground: `storm`. Drone, field, logo: not used. The two lines of the fall: opacity 0 from fall local 0.97.
- Seen at 1440 x 900, 1706 x 950 and 390 x 844 at S 17.88, 17.90 and 17.92: the doll's size, place, pose and face are the same on both sides of the joint (looked at, pictures in `D:\ren\aspirant-work\home\S3\run3\`).

## 6. How to look

Dev server on 3100. `node scripts/qa/probes/home-s3.cjs <outFolder>` (`BASE=http://localhost:3100`, `SIZES`, `STEPS_BOLT`, `STEPS_FALL`, `ABS_S`) takes a frame sheet at the three sizes through the two sections and prints the console errors. `ABS_S=17.88,17.9,17.92` is the J6 pair. `window.__home.seek(S)` then `freeze(true)` holds a frame; wait for the actors `silverbolt`, `doll`, `marks`, `bolt-lines` in `state().actors`. The scripts of this run (interaction by a scripted mouse, touch by CDP, frame times, a CPU profile, a log of late shader links, jumps, resize) are in `D:\ren\aspirant-work\home\S3\` (outside the repository).

## 7. Checked, and how

- Looked at in real Chrome (headless, real GPU) on the dev server, 1440 x 900, 1706 x 950 and 390 x 844: bolt at 5, 15, 25, 40, 55, 70, 85, 97 and 100 percent, fall at 5, 15, 20, 30, 35, 50, 60, 70, 85 and 100 percent; the wheel with five names; the joints at S 11.3, 15.18 and 17.88 to 17.92; jumps (to the middle of the fall, back to the dwell, before, after).
- Interaction (a scripted mouse, 1440 x 900): hover the head (PET, a heart), five pokes (annoyed: vein, stars, smoke, the label STOP IT), the jaw, the tail drag and its release, the doll (hover POKE, press: stars). A touch tap on the head at 390 x 844 shows the spark burst and the shake 120 ms later.
- Frame times on the dev server, 1440 x 900, a real wheel scroll through S 10.9 to 18.9 (843 frames): median 16.7 ms, 95th 16.8 ms, 99th 17.0 ms. The one long frame (283 to 433 ms at S 15.44 to 15.5) is the hand section being mounted, not this scene: a log of shader links at that moment lists skinned programs with no environment map (the dragon's and the doll's linked at S 11.4), and `state().sections` shows `hand` going from `idle` to `ready` at S 15.43.
- `npx vitest run src/features/home/sections/bolt src/features/home/sections/fall src/features/home/kernel src/features/home/sections/hand`: pass. `eslint`, `prettier --check`, `tsc` (filtered to these paths), `knip` (filtered) and `scan-text` are clean.

## 8. Calls made without the owner

- The ground of the bolt section is `storm` and the dark green-black is a DOM layer (`.tint`) with the bloom, not a kernel ground. Reason: `groundAt` cross-fades two opaque layers by opacity (0.5 each in the middle of a joint), so the page behind shows through as a grey wash at any dark to dark crossing. It was seen in the first frames of this run at S 11.5 and 15.2 to 15.5 and is gone with the layer. The same wash will show at every other joint that crosses two grounds (kernel `background.ts`, `blend`): the integrator should keep the lower layer opaque and fade only the upper one.
- J6 numbers: the hand section had already started from 0.26 H tall with the feet at 0.10 H, so I moved the end of the fall from 0.36 ref to 0.26 H (the camera zooms about 1.8 x instead of 2.5 x at 1440 x 900) and the two lines of the fall to the new place of the doll (centre at 0.23 H above the middle).
- The wheel stands in the upper third (`--wheel-y` 25 percent), not at the centre: at the centre the dim lines crossed the doll's face, and the face is the point of the ride.
- The throw is a sneeze. The dragon rears its head for half a screen, opens its jaw and puffs, and the doll is thrown. It plays on a slow crossing of the throw only; a jump to the middle of the fall shows the doll already falling.
- No sound effects were added (the brief names none).
- The doll's faces during the ride are my choice (grin, smug, sparkle, determined, heart eyes for the five pairs; laughing on the approach, scream in the roll, dizzy on landing, worried when the dragon rears, shocked at the throw).

## 9. Not done, not verified

- Not verified: Firefox and Safari; a real phone (the 390 x 844 pictures and the touch tap are desktop Chrome emulation); a weak machine and GPU time (the frame times are CPU side, vsync bound, dev server, 2 to 3 times slower than production); the production build; a context loss with the dragon on screen (nothing of mine holds GPU objects except the wavy lines' geometry and materials, which the pass rebuilds like any); the page with the browser's text zoom.
- The e2e suite `e2e/home.spec.ts` was not run to the end by this workstream (the dev server was recompiling under other helpers' edits); the server markup is covered by `home-page.test.tsx` and `content.test.ts`, which pass.
- The 3D pokes have no keyboard route (they are decoration; nothing the page needs is behind them).
- The strip's tail (the previews and the video flying off) is the strip's: at bolt local 0.05 the previews are still on screen and my tint is at 0.7 over their below layer. The integrator should look at that overlap once, since it was seen only in one frame.
- The wavy lines are drawn in an ortho pass of their own at order 24 (above the perspective pass, under the cast). Their stroke is `2 x HALF_WIDTH` (1.6 CSS px); the reference's is closer to 1 px at 1440. Left as is.
- The `leave()` of the runtimes does nothing: the kernel hides the slots, and the DOM keeps its last written values, which are all zero at the end of the tail.
