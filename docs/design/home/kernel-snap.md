# Kernel: input energy, ready gate, joint snap, flick (K6, round two)

The owner's feedback of 19 Nov: the rows should speed up with the push of the wheel, scenes should wait until their pictures and models are there, "all snap section scroll" (a visitor who stops mid scroll is carried to the previous or the next rest by the page itself), and a very hard flick must not skip the scenes. Four small kernel features, all tested. Code: `kernel/input.ts`, `kernel/snap.ts` (new), small edits in `kernel/{engine,run,plays,types,probes}.ts`. Plays themselves: `kernel-plays.md`.

## 1. Input energy

```ts
// in a section's update(local, frame)
const push = frame.input.wheel; // px per second, signed, positive going down
```

- `FrameInfo.input = { wheel: number }`: the smoothed velocity of the visitor's scroll input in px/s, positive going down, negative going up. Wheel deltas and touch moves (the finger going up is the page going down). A line or a page delta is normalised to pixels (`wheelPixels`). A pinch (ctrl) and a sideways push do not count.
- The smoothing is an exponential average of the rate with a time constant of 140 ms (`INPUT_TAU`, `smoothInput`): a steady push of 600 px/s reads 600, and when the visitor lets go it falls to a third in 140 ms and is 0 after about 0.8 s. It does not depend on the frame rate.
- It is measured from the input events, not from the page's position, so it keeps reading while a play holds the page (the page does not move, the wheel still does). Passive listeners on the window, owned by `InputEnergy`, attached and detached by the engine. The cost while idle is two comparisons a frame. The same object is carried by every frame (written in place): never keep a copy, read it in `update`.
- `FrameInfo.input` is required. A test that builds a `FrameInfo` literal adds `input: { wheel: 0 }` (the kernel tests, `fx/backdrop/backdrop.test.ts` and `fx/comic-marks/lab.ts` were updated).
- `window.__home.state().input` is the same number.
- Looked at (real Chrome, real wheel, 1440x900, dev server): a push of about 1180 px/s reads 984, 1132, 1175, 1182 over four samples; after the push 579, 251, 109, 60, 23, 2 at 100 ms steps (e^-100/140 = 0.49: 1182 to 579); going up reads -452 to -569; it kept reading (-452) while a list play held the page.

## 2. Ready gate

```ts
// in a section's runtime (kernel/types.ts: SectionRuntime.ready)
ready: () => model.loaded && shaderCompiled,
```

- Optional. A runtime without `ready()` is always ready. A forward play of a section whose runtime is not ready does not fire and does not hold the scroll. It fires on the first frame the runtime says ready, if the scroll is still past its threshold (if the visitor went back above it meanwhile, nothing fires). If the scroll passed several thresholds while the gate was shut, the plays chain in order when it opens.
- A play going back never waits. A jump, a seek, a focus move and a script's move are not gated (they rest on the position, no play).
- Wiring: `PlayMachine` takes `ready?: () => boolean` in its options (`kernel/plays.ts`, `waiting` says a play is due but the gate is shut); `SectionRunner` builds it from `slot.runtime.ready` (`kernel/run.ts`). A `ready()` that throws is reported once through `onError` and taken as ready. `runner.waiting()` is true while any section waits; `plays()[i].waiting` is the same per section (probe). The joint snap does not run while a play waits.
- Keep `ready()` a flag read: it is called once a frame at most, while a play is due. The range helpers implement it where they build actors (nothing in the sections was edited).
- Tests: `kernel/ready-gate.test.ts` (the machine and the runner).

## 3. Joint snap

When the visitor lets go inside a **joint**, the page runs to the nearer **rest** in 0.5 s.

