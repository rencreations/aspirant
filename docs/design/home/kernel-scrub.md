# Scroll zones and the idle snap (K7, round three)

The owner's feedback of 20 Nov: scenes are SCROLL BASED again. The visitor scrolls for the animation to play, and if they stop in the middle of a transition the page finishes it by itself, to the previous or the next rest. Only three things stay on a clock: the words on the right of the wall, the strip's small video growing into the big window, and the big window changing into the "Official animations" screen. Code: `kernel/scrub.ts` (new), small edits in `kernel/{plays,snap,beat,engine,run,types,probes}.ts` and in `components/smooth-scroll.tsx` (an `easing` option). Clock plays are unchanged: `kernel-plays.md`.

## 1. The idea in one paragraph

A play with a `span` is a ZONE. While the scroll is inside `[at, at + span]` (fractions of the section) the value the section's `update` gets is `v = from + (to - from) * ease(p)`, `p = clamp((s - at) / span)`. No clock, no hold, nothing runs by itself: the visitor drives it up and down and it is the same both ways. Before the zone `v` is the previous rest, after it `v = to`. A zone and a clock play may stand in one table (the strip and the aspirants keep some clock plays). When the visitor stops inside a zone the page finishes it by itself (section 4).

## 2. The API

```ts
// in a section's index.ts (kernel/types.ts: HomeSection.plays)
plays: [
  { at: 0.12, span: 0.4, from: 0, to: 0.5, seconds: 1.2, ease: "inOutSoft" }, // a zone
  { at: 0.7, from: 0.5, to: 1, seconds: 1.4 }, //                                  a clock play (as before)
],
```

