# Home round three: H3 (the strip: backdrop, overlay, the window's deck, the scroll)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-3-request.md`, the strip paragraph. Code: `sections/strip/`, `fx/backdrop/glsl-ink.ts`, a small additive part of `fx/video-plane/`.

## 1. What changed

| part                       | before                                                                                   | now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ink field                  | cursor halo (pink), ten pointer ripples, glow around the film, flow speed from the wheel | none of those. The flow leans toward the pointer (very wide, soft) and its two layers slide against it (parallax). No pink in the palette (`#060b22`, `#0f2a78`, `#1a6bc8`, `#6fd2ff`). It never reads `uVel`, `uS` or `uX` and the strip no longer sets `speed` or `extras`                                                                                                                                                                                                                               |
| three triangle dots        | `data-strip-scroll`, a button at the scene's lower right that scrolled to the window     | removed (view, css, runtime, `STRIP.controls.scroll`, `kindOf`)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| overlay on the video       | none that lasted: the strip's `effect` (tint, wash) is cleaned out by the expand         | a live light overlay in the film plane's shader (`uOverlay`): fine scanlines that drift, grain, a slow sweep, a breathing vignette, a colour fringe toward the edges. On a hover the lines and grain come up around the pointer, the fringe grows under it and the idle sweep gives way. It is on from the turn upright, softer on the window (0.6), and fades out across the first three quarters of the exit (`overlayAmount` in `journey.ts`, set in `filmStateAt`, so the rows' joint cannot disagree) |
| the big window             | "PLAY FILMS", button, "03:00"                                                            | `PLAY` left and `FILMS` right of the button, built and moved like Vexana's "02, the film" (`deck.ts`, `deck.module.css`, markup in `view.tsx`)                                                                                                                                                                                                                                                                                                                                                             |
| above and below the window | four tick marks                                                                          | two bands (five marks each, and a strip of running words), a readout pill, all reacting when idle and on a hover                                                                                                                                                                                                                                                                                                                                                                                           |
| flow                       | four clock plays                                                                         | two scroll zones and two triggers (section 3)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## 2. The deck (`deck.ts`), what is copied from Vexana

Source: `features/character/vexana/reel/reel-controller.ts` (`renderDecor` and the variations), `reel.module.css`. It imports Vexana's `fit`, `easeSettle`, `expoInOut`, `stepSpring` and `put`. Colours are the strip's (ice button, cyan disc, sky ring, blue and ice marks), no pink.

