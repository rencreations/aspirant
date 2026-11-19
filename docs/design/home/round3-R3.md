# Home round three, range R3: chase, bend, archive, footer

The owner's third feedback (`docs/superpowers/specs/2026-11-20-home-feedback-3-request.md`): scenes are scroll based again, with an idle snap. Kernel API: `kernel-scrub.md` (a play with a `span` is a zone). The beats, the compositions and the backdrops of round two stand; only how they are driven changed. No clock play remains in this range.

## What changed

| section | before (round two)                         | now                                                                                                 | length (screens) |
| ------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------- |
| chase   | 2 clock plays (2.4 s, 2.0 s) with a hold   | 2 zones (run 1.1, comic 1.0), rest 0.25 between, dwell 0.9 with the comic's buttons                 | 2.4 to 4.1       |
| bend    | 3 clock plays                              | 10 zones of 0.5 to 0.9, short rests (0.05 to 0.1), two long rests (1.0) with the words              | 2.0 to 10.3      |
| archive | an entry play, then the tour on the scroll | scroll linked from end to end: the entry is one zone of 1 screen, the tour and the exit stay linked | 2.3 to 3.0       |
| footer  | unchanged                                  | unchanged (the exit to About checked both ways)                                                     | 1.2              |

### Chase (`chase/index.ts`, `CHASE_ZONES`)

`local` is still the story's clock `T` of `timeline.ts`. Zone 1: screens 0.85 to 1.95, `local` 0 to 0.46 (the doll, Silverbolt and Tetra run, she stops panting). Zone 2: 2.2 to 3.2, 0.46 to 0.9 (wave, sit, the camera in, the words). Dwell to 4.1 (the comic and its two buttons; the words leave with the scroll over 0.3 screen after the end, `wordsLeave`). Zone 1 starts after the funny section's tail (0.8) as before, so no words ride under the doll. Linear, snap 0.9 s.

### Bend (`bend/plays.ts`, `bend/beats.ts`)

Each element stance is its own zone and ends on a rest where the stance is formed: pose worn in full, the element's backdrop whole, every picture of its wave landed. For that the beat table `T` was retimed (a wave was 0.4 beat and a flight 0.5, so a rest in the middle of a wave showed pictures in the air): `wave` 0.9, `bendFrom` 0.6, `moveTo` 0.5, and everything after the four stances moved by +1.95 beats (`holdFrom` 4.21, `holdTo` 4.7, `restArt` 7.3, `goTo` 9.45 = `BEAT_SPAN`). `REST_BEFORE_EDGE` 0.08 beat is where a stance's rest stands before the next stance begins (past the dip to the stand).

| zone | beats (rest to rest) | screens (at, length) | what the visitor sees at the end                                       |
| ---- | -------------------- | -------------------- | ---------------------------------------------------------------------- |
| 1    | 0 to 0.52            | 0.55, 0.5            | the book is shut, she stands in the middle (comic halftone)            |
| 2    | 0.52 to 1.42         | 1.1, 0.7             | earth formed (boulders, dust), wave 1 landed                           |
| 3    | 1.42 to 2.32         | 1.9, 0.7             | air formed (wind), wave 2 landed                                       |
| 4    | 2.32 to 3.22         | 2.7, 0.7             | water formed, wave 3 landed                                            |
| 5    | 3.22 to 4.12         | 3.5, 0.7             | fire formed, wave 4 landed (the wall is whole)                         |
| 6    | 4.12 to 4.7          | 4.3, 0.5             | she stands down, "Fan art", "See all fanart" (long rest: 1.0)          |
| 7    | 4.7 to 5.92          | 5.8, 0.8             | the wall is a ring around her, turning                                 |
| 8    | 5.92 to 7.3          | 6.7, 0.9             | the ring is thrown away, the spiral stands, "Artwork" (long rest: 1.0) |
| 9    | 7.3 to 8.65          | 8.6, 0.9             | the spiral turned to the drone's paper, the drone is out               |
| 10   | 8.65 to 9.45         | 9.6, 0.7             | the meeting, pat, hug, they go to the lower left (J14)                 |

