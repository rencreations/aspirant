# Round six: the descent, and what the list and the pair agree on (DESC-descent, 20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-6-request.md`. This note is the CONTRACT between three helpers (DESC-descent, ORYZO-characters, BUDDY-actor). Poll it; the numbers below are the ones the code reads.

## 1. The page now

`hero, aspirants, rows, strip, descent, list, selena, voices, music, funny, chase, bend, archive, footer`. The sections `bolt`, `fall` and `hand` are gone. The new section `descent` has NO plays: it follows the scroll over its whole range, so the joint snap keeps out of it (`kernel/snap.ts`: a section with no plays blocks the joints that touch it), and the strip's exit has no snap (round five). The strip to descent to list passage is one plain scroll.

## 2. Numbers (all in `sections/descent/stations.ts`, pure, no imports: read them from there)

| name              | value | meaning                                                                                         |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `DESCENT_LEAD`    | 0.6   | screens before the descent's start in which it already runs: the strip's exit (film flying off) |
| `DESCENT_SCREENS` | 5.0   | the descent's length. `local` 0 to 1 runs over it                                               |
| `LIST_LEAD`       | 1.6   | the list's lead. The list's `lead` in `index.ts` MUST be this number                            |
| `LIST_RISE_FROM`  | -1.6  | the list's rise starts here, in screens from the list's start (same number, negative)           |

The list starts where the descent ends. So during the LAST 1.6 screens of the descent the list is in its lead: its `update(local, frame)` gets `local < 0` and `screensIn = local * listScreens` runs from -1.6 to 0.

## 3. What the list does (ORYZO)

- In its lead the list's content (heading, the filmstrip, the hint) is placed BELOW the screen and RISES with the scroll: `rise = clamp((screensIn + LIST_LEAD) / LIST_LEAD)`, a translateY from the screen height to 0 (any gentle easing of `rise`, but it must be exactly 0 offset at `rise = 1` and move the whole time: the visitor scrolls and sees the section come up from the bottom). Scrolling up puts it back down. Transform only.
- The list's ground is the plain daybreak paper in its lead (no backdrop kind of its own over the descent: the descent has none either).
- The pair is NOT touched by the list while `local < 0`. From `local >= 0` the list's runtime calls the J8 helper below (section 5) once a frame; before the growth it does nothing with the pair (the pair is docked and alive by itself).
- The pair is drawn IN FRONT of the filmstrip if the filmstrip pictures are in the section's `below` layer (under the canvas); text layer content is drawn over the pair. The layout keeps the dock's corner clear and lets the pair pass over the strip on purpose (the descent's last frames).

## 4. What the descent does (DESC)

- `u` = screens from the descent's start, `-0.6` to `5.0`. The pair (the normal drone with the doll on its head) comes in from above the top edge at about `u = -0.4` (the strip's exit at 0.2 of its last screen, three or four previews still on screen), small, while the film and the ten previews are still flying to the lower right; the previews are gone at `u = -0.1`, so the screen is never empty.
- From there it dances and descends slowly, scroll linked both ways. `descent/route.ts` gives the drone's place `{x, y, height}` and `descent` (how much they fly down) for `u`. The dance is BUDDY's `show` (twelve routines, about 104 beats) mapped to the scroll from `u = -0.35` to `4.55` (`runtime.ts`: a beat is made from the scroll and a little from the clock, so the pair never freeze). A move lasts about half a screen, the slow spiral three quarters, and the last one (cheer) is the climax as the list is nearly up. From `u = 4.55` they stop dancing and settle into the dock's life. At `u = 5.0` they are at the DOCK.
- The dock (the contract): drone place, stage pixels (origin in the middle, y up), the same frame as `drone.place`:
  - wide screen: `x = +0.385 W`, `y = -0.27 H`, drone height `0.14 H`; the doll sits on its head, so the pair is about `0.24 H` tall;
  - portrait (`w < 0.75 h`): `x = +0.24 W`, `y = -0.32 H`, drone height `0.09 H`.
  - `dockPlace(vp, out)` is exported by `descent/dock.ts`. The drone grows on the way down, 0.085 H at the entrance to 0.165 H in the middle, and comes back to 0.14 H at the dock (a wing reaches about 1.2 drone heights to the side: the stops keep it inside the screen, a test holds it).
