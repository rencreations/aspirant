# Actor: the normal drone (workstream DR)

> **Round two update (19 Nov 2026).** The drone has no speech bubbles: `bubble()`, the bubble mesh, `bubble-place.ts`, `bubbleAt`, the icon names other than the bang, `PoseLook.cue` and the reactions' icons are gone (`Answer.shock` replaces `icon`). The shock mark stays: `shock(seconds)`. The icons file is loaded for its bang only. See `round2-R-A1.md` section 4.

The Aspirants' official mascot, in the home's shared renderer, with the About page's look. Code: `apps/web/src/features/home/actors/drone/`. A plain TS class, no React. The model is `/models/about/drone.glb` (never changed); the extra faces and the icons are M2's (`public/img/home/drone-faces.webp`, `drone-faces-2.webp`, `marks.webp`).

## 1. What a section does

```ts
// mount(ctx): the drone is built once and shared (a second ask finds the first)
const drone = await ensureDrone(ctx); // from "../../actors/drone"

// update(local, frame): set the state EVERY frame the drone is shown
drone.visible = true;
drone.place({ x, y, height }); // stage pixel frame: middle origin, y UP
drone.face("happy", ramp); // a face and how strongly it is worn (0..1)
drone.look("pointer"); // or { x, y }, or null
```

The kernel hides every actor before the sections run: a drone that no section sets is not shown. Setters are sticky between frames (a face holds until another is set), so a section that takes the drone over from another calls `drone.reset()` in `enter()`. `place` is the one setter a section must call each frame.

### The API (`DroneActor`)

```ts
place({ x, y, z?, height, yaw?, pitch?, roll? })  // target the drone springs toward; nothing a visitor does moves it
snapTo(place)                                     // same, with no flight (a jump, an opening, a probe)
layer("back" | "front")                           // behind (default) or in front of the lit cast (doll, Selena...)
face(name, blend = 1)                             // 27 faces, see 3; worn at blend >= 0.5, kept until < 0.35
emote(name, seconds = 1.2)                        // a face for a while over `face`, then given back
look({x, y} | "pointer" | null)                  // eyes and body; "pointer" follows a mouse only
bubble(icon, seconds = 1.7)                       // icon-only speech bubble: pop, wobble, drift up, fade
shock()                                           // comic shock mark above the head: burst of lines and a "!"
appear() / disappear()                            // pop-in with overshoot and wing flutter / shrink away; idempotent
trickNow(kind, dir = 1): boolean                  // barrel frontflip backflip spin wiggle loop hop roll nod dizzy shake bow
pose("peek" | "thanks" | null, side = 1)          // see 4
setInteractive(on)                                // hover and press reach it (default true)
reset()                                           // face, look, pose, layer, interactive, presence and one-shots to defaults
socket("above" | "side"): Object3D                // a point for a mark or another actor, see 5
state()                                           // what is drawn, for probes and for a section that stands something beside it
advance(seconds) / faceNow(name)                  // probes only: run the drone's own clock; wear a face at once
```

`besidePoint(point, side, height, out)` and `alongPath(points, progress, out)` (`path.ts`, exported by `index.ts`) return a place: the drone beside a point (it faces the point), and the drone along a Catmull-Rom curve through points (the parameter follows arc length; the height goes from point to point; outside 0..1 it stays at the ends). The drone's own springs make the flight nose first. Pass the result to `place` (`alongPath` gives `{x, y, height}`).

`droneItems({ deferred = true, priority = 10 })` (`preload.ts`) is the loading list: the script chunk (`home-drone`), the model (250,192 B), the two face pages (21,286 and 12,976 B), the icons (24,700 B). All `deferred` unless a section says `deferred: false` (the loader and the hero). The page A and B faces and the icons are not needed to draw the drone at rest: a page that did not arrive shows the plain face and no bubble (a handled failure, logged once).

## 2. How it works

Files (each pure file has a vitest file beside it):

