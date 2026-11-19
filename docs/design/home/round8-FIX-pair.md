# Round eight: FIX-pair, the drone and the doll (20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-8-request.md` (the last paragraph). Two bugs. Code: `actors/buddies/`, small edits in `actors/drone/` and `actors/doll/`. Probes (outside the repo): `D:\ren\aspirant-work\home\FIXPAIR\` (`seat.cjs` the pair at attitudes with a tuned seat, `descent.cjs` a real wheel through the descent with a per frame log, `dockint.cjs` the lock and the answers in the dock, `apart.cjs` the hand-over, `prof.cjs` the helmet's profile).

## 1. The doll rides in the drone's 3D space

Before: the drone drew in its own pass (25 back, 35 front) through its own lens, the doll in the cast pass (30), so her whole body was always over the drone. The stage clears the depth buffer between passes, so nothing could sort them.

Now, while she rides:

- The drone's scene (`DroneModel.scene`) is the stage's pixel world (one unit one CSS pixel at z = 0, y up). The drone stands where it is drawn (`root.position`, scale `perMetre`), the camera stands straight in front of it at `lensDistance(h)` (the same 20 degree lens, now in pixels) and the picture is slid with the view offset as before. Looked at against the old frames: the drone alone is the same picture (it is the same arithmetic: a metre is `perMetre` pixels, the depth ratio `z / distance` is the same).
- The seat (`BuddyPair.seat`) is an `Object3D` in that scene, at the true 3D place of the helmet's top (`headFrame` in `seat.ts` now gives x, y and z, with no lens approximation) and turned as the drone is. The doll is its child, so the drone's rolls, flips and spins carry her, and the helmet, the fins and the wings are nearer the camera than her parts where they should be. Depth test and depth write are on for both, her ink copies and the drone's hull included. No z-fighting or ink through a surface was seen.
- The doll draws through the drone's lens: `doll.setLens(distance, cx, cy)` (the camera's distance and the point where its axis meets the picture plane, the drone's centre). Her size, her hit shapes and her marks follow it (`place.ts` functions take an optional distance; `Lens`). `detach()` gives her the cast pass's lens back and keeps her on-screen size.
- Her programs for that scene are made before she rides (`drone.warmGuest(doll.object)` in the pair's constructor), so the first frame has no compile stall.
- The seat offset was retuned (`SEAT_OFFSET` in `pair.ts`, 0, 0.24, 0.5 of her drawn height). The helmet's top is flat from 0.06 m behind the seat to 0.15 m in front (`prof.cjs`), so she sits on its front half with her seat on the dome and her legs over the front edge. Looked at on thirteen attitudes (rest, roll, yaw to 3 rad, pitch to 0.9): from behind or from the side the fin and the helmet cover her lower body, her head and hair show over the dome, her hands rest on her knees. No pop where the cover changes: the cover is the depth buffer, there is nothing to switch.
- The pair stays in the drone's "back" pass (25), under the cast pass (30). Checked in the real page at the list's dock, in the Selena section (docked, and leaving to the right) and in the descent: the pair never overlaps a cast character there, so the order is the same as before. Where a section later puts the pair over a cast character, give the drone `layer("front")` and she comes with it.
- `apart` and back: `pair.mode("apart")` calls `doll.release()`, she goes back to the cast scene with her world kept; `mode("carry")` seats her again (looked at with `apart.cjs`). Known small pop: on release her head moves about 8 px and her size changes about 5 percent at 300 px, because the drone's lens (distance about 2550 px) and the cast camera (1000 px) magnify the head's depth differently. Nothing uses `apart` on the page now (the list's hand-over is gone). If Selena's hand-over comes back, blend `setLens` over 0.2 s.

## 2. The scroll lock (`actors/buddies/lock.ts`, pure, `lock.test.ts`)

One weight, `lockW`, 0 to 1, for everything that is the pair's own life or the visitor's:

- Before: the weight falls over 0.15 s (smoothstep) as soon as the scroll is active: speed above 0.15 screens a second (hysteresis, calm again under 0.07), or wheel or touch input above 20 px a second (`InputInfo.wheel`) in the last 0.12 s.
- After: it opens only when the scroll has been calm for 0.45 s and the drone has settled (its drawn speed under 0.3 drone heights a second), then rises over 0.4 s (smoothstep). A pair that has just come on screen, a jump (a frame that did not follow the last) and `reset()` start closed.
- What it scales (`pair.ts`): the cursor's pull on the drone's eyes and body and on her gaze (`own`), the docked moments (`cueLife`), her fidgets (`gesture.idle`, new, scales the rider's behaviour: seat shifts, kicks, trembles, sweeps, grip fidgets, not a lost grip), the drone's own float (`drone.gains(idle, react)`, new), the hover lift and the move a press plays (`react`), the press cue and the lean on a held press, and the hit shapes (off under 0.02, so no cursor label and no hover while locked). Presses are ignored under 0.5.
- In `dance` mode (the descent) `own` is 0: the choreography is the only motion. Kept: the rider physics (she reacts to the drone's movement), the wing flutter and the descent's nose. A hover or a press still answers once the scroll has been calm and the drone has settled (the dance runs only slowly on the clock then).
- Every weight moves on an eased ramp or the drone's own springs (mode weights 5 a second, the gaze 5 a second, the lift 14 a second), so nothing snaps at the lock, the unlock, the mode change or the snap that ends a zone. A jump (seek) resets to the target with no animation, a scroll never does.
- `BuddyPair.probeNoLock` is a probe's switch (never set by the page) to measure the old behaviour.

## Looked at, and how

Real Chrome, the dev server, 1440x900 and 390x844.

- `before.png` and `s3.png` in `FIXPAIR\shots`: the pair at eight attitudes before and after.
- Real descent frames (S 12.5 to 16.5) and the list dock, Selena, the phone: the pair rides and is covered by its own fin and helmet when it turns (S 15.7), no console error.
- A real wheel (`descent.cjs`, 30 px every 24 ms, a flick of four times 200 px, a reverse), per frame log. With the lock on the gains are about 0 while the scroll runs (lock 0.00 to 0.03, hover lift 0, engaged gaze about 0 after the ramp); with `probeNoLock` they are 1, the cursor pulls the gaze (engaged 0.12 to 0.16) and a hover lifts the drone (0.15 to 0.16) while it scrolls.
- No pop at the lock edges: at three unlock moments the largest second difference of the drone's place, roll, pitch and of her seat is 0.2 to 0.3 px (rad 0.004). The bigger numbers in the log are the scroll's own flight and the dance's spin (a spin routine runs a whole turn in a flick: the drone's yaw turns 2 to 3 radians in a frame, which is the dance following a fast scroll, not the lock).
- `dockint.cjs`: calm with the cursor on the drone (lock 1, hover, a perk), a wheel (lock 0, hit shapes off), 0.3 s later still closed, about 2 s later open again with a press answered (cheer).
- Tests: `lock.test.ts` (7) and `buddies.test.ts` (14) pass. `tsc --noEmit -p apps/web` is clean for the changed folders.

## Not done, not verified

- The dance's spin follows the scroll at any speed. A hard flick turns the drone through half a revolution in a few frames. A cap on the spin's angular speed (in `runtime.ts`, from the scroll velocity) would calm it; it was not asked for.
- The cost of the shared pass was not measured (the doll's programs are the same, the cast pass is now empty while she rides, so the draw count is the same or one pass less).
- The old lock-free numbers were measured on the same scroll with `probeNoLock`, but the dev server reloaded under other helpers' edits several times, so each run was repeated until it finished.
- Touch scrolling of the descent, Firefox, Safari and the production build.
