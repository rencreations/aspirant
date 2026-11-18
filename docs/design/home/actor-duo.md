# Actor DU: the duo, Guinevere's two drones (18 Nov 2026)

Both drones in the home's one renderer, unlit, with /about's art and its face shader. Code: `apps/web/src/features/home/actors/duo/`. Recon: `docs/design/home-reference/about-engine.md` (section 3). Names used below: `a` is the bold one (slanted eyes, a crooked dash), `b` the soft one (round eyes, a cat's mouth).

## 1. What is there

The model is `/models/about/companion.glb` (241 KB, one mesh for both, shared with /about's saved copy): ball, two ears, two floating gloves. `a` and `b` differ by their face, their motion and the tone of their marks (pink, ink), as in /about. Drawn in the shared `perspective` pass (order 20): above the logo (15), under the lit cast (30) and the marks (40), so a drone's glove is in front of the logo it holds and Silverbolt passes in front of the pair. `b` stands 14 px nearer the camera than `a` (their own `z`: 0 and 14), so when they overlap `b` is in front.

Files: `actor.ts` (three: the six shapes per drone, the shader, sockets, hits, the clock), `goals.ts` (pure: what each pose asks of one drone), `follow.ts` (pure: springs, attitude from speed, snap, blink, face change), `reactions.ts` (pure: the one-shots, the ambient scheduler), `face.ts` (the SDF faces, 22 of them), `pose.ts`, `curves.ts`, `hit.ts`, `carry-script.ts`, `marks-map.ts`, `preload.ts`, `index.ts`. The engine is plain arithmetic in front of the three part: 107 unit tests in 10 files beside the code.

## 2. The API a section uses

```ts
import { ensureDuo, type DuoActor } from "../../actors/duo";   // lazy: (await import("../../actors/duo")).ensureDuo(ctx)
import { duoItems } from "../../actors/duo/preload";           // the loading list (deferred by default)
import { carryScript } from "../../actors/duo/carry-script";   // the opening's struggle, as numbers
import { comicMark } from "../../actors/duo/marks-map";

const duo = await ensureDuo(ctx);          // ctx: the section's own context
// every frame the duo is shown (the kernel hides it otherwise):
duo.visible = true;
duo.place({ x, y, height, roll? }, { x, y, height, roll? });   // each drone: ball middle, ball DIAMETER in CSS px (stage frame, y up)
duo.pose("float" | "dance" | "stare" | "confused" | "question" | "wave" | "bow" | "leave", w = 1, { target?, dirs? });
duo.carry(payload | null, { x, y, width, tension, struggle, lift });   // both hold a payload between them
duo.pull(payload | null, { cx, cy, w, h, strain });                    // a: bottom left corner, b: top right
duo.crank("a" | "b", handleObject, { speed });   duo.crankAngle(who);  // turns a second; the angle to give the machine
duo.haul("a" | "b", handleObject, { dir?, strain? });                  // drag by a handle
duo.release(who);                                // end a crank or a haul
duo.face(who, name | null, blend = 1);           // hold a face over the pose's (22 names)
duo.react("spin" | "flex" | "jabs" | "hop" | "hello" | "shy" | "giggle" | "wink" | "dizzy" | "bump" | "cheer", who?);
duo.blink(who?);  duo.restart();  duo.ambient(on);
duo.anchor(who, "L" | "R"): Object3D             // a node that follows a glove ("L" is on the RIGHT of the screen when it faces us)
duo.attach(obj, who, hand);  duo.detach(obj);    // objects of the duo's own pass, world transform kept
duo.pin(obj, who, hand);     duo.unpin(obj);     // objects of another PERSPECTIVE pass (the lit cast): copied from the glove each frame
duo.gloveAt(who, hand, out): { x, y }            // the glove on the screen (stage px), for anything flat
duo.setMarkSink((m: DuoMark) => ...);            // the comic cues; comicMark(m) says which mark they are
duo.update(frame)                                // may be called by a section early in a frame to read this frame's gloves: the kernel's own call is then a no-op
duo.makeCard(w, h, colour): Mesh                 // a flat stand-in (the lab carries one)
duo.advance(seconds), duo.state()                // probes
```

Rules a section must know.

- **It sets the state every frame**, never plays an event. A pose has a weight `w` (0 to 1: how much of it; for `leave` the progress, 0 at their places and 1 gone; for `bow` the depth). A `crank` or a `haul` of one drone stays until `release` and goes over the pair's pose.
- **`height` is the ball's diameter** (the figure the owner sees as "the drone's size"); gloves and ears reach about 1.7 radii beyond it. `y` up, origin in the middle of the screen, as the whole stage.
- **A jump snaps.** A place that moves more than 40 percent of the larger side of the screen in one frame (`isJump`) puts the springs at their goals, so a scrollbar drag leaves nothing flying. A hidden gap of more than two frames does the same.
- **The pose clock** is the duo's own (`restart()` sets it to 0, so a dance starts on its first phrase). Moves and the ambient life run on it.
- **A payload with no parent** is put in the duo's pass for the carry and taken out again when the duo stops carrying it (`pose`, or another payload). A payload that already lives in another pass is moved on the screen by the duo, which is not what the logo wants: for the logo pass `null` and call `logo.carryBetween(duo.gloveAt("a", "L", p), duo.gloveAt("b", "R", q))` after `duo.update(frame)` (see the opening below).

## 3. The poses and what they are for

Every goal is the float (bob, sway, ears, loose gloves, a look at the pointer when it is within 9 radii, else now at the other one, the target, the visitor) with the pose written over it. The sine and hump curves start and end at rest, so a pose blends in and out with `w` and the springs do the rest.

| Call                    | What happens                                                                                                                                                                                                                                                                                                                                                     | Owner's scene                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `float`                 | the idle, plus the ambient life (every 6 to 12 s one hops, giggles, winks, hides or flexes and the other often answers 0.45 to 0.85 s later)                                                                                                                                                                                                                     | voices, any rest                                |
| `dance`                 | a loop of 12 s on a half-second beat: four phrases of 3 s. 1 a sway that mirrors, 2 a turn round each other (each goes round their middle and comes back), 3 a fist bump in the middle with a wind-up and a strike (spark, lines, star), 4 a spin each, opposite ways, with a hop. Each phrase starts and ends at rest, the loop has no seam (a test holds that) | voices ("float, dance together with chemistry") |
| `stare` + `target`      | side by side, face kept to the visitor (the turn is at most about 0.6 radians), eyes on the target, `wide` face, a faint tremble, almost no blink                                                                                                                                                                                                                | funny: watching Silverbolt cross                |
| `confused` (+ `target`) | exaggerated: one eye big and tilted, one small, one brow up and one down, a wavy mouth, heads tilting against each other; one scratches its head while the other shrugs and they swap every 6 s; a "?" every 1.9 s, sweat drops; the faces cycle `confused`, `befuddled` (spirals). With no target the eyes search the room                                      | funny: the first confusion, then the middle     |
| `question`              | face each other; one speaks (a glove out, a tilt, a "?") while the other shrugs worried, they swap every 2.2 s                                                                                                                                                                                                                                                   | funny: "what was that?"                         |
| `wave`, `bow`           | a wave to the visitor with the outer glove; a bow (the face goes down, the gloves come forward) with the `thanks` face                                                                                                                                                                                                                                           | the opening's thanks                            |
| `leave` + `dirs`        | crouch, then zip along each drone's direction (default outward from the other) with ears and gloves streaming, to beyond the edge. At `w = 1` both are off the screen for any direction (tested)                                                                                                                                                                 | the opening's exit, music's exit                |
| `carry`                 | see 4                                                                                                                                                                                                                                                                                                                                                            | the opening, the crate                          |
| `pull`                  | see 4                                                                                                                                                                                                                                                                                                                                                            | the opening: the logo grows                     |
| `crank`, `haul`         | see 4                                                                                                                                                                                                                                                                                                                                                            | music: the crank, dragging the gramophone       |

The one-shots (`react`) all start and end at rest (a test walks every one at t = 0 and t = its length). A press or a hover starts them by itself, see 5. `restart()` forgets them.

## 4. The work: carry, pull, crank, haul

**Carry.** `carry(payload, { x, y, width, tension, struggle, lift })`: the payload's middle (stage px) and width. `a` holds the left end with the glove on the right of the screen, `b` the right end. The balls stand outside the ends, a reach away (`carryReach(tension)`, 1.72 to 2.22 radii), placed so that **the glove lands exactly on the end** whatever the ball's roll and yaw (tested to 1e-6; `pin.cjs` measured the pinned gloves of the pull and the crank on their targets to the pixel). `tension` (0 to 1) is how taut it holds, `struggle` (0 to 1) how hard it works (they bob against each other, tremble, one end sags more than the other and they trade, the free glove flails, ears splay), `lift` (-1 to 1) how high (it moves the ends; a fall of the lift over a frame is a jolt with a bang and speed lines, a rise is a heave with a spark). Faces by cost: `bold`/`soft`, `effort` (above 0.35), `strain` (above 0.75, flushed), `worry` (a sag, `a`) and `surprise` (a sag, `b`). Sweat drops and veins appear on their own.

`carry-script.ts` is the opening's struggle as three numbers over time: `carryScript(t, help)` with `t` the seconds since they began and `help` (0 to 1, the normal drone coming to lift): they manage, it gets heavy, they heave, they drop it at about 2.45 s (the lift falls to -0.7), try again, hold on tired; with help the strain goes out of their faces and the logo rises. A section may use it or write its own.

```ts
const s = carryScript(t, help);
duo.carry(null, { x: logoX, y: logoY, width: logoW, ...s });
duo.update(frame); // settle this frame's gloves
logo.carryBetween(duo.gloveAt("a", "L", pa), duo.gloveAt("b", "R", pb), { tension: s.tension });
```

**Pull.** `pull(payload, { cx, cy, w, h, strain })`: the section grows the rectangle (the logo's), `a` holds the bottom left corner and `b` the top right with the glove that faces the payload, the body outside the corner on the diagonal, leaning back and tugging; the glove is pinned to the corner (`hard`: no lag) as far as an arm reaches (3.4 radii), so when the rectangle outgrows the arms the hand stops short and the body is pulled in by the springs. For "the logo covers 70 percent of the screen" the section should keep `height` big enough (about 150 px at 1440 x 900 reaches a 760 x 270 rectangle; measured).

**Crank.** `crank(who, handle, { speed })`: `handle` is any Object3D whose world position is a point of the stage frame (the gramophone's `anchor_crank_handle`). The glove is pinned to its screen point; the body rocks with each turn (`crankAngle(who)` grows by 2 pi times `speed` a second: give it to the machine's crank so the handle and the glove agree), leans and puffs more as it goes faster (faces `glad`, `squeeze`, `effort` at 0.7 and 1.2 turns a second). The other glove stays out of the face.

**Haul.** `haul(who, handle, { dir, strain })`: the drone flies ahead of the handle along `dir` (a unit vector from the handle to the drone), glove pinned to it, leaning into the pull and bobbing with each step the load makes (the speed is read from the handle). The section moves the load.

## 5. Interaction

Hit targets `duo-a` and `duo-b` are three discs each (the ball at 1.25 radii, each glove at 0.8), tested by the kernel every frame, nearest first; cost: a few subtractions. The site's cursor says `SPAR` over `a` and `HELLO` over `b`. A DOM control always wins (the kernel).

- **Hover**: `a` squares up (glad, gloves up, bigger by 7 percent), `b` shrinks behind its gloves (shy, a tilt); both greet once (`hello`, at most every 4 s). The pointer within 9 radii also makes the eyes follow it.
- **Press**: a different answer each press, in order. `a`: spin, flex, two jabs, hop. `b`: giggle, hide its face, wink, hop. Both pressed within 2.6 s: a fist bump (3.2 s). Four presses on one within 2.4 s: dizzy, then a sulk (`fume` for `a`, `pout` for `b`).
- They react to each other: while one makes a gesture (spin, flex, hop, hello, shy, dizzy, bump, cheer) the other looks at it.
- While carrying, pulling or leaving a press is only a spark: there is no time for a game.
- Touch: a press finds its target at the press, there is no hover (the kernel's rule).

## 6. The faces (`face.ts`)

/about's twelve (`bold soft bars happy glad angry wide dizzy love squeeze flat shy`) and ten for an exaggerated performance: `confused`, `befuddled`, `effort`, `strain`, `surprise`, `smug`, `annoyed`, `joy`, `thanks`, `worry`. New in the shader: a lid, a slant, a size, a turn and a height for **each eye on its own**, a **brow** over each eye (height, slant, bow), two drawings for the eye (a ring with a dot, a four pointed sparkle), four mouths (wave, frown, bared teeth, wide smile). A face is about 55 numbers; any face blends into any other (0.16 s), and one that is a different drawing (`faceDistance` above 0.5) is changed behind a blink (0.2 s). Blinks come by themselves, unevenly, and are skipped for symbol eyes. `face(who, name, blend)` holds one over the pose's. The brows are kept on the glass (they flatten at its top; `browY` is the height over the eye). Checked at 120 px and at 640 px tall (contact sheets in the lab, below): every face reads at both; at 120 px the brows are thin lines of about 2 px.

## 7. The numbers to tune

- `goals.ts`: `HOME` (the glove's rest, 1.72, -0.42, 0.4 radii: /about's own), `floatGoal` (bob 0.14 and 0.17 radii, sway), `PHRASE` 3 s and the beat 0.5 s (the loop is 24 beats), `MAX_REACH` 3.4, `carryReach`, `GRIP_Y` and `GRIP_Z` (where a glove holds an end), the yaw amounts in `stare` (0.3 plus a look turn of 0.45), `confused` (0.3 and 0.6) and `question` (0.25 and 0.6): above about 0.9 radians in all the face turns side-on and stops reading.
- `follow.ts`: omegas (ball 7 to 14, yaw and pitch 13, roll 15 with 0.5, radius 10, squash 26 with 0.45, ears 24 with 0.32, gloves 17 with 0.55 or 40 and 1 when pinned), `JUMP` 0.4.
- `reactions.ts`: `SECONDS`, `ANSWERS`, `DIZZY_PRESSES` 4 in `DIZZY_WINDOW` 2.4 s, `TOGETHER` 2.6 s, the ambient wait (6 to 12 s) and its chance of an answer (65 percent).
- `actor.ts`: `OUTLINE_PX` 1.15 (the ink line, as /about), `SIGHT` 9 radii, the discs 1.25 and 0.8, the first ambient move at 5 s.
- `carry-script.ts`: the three key lists.
- `face.ts`: every number of every face; `top` 0.37 in `cBrow` is where the glass ends over the eye.

## 8. Looking at it (the lab)

`window.__home.lab("duo")` (the line is in `kernel/lab.ts`) builds the real actor in the real renderer, pinned shown, and returns it. Scripts: `D:\ren\aspirant-work\home\DU\` (`lib.cjs` opens the page with the intro off, consent rejected and the page's own DOM hidden; `scen.cjs <names> [W H]` runs the scenarios and writes one picture per step; `sheet2.py` makes the contact sheets; `interact.cjs` uses the real pointer; `perf.cjs`, `jump.cjs` (snap and resize), `loss.cjs` (context loss), `dispose.cjs`, `pin.cjs`, `marks.cjs` (the cues in the real marks), `faces2.cjs`). The recipe:

```js
const d = await window.__home.lab("duo");
window.__home.freeze(true);
d.restart();
d.ambient(false);
d.place({ x: -220, y: 0, height: 240 }, { x: 220, y: 0, height: 240 });
d.pose("confused"); // or d.carry(d.makeCard(360, 110, 0xff2d8f), { x: 0, y: 0, width: 360, tension: 1, struggle: 1, lift: 0.3 })
d.advance(2.4); // runs the duo's own clock, no draw; then screenshot
```

Run before screenshots: `d.face(who, name)`, `d.states[i].blinkAt = 99` (no blink in a still). Drive `d.carry`, `d.pull` and the others every step of a sequence, as a section does.

## 9. Measured

Chrome (real GPU), dev server, 1440 x 900, dpr 1: `update` 0.016 to 0.026 ms a frame (both poses measured), a draw synced with the GPU 0.38 ms, update plus draw 0.39 ms (budget 1.5 ms). 22 draw calls, 13,652 triangles, 4 programs, 1 texture (the 512 x 512 paint, shared by both), 7 geometries. Nothing is allocated in a frame (vectors, quaternions and the uniform arrays are reused; a test checks that `packFace` writes into the same arrays). Context loss: lost and restored, and lost then rebuilt by the stage: the duo draws again with no code of its own (it holds nothing outside three's tracking, so it has no `rebuild`). Dispose then ensure again: works (the geometry counts are the same). Resize in the middle (1440 x 900 to 390 x 844): the stage follows, the places stay where the section put them, the hit test follows.

## 10. Calls I made without the owner

1. `place` is the ball's diameter (the drones' "height" in the request is how big they look).
2. `carry` and `pull` take the payload's rectangle and put the drones round it; `place` is what they use when nothing else is asked. The owner's "the payload is an Object3D the section supplies": a payload with no parent is moved by the duo, the logo is moved by its own actor from the gloves' positions (the logo's own note says never to move its root).
3. The duo is in the `perspective` pass at order 20, not the flat pass: the drones need depth (a glove comes toward the camera, the spin, the bump) and still land on the pixel (the scene undoes the perspective: `place` is where the ball is on the screen at any `z`).
4. The soft one is not smaller. Sizes are the section's.
5. The ambient life is on by default in `float`. `ambient(false)` turns it off.
6. `duoItems()` is deferred by default (priority 30), like the doll's. The opening asks for `{ deferred: false }`.
7. The second drone is not recoloured or mirrored: the file's two sources are one mesh and one paint, as in /about. They differ by face, motion and tone.
8. The dance is a loop of 12 s (four phrases of 3 s on a beat of 0.5 s), changed from 12.8 s while testing so that the loop has no seam in its beat.

## 11. Edits to shared files

None. `kernel/lab.ts` already had the line `duo: async (ctx) => (await import("../actors/duo")).ensureDuo(ctx)` (written by the earlier run); the module it imports exists and compiles. Nothing else outside `actors/duo/` and this note was touched.

## 12. Not done, not verified

- **The scenes themselves.** No section uses the duo yet. The carry with the real logo actor (`carryBetween`), the pull with the logo growing, the gramophone's real crank handle and the vinyl crate on a glove, Silverbolt crossing while they stare: the API is there and measured on stand-ins (cards, an empty handle) but not run against the real objects.
- **Pinning to the lit cast.** `pin` was checked against a plain card in a pass called `cast` (it lands on `gloveAt` exactly), not against a real model in the real cast pass. Flat (ortho) passes cannot be pinned: use `gloveAt`.
- Firefox, Safari, a real phone with touch, a weak machine, the production build (all numbers are the dev server's), more than two hours of running (the ambient scheduler and the springs were run for 40 simulated seconds and for the length of the scripts).
- 390 x 844: the poses and the carry were drawn at that size (they work), but the sheet used the desktop spacing, so the pair did not fit the narrow screen. The section places them: a phone wants `height` about 100 and places 80 px either side of the middle.
- The comic marks were looked at in the real marks (question marks, sweat, sparks and speed lines at a bump) on the daybreak ground, not on the storm ground.
- Reading `a` and `b` apart at 120 px tall is mostly by the faces (bold slants, soft is round): they are the same shape and colour by design.
