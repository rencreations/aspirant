# Home: the picture field (workstream F1a)

The premotio hero, rebuilt for the Aspirants: floating splash cards with a velocity smear and the cursor's wake, the spiral into a ring, the land on a wall of wide cards that slides by itself, and the full-screen rows. One actor named `field`, drawn in one pass of the home's one stage. Code: `apps/web/src/features/home/fx/image-field/`. Recon: `docs/design/home-reference/ref-premotio-garuda.md` (the premotio half). Sections (wave 3) do the scroll choreography with the API below.

## API a section uses

```ts
import { ensureField, fieldItems } from "../../fx/image-field"; // runtime: in mount(), lazy
// preload.ts of a section: import { fieldItems } from "../../fx/image-field/preload";  (no three.js)

const field = await ensureField(ctx); // the singleton, resolves when the 10 portrait pictures are textures

// every frame the field is shown (state persists, so a lab sets it once):
field.show("story", p); // scatter | gather | ring | land | wall | rows | story, t = progress in that window
field.blend({ name: "wall" }, { name: "rows" }, t, 0.5, "top"); // staggered blend: spread, ranks by top|bottom|left|right|index
field.custom(
  (i, out) => {
    /* write the whole pose */
  },
  1000,
  0.35,
); // fn, lens, edges
field.setSlide(40, 0); // the wall's glide, px/s of the wall plane; the offset is added (scroll-driven rows: rate 0)
field.setClip(field.frameRect("wall", out)); // the wall slides under its right edge: clip to the frame (null = none); pass an `out` Rect in a frame loop
field.setOpacity(1); // fade the whole field
field.setInteractive(true); // hover, click, the pointer's push, the wake
field.setHoldOnHover(true); // a hovered card stops the glide (default yes)
field.setCursor("VIEW"); // the site's cursor over a card; null in the hero
field.onClick((press) => open(press.wide)); // press.index, press.wide (WidePic: id, key), press.portrait, press.slot
field.setEdges(null);
field.setWake(true); // override the edge smear (0..1), wake on/off
field.setOrder(FIELD_ORDER_FRONT); // see "Order"
field.slotRect(i, out); // card i on the screen, CSS px from the top left (or null)
field.frameRect("wall" | "rows"); // the rectangle the wall / the rows is laid out in
field.cardInfo(i);
field.count;
field.hovered;
field.slideAt;
field.lensDistance;
field.snap(); // springs and eases to rest (after a seek, before a still)
```

