# Reference study: oryzo.ai (behaviour and technique, for our own build)

Studied 18 Nov 2026 in headed Chrome at 1440x900 (DPR 1) with the site's bundle read (beautified, 47.6k lines). Nothing here is code or art to copy: it is a behavioural spec and the numbers behind it. Oryzo is a Lusion site (custom three.js r178 engine, Astro shell, Halyard Display from Adobe fonts, GSAP only for SplitText). Owner's screenshot reading: the "Powered by AI" hero with the hand holding a cork coaster.

## 0. What the owner should know first (corrections to the brief)

1. **The list frames have NO click-to-view in Oryzo.** Hover over the current frame gives `cursor: auto`, a click does nothing (frames at +150 ms and +1000 ms identical to the hover frame). The cursor label, the click, the expansion to the full picture, the margins and the close button are ours to design (section 8). The only Oryzo precedent for a custom cursor plus an open view plus a close control is the hero video lightbox (`VideoOverlay`, section 8).
2. **The list is a horizontal strip, not a vertical list.** A fixed window in the middle shows one item; items slide left to right (translateX) as the page scrolls. Small thumbnails of the previous items sit left of the window and of the next items right of it. The title is a left column above the left thumbs.
3. **Frame ratio is 85:110 (0.7727), not 4:5.** At 1440x900: 556.4 x 720 (720 = 80vh). The owner asked for 4:5: build it as 576 x 720 at the same height (width = 0.8 * 720).
4. **The last frame expansion is a WebGL scissor rectangle growing plus a camera view offset sliding.** It is not a DOM resize, not clip-path, not scale (section 9). The "drawer" is a GL post pass that blurs the scene texture (section 10), not `backdrop-filter`.
5. **There is no scroll snapping and no ScrollTrigger.** Pinning is a tall outer section with a `position: fixed` inner. Everything is a pure function of scroll (`fit(r, a, b, from, to, ease)`), scrubbed, not timed. A handful of flourishes are time-based (section 4.4).
6. **The hand has no idle animation.** It is a baked 46-frame skeleton clip scrubbed by scroll, plus a cursor-driven finger curl on top. The only constant motion is a camera parallax of at most 0.1 rad and the shader. Our "idle" must be added.
7. **The exit is not "hand sinks, text stays".** In Oryzo the title characters fade first (scroll 6750 to 7200), the description and hint slide out, then the hand opens and drops over about 7500 to 7800 (the same clip played backwards) while dissolving bottom-up. The owner's version (text stays above, hand and doll lower) is a variation on the same mechanism.
8. **The coloured edge glow is `appleEfx` plus the hand shader's `highlightRatio` (scroll 4950 to 7200).** The owner excludes it. Do not build it. The finger-weight texture blend (4.3) is a separate, optional trick.

## 1. How to look again

- Scratch folder (all artifacts): `C:\Users\muham\AppData\Local\Temp\claude\ebb19c894ab4059a\fd0c2cef-a780-4648-9a84-d597a6e52568\scratchpad\recon\ref-oryzo\`
  - `dl\hoisted.pretty.js` (beautified bundle), `dl\index.pretty.css`, `dl\index_lines.html` (DOM), `dl\hand.buf`, `dl\hand_animation.buf`, `dl\AI_HAND.webp`.
  - Contact sheets (read with the image viewer): `sheet_ai.jpg` (whole AI section, 450 px steps), `sheet_rise.jpg` (hand rise 2900 to 5300), `sheet_exit.jpg` (6600 to 8100, 100 px steps), `sheet_wear_a/b/c.jpg` (wearable, 225 px steps), `sheet_step.jpg` (one item-to-item step, 50 px steps), `sheet_drawer.jpg` (frame expansion and drawer, 19000 to 20800), `hover_sheet.jpg` (finger curl by cursor position), `par_sheet.jpg` (camera parallax, four corners), `list_13500.jpg`, `hand_grid.png` (1440x900 hand with a 50 px grid, crop origin 400,250).
  - Scripts: `cap.cjs` (scroll and screenshot every N px), `hover1.cjs`, `hover2.cjs` (CDP screencast), `metrics*.cjs`. Run with node; playwright-core is at `D:\aspirant\node_modules\.pnpm\playwright-core@1.64.0\node_modules\playwright-core` (it is not under apps/web/node_modules). Headed Chrome with `--use-gl=angle --use-angle=d3d11 --enable-unsafe-swiftshader --ignore-gpu-blocklist` renders WebGL; wait 15 s after load.
  - `window.scrollTo({top, behavior:'instant'})` works on the site (its native-scroll listener adopts the position at once), so a scroll position can be set exactly.
- Method note: the brief asked for 50 ms bursts around the frame hover, the click expand, the 3D expansion and the drawer. Only the finger hover response was captured as a time burst (a CDP screencast at ~30 fps, 333 frames, cursor step 200 px to 742 px at t = 0.8 s and back at 3.3 s). The other effects are pure functions of scroll with no time axis, so they were captured as scroll steps (50 to 225 px) and read from the code; the frame click expand does not exist in Oryzo (section 0, item 1), so there was nothing to burst.
- Bundle landmarks (line numbers in `hoisted.pretty.js`): `ScrollDomRange` 20204, `Input` 19964, `SecondOrderDynamics` 19838, `Ease` 20995, `BlurBox` 20870, `CameraControls` 23207, `VideoOverlay` 22724, `FrameAnimation` 27602, `WearableGallery` 28797, `WearableGalleryItem` 29251, `Hand` 29531, `HandScene` 29808, `WearableFrame` 30135, `WearableScene` 30258, `TableScene` 30399, `AiSection` 32152, `WearableSectionCanvas` 32365, `WearableSection` 32493, `FeaturesSection` 33232, `ScrollPane` 45795.

## 2. Scroll system and pinning

- Custom virtual scroll that also writes the native scroll (`document.body.style.height = content height`, `html` scrollbar hidden, `scroll-behavior:auto`, `body{touch-action:none; overscroll-behavior:none}`).
  - Wheel: each event's pixel delta is clamped to +-200 and added to a target. Per frame `scroll += (target - scroll) * (1 - exp(-12 * dt))` (`wheelEaseCoeff = 12`). Measured: one 150 px wheel step reaches 94% in ~290 ms, settled in ~350 ms. Our Lenis is `lerp: 0.12` (`components/smooth-scroll.tsx`); Oryzo's is `1 - exp(-12/60) = 0.18` per 60 fps frame. Use ~0.16 to 0.18 for the same feel, or keep 0.12 for the site's own feel.
  - Drag/touch: friction `2.1 to 1.9` blended by speed, velocity decays; keys: arrows 100 px, PageUp/Down one screen.
  - No snap points exist (`snapList` is declared and never filled).
- Section progress: `r = showScreenOffset = (scrollY - (sectionTop - H)) / H`, i.e. screens scrolled since the section top was at the bottom edge. `r = 1` is when the section top reaches the top edge.
- Pinning: each section is a tall block with a height written in vh (`--vh` = 9 px at H = 900) and an inner `position: fixed; top: 0; height: 100vh`. JS toggles `visibility` on the section when its r window is active. Inner content is absolutely placed on a 16-column grid. The `#canvas` is `position: fixed; inset: 0` and behind the page (`#pages-container` is `z-index: 1`).
- Section tops and heights at 1440x900 (total document 56691 px):

