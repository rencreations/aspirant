# Home: comic marks and trails (workstream FX2)

The shared comic marks (a bang over a drone, a vein on Silverbolt, notes out of a horn, air streaks past a falling doll) and the ribbon trails (the dragon's wing tips and tail, the drone's path). Every section and every actor asks for them in `mount` and fires and forgets. Code: `apps/web/src/features/home/fx/comic-marks/` and `fx/trail/`. Request words: "comic shock icon", "comic air-resistance marks", "comic music notes", "trails", "annoyed state". Style: ink `#0b0d12`, pink `#ff2d7a`, gold `#ffc14a`, white, a pale sky for water. Flat colour, a thick ink outline, a white cut line, a little squash and pop on spawn, then fade. No glow, no gradient clutter.

## 1. The API a section uses

```ts
import { ensureMarks } from "../../fx/comic-marks";
import { ensureTrails } from "../../fx/trail";

const marks = await ensureMarks(ctx);   // ctx: a SectionCtx or the lab's ActorCtx
const trails = await ensureTrails(ctx);

// one shot, fire and forget
marks.emit("bang", { at: droneSocket, size: 76 });               // an Object3D: follows it
marks.emit("question", { at: { x: 120, y: 80 } });               // a point in the stage's pixels
marks.emit("starburst", { at: marks.atClient(e.clientX, e.clientY), strength: 0.6 });

// a loop: set it every frame it should run
const air = marks.sustain("air", { at: doll.object, size: 120 });   // once, in mount
air.update(doll.object, intensity /* 0..1 */, directionRad?);       // every frame the doll falls
air.stop();                                                          // or just stop calling update

// a ribbon behind something that moves
const tail = trails.create({ colors: ["gold", "pink"], width: 18, life: 0.6 });
tail.track(silverbolt.socket("tailTip"));                            // every frame it is shown
```

`marksItems()` (`fx/comic-marks/preload.ts`) returns `[]`: every shape is drawn by the shader, nothing is loaded. Put it in a section's list only to be uniform. The code is part of the engine chunk. The marks and trails actors are built in about 10 ms (the shader programs are compiled at construction, so the first mark of the page never waits for the driver: build them in `mount`, which runs two screens early).

### `marks.emit(kind, options)`

