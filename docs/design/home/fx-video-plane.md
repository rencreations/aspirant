# Home: the film plane (workstream VP)

The Psychoactive strip as an actor of the home's one stage: the trailer on a rounded plane that leans in the picture field's rows, stands upright as the 3.70 to 1 strip, opens to the full 16:9 window, becomes the leader of an orbit of the ten preview films, and leaves with them to the bottom right on flexible lines. One actor named `film`, drawn in one pass of its own. Code: `apps/web/src/features/home/fx/video-plane/`. Brief: `docs/design/home-reference/ref-psychoactive-tib.md` (psychoactive half 1.2 to 1.9, tib half 2.3), media in `docs/design/home/media.md`. The strip section (S2) drives it.

## API a section uses

```ts
import { ensureFilm, filmItems } from "../../fx/video-plane"; // runtime: in mount(), lazy
// preload.ts of the section:  import { filmItems } from "../../fx/video-plane/preload";   (no three.js)
// view.tsx / DOM labels:      import { sceneBox, stripBox, windowBox, expandBox, orbitStage } from "../../fx/video-plane/layout";

const film = await ensureFilm(ctx); // resolves at once; the videos load behind it

// EVERY frame the film is shown (this also sets film.visible = true). Whatever you leave out is the default.
film.show({
  appear: 1, //   0..1  the angled trailer appears between the cards (scale 0.6 -> 1 and a fade)
  morph: 1, //    0 lies angled in the field's rows .. 1 stands upright as the strip
  expand: 0, //   0 the strip (3.70:1) .. 1 the full window (16:9 at the scene's width)
  pull: 0, //     0 the window .. 1 the trailer is card 0 of the orbit and the ten previews have arrived
  fly: 0, //      0 the set stands .. 1 it has flown off to the bottom right
  travel: 0, //   the orbit's turn from the scroll, radians (the actor adds its own slow drift while pull > 0)
  effect: 1, //   0 the clean film .. 1 the strip's overlay (ink, colour split, cool tint, dark wash)
  arrival: "dolly", // "dolly" (the reference: the camera pulls back) | "gather" (the cards leave the frame one by one)
  angleU: 0,
  angleV: 0,
  angleSize: 0.62, // where the angled trailer lies on the rows' plane (plane px) and its size as a share of a rows card
  focusX: 0.5,
  focusY: 0.45, //            the point of the film the strip is centred on (fractions, y from the top)
  heroBox: null, //  { x, y, w, h } CSS px: a rectangle for the trailer's base pose instead of morph and expand
});

film.setHover("signature"); // "signature" | "lens" | "split" | "tilt" | "sweep" | "off", or { lens, split, tilt, sweep } (0..1 each)
film.setInteractive(true); // false while something covers the film (the player, an open preview)
film.setHeroCursor("PLAY"); // the site's cursor over the trailer (null: the plain cursor)
film.setPreviewCursor((i, f) => f.title); // the default; or a word, or null
film.onHeroClick(() => openPlayer()); // press on the trailer (hover and click ignore the film while fly > 0)
film.onPreviewClick(({ index, film }) => go(film.href)); // index 0..9, film { id, title, href, path, bytes, color }
film.setOrder(13); // FILM_ORDER, see "Order"
film.pause(); // a section that leaves (the actor also pauses by itself 10 frames after it is last shown)

film.heroRect(out); // the trailer on the screen: box of its quad, CSS px from the top left (null when not drawn)
film.previewRect(i, out); // preview i (0..9)
film.heroReady; // the trailer's first frame is in the texture (hold ctx.expectReady until then if you want)
film.hoveredPreview; // 0..9 or -1;  film.heroHovered
film.filmId(i);
film.film(i); // id and record of preview i
film.poseOf(k);
film.lensDistance;
film.debug(); // probes
```