- The descent's `update` does the pair's per frame writes through BUDDY's API (`docs/design/home/actor-buddies.md`).

## 5. The J8 joint (the end of the list), written by DESC in `sections/list/pair.ts`

ORYZO calls it; DESC writes it. API (pure inputs, one call a frame while the list runs and `local >= 0`):

```ts
// sections/list/pair.ts
export function createListPair(ctx: SectionCtx): ListPair; // async build is handled inside; safe before the actors exist
interface ListPair {
  /**
   * grow: 0..1, the growth of Selena's frame into the screen (0 until it begins).
   * edgeY: the frame's top edge in CSS px from the top of the screen (its `grown.y`); the doll is
   *        lifted to this edge while the frame rises, then takes hold of the top of the screen.
   * Before `grow > 0` it only keeps the pair at the dock (calling it every frame is harmless).
   */
  step(grow: number, edgeY: number, frame: FrameInfo): void;
  dispose(): void;
}
```

`grow` must reach exactly 1 at the end of the growth and the list must call `step` for the whole of `local >= 0` (it keeps the dock). The selena section's first frame (`sections/selena/hang.ts`, DESC) draws the doll hanging by one hand from `dollHang(vp)`, which is `grow = 1`: the two agree. The drone leaves to the upper right during the growth and is hidden when `grow = 1`.

## 6. What changed (done and looked at)

Deleted: `sections/bolt`, `sections/fall`, `sections/hand` (folders, with their tests), their ids in `SECTION_IDS`, the registry and `views.ts`, the copy `BOLT`, `FALL`, `HAND` and `PAIRS` in `content.ts` (and the tests of them), `actors/hand` (the hand actor: nothing else used it; `public/models/home/hand.glb`, `scripts/home/models/hand.mjs` and the "hand" row of `scripts/home/models/build.mjs` are left for the cleanup pass), the probes `scripts/qa/probes/home-s3.cjs` and `home-s4a.cjs`, and the e2e home spec's references. Silverbolt's actor stays for the selena, funny and chase scenes.

Moved: the pure helpers selena and the list took from `hand/` are `sections/vp.ts` (`Vp`, `isPortrait`, `seg`, `smooth`, `mix`, `clamp01`) and `sections/idle.ts` (`whenIdle`). The doll's hanging pose at the start of the Selena section was the end of the old carry: it is `sections/selena/hang.ts` now (`hangDoll`, and `holdDoll` for the blend the list's end uses). Nothing imports a deleted folder. The old carry, its timeline and its faces went with the hand; the doll's riding code stays in the doll actor (BUDDY generalised it).

New: `sections/descent/` (`index.ts` with no plays, `stations.ts`, `route.ts` and its test, `dock.ts`, `runtime.ts`, `view.tsx`, `streaks.ts`, `descent.module.css`, `preload.ts`) and `sections/list/pair.ts` (J8).

