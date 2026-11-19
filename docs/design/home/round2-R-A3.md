# Home round two: R-A3 (the strip, its dark backdrop, the letter swap, the window)

The owner's words for this area: `docs/superpowers/specs/2026-11-19-home-feedback-2-request.md`, the paragraph that starts "Okay so the next section are in dark theme". Code: `apps/web/src/features/home/sections/strip/` and one new kind in `fx/backdrop/`. Notes of the first version: `section-rows-strip.md` (the beats of the film and the orbit still hold).

## 1. What changed

| part               | before                                                      | now                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the dark ground    | beams, then threads                                         | `ink-field`: a new GLSL kind, from the wall's close (story S 4.95) through the rows, the window and the orbit. The bolt's own green night takes over in the bolt's lead              |
| big words          | Big Shoulders 800 synthesised italic, a serif italic lead   | upright (`font-style: normal`) for "Video", "Aspirant 5.0", "Trailer", "The Aspirants", "Official animations for". Big Shoulders has no italic: the old look was the browser's slant |
| the hover swap     | the new word started as noise and resolved left to right    | letter by letter, at random places, 0.35 s, smooth, for "Aspirant 5.0 to Our" and "Trailer to Collections". "Video" never changes on a hover (the digest), so it has no swap         |
| "See All"          | `/collection`                                               | `/collection/video/films` (`HOME_ROUTES.films`). "See Collections" already pointed there                                                                                             |
| the window         | 16:9 window, a 16:9 cover of the film (75 percent of width) | the window takes the film's own shape (1920 by 808, 2.376 to 1): 1120 by 471 at 1440. The whole picture shows. The strip keeps its 3.70 to 1 frame                                   |
| play button, words | 6rem by 3rem pill, 12px mono words                          | the scale of `/character/vexana` section 02: button 9.4em by 6em, words 7.5em Big Shoulders 800, an em is a 80th of the window's width, so it is the same shape on a phone           |
| flow               | 1.8 screens, dwell 0.54, 0.63, 0.63                         | 2.5 screens, dwell 0.9 (small frame), 0.6 (window), 1.0 (orbit with the heading and the button), one trigger per rest. `dwell.ts` holds the numbers                                  |

## 2. The ink field (`fx/backdrop/glsl-ink.ts`, registered as `"ink-field"`)

Spirit of psychoactive.co.nz (a dark ground with a slow luminous mist, a light that follows the cursor, grain, a vignette), written from scratch in the storm palette: `#070c24` ground, `#12307f` deep blue, `#1fa6e8` cyan, `#ff4fb0` hot pink, ink `#dff6ff`.

