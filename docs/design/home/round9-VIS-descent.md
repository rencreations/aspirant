# Round nine: VIS-descent, the descent filmed and the glitches fixed (20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-9-request.md` (the part about the descent: "make sure how fast users are scrolling, it will not look like glitches or suddenly turned"). The first pass of `round9-FIX-descent.md` judged by logged numbers only. This pass filmed it. Probes (outside the repo): `D:\ren\aspirant-work\home\VIS\` (`film.cjs`, `analyze.py`, `sheet.py`, `dances.cjs`, `dock.cjs`, `runall.sh`).

## How it was filmed

Real Chrome (the real GPU), `page.clock` installed after the page opened: every `requestAnimationFrame` of the page is one 60 Hz step of a fake clock, a real `mouse.wheel` is sent before each step, the pair, the doll and the guests are logged every frame (`film.cjs`) and a cropped screenshot is taken every 4 to 10 frames. This is deterministic (the same scroll gives the same frames), so a before and an after compare. Scrolls: slow (0.7 screens a second), medium (2.4), fast (7), very fast (flicks of 400 px a frame), three flicks of 1500 px, stops, a reverse, a quick reverse, a flick reverse, jumps by `scrollTo`, and a slow pass over the guests. 1440x900 and 390x844.

## Found

- The pair zipped: after a flick the drone's spring closed the gap at up to 3.9 percent of the screen's height a frame (2.2 in a medium scroll, 1.6 even in a slow one: the route itself).
- The guests were scrubbed by the scroll through a limited follower with two guards that forced them out. In a medium scroll they came late (at S 15.5, when the pair were nearly at the dock) and were forced out at 5 to 7 percent a frame, with the greeting wave long over.
- The guests stood beside the route's own place, which a flick moves by several screens in a frame.
- Everything else looked clean in the sheets: the seat turns with the helmet through a twirl and a spin, the doll never leaves the helmet; no gimbal flip, no wrong way spin.

## Fixed

- **A speed and acceleration cap for the pair's flight** (`actors/drone/follow.ts` `capPlace`, `SpeedCap`; `actor.ts` `speedCap`, `CARRY_SPEED` 0.9 screen heights a second, `CARRY_ACCEL` 12). A step the limits do not touch is the spring's exact step, so a calm flight is unchanged. The pair sets it with `capFlight(true)` (`pair.ts`) in the descent and in the list's dock; the Selena section lifts it (`selena/scene.ts`) for its own exit flight. `reset()` clears it.
- **The guests are a timed visit** (`sections/descent/guests.ts`, pure and tested, `runtime.ts`): the scroll only says whether they are wanted (20 to 60 percent of the descent). The flight in and out is a limited follower (`GUEST_FLY` 2.5 s for the whole way, eased, reversible half way), they bow for `GUEST_BOW` 1.6 s, then dance on the pair's beat from the beat they began on, the dance ends before they fly out, and they are never snapped. They first appear all the way off the screen. They stand beside the pair as it is drawn, not beside the route's place. A visitor who flicks past the start sees them start to come and go back.
- **The greeting is tied to their arrival** (`pair.greet(w, t)`: the `wave` routine cross-faded over the show by the visit's own weight), not to the beat of the show that lags a quick scroll.

## Measured after (per 60 Hz frame, 1440x900, percent of the screen's height or radians)

| scroll                                     | pair place         | seat turn | doll place | guests (visible flights)    |
| ------------------------------------------ | ------------------ | --------- | ---------- | --------------------------- |
| slow, medium, fast, very fast, flick, jump | 1.44 (was 1.6-3.9) | 0.04 max  | 1.5 to 1.7 | 1.4 to 1.7 (was 4.5 to 7.3) |
| 390x844 medium, flick                      | 0.96, 1.44         | 0.02 max  | 0.96, 1.45 | 0.5, 1.7                    |

The 4 percent in the very fast scroll is the guests' log while they are above the top edge, off the screen (they start to come, are no longer wanted and go back). Dances in the lab (13 routines, 10 s each at 60 Hz): the seat turns by at most 0.023 rad a frame in every routine but the twirl (0.117 at its fastest, about 7 rad a second, a whole turn in 0.8 s, the designed move, smooth in the sheet).

## The seat

Zoomed at 3x at the list's dock (two moments) and in the Selena section's dock (two moments): her bottom rests on the dome, her legs go over its front edge, no gap, nothing sunk. Through a twirl and a spin she turns with the helmet and stays on it.

## Not done, not verified

- A scrollbar drag that leaps more than 1.2 screens in a frame still puts the pair on its place at once (the drone's own jump rule). Not changed.
- The 390x844 runs used a wheel, not a finger. A real touch fling was not filmed.
- Each of the twelve routines was measured, not every one read as a sheet: the sheets read were twirl, spin and wave. The pair's drone tricks on a press (the rock, the spin) were not filmed again.
- With the cap, a very fast scroll leaves the pair behind the route for up to a second or two, and they arrive at the dock after the scroll has stopped (smoothly). Tune `CARRY_SPEED` for a quicker pair.
- Only `guests.test.ts` was run (8 tests) and `tsc --noEmit -p apps/web` filtered to the changed folders. The old buddies and drone tests were not run (the owner's rule); `stepFollower` has a new optional last argument.
