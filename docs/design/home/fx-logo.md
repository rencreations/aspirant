# Home: the logo wave (workstream F1b)

> **Round two update (19 Nov 2026).** The big logo stands perfectly still at rest: the hero's `REST_WAVE` and the intro's `LOGO_REST_WAVE` are 0, and the pointer ripple is opt in (`LogoPose.ripple`, default false). The morph keeps its wave: `waveEnvelope` gives the calm ripple the logo used to rest in (`MORPH_KICK` 0.3) as the first 8 percent of the morph, so from P 0.08 the wave is the old one. See `round2-R-A1.md`.

The Aspirants logo as an actor of the home's one stage: a finely cut quad, drawn from the vector, that stands big in the hero, can be carried and tipped, morphs with a travelling wave into the top bar's logo, and hands over to the real DOM logo with no visible change. Code: `apps/web/src/features/home/fx/logo/`. Brief and numbers: `docs/design/home-reference/logo-wave-morph.md`.

## 1. Files

```
actor.ts    LogoActor (the class the sections drive), LOGO_ORDER, LogoPose
math.ts     pure: art box, rects, hero size, the nav target as Chrome paints it, the reel's stagger,
            the wave envelope, the sag, sockets, the CPU copy of the vertex shader (warpPoint)
shader.ts   the vertex and fragment shaders (the same formulas as math.ts, in GLSL)
mesh.ts     the 192 x 56 quad, the material, the two textures, the uniforms
raster.ts   Path2D to canvas: texture A (hero), texture B (nav), the pointer mask; browser only
dom.ts      readNavTarget, NavTargetWatch, showNavLogo (the only places the logo meets the page)
preload.ts  logoItems(): one waited item (the actor's code and the drawing of the big picture)
index.ts    ensureLogo(ctx), re-exports, window.__logoFx for probes
math.test.ts, preload.test.ts
```

Shared file touched: one line in `kernel/lab.ts` (`logo`), written by the earlier run of this workstream; its import resolves and compiles. Nothing else shared was edited.

## 2. The API a section uses

```ts
import { ensureLogo, heroRect, NavTargetWatch, showNavLogo } from "@/features/home/fx/logo";
// (a section's preload.ts imports "@/features/home/fx/logo/preload", never the index: three stays out of the server bundle)

const logo = await ensureLogo(ctx); // mount; the actor is shared, named "logo"
const nav = new NavTargetWatch(); // mount; nav.dispose() in dispose()

// every frame the section shows the logo (the kernel hides the actor first):
const vp = ctx.viewport();
const target = nav.get(vp.w, vp.h); // the bar's logo, as the browser paints it (cached)
logo.place(heroRect(vp.w, vp.h), { wave: 0 }); // or any { cx, cy, width } of the ART box, stage px
logo.morph(P, target); // P 0..1, a pure function of P: it reverses
const done = logo.handoff(P); // true from P = 0.999
showNavLogo(done); // the bar's own logo, no fade (hideLogo)
logo.visible = !done; // same frame, after showNavLogo
```

