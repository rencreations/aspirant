# Home: the loader, the tap gate and the intro (workstream A2)

What a document load of `/` shows before the page is the visitor's: the drone that waits with them while the real list loads, the gate ("Touch anywhere to continue") and a 13.2 second intro in which two Guinevere drones bring the logo, struggle, are helped by the normal drone, pull the logo to its hero size, are thanked and leave. It ends exactly on joint J0 (the hero's first frame). Everything is built on the wave 1 and 2 pieces: `lib/home-flow.ts` (phases, shown progress), `components/loader-gate.tsx` (the host), the drone, the duo, the logo and the comic marks, all drawn in the home's one canvas. No second WebGL context exists. Notes on the host and the phases: `infra.md`. Notes on the kernel: `kernel.md`.

## 1. Files

| File                                                   | What                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/home/boot/timeline.ts`                       | PURE. `introAt(t, geo, out)` writes every actor's target state for `t` seconds since the press; `CUES` (one shots); `carriedRect` (where the logo is between two hands); the beat times `T`.                   |
| `features/home/boot/loader.ts`                         | PURE. The drone's brain while the page loads: a trick every 4 to 7 s, a cheer at each real quarter, a worried look when the files really stall or there is no connection. It never moves the bar.              |
| `features/home/boot/copy.ts`                           | PURE. Groups the real labels (Type, The stage, The drone, Films, Sound, 3D models, The art), the lines of company, `companyLine`, the words of the gate and the skip.                                          |
| `features/home/boot/lift.ts`                           | `liftStage` / `dropStage`: for the length of the opening `<main>` goes to z 91 and click through, so the canvas shows above the loading screen's ground (z 90). Inline style set once, removed once.           |
| `features/home/boot/bus.ts`                            | The little shared state between the DOM screen and the scene (stage, `droneShown`, `introT`, `skipRequested`, `pressOnDrone`). Tiny: it ships on every route.                                                  |
| `features/home/boot/preload.ts`                        | `droneTier`, `introTier`, `bootItems`, and `afterTheDrone(first, rest)`: the ordering gate (section 4).                                                                                                        |
| `features/home/boot/runtime.ts`                        | `createBootRuntime(ctx)`: the scene. Builds the drone, then the marks, the pair and the logo one by one; runs the loader or the intro each frame; fires the cues; `finish()` calls `finishIntro()`; the probe. |
| `components/home-boot/home-boot.tsx` and `.module.css` | The DOM: ground and dots, mark, real bar with notches, percent, label, bytes, groups, company line, the gate button, the Skip button. Reads the real progress in its own frame loop, no React state.           |
| tests beside each pure file                            | `timeline`, `loader`, `copy`, `lift`, `bus`, `preload` (104 tests with `lib/home-flow.test.ts`)                                                                                                                |
| `scripts/qa/probes/home-boot.cjs`                      | The probe (section 8).                                                                                                                                                                                         |

Shared files touched (all additive and backward compatible): `kernel/engine.ts` (the boot hook, `canPrime`, `primed`), `lib/home-flow.ts` (`setTapGuard`), `components/loader-gate.tsx` (nav lock fields, `hasWebGL` for `hideLogo`), `features/home/preload-items.ts` (the two tiers), `home-stage.tsx` (the plain page gives the bar's logo back), `kernel/lab.ts` (one line, not mine: `film`). `lib/home-flow.ts` already had the phases.

## 2. The loader

**Screen.** The plain cover of the boot script stays until the loading screen has drawn two frames (`advance("boot")`, no timer). The screen has the same ground, mark and bar as the cover (measured at 1440 and 390 wide: the mark and bar tops equal), so the hand over is not seen. The real bar is `scaleX` of one element, never ahead of the truth (`stepShown`: closes on the real fraction at 6 per second, never passes it, never goes back). The percent is whole, rounded down, 99 at most until the phase is `tap`. Notches at 25, 50 and 75 turn pink when the real bar has passed them. A shine runs along the bar whatever the progress (CSS transform, decoration). Under it: the bytes ("3.0 MB of 3.1 MB", only "received" while some size is unknown), the groups (a dot each, pink when none of the group's downloads is left), and a line of company after 5 s, changing every 4.5 s ("The drone is stretching its wings."), "Nearly there." only past 90 percent of the real progress. The label is one of the real running downloads, changing every 2.4 s. The host's slow note (15 s, `SLOW_AFTER_MS`) and the offline note stay as they are, at the foot.

**Drone.** It stands in the middle on a clear gap above the mark at every window shape (`loaderPlace`, tested over 70 window shapes). It appears as soon as its files are in (`appear()`: a spring pop in with wings fluttering), floats, blinks and looks at the pointer (a mouse) or wanders (touch). Every 4 to 7 s a trick from a list of eight (wiggle, nod, hop, spin, roll, barrel, frontflip, loop) with a face or an icon. A cheer (hop, backflip, barrel with sparkle, heart) at 25, 50 and 75 percent of the REAL progress. If no new byte has come for 4 s, or a download is being retried, it looks worried (sweat face and drop). Offline: sad face, dots, dizzy. At the gate: a frontflip with a heart. Hover: the site's cursor says HELLO, the drone's own reactions run (a lift, a happy face, hop, roll, nod, bubbles, dizzy after three presses, annoyed after five).

**Gate.** `tap` phase: the bar and the words go and "Touch anywhere to continue" comes in with a hairline that draws and rubs out under it (a transform; the words keep full contrast for axe). A press on the drone is NOT the gate: `runtime.ts` sets `setTapGuard(() => bootBus.pressOnDrone)`, true when the press began on the drone's hit target (the kernel resolves the hit synchronously at the press, also for touch). A press anywhere else, a tap, Enter or Space continues; the click calls `tapToContinue()`, which calls `audio.unlock()` inside the gesture. The button is a real button, focused without a ring when it appears.

## 3. The intro (13.2 s, a clock, no scroll)

Times are seconds since the press (`T` in `timeline.ts`). Stage pixels, y up, origin at the middle.

| t              | what                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 to 1.0       | The words and the bar are gone by 0.5. The drone flies from the loader's place (x 0, standing on a 26 px gap above the mark, `loaderPlace`) to its corner (the J0 place).                                                           |
| 0.9            | The pair (`a` bold, `b` soft) and the logo come in from the left, off screen. The pair carry the logo between their gloves (`duo.carry(null, ...)`, then `logo.place` from `carriedRect` of the real glove points).                 |
| 0.9 to 5       | They STRUGGLE: tension 0.35 to 1, struggle 0.3 to 1, the lift rises and falls (the logo hangs loose, wobbles), they drop it at 3.35 (`DROP_AT`: lift to -0.7, the logo jolts, a gold bang). Faces: effort, strain, worry, surprise. |
| 1.85           | The normal drone sees them: `shock()` (the comic "!" with rays), the shocked face, a hop, the sound `blip("whoosh")` as they arrive.                                                                                                |
| 3.55 to 5.1    | The drone flies under the logo (determined face, sweat drops) and lifts: the pair's strain falls to 15 percent, the logo's sag with it.                                                                                             |
| 5.1 to 6.8     | The three carry the logo to the middle.                                                                                                                                                                                             |
| 6.8 to 7.7     | The drone steps back to its corner and looks at them (`pose("peek")`). The pair take the logo's two corners (`duo.pull`: `a` bottom left, `b` top right).                                                                           |
| 7.7 to 9.4     | The logo grows from 44 percent of the hero width to 100 percent (0.7 of the screen, 0.86 on a phone) with a small overshoot, a ripple running along it. At 9.25: starbursts at its corners, a spark, `blip("star")`.                |
| 9.65           | The thanks: the drone bows (`pose("thanks")`), hearts over the pair, then icon only bubbles (heart at 10.7, sparkle at 11.5, smile at 12.2; no words). The pair bow (`pose("bow")`), cheer and shy.                                 |
| 11.15 to 12.45 | The pair leave (`pose("leave")`: crouch, zip off screen, one to the top right, one to the bottom left, streaming).                                                                                                                  |
| 12.45 to 13.2  | What remains: the big logo and the drone at the lower right, still. Then `finishIntro()`.                                                                                                                                           |

The ripple of the logo ends at the calm ripple the hero starts with (`LOGO_REST_WAVE` 0.3 equals `REST_WAVE` in `sections/hero/runtime.ts`: change both together).

**Skip.** A quiet "Skip" (bottom right, a real button, tab reachable) and Escape: `jumpToEnd()` moves the clock to 12.5 s (the pair gone, the logo at size), snaps the drone and clears the marks; the last 0.7 s play so the springs rest, then `finishIntro()`. The design document wanted the intro to be unskippable and at most 10 s; the assignment of this run asked for 12 to 14 s with a Skip, so that is what is built. Remove `<button className={styles.skip}>` and the Escape listener to make it unskippable (nothing else depends on them).

**The end.** `finishIntro()` makes the phase `open`. The host (`loader-gate.tsx`) then: sets `entered`, un-inerts the shell, releases the scroll and the router, and sets `hideControls: false` (the menu, the sound button and the page name fade in over 420 ms, which makes the new state plain). The bar's logo is NOT shown: `hideLogo` stays true (set at the start of the opening when WebGL exists) until the hero gives it back (`showNavLogo(true)` in the frame the big logo has morphed into the bar's). With no WebGL the big logo does not exist, so `hideLogo` is never set and the bar keeps its own.

## 4. Loading order (the tiers)

`homeItems()` on a document load (`features/home/preload-items.ts`):

1. **Tier one**, started at once: `droneItems({ deferred: false })` (the actor's chunk, `drone.glb` 250,192 B, the two face pages 21,286 and 12,976 B, the icons 24,700 B), the opening's scene chunk (`home-boot`), and `home-engine` (the stage). It is what it takes to draw the drone.
2. **Tier two**, held: `introTier()` (the pair: chunk and `companion.glb` 241,420 B; the logo's chunk and its drawn texture) and every waited item of the sections. `afterTheDrone()` wraps their `run` so they start when tier one has finished (arrived or skipped by a 404 or 410). Progress, labels and bytes are the items' own; a deferred item is left alone. The gate is one per document (a second list finds the first one's items running).

The engine holds back the sections' own mounts too: `runner.prime` waits for `boot.canPrime()` (the drone is on the stage, or the scene failed), and the page is not called ready until it has primed (`primed`). Otherwise the hero would start asking for the splash art the moment the engine starts. Measured with every file delayed by 1.5 s (`delay.cjs`): the four drone files asked at 1.44 s, the companion model at 2.99 s (the gate opened at 2.94 s), the drone on the stage at 3.4 s, the gate at 7.7 s. Not gated, and worth knowing: plain `<img>` tags in the sections' server markup (the card pictures, the covers of the archive) are asked by the browser while the HTML is parsed, before any of this, and share the connection with the drone's files. A section's `view.tsx` that wants its pictures out of the way of the drone should give them `loading="lazy"` or `fetchpriority="low"` (not done: not mine).

Cost of the order, measured on the dev server with the switch on and off (six runs each, the server busy with other work): the gate opens 0.4 s later at the fast end (2.9, 3.0, 3.9 s against 2.5, 2.5, 3.5 s). It is one round trip and the sections' mounts starting a little later; on a slow link the drone is on screen long before the pictures. Kept on purpose.

Waited bytes seen on the dev server at the gate: 4.6 to 5.0 MB (the drone 0.31, the pair 0.24, the logo and chunks, the hero's seven 45 degree cards, about 20 splash art pictures, two logos). It grows as the other sections add their first screens. All of it is real bytes through the media store (saved in Cache Storage for the next visit).

## 5. The scene during the opening (kernel hook)

`kernel/engine.ts` creates the opening's scene when `useHomeFlow.arrival === "document"` and the phase is not `open`: it imports `boot/runtime.ts` (a lazy chunk), builds it with the real `ActorCtx`, and each frame while the page is not open it does `hideAll()`, `boot.update(frame)`, `apply()` (and `runner.prime` once `canPrime`). The page is not called ready (`expectReady`) before the scene has built every actor and drawn twice. When the phase is `open` the scene is disposed and the sections take over in the next frame. A failure at any step (the chunk does not load, an actor throws) is logged once, the intro is skipped (`HomeBoot` calls `finishIntro()` at once when the scene is not `ready`) and the plain page opens: a handled failure, not a version. The scene warms the pair and the logo during the last frames of the loader (drawn once, unseen) so the first frame of the intro is not a hitch.

The stage is lifted over the loading screen with inline styles on `<main>` and the host, set once and removed once (never per frame, never on `<html>` or `<body>`), and given back when the screen unmounts, so the canvas never drops behind the ground for a frame.

## 6. Numbers to tune

`timeline.ts`: `duoBall` (the pair's size, capped by the room they have: the pair and the logo between them stay inside the screen from the moment they are in to the moment they pull, tested at ten window shapes), `stuckX` (where the logo hangs while they fight: 3 percent of the width left of the middle on a phone, up to 16 percent on a wide screen), `T` (every beat), `STRUGGLE`, `LIFT`, `TENSION` (the three curves of the carry, seconds since the pair began), `carriedWidth` (0.44 of the hero width), `duoBall` (0.15 H or 0.19 W) and `pullBall` (0.115 H or 0.15 W), `xStuck` (where the logo hangs while they fight), the bow positions (`duoA`, `duoB`), `snapGrow` overshoot, the cue times. `loader.ts`: `STILL_AFTER` 4 s, `QUARTERS`, the tricks, the gaps (4.2 to 7 s). `copy.ts`: `COMPANY`, `COMPANY_AFTER` 5, `COMPANY_EVERY` 4.5, the group patterns. `home-boot.module.css`: the sizes of the words, the 1.2 s fade of the dot grid. `runtime.ts`: `warmLeft` 4, the icon seconds.

## 7. END STATES (the joints)

Stage pixels, y up, origin at the middle of the screen, `H` and `W` the viewport.

**The press (t = 0, the loader's last frame).** Drone: visible, `loaderPlace(viewport)` (x 0, its lowest point 26 px above the mark's top, which `markTop(w)` gives: 47.5 px above the middle at 1440 wide, 36.8 at 390; height min(0.26 H, 0.46 W, what fits under the top edge), so 234 px at 1440 x 900, 179 at 390 x 844), face normal (or the one the loader is wearing), looking at the pointer. Pair: hidden. Logo: hidden. Marks: none. Field and sections: not run (primed only). Ground: the loading screen's own `#f4f6f9` with the 28 px dot grid (opacity 1). Nav: `hideControls` true, `hideLogo` true (with WebGL). Shell inert, scroll held, router claimed.