| option     | meaning                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`       | required. `{ x, y }` in the stage's pixel frame (origin in the middle of the viewport, x right, y up) or an `Object3D` (projected every frame) |
| `camera`   | the camera that turns an Object3D into pixels. Default: found (see 3)                                                                          |
| `offset`   | `{ x, y }` pixels added to the anchor (screen space, y up)                                                                                     |
| `size`     | the height of the mark in CSS pixels. Default per kind (table below)                                                                           |
| `strength` | 0 to 1, default 1. How hard it happened: size from 60 to 100 percent of `size`, parts from 40 to 100 percent of `count`                        |
| `color`    | `"ink" "pink" "gold" "white" "sky" "bone"` or a hex number. A kind that mixes colours (stars, notes) uses one colour when given one            |
| `accent`   | the second colour (the core of a flash, the rays of a bang, the hash of a swear mark)                                                          |
| `rotation` | the tilt in radians. For `speed`, `air`, `steam`, `spark`, `beads`: the direction (a quarter turn, `Math.PI / 2`, is up)                       |
| `duration` | seconds. Default per kind                                                                                                                      |
| `count`    | parts of a burst, notes of a row. Default per kind                                                                                             |
| `seed`     | the same seed draws the same marks. Default: a counter, so repeats differ and a run is the same every time                                     |
| `follow`   | stay with the anchor every frame. Default: yes for an Object3D, no for a point                                                                 |
| `delay`    | seconds before the first part shows                                                                                                            |

An Object3D that is hidden (or has a hidden parent: the kernel hides an actor's root when no section shows it), or is behind a perspective camera, makes no mark, and marks that follow it are not drawn while it is hidden.

### `marks.sustain(kind, options?)` and the handle

`sustain` makes the handle and takes no slot. `handle.update(anchor, intensity = 1, direction?)` starts the loop (it takes one of 24 slots), moves it and sets its strength (0 is quiet, 1 is the kind's own rate). A loop that is not set for 0.12 s ends by itself and gives its slot back, like any actor the kernel hides: a section never has to remember to stop it. The next `update` starts it again (a dizzy loop makes its stars again). So make the handle once in `mount`, which runs about two screens before the section, and call `update` in the section's `update`: the handle is never dead, it costs nothing while it is not set (the marks pass stays idle), and a visitor who scrolls away and back gets the loop again. `handle.stop()` ends it now. What it made finishes by itself. With all 24 slots taken `update` does nothing until one frees. Loops: `sparkle heart note dust zzz speed air cloud beads steam`, and `dizzy` (four stars that orbit the anchor, held for as long as the loop runs, let go when it stops).

### `marks.atClient(x, y)`, `clear()`, `advance(seconds, tick?)`

`atClient` turns client pixels (the pointer, a DOM rectangle) into a stage point. `clear()` removes every mark and loop: call it at a joint where the scene changes by a jump. `advance` runs the simulation forward in sixtieths of a second (frame sheets and tests).

### The kinds

| kind        | what it is                                                                                | default size | life s | loop (per s) | use                                         |
| ----------- | ----------------------------------------------------------------------------------------- | -----------: | -----: | ------------ | ------------------------------------------- |
| `bang`      | exclamation with eight shock rays that grow, then shrink                                  |           76 |   1.15 |              | the drone shocked, a surprise, "found it"   |
| `question`  | question mark                                                                             |           70 |    1.4 |              | confusion (the two Guinevere drones)        |
| `sweat`     | one sweat drop that slides down (`count` of them in a row)                                |           26 |   0.95 |              | nervous, a long drag on the tail            |
| `vein`      | the anger vein: four arcs on a ring, a gap on each diagonal, throbs                       |           56 |   1.05 |              | annoyed                                     |
| `annoyed`   | the vein and two puffs of steam from the sides                                            |           64 |    1.3 |              | Silverbolt annoyed, Obsidia fuming          |
| `swear`     | a jagged shout bubble with a spiral, a bolt, an asterisk and a pink hash. Shakes          |           96 |    1.5 |              | the doll cursing in the mouth of Silverbolt |
| `spark`     | a ring of gold rays that fly out                                                          |           70 |   0.55 |              | a poke on the horns, a click                |
| `starburst` | gold, pink and white stars thrown out and falling                                         |           90 |   0.95 |              | a hit, a thank you                          |
| `dizzy`     | a ring of gold stars that orbit a point                                                   |           80 |    2.2 | held         | after a hard shake                          |
| `sparkle`   | a four point star with a white core                                                       |           44 |   0.95 | 3            | the gramophone, a hover                     |
| `heart`     | a heart that rises and sways                                                              |           42 |    1.4 | 1.6          | being petted                                |
| `note`      | a music note (four glyphs, pink, gold, white) that rises and sways                        |           46 |    1.8 | 2.4          | out of the speaker of the gramophone        |
| `dust`      | three grey puffs thrown sideways                                                          |           54 |    0.8 | 9            | a landing, a start of a run                 |
| `zzz`       | three Z of growing size                                                                   |           54 |    2.0 | 0.5          | asleep                                      |
| `speed`     | white streaks lying behind a mover (set `rotation` or `direction` to the way it goes)     |           60 |   0.34 | 16           | the chase                                   |
| `flash`     | a jagged impact burst with a white core                                                   |          150 |   0.34 |              | a hit, the eat in the funny section         |
| `air`       | air resistance: tapered streaks that stream past an object, fatter near it, thin far away |          120 |    0.5 | 26 (follows) | the falling doll (direction up)             |
| `cloud`     | one big soft cloud that rises and swells                                                  |          120 |    1.3 | 1.2          | a drone's sigh, smoke                       |
| `poof`      | a puff in the middle and a ring of seven that fly out                                     |          130 |    0.7 |              | an appearance, the doll lands               |
| `beads`     | a spray of sweat beads thrown up and falling                                              |           70 |    0.9 | 7            | panic, running                              |
| `steam`     | small puffs that jet out in the direction, swell and thin out                             |           34 |    0.9 | 4            | breath from a snout                         |

How a few things in the request are made: **the shock icon** is `bang` over the drone's head (`marks.emit("bang", { at: drone.object, offset: { x: 0, y: 70 } })`; the drone's own dialogue bubble icons are its own atlas and are not duplicated here). **Air resistance** is a `sustain("air", { at: doll })` with the direction up and the intensity from the fall speed. **Music notes** from the speaker are a `sustain("note", { at: speakerSocket })`. **The annoyed state** of Silverbolt is `annoyed` for a burst, `vein` over the forehead, `steam` from the snout and `sweat`.

### Silverbolt's events to marks

`actors/silverbolt/marks.ts` says when a mark belongs and at which socket. The section turns an event into a call (no code of mine knows Silverbolt):

| event `kind` | call                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| `sparks`     | `emit("spark", { at, strength })`                                                         |
| `smoke`      | `emit("steam", { at, rotation: noseDirection, strength })` every few tenths of a second   |
| `vein`       | `emit("vein", { at, strength })`                                                          |
| `sweat`      | `emit("sweat", { at, strength })`                                                         |
| `stars`      | `emit("starburst", { at })` for a hit, or a `sustain("dizzy")` while the head is spinning |
| `gust`       | `emit("speed", { at, rotation: windDirection })`                                          |
| `puff`       | `emit("poof", { at, strength })`                                                          |
| `heart`      | `emit("heart", { at, strength })`                                                         |
| `chomp`      | `emit("flash", { at, size: 80 })` and `emit("spark", { at, size: 50 })`                   |

### Trails: `trails.create(options)` and `handle.track(anchor, offsetX?, offsetY?)`

`create` options: `colors` (the gradient from the head to the tail, default gold then pink), `width` (at the head, default 16), `life` (seconds a point lives, so how long the tail is at a given speed, default 0.6; `length` is accepted as the same thing, the name the request used), `taper` (1 is a straight taper to a point, above 1 is fatter near the head), `fade` (the opacity falloff exponent, default 1.2), `alpha` (peak, default 0.9), `minDist` (a point is remembered after this many pixels, default 3), `jump` (a step of the anchor bigger than this in one frame cuts the tail, default 360), `camera` (like the marks). `width`, `life`, `alpha`, `taper`, `fade` can be changed on the handle at any time. Make a trail once in `mount` and call `track` every frame it should run; it takes one of 12 slots while it has something to draw and gives it back when the tail has faded. A frame without `track` leaves the tail where it is and it dissolves from the head side, so hiding the actor needs no code. `handle.cut()` forgets the tail now (you moved the anchor on purpose). The ribbon is always attached to the live anchor (no lag, no gap), has a round head, and a point that is behind the camera or hidden cuts the tail.

**Speed streaks for the chase** are the `speed` kind as a sustain on the runner (`sustain("speed", { at: runner, direction: 0, size: 70 })`, `update(runner, speed / topSpeed)`), not a ribbon: the streaks stay where they are made and the runner leaves them behind, which is what a speed line does. Pair it with `dust` at the feet and a gold and pink `trail` on the runner.

## 2. How it works

```
comic-marks/
  kinds.ts     the 21 kinds and their defaults (KIND_INFO), the shape numbers the shader branches on (PRIM)
  recipes.ts   one function per kind: it puts a few `Mark` parts on the stage (pure, seeded, no allocation)
  mark.ts      Mark (plain numbers), MarkPool (fixed 512, three draw layers, recycles the oldest), AnchorRef
  system.ts    MarkSystem: emit, sustain, step(dt) -> the buffer. No GPU, no three code: all of it is tested
  math.ts      hash (no Math.random), easeOutBack, the envelope (pop, squash, fade), pixel frames
  palette.ts   the named colours
  anchor.ts    StageProjector: Object3D to pixels, through the camera the picture was drawn with
  pass.ts      StepPass: a shared pixel pass that steps its own simulation as the first thing in its draw
  shader.ts    the one vertex and fragment shader (SDF shapes)
  marks.ts     MarksActor: the instanced mesh in the pass, emit, sustain, advance, clear
  lab.ts       window.__home.lab("marks")
