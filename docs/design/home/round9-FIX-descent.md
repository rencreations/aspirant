# Round nine: FIX-descent, the pair without glitches, the doll sitting, the two Guinevere drones (20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-9-request.md`. Code: `sections/descent/`, `actors/buddies/`, small edits in `actors/drone/` and `actors/duo/`. Probes (outside the repo): `D:\ren\aspirant-work\home\FIX-descent\` (`rec.cjs` a per frame log over ten scripted scrolls, `analyze.py`, `detail.py`, `gap2.cjs` the doll's gap, `seat.cjs` attitudes, `guests.cjs` the guests at a row of progress values).

## 1. Glitches and sudden turns

Measured first (real wheel, real Chrome, 1440x900, the angle between two frames of the seat's quaternion, per 60 Hz frame). Before: 0.6 rad in a slow wheel, 1.6 to 3.1 rad in a medium wheel, a flick, a reverse (the dance's spin and twirl following the scroll at the frame rate: the beat ran at 20 to 30 beats a second, the yaw turned by radians in a frame, a spin also wrapped by 2 pi). After: at most 0.08 rad in every case, including the scrollbar style jumps.

Causes and fixes, at the source:

- **The beat followed the scroll step by step** (`runtime.ts`). It now goes through a critically damped follower with a speed limit (`BEAT_MAX` 4.5 beats a second, `BEAT_TIME` 0.3 s, `actors/buddies/smooth.ts`, tested). A jump of more than 1.2 screens in a frame (a seek) snaps it. The energy follows the beat's own speed. Result: a quick scroll plays the show faster up to 2.7 times its tempo and no more, and after a long flick the dance goes on at that limit until it reaches the scroll's place.
- **The spin was added with no spring** (`pair.ts`). It is now one continuous angle that follows its cue by the short way (`dampAngle`, `SPIN_MAX` 8 rad a second): a wrap of the angle, a finished spin and a routine change can never turn the pair by more than that.
- **The flight turned a drone with a rider far** (`drone/follow.ts`, `actor.ts`): the nose first yaw, pitch and roll are scaled by `CARRY_LIMIT` 0.5 while the drone carries her (eased, never snapped).
- `wrapPi` of `choreo.ts` now lives in `smooth.ts` (one copy).

Not changed: the pair's place still follows the scroll through the drone's springs, so a flick makes the pair zip to its new place (up to 5 percent of the screen height in one frame after a 4 screens a second flick). It is a flight, nose first and smooth, not a turn.

## 2. The doll sat in the air

Measured in the seat's frame with `gap2.cjs` (the lowest vertices of her pelvis over the helmet's triangles under them, drone heights): the gap was 0.051 at `SEAT_OFFSET` y 0.24 (15 px at a 300 px drone). Now y is 0.09: the gap is 0 to 0.014 at rest, roll 0.4, pitch -0.3 and 0.5 (at most 4 px at 300 px, 2 px at the descent's size). Looked at on thirteen attitudes (`shots/seatB-sheet.png`, `seatAB-zoom.png`): her bottom rests on the dome, her legs go over its front edge, nothing sunk. The same pair is the list's dock and Selena's dock, so they sit the same way (not looked at separately).

## 3. The two Guinevere drones

`sections/descent/guests.ts` (pure, tested) is the schedule by `p`, the descent's progress:

| p            | what                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.20 to 0.30 | they fly in from the left and the right edge (the duo's `leave` pose played back) and stand beside the pair, 2 drone heights away, a ball 0.62 of its height             |
| 0.30 to 0.37 | a bow; the pair look at them (the show's `wave` is at beats 40 to 48, the scroll's p 0.31 to 0.39: `SHOW` in `choreo.ts` now has the spiral before the wave)             |
| 0.37 to 0.62 | they dance on the pair's beat (the duo's clock is the beat times 0.5 s, `DuoActor.poseClock`; the third phrase, a fist bump behind the pair, is skipped by `danceClock`) |
| 0.62 to 0.66 | they float                                                                                                                                                               |
| 0.66 to 0.84 | they fly out to the edges (`leave`), drawn until 0.86                                                                                                                    |

The progress goes through a limited follower (`GUEST_MAX` 0.2 of the descent a second), pulled on before the pair dock and held back before the start so a lag never strands them on the screen (`forcedHigh`, `forcedLow`, continuous). They are drawn in the duo's pass under the pair's, so they are behind the doll and never cover her. `DuoActor.locked` turns their pointer targets off, `poseClock` and `locked` and the ambient life are given back when the descent leaves. The duo's chunk and model are in the descent's loading list, deferred (`preload.ts`), and are built in a pause after the pair (3.5 s).

## Looked at

- `shots/g1-sheet.png`: the guests at p 0.22 to 0.84 (a seek and 1.5 s of settling): entering at the top corners, flanking the pair, dancing (the pair never covered), leaving. Not looked at as motion.
- `rec.cjs` logs of ten scrolls (slow, medium, flick, very fast flick, scrollbar jump, jump back, up, stops, reverse, flick and reverse) before and after (`before-rec.json`, `after*-rec.json`).
- Tests: `smooth.test.ts` (7), `guests.test.ts` (7), the buddies tests (47 in all with the existing ones). `tsc --noEmit -p apps/web` clean for the changed folders.

## Not done, not verified

- No frame by frame sheets of each of the twelve routines and each drone trick (only the numbers of the logs and the attitude sheets). The dance routines were not retimed.
- The guests' flight in and out reaches 3 to 8 percent of the screen height a frame in the log (an edge to edge flight, and the frame where they first appear is a snap to their off screen place). Not looked at for a pop.
- 390x844 and touch were not run. The dock's seat was not looked at again in the list and in Selena's section.
- The guests are scroll linked and the pair's dance lags a fast scroll by the limit, so after a flick the greeting wave can come after the guests have gone.