**The end of the intro (t = 13.2 = J0, the first frame of the open page).** Drone: x +0.30 W, y -0.22 H, height 0.17 H (`routeAt(0)` of `drone-route.ts`, equal to 1e-6 in `timeline.test.ts`), no pose, face normal, `look("pointer")`, interactive, layer back. Pair: hidden (`duo.visible = false`, ambient on again). Logo: visible, `heroRect` (centre x 0, `cy` of the hero rect, width 0.7 W, 0.86 W under 700 px), `place(rect, { roll 0, tension 1, wobble 0, wave 0.3 })`, morph P 0, not carried. Marks: whatever is still fading from the last bubble (a smile bubble is on screen at 12.2 to 13.1). Field: not drawn (the hero's entrance bursts the cards when the page opens). Ground: daybreak with the same dot grid, so removing the screen's ground changes nothing. Nav: `hideControls` false (the controls fade in over 420 ms), `hideLogo` true until the hero morphs the logo into the bar. Shell live, scroll free (at 0), `entered` set, router released.

Checked: the last frame of the intro and the page 0.6 s after it opens, at 1440 x 900, are the same picture; the only differences are the menu, the sound button, "01 HOME", the corner brackets and the lantern cursor. The drone in both: the same pixels.

## 8. How to look

Dev server `http://localhost:3100` (`apps/web`: `npx next dev -p 3100`). The probe plays the opening on purpose (it does NOT use `lib.cjs` `context()`, which turns it off):

```
BASE=http://localhost:3100 node scripts/qa/probes/home-boot.cjs <outFolder>
# env: SIZES="1440x900,1706x950,390x844", TIMES="0.5,1,...,13", STAGES=0 (skip the loader quarters), INTRO=0
```

It holds the waited media and lets them go in groups (the drone first), so the bar can be photographed at its quarters (`stage-<size>-<n>.png`), photographs the gate (`gate-<size>.png`), then presses the empty space, freezes the scene (`__home.freeze(true)`) and asks the scene for each time (`__homeBoot.seekIntro(t)`: the actors are run from 1.6 s before it, so the springs are where they would be; `intro-<size>-<t>.png`), and compares the end of the intro with joint J0 in numbers (`home-boot-<size>.json`). `window.__homeBoot` has `state()` (stage, phase, `introT`, `droneShown`, the drone, the pair, the logo, the intro's own state) and `seekIntro(t)`. `window.__home.skipIntro()` ends it. A real time run: press and `screenshot` while `__homeBoot.state().introT` grows. With `aspirants:intro = off` in `sessionStorage` none of this exists (`__homeBoot` is undefined).

## 9. Measured (dev server, real Chrome, the real GPU)

- Loader to the gate: 3 s with the local server (the real work: three chunks, the models, 4.6 MB). Intro frames at 1440 x 900: median 16.7 ms, p95 16.9 ms, 5 frames over 25 ms in 787 (the first intro frame 50 ms, the first marks 33 to 50 ms, the first section frame after the open 33 to 67 ms: the first draws of the pair, the marks and the hero; dev server).
- The tap: a press on the drone leaves the phase at `tap` (the drone answers with a heart bubble and a hop); a press on the empty space, Enter and Space go to `intro`; Escape and the Skip button end the intro in 0.8 s. A touch on the drone does not continue; a touch on the empty space does.
- No WebGL (`--disable-gpu`): `data-gl="off"`, the bar and the gate, the intro ends at once after the press, the page opens plain and the bar keeps its logo. No error.
- Offline during the load: the host's "Offline. Waiting for the connection. Loading goes on by itself when it is back. 67%, 4 MB received." with the drone sad; back online the page recovered by itself (the chunk guard reloaded once) and reached the gate.
- `aspirants:intro = off`: no `__homeBoot`, no `data-home-boot`, `main` has no z-index, actors logo, field and drone shown at once.

## 10. Not done, not verified

- A production build (none allowed to helpers): every timing is the dev server's. A real throttled link was not looked at on the build (the dev bundle is 9 MB and the throttle made the first 35 s about JavaScript). The ordering was proved with delayed files instead.
- The window resized in the middle of the intro was looked at (900 x 700, then 390 x 844, then 1440 x 900: the pair, the logo and the drone follow, no error); the tab hidden in the middle was not. Safari, Firefox, a real phone with real touch.
- At 390 wide the drone's place at J0 (x +0.30 W, 0.17 H tall, `drone-route.ts`, the lead's) puts its right wing past the screen edge when it is side on. The intro follows `routeAt(0)`, so changing the route (for example x 0.24 W under 700 px) moves the intro with it. During the pull the pair are partly off screen on a phone: the logo is 86 percent of the width then, and they hold its corners from outside.
- The corner brackets of the HUD appear in one frame at the open while the menu and the sound button fade in over 420 ms. A `data-hidden` on `HudFrame` from `useNavLock().hideControls` would make them fade too (two lines in `hud-frame.tsx` and `hud.module.css`, not mine).
- `hideLogo` is set for the whole opening and cleared only by the hero (`showNavLogo`) or the plain page. If a visitor opens the page part way down (not possible after a document load, which scrolls to 0) or the hero fails, the bar has no logo until the hero gives it.
- The sound cues use `audio.blip` (click, whoosh, star, confirm): they play only after the press unlocked the audio, and are silent when the site is muted.
- The intro's skip button is not in the design document; see section 3.
- Lighthouse and the axe pass on the home gate were done by workstream X on the placeholder; the bar, the button and the Skip here keep the same names and contrast (ink on `#f4f6f9`, text `#3b3f48` at least 7:1), but the pass was not repeated on this screen.
