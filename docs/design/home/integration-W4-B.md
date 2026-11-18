# Home integration W4-B: bolt, fall, hand, list (S 11.3 to 29.9, joints J4 to J8)

Walked with a real wheel in real Chrome (headless, real GPU) on the dev server at 1440x900, 1706x950 and 390x844. Scripts are in `D:\ren\aspirant-work\home\W4B\` (outside the repo): `walk2.cjs` (cold wheel walk with a GL call spy and a long task log), `sheet.cjs` and `wheelshots.cjs` (frame sheets by seek and by wheel), `glspy2.js` (logs which programs link at first use).

## 1. The stalls: what they were, what changed

Cause, measured with the GL spy. Every stall of 0.3 to 2.3 s was a program linking at its first use inside `renderer.render` (`getProgramInfoLog` waits for the link):

- The shared lit scene (`getCast`, a PMREM environment from `RoomEnvironment`) was first made inside Silverbolt's constructor at about S 8.9: six programs, 0.8 s in one frame.
- The warm of the hand and Selena compiled `this.object` alone. A compile of an object alone has no lights, so it makes programs that the real draw does not use; the real draw linked them again (0.3 to 0.8 s at S 15.5 and S 19). Compiling the cast scene (as the bolt scene did) is right.
- Even with the right programs, the first draw of each lit program costs 40 to 140 ms (a bare WebGL test showed 0.1 ms after an async compile, so it is not the link itself: it is three's first use of a big PBR program on ANGLE). Drawn together they were one frame of 400 to 700 ms.

Changes:

- `actors/shared/warm.ts` (new): `warmCast(stage, cast, root, { localClipping })`. Compiles the whole cast scene with `compileAsync` with every part shown, sends the pictures one to a frame (after a GPU fence), then draws once into a one pixel scissor for each distinct program (`distinctMeshes`, keyed by material, skinning, instancing, morph count), a mesh to a frame, never culled. A cheap draw (under 6 ms) does not wait for a pause. `texturesOf`, `programKey`, `distinctMeshes` are tested.
- `actors/shared/quiet.ts` (new): `whenQuiet(maxMs)` (no wheel, touch, key or scroll for 320 ms, never longer than the maximum), `nextFrame`, `gpuDrained(gl)` (a fence polled once a frame, so nothing blocks).
- `ensureHand` and `ensureSelena` call `warmCast` (Selena with clipping on). The bolt scene's build uses it for the dragon and the doll, and waits for pauses between its steps.
- `kernel/engine.ts`: `getCast(stage)` is called once at engine start, behind the loading screen (the environment map was the longest single task).
- `kernel/types.ts` and `layout.ts`: optional `mountAhead` on a section (default 2). Bolt mounts 9 screens ahead (S 1.8) and builds in pauses; hand mounts 12 ahead and, once the hand and doll exist, builds Selena (`sections/hand/runtime.ts`), so no actor is built in the middle of a scroll near its section. Test added in `layout.test.ts`.

Result, cold wheel walk from S 0 to 22 with no pause at all (worst case): worst frame 2300 ms before, 267 ms after (that one is the hero's first frame, not mine). In my range the worst is 100 to 215 ms. With a pause of 0.7 s every 2 screens, the worst frame in S 3 to 31 is 150 ms (S 11.47 and S 23.7). Nothing stalls at S 9, 11.4, 15.5, 17.3, 19 or 19.4 to 19.7 any more.

## 2. Other fixes

- Air marks after a jump: `BoltScene.update` clears the marks on a jump and does not run the air loops in the jump's frame, and stops them for good from t 6.95. Checked: a seek to S 17.95 and one to 18.1 show no streaks and no clouds.
- Silverbolt's `onMark` listener: it was already taken off in `release`. It also answered while other sections (the selena room, the comedy) drew the dragon, drawing the bolt scene's marks there. It now answers only within 250 ms of the scene's last draw.
- J6: `bolt/journey.test.ts` and `hand/timeline.test.ts` pin `END_HEIGHT`, `END_FEET_Y`, `HIPS_ABOVE_FEET` both ways, and pass. Frames at S 17.88 and 17.9 match.

## 3. Looked at (real wheel and frame sheets)

Bolt (entry, dwell with the five names, rearing, throw), fall ("5 PHASES", "10 CHARACTERS" with the doll between, air streaks, two clouds), hand (rise, landing, sitting, "2022 - PRESENT", the hint), the toss to the first frame, the list's first frame and name, the frame growth to the screen. Phone: the same, with the fall stacked (5 above the doll, PHASES below). No console errors other than three's X4122 shader warnings. The old probe `scripts/qa/probes/home-s4a.cjs` ran to the end at the three sizes after these changes: 15 of 15 checks passed (frames, viewer by mouse, keyboard and touch), no console errors.

## 4. Not fixed, not verified

- At S 28.8 to 30.3 (J8 and the start of the selena section) Selena is in `city_idle` (the reclining pose, as the in-game clip), but Silverbolt is not drawn until the selena section starts (about S 30.3), so the frame has her tail chain and no dragon under her as in `short-1.mkv`. It belongs to the selena section (W4-C range); left alone.
- The toss's flying doll is pink on a pink picture (Obsidia's art) and hard to follow for about 0.2 screens. No outline added.
- The first shots after a seek to a far section show no actors for about 2 s (the build waits for the page to settle). A wheel visitor is not affected. Probes that seek must wait for the actors (`need` in `lib.cjs`).
- Not measured: the production build, a weak machine, a real phone, Firefox and Safari. The per program cost is the driver's and was measured on this machine's GPU only.
- `hand/idle.ts` (`whenIdle`) is still used for the first step; the quiet gating happens inside `warmCast` and the bolt scene.