trail/
  ring.ts      TrailHistory: a ring of (x, y, time)
  ribbon.ts    pure: width and opacity profiles, gradient, writeRibbon (the triangle strip, the round cap)
  system.ts    TrailSystem: slots, sampling, jumps, the vertices
  shader.ts    soft edges and a lifted core
  actor.ts     TrailsActor: one dynamic mesh, one draw call
```

**One draw call.** The marks are one `InstancedBufferGeometry` of a quad with an interleaved instance buffer (20 floats a mark: position, size, rotation, scale and squash, opacity, shape, life, seed, parameter, aspect, fill and accent colours, variant, outline). Every shape is a signed distance function in the fragment shader: a white cut line, an ink outline (2 to 6 CSS pixels, growing with the size), the flat fill, a flat shade or a highlight where the shape wants one. The anti-aliasing band is one DEVICE pixel (`uDpr` is `stage.dpr`), so edges are crisp at pixel ratio 2. The cut line is invisible on the daybreak ground (the paper is white) and keeps a mark readable on the storm ground, where the ink vanishes. Streaks have no cut line.

**The pass steps itself.** `StepPass extends ScenePass`, so `stage.scenePass("marks", ...)` finds it by name. Its `render` first calls `system.step(frame.dt)`, then draws. Two consequences. The marks are after every actor's `update` in the frame, so a mark that follows a socket is on it with no lag. And the clock is the stage's: a frozen scene (`dt` 0) freezes the marks. The pass is active only while a mark or a loop is alive: an idle page pays nothing, and the stage clears the canvas when nothing is active. Nobody must call `stage.scenePass("marks")` or `("trails")` before `ensureMarks` or `ensureTrails` (the ensure throws if the name is taken).

**Life of a mark.** `envelopeAt`: a pop (`easeOutBack`, overshoot per kind) with a squash that is tall at the start, wide at the bottom and settles, then a fade over the last `fadeT` seconds with a small shrink. Motion per mark: velocity, gravity, drag, sway, spin, throb, wobble, grow, or an orbit (the dizzy stars, smaller on the far side). Parts are in three draw layers (behind, middle, front) and the newest is on top. The pool holds 512 parts; when it is full the oldest part of the furthest back layer is recycled, so a burst that is too big loses its oldest parts and never throws.

**Which camera an Object3D is projected through** (`anchor.ts`). The anchor is walked up to its root `Scene` and matched against the shared passes: `cast` (perspective, 30), `perspective` (20), `ortho` (10). For the cast the camera is `getCast(stage).view()`: the cast can be drawn through a baked camera for one frame (`cast.setCamera`: the fall follows the doll and zooms, the selena close ups), and a mark must be placed by the camera the picture was drawn with. This needed one additive line in `actors/shared/cast.ts` (see section 5). A camera can also be forced with the `camera` option. An object in no shared scene (an actor with its own pass: the drone's `drone` and `drone-front`) is taken to stand in the pixel frame already (x and y are the pixels): for those, pass a point (`{ x, y }`) or the camera.

**The trail.** The history is in the stage's pixels: a ring of 40 points with times, filled through the same projector. A point is remembered when the anchor has moved `minDist` pixels and at least `life / 38` seconds have passed (so the ring holds the whole life at 60 Hz and at 240 Hz). The ribbon is built on the CPU each frame into one preallocated buffer (12 trails by 43 vertex pairs): the round cap (two rows), the live head, then the points from the newest to the oldest. The tangent at a point is taken from its two neighbours and a zero length step keeps the last tangent, so a trail that has not moved, a U-turn and a trail through the same spot twice are all finite (tested). Width and opacity both fall to nothing at the end of the life, so the tail never ends in a cut. The fragment shader softens the two edges and lifts the middle a third of the way to white. A jump (the anchor moves more than `jump` pixels in one frame, a scrollbar drag) cuts the tail, so no streak crosses the screen. No sampling while `dt` is 0.

**Pass order, stated.**

| order | pass          | what                                                                    |
| ----: | ------------- | ----------------------------------------------------------------------- |
|    10 | `ortho`       | flat things (the hero card, the picture field)                          |
|    12 | `trails`      | the ribbons (this workstream): behind everything that makes them        |
|    15 | `logo`        | the logo                                                                |
|    20 | `perspective` | `drone` and the duo                                                     |
|    30 | `cast`        | the lit characters                                                      |
|    35 | `drone-front` | the drone's front layer                                                 |
|    40 | `marks`       | the comic marks (this workstream): above everything drawn in the canvas |

The marks top the canvas but can never go over the text DOM (z 3 above the canvas), so a mark that is meant to cover a title must be placed where the title is not.

## 3. Things to know when you use them

- A mark that does not follow (a point, or `follow: false`) stays at its screen pixels. A scroll jump (a scrollbar drag, a probe seek) does not move it, so call `marks.clear()` in a section's `enter` if its marks must not survive a jump.
- Make the loops in `mount` and call `update` in the section's `update`. A section that no longer runs stops calling and its loops go quiet after 0.12 s, and start again at the next `update` (tested, and seen in the page: a loop made 1.5 s before its first `update` starts, goes quiet 3.5 s after the last one, and starts again).
- `emit` with an Object3D makes one small object (the anchor's reference) per call. That is fine for an event. Anything that repeats every frame must be a `sustain`, which allocates nothing per frame.
- Keep the sizes honest: a mark is in CSS pixels, so a 76 px bang is 76 px on a phone too. Scale `size` by the actor's on-screen height (`height * 0.4`) rather than by a constant when the actor is big or small.
- `size`, `count` and `duration` change how a kind reads, but the defaults were looked at on daybreak and storm; change them only with a sheet in front of you.
- Colours: the named colours are the site's. A hex number for a one-off (a blue splash) is fine.
- Context loss: nothing is held outside three's own tracking, so no `rebuild` is needed. A stage rebuild makes a new renderer, and the programs compile again at the first draw after it (a one-off hitch). Looked at with `WEBGL_lose_context`: after lose and restore the marks and a trail draw again.

## 4. The numbers measured (dev server, real Chrome, the real GPU, 1440 x 900)

| what                                                        | value                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| a step of the simulation and the upload, 130 live parts     | 0.009 to 0.023 ms (three runs)                                                      |
| the same, 268 live parts                                    | 0.013 to 0.034 ms                                                                   |
| the same, the pool full (512)                               | 0.03 to 0.036 ms                                                                    |
| `stage.draw` with the marks pass, 268 parts, GPU waited for | 0.02 to 0.05 ms, averaged over 300 frames                                           |
| frame time with nothing alive                               | 16.67 ms average (vsync), 25 ms at the 95th percentile (noise from the step before) |
| frame time with the pool full (512 live parts)              | 16.67 ms average, 17.1 ms at the 95th percentile, 17.3 ms max                       |
| 12 trails: a step, then a whole `stage.draw`                | 0.029 ms, 0.042 ms (1 trail: 0.006 ms, 0.016 ms)                                    |
| first mark of the page, after the actor stood 2 s           | no hitch (the longest frame 17 ms)                                                  |
| first mark, emitted at once after the actor was built       | one 400 ms frame: the driver finishing the shader link                              |

The budget of 1.5 ms is met by a wide margin. The one cost to know is the shader link: build the actors in `mount` (two screens early) and it is gone by the time a mark is used. If a section emits a mark in the same frame it builds the actor, the first frame takes about 400 ms in this browser.

## 5. Edits in shared files

`actors/shared/cast.ts`: `Cast.view(): Camera`, the camera this frame's draw uses (a baked camera or the pixel camera). One line in the interface, one method in the object, one type import. Nothing else of the file was changed by hand, but I ran `prettier --write` on the whole file (it was failing the format check with the working copy's other editor's line endings; now `prettier --check` passes). The other lines of the diff in that file (`setCamera`, `clipOnce`) are another workstream's. `kernel/lab.ts`: the `marks` line was already there from the first run and was checked, not edited.

## 6. How to look at it (the lab)

`window.__home.lab("marks")` returns a `MarksLab` (it is pinned shown, like any lab actor): `emit`, `sustain`, `trail`, `marks`, `trails`, plus

- `gallery({ age, fraction?, size?, kinds?, columns?, loops? })`: every kind on a grid at one age (`fraction` reads `age` as the part of each kind's own life, `loops` runs the loopable kinds as loops for `age` seconds). Returns where each cell is, in stage and client pixels, for labels. Freeze the scene first (`__home.freeze(true)`).
- `trailDemos([{ path, options, until }], seconds)`: ribbons along paths, then held where they ended (re-tracked every frame so a frozen frame keeps the head).
- `castDemo(true, shift)`: a blue square in the cast and a sparkle loop on it, with the cast drawn through a camera moved by `shift`. The sparkle must stay on the square.
- `bench(n, frames)`: `n` long lived emissions, timed (step, and a whole `stage.draw` with the GPU waited for). `benchTrails(n, frames)`: the same for `n` trails on circles.
- `release()`: clear everything the lab started.

Scripts (not in the repo, in `D:\ren\aspirant-work\home\FX2\`): `sheet.cjs emit|loops|trails|bench` (contact sheets with labels, on the daybreak and the storm ground, `W H DPR BG AGES SIZE KINDS COLS`), `live.cjs` (the cast camera, a mover with a trail and streaks in real time, frame times with 200 live marks, a resize in the middle), `loss.cjs` (lost and restored context). The sheets hide the page's text layers and the bar with a style tag and seek to the middle of "funny" (daybreak) or "fall" (storm), where no stub mesh is drawn.

Unit tests: `fx/comic-marks/*.test.ts` (hash, easing, envelope, pool, every kind's recipe, the system with a fake projector, the projector with real cameras, the kinds table, the palette) and `fx/trail/*.test.ts` (the ring, the profiles, the ribbon strip, the system).

## 7. Not verified

- A real phone and touch. The 390 x 844 sheet was taken at pixel ratio 2 in desktop Chrome.
- Firefox and Safari. The shader uses plain GLSL 1.0 style (three converts it) and no extension.
- The production build (the numbers are the dev server's). The marks are cheap enough that this should only help.
- A real GPU reset (it was simulated with `WEBGL_lose_context`).
- Anything with the real actors: Silverbolt's sockets, the doll's mouth, the gramophone's speaker and the drone's own passes were not in the tree when this was made. The calls above are the plan; the cast camera path was proved with the lab's blue square, not with a character.
- The trails with the dragon: the colours, widths and lives in the examples are a start, to be tuned on the dragon in the strip section.
- The shader link warning `X4122` printed once by the Windows driver comes from three's own program for the lab's blue square (a basic material in the cast), not from these shaders (a page with the marks and trails and no blue square logs nothing).

## 8. Cut or left for later

- A trail kept in world space (the history is in screen pixels, so a camera that moves while the anchor stands still draws the move as a trail: right for a fly by, to be revisited if a section wants a trail across a camera move).
- A crisp, flat ribbon style with an ink outline (the ribbons are soft on purpose).
- An adapter from Silverbolt's `MarkEvent` (the table in section 1 is the plan).
- Marks for the drone's own passes by name (a point works).
