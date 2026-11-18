# Plays: triggered scenes with a scroll lock (K5, round two)

The owner's feedback of 19 Nov: scenes must be trigger based, not scroll based. When the visitor reaches a scroll threshold the scene plays by itself on a clock, the scroll is locked until it ends, and scrolling back up across the threshold plays it backwards. Code: `kernel/plays.ts` (pure), wired in `kernel/run.ts`, `kernel/engine.ts`, `kernel/hold.ts`, `kernel/probes.ts`. Lengths: `kernel/where.ts`.

## 1. The idea in one paragraph

`update(local, frame)` stays a pure function of one number. A section with `plays` gets a virtual `local` (call it `v`) in place of the scroll's. `v` rests on a station. When the real scroll crosses a threshold `v` runs to the next station on the clock (the page is held while it runs) and rests there. The scroll between thresholds changes nothing: it is a dwell. Everything outside the section (its lead and tail) stays scroll linked, so joints with neighbours that are not on plays stay continuous.

## 2. The API

```ts
// in a section's index.ts (kernel/types.ts: HomeSection.plays)
plays: [
  { at: 0.12, from: 0, to: 0.5, seconds: 1.6, ease: "inOut" },
  { at: 0.55, from: 0.5, to: 1, seconds: 1.4, ease: "out", back: 0.6 },
],
```

| field     | meaning                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| `at`      | where the play fires: a fraction 0 to 1 of the section's own range (`local` units). Crossing it going down fires it. |
| `from`    | the value of `local` before the play. The first play's `from` is the value `update` gets at the section's start.     |
| `to`      | the value after. The last play's `to` is the value at the section's end. It may be above 1 (see section 4).          |
| `seconds` | the forward length. At most `MAX_PLAY_SECONDS` (10).                                                                 |
| `ease`    | `inOut` (cubic, default), `out` (cubic), `inOutSoft` (sine), `linear`.                                               |
| `back`    | the share of `seconds` the backward run takes. Default `PLAY_BACK` = 0.7.                                            |

The table is checked when the registry is laid out (`layoutSections`, so at startup and in every test that imports the registry), with errors like `section hero: plays[1] from 0.6 must equal the previous play's to 0.5 (the list is contiguous)`. Rules: not empty, `at` in 0..1 and strictly increasing, `from[i+1] === to[i]`, `from !== to`, `0 < seconds <= 10`, `0 < back <= 2`.

Exports of `kernel/plays.ts`: `HomePlay`, `PlayEase`, `PlayMachine`, `validatePlays`, `easeValue`, `hystOf`, `passthrough`, `restingIndexAt`, `restingValueOf`, `playLimitMs`, and the constants `PLAY_BACK`, `HOLD_SLACK_MS`, `MAX_PLAY_SECONDS`.

## 3. The semantics, in plain words

