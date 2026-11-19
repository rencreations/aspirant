# Home: the live backdrop (workstream BG, round two)

Thirty live shader backgrounds for the home page, in the spirit of reactbits.dev/c/backgrounds (every shader is written from scratch). Code: `apps/web/src/features/home/fx/backdrop/`. A section asks for one kind per frame; the backdrop cross-fades when the kind changes, follows the pointer and the scroll, and costs nothing while no section asks.

## 1. Where it draws (the home now has two WebGL contexts)

The stage's one canvas sits above the `below` DOM layer, so a background drawn in it would cover the frames and windows of the sections. The backdrop therefore has its own small canvas and its own `WebGLRenderer` (the owner's call: more beauty beats the one-canvas rule). It lives in the ground stack:

```
z 0  .grounds   daybreak, storm, colour (three divs)
                .backdrop   <- the backdrop's host: its canvas is made in code, transparent, no pointer events
z 1  .below
z 2  the stage's canvas
z 3  text
```

- The canvas is made in code by `renderer.ts` (a canvas whose context was lost cannot be reused), appended to `.backdrop` (a div that `home-stage.tsx` renders), `aria-hidden`, `visibility: hidden` while nothing is drawn.
- The second context is made lazily, on the first `ensureBackdrop`: a visit whose sections never ask never has it.
- The plain page (`data-gl="off"`): the engine does not start, so no canvas exists (checked: no `canvas[data-home-backdrop]`, the host is `display: none`, no console error).
- Nothing is written to `<html>` or `<body>` (checked: both have no `style` attribute before and after).
- Lost context: the same rule as the stage. It waits 1.5 s for a restore, then makes a new canvas and renderer, three times at most. After that the backdrop is gone for good: `set` still works (a no-op), the canvas is hidden, and the page goes on. A missing backdrop never calls the stage's `onFailed`.

CLAUDE.md should say: the home has two contexts, the stage and the backdrop (the lead updates it).

## 2. The API

```ts
import { ensureBackdrop, BACKDROP_PALETTES, type BackdropKind } from "../../fx/backdrop";

// in mount (a section's runtime):
const backdrop = await ensureBackdrop(ctx); // one per page, shared by every section
void backdrop.warm(["aurora", "particles"]); // optional: compile the shaders before the first frame

// in update (EVERY frame the section wants it):
backdrop.set("aurora", {
  theme: "storm", // "daybreak" (default) | "storm": picks the palette
  colors: ["#5ce1ff", "#b59cff", "#ff6ac8"], // 1 to 4 CSS colours, default BACKDROP_PALETTES[kind][theme]
  amount: 0.6, // 0..1, the opacity of the kind: the calm knob over text
  speed: 1, // 0..: the kind's own time (it integrates, so a change never jumps)
  scale: 1, // size of the pattern (bigger is larger features)
  intensity: 1, // multiplies the palette's intensity (the strength of the light)
  angle: 0, // degrees
  seed: 0, // another frame of the same kind; a fixed seed is a fixed look
  ink: "#ffffff", // the highlight colour of the kind (default: white on storm, deep blue-grey on daybreak)
});
```