The section is 10.3 screens, lead 0.5, tail 0.3. The first zone starts after the joint with the chase (0.5 into the section) and the last zone ends with the section. The element backdrops cross in 0.3 s (`ELEMENT_FADE`, was 0.2). `restScreens(1|2|3)` still says where a keyboard focus on the wall's or the spiral's controls puts the page (the middle of the long rest): checked with a real focus from far (the page went to 5.3 and 8.1 screens, `v` at the wall and the spiral rest). The 32 tab stops were already one (`roving.ts`, R-F).

### Archive (`archive/plays.ts`, `route.ts`)

The route is a function of the scene's scroll `S` again (`routeS` is gone). The entry's beats are the old ones stretched over one screen (`entryAt(u)`, `STRETCH` for the widths that stay in screens): rest 0.1, entry 0.1 to 1.1, tour 1.1 to 2.3 (a list: no snap), exit 2.3 to 3.0. The entry is a zone only so that the page snaps to either end of it (`ARCHIVE_PLAYS`, one zone, value unused by the runtime). `backdropAt` now takes `AT.entry`, so the bend's particles stand until the entry begins.

### Footer

Untouched. Checked with a real wheel and the "Continue to About" button and the N key: `/about/` opens, About's phases run, the Back button returns to the home with the drone and the footer card in place, no console error.

## Looked at (dev server, real Chrome, 1440x900 and 390x844)

Frame sheets by seek in `D:\ren\aspirant-work\home\R3\out\`: chase at both rests and mid-zone; bend at all ten rests and mid zone for the air stance, the ring to spiral and the drone; archive across the entry and the exit; the bend's stance and wall rests at 390x844. A real wheel stopped inside a zone (`snap.cjs`): down at 63 percent finished forward in 0.3 s to the zone's end, up at 52 percent went back to the zone's start; `v` was the rest value after each. Focus from far on the chase, the wall and the spiral. All rests read as composed.

## Not verified

- The production build and a real phone (touch drag through a zone, a fling). The 390x844 runs are desktop Chrome frame sheets only.
- The snap feel on a fast machine: the dev server was heavily loaded (frames of 100 ms and stalls of seconds), so the timings above are not the real ones.
- A hard flick through several zones; the kernel's flick limiter caps it at two screens of chase.
- The chase on a phone as played (rest frames unchanged from round two, not re-shot).
- Credits answer (`live`) over the posters from the fire rest to 0.5 beat into the ring; at the ring's rest they do not (round two had the same window shape).
- Fan pictures after a cold seek show as plain colour cards for a few seconds (the colour-first cards): seen at the ring rest after a seek from the top.

## Numbers to tune

`chase/index.ts` `CHASE_ZONES`, `CHASE_SCREENS`, snap seconds; `bend/plays.ts` `ZONE_SCREENS`, `BEND_SCREENS`, `SNAP_SECONDS`; `bend/beats.ts` `T.wave`, `REST_BEFORE_EDGE`; `bend/backdrop.ts` `ELEMENT_FADE`; `archive/plays.ts` `ENTRY_AT`, `ENTRY_SCREENS`, `EXIT_SCREENS`, `ARCHIVE_SCREENS`. If the bend is too long, shorten the stance zones to 0.6 (the pace stays under 1.5 beats a screen); the long rests are 1.0.

## Tests

Rewritten for zones: `chase/plays.test.ts`, `bend/plays.test.ts`, `bend/backdrop.test.ts` (two cases), `archive/route.test.ts` (the route's clock block became "the entry"). `npx vitest run` of the four section folders: 186 passed. `kernel/where.test.ts` and `kernel/snap-registry.test.ts` pass with the new lengths. `layout.test.ts` has one failure in the Selena to voices joint (not this range). `tsc --noEmit` is clean for the four folders.