| section                                     | top (scrollY at its top edge) | height         | r origin                        |
| ------------------------------------------- | ----------------------------- | -------------- | ------------------------------- |
| `#hero`                                     | 0                             | 900 (100vh)    |                                 |
| `#ai` ("Powered by AI")                     | 900                           | 7200 (800vh)   | `r_ai = scrollY / 900`          |
| `#wearable`                                 | 8100                          | 11925 (1325vh) | `r_w = (scrollY - 7200) / 900`  |
| `#features` ("Rise above mediocrity" first) | 20025                         | 9450 (1050vh)  | `r_f = (scrollY - 19125) / 900` |

- Sections overlap in time on purpose: `#wearable` becomes visible at `r_w = 0.5` (7650) while the hand of `#ai` is still dissolving (until r_ai 9 = 8100).
- Layout tokens at 1440 (useful to reuse the proportions): `--site-padding-x = 3.125vw = 45`, row height 6, `--site-padding-y = 24`, grid 16 columns of 67.5 with gap 18 (span-2 153, span-3 238.5, span-4 324, span-5 409.5), `--screen-unit = 0.75` (so h1 = 164*0.75 = 123 px, h4 = 24, sub1 = 18, sub2 = 12, body2 = 18). Colours: white `#ffedd7`, black `#100904`, orange `#dc5000`, brown `#382416`, title-1 grey `#bbac97`, bg gradient `#0f0804` to `#6d3916` (warm glow bottom-left).

## 3. Composition and layering (the main trap for our build)

- Oryzo: one WebGL canvas `#canvas` (fixed, full viewport, DPR capped at 1.5) behind all DOM. It renders every scene in turn (hero scene, hand scene, wearable scene, table scene), with temporal AA, blue noise dither, bloom, depth of field and custom post passes (`blurBox`, `appleEfx`, a "magazine layer"). Framed scenes use `renderer.setScissor` (`cameraControls.clipScissor`) so a scene renders only inside a rectangle taken from the DOM. DOM frames (images, videos) sit ABOVE the canvas; the intro frame and the last frame are drawn in GL (a textured quad and the 3D scene) through transparent DOM items. Separate small 2D canvases draw UI chrome (the dashed frame `#wearable-main-canvas`, a curve canvas) and Rive canvases serve later sections.
- Consequence for us: Oryzo's 3D object always stays behind or inside the frames. **Our doll must sit in front of the DOM frames, and the drawer text must sit in front of the 3D scene.** A single canvas under the DOM cannot do both. Use the About page's layer scheme as the pattern: `features/about/layout.ts` `LAYER = { text: 1, drone: 2, film: 3, cover: 6 }`, where the canvas layer changes its place in the stack only where the 3D object is clear of what it would cross. For the home page the practical layout is a sandwich:
  1. z 1: DOM backgrounds, frames (images, videos), thumbnails.
  2. z 2: the one persistent canvas, `pointer-events: none`, transparent clear (doll, hand, Selena, Silverbolt, the frame-hosted 3D).
  3. z 3: DOM text and UI that must read over the 3D (titles, drawer copy, hint, cursor label).
     Note the order is the reverse of About's (`text: 1` below `drone: 2`): on the home page text sits ABOVE the canvas so the drawer copy and titles read over the 3D. Do not copy About's numbers, copy its idea of named layers (a `LAYER` constant) and of moving the canvas in the stack only where it is clear.
     Anything that must be blurred behind the drawer has to be inside the canvas (the Selena scene background included), because the blur is a GL pass over the scene texture.