- `backdrop` is an `Actor` named `"backdrop"` (registered by `ensureActor`). The kernel hides every actor before the sections run, so **a backdrop that no section calls `set` on in a frame fades out over 0.5 s and then draws nothing**. `set()` is what makes it visible; there is no `visible = true` to write.
- When two sections overlap (lead and tail) the later `set` wins, as for any actor. A different kind in the next section gives a **0.5 s cross-fade** (both are drawn, `old * (1 - t) + new * t` in premultiplied colour, so the weights always sum to 1 and the ground never shows through in the middle). A kind that arrives in the middle of a fade takes the share the others had (at most three layers are drawn). The same kind with other numbers or colours does not cross-fade: the numbers and the colours follow what the section asked, smoothly (a rate of 7 a second, the same at 60 and 144 Hz).
- A jump of the scroll (a seek, Back, the page opening: the engine's `jumped`) snaps the fade and the smoothing. `backdrop.snap()` does it by hand (the lab uses it: frozen time never ends a fade).
- `backdrop.state()` says what it is doing: `{ kind, layers: [{ kind, weight }], presence, drawing, draws, buffer, available }`. `draws` counts the draw calls issued and does not move while it is hidden.
- It **never throws**: an unknown kind, no host, no WebGL, a context lost for good are all quiet no-ops. A section can call it without a guard.
- The pointer (0..1, smoothed, fades in and out with the pointer being over the page), the home's `S`, and the smoothed speed of the scroll (`uVel`, screens a second) are fed by itself from `ctx.pointer` and the frame. A touch has no pointer between presses, so the pointer kinds sit at rest on a phone.
- `BACKDROP_KINDS` (the list), `BACKDROP_PALETTES[kind][theme]` (`{ colors, intensity, ink }`) are data only (no shader): read them anywhere.

### Order, and the engine's small edits

`ORDER.backdrop = 45` (between `background` 40 and `draw` 50, `kernel/clock.ts`). The engine binds the host with `bindBackdrop(stage, options.backdrop)` (`fx/backdrop/host.ts`, tiny: the engine chunk does not pull in the shaders) and runs `backdrop.draw(frameInfo, jumped)` in that callback, after the sections have set it. `home-stage.tsx` renders the host div and passes it; `home.module.css` has `.backdrop` and `.backdrop > canvas`; `kernel/lab.ts` has `backdrop`.

## 3. How a kind is drawn

One fullscreen triangle per layer, no textures (value noise and hashes in the shader), premultiplied colour, raw sRGB end to end (a CSS colour is parsed to floats and written as it is: no linear conversion). A kind is `vec4 bg(vec2 uv, vec2 p, vec2 pt, float t)`; the prelude (`glsl-prelude.ts`) gives `pal(t)` (four stops), `fbm`, `vn`, hashes, `over()`, a hair of dither against banding, and the amount.

**Resolution depends on the kind, never on the device.** Soft kinds draw at 0.5 of the canvas in CSS pixels (the stretch is a free blur), mid kinds at 0.75, hairline and dot kinds ask for 1.5 and get the display's ratio up to that (`min(res, dpr)`), within a 2.4 million pixel budget. Hairline kinds work in CSS pixels from the top left like the CSS ground, so a dot of the `dot-grid` sits exactly on a dot of the daybreak ground.

## 4. The kinds

`amount` guide: 1 for a hero or a scene that is the picture; 0.5 to 0.7 behind a title; 0.3 to 0.45 behind a paragraph. Daybreak is pastel tints (or deep inks at low alpha for the thin kinds); storm is saturated light on near black.

| kind            | how it looks                                                             | where it fits                                                                   |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| aurora          | curtains of light with folds and a bright hem, rays rising               | Selena's section (her colours), the hand and nebula, a storm hero               |
| soft-aurora     | big soft pools of colour, warped slowly                                  | the daybreak hero, a calm joint, the comedy's sky (warm colours)                |
| beams           | soft diagonal beams with a pulse running down them                       | a dark film section (the strip), the music stage                                |
| particles       | four depths of soft bokeh dots, parallax with the pointer and the scroll | the Aspirants, the rows, any section that needs air                             |
| dark-veil       | a dark flowing veil with bright veins (a marble on daybreak)             | the strip, the voices behind a title, a storm joint                             |
| silk            | cloth bands with a fine ripple and a sheen                               | Selena, the list (a character's colours), the footer                            |
| threads         | 26 hairlines that gather and part                                        | the rows, the archive, a calm daybreak page                                     |
| plasma          | folded colour fields with iso lines                                      | the comedy, the chase, a loud joint                                             |
| prism           | white beam into a triangle, a spectrum fan out of it                     | the five pairs, the hand, a title card                                          |
| iridescence     | thin-film holographic marbling, pastel                                   | the daybreak hero, the voices, a big "wow" with no motion noise                 |
| liquid-chrome   | warped liquid metal with a horizon reflection                            | the hand, the bolt (a steel ground)                                             |
| lightning       | a strike every 2.2 s with a branch and a lit vein net                    | the bolt, the fall, a dramatic storm                                            |
| orb             | a glowing orb with swirls and hairline rings that leans to the pointer   | the music (a disc), a single idea in the middle                                 |
| galaxy          | a spiral with arms, a core and stars                                     | the hand and nebula, the footer                                                 |
| stars           | three layers of twinkling points with sparkle crosses                    | the footer, the fall at night                                                   |
| ripple-grid     | a hairline grid that ripples from the centre and the pointer             | the archive, the list                                                           |
| squares         | a drifting square grid, cells near the pointer fill                      | the archive (a collection grid)                                                 |
| dot-grid        | the 28 px dot grid with cursor warp (dots swell and push away)           | the aspirants, the archive, any daybreak section that should answer the pointer |
| grid-distortion | a hairline grid with a lens at the pointer                               | the archive, the rows                                                           |
| hyperspeed      | radial streaks from a vanishing point (faster when the scroll is)        | the fall, the chase                                                             |
| speed-lines     | vertical streaks falling (longer when the scroll is fast)                | the fall (the bolt falling), the chase                                          |
| gradient-blinds | vertical slats with a gradient each, tilting in a wave                   | the music, the voices, a stage                                                  |
| waves           | five layers of sea with foam on the crests                               | the voices (calm), the comedy                                                   |
| light-rays      | god rays from above                                                      | the music, the list, a reveal                                                   |
| floating-lines  | six long drifting curves with a light travelling on each                 | the footer, the rows, quiet daybreak pages                                      |
| pixel-blast     | animated dithered pixels that burst at the pointer                       | the archive, the chase                                                          |
| earth           | faceted boulders and dust drifting (cel flat shaded)                     | the bend (Tetra, earth)                                                         |
| air             | wind streaks and two swirls                                              | the bend (air)                                                                  |
| water           | caustics, ripples and a falling drop                                     | the bend (water)                                                                |
| fire            | flame tongues and rising embers                                          | the bend (fire)                                                                 |

Palettes of every kind for both grounds are in `palettes.ts` (looked at, see section 6). For a character's colour pass `colors` (two or three colours of her art) and pick the theme of the section's ground.

## 5. Cost

Measured on the real GPU (ANGLE on an NVIDIA RTX 4060 Laptop GPU, Direct3D 11, real Chrome, the dev server at 1440 x 900), with `EXT_disjoint_timer_query_webgl2` around 20 draws of one kind. The stage was drawing in the same page, so the numbers carry the noise of a shared GPU: the same kind moved by up to 2 times between runs (stars 0.41 and 0.87, floating lines 0.38 and 0.99). Read them as an order of magnitude. The CPU side of a draw (the JS that sets the uniforms and calls three) is 0.005 to 0.035 ms.

Target: under about 1.2 ms of GPU per frame for the heaviest at pixel ratio 2. Met: the heaviest of the last run is 0.99 ms (floating-lines), and most are under 0.4 ms. A cross-fade draws two kinds for half a second.

Cheapened for everyone after the first measurement (not turned off anywhere): stars, floating-lines (skip the work far from a line), lightning and liquid-chrome (fewer noise calls), pixel-blast (buffer 1.0 instead of 1.5, its cells are 11 px). They fell by about half.

RTX 4060 Laptop GPU, last full run:

| kind            | buffer at pixel ratio 2 | GPU ms, ratio 2 | GPU ms, ratio 1 |
| --------------- | ----------------------- | --------------- | --------------- |
| aurora          | 720 x 450               | 0.10            | 0.58            |
| soft-aurora     | 720 x 450               | 0.12            | 0.17            |
| beams           | 1080 x 675              | 0.13            | 0.40            |
| particles       | 720 x 450               | 0.08            | 0.08            |
| dark-veil       | 720 x 450               | 0.40            | 0.29            |
| silk            | 720 x 450               | 0.02            | 0.02            |
| threads         | 1960 x 1225             | 0.71            | 0.20            |
| plasma          | 720 x 450               | 0.03            | 0.04            |
| prism           | 1080 x 675              | 0.18            | 0.35            |
| iridescence     | 720 x 450               | 0.15            | 0.27            |
| liquid-chrome   | 720 x 450               | 0.40            | 0.47            |
| lightning       | 1080 x 675              | 0.63            | 0.70            |
| orb             | 1080 x 675              | 0.45            | 0.54            |
| galaxy          | 1080 x 675              | 0.50            | 0.34            |
| stars           | 1960 x 1225             | 0.87            | 0.22            |
| ripple-grid     | 1960 x 1225             | 0.20            | 0.11            |
| squares         | 1960 x 1225             | 0.13            | 0.07            |
| dot-grid        | 1960 x 1225             | 0.19            | 0.18            |
| grid-distortion | 1960 x 1225             | 0.20            | 0.15            |
| hyperspeed      | 1080 x 675              | 0.17            | 0.09            |
| speed-lines     | 1080 x 675              | 0.14            | 0.42            |
| gradient-blinds | 1960 x 1225             | 0.32            | 0.13            |
| waves           | 1080 x 675              | 0.29            | 0.30            |
| light-rays      | 720 x 450               | 0.14            | 0.20            |
| floating-lines  | 1960 x 1225             | 0.99            | 0.57            |
| pixel-blast     | 1440 x 900              | 0.35            | 0.47            |
| earth           | 1080 x 675              | 0.69            | 0.40            |
| air             | 1080 x 675              | 0.28            | 0.22            |
| water           | 1080 x 675              | 0.39            | 0.18            |
| fire            | 720 x 450               | 0.20            | 0.23            |

An integrated GPU will be several times slower: not measured (no such machine here). If one of them costs too much there, make that kind cheaper for everyone (fewer noise octaves, a smaller buffer); do not gate it on the device (CLAUDE.md).

## 6. How to look, and what was looked at

- `window.__home.lab("backdrop")` returns the actor and pins it shown. `actor.set("water", { theme: "storm", seed: 3 }); actor.snap()` shows a kind on the real stage; `actor.state()` tells what it draws; `actor.debug()` gives `{ gl, canvas, gpu, redraw(times) }` for timing.
- `D:\ren\aspirant-work\home\BG\kinds.cjs` sets every kind on both grounds at 1440x900 (`SIZES=desk,phone`, `THEMES`, `ONLY`) and screenshots the ground with the other layers hidden; `sheet.py` and `sheet2.py` make the contact sheets; `behave.cjs` checks the cross-fade, the draw-skip, context loss, the pointer, the plain page and the writes to `<html>` and `<body>`; `bench.cjs` is the cost table.
- Looked at (contact sheets, read): all 30 kinds on daybreak and storm at 1440 x 900, and on storm and daybreak at 390 x 844 at pixel ratio 2. Changed after looking: aurora (more contrast), silk (rebuilt as cloth), plasma (finer), iridescence (no green seam), chrome (softer), lightning (a lit vein net between strikes, so it is never empty), earth (faceted boulders in place of blobs that looked like clover), waves (layers drawn back to front), water (the caustic formula needs a large offset), the two grids (no knot at the lens centre), dot-grid (stronger).
- Mid-fade frames, held with `__home.freeze(true)` so the weights stand (aurora to silk, aurora to dot-grid, dot-grid to aurora): real blends of the two, no blank frame and no flash, including when the buffer changes size in the middle of the fade (soft 0.5 to hairline 1.5): the actor resizes and draws in the same frame.
- Under text: six of the busiest kinds (pixel-blast, plasma, iridescence, particles, squares, threads) at `amount: 0.4` on the daybreak Aspirants page (its title, paragraph and button) and behind the hand on storm. The copy stays fully legible and the 3D model is clean in front. At 1 they are for scenes with no copy. Only these six were looked at under text; the rest are calmer by construction (soft, low alpha) but were not shot with copy.
- `warm()` of all 30 kinds resolves (4.2 s on the dev server, async compile) with nothing in the console from the backdrop.
- Console: no error and no warning from a kind in any run. Seen in the same pages and not ours: another helper's shader warnings (X4122 float precision, and `hand-glove` "varying vClaw does not match", which makes the dev overlay say "2 issues"), and a preload note.
- Tests (`fx/backdrop/*.test.ts`, 55): colour parsing (hex, rgb, hsl, bad input), the four stops, the cross-fade (sums to 1 at every step, monotonic, a third kind mid-fade, a kind that returns, snap, hidden), the draw-skip rule, the numbers and the buffer size (60 and 144 Hz agree, budget), the registry (30 kinds, palettes parse, every uniform a shader reads is declared, balanced braces), the actor with no WebGL (never throws), `ensureBackdrop` (one per page, hidden by the kernel's rule), the host binding.

## 7. Calls made, and what is not verified

- **Resolution.** The brief said to render at 0.5 or less. Soft kinds do (0.5), mid kinds are 0.75, and the hairline and dot kinds draw at up to 1.5 of CSS (pixel-blast at 1.0): at 0.5 a one pixel line or a dot smears into mush, and the site's look is dots and hairlines. The cost target still holds (heaviest about 1.0 ms at ratio 2). It depends on the kind, never on the device. The lead may veto it: set `res` in `registry.ts`.
- The GPU numbers vary up to 2 times between runs (shared GPU).
- The dev server reloaded the page in the middle of probes several times (other helpers saved files); the probe scripts retry.

- An integrated GPU, a phone's real GPU, Firefox and Safari (premultiplied canvases and the timer query are Chrome's). The phone shots are a desktop Chrome emulation at pixel ratio 2.
- The production build (the dev server's numbers, and the shaders are not minified differently, but it was not looked at).
- A real section driving it every frame: the sections of round two are written by other helpers. The same path was run with a stand-in that calls `set` inside the engine's tick (fades in, holds, fades out when the calls stop, draws stop).
- Sound is not involved. The pointer kinds were looked at with a synthetic pointer only; a real touch was not.
- A `below` slot with an opaque background hides the backdrop under it: a section that wants the backdrop must keep its slot transparent where it should show.

## 8. Round two, R-F: calls and findings

- **`fade` (seconds).** `BackdropOptions.fade` is the cross-fade when this kind comes in over another (default `FADE_S` 0.5, at least `MIN_FADE_S` 0.1; `mix.ts` `step(dt, want, snap, fadeS)`). The whole backdrop's own fade in and out stays 0.5 s. The bend's four element kinds ask for 0.2 s because a stance lasts about 0.45 s: at the default each element was gone before it had come in (seen in the frame sheet: earth boulders, wind swirls, caustics and flame now each stand formed).
- **Colours.** A kind drawn on daybreak with custom pastel `colors` vanishes on the `#f4f6f9` ground. Leave `colors` out and take the palette. On storm custom colours are fine (the Selena section's aurora passes her four).
- **No pointer kinds on touch.** `iridescence` was reported (R-C) to draw nothing without a pointer. Looked at again: on the footer at 1440 with the pointer outside the page it draws the full marbling, and on a phone the bend's `particles` and the footer draw. The kinds that answer the pointer (`squares`, `dot-grid`, `grid-distortion`, `ripple-grid`, `pixel-blast`) have a base pattern without it; none was found empty. Still: a touch has no hover, so never put information in what the pointer reveals.
- **A missing backdrop shows as the ground.** In long probe sessions with many page reloads some recordings had no aurora (the sky was a navy void). The cause was not proven (a lost context is the likely one); a fresh browser always drew it. The Selena section now fades the list's dusk sky only while the backdrop really draws (`backdrop.state().available` once its shader is warm), so the room is never a void.
