# Home: the hero and the aspirants (workstream S1)

> **Round two update (19 Nov 2026).** The hero is triggered (`sections/hero/index.ts`, plays), the logo is still at rest, the cards expand from behind the logo in 0.7 s (the first row of the table in section 2, "on open", is replaced), the hero has eighteen different portraits. See `round2-R-A1.md` and `round2-R-A.md`.

The first two scenes of the home, one continuous piece of choreography: the logo and the floating splash cards (premotio's hero), the logo morphing into the bar, the cards gathering, spiralling into the ring and landing as the wall, the wall sliding by itself under the owner's words, a preview window for every picture, and the wall opening into the full screen rows. Request: "Hero" and "The Aspirants" of `docs/superpowers/specs/2026-11-18-home-page-request.md`. Code: `apps/web/src/features/home/sections/hero/`, `sections/aspirants/`, `preview/`.

## 1. The one rule: everything is a function of the absolute scroll

The hero (S 0 to 4.2, tail 0.5) and the aspirants (S 4.2 to 5.8, lead 0.5) both run for S 3.7 to 4.7, and the picture field, the logo and the drone are shared actors with sticky setters. So nothing in these two sections reads the order the kernel runs them in. `sections/hero/timeline.ts` is a pure module of `S` (screens), each runtime turns its own `local` into `S` (`heroS`, `aspirantsS`, never `frame.S`, so a jump replays the right end), and `sections/hero/scene.ts` (`FieldScene`) sets the field and the drone from `S`. Both runtimes call the same `FieldScene.update({ S, ... })` in the overlap. The close of the aspirants is finished by S 5.3, before the rows section's lead begins (5.8 - 0.5), so the later section cannot cut it (`timeline.test.ts` holds this).

## 2. The beats (S in screens, 1440 by 900 and any other size)

| S            | what                                                                                                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| on open      | the cards fly out of the ring (behind the logo) to their scatter places in 1.7 s of real time (`blend(ring, scatter)` ranked from the top, opacity ramp), then float and answer the pointer. The cue comes in at 1.3 s. Only when the page opens at S < 0.1 |
| 0 to 0.17    | the freeze (story p 0 to 0.04): scatter, the logo's calm ripple (`REST_WAVE` 0.3), the cue under the logo                                                                                                                                                   |
| 0.05 to 0.35 | the cue goes out                                                                                                                                                                                                                                            |
| 0.21 to 1.43 | story p 0.05 to 0.34: the cards highest on the screen are picked first and spiral into the ring (cylindrical frame, premotio 1.7). The ring is low (field's `ringSpec`, centre 0.1 H under the middle)                                                      |
| 0.4 to 1.3   | the logo morph `P` 0 to 1 (linear in the scroll, so it reverses): the reel's corner stagger and the travelling wave, hand-off to the bar's logo at `P` 0.999. Done before the ring stands (1.43). The drone's eyes follow the logo up                       |
| 1.43 to 1.76 | the ring stands and turns                                                                                                                                                                                                                                   |
| 1.76 to 3.95 | the land: the cards leave the ring one by one and fly to the wall (4:5 to 16:9)                                                                                                                                                                             |
| 3.3 to 3.95  | the scissor closes from the whole screen to the wall's frame (the left 58 percent, the top 56 percent on a tall screen)                                                                                                                                     |
| 3.9 to 4.5   | the owner's words rise in, line by line (title, the MLBB line, the TheMLabel line, the button)                                                                                                                                                              |
| 3.95 to 4.3  | the wall's glide eases in (`SLIDE_RATE` 80 px/s of the wall plane); from 3.95 a card can be pressed (cursor VIEW)                                                                                                                                           |
| 4.3 to 5.0   | resting state: wall sliding, words shown. The middle of the section (S 5.0) is inside it on purpose: a control focused by the keyboard moves the page there (`home-stage.tsx`) and must find the words shown                                                |
| 5.0 to 5.27  | the glide eases to a stop                                                                                                                                                                                                                                   |
| 5.02 to 5.2  | the words fold up on their top edge (`rotateX` to -86 degrees, first line first) and are hidden                                                                                                                                                             |
| 5.05 to 5.3  | the scissor opens again with the wall's blend into the rows (5.08 to 5.3: `blend(wall, rows, t, 0.25, "left")`), same angle, card 0.36 to 0.34                                                                                                              |
| 5.3 and on   | J2: `show("rows")`, no scissor, no glide, no words                                                                                                                                                                                                          |

A hover on a card lifts it, parts its neighbours and stops the glide (the field's own, 0.35 s after the pointer leaves it starts again). A press (mouse, touch) opens the preview. While it is open the wall rests, takes no hover, the page is held (`ctx.scroll.hold`).

## 3. The preview window (`features/home/preview/`)

Radix `Dialog` (modal: focus trap, Escape, `aria-hidden` on the rest), a dark plate, the whole picture fitted, a close button, previous and next (buttons, the arrow keys, a swipe on touch), the title and a link to `/collection/arts`. The picture grows out of its card (a Web Animation on transform and opacity: `flipBetween` of the card's screen box to the fitted box) and flies back into the card it came from (`setPreviewResolver` gives its present place, even after a step to another picture; it sinks and fades when the card is off screen). Plate and controls fade with CSS so Radix waits for the exit. The `p` (1280 wide) picture shows at once and the full size (`f`, up to 3840) fades in over it when it arrives.

- Open from the store (`store.ts`, zustand): `FieldScene.onPress` calls `show(index, box)`. `PreviewHost` (a client component inside the aspirants' server markup) draws it. The overlay and the content carry `data-home-hit="dom"` so a press on them never reaches the canvas behind. A press on the empty space around the picture closes it.
- Keyboard: the cards are on the canvas, so one real button, "View the splash art" (`PreviewTrigger`), is the way in. It is hidden until it has the focus, then a pill at the foot of the wall's frame (and an ordinary pill on the plain page).
- Pictures: `pictures.ts`, the 18 official splash arts of `picks.json` `wall.order` (`pictures.test.ts` keeps it equal to the data and to the field's wall). Full size files: `files.ts`, `fetchWhole` into an object URL, one download shared by the loading list and a press (`loadFull`), freed by `releaseFull` when the section goes. The list's items are deferred, last in line (priority 160).

## 4. The call on "more images from the collection"

`arts-splash.json` holds 31 pictures: 18 official and 13 "Made for this site". The design (call 8) allows official art only, so the wall shows all 18 official splash arts, which are the whole official set of the collection's Splash art room and more than the hero's ten portrait cards. Growing the field's card count past 18 (to repeat nothing across a longer wall) is not a small change to the picture field and was not made. The preview browses the same 18.

## 5. Files

```
sections/hero/       index.ts (carry: true), view.tsx (h1 logo, the cue), hero.module.css, preload.ts, runtime.ts,
                     timeline.ts (+test: pure functions of S), scene.ts (FieldScene: field, clip, glide, cursor, press, drone)
sections/aspirants/  index.ts (unchanged), view.tsx (the owner's words, the hidden trigger, PreviewHost),
                     aspirants.module.css, preload.ts, runtime.ts (the words, the hold)
preview/             pictures.ts (+test), files.ts, store.ts, math.ts (+test), preview.tsx, preview.module.css
content.ts           ASPIRANTS.view ("VIEW"), PREVIEW (labels of the window)
scripts/qa/probes/home-s1.cjs
```

## 6. Loading

Hero list (all waited): the chunk, `logoItems()`, `fieldItems("hero", { wide: "waited" })` (the 10 cards 1.45 MB and the 18 wide pictures 2.5 MB), `droneItems({ deferred: false })`. Aspirants list: its chunk and the two small logos of the words (waited), the 18 full size pictures (deferred, priority 160). No `expectReady` in the hero: the sections only run once the page is open, so holding the loading screen for a section's first draw would deadlock; the engine already marks the page ready after two drawn frames and once the near sections are mounted.

## 7. End states (the joints)

Field: formation and `t`, clip, glide, interactive, cursor, press, order, opacity. `rate` is px per second of the wall plane; `offset` is the rows section's scroll offset (my scene writes 0).

| state                       | hero local 0 (S 0)                                                           | hero local 1 = aspirants local 0 (S 4.2)                           | aspirants local 1 (S 5.8, J2)                            |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| field formation             | `story` p 0 (scatter, live), after the burst; before it ring to scatter      | `story` p 1 (the wall, lens 2000)                                  | `rows` (the same plane over the whole screen, card 0.34) |
| clip                        | none                                                                         | the wall's frame (`frameRect("wall")`)                             | none                                                     |
| glide rate, offset          | 0, 0                                                                         | 64 px/s (`slideRate(4.2)`), 0                                      | 0, 0 (the carousel position `slideAt` is kept)           |
| interactive, hold on hover  | yes, yes                                                                     | yes, yes (open preview: no)                                        | yes, yes                                                 |
| cursor label, press handler | none, none                                                                   | "VIEW", opens the preview                                          | none, none                                               |
| order, edges, wake, opacity | 12 (`FIELD_ORDER`), formation's own, on, 1 (ramp during the burst)           | 12, formation's own, on, 1                                         | 12, formation's own, on, 1                               |
| logo actor                  | visible, `heroRect`, `wave` 0.3, `P` 0, taut                                 | hidden (handed off at `P` 0.999)                                   | hidden                                                   |
| bar's logo (`hideLogo`)     | hidden                                                                       | shown                                                              | shown                                                    |
| h1's own logo picture       | opacity 0 while the actor draws                                              | opacity 0                                                          | opacity 0                                                |
| drone                       | `routeAt(0)`: x +0.30 W, y -0.22 H, 0.17 H, back layer, looks at the pointer | `routeAt(4.2)`: x +0.38 W, y -0.34 H, 0.13 H                       | `routeAt(5.8)`; looks at the pointer                     |
| words, cue                  | cue shown, words not yet                                                     | words rising in (line 0 nearly in, line 3 just starting), cue gone | words folded and hidden (`visibility: hidden`), no cue   |

The rows section starts from J2: `show("rows")`, glide 0. It sets its own `setSlide(rate, offset)` (the offset is its scroll term); my scene writes offset 0 every frame so a visitor who scrolls back up into the wall finds it exact.

Joint J0 (the intro): `boot/` ends with the logo at `heroRect` with `LOGO_REST_WAVE` 0.3 (equal to `REST_WAVE` here) and the drone at `routeAt(0)`. The intro does not draw the cards: they come out of the ring at the page's opening.

## 8. Numbers to tune

`timeline.ts`: `TIMES` (every beat), `SLIDE_RATE`, the line stagger `LINE_GAP`. `scene.ts`: `ENTRANCE_SECONDS` 1.7, the burst's spread 0.55 and rank, the rows blend's spread 0.25 and rank "left". `runtime.ts` (hero): `REST_WAVE`, `CUE_GAP`, `SOFT_FROM`. `aspirants/runtime.ts`: `FOLD_DEG`, `RISE_PX`. `preview.module.css` and the flight durations in `preview.tsx` (620 ms in, 300 ms back).

## 9. How to look

`node scripts/qa/probes/home-s1.cjs <out>` (frame sheets at the beats and joints at three sizes, with the scene frozen, and the interaction checks). By hand: `window.__home.seek(S)`, `__home.freeze(true)`, a real wheel for the feel. Let the first 2.6 s pass after the page opens before a hero frame (the burst runs on real time and stops while frozen). At 4.6 the wall slides at 80 px/s: freeze to compare frames.

## 10. Calls made without the owner

- The 18 official pictures only (section 4).
- Story p equals the hero's local: premotio's three units of 1.4 H are exactly 4.2 screens.
- The cards fly out of the ring when the page opens (the request only says they fill the hero; the intro does not draw them).
- The close of the aspirants is the last 0.28 screen before the rows' lead, and the middle of the section is a resting state (keyboard focus).
- On a tall screen the words stand under the wall (bottom of the screen), on a wide one in the right 42 percent minus the gutter.
- The About button keeps the kernel's pill (hover fill, press scale). No extra animation was written for it.
- The preview links to `/collection/arts` ("More splash art"), which the request did not ask for.
- No scroll snap on the logo's morph (the first pass; the notes of the logo recommend one).

## 11. Not done, not verified

- The real intro into the hero (loader, tap, carry the logo, then the hero's first frame): not run end to end; the probes use `aspirants:intro` off. The hand-off numbers were read from `boot/`.
- The production build, `scripts/perf/weak.mjs`, a weak GPU, Firefox, Safari, a real phone (a touch context in desktop Chrome was used), a slow connection (the hero list was never watched going through the bar). On the dev server in real Chrome, 1440 by 900, a real wheel over S 0 to 5.6 kept 16.7 ms frames (p99 17.0).
- The unit tests cover the pure parts (`timeline`, `math`, `pictures`). `FieldScene` and the runtimes are three.js and DOM code, checked by looking and by the probe.
- The pixel ratio mismatch fade of the logo (a 3x phone, 1080p at 200 percent: `SOFT_FROM`) is written, not seen.
- The drone over the text on a phone: the lead's route puts it at the lower right, where the button row ends on a narrow screen. It does not cover the words in the frames taken, but it passes close.
- Text zoom, context loss with a real GPU reset, the cue's hairline on a slow machine.
- `e2e/home.spec.ts` still expects the walking skeleton's stub actors `test-ortho` and `test-perspective` (lines 182 to 200): they no longer exist. Not edited (not mine).
- The wall under the preview is paused, and the pointer's wake is off while it is open; the field was not checked for a card that is hovered at the very moment the window opens (it stays lifted behind the plate).