- The flow: a domain warped field (four calls of a four octave value noise, two slow layers that go the other way), edge light on the level lines of the cloud (the "ink"), coverage low where the field is dark (the storm ground darkens, so a handover from a light ground shows no grey wash from the kind itself).
- The cursor: a pull and a slow twist of the flow around it, a pink halo with a cyan skirt. Touch has no pointer between presses: the field sits at rest.
- The trail: ten ripples (`trail.ts`, pure, tested). A move far enough (0.035 of the screen) and not sooner than 50 ms leaves one; a press leaves a stronger one (also from a finger). Each is a ring that widens (0.34 of the height a second), pushes the flow outward as it passes and fades over 2.6 s.
- The film: `uX = (glow, half width, half height)` in screen heights. The strip passes `inkGlow(expand, pull, fly)` (0 on the small frame, 1 on the open window, 0 in the orbit and after the fly-off) and the film's own box, so the picture's light bleeds into the mist around the frame.
- The scroll: `speed = 1 + min(1.8, |frame.input.wheel| / 900)`, so the mist flows faster while the wheel is pushed, also while a scene holds the page (the wheel is read from the input, not from the page's position). `uVel` adds a little more.
- Cost, RTX 4060 laptop GPU, dev server, `BG/bench.cjs`: 0.26 ms at pixel ratio 2 (buffer 1080 by 675, `MID` resolution) and 0.58 ms at 1 (noisy: the same kind moved by 2 times between runs). Measured with an empty trail (a full trail adds ten cheap iterations, not measured). Under the 1 ms target.
- Shared files changed, all small and additive: `params.ts` (`extras`, four numbers, smoothed like the rest, `NumberOptions.extras`), `renderer.ts` (`uTrail`, `uX`, `FrameFeed.trail`), `backdrop.ts` (owns a `PointerTrail`, steps it in `feedFrame`, clears it on a snap and when the backdrop wakes), `palettes.ts` and `registry.ts` (the kind), `registry.test.ts` (at least thirty kinds; a kind may declare its own uniforms), `glsl-prelude.ts` is untouched (the kind declares `uTrail` and `uX` in its own source). New: `glsl-ink.ts`, `trail.ts`, `trail.test.ts`, `extras.test.ts`.
- `sections/backdrops.ts` (shared by the hero, the aspirants, the rows and the strip): `beams` and `threads` are gone, `ink-field` from S 4.95 on (`BACKDROP_AT.ink`); its test follows. The strip's runtime adds the glow and the wheel speed to the same kind (`driveBackdrop`), the rows' runtime asks the plain spec (no glow: the film is small there).

## 3. The letter swap (`swap-plan.ts`, `swap.ts`, `view.tsx`)

Two layers of letters in one grid cell (the word at rest and the word of the hover), so the cell is as wide as the wider word and nothing under it moves. `swapPlan(from, to, seed)` is pure: one slot for each place of a letter (a space in both words costs no time), a random order, one slot every `0.35 / slots` seconds clamped to 30 to 60 ms (50 ms for a word of seven), the old letter leaves and the new one comes 40 ms later, each letter fades over 0.1 s (`letterValue`, smoothstep). `WordSwap` moves each letter from where it is, so a hover that ends half way turns back with no jump. Opacity and a small rise (14 percent in, 10 percent out) only. The plain text for a screen reader is one copy (`data-sw-plain`) that is set to the goal word once when the goal changes; the letters are `aria-hidden`. `scramble.ts` and its test are gone.

Looked at, real Chrome, a log of every letter's opacity per frame: a hover in runs 0.40 s (letters arrive one by one, in no order, the old ones leave interleaved), a hover out 0.45 s, and a hover that ends half way turns back.

## 4. The window without a crop

`FilmState.aspect` (default 16 to 9, `fx/video-plane/types.ts`) is the film's shape; `filmStateAt` sets it from `TRAILER_FILM.aspect` (R-A4's data), so the rows and the strip agree and nothing jumps at J3.

- `layout.ts`: `stripLook(vw, vh, aspect)` works the inset out from the shape (0.179 for 2.376, the reference's 0.2597 for 16 to 9), so the strip stays 3.70 to 1 whatever the window's shape. `expandBox` keeps the scene's width from the 16 to 9 cap (the CSS scene box has that cap). The default call is unchanged.
- `hero.ts`: the window box takes `st.aspect`. The angled card in the rows stays 16 to 9.
- `actor.ts`: the frame that covers the picture is 16 to 9 on the strip and the film's shape once the window is open (`WINDOW_ASPECT + (st.aspect - WINDOW_ASPECT) * st.expand`), so the strip looks as before and the open window shows the whole picture (the old window showed 75 percent of its width).
- The strip's chrome (corner dots, tick marks) uses the same box. The site's player grows out of `film.heroRect()`: it scales the full screen frame by the window's width and clips to its box, so a window with the film's shape lines up with the letterboxed picture (looked at only as far as the window; the open player was not opened in this run).

## 5. The flow as plays (`dwell.ts`, `index.ts`)

Registry: `strip`, 2.5 screens, lead 0.3, tail 0.6. Positions are screens from the strip's start; the start moves with the sections before it (2.3 in this run).

| station | fires at | what it does                                          | seconds | rest it leaves                                                | dwell before the next |
| ------- | -------- | ----------------------------------------------------- | ------- | ------------------------------------------------------------- | --------------------- |
| 1       | 0.0      | the small frame's words come in (with the rows' play) | 3.0     | the small frame, "Video", "See All", "Aspirant 5.0 Trailer"   | 0.9 screens           |
| 2       | 0.9      | the expand to the window (`inOutSoft`)                | 1.5     | the window, "Play Films", the button, "03:00"                 | 0.6                   |
| 3       | 1.5      | the pull into the orbit (`inOutSoft`)                 | 1.8     | "Official animations for The Aspirants", the line, the button | 1.0                   |
| 4       | 2.5      | the fly-off to the bottom right (`inOutSoft`)         | 1.4     | a bare dark screen; the bolt's arrival fires 0.25 later       | 0.25                  |