- Persistent 3D object travelling between frames (Oryzo's coaster lands on the first photo): the object's screen position is derived each frame from the DOM frame rect (`wearableFrame.rect`), not from hard-coded world positions. Recipe for the doll: read the frame rect, convert to NDC, unproject onto the plane the doll lives on, set position; keep scale from the frame height.

## 4. Primitives used everywhere

### 4.1 `fit`

`fit(x, a, b, c, d, ease)`: `t = clamp((x - a) / (b - a), 0, 1)`; `t = ease ? ease(t) : t`; `return c + (d - c) * t`. `unClampedFit` skips the clamp. Reveals are written as products of fits: `in = fit(r, a, b, 0, 1) * fit(r, c, d, 1, 0)`.

### 4.2 Per-character stagger

For a split title with `n` chars, char `k` (0 to n-1) uses `u = k/(n-1)` and the window `[u*0.3, u*0.3 + 0.6]` of the reveal progress `c`: `translate = fit(c, u*0.3, u*0.3+0.6, 0.25, 0, expoOut)` (in ex, x axis), `opacity = fit(c, u*0.3, u*0.3+0.4, 0, 1, expoOut) * fit(out, u*0.2, u*0.2+0.8, 1, 0)`. The asterisk (last char) scales `fit(c, 0.6, 1, 0, 1, backOut)`. Lines masked and sliding use `translateY = fit(c, k*0.2, k*0.2+0.8, 1, 0, expoOut) em`. Oryzo also writes `filter: blur(0.1em -> 0)` on each char: forbidden here (section 11).

### 4.3 Easings (Penner names as used) with CSS/easings.net equivalents

These are approximations; plot them against the exact functions before shipping. Exact functions: cubicOut `(t-1)^3+1`, cubicIn `t^3`, cubicInOut, expoOut `1 - 2^(-10t)`, sineInOut `0.5(1 - cos(pi t))`, sineOut `sin(pi t/2)`, quadInOut, backOut `s = 1.70158`: `(t-1)^2((s+1)(t-1)+s)+1`.

| name       | cubic-bezier                                                               |
| ---------- | -------------------------------------------------------------------------- |
| cubicOut   | `0.215, 0.61, 0.355, 1`                                                    |
| cubicIn    | `0.55, 0.055, 0.675, 0.19`                                                 |
| cubicInOut | `0.645, 0.045, 0.355, 1`                                                   |
| expoOut    | `0.19, 1, 0.22, 1` (GSAP `expo.out` is the exact function)                 |
| sineInOut  | `0.445, 0.05, 0.55, 0.95`                                                  |
| sineOut    | `0.39, 0.575, 0.565, 1`                                                    |
| quadInOut  | `0.455, 0.03, 0.515, 0.955`                                                |
| backOut    | `0.175, 0.885, 0.32, 1.275` (the common `0.34, 1.56, 0.64, 1` is bouncier) |

### 4.4 Time-based values (everything else is scroll-scrubbed)

- Scroll ease `1 - exp(-12 dt)` (above).
- Finger spring: second-order dynamics, `f = 1.5 Hz, zeta = 0.5, r = 3` (t3ssel8r form: `k1 = zeta/(pi f)`, `k2 = 1/(2 pi f)^2`, `k3 = r zeta/(2 pi f)`; `value += vel*dt; vel += (target + k3*targetVel - value - k1*vel) * dt / k2`, with the robust stable-coefficient variant). Measured on a cursor step: response starts within one frame, ~80% after 0.2 s, a small overshoot bump at 0.35 to 0.5 s, settled in ~1 s. Release is the same spring back to 0.
- Hint icon wobble: `x = sin(3 t) * 50%` of its own width (about +-12.6 px), `y = cos(6 t + pi/2) * 5%`, `rotate = cos(3 t) * -6 deg`, t in seconds.
- Hero video lightbox: `openedRatio += 2 dt` (0.5 s), `quadInOut` on a fade of the backdrop; cursor bubble scale = `openedRatio`, dropped to 0.2 over its controls. No scale on the video box.
- Camera parallax: `lookX = clamp(mouse.y) * strength`, `lookY = -clamp(mouse.x) * strength`, eased `1 - exp(-5 dt)`; strength 0.05 default, 0.1 in the hand section, 0 in the frame zoom. At 0.1 rad the hand and coaster shift only a few px between cursor corners (see `par_sheet.jpg`): it is nearly invisible. Pointer y is NDC with y up.
- Thumbnails of the gallery fly in and out over ~1 s with a 0.2 stagger (a time ramp that starts when the gallery index crosses -2 and `t - 0.75`).
- Yoga frame warning strip: translateY `125% to 0`, `fit(animationSeconds, 1, 2, ..., expoOut)`; time starts when the frame becomes visible.

## 5. Section A: "Powered by AI" with the hand (`#ai`)

### 5.1 Timeline, absolute scrollY at H = 900 (r_ai = scrollY / 900)

Checked against the sheets: title "Pow" blurred at 3200 and "Powere" at 3350 (reveal starts 3150); hand tips appear at the bottom at ~3350.

| scrollY      | r          | event                                                                                                                                                                                                                                                                                                           |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 450 to 3150  | 0.5 to 3.5 | "isn't just a coaster" pre-copy in and out (left h2 and right body, slide in from opposite sides by 1em, per-char opacity) while the coaster spins; not part of the owner's list                                                                                                                                |
| 3060 to 4950 | 3.4 to 5.5 | **hand rise**: `hand.animationRatio = fit(frameIndex, 71, 115, 0, 1)` with `frameIndex = fit(r, 0, 5.5, 0, 1) * 115`; maps to the 46-frame skeleton clip. Visible motion: fingertips at the bottom edge ~3350, open palm rising under the coaster 3500 to 3950, fingers close on it ~4100 to 4400, static after |
| 3150 to 4500 | 3.5 to 5   | title chars reveal (`c = fit(r, 3.5, 5)`), tagline "ORYZO-1" chars rise (masked)                                                                                                                                                                                                                                |
| 4050 to 4950 | 4.5 to 5.5 | description lines reveal (masked lines, 0.2 stagger)                                                                                                                                                                                                                                                            |
| 4950 to 5400 | 5.5 to 6   | hint reveals (dash line grows, text chars rise, icon fades) and `fingersActiveRatio` goes 0 to 1                                                                                                                                                                                                                |
| 5400 to 6750 | 6 to 7.5   | **interactive window**: finger weights live (1.5 screens = 1350 px of scroll)                                                                                                                                                                                                                                   |
| 6750 to 7200 | 7.5 to 8   | fingers deactivate, hint exits (text slides 3.3em left, line retracts), title chars fade (staggered), description starts to leave (6750 to 7650, translateX +80% sineOut)                                                                                                                                       |
| 7200 to 8100 | 8 to 9     | hand dissolve and reverse pose scrub (see 6)                                                                                                                                                                                                                                                                    |

Total AI section used: 8100 px. For our site the owner wants it short: the hand part (rise + interactive + exit) can be about 3000 to 3600 px.

### 5.2 Layout at 1440x900, hand section (measured at scrollY 5850, r 6.5)

- Title `#ai-title`: x 364 to 1076 (width 712, centred on 720), y 96 to 206.7, Halyard Display Variable 500, 123 px, line-height 0.9 (110.7), letter-spacing -0.018em (-2.2 px), no wrap. The `*` is a `sup` at 0.4em, absolute, `margin-top .2em`. Header block: `left: 50%`, `top: 24` plus `translate(-50%, 8vh = 72)`.
- Tagline "ORYZO-1": orange `#dc5000`, 24 px, right-aligned under the title: x 975 to 1071, y 210.5 to 236.7.
- Hint `#ai-instruction` (opacity 0.5): x 369 to 522 (width = span-2 153, left = padX + span-4), y 680 to 760. Parts top to bottom: hand icon 25.2 x 31 px at (422, 678), dash line 153 x 1 px at y 740 (`repeating-linear-gradient`, 2 px on, 2 px off, `#ffedd7`), text "TRY TO HOVER HAND" 12 px, uppercase, 500, right-aligned, y 747 to 760. Its centre is at y = 80% of H (`top: 80%`, `translateY(-50%)`). The icon is a line drawing of an open palm with fingers up.
- Description `#ai-desc`: three lines, 18 px uppercase 500, right-aligned, x 814.5 to 1071 (left = padX + 9 spans, width 3 spans = 256.5), y 690.6 to 749.4, line-height 19.6. "AI FILLS IN THE GAPS. / WE SAID HIGH FIVE. / IT HEARD SIX."
- Disclaimer: right bottom, x 1327 to 1395, y 820 to 876, 13.5 px, dash line above.
- Hand and coaster (from `hand_grid.png`, 1440x900, +-6 px): coaster outer diameter ~262 px (18% of width), centre ~(716, 447), top 316, bottom 578. Hand silhouette x 540 to 842 (302 px, 21% of width, centre x ~691), from the index fingertip at (572, 433) down past the bottom edge (cropped; wrist is below the viewport). Thumb nail at (805 to 842, 602 to 632) pressing the coaster rim; the other fingers curl in front. So the hand occupies the lower half of the screen (y from 48% to 100%), horizontally centred slightly left of centre, between the hint (left) and the description (right), under the title.
- Scene camera: baked 116-frame clip, vertical FOV ~26.2 deg (50 mm lens on a 41.4 mm aperture), position fixed at about (-0.011, 1.225, -0.049) m, only its rotation changes (it pitches from looking down on the table to looking forward). Hand mesh ~14 x 8 x 19 cm: real-world scale. A long lens gives the flat, elegant look; use a similar FOV (24 to 30) for Selena's hand.

### 5.3 What the hand is (technique)

- `hand.buf`: 8441 vertices, 46266 indices (15.4k triangles), 4 bone indices and weights per vertex, plus a `fingerWeights` vec4 attribute (which of 4 fingers a vertex belongs to), packed int16. 36 bones. `hand_animation.buf`: 46 frames of 36 bone positions and orientations. Skinning is done in the vertex shader from two data textures (36 x 1 RGBA32F, position and orientation), not with `SkinnedMesh`.
- Sizes (the whole hand scene, network): `hand.buf` 381 KB, `hand_animation.buf` 41.5 KB, `AI_HAND.webp` 209 KB (2048 x 2048), env maps 5 KB and 1 KB, camera clip 2.3 KB, coaster clip 3 KB. About 650 KB. This is the budget to beat for Selena's hand-only file (see 5.6).
- Texture: `AI_HAND.webp` is a 2 x 2 atlas of baked lighting variants of the same hand (not four skin tones). The shader samples two cells and cross-fades: during the rise it walks cell 0 to 2 (`fit(frame, 20, 40, 0, 2, cubicOut)`); when fingers are active it stays on cell 2 and blends toward cell 3 per vertex by `dot(u_fingerWeights, v_fingerWeights)`. A baked relight per curled finger. Optional trick; with real PBR lights on our hand it is not needed.
- Shading: albedo from the atlas, two specular lobes and two back-scatter rim terms in the fragment shader, lit by fixed light positions; the coloured `appleColor` terms and `u_highlightRatio` are the edge glow (excluded). A bottom-up dissolve to the background colour (`opacity` by `gl_FragCoord.y`) hides the cut of the wrist and drives the exit.
- Hiding the cut: the mesh ends at the wrist, which stays below the viewport bottom. For our hand keep the forearm to ~20% below the bottom edge and also apply a short vertical fade at the bottom 6% of the canvas so no cut can ever show.

### 5.4 Cursor to finger mapping in Oryzo (exact)

Per frame, only while `fingersActiveRatio > 0`:

```
for finger p in 0..3 (index, middle, ring, pinky; thumb excluded):
  t = fit(mouse.y_ndc, -0.2 - 0.1p, -0.7 - 0.1p, 0, 1)          // y up, -1 bottom
  b = (1 - abs(t - 0.5) * 2) * fit(abs(mouse.x_ndc), 0.2, 0.3, 1, 0)
  spring[p].update(dt, b)                                        // f 1.5, z 0.5, r 3
  weight[p] = spring[p].value * fingersActiveRatio
```

- A triangular band per finger on the cursor's height: peaks at NDC y = -0.45, -0.55, -0.65, -0.75 (screen y = 652, 697, 742, 787 px at H 900), half-width 0.25 NDC (112 px). Horizontal gate: full strength within +-0.2 NDC of the screen centre (+-144 px), zero beyond +-0.3 (+-216 px). It is a screen-space gesture zone, not a raycast against the hand.
- Applied after the baked pose for the frame (so it rides on the animation): for every non-leaf bone of finger `p`, `q = axisAngle(local X, weight[p] * FINGER_ANGLES[p])`, `bone.quaternion.premultiply(q)`, with `FINGER_ANGLES = [0.1, 0.25, 0.25, 0.3]` rad (index to pinky). The chain composes: 3 joints per finger, so at weight 1 the curl at the tip is about `[0.3, 0.75, 0.75, 0.9]` rad (17, 43, 43, 52 deg). Only after the clip has finished (`animationRatio == 1`).
- Observed (`hover_sheet.jpg`): cursor at y 200 or x 500: open hand. Cursor at (720, 742): ring and pinky visibly curl toward the palm, the lower fingers catch coloured rim light. At x 560 the reaction is ~0.8 strength, at x 900 ~0.5. The effect is deliberately subtle.
- The mouse also drives the camera look (4.4).

### 5.5 Entrance and exit recipe for our hand

- Entrance: scrub a single `handProgress` (0 to 1) from scroll through a pose clip (`AnimationMixer.setTime(handProgress * duration)`) and the camera. Our doll lands in the palm first (owner's sequence), then the title and hint appear; the hint should appear after the doll has finished standing up, then the finger spring is enabled (`fingersActive` ramps 0 to 1 over ~450 px or 0.5 s).
- Exit: scrub `handProgress` back down (the same clip backwards) while a bottom-up opacity mask rises (Oryzo: `opacity = smoothstep(0, 1, u*2 - (0.5 - min(0.5, screenY) * 2))` with `u` 1 to 0, screenY 0 at the bottom, so the bottom of the hand dissolves first and the dissolve climbs). For the owner's version keep the title text visible while the hand and doll lower; the clip backwards over ~900 px of scroll matches Oryzo's 7200 to 8100 span.

### 5.6 Recommended finger mapping for Selena's palm-up hand

The owner's pose (`C:\Users\muham\Downloads\hand.jpg`) is an open, slightly cupped palm facing up and toward the camera, seen from the elbow with the forearm foreshortened. Oryzo's is a pinch hold. Oryzo's Y-bands are tuned to its own screen layout, so do not copy them. Keep its numbers as limits, change the input:

1. **Input**: project each fingertip bone (and thumb tip) to screen space every frame (`Vector3.project(camera)`); cursor in px. Distance `d_f = |cursor - tip_f|`. Weight `w_f = exp(-(d_f / sigma)^2)` with `sigma ~ 0.55 * handScreenWidth` (about 165 px at 1440). Gate the whole reaction by the cursor being near the hand: `near = smoothstep(1.6 R, 0.9 R, |cursor - palmCentre|)` with `R` ~ the hand's screen radius (about 200 px). Oryzo's gate is +-216 px horizontal; same order.
2. **Direction**: cursor closer to the palm or below a tip: that finger flexes toward the palm (curl, about the finger's flexion axis, which is local X in Oryzo's rig; check Selena's: it is the axis perpendicular to both the finger direction and the palm normal). Cursor above or beyond the tip: the finger extends slightly (negative curl, up to -0.1 rad) as if reaching. Cursor to the left or right of a finger: abduction (splay) of that finger toward the cursor, up to 0.12 rad, and a roll of the wrist bone of at most 4 deg toward it.
3. **Magnitude**: per-joint maximum `[MCP, PIP, DIP] = [0.18, 0.28, 0.20]` rad at weight 1, scaled by finger `[index 0.8, middle 1.0, ring 1.1, pinky 1.25]` (Oryzo's pinky bends 3x the index). Total at the tip about 0.66 to 0.82 rad (38 to 47 deg). Thumb: opposition toward the palm up to 0.35 rad when the cursor is on the palm centre.
4. **Spring**: per finger `SecondOrderDynamics(f 1.5, zeta 0.5, r 3)` (the same feel as Oryzo), plus a 25 to 40 ms stagger from the nearest finger outward so a sweep ripples. Clamp the total at 0.9 rad per finger. Apply as an additive rotation AFTER `mixer.update` so the idle clip keeps running underneath.
5. **Idle** (Oryzo has none): per-finger sinusoid on each joint, amplitude 0.02 to 0.04 rad, 0.15 to 0.35 Hz, random phases; wrist sway 0.8 deg at 0.2 Hz; a slow 1.5 mm palm rise and fall (breathing) in sync with the doll's weight shift. The doll sitting in the palm should lighten the reaction (weights times 0.85) and receive a small bounce impulse when a finger moves under it.
6. **Press**: a click on the hand is a quick flick (weight to 1.3, then spring back) and a poke impulse on the doll.
7. **Camera**: keep a small mouse look (<= 0.06 rad, `1 - exp(-5 dt)`) for depth.
8. **Mobile (touch)**: no hover. Drive weights from touch position while the finger is down, and from the gyro only if the owner wants it (Oryzo uses device orientation on mobile).

## 6. Exit and the seam into the list (what the sheets show)

`sheet_exit.jpg` (scrollY, H 900): 6600 to 6900 vignette fading, title dimming; 7000 title nearly gone, hint fading; 7100 to 7300 only the hand and coaster, description sliding out; 7400 to 7600 a faint small dot (frame corner dot) and a dotted circle start to draw around the coaster (the wearable chrome, `showRatio`); 7700 the hand has dropped ~140 px and its fingers are open; 7800 the hand is nearly gone and the coaster stands alone, tilting, with the dashed frame circle and the first words "SO PORTABLE," at the left; 8000 to 8100 a dashed 432 x 432 square frame around the coaster. The 3D coaster is the same object that sat in the hand, now released into the frame: this is the exact beat the owner wants for the doll (hand lowers, doll is placed on the first frame). Our doll gets the same continuity by being one persistent object whose parent switches from the palm anchor to the frame anchor (keep world position, then tween).

## 7. Section B: "So portable, it's wearable" frame list (`#wearable`)

### 7.1 Timeline (absolute scrollY, `r_w = (scrollY - 7200) / 900`)

| scrollY        | r_w            | event                                                                                                                                                                                                                                                             |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7650 to 8100   | 0.5 to 1       | section visible; "SO PORTABLE," chars rise (`translateY 1.5em to 0`, expoOut, stagger 0.1); chrome draws in                                                                                                                                                       |
| 8100 to 9000   | 1 to 2         | giant "it's wearable" (a GL MSDF text) slides in from the right, linear                                                                                                                                                                                           |
| 8550 to 9900   | 1.5 to 3       | the coaster's foil wrapper tears open (`tearRatio = fit(E, 1, 2)`, Oryzo specific); the 3D coaster then rises into the frame (`E` 2 to 3 over r_w 3 to 5.25 = 9900 to 11925) and lands on the first photo as a badge (`sheet_wear_a.jpg`, scrollY 10125 to 11025) |
| 10125 to 11475 | 3.25 to 4.75   | giant text shrinks into the left title (`shrinkRatio`), and the title block settles just above the left thumbs; thumbnails fade in 3.25 to 4 (10125 to 10800)                                                                                                     |
| 12150 to 16875 | 5.5 to 10.75   | **gallery index 0 to 7** (8 items, 675 px per step)                                                                                                                                                                                                               |
| 16875 to 19125 | 10.75 to 13.25 | last frame holds; its overlay (magazine cover) animates out over `rawIndex - 7 = 0 to 3.2` (r_w 10.75 to 13.15)                                                                                                                                                   |
| 19125 to 19777 | r_f 0 to 0.725 | frame expansion (section 9)                                                                                                                                                                                                                                       |

Checked: first step starts at 12217 (12150 + 0.1 * 675) and ends at 12757 (sheet_step: sliver at 12250, settled by 12750).

### 7.2 The strip

- `rawIndex = unClampedFit(r_w, 5.5, 10.75, 0, 7)`. `index = floor(raw) + fit(raw % 1, 0.1, 0.9, 0, 1, sineInOut)`. Each step is 675 px of scroll: 67.5 px hold, 540 px of sineInOut motion, 67.5 px hold, so ~135 px of rest between moves and no snapping. The page keeps scrolling smoothly under it.
- Move container: `translate3d(-clamp(index, 0, 7) * itemWidth, 0, 0)`; flex row `width: 800%`, each item `width = frame width`, `overflow: hidden`. Items are `visibility: hidden` unless `showRatio > 0 && hideRatio < 1` (`showRatio = fit(index, i-1, i)`, `hideRatio = fit(index, i, i+1)`); video items play only while visible (a `RafVideo` wrapper handles play promises and pauses).
- Inner seam effect: each item's inner layer is `rotate(o * -10 deg) scale(1 + |o| * 0.2)` with `o = showRatio - 1 + hideRatio` (so -1 as it arrives, 0 centred, +1 as it leaves). The incoming picture arrives rotated +10 deg at 1.2x and settles; the outgoing one rolls to -10 deg and grows. The GL frames start with the same zoom (1.2) and roll so the DOM to GL handoff is invisible.
- Thumbnails: scale 0.35 of the frame (194.7 x 252 at 1440x900), gap `0.08 * thumbWidth` (15.6), opacity 0.5, vertically centred (`top: 50%`, y 324 to 576), clipped by wrappers with `overflow: hidden` and `pointer-events: none`. Left wrapper `x 0 to 419.2`, right wrapper `x 1020.8 to 1440` (a 22.6 px gutter next to the frame). Both rows translate by `-index * (thumbWidth + gap)` so each step moves them by 210.3 px. Thumb files are 340 x 440 webp (5 to 28 KB) and the entry/exit of the whole row is a per-thumb horizontal slide of `viewportWidth / 2` (cubicInOut, staggered by 0.2).
- Frame chrome (2D canvas, `#wearable-main-canvas`, 570.4 x 734 = frame + 7 px each side): 1 px dashed line `[3, 3]` in `#ffedd7`, 6 px outside the frame, drawn from the corners along the perimeter as `showRatio` rises (so it "draws itself"), four 10 px tick marks inside near the edge midpoints, and a 10 px dot at the top right inside corner (centre 13 px from the right and top edges) that pops with backOut. Build it as an SVG with `stroke-dasharray` and a `transform` only animation, or as a 2D canvas redrawn on change (it is cheap).
- Item micro-interactions (copy the idea, not the content): item 2 slides a warning strip up (`translateY 125% to 0`, expoOut, 1 s delay, time based); item 4 has a prompt bar with an orange pulsing "Send" button; a click slides an alternate picture down from `top: -100%` and unblurs it (`filter` blur .75em to 0 over .5 s, forbidden for us: crossfade instead); it resets when the frame leaves. A frame can host a small click interaction; the doll can react to it.

### 7.3 Layout at 1440x900 (strip settled, scrollY 13500, `list_13500.jpg`)

- Window: x 441.8 to 998.2 (556.4), y 90 to 810 (720 = 80vh), centred on (720, 450). Aspect 85:110; images authored 850 x 1100 webp (59 to 106 KB), videos 832 x 1072, H.264, 24 fps, ~5.08 s, 6 Mbps, 3.9 MB (measured on `yoga.mp4` only; `bite.mp4` exists too and is served as video/mp4 but was not probed). That is heavy, ours should be about 1 MB.
- Title block: left column x = 45; `SO PORTABLE,` 24 px uppercase `#bbac97` at y ~250 and `it's wearable` 36 px (1.5em), white, weight 500, lower-case, right under it (y ~278 to 310). It sits just above the left thumbs row (thumbs top 324); formula: block bottom = `H/2 - thumbHeight/2 - titleHeight/6`.
- "SCROLL TO CONTINUE": bottom centre, y ~868, 12 px, a dashed circle with a chevron on its left.
- Right edge: a 60 x 200 cream tab (`#scroll-indicator__bar`) at x 1426, a custom scroll indicator that moves with progress (not needed).
- For our list: title "Characters" in the same left column, a changing character-name line in place of "it's wearable", the doll on the right of the frame sitting on the top edge, thumbs optional.

## 8. Hover cursor and click-to-expand: not in Oryzo, design ours

### 8.1 What Oryzo has (the only precedent): the hero video lightbox

- Backdrop `#000000e6`, full screen, `cursor: none`; inner box `width: min(80%, 133.33vh)`, aspect 16:9, radius 2.5rem, centred. Open and close are an opacity fade only (0.5 s, quadInOut, `openedRatio += 2 dt`). The box does not morph from the thumbnail.
- Custom cursor: a white disc `3.5em` (47 px at 13.5 px base) that follows the pointer (`translate3d` per frame, the page's own loop), `transform: scale(openedRatio)`, scale 0.2 over its own controls; a `data-state` swaps an SVG inside: `play`, `pause` over the video, `close` outside it (the disc turns black with a white icon). Clicking the backdrop closes; Esc is not handled; a mute button sits bottom right.

### 8.2 In-house precedents to reuse (read these, do not re-invent)

- `features/library/arts/core/zoom/` (`cursor.tsx`, `cursor.module.css`, `run.ts`, `slide.tsx`): a cursor with "Zoom In / Zoom Out" over `[data-zoom]` elements, spring `STIFFNESS 430`, damping ratio 0.8, one element moved by transform, a morph from the tile to the whole picture, fine pointer only, hides the native cursor on the one element under the pointer.
- `features/story/morph/morph-math.ts`: `Rect`, `mixRect`, `clipLayers(win, content, full)`, `composeLayers`, `windowFrames`, `cubicBezier(x1, y1, x2, y2)`: a window that grows from a card rect to the full screen with two nested clips that only translate (transform only, no stretching), two keyframes, one easing. This is the way to open a 4:5 crop into the whole picture with a transform-only animation (the repo forbids animating `clip-path`, `width`, `top`).
- `features/character/vexana/seams/snap.ts` `useScrollSnap(id, getRange, { idleMs, snapSeconds, onSnap })`: the site's "a stop inside a transition settles after one second" rule. Oryzo has no snap, we do; use it on the frame expansion (section 9).

### 8.3 Recipe (our design, numbers to start from)

1. **Hit test without DOM hover**: the canvas layer is `pointer-events: none`; test the pointer against the current frame rect every frame (rect from the same layout numbers as 7.3). Active only when `|index - round(index)| < 0.05` (a frame at rest) and the pointer is a mouse.
2. **Cursor label**: one element, 88 px disc (or a pill "View"), `transform: translate3d(x,y,0) scale(s)` where `s` follows a spring (stiffness 430, damping ratio 0.8) toward 1 on a hit and 0 otherwise; the native cursor hidden only on the frame. The frame lifts `translateY(-6px) scale(1.012)` and its dashed border brightens. Same disc becomes the close cursor in the open view.
3. **Open**: on press freeze the strip (`index` locked) and pause Lenis. Measure frame rect `F` and the full picture aspect `a`. Target `T` = contain-fit of the whole picture in the viewport minus margins (max width 0.8 W, max height 0.8 H, so there is empty space on all sides to click out; Oryzo's lightbox uses `min(80%, 133.33vh)`). Animate in two keyframes with one easing, `cubic-bezier(0.645, 0.045, 0.355, 1)`, 0.65 to 0.8 s: backdrop opacity 0 to ~0.9 (site black), window `F` to `T` through `clipLayers`/`windowFrames` (nested translating clips), content scale from the crop scale `s0 = max(F.w / pic.w, F.h / pic.h)` (focus point from the crop) to the contain scale `s1 = T.w / pic.w`. At t = 0 the pixels equal what the frame showed, so there is no jump; the crop opens to reveal the rest.
4. **Video**: keep one `<video>`; reparent it into the open layer (or run two and copy `currentTime`); keep it looping muted. The cursor shows `close` outside and none inside.
5. **Close**: a round button top right (2.5em, safe area aware), Esc, click on the margin, and the cursor close state; reverse the same two keyframes.
6. **While open**: the doll stays in the canvas; either it hops down and waves from the corner of the open picture or it watches (`lookAt` the picture); the persistent canvas does not resize.

## 9. Section C: the last frame is a 3D scene that expands to full screen

Mechanism (`WearableSection`, `TableScene`):

1. The last gallery item is transparent; the 3D scene renders into the frame through a **scissor rect** that follows the frame as it slides in: `scissor = (frameX, H - (frameY + h), frameW, h)` clamped to the visible slice (`G = clamp(b*(I-1) - offsetX, 0, b) + frameLeft`, right edge `frameLeft + b`). A **camera view offset** keeps the 3D picture attached to the slice: `viewOffsetX = (sliceCentreX / W) - 0.5`, `viewOffsetY = (frameCentreY - H/2) / H`, applied with `camera.setViewOffset(W, H, -viewOffsetX * W, -viewOffsetY * H, W, H)` (positive offset moves the picture right and down).
2. The scene enters with the SAME zoom and roll as the DOM inner seam: `camera.zoom = fit(M, 0, 1, 1.2, 1) * frameZoom` and a roll of `+10 deg * (1 - M)` where `M = fit(t, 0.1, 0.9, 0, 1, sineInOut)`, so the DOM to GL handoff is invisible. `frameZoom = frameHeight / (0.8 H)` (1 at desktop).
3. **Expansion** with `S = fit(t, 3, 3.5, 0, 1)` (r_f 0 to 0.725, scrollY 19125 to 19777, 652 px, linear): the camera does not move or zoom; the scissor grows about its centre by `U` and its centre slides to the target region while the view offset slides to the same place:

```
toViewOffsetX = ((W - panelW) / 2 + panelW) / W - 0.5     // panelW = 454.5 -> 0.1578 (+227 px)
centre.x = frameCentre.x + toViewOffsetX * W * S           // 720 -> 947
// cx, cy are the CURRENT shifted centre, so `cover` is re-evaluated every frame (2.59 at S 0, 3.41 at S 1 here)
cover = max( max(|W - cx|, W - |W - cx|) / frameW , max(|H - cy|, H - |H - cy|) / frameH ) * 2
U = fit(S, 0, 1, 1, cover)                                  // scissor w,h = frame * U
viewOffset = lerp(fromViewOffset, toViewOffset, S)          // toViewOffsetY = 0
```

The visible window opens in all directions (556 x 720 grows to more than the screen, ~1.7 px of width per px of scroll at the start), revealing more of the same world at the same scale, while the subject drifts from the centre of the frame to the centre of the free area right of the drawer (x = 947). The dashed chrome fades as the frame grows. 4. After S = 1 the scissor is disabled and the scene is full screen with the model on the right; `cameraLookStrength` 0.05.

For Selena and Silverbolt: the same camera is used for the cropped state and the full state, so the 4:5 crop shows a window onto the final composition (upper body or the pose with hands at the mouth). If a tighter crop is wanted, add `zoom` easing from a closer value to 1 over `S` (Oryzo does that only on entry). Put a one-second settle on the expansion with `useScrollSnap` so nobody stops half way (the owner's rule for joins; Oryzo has none).

## 10. Section D: "Rise above mediocrity" blurred drawer on the left, model on the right

### 10.1 Layout at 1440x900 (scrollY 20300, r_f 1.3)

- Drawer region `#features-items`: x 0 to 454.5 (= span-5 409.5 + padX 45), full height 900, flush left. Inside, content column x 45, width 324 (span-4).
- Icon: a 60 x 60 circle with an up arrow at (45, 105). Tagline "RISE ABOVE MEDIOCRITY": 18 px uppercase, y 201. Description (body2, 18 px, line-height 24): y 235, 324 wide, about 4 lines. A dash line fills the free height and ends at y 723 (just above the title). Title "ELEVATE YOUR COFFEE EXPERIENCE" h3 33.75 px (45 * 0.75) uppercase, line-height 1, bottom aligned: box y 724 to 900. Bottom right: formula "Delta h ~ t" and a 13.5 px footnote, x 1104 to 1395, y 835 to 876.
- Model: subject centre x ~947 (centre of the free area), vertically centred, full scene behind.
- Text reveal (scrubbed on `a = r_f`): `t = fit(a, 0.5, 1.125, 0, 1)` (scrollY 19575 to 20137); exit `fit(a, 1.875, 2.5, 0, 1)` (20812 to 21375). Tagline chars: `translateX 1em to 0` and opacity (cubicOut, window `[p*0.4, p*0.4+0.6]`); title chars `translateY 1em to 0`, masked; description lines `translateY 1em to 0` with opacity, stagger `p*0.4` (p from 0 at the first line); dash line width 0 to 100% (cubicOut).

### 10.2 The blur panel (`BlurBox`, a GL post pass, not CSS)

- A full-screen-sized rect pass limited to a rounded box (`u_rect`), run after the scene render, reading the scene render target. Fragment: 16 golden-angle (`2.39996` rad) spiral taps with blue-noise rotation, radius `mix(radiusA, radiusB, ratio) * roundedBoxMask`, `ratio` = progress along a direction vector (`posA` to `posB`, here horizontal across the panel). Tint `#687952` mixed at `alpha 0.15` (`mix(rgb, tint, alpha * mask)`). Mask: signed-distance rounded box, `smoothstep(1.5, 0, sdf)` (1.5 px AA). A faint inner highlight line at the top left edge.
- Values: `blurRadiusA = 0.08 * rtHeight` at full open (72 px at 900) falling to `0.2 * that` at the far edge (`radiusB = 0.016 * rtHeight`); `colorAlphaA = 0.15`. So the blur is strong at the left edge and fades to almost clear towards the model: a drawer that dissolves into the scene, not a hard glass slab.
- Opening motion: panel x slides from `-0.2 * panelWidth` to 0 (`cubicOut`) while radii and alpha ramp: `A = fit(1.5 b, 0, 1, 0, 1)`, `M = fit(1.5 b, 0.5, 1.5, 0, 1)`, `alphaA = 0.15 * fit(A, 0, 0.75, 0, 1)`, `radiusA = 0.08 * fit(A, 0.25, 1, 0, 1)`, `radiusB = 0.08 * fit(M, 0.25, 1, 0, 0.2)`, with `b = fit(r_f, 0.5, 1.125, 0, 1)` (scrollY 19575 to 20137).
- **Closing is tied to the LAST feature item, not to the first item's text.** The panel stays open across all three feature items (the text of each item fades in and out inside it) and closes with `S = fit(r_f, 5.875, 6.5, 0, 1)` (scrollY 24412 to 24975): `T = fit(1.5 S, 0.5, 1.5, 0, 1)`, `D = fit(1.5 S, 0, 1, 0, 1)`, `alphaA *= fit(T, 0, 0.75, 1, 0)`, `radiusA *= fit(T, 0.25, 1, 1, 0)`, `radiusB *= fit(D, 0.25, 1, 1, 0)`, and the slide uses `b * (1 - S)`. Only item 0's copy leaves at 20812 to 21375 (item 1 follows). For our page (one drawer, one item) the close can be tied to whatever ends the section; just do not tie it to the text exit.
- **In our renderer** (three.js, one canvas): render the scene to a render target (or the composer's read buffer), then draw one quad covering the panel rect with a fragment shader like the above; downsample the source to half resolution first to keep 16 taps cheap; only the panel region is shaded. Never `backdrop-filter` (repo rule), and never blur a live DOM picture. Copy text stays DOM, above the canvas (z 3).

## 11. Oryzo techniques our rules forbid, with the swap

| Oryzo                                                                  | Rule                                                                   | Swap                                                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| per-char `filter: blur(0.1em)` on the title                            | no `filter` on elements with animated children / over the live picture | opacity + translate only; widen the stagger instead                                                   |
| dash line `style.width` 0 to 100% (hint, disclaimer, drawer, features) | no `width` animation                                                   | one 1 px element with `transform: scaleX(0 to 1)`, `transform-origin: left` (right for right-aligned) |
| `visibility` toggles per section                                       | fine                                                                   | keep (cheap)                                                                                          |
| blurred drawer                                                         | no `backdrop-filter`                                                   | GL post pass (10.2)                                                                                   |
| blur of alternate picture (bikini frame)                               | no filter                                                              | crossfade or a transform reveal                                                                       |
| coloured vignette / `appleEfx`                                         | owner excluded                                                         | do not build                                                                                          |
| MSDF GL text for the giant title                                       | not needed                                                             | DOM text with transform                                                                               |
| `clip-path` / width on frames                                          | transform and opacity only                                             | nested translating clips (8.2)                                                                        |
| temporal AA, DOF, bloom stack                                          | performance and "one version" rule                                     | use plain MSAA and a single cheap bloom or none; cost must be paid for everyone                       |

## 12. Build recipe for our stack (three.js + GSAP + Lenis, one canvas)

1. One scroll store from Lenis: `y`, `velocity`. For each pinned section cache `{top, height}` at resize (ResizeObserver) and expose `r(section) = (y - (top - H)) / H`. All section animation is `update(r, dt)` writing `transform`/`opacity` on cached refs, plus an `active` flag that sets `visibility` (like Oryzo) so inactive sections cost nothing. Do not create dozens of scrubbed ScrollTrigger tweens for per-character work; use ScrollTrigger only to set the pins' lengths or not at all (Oryzo uses fixed inner with tall sections; `position: sticky` inner is equivalent and simpler under Lenis).
2. Timeline in screens, not pixels: define each beat as `[a, b]` in r units (tables 5.1, 7.1, section 10), convert to px at runtime. Keep Oryzo's proportions only as a starting point; the owner wants the page not too long: hand part ~3 to 3.6 screens, list 0.6 to 0.75 screens per frame, expansion 0.75 screens, drawer 0.6 screens.
3. One persistent `WebGLRenderer` (alpha true, pixel ratio `min(devicePixelRatio, 1.5)` as Oryzo does: a full-screen canvas plus the blur pass and scissored scenes must not lag, and a cap by the display's own pixel ratio is allowed by the repo rules, it is not device gating; measure with `scripts/perf/weak.mjs` on the production build before raising it; `setScissorTest` for framed scenes). Scenes: `handScene`, `frameScene` (doll plus the Selena frame), `selenaScene`. One render function chooses by `state` and sets scissor and `setViewOffset`.
4. Persistent doll: one `Object3D` with an anchor system (`palm`, `frameTopRight`, `selenaHang`). Anchors are `Object3D` children updated from DOM rects (frame) or from bones (palm). Re-parent with `attach()` to keep the world transform, then ease the local offset to zero over 0.35 s.
5. Frame strip: DOM `transform` only, index from section 7.2 (`sineInOut` inside the 0.1 to 0.9 window). Thumbs optional. Doll anchor `frameTopRight` follows the window rect (fixed while the strip slides) and sits on its top edge, right of centre.
6. Hover cursor and open view: section 8. The open view is a portal above everything with its own `Lenis.stop()`.
7. 3D frame: section 9 with `renderer.setScissor` and `camera.setViewOffset`; one second settle via `useScrollSnap`.
8. Drawer: section 10.2 as a render-target pass, text DOM at z 3.
9. Loading: every file named here must be a `PreloadItem` for the home route (hand-only GLB, doll, textures, Selena at its first-screen cost); the `deferred` rule applies to what a visitor must ask for (the open-view full pictures, the other frames' videos beyond the first screens).

## 13. Gotchas and risks

- **Layering** (section 3): a canvas under the DOM cannot put the doll in front of the frames; use the sandwich. The blur must have everything it blurs inside the canvas.
- **Hand-only extraction**: Oryzo's whole hand scene is ~650 KB because it ships a skin texture and a bake. Target for Selena: forearm plus hand, about 36 to 40 bones, one 1024 or 2048 webp, meshopt or Draco geometry; no other meshes or bones in the GLB (prune with gltf-transform); check the wrist stays below the screen bottom at every viewport aspect (Oryzo crops it by camera; at 16:9 and 21:9 the cut position differs).
- **Skinning**: if Selena's rig is used with `SkinnedMesh`, add finger curl in the bone local space after `AnimationMixer.update` (premultiply), and normalise quaternions each frame; the hover must not fight an animation that also keys the fingers (Oryzo avoids this by applying only after the clip ends).
- **Finger axis**: Oryzo's X axis is rig specific; confirm Selena's flexion axis and sign from rest orientations before shipping the mapping.
- **Hint timing**: Oryzo shows the hint while fingers go live. Our doll stands first, so schedule: hand arrives, doll settles, `fingersActive` ramps, hint appears. If the visitor scrolls past before the doll has settled, jump the doll to its final pose (do not hold the page unless the owner asks).
- **Per-frame style writes** on every character (Oryzo does it) are fine for one title but cost layout on 100+ chars across sections; keep to `transform` and `opacity`, cache refs, write only when the value changed.
- **Frame ratio**: 4:5 (owner) vs 85:110 (Oryzo): the strip math, thumbs and the scissor numbers scale with width = 0.8 * height; recompute the target `U` and view offsets from live rects, not constants.
- **Scissor math** needs the device-pixel scale (`canvasWidth / viewportWidth`) and a flipped Y (`H - (y + h)`); `setViewOffset` takes the full size and an offset in pixels at the sub-camera, and its sign is the reverse of the picture shift.
- **Videos in frames**: Oryzo's are 3.9 MB each at 6 Mbps; ours should be cropped to the character, 24 or 30 fps, loop-seamless, about 1 MB, played only while their frame is within 1 index of the centre (the `RafVideo` pattern: one play promise in flight, pause queued after it resolves).
- **Reduced motion**: the site ignores `prefers-reduced-motion` by owner decision; do not add a variant.
- **Mobile**: Oryzo's frames stay horizontal on phones, the thumbs are removed, the camera uses device orientation; our touch version should drive the hand from touch only.
- **Fonts**: Halyard Display is an Adobe font; use the site's own typeface and recompute sizes with the same ratios (title 123 px = 8.5% of width; tagline 24; body 18).