| file                                           | what                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `actor.ts`                                     | the class; composes one pose per frame; hit target; sockets; probes                                                            |
| `scene.ts`                                     | three side: model, hull outline, face shader, lens, bones. The About scene minus renderer, canvas, clear and context listeners |
| `flat.ts`                                      | flat things in pixels: the cyan trail, the speech bubble, the shock mark                                                       |
| `coords.ts`                                    | the only door between the stage frame (y up) and the motion's screen frame (y down); depth; jump test                          |
| `follow.ts`, `ease.ts`, `rig.ts`               | springs, attitude from velocity, float, look; wings, fins and strips. Ported from `about/choreo/`                              |
| `tricks.ts`, `reactions.ts`, `pose.ts`         | the moves; the answers to presses; the named poses                                                                             |
| `faces.ts`, `face-state.ts`                    | the 27 drawings and their mood; which drawing is shown, blinks, eye slide                                                      |
| `marks.ts`, `marks-anim.ts`, `bubble-place.ts` | icon cells; timing of bubble and shock; where the bubble stands                                                                |
| `presence.ts`, `path.ts`, `model.ts`           | pop-in and out spring; the two placing helpers; numbers and files                                                              |

**Look.** Same code and constants as `/about`: unlit `MeshBasicMaterial` (`toneMapped = false`), a 20 degree lens 8 m away, the picture slid with the camera's view offset (`setViewOffset(w, h, -x, -y, w, h)` in the middle-origin frame), an ink hull of 1.1 to 2.4 px kept constant on screen (`#1f2735`), the face atlas read by the shader (cell, blink squash, eye slide). The home adds one thing: the face material swaps its `map` between three pages (S the model's own, A and B) for the face shown. Cells cannot blend, so a change of drawing is hidden behind a quick blink (`SWAP` 0.15 s); a drawing with `blinks: false` (symbols, closed eyes) is not blinked.

**Motion.** The About rules in the screen frame: critically damped springs (omega 7.2 place, 6.4 size, 7.5 yaw, 8.5 pitch, 9.5 roll), exact solutions (the same line at 60 and 144 Hz), attitude from its own velocity (a flight is nose first, never a rewind), bank into turns, float and sway at rest scaled by `calm`, wings that beat faster with speed and flare to brake, fins that stand for joy and fall for sorrow (`droop`, new). A target that moves by more than 0.9 of the screen diagonal in one frame, a drone that was not shown last frame, and a scene position that jumped more than 1.2 screens all put the drone on its target at once with no spring left flying (`snap`). `dt` is capped at 0.05 s.