| call                                        | what it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `place(rect, pose?)`                        | The big logo in a rect: `{ cx, cy, width }`, the centre of the ART box and its width in stage pixels (origin in the middle, y up). The art box is 2708.2 x 674.8 logo units (aspect 4.013), not the viewBox. Sets P to 0. `pose`: `roll` (radians, in the plane), `tilt` (about the horizontal axis, top toward the camera when positive), `yaw`, `wave` 0..1 (a calm ripple at rest; it lets go as the morph starts, `waveEnvelope`, so a section may pass it every frame and the logo is still flat at the bar), `reveal` 0..1 (rises into place under a soft front), `tension` 0..1 and `wobble` -1..1 (the hang, see below), `opacity` 0..1. Anything left out means "none". |
| `carryBetween(left, right, pose?)`          | Holds the logo by its `left` and `right` sockets on two points of the screen (two drones' hands). Scale and roll follow the distance and slope of the points. A `place` with the right numbers, nothing more.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `morph(P, target)`                          | `P` 0 is the rect given to `place`, 1 is the bar's logo to the pixel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `handoff(P)`                                | True from 0.999.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `matchesDom(target)`                        | True when the canvas and the page share a pixel grid (stage ratio equals page ratio). When false, fade the actor out under the bar's logo (see 5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `socket("left" \| "right" \| "bl" \| "tr")` | An `Object3D` in the logo's own scene that follows the bend, the sag and the pose. Position is in stage pixels, `rotation.z` is the heading of the logo there. Copy its world position to a drone each frame. Never `attach` another actor's root to it (that root would leave its pass and be drawn by this one). `left`/`right` are on the slanted ends at one height (the hang is between them), `bl`/`tr` are the two corners the reel leads and trails with (pull to grow).                                                                                                                                                                                                 |
| `jolt(amount)`                              | A knock to the sag (-1..1): a drone stumbles, the logo is let go. Timed inside, always finishes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `poke(x, y, strength)`                      | A ripple from a stage point.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `currentRect()`, `info()`                   | For sections and probes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

`tension`: 1 is taut and flat, 0 hangs loose and heavy (the middle drops 0.5 of the art's height, 337 units). It is a spring (omega 10, zeta 0.38: a pull makes it bounce) toward `1 - tension`; a step bigger than 0.75 snaps, so a jump never leaves it flying. `wobble` moves the heaviest part to one side: drive it from the carriers' bob. The bend lets go as the morph starts (it is not weighted by the corner stagger), so the bar's logo is never bent.

The pointer: the logo registers one 3D hit target (the silhouette as a 256 x 64 mask, depth 900 so anything in front wins, null while hidden, while P is over 0.3 or while the reveal is under 0.6). Hovering drives a ripple that follows the cursor and fades when it leaves; a press adds a strong one. No cursor label.

## 3. How it works

- **Pass.** `stage.scenePass("logo", "perspective", 15)`: after the flat field (ortho 10), before the drones (perspective 20) and the lit cast (30) and the marks (40). Depth test off, premultiplied blending, so a drone always draws over the logo in painter's order.
- **Picture.** `LOGO` (the traced vector) is filled with `Path2D` in the order of `LogoLayers` into texture A: the art plus 24 units of clear margin each side, `texW = min(4096, ceil(artCssW * dpr * 1.25 * REG.w / ART.w))` (1440 at 2x: 2565 x 673), mipmapped, anisotropy up to 8, premultiplied, `NoColorSpace` (a `ShaderMaterial` is not colour converted, so the values are the DOM's). It is rebuilt only when the pixel ratio changes or the width moves more than 10 percent. The mascot is part of the picture (the big logo does not blink; the DOM one does, see 7).
- **Quad.** `PlaneGeometry(REG.w, REG.h, 192, 56)`, a vertex every 14 units, in logo units from the art's centre, y up. The vertex shader works in stage pixels and ends in the stage's own camera, so z = 0 is the pixel plane and tilt and yaw have real perspective.
- **Morph.** The reel's corner stagger per vertex: `w = 1 - (ax^1.5 + ay^1.5) / 2` (top right 0, bottom left 1), `v = smoothstep(0.3 w, 0.7 + 0.3 w, P)`, position and scale mixed by `v`, the reel's turn `-(smoothstep(v) - v)` (about 5.5 degrees at 0.2) and lean (10 percent of the width at v = 0.5). On top, a travelling sine: amplitude 0.36 of the current height, 1.15 wavelengths across, a crest runs 2.2 wavelengths over the morph, envelope `sin(pi P)^1.5` (0 at both ends), the trailing end whips more (`0.35 + 0.65 (1 - ax)`), a sideways push of 0.2 of the lift. A chromatic split along the slope (three taps, alpha the largest of them so it stays valid premultiplied) and a faint fold shade show only on the crests. Roll, tilt and yaw are weighted by `1 - v`, so the corners arrive upright. The wave drifts a little by itself (0.3 cycles per second at rest, up to 1.2 while P moves) so a stopped scroll is calm and a fast one whips.
- **End frames.** Texture B is the same paths rastered on the canvas's own pixel grid at the bar's scale and sub-pixel phase (one texel to one device pixel, no mips). The fragment blends A to B with `smoothstep(0.6, 0.97, v)` and the quad is shifted so its corner sits on a whole device pixel (`snap`, weighted by `smoothstep(0.9, 1, P)`). B is made when P first passes 0.4, and again when the target or the ratio changes.
- **Reveal.** The part the front has not reached waits 0.45 of the height lower and rises as it passes, with a soft front (35 percent of the width), left to right with a slant.

## 4. The nav logo as Chrome paints it (the calibration)

The page measures the bar's logo with `readNavTarget` (`header[data-overlay="nav"] [data-logo-host] svg`, never constants) and `navTargetFor` (`math.ts`) turns the CSS box into where the ink really lands. The rule, fitted to screenshots of a real high density Chrome (`--force-device-scale-factor`, layout in device pixels) at 1, 1.5, 2 and 3 with a static page of the same paths:

1. The box's offset is rounded to a whole **device** pixel (632.516 css at 2x is 1265.03, painted at 1265).
2. The viewBox goes into the laid out box with one scale, centred (`meet`). The size is not rounded and there is no stretch (the fits found none).

The first notes (a box snapped on both edges) were wrong at 1x by half a percent, and Playwright's emulated ratio (`deviceScaleFactor`) is not the same thing: it lays out in CSS pixels and rounds the offset to a CSS pixel, so at 2x the DOM logo lands exactly one device pixel to the right of a real display's (633 css, 1266). Probes that judge the hand-off must use a real ratio (see 6). The art rect at 1440 wide: x 640.40, y 19.45, w 156.99, h 39.12, centre (718.90, 39.01); at 390 wide, right aligned: centre (310.91, 31.31), width 108.68. Both are in the unit tests.

**Measured (real Chrome, dev server, GL at P = 1 against the bar's own logo at rest, crop of the logo, mean absolute difference per channel of 255):**

| viewport, ratio                                                                  | stage ratio | mean abs diff | pixels over 16   | best shift                                                                                |
| -------------------------------------------------------------------------------- | ----------- | ------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| 1440 x 900, 2                                                                    | 2           | 0.018         | 0                | 0, 0                                                                                      |
| 1440 x 900, 1                                                                    | 1           | 0.039         | 0                | 0, 0                                                                                      |
| 1706 x 950, 1.5                                                                  | 1.5         | 0.029         | 0                | 0, 0                                                                                      |
| 489 x 844, 2 (a real window cannot be narrower than about 489; the phone layout) | 2           | 0.026         | 0.015 % (max 29) | 0, 0                                                                                      |
| 1920 x 1080, 1                                                                   | 1           | 0.039         | 0                | 0, 0                                                                                      |
| 1280 x 722, 1.25                                                                 | 1.25        | 0.476         | 0 (max 10)       | 0, 0                                                                                      |
| 1920 x 1080, 2                                                                   | **1.964**   | 7.97          | 14.8 %           | -0.6, -0.3                                                                                |
| 486 x 844, 3                                                                     | **2**       | 11.2          | 17 %             | 0, -1                                                                                     |
| 1440 x 900, 2, Playwright emulated ratio                                         | 2           | 7.6           | n/a              | +1, 0 (the emulation's rounding, not a bug)                                               |
| 390 x 844, 2, Playwright emulated ratio (the brief's exact size)                 | 2           | 0.032         | n/a              | 0, 0 (251.109 css rounds the same in css and device pixels, so the emulation agrees here) |

The first six are the same picture to the eye: the shape and the place are identical, the difference is the anti-aliasing of two rasterisers (max 2 levels in four of them). The two bold rows are a grid mismatch the logo cannot fix: the stage's ratio is capped at 2 and by the 8e6 pixel budget (1920 x 1080 at 2x is 8.29 million pixels, so the stage runs at 1.964), so the canvas is resampled by the browser. Shape and place still agree (the picture is the same, a little softer).

## 5. The hand-off, and when it does not match

At P = 1 the wave is 0, the turn and lean are 0, and the actor is the bar's logo. Sequence for a section, in the same animation frame: `showNavLogo(true)` then `logo.visible = false`. **Verified:** a call to `showNavLogo` inside a `requestAnimationFrame` callback has already changed the bar (visibility, opacity, `inert`) by the end of that callback's microtask checkpoint, before the frame is painted. Reverse: when P drops below 1, `showNavLogo(false)` and show the actor in the same frame. Reload part way down: P is 1, show only the DOM logo and never build the actor.

When `logo.matchesDom(target)` is false (the two bold rows above: a 3x phone, a 4K display at 200 percent), do not swap in one frame: show the bar's logo (it sits above the canvas, z 50 against 1) and fade the actor with `place(rect, { opacity })` over about 140 ms. The sharper DOM logo covers the soft one and only a faint halo dissolves. This path exists and the opacity looks right in a still (`pose-opacity`); it has not been seen in a running section.

## 6. Numbers to tune

`math.ts`: `WAVE` (amp 0.36, cycles 1.15, run 2.2, lateral 0.2, shade 0.14, split 4.8 texels), `SAG_MAX` 0.5 of the art height, `RIPPLE` (lift 38, reach 320, length 46, speed 9), `REVEAL_DROP` 0.45, `REVEAL_EDGE` 0.35, `HANDOFF_AT` 0.999, `PAD` 24, `SEG_X/SEG_Y` 192 x 56 (128 x 40 is enough if load ever matters), `heroArtWidth` (70 percent of the width, at most 0.42 of the height in art terms, 86 percent under 700 px: a call made without the owner, 70 percent of a phone is too small to lead), `heroRect` (centred across, 47 percent from the top). `raster.ts`: `OVERSAMPLE` 1.25. `actor.ts`: sag spring (`SAG_OMEGA`, `SAG_ZETA`, `SAG_SNAP`), ripple (`RIPPLE_HOVER` 0.55, follow 7, decay 2.4), drift (0.3 and 0.9 cycles a second). The envelope, the stagger and the nav blend are the numbers of the brief: change `math.ts` and `shader.ts` together (the CPU copy `warpPoint` feeds the sockets and the tests).

## 7. Looking at it

Lab: `window.__home.lab("logo")` returns the actor, pinned shown. Then
`L.place(window.__logoFx.heroRect(w, h)); L.morph(P, window.__logoFx.readNavTarget(w, h)); window.__home.freeze(true)` and take a screenshot. `__logoFx` has `readNavTarget`, `showNavLogo`, `heroRect`, `rectFromGrabs`, `SOCKETS`. To see the sag settle, unfreeze for about 1.5 s and call `carryBetween` every frame, then freeze (a frozen scene has dt 0 and the spring does not move). Hide the bar's logo with `[data-logo-host]{visibility:hidden}` when looking at the actor alone, and hide `[data-home-text]`, `[data-home-below]` to quiet the stub.

Judge the hand-off in a real ratio: `chromium.launch({ channel: "chrome", args: ["--force-device-scale-factor=2", "--window-size=1462,998"] })` with `newContext({ viewport: null })` gives a 1440 x 900 page at 2x (the window needs 22 and 98 px more than the viewport; a window cannot be narrower than about 489 css px). Scripts that made every number here are in `D:\ren\aspirant-work\home\F1b\`: `ho.cjs` + `diff.py` + `sub.py` (hand-off), `snap\snap.cjs` (the fit of Chrome's placement on a static page of the same paths), `crisp.cjs` + `crisp.py`, `lab2.cjs` (morph sheets), `sag.cjs`, `poses.cjs`, `perf.cjs`, `resize.cjs`, `loss.cjs`, `hit.cjs`, `swap.cjs`. They are not in the repo.

## 8. Measured

- **Cost**, real Chrome and GPU, dev server, 320 frames while P sweeps with the wave on: `update` 0.045 ms average (p95 0.1, max 0.4); draw with `gl.finish` 0.20 ms average (p95 0.3 to 0.4, max 0.8) at 1440 x 900 at 2x and 1x, 489 x 844 at 2x and 1920 x 1080 at 1x; the frame stayed 16.67 ms. The raster of the hero texture is made while the page loads (`logoItems`); the nav texture (322 x 86 at 2x) is made when P first passes 0.4.
- **Crisp**, the big logo at P = 0, 70 percent wide, against an svg of the same paths drawn by the DOM at the same place: 1440 at 2x mean abs diff 1.69 (2.25 % of pixels over 32, all edge pixels), edge gradient energy 0.973 of the DOM's; 1706 at 1.5x: 1.48, 0.987. A zoomed crop is indistinguishable. Texels per device pixel across the art: 1.25.
- **Looked at** (contact sheets, opened): the morph at P 0, .25, .5, .75, 1 at 1440, 1706 and 390; the sag at tension 1, 0.5, 0 and wobble +-0.8 with the two sockets drawn, at 1440, 1706 and 390 (they sit on the two held points to 0.0000 px); reveal 0, .3, .6, .85; tilt, yaw, roll, calm wave, opacity, a poke and a hover. A resize and a ratio change in the middle (the hero texture is made again, the nav target read again, the logo is where the section puts it at 1440, 1000 and 700 wide). A context lost and restored, and lost for good (the stage made a new canvas): the logo came back with the same pixels.
- **Tests**: `math.test.ts` (the rest wave lets go before the hand-off, the art box, hero size, the nav target against the live numbers of the bar at 1440 and 390 and the rounding at 1, 1.5, 2, the raster plan lands on whole device pixels at five ratios, the stagger, envelope, turn and lean tables, the warp at P = 0 equals the rest rect and at P = 1 equals the nav rect within 0.01 px at all four corners, the hand-off leaves under 0.01 px of wave, the sag keeps the holds fixed at every depth and wobble, the sockets land on two points with and without sag, the reveal), `preload.test.ts`. 62 tests.

## 9. Calls made without the owner

- The big logo is 86 percent of the width under 700 px (70 percent elsewhere).
- Hero rect: centred across, 47 percent from the top.
- No cursor label on hover (the request names none).
- The ripple on hover and press is on by default (the brief said the logo is interactive).
- The mascot does not blink on the big logo.

## 10. Not done, not verified

- A real phone, Firefox, Safari. The production build (everything above is the dev server). A weak machine. A real GPU reset.
- The DOM logo blinks and sways its antennae by itself (`ambientLoop`). A swap that lands in the middle of a blink shows the eyes change. The actor is a static picture; the notes' fix (the mascot as separate quads in the same warp) was cut. Probability per swap is low (a blink lasts a fraction of a second every few seconds), but it exists. The measurements above wait for the bar's logo to rest.
- The grid mismatch rows of section 4 (3x phones, 1080p at 200 percent): the fade path exists, it has not been seen in a running section.
- The drones holding the logo (the intro, wave 3): only the sockets are checked, numerically and as dots.
- The hero texture is sized for 70 percent width at the current ratio (1.25 texels per device pixel). A section that places the logo much bigger than `heroArtWidth` gets a softer picture. Smaller is crisp (mipmaps).
- No hover cursor label, no touch specific behaviour (a touch press on the logo makes the strong ripple only).
- The 128 x 40 quad was not tried; 192 x 56 costs 0.2 ms.

## 11. Needs from others

- **Kernel (`stage.ts`)**: `MAX_DPR` 2 and `PIXEL_BUDGET` 8e6 leave 3x phones and 1080p at 200 percent with a stage ratio that differs from the page's, which is the only case where the hand-off is not pixel exact. Raising `MAX_DPR` to 3 (a 390 x 844 phone at 3x is 3 million pixels, inside the budget) and the budget to 8.4e6 would make those cases exact. Not touched: it moves every actor's cost.
- **Nav**: a 120 to 160 ms opacity transition on the logo host when `hideLogo` goes from true to false would let the section crossfade in the mismatching cases instead of using the actor's own fade. Optional; the actor's `opacity` works without it.
- **Hero section (S1)**: `logoItems()` in its `preload()`, `expectReady` until the first draw, `showNavLogo(false)` before the actor is shown, `useNavLock` bare with the daybreak theme so no plate sits over the travelling logo.