- **Rest.** `v` is piecewise constant over the section: `plays[0].from` before the first threshold, `plays[i].to` after play `i` has fired. Passthrough outside: for `s < 0` (the lead) `v = rest + s`, for `s > 1` (the tail) `v = rest + (s - 1)`, where `s` is the section's `local` from the smoothed scene scroll. So `update(0)` of this section still equals `update(1)` of the one before, and a tail or lead keeps animating with the scroll.
- **Fire.** Going down: when the real scroll (`frame.raw`, not the smoothed `S`) reaches `at`, play `i` starts. The lock lands on the visitor's own position, not 0.2 screens late. Going up: play `i` runs backward when the real scroll is below `at - hyst`. `hyst = max(0.04, 0.12 / screens)` in `local` units (0.04 of the section or 0.12 screens), and never more than half the way from `at` down to the lowest reachable scroll, so the first play of the hero can be played back at the very top. A wobble inside the band does nothing.
- **Run.** `v` moves from `from` to `to` on the curve over `seconds` (backward: from `to` back to `from`, the same curve toward the target, in `seconds * (back ?? 0.7)`). `dt` is the frame's `dt` (at most 0.05 s), so the length does not depend on the frame rate. The time left over at the end of a play goes into the next one.
- **Hold.** While a play runs the engine holds the scroll: wheel, touch and scroll keys do nothing and the smooth scroller is paused (`kernel/hold.ts`, the site's lock). It is let go when the play ends. `window.__home` and `data-home-playing` say so (section 6).
- **Chain.** When a play ends the machine reads the scroll again. If momentum, a key (a Page Down is 0.875 screens in one frame) or a hard flick carried the page past the next threshold, the next play starts at once, with no frame where the hold is let go. Several thresholds in one flick play in a row, each locked.
- **Never reversed.** A play that runs is never reversed by scrolling (the scroll is held anyway). If the hold failed and the visitor went back, the machine finishes the play and then plays back.
- **Jump.** A scrollbar drag, Back, a probe `seek`, the first frame, the opening ending, a runtime that was still mounting when the page arrived: `v` goes to the resting value for the position (`count of at <= scroll`), no animation, no hold. `seek` puts every section at rest.
- **Script moves.** A smooth `ctx.scroll.to(...)` on its way, an immediate one, and a control that took the keyboard focus (the shell moves the page and calls `requestSnap()`) are not scrolls the visitor made. While they last the plays rest on the position (the runner's `snap`), so a play on the way cannot hold and cut the move short. A smooth move ends when the page is within 0.02 screens of its target, after 5 s, or when the visitor touches the wheel, the screen or a key.
- **Enter.** A scroll that runs into the section from above starts with nothing fired and lets the crossing fire (even when the scene still lags the page by 0.2 screens). From below it starts with everything fired.
- **Leave.** A section that stops running (range left by a jump, a failed runtime) ends its play where it was going and lets go of the hold. A section that is passed is replayed once after a jump at `update(plays.last.to)` (what the last play ends on), not at 1.
- **Safety.** The hold of a play is `seconds * 1000 + 1500` ms of wall time (`HOLD_SLACK_MS`); the machine gives up its own lock at that limit (snaps to the target, lets go), and the site's lock has its own timer 0.5 s past that. A frozen scene (`__home.freeze(true)`), a hidden tab or a very slow machine therefore never leaves a visitor standing in a scene.
- **Holds are counted** (`kernel/hold.ts`). The site's lock is one lock whose second `lock()` returns the same release; the home's `holdScroll` takes it when the first hold starts, gives it back when the last ends, and gives each hold its own idempotent release and timer. The aspirants' preview, the list's viewer and the music scene hold through the same function, so a play ending cannot free them and they cannot free a play.

## 4. Shared scenes (hero and aspirants, rows and strip, bolt and fall, hand and list)

Two sections of a pair run in the overlap of the first's tail and the second's lead, draw the same actors, and the later one wins. Each has its own machine. If only one section of a pair is on plays the joint breaks. Rules:

1. Carry a play across the joint on **one** section: let the earlier section's last play end beyond 1 (`to: 1.4`, taking over what its tail did) and keep the later section's lead consistent with it (its `first.from` is what its `update` needs at its own start; its lead is `first.from + s`).
2. Keep the earlier section's last threshold well before its end (`at <= 1 - dwell / screens`), so its play has ended before the next section's lead starts. A threshold inside the overlap would hold the page while the next section is already on screen.
3. A pair that shares one clock in screens (`BoltScene.update(boltScreens + local * fallScreens)`, the hand's carry at `handScreens() + s`) reads both lengths from the registry (section 7); a play of one section changes only the number that section passes on.
4. A section whose `update` reads `frame.S`, `frame.raw` or `frame.velocity` for its beats still gets the scroll's. Derive the beat clock from `local` instead: `sectionStart(id) + local * sectionScreens(id)`.

## 5. Choosing thresholds and lengths

- A dwell of 0.4 to 1 screen between two plays: the visitor stands in the composed rest frame and has time to read it. More is a dead scroll (a defect), less feels like the scroll is fighting the scene.
- The first threshold a little after the start (`at` 0.05 to 0.15, in screens about 0.3 to 0.5 after the start): the visitor sees the section arrive, then the scene goes. `at: 0` fires as the section begins, before the visitor has seen it arrive: avoid it.
- Shorten `screens` to what the dwells need. A section of two plays needs about `lead-in + dwell + dwell + tail`; the registry's lengths are in each `index.ts` and everything else follows (section 7).
- Lengths of plays: 1.2 to 2.5 s for one beat, up to about 3 s for the whole fall. The owner's word was "too long". A backward run at 0.7 is the default; a scene that reads badly in reverse can say `back: 0.5`.
- Every rest state is a frame the visitor stands in: compose it.
- Keep scroll linked what is driven by the visitor (a list read by scrolling, a carousel, parallax): leave those sections without `plays`, or put the threshold plays around them with `to`/`from` that the scroll-linked part does not use.

## 6. How a section's DOM and the page read the state

- `[data-home]` carries `data-home-playing="<section id>"` while a play runs and nothing otherwise. It is written only when it changes, on the home's own root (never `html` or `body`). CSS: `[data-home][data-home-playing] .cue { opacity: 0 }`. A section that must know its own play reads `window.__home.plays()` in tests, or keeps its own `v` from `update`.
- `window.__home.plays()` returns `[{ id, v, resting, active, fired, length, direction, progress }]` for every section that has plays. `state().sections[i].v` is the number `update` gets (the scroll's `local` for a section without plays), and `state().playing` is the section whose play runs.
- The hold shows as the `lenis-stopped` class on `html` (the site's lock), also visible in the probes.
- The page always opens at the top on a reload (`useFreshStart`), so a reload part way through a play starts at rest with no hold (looked at).
- Tests and probes: plays run and hold also with `aspirants:intro = off`. Wait with `await page.waitForFunction(() => !window.__home.plays().some((p) => p.active))` after a wheel that crosses a threshold. `seek` is for frame sheets: it puts every section at rest for the position.

## 7. Lengths are safe to change (`kernel/where.ts`)

```ts
import {
  sectionStart,
  sectionScreens,
  sectionEnd,
  sectionFrom,
  homeLayout,
} from "../../kernel/where";
```

`index.ts` of a section is the one place its length is written (`screens: 2.4`). Everything that needs an absolute position or a length asks `where.ts`, which lays out the real registry once: `sectionStart(id)` (where `local` is 0), `sectionScreens(id)`, `sectionEnd(id)`, `sectionFrom(id)` (start less the lead), `homeLayout()`. Two rules (a test enforces the second): call it inside functions or in modules the lazy runtimes load, and **no module that a section's `index.ts` or `preload.ts` imports may import `where.ts`** (the registry imports them, `where.ts` imports the registry: a cycle that fails with a TDZ error). `kernel/where.test.ts` walks the static imports of every `index.ts`, `preload.ts` and `sections.ts` and fails with the file name.

What changed (the pins removed, with identical values today):

- `index.ts` of rows, strip, hand, list, selena, music no longer import their length from a timeline (they carry the literal); `HERO_SCREENS`, `ASPIRANTS_START`, `ASPIRANTS_SCREENS`, `ROWS_START`, `ROWS_SCREENS`, `STRIP_START`, `STRIP_SCREENS`, `BOLT_SCREENS`, `FALL_SCREENS`, `HAND_SCREENS`, `LIST_SCREENS`, `SELENA_SCREENS`, the music, funny and chase `SCREENS` and `BEND_SCREENS` are gone. Accessors in their place: `handScreens()`, `listScreens()` (`hand/timeline.ts`), `selenaScreens()`, `musicScreens()` (`music/choreo.ts`), `funnyScreens()`, `bendScreens()`; the others call `sectionScreens("<id>")` directly. `BEAT.end` and `BEAT.at75` of `bolt/journey.ts` are getters.
- `sections/archive/route.ts`: `AT` is a table of getters (offsets from the archive's start, the footer's start and the page's end), so the drone's tour and the footer's card move with the sections.
- `drone-route.ts`: the stops are `[section, share of its length, x, y, height]`, placed on the scroll the first time the route is asked; `ROUTE_END` became `routeEnd()`.
- Tests that pinned a joint by comparing numbers of two folders compare registry values now (`kernel/layout.test.ts`: starts are the cumulative sum of the lengths, no absolute numbers). `e2e/home.spec.ts` seeks the aspirants by `placed(page)`. Probes `home-s2.cjs`, `home-s7a.cjs` and `home-s7b.cjs` read the starts from `__home.sections()`.
- What a test still pins on purpose: a section's own beats against its own length (`B.morph[1] === ROWS_SCREENS`). Those tests fail when a helper changes a length, and the helper retunes the beats: that is the intended signal.

**Mutation check** (done): change one `screens` (rows 2.4 to 2.0; then aspirants 1.6 to 1.2, bolt 4 to 3.5, hand 3.4 to 3.0, archive 3 to 2.5, bend 9 to 7) and run `npx vitest run src/features/home`. Every failure was a test about that section's own beats or joints (`rows/journey.test.ts`, `archive/route.test.ts` "are in order", `bend/*`, `bolt/journey.test.ts`, `hand/timeline.test.ts`); none came from a number pinned in another folder. Do the same after you change a length: a failure outside your section's beats is a pin that was missed.

## 8. How to test a section with plays

- Pure arithmetic: `kernel/plays.test.ts` shows the harness (`rig`: a `PlayMachine`, a wall clock, `run(seconds, fps)`). Test the stations: `update(plays[i].to)` is the rest frame, and `update(from)` equals the previous station.
- The runner: `kernel/run-plays.test.ts` (`setup`, `tick(S, { raw, jumped, snap })`, `runner.holdState()`, `runner.plays()`).
- On the page: add the table, open `http://localhost:3100/`, wheel with the real wheel (`page.mouse.wheel(0, 100)` every 30 ms), sample `__home.plays()` in a requestAnimationFrame logger, and look at frames on a timer. The scripts of the K5 proof are in `D:\ren\aspirant-work\home\k5\` (`proof.cjs` scenarios `down`, `up`, `keys`, `seek`, `reload`, `touch`; `frames.cjs`; `touch2.cjs` for one long touch gesture through the lock). Phone touch: `page.touchscreen` only taps; use CDP `Input.dispatchTouchEvent` (`touchStart`, many `touchMove`, `touchEnd`).

## 9. What was looked at (K5 proof, 19 Nov, dev server, real Chrome)

A scratch play on the fall section (`at: 0.1, from: 0, to: 1, seconds: 2`), reverted afterwards (`git diff` of `sections/fall/index.ts` is empty).

- **Down, 1440x900 and 390x844, real wheel** (notches of 100 px every 30 ms, wheeling hard through the lock): the play fires at the threshold (15.56 screens; the page stood at 15.577 and 15.564), `v` runs 0 to 1 in 1.95 s on the inOut curve, the page does not move while it runs (range 0.000 screens), `data-home-playing="fall"` and `html.lenis-stopped` are on for exactly the play, both clear when it ends, and the same wheel then moves the page freely.
- **Up**: the back threshold is 15.44 (threshold less hyst); the play runs 1 to 0 in 1.38 s (0.7 of 2 s), the page held at 15.416; free after.
- **Keys**: a Page Down crossed the threshold (the page went 0.875 screens in one frame, to 15.974) and the play locked there; six rounds of PageDown, ArrowDown, Space and End during the lock moved nothing.
- **Touch, 390x844** (CDP touch events): one gesture of up, down, up (75 moves) through the threshold: the page held at 15.572 for the 2 s of the play, the lock class on for all of it, and the gesture scrolled again after it.
- **Seek**: a seek in the middle of a play (progress 0.17) ended it: no hold, `v` at the resting value for the position, in both directions, and the wheel is free after it.
- **Reload**: the home reopens at the top; part way through a play a reload comes back at rest, no hold, `v` in the lead.
- **Frames** (`sheet-fwd.png`, `sheet-back.png`, nine frames 0.2 s apart): the fall scene (the doll thrown off, the camera following, "5 PHASES", "10 CHARACTERS") runs in 2 s and the back run plays the same scene in reverse in 1.4 s. No console error.

## 10. Calls made without the owner

- The thresholds read the real scroll, the lead and tail the smoothed one (a lag of up to 0.2 screens would have put the lock late).
- A backward play uses the same curve toward its target, not the time reverse of the forward one (an `out` curve reversed would start slowly: the visitor scrolled up and nothing seems to happen).
- `from === to` is refused (a play that changes nothing is a typo); `MAX_PLAY_SECONDS` is 10.
- A key press that jumps 0.875 screens fires the plays of everything it crossed in a chain (the chain rule); this is the same as a hard flick.
- A control that takes the keyboard focus on another section snaps the plays (no scene plays on the way to a button). The shell (`home-stage.tsx`) calls `requestSnap()` before it moves the page.
- `kernel/hold.ts` was rewritten to count holds; `handoff.test.ts` had a case that asserted the old contract (the lock got the caller's limit) and now asserts the new one (the hold lets go after its limit).

## 11. Not verified

- A smooth `ctx.scroll.to` that crosses a threshold and the keyboard-focus snap on the real page (both are unit tested at the runner level with `snap: true`; the engine's move tracking (`moveTarget`) was not exercised because no real section calls `to` across a threshold yet). Check the strip's "Scroll" button and a Tab to a control of another section when a section with plays is converted.
- Firefox and Safari; a real phone (the touch proof is CDP touch events in desktop Chrome); the production build; the plays together with the music section's own hold (the counting is unit tested).
- A hidden tab part way through a play (the wall-clock safety is unit tested, not seen).
