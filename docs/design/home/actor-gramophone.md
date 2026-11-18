# Actor GR: the gramophone and the records (18 Nov 2026)

The music section's two lit props in the home's one renderer: the gramophone (the model of workstream M2) and a record crate with a vinyl disc made in code. Code: `apps/web/src/features/home/actors/gramophone/` and `.../records/`. Recon: `docs/design/home-reference/assets-doll-gramophone.md` (section 2), `docs/design/home/models-doll-gramophone.md`. Both draw in the shared cast pass (`getCast(stage)`, order 30) with the cast's one environment.

## 1. What is there

- **Gramophone** (`actor name "gramophone"`, `gramophone.glb` 789 KB, 15.8k triangles, one material). Crank you can turn with the pointer, a platter tied to the crank through a gear and a flywheel, a tonearm that lifts and lowers with a small bounce, sockets for gloves, a record and the notes. Brass and wood take the cast's environment at 0.8.
- **Records** (`actor name "records"`, no file). A wooden crate (rounded boards, canvas wood grain, a brass plate), up to 12 sleeves with the covers of the music room, one vinyl disc (96 segment disc with a spindle hole, groove shader, a paper label with the cover). Hover flips through, a press picks, one disc travels crate, hand, platter.
- Not here, by design: audio (the section plays the track, see 5), the notes (marks workstream; `bellMouth` gives the point and the direction), the drones (the duo actor holds the glove and cranks).

## 2. The gramophone API

```ts
import { ensureGramophone } from "../../actors/gramophone";        // lazy: (await import(...)).ensureGramophone(ctx)
import { gramophoneItems } from "../../actors/gramophone/preload";  // chunk + model, deferred (priority 45) by default
import type { GramophoneActor } from "../../actors/gramophone/actor";

const g = await ensureGramophone(ctx);
g.visible = true;                         // every frame it is shown (the kernel hides it otherwise)
g.place({ x, y, z, height, yaw?, pitch? });    // applied at once. x, y: screen point of the cabinet's axis at mid height. height: on-screen height of the box.
g.setCrankSpeed(1.8);                     // turns a second, positive = clockwise on the screen. Persistent. 0 coasts to a stop.
g.driveCrank(duo.crankAngle("b"));        // OR give the angle every frame (a drone counts the turn); null gives it back
g.setCrankAngle(a);                       // one shot: put it there and stop (lab, a still)
g.setNeedle(true);                        // lower onto the record (false lifts). Eases, bounces once, then rests.
g.onNeedleLand = (speed) => { /* a click for the audio, degrees per second */ };
g.interactive = false;                    // lock the crank under the pointer
// read:
g.turning  g.crankRps  g.platterRps  g.needleDown  g.needleLift (0 down .. 1 up)  g.crankAngle  g.hot
g.socket("crankHandle" | "recordSeat" | "needleTip" | "bellMouth" | "elbow" | "dragFront" | "dragBack" | "dragSide"): Object3D
g.recordSeat; g.recordApproach            // the node a record lies on, and the gramophone's own non spinning frame
g.bellMouth(out)                          // { x, y, z, dx, dy, dz, r }: mouth centre in stage px, direction on the screen (unit), how much it points at the camera, radius in px
```