- A **rest** is any position in a dwell: a section with plays gets a number that does not follow the scroll between two thresholds, so the page can stand anywhere there. The places that are not rests are the joints.
- A **joint** (`jointZones(layout)`) is the scroll range in which a section's lead or tail (its scene follows the scroll there) is on screen with its neighbour, plus the ground cross-fade (`GROUND_FADE`) of a pair whose grounds follow the scroll. A section that rests in its lead and tail (`restOutside`) has none, and the ground of such a pair is its scene's own cue. A section with no plays (the footer) follows the scroll over its whole range: a joint that touches it is dropped, so nothing near the footer snaps. Joints are merged, in order, never overlapping. Today's registry has 11 (`window.__home.snap().joints`, `kernel/snap-registry.test.ts` holds the invariants).
- The **rest to run to** (`restFor`) is the end of the dwell before the joint (`zone.from`) or the start of the dwell after it (`zone.to`), whichever is nearer. A tie goes the way the visitor was going. After a **key** (which moves a few tens of pixels at a time) the rest in the way of travel wins whenever it is open, so Arrow Down in a joint can never be pulled back to where it started. It never rests where a play would fire or un-fire: going on stops `THRESHOLD_MARGIN` (0.012 screens) short of the next threshold, going back stops just above a threshold that has fired. A side that cannot leave the joint that way is not a choice, and when neither is the page stays (the visitor has to scroll on). Landing within `ZONE_INSET` (0.02) of an edge counts as outside, so a landing a pixel off is a rest and the snap cannot loop.
- It starts when **all** of these hold (`JointSnap.step`, in order, the first that fails is `snap().blocked`): the home is open (`closed`); the scene is not frozen by a probe (`frozen`); the visitor has pushed the page (wheel, touch or scroll key) since the last seek, jump or load (`unarmed`); 600 ms have passed since that jump (`grace`); no snap of ours is on its way (`moving`); no script move of a section is on its way (`script`); no finger is on the screen (`touch`); 180 ms have passed since the last wheel, touch or scroll key AND since the page last moved by 1.5 px or more, so the glide of the smooth scroller and a touch fling are waited for (`input`); no scroll hold is on (`hold`: a play, the aspirants' preview, the list's viewer, the music: `holdCount()` is read live in the frame); no play runs or waits for its gate (`play`); the scene is not catching up with a flick (`chase`); the page is inside a joint (`outside`) and a rest is open at least 0.01 screens away (`no-rest`).
- It moves with the existing `scroll.to(screens, { duration: 0.5 })` (the engine's script move: plays rest on the position on the way, none fires, none holds). `ScrollApi.to` and `EngineOptions.scrollTo` got `duration` (seconds), which the shell already passes to the smooth scroller. The easing is the smooth scroller's own (an ease out: most of the move in the first 150 ms, the rest settles). Nothing in the shell changed.
- **Any input cancels it.** A wheel and a touch replace the smooth scroller's own move by themselves, so the engine only clears its state. A key does not (the smooth scroller keeps overwriting a native key scroll), so on a key the engine also stops the tween with a lock and release (`holdScroll(1000)()`, the lock's pause resets the scroller), and the key's own scroll goes on.
- A seek, a jump, a focus move and a section's own smooth `scroll.to` disarm it until the visitor pushes the page again, and the first 600 ms after a seek or the load never snap. This keeps every frame sheet that seeks into a joint and waits still: the page does not move.
- **A test or a probe that wheels into a joint and then looks** (`scripts/qa/probes/home*.cjs` do wheel; `e2e/home.spec.ts` does not) will see the page move about 0.8 s after the last wheel (the glide, 180 ms of idle, 0.5 s of move). To look at the place the wheel reached, `seek` to it (a seek never snaps) or read the page before the idle time. To look at the place the page settles on, wait for it: `await page.waitForFunction(() => { const s = window.__home.snap(); return !s.moving && s.blocked !== "input"; })` (it is `outside`, `no-rest` or `unarmed` once nothing more will move). A stop inside a dwell, which is where almost every probe stands, never moves.
- `window.__home.snap()` says `{ idleMs, armed, moving, blocked, zone, target, zones, joints, thresholds, chasing, real, seen }`.
- Numbers to tune (`kernel/snap.ts`): `SNAP_IDLE_MS` 180, `SNAP_GRACE_MS` 600, `SNAP_SECONDS` 0.5, `MOVE_EPS_PX` 1.5, `ZONE_INSET` 0.02, `THRESHOLD_MARGIN` 0.012. To make a joint snap further or less, change the lead and tail of the section (the joint is the lead and tail), not the kernel.
- What this does to a section's design: a joint with a threshold of a play inside it (`16.4 to 17.4` with a threshold at 17.08 today) snaps only the way that leaves it without a play. A joint that is short of a dwell is a visible jump of the page, so keep dwells at least 0.4 screens (`kernel-plays.md` section 5).
- Tests: `kernel/snap.test.ts` (zones, nearest rest, the thresholds, the idle rule and every blocker, the key rule, cancel), `kernel/snap-registry.test.ts` (the real registry: joints in order, every rest outside every joint and across no threshold, the footer out).

## 4. Flick

