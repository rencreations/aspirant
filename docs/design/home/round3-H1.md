# Home round three: H1 (the hero)

The owner's words are in `docs/superpowers/specs/2026-11-20-home-feedback-3-request.md` ("Hero"). Code: `sections/hero/`, `fx/image-field/flight.ts` (new), a few lines in `fx/image-field/actor.ts`, `sections/backdrops.ts`, `components/nav/nav.module.css`.

## 1. What changed

| Owner's word                                  | What was done                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| remove the gradient, plain white or off white | The hero sets no backdrop. `backdropAt(S)` returns `null` before `BACKDROP_AT.silk` (3.3 story screens), the soft aurora is gone. The ground is the daybreak `#f4f6f9` with its dot grid. Looked at in the real flow (intro, tap, open) at 1440 and 390: no colour on the ground. |
| the cards fly in like paper, each its own     | `fx/image-field/flight.ts`: a pure flight per card (section 2). `FieldActor.fly(to, seconds)` is the one call. The hero scene uses it in place of the old blend.                                                                                                                  |
| longer, slower, smoother first appear         | Entrance 0.7 s to 2.8 s. The scroll cue comes last: 1.4 s, begins at 2.4 s, softer ease (`hero.module.css`). Its hairline starts at 3.4 s, 3.2 s cycle. The bar's menu and sound button fade in over 1.2 s after 0.4 s (`nav.module.css`, `.left` and `.here`).                   |
| the scene is scroll based, with the idle snap | The hero is one scroll zone (section 3).                                                                                                                                                                                                                                          |

## 2. The paper flight (`flight.ts`)

A pure function of (seconds since the start, card index, rank by distance from the middle). No state, no allocation per frame (`hash01(i, k)` is an integer hash).

- **Start and duration.** `delay` is `0.9 * rank^0.9` plus a jitter of 0.04 s, nearest the logo first. `duration` is 1.4 s up to `min(2.6, 2.8 - delay)`, by hash: every card is down by `FLIGHT.total` (2.8 s), the late ones have the shorter flights.
- **Path.** A cubic bezier from the heap behind the logo to the target pose, its two control points off the chord by signed shares (0.05 to 0.3 of the chord): an S bend, never a line. The path is walked by a back ease (overshoot constant 0.9 to 1.5: 3 to 8 percent), so it launches fast (about four times the average speed), passes the mark at about half the time, overshoots a hair and lands with no speed.
- **Flutter.** A sine across the chord, amplitude `(0.035 to 0.085) * chord + 6 px`, 1.2 to 2.5 cycles, its own phase, strength `settle(s)` (zero at both ends, no slope).
- **Tumble.** Roll (0.35 to 0.85 rad), yaw (0.45 to 1.1 rad) and tilt (0.3 to 0.8 rad), each with its own sign, cycles (0.6 to 1.6) and phase, multiplied by `settle(s)`, on top of the turn from flat to the card's own tilt.
- **Size and lift.** Grows from the heap by an ease out reaching full size at 45 to 75 percent of the flight. Lifted 40 to 130 px toward the camera by `sin^2(pi * e)`, so the card is nearest while it is fast. The picture fades in over the first 22 percent. `live` (the idle float and the pointer) ramps in from 40 percent, so the idle float after landing is exactly what it was.
- **End.** At the landing second the pose is the target's, every field, by an early return. The wall-only cells are never moved.

Tests (`flight.test.ts`, 19): deterministic, durations differ and sit in 1.4 to 2.6 with every card down by 2.8 s, nearest first over about 0.9 s, the ease (launch, overshoot between 2 and 9 percent, no speed at the end), start equals the heap and end equals the scatter in every field at three screen sizes, a speed under a tenth of the average in the last 10 ms, a curved path for every card, a tumble and a lift, growth only, a different roll for every card.

## 3. The scroll zone (`sections/hero/index.ts`)

