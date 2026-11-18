# Home actor: Selena (workstream SL)

Code: `apps/web/src/features/home/actors/selena/`. Model and cameras: `docs/design/home/models-selena-silverbolt.md`. Lab: `window.__home.lab("selena")`. Built 18 Nov 2026.

## What she is

A plain class (`SelenaActor`) drawn in the shared cast pass. A section builds her with `ensureSelena(ctx)`, sets her state every frame it shows her, and she integrates her own motion in `update(frame)`. Toon look with an ink line, four clips, head and eyes that follow the pointer, ten fingers, hair and skirt springs, a face of 17 shapes, six touch targets. 14 draw calls, `update` about 0.25 ms.

**Read this first: `city_idle` is a lying pose.** She floats on her side with her legs up and her hair streaming to the right (the game's city idle). `city_interaction_R_loop` is the standing pose with the hands at the mouth. The rest pose of the file is a T pose nobody sees. The notes' sheet `selena-clips.webp` shows all four.

## API (what a section uses)

```ts
import { ensureSelena, type SelenaActor } from "../../actors/selena";
import { selenaItems } from "../../actors/selena/preload";

const sl = await ensureSelena(ctx);                  // mount; compiled and uploaded before it resolves
selenaItems({ deferred?: boolean, priority?: number }) // PreloadItem[]: selena.glb 1.75 MB, cameras.json 14 KB

// every frame the section shows her (sections set state each frame, she keeps nothing else)
sl.visible = true;
sl.place({ x, y, z?, height, yaw?, roll? });         // stage pixel frame; height = standing height of the reference
sl.play("city_interaction_R_loop");                  // own clock; asking again for the same clip does nothing
sl.playRelease();                                    // waits for the loop end, back_R, then idle (all by itself)
sl.clip(name, time);                                 // pure scrub (loops wrap, others hold their ends)
sl.blend(a, ta, b, tb, w);                           // cross fade of any two, w 0..1
sl.look("pointer" | "viewer" | "idle" | { x, y });   // default "pointer"
sl.expression("laugh", amount);  sl.talk(level);  sl.react("wink", seconds);
sl.interactive(false);                               // turn the hit targets off
sl.clipRectangle(rect | null);                       // the 4:5 frame (CSS px, top left origin)
sl.frameFor(rect, "hands" | "idle", fill = 0.94);    // -> { x, y, height } for place()
sl.cameraFor(clipTime, { w, h }, { fit?, band?, maxFov?, draw? }); // the baked camera, see below
sl.socket("rightHover" | "rightHand" | "leftHand" | "mouth" | "head"); // Object3D in her own space
sl.screenPoint("head" | "eyes" | "handL" | "handR" | "pelvis", out); // stage pixels
sl.stats();  sl.debug();  sl.measure(clip, time);    // probes
```

Clips: `city_idle`, `city_interaction_R_loop`, `city_interaction_back_R`, `city_intercation03` (the source's spelling). `PlayOptions`: `loop`, `fade`, `speed`, `when: "loopEnd"`, `then: Segment[]`. Seams (cross fade seconds, `FADE` in `constants.ts`): loop to release 0.08, release to idle 0.15, others 0.18. Expressions: `neutral soft smile happy content laugh shout surprised angry snarl rage pout ouch effort wink sleepy`.

**Placement.** `place` puts her anchor (`ANCHOR`, near the pelvis, a fixed point of her space) at (x, y), and `height` pixels stand for `REF_HEIGHT` = 1.85 m of her. Both are fixed numbers, so changing clip never moves or resizes her; the lying and the standing pose turn about the anchor. Works from a few pixels to several screens (the scale is from `worldScale`, the perspective is kept). `z` is pixels toward the camera.

**The frame (list, tenth frame).** `frameFor(rect, "hands")` gives the `place` arguments that make her standing pose fill a 4:5 rectangle (the far claws are cropped by the frame on purpose; `POSE_FIT.hands`); `"idle"` fits the whole lying pose, hair and chain included (`POSE_FIT.idle`). While the frame expands the section lerps `rect`, calls `frameFor` each frame and `clipRectangle(rect)`; at the full screen `clipRectangle(null)`. The fit boxes are in metres of her space and do not know the perspective (the pixel camera is a 48 degree lens at 1000 px: a part 1 m behind her plane is about 0.6 of its size), so she fills about 85 percent of the frame, not 94. Raise `fill` or retune `POSE_FIT` by eye if the owner wants it tighter.

**The clip is not the scissor.** `cast.clip(rect)` cuts the whole cast pass, which would cut the doll that sits on top of the frame. `clipRectangle` instead puts four clipping planes (camera through each edge of the rectangle) on her own materials, and sets `renderer.localClippingEnabled`. The planes are always on the materials (open when there is no rectangle, so no shader recompile). They are for the pixel camera only and are opened while the baked camera is drawn.

## The baked camera (`city_intercation03`)

`sl.cameraFor(t, { w, h })` returns a `PerspectiveCamera`: the baked pose of `cameras.json` composed with her own placement (her space is the camera's space), `fov` 61.9275 and `aspect w / (1.25 h)` with `setViewOffset(w, 1.25 h, 0, 0.25 h, w, h)` (the notes' formula, `fit: "height"`, the default). `fit: "width"` widens the lens up to `maxFov` (80) so a narrow screen keeps the sides of the 16:9 frame. With `draw` (default) it also calls `cast.setCamera(camera)`, so the whole cast is drawn through it on the next draw; call it every frame it is wanted (the cast forgets it after one draw). The picture is the same for every `place`, `z` and `yaw` (looked at, two placements).

Contract for the other actors in the film: Silverbolt and the doll must stand in **her space**, `sl.film` (a `Group` whose world matrix is the film's). A section places them with `sl.film.matrixWorld` times their own film transform (Silverbolt's `cameras.facts.json` pass, the doll's `socket("rightHover")`). `socket("rightHover")` is the hand bone plus the notes' offset `(-0.06, 0.27, 0)` blended to `(-0.38, 0.28, 0)` between 2.8 and 3.2 s of the clip (model space, y up); outside the fall clip it holds the first offset. The notes say the doll shows from 1.6 to 3.4 s; that is the section's call. A doll attached to a socket inherits her scale (about 400 to 800 px per metre): attach with `Object3D.attach` (keeps the world transform) and do not call the doll's own `place` while attached. Detach before the section leaves.

While the film camera is drawn the hit targets answer nothing (the pointer is not on the pixel picture).

## How the pose is made (`writePose`)

No animation mixer. `sampler.ts` samples the clips (ten numbers a bone), `player.ts` is the clip machine (play, scrub, cross fade, chain), `skeleton.ts` walks the hierarchy once (model positions and rotations in her own space) with turns added on top, `physics.ts` rewrites the rotations of the swinging bones, and the result is written to the 155 nodes once. Order each frame: step the player, sample (and blend), add the turns (gaze, body lean, pat, tilt, hip, claws, fingers), compose, springs, write bones, write the face, move the sockets, project 39 points to the screen.

**Springs** (`physics.ts`, tests in `physics.test.ts`). 76 bones (the notes' list: 31 hair, 32 skirt, 4 ears, 2 jewellery, 7 cloth; `springs.ts` finds them by name, `names.test.ts` checks the list against `selena.facts.json`). Each bone's tail point is a particle: a damped spring to the clip's tail position, the actor's own motion (a lag of the shift of her frame, capped at 6 cm a frame), a breeze, the pointer's push, a rigid length and a swing limit; the bone is turned so its tail points at the particle. The rest point is the clip's pose (gravity 0), so the hair settles exactly where the animation put it (the clip has its hair whips in it). Substeps of at most 1/90 s: 60 and 144 Hz agree. A zero step holds; a scrub jump, a clip change while scrubbing, a teleport (more than half her height) or a gap of frames snaps them. Numbers (`DEFAULT_PARAMS`): hair omega 24 zeta 0.55, ponytail 12 / 0.4 (max swing 0.7), skirt 15 / 0.5, ears 34 / 0.45, jewellery 14 / 0.3, cloth 18 / 0.5.

**Gaze** (`look.ts`). The wish is the screen direction from her eyes to the pointer (depth 0.7 of the viewport height), turned into her frame by her yaw. It is split into neck, head and eyes (dead zone 0.1 rad, head limit 0.62 sideways, 0.36 up, 0.5 down, eyes 0.42 and 0.28 / 0.3), each on a spring (10 rad/s, 0.8), applied as turns about the model's up and right axes, so the head follows the cursor in screen terms in every pose. Without a pointer she drifts. In the fall clip the gaze is off (the clip has its own head).

**Fingers** (`fingers.ts`). Ten springs (1.5 Hz, damping 0.5, oryzo's feel). The target is the pointer near a fingertip (gaussian, gated by the distance to the palm), a wave along the hand (when touched), a fist (3.0) while a hand is pressed, plus a breath. Per joint curl `[0.18, 0.28, 0.20]` rad at 1, times index 0.8, middle 1.0, ring 1.1, pinky 1.25, thumb 0.55; axes from the facts (`flexAxis`), applied after the clip's rotation as the notes say.

**Face** (`face.ts`). 15 shapes plus `wink_l` and `wink_r`, which the actor cuts out of `blink` by the side of each vertex when it is built (before the first draw; her left is +x). Presets blend by an amount, a one-shot `react` rises, holds and falls, `talk` wobbles `mouth_o` and `mouth_tiny_o`, and she blinks by herself (every 2.4 to 5.8 s, 18 percent twice), cut by shapes that already close the eyes. Looked at in the lab: laugh, shout, angry, snarl, ouch, content, wink, sleepy, surprised, pout all read at 1100 px tall. The notes name the shapes by their picture; `happy` is `smile` plus `smile_soft` and squints.

## Touch (hit targets, depth by the distance to the camera)

| id                    | where                                                                                                            | cursor | on enter                                         | on press                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------ | --------------------------------------------------------- |
| `selena:head`         | disc on the head, 0.13 m (it wins where hair lies over the face)                                                 | PAT    | `happy` 0.9 s                                    | nod, `content` 1.4 s, a kick to hair and ponytails        |
| `selena:hair`         | capsules along both long strands (0.06 m) and a disc on the bangs                                                | SWISH  | none; the pointer's move is the push             | a swing and `surprised`                                   |
| `selena:hand-l`, `-r` | wrist to the far end of the hand (0.07 m; not the fingertips: a fist would move the target and let go of itself) | WIGGLE | a wave through the fingers, a wink for the right | a fist while pressed (kept while the pointer is down)     |
| `selena:claw-l`, `-r` | disc 0.2 m on each claw socket                                                                                   | SPIN   | one full turn of the claw                        | two turns and `surprised`                                 |
| `selena:body`         | neck to pelvis, 0.17 m                                                                                           | POKE   | none                                             | a lean away from the press, `laugh`, skirt and hair swing |
| `selena:legs`         | both legs, 0.085 m                                                                                               | TAP    | none                                             | hip sway, `wink`, skirt swing                             |

Every reaction is a timed pulse (`reactions.ts`) or a spring that always ends. The cursor label comes from the target (`WIGGLE` seen on the site's cursor in the lab). A touch finds its target at the press.

## Look

`material.ts`: `MeshToonMaterial` with the picture, three light steps `[105, 190, 255]` (nearest filtered), a cool rim added before `opaque_fragment`, a gain (`uGain`, 1.0) shared by all her materials, depth write on the hair. The ink is the same geometry again on back faces pushed along a smooth normal (normals averaged by place at build, read through the accessors); it is a sibling mesh with the same transform; its width is 1.6 px on the screen kept between 1.4 and 6 mm (`outlineUnits`). No ink on `hair_01` (alpha cards) or the eyes; the eyes are unlit (`MeshBasicMaterial`). Her lights are the cast's rig; she takes no environment map. Everything double sided (skirt cards).

## Tune

`ANCHOR`, `REF_HEIGHT`, `POSE_FIT`, `FADE`, `LOOK_RECIPE` (steps, rim, ink colour, `outlinePx`, min and max width) in `constants.ts`; `DEFAULT_PARAMS` in `physics.ts`; the kick scale in the hair target of `actor.ts`; `LIMITS` in `look.ts`; `PRESETS` in `face.ts`. To measure again: `sl.measure(clip, time)` in the lab returns the skin box and a core box.

## Looking at it

Scripts of this workstream are in `D:\ren\aspirant-work\home\SL\` (`lib.cjs` opens the page at 1440 by 900 with the intro off and the consent answered, runs `lab("selena")` and a per-frame driver). Recipe: `window.__sl = await window.__home.lab("selena")`; set a driver that calls `place`, `clip`, `look` every frame; `window.__home.freeze(true)`; screenshot. Seen: each clip (`clips.png`), the baked camera against the recording (`film.png`, 1600 by 720: 1.5 s, 3.7 s, 5.0 s), the 4:5 frame, its expansion and a phone frame with a resize (`frame-*.png`), expressions (`expr2.png`), gaze (`gaze.png`), hair swish (`hair.png`), fingers and fist (`fingers.png`), the chain hands, release, idle (`chain.cjs`).

## Cost

Measured in Chrome on this machine (dev server): `update` 0.21 to 0.28 ms average, 0.4 ms p95 (`stats()`); 14 draw calls, their CPU time under 0.05 ms; the frame stays at 16.6 ms at 60 Hz with her full screen (`gl.finish` after the frame returns at once). GPU time is not measured (no timer query). The actor allocates nothing per frame (scratch arrays, bone indexes found once) except the small objects `frameCamera` returns while the baked camera is drawn.

## Checked, and not

Checked: tsc, eslint, prettier on the folder, 104 unit tests (quaternions, skeleton compose, the solver, springs, face, fingers, hit, reactions, the player, the sampler, the camera, framing, the names against the facts), the lab screenshots above.

Not verified or not done: the hit targets with a real touch screen; Firefox and Safari; a weak machine; the dev server only (2 to 3 times slower than the build); the doll and Silverbolt placed in the film space (they are other workstreams: the contract above is untested against them); the context-loss path (nothing of hers lives outside three's own tracking: no render target, no PMREM, so there is no `rebuild`); `frameFor` fits by metres without the perspective (see above); the claw spin and the hip sway have not been looked at in a still (they are turns of the claw bones about the model's up axis and of the pelvis about the view axis); feet have no reaction of their own (the legs target sways the hips); the "talk" mouth was only checked for its weights.
Cut: finger stagger, a wink on a hover of the left hand, a foot tap (needs the foot axes), hair reacting to her own idle breeze beyond a faint wind, the "width" fit as the default.

## Shared files touched

`kernel/lab.ts`: one line (`selena`). `actors/shared/cast.ts` already had `setCamera` and `clipOnce` (added by another workstream before this run); she uses `setCamera` and not `clipOnce` or `clip`. Nothing else outside the folder.

## Hands over

For the section: `selenaItems()` is not imported by anything yet (knip lists `preload.ts` and `SELENA_MODEL_BYTES` until it is). The section helper decides what is waited: she is in view when the list's tenth frame arrives, so her model is a waited item there and deferred elsewhere.