Reproduced first (real Chrome, dev server, `page.mouse.wheel(0, 20000)` from 3.0 screens): the page went 3.0 to 25.2 in 14 frames of up to 6.6 screens, `SceneScroll` saw a jump, and one play fired of about 20 on the way. A 5000 px wheel did not do it: the smooth scroller splits it into steps of at most 0.71 screens and the plays chain by themselves (the strip's last play, then the bolt's first). So the problem starts when one frame's step of the real page is larger than a screen, after a wheel or a touch (a flick of many thousand pixels, a slow frame).

`FlickLimiter` (`kernel/snap.ts`) stands between the page and the scene (the engine feeds `scene.step` with it; `frame.raw` and `frame.S` are the limited value, `snap().real` is the page):

- It engages when the real page is more than `FLICK_ENGAGE` (1) screen from the scene's position and the last scroll input was a wheel or a touch within `FLICK_WINDOW_MS` (1.5 s) and no key came after it. Below that the scene sees the page exactly.
- Engaged, the scene follows the page `FLICK_STEP` (1) screen a frame (under the jump of 1.5 screens less the lag of 0.2 of `SceneScroll`), standing still while a play holds the page. So every threshold on the way fires in order, each with its hold; the scene catches up and the limiter lets go. The engine keeps the hold across the one frame between two plays of a chase (`flick.engaged`).
- The page is pulled back (`scrollTo` immediate, which also drops what is left of the wheel's glide) so that the scene is never more than `FLICK_MAX_LEAD` (2) screens behind it. A flick carries the scenes through at most two screens of plays. This is a call of mine, not the owner's: the brief says "let the remainder continue", and the remainder is dropped beyond two screens. What I saw: with the cap raised to 40 for one run on the dev server (frames of 30 to 100 ms, so the glide covers several screens before the first hold stops it), a 20000 px flick from 9.3 chained plays through the hand, selena, music and funny sections (the page was held for over 15 s) before the dev server reloaded the page and cut the log. On a fast machine the first hold cuts the glide sooner, so the uncapped chase is shorter there, but I did not measure it. Raise `FLICK_MAX_LEAD` to carry more.
- It never engages (the scene takes the page as it is, as before) for: a key (Home, End, Page Down), a seek, a focus move (`requestSnap`), a script's smooth or immediate `scroll.to`, a frozen scene, the first frame, a wheel older than the window. A key pressed during a chase ends it with a jump. A chase older than 20 s ends with a jump (safety).
- Both directions are limited (a hard flick up plays the back plays in order too).
- Tests: the `FlickLimiter` block of `kernel/snap.test.ts`.

## 5. Looked at (real Chrome, dev server on 3100, real wheel, 1440x900 unless said)

The dev server reloads the page whenever another helper saves a file, so every proof is a script that starts again from the top when it sees the reload (`D:\ren\aspirant-work\home\K6\common.cjs`, `attempt`). The joints below moved between runs because the other sections were being retuned; every proof picked its joint from `snap().joints` (`pickZone`).

- **Snap, wheel down into a joint and let go** (`snap.cjs down`): the page glided to 4.51 and stopped; `blocked` was `input` until the glide had ended and 180 ms had passed (about 0.4 s after the last visible movement, 1 s after the last wheel); then one move of 0.5 s to the nearer rest 4.30 (4.5133, 4.4711, 4.4333, ..., 4.3044, 4.3000); no second move, `blocked: outside` after.
- **A tie** (the page stopped exactly in the middle): it went on the way the visitor was going (8.35 in a joint 8.1 to 8.6 went to 8.6).
- **Wheel during the snap** (`snap.cjs wheel-during`): the first move began, a wheel of 0.25 screens came 0.1 s into it, the page followed the wheel (4.32 to 4.57), no fight with the tween; after the wheel a new snap ran to the nearer rest 4.788 (a threshold at 4.8: stops 0.012 short).
- **Arrow Down during the snap** (`snap.cjs key-during`, run again after the key rule): the snap was on its way down to 4.30 and the key came at 4.353; the tween stopped there (4.342, then 4.3867 after the key's step of 40 px), and 180 ms later a new snap ran on the way of the key, to 4.788 (the other end of the joint, 0.012 short of the threshold at 4.8). Before the key rule it ran back to 4.3.
- **Wheel up into a joint** (`snap.cjs up`): from 4.92 up into the joint 4.3 to 4.8; the strip's back play fired at the threshold and held the page at 4.67 (`blocked: hold`); after it, 876 ms of idle, then one move of 0.5 s to the nearer rest 4.788 (the end it came from).
- **Seek into a joint**, wait 3 s (`snap.cjs seek`): the page did not move (4.65 for all frames), `armed: false`, `blocked: unarmed`.
- **Phone 390x844, CDP touch swipe** released inside a joint (`touch-snap.cjs`): while the finger was down and still for 400 ms `blocked: touch` and the page did not move; after the touch end the snap waited for the energy to die (190 ms of idle) and ran 4.633 to the rest 4.788 in 0.4 s. A fling with momentum was not simulated (CDP touch events have none): the wait for the page to stop is the same `movedAt` rule as the wheel's glide.
- **Flick** (`flick.cjs`, `chase-seek.cjs`): 20000 px from 0.5 screens: the first frame the page was pulled to 2.5 (0.5 + 2), the scene took one screen (`raw` 1.5), the aspirants' second play fired and held (`playing: aspirants`, `lenis-stopped` on, `chasing: true`, the page still at 2.5 for the whole play), then the rows play and the strip's first fired in order, `chasing` went false at the end, the hold was released, y 2.5. 0 console errors from the kernel.
- **The hold across a chase** (`chain-gap.cjs`, 20000 px from 0.5): 519 frames, 69 of them chasing, 0 of those without the hold (`lenis-stopped`), and exactly one chasing frame with no play running (the frame between the aspirants' play and the rows' play): the hold was kept through it, released 3.2 s later when the last play ended.
- **End** from 3.0: the browser scrolls the key smoothly; frame 1 moved 0.8 screens (a play fired and held), frame 2 moved 2.31 (a jump: the plays rested, the hold let go), then the page was at 31.5 with `chasing: false`. This is the old behaviour (a key jumps) and it is kept. **Home** ended at 0, no chase. **A seek in the middle of a chase** (`seek(10)` 0.3 s into a flick): y 10, `chasing: false`, no hold, plays at rest for the position.
- **A wheel then End within 20 ms**: the End was swallowed by the hold of the play that the wheel had started (the lock's contract, `kernel-plays.md` section 3), not by the limiter.
- **Typecheck, lint, tests**: `npx vitest run src/features/home/kernel` 301 passed; eslint clean on `kernel/`; `tsc` shows nothing in `kernel/`, `fx/comic-marks`, `fx/backdrop`; knip has nothing of mine. The whole `src/features/home` suite had 4 failures, all in files of other helpers in flight (`fx/image-field/sets.test.ts`, `sections/rows/preload.test.ts`, `preload-items.test.ts`).

## 6. Calls made without the owner

- The snap is armed only after the visitor has pushed the page since the last seek or load, and never inside the first 600 ms after one. Frame-sheet scripts that seek into a joint and wait stay still.
- A section's own smooth move of the page (`scroll.to` from a button) disarms the snap until the next push (the button's target is where the page is meant to be).
- Idle means the page has not moved by 1.5 px for 180 ms, not only that no event came: the smooth scroller's glide after the last wheel lasts about 0.8 s, and a snap that started in the middle of it would pick the wrong side.
- A key that stops in a joint goes on, not back.
- The flick pull-back at two screens (above).
- `FrameInfo.input` is required, not optional: a missing field is a type error in a test or a lab that builds a frame, and one line fixes it.
- Both flick directions chain.

## 7. Not verified

- Production build (`pnpm build` was not run: it replaces the owner's `out`). The proofs are on the dev server, where frames are slow (30 to 100 ms under the load of ten helpers), which is why a flick shows steps of 2 to 6 screens a frame there. On a real machine the engage rule (more than 1 screen in one frame) is met by a flick of about 15000 px or a hitch; a flick of 5000 px passes without it.
- A real trackpad flick, a real phone fling with momentum, Firefox, Safari. The browser's Back button (the page reopens at the top, `useFreshStart`, so it is a load: the engine starts again and the grace applies; not exercised).
- The easing of the snap (the smooth scroller's default ease out). If it reads as a jolt, give `SmoothScrollApi.scrollTo` an `easing` option (a shared component: not touched) and pass a cubic in out.
- "A bigger threshold on sections with text" is not a kernel feature: a threshold is the `at` of a play in the section's table. The kernel's numbers (`ZONE_INSET`, `THRESHOLD_MARGIN`, the hysteresis `hystOf`) are unchanged.
- The ready gate on the real page: no section implements `ready()` yet (the range helpers do), so it is unit tested at the machine and the runner level only.
- The hold between two plays of a chase on a real device (looked at on the dev server only: see section 5).