One zone, `v` 0 (scatter, stiff logo) to 1 (the wall), `heroS` and every beat of `timeline.ts` unchanged. Layout: `HERO_REST` 0.1 screen on the scatter, `HERO_ZONE` 2.8 screens, `HERO_DWELL` 0.2 on the wall, `HERO_SCREENS` 3.1. Linear. The idle snap for a full traverse is `HERO_SNAP_SECONDS` 2.4 s. Tail 0.4, `restOutside`, `carry` as before.

Looked at with a real wheel (1440x900, dev server): a stop at 0.59 screens (p 0.155) went back to the scatter (0.1, v 0); a stop at 1.39 (p 0.44) was carried on to the wall (2.9, v 1) in about 1.5 s; wheeling up from the wall and stopping at p 0.59 went back to the scatter (the kernel's up rule: back when p is 0.75 or less). No console errors. Frames at 0.5, 0.9, 1.3, 1.7 screens show the logo morph, the ring and the land.

## 4. Edits to shared files

- `fx/image-field/actor.ts`: the `fly` spec (type, `fly()`, one case each in `evalBase`, `lensOfSpec`, `edgesOfSpec`, the rank on resize) and an import. `fx/image-field/index.ts`: `FLIGHT` export.
- `sections/backdrops.ts`: `backdropAt` returns `BackdropSpec | null` (null for the hero), `SOFT` removed, `BACKDROP_KINDS_USED` is silk and ink. Its test was rewritten for that. The three other callers got a null guard first (`aspirants/runtime.ts`, `rows/runtime.ts`, `strip/runtime.ts`, one line each).
- `sections/pair.test.ts`: the hero and aspirants pair is removed (the hero is a zone now, the words are a trigger).
- `components/nav/nav.module.css`: the fade in of `.left` and `.here`.

## 5. Not done, not verified, for the others

- **The aspirants (helper H2).** Its first play is still the round two clock play of `HERO_PLAY_SECONDS` (2.8 s) that fires at its start, which is now the end of the hero's dwell (scroll 3.1). It drives the words with `aspirantsS`, so the words begin only in the last fifth of that clock (about 2.3 s of waiting with the scroll held). It has to map its trigger to the words alone. `HERO_SCREENS` still sets its `lead`. `HERO_PLAY_SECONDS` stays exported only so that file compiles.
- **Dead scroll at the end of the zone.** `STORY.hero.length` is 4.5 and the story's `p` reaches 1 at S 4.2, so the last 0.19 screen of the zone only starts the glide. Mapping the zone to 4.2 would change `aspirantsS` too: not done.
- **A visit by the logo curtain.** The sections step as soon as the page is `open`. After the intro that is right (checked). When the home is reached through the curtain (arrival "site") or with `aspirants:intro` off, the entrance clock starts behind the loading screen and can be over before it lifts. The probes that need the entrance must use the real flow (`R-A1/cast.cjs`). A fix needs a "revealed" signal the home does not have.
- `kernel/snap-registry.test.ts` and other kernel tests that read the real registry were not run (the process rule); the hero's longer length and the zone may change their numbers.
- Not looked at: the production build, a weak GPU (the flight is transform maths only, but the 18 flying cards also carry the field's speed blur), touch scrubbing of the zone, Firefox and Safari, a screen taller than wide beyond 390x844, the first-frame texture upload hitch.

## 6. Numbers to tune

`flight.ts`: `FLIGHT` (total, stagger, min and max duration), the ranges in `flightOf`, `settle`. `hero/index.ts`: `HERO_REST`, `HERO_ZONE`, `HERO_DWELL`, `HERO_SNAP_SECONDS`. `hero.module.css`: the cue's `1400ms 2.4s` and the hairline's `3.4s`. `nav.module.css`: `1200ms ... 400ms`.

## 7. How to look

`D:\ren\aspirant-work\home\H1\`: `lib.cjs` (opens the page with the intro off and waits for the loading curtain to go), `wheel.cjs` (real wheel through the zone, stops, snaps, shots), `probe-state.cjs`, `entrance.cjs` (screencast from `open`, intro off: it films the curtain, not the page), `pick2.py` (a contact sheet from a screencast). The entrance is filmed with `D:\ren\aspirant-work\home\R-A1\cast.cjs` (the tap gate, `BASE`, `OUT`, `SIZE`, `SECS`).