Pure helpers (no three.js, tested): `layout.ts` (the scene box, the strip, the window, `expandBox(vw, vh, e)`, `orbitStage`, `orbitCardWidth`, `toFrame`) so the section's DOM (centre line, corner dots, "Selena"/"Obsidia", the play button) and the plane import the same rectangles. `scene.ts composeScene(vp, state, drift, out, bases)` gives the eleven poses, and `hero.ts`, `orbit.ts`, `flyoff.ts` the parts. A custom placement is one `heroBox`.

Loading: `filmItems({ trailer: "waited" | "deferred", trailerPriority, previewPriority })` is the chunk (weight 1), the trailer (`media:/video/home/strip-1280.mp4`, or `strip-1920.mp4` when the display is 1920 physical px wide or more; width times the uncapped pixel ratio, by the display only; 2.43 or 3.81 MB, waited) and the ten previews (2.69 MB, `deferred`, background downloads, priority 20 and a hundredth more for each). The actor loads the same path strings through `loadMedia`, so one download serves both (checked: every file is requested once, and played from a blob). A visit whose list never ran still works: the actor starts the downloads itself, the trailer first. `ensureFilm` does not wait for any video: a plane shows the clip's own colour until its first frame is decoded, then fades the picture in over 0.25 s. At the owner's 1706 by 950 at a pixel ratio of 1.5 the 1920 file is the one picked (7.8 MB waited, the media doc's number).

A note for S2: the ten previews are drawn in WebGL and need real DOM links (a visually hidden list in the text layer, one `a[href]` per film, `film.href` from `film(i)`) for the keyboard and screen readers. The actor only gives `onClick` and the records. The cursor label is set by the actor (`ctx.cursor.set`, also when the pointer moves from one plane to another inside the one `film` hit target); the DOM controls still win over it.

## What it does, beat by beat

The picture is always the cover of a 16:9 frame on the film (1920 by 808, 2.376 to 1), centred on (`focusX`, `focusY`). A plane wider than 16:9 shows a band of it, a taller one less of its width. **It is a reveal, not a re-fit**: the picture never rescales when the frame opens (a test walks the expand and checks a picture pixel is as wide as it is tall and that its scale follows only the frame's scale). That is the reference's clip-path inset 25.97 percent, rebuilt as the plane's own size. Expand to a full-bleed window is another `heroBox` or `expandBox` aspect: the design (call 5) is 16:9 at the scene's width, and a 16:9 cover of this film shows 75 percent of its width.

1. **morph 0, appear 0 to 1.** The trailer lies on the field's rows: `rowsGeom` is `wallGeom(18, wallFrame(vp, "rows"), { size: tall ? 0.5 : 0.34 })`, the same call as `buildFormations`, so the rotation (`q = Rz(-6) Rx(-53) Rz(35)`), the card width (688 px at 1440) and the long lens (2000) are the rows' own. It is a 16:9 card at the plane's centre (the screen's centre), `angleSize` of a rows card (0.62: 427 by 240 at 1440), or anywhere on the plane with `angleU`, `angleV` (its z is the plane's). Looked at beside `lab("field")` with `show("rows")`: it leans and foreshortens exactly as the cards do (`j3-0.png`).
2. **morph to 1.** Position, size, rotation (slerp to upright) and corner (6 percent of the height to 9 px) ease with `smootherstep(morph)`; the lens goes 2000 to 1000 with it (a plane at z = 0 is the same under any lens). The overlay (`effect`) comes on with the morph: `effect x smootherstep(ramp(morph, 0.35, 1))`, so the angled card is the clean, vivid film and the strip wears the overlay.
3. **expand 0 to 1.** The reference's numbers: the width `s W` with `s` 0.45 to 1 and the band `1 - 2 inset` with the inset 25.97 percent to 0, both linear in `e` (a measured 0.45, 0.525 at the first 50 px of 700). 504 by 136.25 at 1440 by 900 (3.70 to 1), 623.7 wide at 1706, 239 by 75 on a 390 phone (the reference's portrait rules: 0.7, 21.98 percent). Window 1120 by 630. Corner 20 px times the scale. The section eases `e` itself (the reference uses power1.out over 703 px of scroll).
4. **pull 0 to 1, "dolly".** The reference's pull (digest 1.7): the orbit's eleven cards are there from the start, scaled and shifted so card 0 coincides with the window (zoom about 4.5 at 1440), then the camera pulls back until they read at their own size. The width goes by `w_i = S.w (T0.w / S.w)^c`, the place by `a = (w_i / S.w - 1) / (T0.w / S.w - 1)` of the way from the window's centre to the leader's, the height from an aspect that goes 16:9 to 1.959, `c = easeInOutQuad(pull)`; each card is at `X.centre + (offset - offset0) Z`, size `card s Z`. The previews fade in over the first 0.2 of `c` (`smoothstep(0, 0.2, c)`). The trailer ends as card 0: the leader, 1.25 of a card (the digest's), 248 by 126 at 1440, still playing. It is the same plane, so there is no "roll" swap.
5. **pull, "gather".** The same trailer path with the cards at their own size: each leaves the frame along an arc, the head of the train first, growing from 0.18, fading in over the first 0.35 of its own time.
6. **The orbit** (digest 1.7): eleven cards on the ellipse `rx = W/2 - cardW 0.425`, `ry = H/2 - cardH 0.5` (stage `W` the scene width, `H = min(clamp(0.44 vw, 560, 800), vh - 96)`, a card `clamp(0.14 vw, 150, 270)` wide at 1.959 to 1). A comet train: angular gaps in a geometric series of ratio 0.88 over 0.62 of a turn; the leader 1.25 and the tail 0.4 of a card, times `0.82 + 0.18 front`; opacity `(1 - 0.78 a^0.85)(0.65 + 0.35 front)`; the front of the ellipse (the bottom) draws over the back. Start angle `ORBIT_START` 0.93 (the leader bottom right, the train up and to the left), turn = start + `travel` + drift (0.09 rad/s, only while `pull` is above 0, so it starts from the same composition every time). The blur of the reference's tail is opacity and scale only. Card order is the painter's order (`order`, three's transparent sort), not z, so the sizes are exactly the digest's.
7. **fly 0 to 1.** The set leaves on the digest's four lines (2.3): each 3x the screen diagonal long, tilted `-0.5 + angle` (about 28 degrees, descending to the right), offset along its normal by `y` half screens, bent by `y += sin(aX pi freq + phase) amp`. An item joins the nearest line (the foot of its perpendicular), leaves its own place for it over the first half of its ride, and goes on until it is clear of the right or bottom edge. It turns as it goes (a roll, a yaw of 0.9 to 2 half turns about its own vertical and a small tumble, from fixed seeds: the same spiral every load), shrinks to 0.32, goes 380 px back, bends and flutters like a card in the wind, and fades over the last 18 percent. The order is the tail of the orbit first and the trailer last, the starts spread over the first half of `fly`, every item done at 1. The line is shown by a trail: each item's own path, 28 points behind its centre, as faint white segments (one draw call, premultiplied). `lineAt`, `setupRoute`, `routeAt` are pure and exported for any section that wants the same lines.
8. **Hover** (hero and previews; the video keeps playing under all of it). Four effects, each an amount: `lens` (the picture swells under the pointer, 0.42 at the middle, with a ripple), `split` (the colour parts on the pointer's side of the frame), `tilt` (the frame leans toward the pointer, 0.26 rad yaw and 0.2 pitch at the edge, scaled by `clamp(560 / width, 0.35, 1)` because a big frame's edge moves much further; the picture shifts 3.5 percent and swells 7 percent inside it), `sweep` (a diagonal band and a soft spot of light follow the pointer). `signature` (the default) is all four at 0.7, 0.8, 1 and 0.9. A preview also rises 36 px toward the camera, grows 7 percent and draws over its neighbours, and the site's cursor shows the label. The hover eases at 9 per second. On touch the press is the hover (the hub's rule). Nothing is hit while `fly` is above 0.001.

## Look of the overlay (`effect`)

A slow two octave noise flow bends the picture (up to 4.5 percent of the frame, more on hover), a colour split grows toward the edges, a cool tint (0.66, 0.64, 1.0 at 34 percent), 25 percent more saturation, a dark wash of 0.28 to 0.52 (darker at the bottom, half as dark on hover) and a faint noise glow. It is the reference's "effects overlay" with no second video. At `effect` 0 the shader's colour path is the plain texture: the paused frame 0 against `strip-poster.webp` has mean RGB 75.96 55.09 89.70 against 74.90 53.95 88.82 and a blurred mean absolute difference of 1.08 levels (max 5.0): the raw sRGB path of the field, no conversion.

## Drawing

- One `Pass` named `film`, `FILM_ORDER = 13`: **over the picture field (12) and under the logo (15)**, the drones (25 and 35), Tetra (27), the cast (30: Silverbolt, the doll, Selena) and the marks (40). The film is the field's ground for the rows (a trailer between the cards, drawn over them as they leave) and is behind everything alive: Silverbolt flies out of the lower right in front of the departing previews, the drone leaves in front of the strip. A section that wants the film over the logo or a drone calls `film.setOrder(n)` (taking the pass out and putting it back, as `field.setOrder` does). No second composite and no render target: the planes go straight to the canvas, unlit, premultiplied, depth test off, so the field's colour path and the card light (one light from the upper left, 0.28) are matched.
- Its own perspective camera, lens `mix(2000, 1000, morph)` (the pixel lens `fov = pixelFov(h, d)` refit every frame, a plane at z = 0 is pixel exact); `film.lensDistance` says which.
- Eleven meshes, one 16 by 8 plane, one program, one material each. Corner by distance, one pixel of soft edge, a hairline of light inside the rim, back face mirrored. The quad is the plane plus 2 px.
- Videos: eleven `<video>` elements kept off the page (muted, `playsinline`, loop, no picture in picture), a `VideoTexture` for each with mipmaps and anisotropy (up to 8), uploaded unflipped (the picture's v runs from the top) when the browser presents a frame (about 24 a second, not 60: measured 24.1 uploads a second for each of the eleven). A plane plays only while it is drawn, above 2 percent opacity, on the screen, and (for a preview) while `pull` is above 0; the rest are paused and keep their last frame. A frozen scene (`__home.freeze(true)`, `dt` 0 for 3 frames) holds every video still, so a frame sheet is deterministic. Not shown for 10 frames: every video pauses and the hover is cleared; shown again: they resume (checked with `unpin` and `lab`).
- Hit test: one target `film`. The quads of the last frame (what the kernel's test asks), the nearest by `lens - z - order 0.01` (the field's metric plus the painter's order as a bias, and the trailer's order is 120, so the film wins where it is drawn over the field's cards at the same z), faded planes (below 25 percent) are not hit.
- Context loss: `rebuilt()` re-uploads the frame of every video (the elements persist). Lost for 500 ms and restored in the lab: the picture came back.

## Measured

Real Chrome, this laptop's GPU, 1440 by 900, dev server, 5 s each, all videos playing where it says so. CPU is the actor's own `update` and `draw` (submit) per frame, GPU the timer query around `draw`.

| scenario                                       | update (CPU) med / p95 | draw (CPU submit) med / p95 | GPU med / p95    | frame (rAF) |
| ---------------------------------------------- | ---------------------- | --------------------------- | ---------------- | ----------- |
| strip with the overlay, 1 video, DPR 1         | 0.10 / 0.3 ms          | 0.3 / 0.8 ms                | 0.015 / 0.045 ms | 16.7 / 16.8 |
| window, clean, 1 video, DPR 1                  | 0.10 / 0.2             | 0.3 / 0.7                   | 0.034 / 0.061    | 16.7 / 16.8 |
| orbit at rest, 11 videos, DPR 1                | 0.10 / 0.2             | 1.0 / 2.7                   | 0.143 / 0.322    | 16.7 / 16.8 |
| fly-off at 0.5, 11 planes, trails, DPR 1       | 0.20 / 0.3             | 0.9 / 3.3                   | 0.070 / 0.272    | 16.7 / 16.8 |
| orbit at rest, 11 videos, DPR 2 (2880 by 1800) | 0.10 / 0.2             | 1.1 / 2.6                   | 0.121 / 0.361    | 16.7 / 16.8 |
| window, 1 video, DPR 2                         | 0.10 / 0.1             | 0.2 / 0.7                   | 0.117 / 0.189    | 16.7 / 16.8 |

Ten decoders plus the trailer cost no frame: 0 to 2 dropped video frames in 5 s (the first ones), uploads 24 a second each. The draw's 1 ms with eleven videos is the `texImage2D` of the new frames (the previews are 560 by 286, the trailer 1280 by 538). Nothing allocates in a frame (the state, the poses, the quads, the looks, the trail buffers and the quaternion scratch are made once). The trail is one 308 segment draw. GPU memory (computed from the sizes, not read from the driver): the trailer 1280 by 538 with mips about 3.7 MB, a preview 0.9 MB, in all about 13 MB.

## Numbers to tune

`hero.ts` `HERO_ORDER` 120, the angled card's `angleSize` default 0.62 and `appear` scale 0.6; `layout.ts` the strip (0.45, 25.97 percent; portrait 0.7, 21.98 percent), the scene pad (`max(160, 50vw - 800)`), `orbitCardWidth`, `orbitStage`; `orbit.ts` `GAP_RATIO`, `SPAN`, `LEAD_SCALE`, `TAIL_SCALE`, `ORBIT_START`, `ORBIT_DRIFT`; `flyoff.ts` `LINES` (the digest's table), `FLY_DEPTH` 380, `END_SCALE` 0.32, `STAGGER` 0.5, `TRAIL_SPAN` 0.34, the roll, yaw and tumble ranges; `hover.ts` `HOVER_MODES`, `TILT`; `actor.ts` `LIFT` 36, `GROW` 0.07, `IDLE_FRAMES`, the trail's alpha (0.55) and colour; `shader.ts` the overlay (wash 0.28 to 0.52, tint, flow 0.045, split 0.012), the lens (0.42, radius 0.62 of the height), the sweep (0.17 band, 0.12 spot).

## End states (the joints, at 1440 by 900; tested in `scene.test.ts`)

All planes unlit, in the `film` pass; the field and every other actor are the section's to set.

| state                    | trailer (plane 0)                                                                                                                | previews (planes 1 to 10)                                   | lens | videos playing         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---- | ---------------------- |
| `morph 0, appear 0`      | on the rows' plane at the centre, 60 percent of the angled size, opacity 0                                                       | hidden                                                      | 2000 | none (not drawn)       |
| `morph 0, appear 1`      | on the rows' plane at (0, 0), 427 by 240 (`angleSize` 0.62), the rows' rotation, opacity 1, clean film (`effect` 0 by the morph) | hidden                                                      | 2000 | the trailer            |
| `morph 1, expand 0` (J3) | upright at the scene's centre, 504 by 136.25, corner 9, overlay on                                                               | hidden                                                      | 1000 | the trailer            |
| `expand 1, pull 0`       | the window 1120 by 630 at (160, 135) from the top left, corner 20, clean (the section lowers `effect` with the expand)           | hidden (opacity 0)                                          | 1000 | the trailer            |
| `pull 1, fly 0` (hold)   | card 0, the leader: at 1440 centre (284, -213) in the frame, 248 by 126, at the turn `ORBIT_START` plus travel plus drift        | ten cards on the ellipse, 72 by 37 (the tail) to 210 by 107 | 1000 | all eleven             |
| `fly 1` (J4)             | gone: opacity 0, 0.32 of its size, 380 back, off the right or bottom edge                                                        | gone, the same                                              | 1000 | none (paused when off) |

At 1706 by 950 the leader is 293 by 150 and the angled card 477 by 268; at 390 by 844 the strip is 239 by 75, the window 342 by 192, the leader 144 by 73, the angled card 316 by 178. The field's rows (`show("rows")`) at the same viewport lean the same way as the angled trailer.

## How to look

`window.__home.lab("film")` returns the actor (pinned shown). Scripts, not in the repo, `D:\ren\aspirant-work\home\VP\`: `lib.cjs` (opens real Chrome with the intro off and the lab's `window.__film`, `{ field: true }` also `window.__f`), `states.cjs <morph|appear|expand|pull|gather|fly>` (`SIZE=tall|big`: a state held by a rAF loop, frozen, shot) and `sheet.py <tag> <cols> <width>` (contact sheet), `hover.cjs` (every hover mode at three places on the strip or, `EXPAND=1`, on the window), `previews.cjs` (hover, cursor label and click on three previews and the trailer), `j3.cjs` (the field's rows with the angled trailer), `color.cjs` and `color.py` (the colour check), `perf.cjs` (`DPR=2`), `life.cjs` (pause when hidden, frozen, resize, a lost context), `net.cjs` (every file requested once), `big.cjs` (1706 by 950 at 1.5). Minimal:

```js
await page.evaluate(async () => {
  window.__film = await window.__home.lab("film");
  window.__home.seek(9); // the strip's ground is storm; the section's stubs draw nothing there
  const loop = () => {
    __film.show({ morph: 1, expand: 1, pull: 0.5 });
    requestAnimationFrame(loop);
  };
  loop();
});
await page.evaluate(() => __home.freeze(true)); // the videos hold too
await page.screenshot({ path: "x.png" });
```

Hide the Next dev overlay (`nextjs-portal{display:none}`) in shots: another helper's half-written file puts it up.

## Cut, not done, not verified

- Not wired into a section: `filmItems` was never run through the real bar (the actor's own `loadMedia` path was checked: one request each, played from a blob). S2 adds `filmItems()` to the strip's `preload()` and calls `film.show` every frame.
- The reference's "roll" (the real video rolls shut upward while card 0's picture slides in) is not built: the trailer is card 0, one plane, playing, so there is no swap to hide. The reference's three-state preview shader (a second loop, the noisy burn dissolve, the click pulse with its scanline) is reduced to the overlay and the four hovers; no click pulse. No confetti or balloons (the owner never asked).
- The four tib lines are not drawn as full lines, only as the trails of the items riding them. If the bolt section wants the whole lines it can call `lineAt` (pure) and draw them itself.
- The hover tilt, the lens and the sweep were looked at as still frames on the strip and the window, not felt with a hand on a trackpad; the amounts (`HOVER_MODES.signature`) are a first call. Touch: the press is the hover (the hub's rule), not tried on a real phone.
- The orbit's drift is 0.09 rad/s only while `pull` is above 0, and 0 otherwise, so a seek into the hold starts it from `ORBIT_START` plus `travel`. The reference keeps its drift running from the page load.
- Tall screens: the strip, window and orbit were looked at at 390 by 844 (sheet `tall-sheet.png`): the orbit's stage is the scene column, the cards `clamp(0.3 vw, 104, 150)`, not tuned.
- Not looked at: Firefox, Safari (the off-page `<video>` and `requestVideoFrameCallback` are the risks: where the callback is missing `VideoTexture` falls back to updating each frame), a weak GPU, the production build (the numbers are the dev server's, which costs CPU only), text zoom, a real context reset (a lost and restored context was tried with `WEBGL_lose_context`).
- Chrome prints `X4122` shader warnings from the compiler (a sum of constants not representable in double precision); they are warnings of the HLSL translation, not errors.
- The 1920 trailer is picked by the display alone and is 3.81 MB against 2.43 MB; at 1706 by 950 at 1.5 that is the file the owner gets.