Every per-frame setter takes plain arguments and mutates its state in place, and the actor allocates nothing per frame (one scratch look, one composite description, one stir, spec objects mutated in place). The only allocations a section can cause are the `FormationRef` literals it passes to `blend` and an `out` it forgets to pass. Import `fieldItems` from `fx/image-field/preload`, never from the index (the index pulls three.js into every page's bundle).

Loading list: `fieldItems("hero", { wide: "waited" | "deferred", priority })` is the chunk (1), the ten 4:5 cards (1.45 MB, waited) and the eighteen wide pictures (2.5 MB, waited by default as design section 6 says). With `"deferred"` the wide pictures load behind everything else: the field does not fetch them at mount, takes them from the store as the list delivers them, and a card that turns wide first (`shape` above 0) asks for them itself (a download the list already runs is shared, never started twice) and shows its portrait in the meantime. `ensureField` resolves when the portraits are textures. It is not wired into any section yet: the hero section adds it to its `preload()`.

## The formations (all pure, tested)

`formations.ts` over `story.ts`, `wall.ts`, `scatter.ts`. 18 cards (the length of `wall.order`). Frame: origin at the middle, x right, y up, 1 unit = 1 CSS px at z = 0.

| name      | what                                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scatter` | the hero: cards around a clear box of 70 percent of the width (the logo), four big at the corners, two tiers behind. Seeded, same every load                                                                                                                      |
| `gather`  | t 0..1 = story p 0.04..`RING_P` (0.38). The cards highest on the screen are picked first (0.05..0.21) and spiral in the ring's own cylindrical frame (angle quintic to the slot, radius to 0.75 R, height to 0). The ring is tilted 22 degrees, turns half a turn |
| `ring`    | story p `RING_P`. Standing cards facing outward. Radius is the smaller of 0.4 W, 0.42 H and 384.6 (see below)                                                                                                                                                     |
| `land`    | t 0..1 = p `RING_P`..1. Each card leaves the ring in angular order and flies a quintic Hermite (ring velocity and acceleration at the start, rest at the end) to its wall slot, turning flat and wide (4:5 to 16:9, picture cross-faded)                          |
| `wall`    | 3 rows of 6 wide cards, twist 35, tilt 53, roll -6, card height 0.36 sqrt(frame area), seen through a 2000 px lens, in the left 58 percent (the top 56 percent on a tall screen)                                                                                  |
| `rows`    | the same plane over the whole screen, card 0.34                                                                                                                                                                                                                   |
| `story`   | the whole chain at p 0..1                                                                                                                                                                                                                                         |

`slide` is one number for the whole field (wall plane px). `rows` reads it times `rowsPerWall` (the ratio of the two card widths), so a wall to rows blend keeps every card at the same phase of its row however far the rows have slid (tested at slide 30000 and 123456). A card lands on the wall slot of its own character when it has one (`cardKeys`, `slotKeys`); its wide picture is the one of the slot it lands on (`pictures.ts`), so the wall's own neighbour rule holds exactly. Portrait pictures cycle (card i shows portrait i mod 10).

## How it draws

- One `Pass` named `field` (`FIELD_ORDER = 12`), added with `stage.addPass`. Its own perspective camera: the lens distance changes (1000 pixel lens, 2000 for the wall), `fov = pixelFov(h, d)` is refit every frame, so a point at z = 0 stays pixel exact. One lens per frame is shared by drawing, hit testing and `slotRect`; a blend mixes the two lenses with the blend's own t.
- Cards: 18 meshes, one 16 by 16 plane, one shader program, one material each. The quad is the card plus a pad (shadow offset and blur, half the streak) so neither is cut. Fragment: two pictures cross-faded by `shape`, cover-fitted and centred on each picture's subject point, SDF rounded corner with one pixel of soft edge (premultiplied by the same coverage, no fringe), a hair of edge shade, one light from the upper left front, soft shadow under the card, and a streak of up to 14 weighted taps along the card's own screen velocity (premotio's red-to-blue spectrum, normalised by the weight sum, a per-pixel grain start). Back face is the mirrored picture. Pictures are sampled with `textureGrad` and analytic gradients, so mips and anisotropy hold under the streak.
- Cards go to one full-size RGBA8 target (premultiplied, no depth, painter's order by three's own transparent sort), then one composite writes to the canvas: the wake moves where the picture is read, a multi-tap smear along the wake's flow and, at the frame edge, outward from the middle, a colour split where the flow rises, a glint where it curls, dither. A scissor does the clip.
- Wake: ping-pong RGBA16F of 160 texels on the long side, one fragment pass a frame while live (2.45 s after the last stir), then cleared once and skipped. Off if the renderer cannot draw to half float (no fallback needed on WebGL2 in practice).
- Colour: raw sRGB end to end (textures not decoded, nothing encoded, shaders write bytes). Checked: a camera-facing card against its source file, mean RGB 144.81 139.92 162.85 against 145.16 140.27 163.18, block-mean difference 0.46 levels (max 2.65 at the rim).
- Textures: `fetchWhole` + `createImageBitmap` (the library's own pattern in `shelf/cover-art.ts`), NOT `imageItem`: that decodes through a non-CORS `Image`, which the browser caches and which then poisons a CORS read of the same R2 address, and WebGL needs CORS. Wide pictures are cropped to their `clean` window at decode (the game's corner mark is out), so the texture is 16:9 and 24 percent smaller. Uploaded two a frame after creation (`initTexture`); the bitmap a texture holds is closed after its first upload (its memory goes back), a later bitmap under the same id is never touched, and a download in flight is shared between the list and the field. Unflipped: the picture's v runs from the top, the shader knows. Mips on, `LinearMipmapLinear`, anisotropy 8.

## Live motion (`live.ts`, `spring.ts`, `carousel.ts`, `wake-math.ts`)

All integrated in `update`; the formation pose itself is never sprung (a pure function of what the section sets), so a seek or a scrollbar drag lands exactly and nothing flies. Velocity across a jump of more than half the short side is dropped.

- Idle float (garuda): 9 px and 0.05 to 0.07 rad out of phase per card, times the pose's `live` (0 on the wall).
- Parallax: `0.115 z ndc` px, near cards follow the pointer, far ones go the other way, plus a small tilt. Times `live`.
- Pointer push (premotio 1.5): radius `max(190, 0.42 min(w, h))`, falloff `(1 - (d/R)^2)^2`, away from the pointer plus its stroke, low-passed (8/s), into an offset spring (period 1.15 s, zeta 0.56) and tilt springs (1.5 s, 0.45). `PUSH.gain = 0.45` scales the digest's force down (the cards are bigger and fewer). Times `live`, and fades to 15 percent on a hovered card so the card does not run from the pointer that lifts it.
- Hover (our own, not gated by `live`, so the wall has it): the card under the pointer (nearest first, hit test on the projected quads of the last frame, grown 6 px for the hovered one) eases (10/s) up 46 px toward the camera, grows 5 percent, leans toward the pointer, gets a deeper shadow; its neighbours part by up to 22 px. A press squeezes it 3 percent; a click (press and release on the same card within 12 px) calls the handler.
- Carousel: `stepCarousel` glides at `rate`; a hovered card stops it (tau 0.1 s, still within 0.5 s), it waits 0.35 s after the pointer leaves and starts again (tau 0.3 s).
- Streak and bend: card velocity on the screen (low-pass 12.5/s), streak `0.022 v` px, capped at 4 percent of the short side, none under 1.5 px (the wall's slide stays crisp). Paper bend `0.9 tanh(v/2400)`, flutter `0.05 tanh(speed/2400)` of the height.
- Wake stir: pointer velocity low-passed (25.8/s), force capped at 1700 px/s, no stir under 12 px/s, brush 5 percent of the short side.

## Numbers to tune

`story.ts TIMELINE` (freeze 0.04, picks 0.05..0.21, flight 0.13, leave 0.42..0.78, latch 0.5, tilt 22), `ringSpec` radius, `formations.ts` wall `size` (0.36 wide, 0.5 tall) and rows `size`, `scatter.ts` (`cardBase`, tiers, tilt ranges), `live.ts` (`PUSH`, `STREAK_*`, idle amplitudes), `shaders.ts` (edge smear 0.032 of the short side from 0.84 of the half frame, light 0.28 in `actor.ts`, shadow strength 0.18, hover 0.28), `HOVER_LIFT`, `HOVER_GROW`, `PART_REACH` in `actor.ts`.

Deviations from the digest: ring radius uses 0.42 H, not 0.32 H (the recon frame's ring is 1.3 times wider than 0.32 H gives: 620 against 480 px at 1440 by 900); the edge smear is 0.032 (digest 0.058) because ours has many more cards at the frame edge; no global lens pull, no DOF cross-fade (see Not done).

## Order

`FIELD_ORDER = 12`: behind the logo (15), the drones (20) and the lit cast (30), above the flat ortho pass (10). The brief said between 20 and 30; that would draw the cards over the logo and over the drone resting at the lower right, so the logo stays the highlight and the drone stands in front of the art. `field.setOrder(FIELD_ORDER_FRONT)` (25) puts the pass over the logo and the drones. The integrator decides; nothing else changes. Not done: the digest's split (far cards behind the logo, the four big corner cards in front) needs two composites; say if wanted.

## Measured

Machine: this laptop, real Chrome, 1440 by 900, dev server (2 to 3 times slower than production for JS; the shaders do not care). **18 cards measured** (one for each wall slot, with 28 pictures behind them). The brief's 28 cards were not measured: the CPU cost is linear in cards, so about 0.6 ms for 28 is an estimate. Wake and smear on. The land row has an occasional 2 ms draw in the lab because the wide textures are first uploaded there; in the page they are taken at mount and uploaded two a frame before.

| scenario                         | update (CPU) med / p95 | draw (CPU submit) med / p95 | GPU (timer query) DPR 1 | GPU DPR 2 (2880 x 1800) |
| -------------------------------- | ---------------------- | --------------------------- | ----------------------- | ----------------------- |
| scatter, pointer sweeping (wake) | 0.1 / 0.4 ms           | 0.3 / 0.6 ms                | 0.18 ms                 | 2.0 ms (p95 3.0)        |
| ring turning                     | 0.1 / 0.3              | 0.2 / 0.7                   | 0.37                    | 1.6 (p95 3.4)           |
| land, all in flight, streaks     | 0.1 / 0.3              | 0.2 / 0.3                   | n/a                     | n/a                     |
| wall sliding, hover              | 0.1 / 0.2              | 0.2 / 0.3                   | 0.11                    | 2.0 (p95 3.4)           |
| rows                             |                        |                             | 0.23                    | 2.1 (p95 4.9)           |

The actor keeps its own clock from the frames' `dt`: the kernel's `frame.time` keeps running while `__home.freeze(true)` is on (only `dt` goes to 0), so a frozen frame would otherwise keep floating.

Frames stayed at the display's 16.7 ms through a 6 s story run (p95 16.8). The cost at DPR 2 is the full-screen composite and the card fills; nothing is gated on the device. The wake targets are 160 by 100 RGBA16F (0.13 MB each). The card target is 5.2 MB at DPR 1 and 20.7 MB at DPR 2 (RGBA8, full scale: it holds the pictures, half scale would blur them).

GPU memory for the pictures, mips included: 10 portraits at 960 by 1200, 6.15 MB each, 61.5 MB; 18 wide cropped to 1114 by 626 (the clean window), 3.72 MB each, 67 MB; about 129 MB in all (a 28 picture field at the other sizes in the digest, 1280 by 720 uncropped, would be 150 MB). CPU memory for the bitmaps is released after upload.

## How to look at it (the lab recipe)

`window.__home.lab("field")` returns the actor, pinned shown, in the real renderer. Scripts (not in the repo): `D:\ren\aspirant-work\home\F1a\` (`lib.cjs` opens real Chrome with the intro off and the lab's `window.__f`; `formations.cjs` shoots every formation at 1440 by 900 (`SIZE=tall` for 390 by 844) and `sheet.py` tiles them; `pointer.cjs` the sweep, the hover, the wall's slide, stop, click and resume; `motion.cjs` drives the story from a rAF loop and shoots in motion; `perf.cjs` and `gpu.cjs` the numbers; `color.cjs` the colour check; `misc.cjs` the hero with the logo actor, a resize, and a lost and restored context). Minimal:

```js
await page.evaluate(async () => {
  window.__f = await window.__home.lab("field");
});
await page.evaluate(() => {
  __f.show("story", 0.3);
  __f.snap();
});
await page.waitForTimeout(400);
await page.evaluate(() => __home.freeze(true)); // let it settle before freezing
await page.screenshot({ path: "x.png" });
```

The hero stub's pink card and the dev overlay badge show in shots: ignore them.

## The wake, shown

The wave was proven with a frozen A/B: sweep fast across the lower cards, `freeze(true)`, shot, `setWake(false)`, shot, diff. 33 452 pixels changed, all around the swept cards (a vertical wave smear and a red and blue split across the bunny card, ghosting on the cards below it). A sweep over the empty middle changed 8 367 pixels, only at the cards near the stroke. The wake texture read back after a sweep: 160 by 100, no NaN, a band along the stroke, peak 1144 px/s, 20 percent of the texels above 10 px/s. (`wake.cjs`, `wake2.cjs`, `wakeread.cjs`.)

## Looked at

Contact sheets of scatter, gather (0.2, 0.45, 0.7, 1), ring, land (0.2, 0.4, 0.6, 0.8), wall and rows at 1440 by 900 and 390 by 844; the sweep and hover shots; the wall with the clip, VIEW and the lifted card; six frames of the story in motion (the streaks read as premotio's flying band); the hero with the real logo actor over a scatter; a resize to 390 by 844 and back; a lost and restored context (the wall came back with its pictures, `failed` false). Compared by eye with premotio's `00-rest`, `f-00900`, `f-01350` and `f-03600`.

## Not done, not verified

- Not wired into a section or the loading list: `fieldItems` was never run through the real bar, only the actor's own fetch path (the lab fetches the bitmaps itself). Hero section: add `fieldItems()` and call `field.show` every frame. The shared in-flight download (the list and the field at once) is reasoned, not seen under a slow network.
- Kernel: `stage.target()` has no way to take a target out, so the field's disposed card target stays in the stage's list and keeps being resized until the stage goes.
- Cut: the half-resolution smear pass (the full-resolution pass costs 2 ms at DPR 2), the global lens pull, the Garuda depth-of-field cross-fade, two-layer ordering around the logo, a portrait set of 12 cards (the tall screen shows 18 smaller ones, crowded but legible).
- Not looked at: touch (the push and the wake follow `pointer.state` and are off between touches; the press target logic is the kernel's), Firefox, Safari, a weak or integrated GPU, the production build, text zoom. The wake and the colour check ran on this machine's GPU only.
- The wall's number of rows is 3, as briefed. The wall does not fill its frame to the corners (the plane's far corners are thin), as in premotio.
- The tall screen: wall frame is the top 56 percent; its look was checked, not tuned.
- The context loss test used `WEBGL_lose_context` (lost 400 ms, restored): pictures reload from the browser's cache through `rebuilt()`. A real GPU reset was not tried.
- Unit tests cover every pure part (63 tests: formations, joints, gather order, wall at any slide, the lens, scatter, ranks, springs, push, idle, streak, bend, carousel, wake arithmetic, the picture set equal to `picks.json`, the card pictures). The three.js parts are checked by looking, not in jsdom.