- **The words.** Each letter is a mask with two glyphs. They rise in letter by letter once the window is complete, one letter of each word rolls over every 2 s, and on a hover the letters lean toward the button (0.04 em and 7 degrees, the nearest first, a spring).
- **The button.** A cyan disc rises through it on a hover (CSS, `data-hover`), it grows 10 percent on a hover, squashes on a press, and every 3.2 to 4.8 s while nobody touches it the triangle hops forward and a ring ripples off it.
- **The bands.** Five marks at 0, 25, 50, 75 and 100 percent (a plus, an x, a circle, a triangle, a half disc). They spin in, swap shape in mirrored pairs every 2.8 to 5.2 s, and slide out of their band on a hover while a strip of running words (`PLAY THE TRAILER`, `ASPIRANT 5.0 TRAILER`, `SELENA & OBSIDIA`, `THE ASPIRANTS`) rises into it and runs. Each new hover brings the next line.
- **The readout pill** at the picture's top left rolls between `ASPIRANT 5.0 TRAILER`, `DURATION 03:00` and `SELENA & OBSIDIA` every 3.4 s. The duration is the film's real one (`STRIP.play.duration`, pinned to the data by `strip.test.ts`).
- **Clock.** Everything runs on the frame's `dt` (a frozen scene holds it), writes transform and opacity only through `put`, and uses `Math.random` only for the idle variations. The hover is the button's own (mouse or pen, or the focus ring). A finger has no hover: a press opens the player.
- **Place.** The deck is a box of the window's own size (`--sw / --wa`, `--wa` is the film's 2.376) in the middle of the scene, so nothing is measured per frame. Copy is in `content.ts` (`STRIP.play.left`, `.right`, `STRIP.deck`) and `deck-copy.ts`.
- The press on the button, the frame (the film's hero click) and the keyboard open the player as before (looked at: press, open, Escape).

## 3. The scroll (`dwell.ts`, `index.ts`, kernel-scrub.md)

| scene                                          | kind                                          | length                                    |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| the small frame's words come in                | zone (0 to 0.45 screens)                      | 0.45                                      |
| rest: the small frame, its words and "See All" | dwell                                         | 0.7                                       |
| the window (expand)                            | trigger, clock 1.5 s                          | rest 0.6 after it                         |
| the orbit (pull)                               | trigger, clock 1.8 s                          | rest 1.0 after it (heading, line, button) |
| the exit: the set flies off, the overlay fades | zone (1.0 screens, ends at the section's end) | 1.0                                       |

The section is 3.75 screens (was 2.5). The bolt's lead (0.5) lies over the last half of the exit. Changes that follow from it:

- `stripS(v)` maps the first zone straight onto the words (`ENTER_WAITS` is gone): the rows' zone has already ended with the film upright, so nothing slides under the words. The film, the drone and the backdrop are asked at `max(S, STORY.strip.start)`, so a scroll that is still in the words' zone never shows the film angled again (before, the backdrop was the silk until the words were half in).
- `driveFilm`/`driveDrone` run from `v = 0` (the `v >= 1` guard is gone): the rows no longer carry the strip's first play.
- The strip no longer imports `ROWS_PLAY_SECONDS` (the rows can drop it).
- `STRIP_FOCUS_AT` and `STRIP_FOCUS_RANGE` follow the new rests.

Looked at (real Chrome, 1440 by 900, dev server, real wheel):

- Down through the strip, stopping inside the exit at p 0.456: `heading: forward`, then one move to the end (p 0.99 to 1.0), `blocked: outside` after. The window and orbit triggers fired and held on the way.
- Up through the exit with the wheel: `v` went 3.99 back to 3.0, the previews and words returned (scrubs both ways).
- Frame sheet by seek at 0.02, 0.2, 0.4, 0.9, 1.4, 2.5, 2.95, 3.25, 3.55, 3.74: words in by letters, small frame, window with the deck, orbit, the fly-off (words leave in the first third, previews fly), the bolt's green coming in.
- Hover on the small frame and on the window: the overlay and the button reactions are as above.

## 4. Numbers to tune

`dwell.ts`: `STRIP_ZONES` (0.45, 1.0), `STRIP_DWELL` (0.7, 0.6, 1.0). `index.ts`: the zone `seconds` (the snap length for a full traverse, 0.9 and 1.4). `journey.ts`: `overlayAmount` (0.4 softer on the window, gone at fly 0.75). `shader.ts` overlay block: scan 0.07, grain 0.07, sweep 0.11, vignette 0.32 plus 0.07 breathing, fringe 0.0065. `glsl-ink.ts`: `aBody` (0.08 + 0.26 body), ridge 0.3, the lean 0.07, the parallax 0.05 and 0.11. `deck.ts`: the timings are Vexana's. `deck.module.css`: `--cross` (`max(11px, 1em)`), the font size (a 80th of the window).

## 5. Not done, not verified, for the cleanup pass

- `PointerTrail` (`fx/backdrop/trail.ts`, its test, `uTrail` in `renderer.ts` and the stepping in `backdrop.ts`) is now unused by any kind and left in place (shared files). The strip no longer passes `extras` (`uX`); the `extras` plumbing in `params.ts` is unused too. A cleanup can delete both.
- `docs/design/home/fx-backdrop.md` and `round2-R-A3.md` still describe the halo, the ripples and the film glow.
- The backdrop's handover to the bolt is still the kernel's: the bolt's aurora takes the backdrop at the start of its lead (the last half of the exit) and the ink field cross-fades out over 0.5 s of the clock, not of the scroll. A scroll-linked handover needs the bolt's plan to ask for the ink first. At the exit's half way (seek) the ground was bare black before the aurora rose.
- A one frame white band along the top edge showed in the first frame of a wheel screenshot (the known one, not investigated).
- A warm soft glow just above the small film's top edge showed once in a hover frame (the pointer inside the film); I could not reproduce it with the backdrop hidden or on, so it was probably the film's own picture. Worth a second look.
- Touch (390 by 844): the deck, the bands and the readout were not looked at on a phone; the em is a 80th of the window's width, so the words and button are small there (as before). Firefox, Safari, a production build, the scroll zones with a real trackpad or touch, and the keyboard focus move to the play button (the range numbers are tested, not driven) were not looked at.
- Tests: the strip, backdrop and video-plane folders pass (213). `kernel/layout.test.ts` has one failure that is not mine (the voices' nav owner). No full run, no check, no e2e.
