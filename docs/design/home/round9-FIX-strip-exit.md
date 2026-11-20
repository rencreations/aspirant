# Round nine, FIX-strip-exit (20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-9-request.md`, the first paragraph: in the "Official animations for The Aspirants" exit the scroll seems to stop in the middle, and the video should keep moving at one speed with the scroll.

## 1. Where the stop was

Recorded with a real wheel (`mouse.wheel`, 100 px every 30 ms, 1440 by 900, dev server, real Chrome) with a per frame log of the real scroll, the scene's scroll `S`, the zone progress, `plays()` and `snap()` (scripts in `D:\aspirant-work\home\FIX-strip-exit\`, `rec.cjs`, `gaps.cjs`).

- **The kernel is clear.** In the exit `play` is null, the zone's progress rises linearly with the scroll, `scrub.blocked` is `input` or `outside`, the joint snap reads `zone`. No hold, no snap, no dead range in the mapping. Nothing in `kernel/` was touched.
- **The real stop is a freeze of the page for 0.4 to 5 s** at y 11.5 to 11.65 (exit progress 0.4 to 0.6, scene scroll 11.48), the frame in which the drone and the doll are first drawn (the descent's lead starts at 11.45). Long animation frames: one frame of 4353 ms in the home loop. The profile: `getProgramInfoLog` 2.4 s inside `WebGLRenderer.render` of the drone. `renderer.compile` (the doll's `warm`, the drone's `warmGuest`) only STARTS a link on the driver's thread. The first draw asks for the result and waits for it on the main thread. `doll_skin` (the long toon face program, 48 KB of source) was linked at 5.8 s and had not finished at 8.3 s, so the first draw blocked for 2.9 s. While the page is frozen the wheel events queue, and the page then jumps: this is what the owner reads as "it stopped the scroll". A warm shader cache shortens it (458 ms in one run), a cold one does not.
- **The fly-off law was also lumpy** (`fx/video-plane/flyoff.ts`, measured with `model2.cjs` on the pure functions): the trailer, the big video, could not start before `f` 0.5 (`STAGGER` 0.5 and the tail first), so for half the exit it only drifted LEFT (the orbit's turn went on through the exit, -739 px per screen at f 0.05) and then shot off at 6150 px per screen; every item rode a smootherstep (slow, fast, slow); the depth recede (`FLY_DEPTH`) slowed the picture on the screen toward the end; the route was made from a base that kept turning, so the nearest line could change in the middle of a flight; and the yaw (up to two full turns) kept the trailer edge on, a dark sliver, for much of the exit.

## 2. What changed

1. **The pair is handed over only when its programs have finished linking** (`actors/buddies/programs-ready.ts`, used in `ensureBuddies`). `programsReady(renderer)` polls three's own `program.isReady()` (the driver's completion flag) of every program the renderer has made, every 40 ms, and gives up after 30 s (a lost context). The descent's `setPair` runs when `ensureBuddies` resolves, so the first draw never waits. No actor file and no descent file was edited, so it does not touch the other helpers' work. Trade-off: on a very fast first scroll on a cold cache the pair arrives late (the previews still fly off, so the screen is not empty) instead of freezing the page.
2. **One steady flight** (`flyoff.ts`):
   - every item moves from the first pixel; the leader (the trailer) leaves first and the tail of the train up to `STAGGER` 0.12 later (it was 0.5, the other way round);
   - the item walks its path BY LENGTH (a table of 96 cuts per route, `ARC_STEPS`; `routeAt` finds the point at `steady(u) * total`), so the join onto the line and the bend of the line no longer make it slow and fast. `steady(u)` is linear with a 4 percent ease in and out (`EASE_EDGE`), continuous in the speed. The ride ends where the item is clear of the screen (`Route.total`, from a clearance test), so no scroll is spent on a picture nobody sees; all items are done at `f` = 1;
   - no recede in depth (`z` stays), the shrink and the spiral follow the same steady progress;
   - the yaw is capped under a quarter turn (`0.2 + 0.25 * seed` of a half turn; the roll stays), so the big video stays a picture while it moves.
3. **The orbit's turn** (`strip/journey.ts`, `travelAt`): steady with the scroll through the rest, slowing to a stop over the 0.3 screens before the exit (a rest, so nothing has to keep a speed), still in the exit. The actor's clock drift is held while `fly > 0` (`video-plane/actor.ts`), so the routes are made from a base that does not move and the line an item rides cannot change in a flight. Tests: `travelAt` rates (2.1, 1.05, 0 at the exit's start, still through the exit).

## 3. Looked at

- **Speed per item over its ride** (pure functions, `model2.cjs`, the min and max of the speed on the screen, with the first and last 6 percent left out): at 1440 by 900 the ratio is 1.04 to 1.08 for all eleven items, at 390 by 844 1.05 to 1.08 (it was infinite: items stood still, and 9 to 360 for the trailer). The speeds differ BETWEEN items (the trailer about 520 px per screen of scroll, the tail previews up to 1400): each is constant. 11 items are on screen to f 0.7, 10 at 0.8, 5 at 0.9, 0 at 1.0.
- **Frames** every 0.1 of the exit (a seek, then frozen): `shots/sheet_b_1440.png`, `sheet_b_390.png`. The previews and the trailer slide to the lower right as cards that stay readable, the words go out in the first 0.3, the pair come in from the top at 0.6 and settle by 1.0. `sheet_new_1440.png` (the first version, with the old yaw) shows the edge on slivers that the yaw cap removed.
- **Real wheel, down and up, with stops** (`stops.cjs`): stops at exit progress 0.02, 0.32, 0.44, 0.49, 0.99, down and up, 1440 and 390: no move for 3.5 s (deviation 0.0000 screens), `scrub.blocked` `free` or `outside`, `moving` never true. No jump.
- **The stall:** `progs.cjs` (hooks `linkProgram` and `getProgramInfoLog`): after the change the longest `getProgramInfoLog` in the exit is 50 ms (`doll_skin`, was 2927 to 3050 ms), `loaf.cjs` / `rec.cjs`: no frame gap over 100 ms between y 11.0 and 12.05 (it was 458, 3076 and 4766 ms).
- Tests: `fx/video-plane/flyoff.test.ts` (14 passed; the stagger, depth and spiral tests were rewritten, new tests for `steady` and for the constant speed of the walk). `sections/strip/journey.test.ts` has the new `travelAt` test, written and checked with `travel.cjs` (the numbers), not run under vitest (one file only). `scene.test.ts` was read, not run: its fly cases (fly 1 leaves nothing, the joints, the 400 step walk under 6 percent of the width) hold by the numbers above. `tsc --noEmit -p apps/web` is clean for `video-plane`, `sections/strip`, `buddies` and `descent`.

## 4. Numbers to tune

`flyoff.ts`: `STAGGER` 0.12, `EASE_EDGE` 0.04, `JOIN_END` 0.6, `ARC_STEPS` 96, the clear radius `margin * 0.55` in `setupRoute`, the yaw `0.2 + 0.25 * seed`, the fade `0.85` to 1. `journey.ts`: `TRAVEL_TAPER` 0.3. `programs-ready.ts`: `GIVE_UP_MS` 30000, `POLL_MS` 40.

## 5. Calls made without the owner

- "The same speed" is read as a constant speed for each item over the whole exit, not one speed for all: a common speed would send the trailer (a short way to the edge) off in a third of the exit.
- The descent's lead (0.6 screens) is unchanged, so the pair come in at exit progress 0.4 to 0.6 while the cards are all still on screen. The screen has moving cards from the first pixel to about 0.9 and the pair after, so there is no screen where nothing moves.
- The yaw cap changes how the spiral looks (cards tilt and roll, they no longer turn edge on).

## 6. Not done, not verified

- The production build, a real trackpad or touch fling, Firefox, Safari. The shader link time on the owner's machine in production is not measured: the gate only guarantees that the first draw never waits.
- After the exit, at rest at y 12.36, one frame of 968 ms in one run and one of 221 ms at y 12.1 in another (the later builds of the list and Selena and the pair's first draw). Not traced; outside the exit.
- A visitor who reaches the descent before the pair's programs are linked (a cold cache, a seek) sees no pair until they are. If that shows in practice, start `ensureBuddies` earlier than the 3 s idle wait in `descent/runtime.ts` (that file belongs to the descent helper in this round).
- The strip's own drone and the pair both compile their toon programs: the pair's compile could be started when the strip mounts to leave more time.