**Interaction.** One 3D hit target (`id: "drone"`, cursor "HELLO", a circle of radius half the height, depth 600 behind the cast or 100 in front). `test` returns null while the actor is hidden, not interactive, or less than 0.35 present. Hover: happy face, a lift of 0.045 widths and 5 percent bigger (drawn only, the target never moves), and the eyes and body follow the cursor. Press (`reactions.ts`, on the drone's own clock): the first presses answer with hop, roll, nod and a heart, a sparkle, a smile; three presses within 2.4 s make it dizzy; the fourth puzzles it (`?`, confused); the fifth annoys it (angry, a shake, the shock mark); more presses extend the annoyance by 1.8 s to at most 6 s; when the visitor stops it forgives (a nod, a heart bubble, the thanks face) and is calm again. A trick asked for while another plays waits for it (the latest one asked for is kept), so two never play at once. Nothing here moves the target, so it works for a drone that stays in one place.

**Presence.** `appear()` on a hidden-then-shown frame, or after `disappear()`, starts a spring that runs to about 1.22 and settles on 1 (measured: 0.47, 0.94, 1.22, 1.16, 0.96, 0.98, 1.01 at 50 ms steps); the wings flutter while it moves. `disappear()` shrinks it with no overshoot, gone in half a second.

## 3. Faces and marks

27 faces: `normal angry squint happy dead scan ecg sleepy alert` (About's nine) and `shocked confused thanks sweat exclaim question sparkle sad dizzy proud cry heart smug wink dots music determined laugh` (M2's 18; `faces.test.ts` keeps the table equal to `drone-faces.json`). Each has a mood for the body (`MOOD_TABLE` in `faces.ts`: happy, flare, droop), scaled by the blend.

Icons for `bubble()`: `heart sparkle thanks smile bang question note dots sweat`. The first six are `marks.webp`; `note`, `dots` and `sweat` are drawn in code beside them (a third row of the same picture). The bubble body is one picture drawn once in code with the drone's ink line. A bang press uses the shock mark alone (a bubble with the same "!" would say it twice).

## 4. The two named poses

`pose("peek", side)`: the drone has stepped to the edge and looks at something on `side` (-1 left, 1 right): face and eyes turn to it, a lean, a little smaller, wings low. `pose("thanks")`: a bow (1.25 s: down, held, up) with the thanks face, happy fins and the thank-you bubble, made once when the pose begins. Both blend in and out (omega 7) and leave nothing behind. The section places the drone; the pose only shapes it. For the carry mode of the intro: `place` at the corner, `pose("peek", side)`, `look({x, y})` at the thing.

## 5. Sockets, and where this differs from the brief

- `socket("above")` and `socket("side")` are Object3D that are in no scene: their `position` (stage frame) is written once a frame after the drone has moved, and `userData.height` is the drone's height. A section copies the position into a mark or another actor each frame. They cannot be parented to, because the drone draws through a lens of its own (20 degrees at 8 m with a view offset) in its own passes, and anything parented would leave its pass's scene. The drone's bones are not exposed: the model has no hand bone and the brief never carries anything in it.
- The drone has two passes of its own, not `scenePass("perspective")`: `drone` at order 25 (over the flat passes 10 and 20, under the cast 30) and `drone-front` at 35 (over the cast, under the comic marks at 40). Only one is active. This is the same lens as `/about`, which a pixel perspective camera cannot give without changing the look.
- Only two pure constant modules are imported from `features/about/` (`media.ts`, `drone/model.ts`). The rest was copied and adapted.
- `height` is the model's bind-pose height from the file's own bounds (0.44748 m, a test reads it). The drawn silhouette (antennas to chin, wings at rest) measures 1.06, 1.044 and 1.0375 times `height` at 80, 160 and 400 px: the ink line (2 to 5 px) and the rest tilt of the fins.
- The parsed GLB is forgotten by `loadGltf` as soon as the drone has built its copy (the build adds hulls and re-parents bones), so no other ask gets a changed scene.

## 6. Numbers to tune

`follow.ts` OMEGA_* and MAX_*; `actor.ts` HOVER_LIFT 0.045, HOVER_GROW 0.05, TRAIL_LIFE 0.36 s, S_JUMP 1.2, DT_MAX 0.05, BACK_ORDER 25, FRONT_ORDER 35, hit radius 0.5 height; `coords.ts` JUMP_DIAGONALS 0.9, default yaw (it faces the middle of the page, 0.38 rad at the edge); `presence.ts` POP_OMEGA 17, POP_ZETA 0.42, GO_RATE 14; `reactions.ts` WINDOW 2.4, DIZZY_AT 3, PUZZLED_AT 4, ANNOYED_AT 5, ANNOYED_HOLD 1.8, ANNOYED_MAX 6, FORGIVE_SECONDS 1.8; `marks-anim.ts` BUBBLE_SECONDS 1.7, POP 0.24, SHOCK_SECONDS 1.15; `bubble-place.ts` OVER_X/Y, BESIDE_X/Y, MARGIN; `tricks.ts` TRICK_SECONDS; `faces.ts` MOOD_TABLE, ENTER_BLEND 0.5, LEAVE_BLEND 0.35.

## 7. How to look at it (the lab recipe)

Dev server `http://localhost:3100`. Scripts are in `D:\ren\aspirant-work\home\DR\` (not in the repo): `lib.cjs` (opens the home with intro off and consent answered, builds the lab drone as `window.__d`), `faces.cjs` + `sheet.py` (all 27 faces at 80, 160, 400 px), `marks.cjs` + `msheet.py` (nine icons and the shock at several sizes and places), `match.cjs` + `cmp.py` (pixel match with `/about`), `interact.cjs` (real mouse: hover, look, presses, spree, forgiveness, pop), `motion.cjs` (flight, jump, poses, resize), `perf.cjs`, `loss.cjs`, `loss2.cjs`, `layers.cjs`, `height.cjs`.

```js
await page.evaluate(async () => {
  window.__d = await window.__home.lab("drone");
});
await page.evaluate(() => window.__home.seek(7)); // a quiet section: the hero's logo is in the text layer and covers the canvas
await page.evaluate(() => window.__home.freeze(true));
window.__d.snapTo({ x: 0, y: 0, height: 160, yaw: 0, pitch: 0, roll: 0 });
window.__d.faceNow("shocked");
window.__d.bubble("heart", 3);
window.__d.advance(0.45);
```

With the scene frozen, `update` runs with dt 0; `advance(s)` runs the drone's own clock (float, springs, marks, tricks) in 1/60 s steps. To hide the page and keep the canvas: `body * { visibility: hidden !important } canvas { visibility: visible !important }`.

## 8. What was checked (dev server, real Chrome, 1440x900, 390x844, looked at)

- **Pixel match with `/about`** (`match.cjs`): the About drone frozen at its hero pose (x 207, y 611, size 662, yaw 0.84), the home drone placed at the same size and attitude (the float of the home corrected, drawn pose equal to 4 decimals). Silhouette boxes agree to 1 px (497 by 822). Over the body, outside the eyes and the wing, the mean difference is 0.056 of 255 and 0.01 percent of pixels differ by more than 12. The eyes differ (the About frame was caught mid-blink) and the wing differs (another phase of the beat). Not compared: the About wings at the same phase.
- **Faces:** all 27 at 80, 160 and 400 px at ratio 1, and at 80 px at ratio 2: every one reads at 80 px. `scan` and `ecg` are About's own thin lines and are the faintest.
- **Marks:** nine icons and the shock at 160 px mid screen, at 80 and 400 px, near the right edge, at the top edge, at 390 wide (middle, right edge, top). The bubble goes to the side with room and, with no room over the head, stands beside it, so the face is never covered. `bubble-place.test.ts` holds the whole-bubble-on-screen rule over a grid of places on both screens.
- **Real mouse:** hover sets `hit: "drone"`, a happy face, the "HELLO" cursor; look follows the cursor in yaw and pitch (nose up for a cursor above); three friendly presses answer hop, roll, nod with heart, sparkle, smile; a spree of seven presses gives happy, happy, happy, confused with "?", then annoyed (angry, shake, shock mark) and stays so; stopping gives forgiving (thanks face, nod, heart) about 1.6 s after the last press and calm about 3.6 s after it. After all of that the target had not moved (the difference is the float).
- **Flight:** from (-520, -220) to (480, 230): the nose goes along the flight (yaw to 1.08, pitch to -0.57 for a climb), banks, the wings beat, a cyan trail streams behind, and it settles upright in about a second. A step of 0.95 diagonals snaps. Resize from 1440x900 to 390x844 in the middle: the drone stays at its place in the pixel frame.
- **Layers:** with the doll's lab actor (cast pass) overlapping, `layer("back")` puts the drone behind her and `"front"` in front.
- **Context loss:** lost then restored, and lost for good (the stage made a new canvas): the drone, a page B face (`heart`) and the bubble draw after both; no console error. Disposed: both passes are removed, no console error. Unpinned: not visible and not hit.
- **Performance** (dev server, 420 frames of a wide flight with a bubble every 1.5 s and the shock mark every 2 s): `update` median 0.1 ms, p95 0.2 ms; `draw` (the CPU side of `renderer.render` for the model) median 0.2 ms, p95 0.4 ms; frame gap median 16.7 ms, p95 16.9 ms at 1440x900 and at 390x844 (60 Hz, no dropped frame). `performance.now` has a 0.1 ms step in this page, so the numbers are good to that. Nothing is allocated per frame in `update`, the drawing or the marks (a read of those paths for `new`, object and array literals: no heap profile was taken).
- **Unit tests** (7 files, 76 tests, `npx vitest run src/features/home/actors/drone`): coordinates and depth, face table equals the JSON, motion (follower, float, look, rig, face), moves and answers and poses and icons and marks timing and placing helpers and the model's height, presence, bubble placement, loading list and real file sizes. `eslint`, `tsc` and `knip` are clean for the folder.

## 9. Not done, not verified

- The production build and `scripts/perf/weak.mjs` (helpers do not run `pnpm build`); GPU time (no timer query); the chunk's real gzip size.
- `droneItems()` was not run in a browser: no section imports it yet. Its structure, ids and the real file sizes are unit tested, and the actor loads the same files through the same media store by itself.
- Firefox, Safari, a real phone and touch (a touch press goes through the kernel's hit target, which was not run with touch here).
- The drone driven by real sections (the loader, hero, strip, voices, funny, chase, archive, footer): none exists yet. The exit to the right for the footer is the section's job (`setExitHook`) with `place` and a flight.
- The `front` layer against the comic marks pass (order 40): the marks helper's pass was not in the lab.
- Not built: a general comic marks library (the fx helper's), the carried logo, the hand-off drone to `/about` (the About page builds its own).
