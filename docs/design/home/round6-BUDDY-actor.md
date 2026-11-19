# Round six: BUDDY-actor, the drone that carries the Obsidia doll (20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-6-request.md`. The API for the other helpers is `actor-buddies.md`. Code: `apps/web/src/features/home/actors/buddies/` (new) and small additive edits in `actors/drone/` and `actors/doll/`. Probes (outside the repo): `D:\ren\aspirant-work\home\BUDDY\` (`lib.cjs`, `poses.cjs` the seat at eight attitudes, `zoom.cjs`, `dance.cjs` the routines as frames, `dock.cjs` the docked life over 15 s, `inter.cjs` and `spam.cjs` the real mouse, `measure.cjs` her bones in the seat's frame).

## What was built

1. **The seat.** The drone draws in its own lens and pass, so the pair computes where the top of the helmet is for the pose drawn this frame (`seat.ts`, `HEAD_TOP` (0, 0.158, 0.02) m in the model, through the 20 degree lens) and writes it into an `Object3D` in the cast scene. The doll is its child (`doll.rideOn(seat, ...)`), so she keeps her place exactly and the rider physics of round four (measured seat motion, spring chains, two bone IK) work on any host. The drone is in the back pass and she is in the cast pass, so her legs and hands are always drawn over the helmet.
2. **A generic rider.** `RideOptions` gained `seatOffset`, `upright` and `free` (no walk toward the grips, no spread rule, no slips). `RideGesture` is what a controller asks each frame: a weight per hand (the hands are the grip sockets, which the pair moves, so a wave or a pat is the arm IK reaching a target), trunk roll, nod and twist, head tilt, turn and nod, a leg swing with a rate, knees up, a slide and a look point.
3. **The pair controller** (`pair.ts`): one registry actor `buddies` that steps drone, seat and doll itself in that order (`external` makes the kernel's own calls no-ops), with modes `carry`, `dance`, `dock`, `apart` and blends between them; `place`, `dance`, `descent`, `look`, `react`, `setInteractive`, `reset`, `state`.
4. **Rolls and flips with a rider.** A roll or a flip of the drone becomes a rock of 0.62 rad from side to side (`rockForRider`, a whole swing in the same time, so it begins and ends at rest); a spin about its vertical axis stays a spin and she turns with it. Dance spins are added with `drone.spin(angle)`, with no spring, and the yaw is wrapped before it is weighted so a finished spin never unwinds.
5. **Twelve dances and a show** (`choreo.ts`, pure, tested): sway, bob, spin, eight, twirl, hop2, shimmy, wave, clap, cheer, lean, spiral, and `show` (all of them with a cross-fade, 104 beats). `t` is any real number, so a scroll plays them both ways.
6. **Docked life** (`life.ts`, pure, tested): 13 moments from a shuffled bag (look, swing, hum, pat, lean, whisper, yawn, wave, adjust, slip, gaze, wiggle, hug) with a pause between; a moment never repeats until all have run (26 to 40 s apart at the shortest, no repeat within a minute of 13 moments of 2 to 4 s and pauses of 1 to 2 s).
7. **Interaction** (`touch.ts`, pure, tested). Hover and press arrive through the hooks of both actors (`hooks`); the pair answers for both. Hover drone: a hop, a happy face, she waves. Hover doll: she waves and smiles, the drone looks up. Press drone: a spin or a rock, she cheers. Press doll: she giggles and hugs its head, it wiggles. Two presses within 0.4 s: a big hop with arms up. Four within 2.2 s: dizzy for 2.4 s, then a laugh. Hold: both lean toward the cursor. The doll's hit is nearer than the drone's (`drone.hitDepth` 1200 while the pair is shown), so she is hit first where they overlap.

## Looked at, and how

Real Chrome, the dev server on 3000, the lab (`window.__home.lab("buddies")`), 1440x900, light ground.

- **The seat** at eight attitudes (rest, roll +0.4 and -0.4, yaw 0.7, -0.7 and 1.4, pitch +0.5 and -0.3) at a drone height of 300 px: she sits on the dome between the fins every time, she turns with the head, no sinking and no floating, her legs draw over the helmet. Zoomed at 2x with a pat and with a hug: the hands go where they are asked (the pat on the dome, the arms round the front).
- **The dances** (sway, spin, twirl, wave, clap, cheer, lean, spiral) as four frames each: the drone's faces change (happy, sparkle for cheer, alert for the lean), she stays seated, the lean shows her leaning out and the drone swinging under her.
- **The dock** at the contract's size (126 px drone at the bottom right) over 15 s: rest, gaze, hum (music notes), adjust, swing; she reads at that size.
- **The real mouse:** hover on the drone and on the doll (the cursor says HELLO or POKE), press on each, a spree (dizzy), a hold (the pair leans toward the cursor, seen once).
- tsc is clean for `actors/buddies`, `actors/drone`, `actors/doll` and `kernel/lab.ts`. `buddies.test.ts` (14 tests) passes: every routine is finite forwards and backwards, continuous, loops, spins by whole turns, the show fades without a jump; the life runs full bags with no repeat; the touch machine fires and ends every reaction.

## Not done, not verified

- **No comic marks** (heart, sparkle, sweat) are drawn: the cues carry a `mark` field that nothing reads yet; only the drone's own shock mark is used (the startle). The faces carry the feeling.
- **Not looked at:** 390x844 and touch (a tap goes through the same hooks, not run), the descent as driven by DESC's section (it had no runtime yet), `apart` with Selena's hang, the pair with the real list, the energy wired to the scroll speed (the parameter exists), the cost per frame (the drone and the doll cost as before; the pair adds a few vector writes), a production build.
- The pointer hub took about 0.7 s to report a hit under a mouse that had just moved in the lab (`pointer.state.hit` stayed null for seven polls of 100 ms, then `drone`). Not traced; it is the hub's, and it did the same for the first hover before my change.
- The doll's own idle behaviour (look, fidget, adjust) still runs under the pair's moments, with slips off. Her hands at rest are on the dome beside her thighs.
- Existing tests of the drone and the doll were not run (the owner's rule); `RideOptions` and the drone's `update` were changed additively.