Backward runs take 0.7 of the time (the default). Looked at with a real wheel at 1440 by 900: down through the hero, the wall, the rows, the strip and into the bolt in one run (each play locked, `html.lenis-stopped` on exactly while a play ran), and up from the end of the strip with the wheel: the plays ran backward one after the other, each locked (the log of the last part, the plays back to the first, was read; the fly-off's backward run was not watched on its own).

`data-home-focus-at` (the shell's keyboard jump) and `FOCUS_AT` / `FOCUS_RANGE` of the runtime come from `dwell.ts` and are inside the dwell of the rest that shows the control. The old values (2.4 screens for a section of 1.8) were past the end, so the shell fell back to the middle.

## 6. Audit of the strip, as an art director

Found and fixed:

- Italic on every big word (a synthesised slant of an upright face). Fixed.
- A window that cut the film to 75 percent of its width. Fixed.
- A play button and two words that were small next to the heading. Fixed to Vexana's scale.
- Hover words that opened as noise and resolved left to right (the owner: "snap"). Fixed.
- The strip had three triggers inside 1.8 screens, 0.54 to 0.63 screens apart: the heading and the button of the orbit were gone after half a screen. Dwells follow the content now.
- A keyboard focus on a control past the end of the section (above). Fixed.
- The mist had a grey cast when it was the first version (too much body coverage): the body alpha was cut to 0.08 to 0.38 and the ridge light carries the look.

Found and not fixed (not mine, or not verified):

- The ink field is on the rows too (the owner's "transition to dark"): the ground between the light cards still reads grey blue at the rows' rest, because the field's own plane is light there (the wall helper's). It darkens as the cards clear. Not mine.
- The bolt's lead (0.5 screens) starts inside the last half of the orbit's dwell: its green night cross-fades over the ink field while the heading is still on screen. Legible, but the orbit's last half screen is not under the ink field.
- `rowsScale` and `RowsScale` in `film-state.ts` are no longer used (the rows helper's change): knip reports them.
- A one frame white band along the top edge in three of the real wheel screenshots (while the page was held). Not investigated.
- A press on the strip's "scroll to the film" button moves the page across the expand's threshold with a script move: the plays rest on the position, so the window arrives at once (no scene). Kept: it is a control, not a wheel.
- The two previews "awakening" and "a friend" that show the same garden are R-A4's media.

## 7. Numbers to tune

`dwell.ts`: `STRIP_DWELL`, the focus places. `swap-plan.ts`: `SWAP_TOTAL` 0.35, `STEP_MIN` 0.03, `STEP_MAX` 0.06, `SWAP_FADE` 0.1, `CROSS` 0.4; `swap.ts`: `RISE` 14, `DRIFT` 10. `glsl-ink.ts`: `aBody` (0.08 + 0.3 body), the ridge 0.55, the halo 0.3, the ring width (27) and speed (0.34), the film's bleed 0.5, the vignette 0.5. `trail.ts`: `TRAIL_LIFE`, `TRAIL_MOVE`, `TRAIL_GAP`, `PRESS_STRENGTH`. `journey.ts`: `inkGlow`, `inkSpeed` (900 px a second, up to 2.8). `strip.module.css`: `.windowBox` font-size (the window's width times 0.0125), `.play` 9.4em by 6em, `.windowWord` 7.5em.

## 8. How to look

Scripts of this run (not in the repo): `D:\ren\aspirant-work\home\R-A3\` (`lib.cjs`, `st2.cjs` stations by `AT`, `ink2.cjs` the cursor trail, `hover.cjs` the letter log, `wheel.cjs` and `hand.cjs` a real wheel with frames on a timer, `up.cjs` backward). Stations: `__home.seek(strip.start + 0.4 | 1.2 | 2.1)`, read the start from `__home.sections()`. `window.__home.lab("backdrop")` gives the backdrop for `set("ink-field", { theme: "storm", extras: [1, 0.78, 0.34, 0] })`.

## 9. Not verified

- The production build, a phone's real GPU, Firefox, Safari, a real touch (390 by 844 was desktop Chrome with touch emulation; the window, small frame and orbit were looked at, not the swap by touch).
- 1706 by 950.
- The ink field with a full trail on the GPU; its cost on an integrated GPU.
- The whole film's streaming, the preview clips and the player's open animation (R-A4's and the site's): the window and its words only.
- The cursor label PLAY on the open window (it shows, near the pointer; not judged).
- `e2e` tests.