- **The registry:** strip (4.75), descent (5.0, lead 0.6), list (ORYZO's, lead 1.6), selena, and on. The page is 58.3 screens.
- **The wind.** The descent's `below` layer holds 32 fixed pieces (streaks, dots, soft clouds as radial gradients, no filter) that rush up faster than the page scrolls (1.2 to 3.1 screens up for one of scroll), written as transform and opacity from `u`. They come in over the first half screen and fade as the list rises. They are what makes it read as a fall.
- **The strip's drone.** The route ends in the pull of the strip (the drone leaves to the upper right, `routeEnd`). The strip does nothing to the drone after that (`driveDrone` returns when the route has ended), so its tail (0.6 screens, it runs into the descent) never fights the pair. The pair are shown from `u = -0.58`. No drone on screen between the two, never two at once (looked at: the strip frames at S 8.6 and 9.5 have the drone, 10.4 to 11.2 none, and the descent frames have only the pair).
- **J8** (`list/pair.ts`, called by the list as `step(b.expand, edge, frame)`). Grow 0 to 0.04: the pair stay at the dock. 0.04 to 0.5: the drone flies from the dock to the point under the top edge at the doll's hang x with her on its head, and grows to 0.17 H. 0.5 to 0.78: she lets go (`pair.mode("apart")`), stands and takes hold of the edge on a small hop, her size going to the hang's. 0.58 to 0.97: the drone leaves to the upper right. At 1 she is the picture `hangDoll` draws. Going back she is put on the drone's head again.

### Looked at (dev server, real Chrome with the GPU, consent rejected, intro off)

- 1440x900 frames by `__home.seek`: the strip exit every 0.1 screen (S 11.3 to 12.1): the previews fly off to the lower right, the pair come in from the top left at S 11.7 and 11.85 with three or four previews still there, none left at 12.0. Descent frames from S 12.05 to 17.05 (twirl, sway, the side view of the spiral, the pair growing, the clouds and streaks); the list rising from the bottom from S 15.45 while the pair still fall, the dock at 17.05. J8 frames at S 25.0 to 26.6 (every 0.05 from 25.9): the lift, the let go, the hang, the drone off at the top right; and 26.95 and 27.4 (the room starts from the same hang).
- 390x844 frames at S 11.9, 12.5, 13.5, 14.5, 15.6, 16.4, 17.05, 26.2: the compact route, the dock at the bottom right, no wing cut.
- A real wheel (`mouse.wheel`, 120 px every 24 ms) from S 10.6 down to 31.7 (the voices) and back up to 9.4 at 1440x900 and at 390x844: no stuck place, no dead scroll, no console error (the only warning is a stale stylesheet preload, not ours).
- Tests run: `sections/descent/route.test.ts` (13), `home-page.test.tsx`, `content.test.ts`, `preload-items.test.ts`, `kernel/where.test.ts`, `kernel/snap-registry.test.ts`. Two numbers followed the deleted sections and were changed: the count of `data-home-content` (15 to 13) and the hand model in the deferred list. `tsc --noEmit -p apps/web` is clean.

### Numbers to tune

`stations.ts`: `DESCENT_SCREENS` 5.0, `DESCENT_LEAD` 0.6, `LIST_LEAD` 1.6. `route.ts`: the two stop tables (x, y, drone height as fractions of the screen). `dock.ts`: the dock. `runtime.ts`: `SHOW_FROM_U`, `SHOW_TO_U`, `SETTLE_U`, `BPM`, `CLOCK_BEATS`. `streaks.ts`: counts, sizes, speeds, alphas. `list/pair.ts`: `LIFT`, `GRAB`, `LEAVE`, `LIFT_HEIGHT`.

### Calls made without the owner

- The descent has no plays and no words: a plain scroll linked passage. The strip's exit has no snap, and the joint snap treats a section without plays as blocked, so the strip to descent to list passage never snaps.
- The drone grows to 0.165 H in the middle and comes back to the dock's 0.14 H: more readable than a pair that is only 0.1 H on a 1440 screen.
- The doll's size at the end of J8 is the old `dollHang` height (0.165 H): she grows to it as she takes hold, as if the drone had brought her close to the lens.
- The pair stay "shown" through the whole growth (the pair steps the doll while she is free); the drone is simply off the top right at the end.

### Not done, not verified

- The dances were looked at in frames, not in motion. A scrub back and forth was walked with the wheel but not judged frame by frame.
- Touch scrolling of the descent, Firefox, Safari, the production build and a weak GPU were not looked at.
- The drone enters under the logo at the top and passes behind the top bar for a moment (the bar's text layer is over the canvas).
- `round4-SEC-bolt-fall.md`, `section-bolt-fall.md`, `section-hand-list.md`, `round5-L1.md`, `actor-hand.md` and the notes of the hand and the carry describe sections that no longer exist: history for the cleanup pass.
