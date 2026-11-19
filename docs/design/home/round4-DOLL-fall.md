# Round four: the doll's fall (DOLL-fall, 20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-4-request.md` (the last paragraph of "The Obsidia doll"). The API is in `actor-doll.md`, "Round four: the fall". The fitting pipeline is in `scripts/home/models/doll/fall/` (README there).

## What changed

- **Why the old fall broke under a scroll.** The section set the pose from the scroll every frame (`setPose("fall", "stand", w)` scrubbed by the scroll, and `flail(amount, rate)` with a rate taken from the scroll's speed, both read the frame's time). A fast scroll moved the pose and the flail faster, a jump clipped it. Now the fall pose comes only from a player that owns its clock.
- **The clip.** `Falling.fbx` is the Mixamo mannequin skydiving belly down (head toward +Z), 136 frames at 30 fps, first frame equal to the last. `fit.py` retargets it to the doll in world space (swing fix for her A pose against the T pose, her own hierarchy), turns the whole body by `ROOT` (yaw -25, pitch -75, roll 12) so she is on her front, head up and to the left, face three quarters to the camera, and writes 135 keys (4.5 s, 103 KB JSON) to `public/models/home/doll-fall.json`. `AMP` (the scale of each bone's swing) is 1 for every bone.
- **The player** (`actors/doll/fall.ts`, `FallPlayer`): the clock moves by the frame's dt only; the weight moves toward the target in 0.25 s. The loop is sampled with a slerp between keys, no allocation.
- **Hooks in `actor.ts`** (three small ones): `applyFall(dt)` in `composePose` after the walk block, the landing squash in `stepSprings`, three lines in `reset()`. New API: `fallLoop`, `falling`, `fallSeconds`, `land`, `standUp`, `setFallClip`.
- **Hand** (`sections/hand/carry.ts`): before the palm `doll.fallLoop(1)` (the old scrubbed pose and flail stay only as a fallback while the clip is missing). When `t >= HAND_AT.land` a clock on the frame's dt (`landClock`) runs `land` 0.5 s then `standUp` 0.7 s; the hand's knock (`hand.impact`), the doll's bump and the poof now fire at 0.3 s of the landing (`TOUCH_AT`), when her feet meet the palm, and the poof is smaller (80 instead of 130, it covered her for a second). Scrolling back before the landing gives the loop again, blended in over 0.25 s.
- **Loading.** `dollItems()` now also returns the clip (`savedItem`, same deferred flag and priority as the model); `ensureDoll` reads it through `cachedFetch` and parses it with `FallClip.parse` (a stale or missing file gives no clip: `fallLoop` does nothing). `FALL_DATA_PATH` carries `?v=3`: bump it when the fit changes.

## Numbers to tune

`scripts/home/models/doll/fall/fit.py`: `ROOT` (the orientation), `AMP` (per bone, default 1). `fall.ts`: `FALL_BLEND_SECONDS` 0.25, `LAND_SECONDS` 0.5, `STAND_SECONDS` 0.7, `CATCH_WIDE`, `CATCH_LOW` (turns in degrees, hips offset -0.1), `landSquash` (-0.2). `carry.ts`: `TOUCH_AT` 0.3.

## Looked at (real Chrome, 1440x900, dev server)

- The loop in the lab at eight times (600 px): face visible at all of them, three quarters, belly to the camera, legs trailing lower right, the right arm shows beside the hair. Sheets in `D:\ren\aspirant-work\home\DOLL-fall\shots\` (`loop6.png`).
- Ride to fall hand-over in the lab (the `ride` pose, then `fallLoop(1)`): smooth in about 0.25 s, no pop (`blendin.png`).
- The landing in the lab at 8 points of `land` and 6 of `standUp` (`land1.png`) and in the real hand section at 24 real-time frames (`real3.png`): tilted fall pose, upright with arms wide, the poof at her feet, standing up, then the standing pose of the palm with no pop. The trace shows `land` 0 to 1 in 0.5 s and `standUp` 0 to 1 in 0.7 s on the real clock.
- Speed: in the real hand section the loop advanced 3.016 loop seconds in 3.003 s still, 3.016 in 3.012 s while the scroll crawled, 2.982 in 3.014 s while it was driven fast (a sine of 40 ms) and 3.016 in 3.014 s with jumps every 150 ms (`speed.cjs`). The small differences are frame quantisation (dt is capped at 50 ms).
- 13 unit tests in `fall.test.ts` (the clip fits the rig, loops, is smooth, unit quaternions; the player's clock and blend; the landing ends and ease; the squash) and `preload.test.ts` (updated for the second item) pass.

## Not verified / not done

- The real bolt and fall sections with the loop (SEC-bolt-fall wired `fallLoop(1)` in `bolt/scene.ts` while I worked; I looked at the loop only in the lab and in the hand section, from the hand section's fall branch at S 19.4). Their placement must keep `yaw`, `pitch`, `roll` at 0 while the loop shows (the orientation is in the clip).
- The hand-over from DOLL-look-ride's real rider (`release()` with the arm solver): tested with the plain `ride` pose only. The blend starts from the bones as the last frame left them, so it should include the solver.
- The flutter is gentle: her huge hair hides most limb motion, so the loop reads mostly as a tumble of the head and the trailing legs. `AMP` above 1 on the arms would show more but may put them through the hair; not tried.
- The knees bending in `CATCH_LOW` is hard to see at her size (the legs are short); the hips drop and the squash carry the crouch.
- The phone (390x844), the production build, Firefox and Safari. The loop's mouth and face come from the section (`mood`, scared faces), not from here.
- The seam of the loop is as smooth as any two keys (largest step between keys 0.065, seam 0.0225 of a quaternion component); not judged by eye over several loops.
- While I worked the dev server broke twice on other helpers' files (a missing export in `bolt/stations`); the lab scripts retry.