| field       | meaning for a zone                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`        | where the zone starts: a fraction of the section's own range.                                                                                  |
| `span`      | its length, a fraction of the section. This is what makes the play a zone.                                                                     |
| `from`/`to` | the value before and after, as for a clock play. `from` must equal the previous play's `to` (the table is contiguous in value).                |
| `ease`      | the curve of `p`. Default `linear` (a clock play's default is `inOut`). Also `inOut`, `inOutSoft`, `out`.                                      |
| `seconds`   | the length of the idle snap for a full traverse of the zone (at most 10). It is not a clock: nothing runs for this long unless the page snaps. |
| `back`      | ignored.                                                                                                                                       |

Validation (at startup, in `layoutSections`, with errors that name the section and the play): `span` finite and above 0; `at + span <= 1` (a zone never runs into the tail: the tail is the scroll's passthrough); the next play's `at` is at or after `at + span` (zones and plays do not overlap in position); everything a clock table already needs (ordered, contiguous in value, `from !== to`, `seconds` in range).

Exports: `kernel/plays.ts`: `HomePlay.span`, `isZone`, `zoneProgress(play, s)`, `zoneValue(play, s)`. `kernel/scrub.ts`: `zoneRanges(layout)`, `zoneIndexAt`, `zoneHeading`, `zonePlan`, `ZoneSnap`, `ScrubReport`, the constants below.

### For authors: steps in screens (`kernel/beat.ts`)

```ts
const STEPS = [
  { atScreens: 0.4, spanScreens: 1.2, to: 1.5, seconds: 1.2 }, //   a zone, in screens
  { atScreens: 2.4, to: 3, seconds: 1.6 }, //                       a clock play
] as const;
screens: zoneLength(STEPS, 0.8), // the end of the last zone or play plus a dwell
plays: playsOf(0, 3, zoneLength(STEPS, 0.8), STEPS),
```

`BeatStep.spanScreens` makes the step a zone (linear by default). `playsOf(first, last, screens, steps)` writes `at` and `span` as shares of `screens`. `zoneLength(steps, dwell = 0)` is the section's length in screens: the largest `atScreens + (spanScreens ?? 0)` plus `dwell`. A section sets `screens` from its steps and the thresholds follow.

## 3. Semantics, in plain words

- **Value.** A pure function of the scene's smoothed scroll (`frame.S`, the same scroll that drives every scroll linked section). A seek into a zone gives the same picture as a slow scroll there.
- **Rest.** Outside every zone `v` stands still (a dwell): the plays' rest values. The lead and the tail pass the scroll through as for clock plays (`restOutside` too).
- **Mixed tables.** The station (how many plays are done) follows the smoothed scroll for a zone (entered at `at`, left going up when the scroll falls below `at`) and the real scroll for a clock play. A clock play right after a zone waits until the smoothed scroll has finished that zone, so the scene never jumps from the middle of a zone to the clock play's start. A clock play fires and holds as in `kernel-plays.md`; going up past it plays it back, and then the zone before it takes over.
- **Jumps and script moves.** A seek, a scrollbar drag, a focus move or a script's move gives the zone's value for the position: nothing fires, nothing holds. The idle snap's own move is one of these (the runner rests clock plays during it).
- **No hold.** Zones never hold the scroll. The wheel, the touch and the keys always work.

## 4. The idle snap

After the visitor has been idle (`ZONE_IDLE_MS` 220: no wheel, touch or key, and the page has not moved 1.5 px) and the scroll is inside a zone (`0.02 < p < 0.98`, `ZONE_EDGE`), the page scrolls by itself to the end of the zone the visitor was heading to.

- **Which end.** The last way the page moved. Down: finish forward from `p >= 0.25` (`ZONE_FORWARD_DOWN`), else go back to the start. Up: go back up to `p <= 0.75` (`ZONE_BACK_UP`), else finish forward. After a **key** (a few tens of pixels at a time) it always finishes the way it went, so Arrow Down can never be pulled back to where it started.
- **How.** `ScrollApi.to(target, { duration, ease: "inOut" })`: the engine's script move (clock plays rest on the position on the way, none fires, none holds) on the smooth scroller with an in-out curve (`ScrollToOptions.easing` in `components/smooth-scroll.tsx`). Duration = the zone's `seconds` times the share of the zone left to travel, at least `ZONE_MIN_SECONDS` 0.35.
- **Any input cancels it** at once: a wheel or a touch replaces the smooth scroller's move by itself, and a key also stops the tween (`holdScroll(1000)()`), then the visitor has the page. A new snap waits for idle again.
- **It never runs** when: the home is not open; the scene is frozen by a probe; the visitor has not pushed the page since the last seek or load (`unarmed`); 600 ms have not passed since a seek, jump or load (`grace`); a snap of ours is on its way; a script's move is on its way (a button: the page is where it is meant to be); a finger is on the screen; any scroll hold is on (a clock play, the aspirants' preview, the list's viewer, the music), or the site's scroll lock is on for another reason (the menu, the player of the strip's big window, a dialog: the `lenis-stopped` class on `html`, `SnapFrame.locked`; the joint snap obeys it too); a clock play runs or waits; a flick is being chased; the page is outside every zone (a dwell is a rest).
- **After a touch fling and with the keyboard.** The idle rule waits for the page to stop moving, not only for events, so the browser's fling momentum and Lenis's wheel glide are waited for.
- **Joints.** The joint snap of `kernel-snap.md` (the lead and the tail of two sections, nearest rest) is blocked (`blocked: "zone"`) while the page is inside a zone, so the two never fight. A zone's two ends are thresholds for the joint snap (`playThresholds`): its rests keep clear of the zone.

Numbers to tune: `ZONE_IDLE_MS`, `ZONE_FORWARD_DOWN`, `ZONE_BACK_UP`, `ZONE_MIN_SECONDS`, `ZONE_EDGE`, `ZONE_GRACE_MS` in `kernel/scrub.ts`; each zone's `seconds`.

## 5. Choosing zone and dwell lengths

- A zone of **0.6 to 1.5 screens** reads as a scene the visitor drives: shorter is a flick, longer is a long drag and the snap has far to carry. The snap duration is `seconds` for a full traverse, so 1.0 to 1.6 s is right for a zone of one screen.
- A **dwell of 0.4 to 1 screen** between a zone's end and the next zone or play: the visitor stands in a composed rest frame (as in `kernel-plays.md` section 5). A zone that starts right where the last one ends is a continuous scene; the snap then finishes whichever one the page stops in.
- Keep a dwell of at least 0.15 screens between a zone's end and a **clock play** after it (`ZONE_CLOCK_GAP`; the dev server warns in the console when a table is closer, the validation does not throw because it runs at startup): the snap lands exactly on the zone's end, and a play whose threshold is the same place would fire as the snap arrives.
- Zones should not overlap the lead or tail of a neighbouring section (a position in two scenes at once has two owners; the zone snap wins, the joint snap defers).
- The rest frame of both ends of a zone must be composed: the page may stand on either.
- The words that appear **by a trigger** stay clock plays (or the section's own trigger logic): give them a clock play before or after the zone, never inside it.

## 6. How to look

- `window.__home.plays()` for a zone section: `{ id, v, kind: "zone" | "mixed" | "clock", zones: [{ index, kind: "zone", p, v, resting }], ... }` (`p` is the zone's progress from the scene's scroll, `resting` is true outside it).
- `window.__home.snap().scrub`: `{ idleMs, armed, moving, blocked, zone: { id, index, from, to, p } | null, target, heading, zones }`. `blocked` is the first reason the snap does not run now (`input` while the visitor or the glide is busy, `outside` in a dwell, `unarmed` after a seek...).
- To look at the place the wheel reached, `seek` to it (a seek never snaps). To look at where the page settles: wait for `!s.scrub.moving && s.scrub.blocked !== "input"`.
- Wheel with `page.mouse.wheel(0, 100)` every 30 ms, then stand still and sample `window.scrollY / innerHeight` on a timer. Touch: CDP `Input.dispatchTouchEvent` (`page.touchscreen` only taps). Scripts of the proof: `D:\ren\aspirant-work\home\K7\`.
- Pure tests: `kernel/scrub.test.ts` (zone arithmetic, validation, the machine with zones, the snap decision and the `ZoneSnap` blockers).

## 7. What was looked at (K7 proof, 20 Nov, dev server on 3000, real Chrome, real wheel, 1440x900 unless said)

The fall section had been converted to two zones by the bolt and fall helper while this was built, so the proof ran on the real zone (`fall`, one screen of 0.9 screens). Scripts: `D:\ren\aspirant-work\home\K7\` (`zone.cjs`, `more.cjs <scenario>`, `frames.cjs`; the logs are in `out/`). The dev server reloads the page when another helper saves, so every script starts again from the top when it sees that. The zone moved between runs (13.45, 13.65, 14.9 screens) because the sections above were being retuned.

- **Down, stop past a quarter** (wheeled to p 0.5, the Lenis glide carried it to 0.57): `scrub.blocked` was `input` while the wheel and the glide lasted; at 235 ms of idle one move began to the end of the zone (`heading: forward`), 0.38 s (0.9 s times the 0.43 left), the in-out curve shows in the steps (0.05, 0.08, 0.13, 0.08, 0.03 screens per 50 ms), `y` landed on 14.3500 exactly, `p` 1, then `blocked: outside`. No second move.
- **Down, stop in the first tenth** (`small`): it went back to the start of the zone (13.45, `v` 0).
- **Up, stop at p 0.55** (`up-back`): back to the start. **Up, stop at p 0.88** (`up-fwd`): forward to the end (14.35, `v` at the zone's `to`).
- **One continuous wheel through the whole zone and out** (`pass`): no snap move while the wheel was pushing (0 frames with `moving` and input above 50 px/s), `v` monotonic going down. `jointSnap.blocked` read `zone` inside the zone and `outside` after it.
- **A wheel against the snap** (`cancel`): the snap was on its way (14.17 to 14.45), a wheel of 150 px up cancelled it at once (`moving` false in the same frame) and the page followed the wheel (14.51 to 14.38). After the idle time a new snap ran forward (p 0.82 is above three quarters going up).
- **Keyboard** (`key`, three Arrow Downs from p 0.03): after the key it finished forward to the end (never back to 0). `key-up` (two Arrow Ups from p 0.9) finished back to the start.
- **A flick** (`flick`, one 1500 px wheel from before the zone): the page went through and out to a dwell, no snap, no hold. **A stop in a dwell** (`dwell`): nothing moved, `blocked: outside`.
- **A seek into the zone** (`seek`, wait 3.5 s): the page did not move (14.01 for all frames), `armed: false`, `blocked: unarmed`.
- **Phone 390x844, CDP touch events** (`touch`, a drag into the zone, 700 ms still on the glass, lift): while the finger was down `blocked: touch` (also at 383 ms idle) and the page did not move; after the lift 189 ms of idle, then one move forward to the zone's end (15.7998). A fling with momentum was not simulated (CDP touch events have none; the wait for the page to stop is the same `movedAt` rule as the wheel's glide).
- **Frames** (`out/sheet-fall.png`, a seek at p -0.1, 0, 0.25, 0.5, 0.75, 1, 1.1): the scene follows the scroll, the doll is thrown and falls to "5 PHASES", the last three frames are the same rest. No console error in any run.

## 8. Calls made without the owner

- The zone's value follows the smoothed scene scroll (`frame.S`), like every scroll linked section; the idle snap reads the real page. A clock play after a zone waits for the smoothed scroll to finish the zone (a lag of at most 0.2 screens).
- `at + span` must be at most 1: a zone never runs into the tail.
- A key always finishes the way it went (not the quarter rule), as in the joint snap.
- The idle time is 220 ms (the owner's "about 220") and the page must also have stopped moving 1.5 px for that long, so the snap starts about 0.8 s after the last wheel (the glide). This is the same rule as the joint snap, which keeps 180 ms.
- The joint snap defers to the zone snap while the page is inside a zone (`SnapFrame.zoned`, `blocked: "zone"`).
- `ScrollApi.to` and `EngineOptions.scrollTo` got `ease`/`easing`; `components/smooth-scroll.tsx` passes `easing` to Lenis (one line and a type member).

- **The menu opened over a zone** (`menu.cjs`): a click on Menu 150 ms after the wheel put `lenis-stopped` on `html` with no hold of the home counted. Before the guard the snap ran behind the menu (y 15.516 to 15.918, 30 moving frames); with it `blocked` is `hold`, the page stood at 15.5067 for the 3.6 s watched, no move.

## 9. Not verified

- A real phone fling with momentum, a real trackpad, Firefox, Safari, the production build.
- A snap that has to cross another section's joint (the zone snap moves to the end of its own zone, which authors keep clear of joints).
- A zone directly followed by a clock play with no dwell (the snap's landing equals the threshold): the table accepts it, section 5 says to leave 0.15 screens.
- Several zones of different sections overlapping in position (the first in scroll order wins).