- **Defaults.** `place` starts from `PRESENT_VIEW` (yaw 3.6, pitch 0.5): the horn up at the left facing left and the camera, the whole platter and the crank in view, as in the owner's screenshot. The rig's own yaw is 3.84 (`PRESENT_YAW`); at that yaw the bell comes forward and covers half the platter, so the default is turned 0.24 toward the screen. The pitch (tip toward the camera about the screen's X axis) is what shows the platter. The needle starts lifted.
- **Persistent setters.** `setCrankSpeed`, `driveCrank` and `setNeedle` hold until changed, so a section sets them every frame it shows the actor and a lab script sets them once.
- **Hand on the crank.** Cursor "TURN" over the handle and the arm. A press starts a turn: the pointer's angle is found in the crank's own plane (the 2x2 inverse of where its two axes land on the screen), so the direction is right at any yaw and the handle stays under the pointer. The angle follows with a short ease, the speed is read from it. Let go and it coasts (`CRANK_DOWN_RATE` 1.4 a second) toward `setCrankSpeed` (0 stops it). The drag keeps going when the pointer leaves the handle (it reads the pointer state, not `move`), and ends when the pointer is up. Edge on (the plane's determinant near zero) a vertical drag turns it. A hand wins over `driveCrank` while it is there.
- **Platter.** `GEAR` 0.3 turns per crank turn (2 turns a second of crank is 36 rpm), at most 78 rpm, speeds up at 3 a second and runs down at 0.55 a second (a flywheel). The record spins with it (it is a child of the seat).
- **Tonearm.** A lift of 50 degrees about (0.38, 0, 0.93) on the `soundbox` node; the lift is a spring (up: critical, omega 9; down: omega 15, zeta 0.5) that never goes below 0 and rebounds with 28 percent of its speed when it lands, so it ticks down once or twice. A landing faster than 18 degrees a second calls `onNeedleLand`.
- **Rock.** The cabinet rocks 0.006 rad with the crank's turn (twice a turn), scaled by the crank speed. Tune `ROCK`.
- **Sockets.** `dragFront` is the +X face under the horn, `dragBack` the -X face, `dragSide` the -Z (crank) face on the side away from the crank. `crankHandle` rides on the crank, `needleTip` on the soundbox, `recordSeat` on the platter. `recordApproach` is the gramophone's frame (does not spin): a record is slid in from its -Z side.

## 3. The records API

```ts
import { ensureRecords } from "../../actors/records";
import { recordsItems } from "../../actors/records/preload";   // chunk + music.json + the first N covers, deferred (priority 46)

const r = await ensureRecords(ctx);
const tracks = await r.useMusic(10);     // the first 10 tracks of the music room with a cover. Returns TrackArt[]: id, title, kind, ep, cover, color, audio, dur
// or r.setTracks(tracks)                 // up to 12; covers come from the loading list's cache
r.visible = true;
r.place({ x, y, z, height | width, yaw?, pitch? = 0.25, roll? });   // x, y: middle of the crate with its sleeves. width fits a phone.
r.onPick = (index) => { ... };           // a press on a sleeve (cursor "PICK"). The section decides.
r.interactive = false;                   // the sleeves go quiet
r.pick(i);                               // sleeve rises, the disc slides out and flies to the hand (target 1)
r.setHandSocket(duo.anchor("a", "L"));   // the glove the disc hangs from (rim at the node). null: above the crate
r.putOn(g);                              // carry to the platter and lay it on it (target 2). Takes anything with { recordSeat, recordApproach? }
r.putBack();                             // home again (target 0), the same path in reverse
r.handScale = 1;                         // size in the hand, a multiple of the crate's scale
// read:
r.phase ("idle" | "picking" | "held" | "placing" | "seated" | "returning")  r.selected (index | null)  r.hoveredIndex  r.count  r.tracks  r.size ({ width, height } in metres)
r.socket("carryL" | "carryR" | "front" | "disc"): Object3D
```

- **Targets, not events.** `pick`, `putOn` and `putBack` set where the disc is going. `p` moves along crate (0), hand (1), platter (2) at 1.7 s for the pick and 1.3 s for the putting on; every pose is a pure function of `p`, so a change of mind turns back along the same path. Asking for another sleeve while one is out brings the first home, then takes the second. A section stateless in the scroll may set the targets every frame. The first frame after the actor was hidden (a gap in the frame numbers) snaps `p` to the target: a jump never plays the journey.
- **The path.** Segment A: the sleeve rises 0.28 m and turns toward the viewer (0 to 0.3), the disc slides out of it (0.3 to 0.55), flies on an arc to the hand while the sleeve goes back into its slot (0.55 to 1). Segment B: from the hand on an arc to a place beside the platter on the crank's side, turning flat on the way, then it slides in at the platter's height and lands (the horn hangs 4 cm over the platter, so a disc cannot be dropped on it from above). At p = 2 the disc becomes a child of `recordSeat` with an identity transform and spins with the platter. The disc is scaled between the crate's scale and the platter's on the way, so it does not pop when the two are at different sizes.
- **Keep the records visible while a disc is in flight** (it is drawn with the crate). Once seated it belongs to the gramophone and shows with it even when the records actor is hidden.
- **The flip through.** A hovered sleeve comes up 8.5 cm and 15 cm forward, turns from 54 to 11 degrees toward the viewer and shows its whole cover; its neighbours part by 8 cm. The focus is a float (it slides between sleeves), the reveal is a damped 0 to 1. At rest every sleeve is turned the same way and shows a strip (6 cm step). A press calls `onPick`; no record is picked by the actor itself. While a disc is out the sleeves are not choices.
- **Hit testing.** Each sleeve is its middle line projected to the screen once a frame (a capsule), 12 targets are registered once; `test` reads the cache. The hovered sleeve has a larger radius and a depth bias, so the ones it parts from do not steal it back.
- **Cover art.** Library covers are 720 px squares; the five `site` covers are 16 by 9 splash arts, cropped to their middle square by the texture's offset and repeat (`coverCrop`). The bitmaps are made with `imageOrientation: "flipY"` and the texture has `flipY = false` (a bitmap is uploaded as it is). A cover the server says is gone gives that sleeve a plain colour.
- **The vinyl** (`vinyl.ts`). The standard material of the cast with three additions in `onBeforeCompile`: rings every 1.6 mm that fade with the pixel size (`fwidth`), smooth gaps at radii 0.081, 0.103, 0.121, a smooth run-out and lead-in, a little dust, and the sheen: a Kajiya-Kay term from the groove's tangent (in object space, so it follows the grooves) and the half vector of the light and the view, for the cast's key and fill. The highlight stays with the light while the disc turns. The disc's bottom face is at y 0 and its top at 4 mm, so on the seat (y 0.1475) the needle tip (0.152) touches it.
- **Crate** (`crate.ts`, `layout.ts`). The width grows with the count (0.83 m for 7, 1.13 m for 12), the depth is 0.34 m, the front board is 8.5 cm, the back 20 cm.

## 4. The loading list

```ts
gramophoneItems({ deferred?, priority? })   // chunk "home-gramophone" + media gramophone.glb (788,884 B)
recordsItems({ count?, deferred?, priority? })   // chunk "home-records" + data music.json + one item "records-covers:N" (the covers, bytes in the bar)
```

Both are `deferred` by default (the section is far down). The covers item fetches `music.json`, picks the first N with a cover, fetches the pictures whole with the bytes reported and keeps them decoded in a module cache; `useMusic` / `setTracks` read from it, or fetch (a visit that never ran the list still works). Seven tracks have covers today, about 0.5 MB. Both imports are light (`@/lib/*` only, no three, no React), so they are safe in the list that every page bundles.

## 5. How a section uses them (the music section)

```ts
// mount
const g = await ensureGramophone(ctx); const r = await ensureRecords(ctx); const tracks = await r.useMusic(10);
let choice: number | null = null; r.onPick = (i) => { choice = i; };
// every frame it is shown
g.visible = r.visible = true;
g.place({ ... }); r.place({ ... });                       // pull-in by the drones: place x from off screen to its spot; hold the scroll with ctx.scroll.hold()
if (choice !== null) {
  r.pick(choice); r.setHandSocket(duo.anchor("a", "L"));    // the drone that brings the crate takes the disc
  if (r.phase === "held") r.putOn(g);
}
if (r.phase === "seated") {                                // the other drone cranks, the needle goes down, the music starts
  g.setNeedle(true);
  duo.crank("b", g.socket("crankHandle"), { speed: 1.6 });
  g.driveCrank(duo.crankAngle("b"));
  if (g.needleDown && g.platterRps > 0.3 && !playing) { ctx.audio.playMusic(tracks[choice].audio, { loop: false, volume: 0.5, fadeMs: 1200 }); playing = true; }
  if (playing) { g.bellMouth(view); /* a note comes out at (view.x, view.y) going (view.dx, view.dy) */ }
}
// leave (J11): fade out, lift the needle, let the crank stop, put the disc back
ctx.audio.stopMusic(600); g.setNeedle(false); g.driveCrank(null); g.setCrankSpeed(0); duo.release("b"); r.putBack();
```

`audio.playMusic(url, options)` and `audio.stopMusic(fadeMs)` are the engine's (`lib/audio.ts`); the about page's disc store (`features/about/sections/phase/music-store.ts`) is the pattern for following the site's sound switch. Start the song only when the needle is down and the platter is up to speed, and stop it as the platter slows (`platterRps`), so the sound follows the machine.

## 6. Numbers to tune

`gramophone/spin.ts`: `GEAR`, `PLATTER_MAX_OMEGA`, the rates (`CRANK_UP_RATE` 5, `CRANK_DOWN_RATE` 1.4, `PLATTER_UP_RATE` 3, `PLATTER_DOWN_RATE` 0.55), the arm springs (`ARM_UP`, `ARM_DOWN`), `RESTITUTION` 0.28, `IMPACT_MIN` 18. `gramophone/actor.ts`: `ROCK`, `HANDLE_HIT_M` 0.05, `ARM_HIT_M` 0.03, `MIN_HIT_PX` 16, `MAX_HELD_OMEGA`. `gramophone/facts.ts`: `PRESENT_VIEW`. `records/layout.ts`: `STEP` 0.06, `REST_YAW` 0.95, `GAP` 0.08, `LIFT` 0.085, `FORWARD` 0.15, `FOCUS_YAW` 0.2, `REST_LEAN` -0.1, the crate's board heights. `records/journey.ts`: `SEG_A_SECONDS`, `SEG_B_SECONDS`, the phase windows in `phasesAt`, `LEG_SPLIT`. `records/actor.ts`: `HELD_AT`, `HELD_YAW`, `APPROACH` (0, 0.045, -0.3), the arc heights. `records/vinyl.ts`: the groove radii, the sheen powers (150 and 100) and weights (0.3, 0.1), the base colour and environment (0.32).

## 7. Looking at it (the lab)

`window.__home.lab("gramophone")` and `lab("records")` (two lines in `kernel/lab.ts`) give the real actors shown and pinned. Scripts are in `D:\ren\aspirant-work\home\GR\` (not in the repo): `first.cjs` (one shot), `sheet2.cjs` (yaw and pitch), `close2.cjs` (the crank at four angles, close), `seq1.cjs` and `seq3.cjs` (hover, pick and put on, stepping `r.p` while frozen), `point1.cjs` (real mouse: hover, press, crank drag, release), `sock1.cjs` (every socket drawn as a dot), `phone1.cjs` (390 x 844 with touch and a resize round trip), `duo2.cjs` (the real duo holding the disc and cranking), `ten1.cjs` (12 sleeves), `life1.cjs` (frame times, unpin, dispose). Recipe: `await window.__home.lab("gramophone")`, `place`, `window.__home.freeze(true)`, shoot. A frozen frame has `dt` 0, so springs do not move: set `r.p` or the crank angle directly to hold a pose, unfreeze to let a spring run.

## 8. Measured

- `update` is 0.05 ms (gramophone) and 0.035 ms (records) on this machine (the lab's exponential mean `cost`). Nothing is allocated per frame (scratch vectors at module level). With both visible and the platter turning the page runs at 16.7 ms a frame (the display's 60 Hz; the draw is 15.8k triangles for the gramophone and under 5k for the rest, one cast pass).
- Real mouse in Chrome: hover finds `record-4`, a press calls `onPick(4)`, the pointer over the handle finds `gramophone-crank` (cursor "TURN"), a drag of 1.5 turns follows the pointer to 9.37 of 9.42 radians, release coasts (0.37, 0.18, 0.09, 0.04 turns a second at half second steps) while the platter keeps turning. A touch tap on a sleeve calls `onPick`. After `unpin` the objects are hidden and a pointer over the handle finds nothing. `dispose` leaves no error.
- Units: 76 tests in 7 files beside the code (`facts.test.ts` reads `gramophone-rig.json` and fails when a number drifts).

## 9. Calls made without the owner

- **Seven sleeves, not ten.** `music.json` has seven tracks and all seven have a cover; `useMusic(10)` returns seven. The crate takes up to twelve. Five of the seven covers are the splash arts of the characters (16 by 9), cropped to their middle square.
- The default view is yaw 3.6 and pitch 0.5, not the rig's 3.84 (see 2).
- The crate is a bin with the sleeves turned 54 degrees (cover flow in a box), not records edge on: edge on, no cover shows.
- The disc is slid in from the crank's side, not dropped (the horn is 4 cm over the platter).
- The label shows the cover (a circle of the middle square), not the printed disc face of the music room.
- No bounce on the sleeves and no sound: the click is an event (`onNeedleLand`), the audio is the section's.
- `place`'s `x, y` are screen points (like Silverbolt's), not world coordinates; `z` only changes the size and the parallax.

## 10. Not verified, not done

- Firefox and Safari; a real phone's touch (the tap was a Chrome emulation); a weak machine; the production build (the dev server's numbers).
- Context loss: both actors hold no GPU object outside three's own tracking (textures are canvas and bitmap textures that three uploads again; the environment is the cast's). Not run against a real reset.
- The flip through under a touch (no hover): a tap goes straight to `onPick`.
- Hovering from the side at a strong `yaw` of the crate (more than about 0.6 rad) was not looked at: the sleeves' hit lines are projected, so it should hold, but the boards hide more of the covers.
- The section that uses them does not exist yet: the drone hand-offs, the scroll lock and the music notes were exercised with stand-ins (a dummy node and the real duo in the lab), not in the page's scroll.
- Not edited: `public/models/home/gramophone.glb` and its rig (no change needed). Edits to shared files: `kernel/lab.ts`, two lines (`gramophone`, `records`).
- Knip: the public methods that no section calls yet are not flagged (it follows the lab's dynamic import); nothing else exported is unused.
