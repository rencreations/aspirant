# Home actor: Silverbolt (workstream SB)

The dragon of the rebuilt home. A plain class (`apps/web/src/features/home/actors/silverbolt/`) that a section drives and the shared cast pass draws. Model and facts: `docs/design/home/models-selena-silverbolt.md` (`public/models/home/silverbolt.glb`, 300,108 B, and `silverbolt.facts.json`). Built 18 Nov 2026. Round two, 19 Nov 2026 (the owner's feedback): the anime look and the straight head, section 0 below.

## 0. Round two: the toon look and the straight head

Request: "for all 3d model, make sure it's rendered in anime style like Tetra and the Drone" and "silverbolt normal head should be parallel with its body in a straight line and not bend like a seahorse" (`docs/superpowers/specs/2026-11-19-home-feedback-request.md`).

**The head** (`straight.ts`, tested in `straight.test.ts`). The file's head hangs down from the neck, the snout about 55 degrees below the body: that is the seahorse, and it is in the rest pose and in the baked clips alike (the procedural fly, dance and the cursor follow were never the cause). Every frame, after the base pose is written (rest or a clip) and before any reaction, `straightenHead` turns the head about its joint, about the body's side axis, by a **lift** that puts the snout level with the spine (the line from the first tail joint to the head joint, both children of the root bone, so it needs no world matrices). The lift is measured once: in the rest pose it is the angle from `HEAD_DROP` (0.92 rad, the rest snout's drop below the body, tuned by eye on side views: 0.9 to 1.0 all read straight) plus the spine's own 3 degree rise, about 0.97 rad; for each baked clip it is the **mean** of the same angle over 32 samples of the clip, so a clip keeps its own nods and lunges and its middle is level (a per frame level would have frozen the head of `city_intercation03`). Reactions (shake, flinch, chomp, yelp, the annoyed dip, the pointer follow, the lag spring) are laid on top, so they move a straight head and it returns to straight. The solve is exact for a head that looks to the side (only the pitch is corrected).

- `sb.straighten(weight)`: one frame, 0 to 1, default 1. A section that must have the file's own pose (the baked pass) can ease it to 0.
- The sockets turn with the head, as features of it, except `headTop`: it is the doll's seat, and keeps its old orientation (`uprightFix`: `q_h0^-1 * turn^-1 * q_h0` on the left of the socket's rest rotation), so a rider stays upright. Two rest points moved to follow the head: `headTop` (0, 3.73, 0.22) is now the skull between the horns and the eyes (it was the crest, which is now the back of the head), `snout` (0, 3.33, 0.38) is the nose tip. `mouth`, `jawTip`, `tongue`, `eyeL/R`, `cheek*`, `wing*`, `bodyCentre`, `tailTip` are unchanged: they are points of the head, and are where the mouth is in either pose. A doll in the mouth is turned with the head (about 55 degrees back from upright); the film of the Selena section is the one place that cares (see "Not verified").
- The head's hit capsule now runs from the head's joint toward the `snout` socket, 0.46 m, radius 0.25 (it used to point at the eyes, which now look up and forward).
- `bolt/scene.ts` `SEAT` was (0, 0.5, 0.8) of the doll's height from the old crest and put her above the horns; it is now (0, 0.12, 0) from the new `headTop`. Looked at in the real section at 1440x900 and 390x844: she sits on the skull between the horns.

**The look** (`materials.ts`, on `actors/shared/toon.ts`, see `toon.md`). `toonify` with a `pick` per named material: the armour `metal` (three bands, hard glint, pale rim) with an ink hull of weight 1.4; the lid sockets `metal`, no hull; the cheek crystals `default` with a glow (`setEmissive`) and no hull; the eyes `unlit` (the atlas, tinted by `color`: bright with a wide eye, red with anger); the ribbon `soft` with a rim, transparent, no depth write, `renderOrder` 1. No environment map, no metalness or roughness, no `OUTLINE_PX`, no own shell (the shell and `setOutlineNdc` are gone; `dress(scene)` takes no environment). The ink width comes from `set.setHeight(pxPerMetre * BODY_HEIGHT_M)` every frame. Two cuts of the painted atlases are done in the fragment shader after the toon patch (`cutIntoSteps`): the ribbon's gradient in six flat colour steps per channel (so the flame is cyan, blue, violet, red in flat bands), the armour's lightness in six tone steps with the hue kept (the airbrushed highlights become hard shapes; cutting each channel made the paint's noise speckle, so the armour is cut by tone only). The ribbon has no ink: the card ink (eight shifted copies) filled the translucent flame with black.

- **Shared bug fixed (surgical edit of `actors/shared/toon-glsl.ts`, test in `toon-glsl.test.ts`):** the ink hull is a back side material, and three turns the normal inside out for it (`FLIP_SIDED` in `defaultnormal_vertex`), so the hull was pushed **inward** and never showed outside the silhouette, for every actor that uses it (Selena, the hand, the doll). The hull now turns the normal back before it pushes. With a 20 px width the hull of the dragon went from shrinking to growing, and Selena's outline at 12 px went from broken black masses to a clean even line. Every toon actor's ink is now much more visible than TOON-CORE saw: check the widths in `outlineFor` against the new look.
- Looked at (real Chrome, dev server, plain ground): rest, fly, dance, eight faces, all five clips pinned, 3/4 and side at 650 and 1200 px, 120 px; the real bolt section at 1440x900 and 390x844 (touch, dpr 2).

## 1. Use

```ts
import { ensureSilverbolt } from "../../actors/silverbolt";      // a lazy import: it pulls three
import { silverboltItems } from "../../actors/silverbolt/preload"; // safe in the server markup and the registry

preload: () => silverboltItems()                       // deferred, priority 40. { deferred: false } where it is on the first screen
mount: async (ctx) => { const sb = await ensureSilverbolt(ctx); ... }   // shared by every section that needs it
```

A section sets the state of the dragon **every frame it shows it** (the kernel hides every actor first). Every setter lasts one frame, so "set the target state" is the whole API. Only `place`, `placeWorld`, `annoyBy`, `calm`, `react` and `blink` are persistent or one-shot.

```ts
sb.visible = true;
sb.place({ x, y, z, height, yaw, pitch, roll });   // stage pixels, y up, z toward the camera. Persistent until changed.
sb.fly(t, { speed, amplitude });                   // the flight loop. t is a clock in seconds. amplitude 0 hover, 1 normal, 1.2 strong
sb.dance(t, amplitude);                            // the dance; the face is "smile" unless face() says otherwise
sb.clip("city_intercation03", time, { root: "pin" | "keep", blend });  // a pure scrub of a baked clip
sb.placeWorld({ x, y, z }, scale, quaternion?);    // the model's own world, for root: "keep" (Selena's world, cameras.json)
sb.jaw(0..1);                                      // 0 shut, 1 wide. Unset: the face decides (0.23, the model's own mouth)
sb.face("neutral" | "smile" | "annoyed" | "surprised" | "content" | "growl" | "proud" | "sleepy", weight);
sb.look(x, y);                                     // a stage point: the eyes lead, the head follows a little
sb.follow(0..1);                                   // follow the pointer, within limits
sb.lids(0..1.3);                                   // force the eyes, over the face and the blink
sb.straighten(0..1);                               // how much of the head straightening is laid on this frame (default 1)
sb.blink(); sb.annoyBy(1); sb.calm(); sb.react("shake" | "puff" | "flutter" | "chomp" | "flinch" | "yelp", strength);
sb.annoyed; sb.annoyance;                          // the state, for the section's own use
sb.socket(name); sb.trailAnchors; sb.onMark(fn);   // hooks, section 4
sb.metre;                                          // stage px of one model metre at the dragon's depth
SilverboltActor.dollMetres;                        // 0.30: the doll's height in a socket's space
```

`place.height` is the on-screen height of the **body block**: the head with its horns, the blades and the chin, seen from the front at rest. Measured in the lab: `height: 300` drew a silhouette 303 px tall, centred on `(x, y)`. The whole dragon is about 3.5 of these long, so a side view at `height: 300` is a 1050 px dragon: a section that flies it across the screen decides where the tail goes. `yaw` positive turns the head toward screen **right** (`facing(hx, hy, toward)` in `actors/silverbolt/math.ts`, a module with no three in it, gives the yaw and pitch for a heading drawn on the screen: import it from there). `z` may be negative (smaller and behind); the nearest it may come is 0.985 of the camera distance.

A jump never flies: if `place` moves more than 0.6 of the screen height in a frame, or the scale changes by 2x, or the clip name or time jumps by more than 0.3 s, or the actor was hidden for a frame, every spring and the tail snap to the new pose. A single-frame step above a quarter of the screen height is a teleport and gives no speed to the lag springs.

## 2. How it works

Files (`silverbolt/`): `actor.ts` the class; `facts.ts` the numbers of the model (a test reads `silverbolt.facts.json` and compares); `rig.ts` the bone layer; `sampler.ts` the clip player; `pose.ts` hover, flight and dance as pure functions of a phase; `face.ts` the presets, blend and blinker; `mood.ts` the annoyed meter and the timed reactions; `tail.ts` FABRIK and the tail's damped follower; `hit.ts` the projected capsules; `marks.ts` the mark hook; `materials.ts` the toon look (`dress`, the step cuts); `straight.ts` the straight head; `preload.ts`, `index.ts`.

**Order of a frame** (`update`): integrate (snap checks, moods, face blend, velocity springs, gaze, cursor label) -> pose the bones (`rig.reset()`, a clip or nothing, the procedural pose, the head, jaw, eyes, tail wave, `rig.apply()`) -> place the group -> `updateMatrixWorld` -> the tail (read the animated joints, follow or drag, aim each bone at the next joint) -> project the hit capsules -> dress the materials. Nothing is allocated in it.

**Clips are not played by the mixer.** Three's `AnimationMixer` writes a bone only when its own last output changed; the actor puts every bone back to rest at the start of each frame (so turns never pile up), so a clip held at one time left the dragon at rest. `ClipSampler` evaluates each track's interpolant and always writes. It has `pose(name, time)` and `mix(name, time, weight)` (a second clip blended in). Loops wrap on the duration, the others hold their ends.

**Pinned or kept.** `root: "pin"` (default) puts the root bone back to its rest place and scale, so the clip animates the body at the size `place` says. The clips barely move the body against the root (the idle is nearly still; the jaw and the tail do the work), so a pinned scrub of `city_intercation03` is a snapping jaw and a swinging tail. `root: "keep"` keeps the clip's own path and scale (0.4 to 0.64 in `03`): the dragon travels through the world of the file. Use it with `placeWorld({ x: 0, y: 0, z: 0 }, 1)` and `cast.setCamera(camera)` built from `cameras.json` (field of view `vfovDeg`, `aspect = W / (1.25 H)`, `setViewOffset(W, 1.25 H, 0, 0.25 H, W, H)`, keys are a flat array with stride 7: position then quaternion, key `round(t * 30)`, near 0.01). `setCamera` lasts one draw: call it every frame.

**The bones.** Procedural turns come in two kinds (`rig.ts`): `turnLocal` about a bone's own axis (the hinge axes of the blades, the jaw, the tongue, the tail are in `facts.ts`, measured on the finished file) and `turnFrame`, a rotation in the model's frame ("yaw the head 20 degrees" needs no knowledge of the bone's roll). There is no neck bone: the head turn is carried a quarter of the way into the wing root. The eyes are bones `sb_eye_L` and `sb_eye_R`: a squash in Y is the lid (a silver socket behind the gem shows as a shut eye), a roll about the face axis is the slant, a small offset is the gaze. The lid squash was seen at 560 px (shut, open and wide are clear, the silver socket reads as a lid). The slant's direction (inner ends down when annoyed) is reasoned from the axes and the preset's sign is tested, but the eye is seen obliquely and I did not confirm the direction in a picture. At 120 px an eye is 3 px, so the mood reads by the cheek blades flaring, the crest, the head's dip and tilt, the open mouth and the glow of the crystals, which is why every face carries those and not only the eyes. Seen at 120 px: neutral, smile (a tilt, the chin up, the mouth open with the violet tongue), annoyed (wide low cheek blades, the head dipped, a closed mouth), surprised (blades up with the crystals bright and the mouth open) and growl. The smile did not read on the first sheet and was retuned (`jaw` 0.55, `headTilt` 0.15, `headDip` -0.12, `glow` 1.5, `flare` 0.2). Content, proud and sleepy are mostly eye and tilt faces: weak at 120 px, not re-checked after the tuning.

**The tail** is a chain of seven joints (`tail.ts`). Each frame the animated joint positions are read off the bones; `TailBody` follows them on springs (softer toward the tip, lengths made exact after every step) so the tail trails the body and swings back after a drag. A press on the tail starts a drag: the tip goes to the pointer's offset at the tip's own depth, limited to `maxPull` (0.42) of the tail's length, every joint takes a share of the pull (`dragWeights`, power 1.7), FABRIK makes the lengths exact, and the body chases that pose at omega 20. The chain is written back as rotations (each bone aimed at the next joint, keeping its own roll). Release lets it swing back with a flinch and a yelp.

**Light springs on the dragon's own velocity.** The head lags its sideways and vertical motion (`LAG_K` 2.4e-4 rad per px/s, at most 0.3) and the wings lift with speed. Measured: 0.17 rad at 700 px/s, back to 0 about 0.7 s after it stops.

**The look** (round two, see section 0): the toon system, no PBR. The first round used `MeshStandardMaterial` with the cast's environment and its own 1.6 px ink shell; both are gone. The two glowing parts keep a mood: the eyes' colour and the crystals' glow follow the face and go red with anger (`dressMaterials`).

## 3. Interaction

Five hit targets, ids `silverbolt.head`, `.jaw`, `.body`, `.wings`, `.tail`, each a few capsules projected once a frame (no raycast against a skinned mesh). Bias decides an overlap: jaw -8, head -6, wings -2, tail +2, body +6. The kernel gives the DOM controls priority and sets the site's cursor label from `cursor`:

| part                  | label | hover                                                            | press                                                     |
| --------------------- | ----- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| head                  | PET   | content face, head follows the pointer, a heart mark every 1.3 s | shake with a growl, a blink, sparks, meter +0.22          |
| jaw (chin and throat) | BOOP  | the jaw eases open a little                                      | chomp, a chomp mark, meter +0.10                          |
| body                  | POKE  | swells 4 percent                                                 | puff, a puff mark, meter +0.10                            |
| wings                 | FLAP  | wings lift, cheeks spread                                        | flutter, two gust marks, meter +0.06                      |
| tail                  | DRAG  | a flinch                                                         | drag with IK (above), meter +0.08 and 0.1 per second held |

The **annoyed meter** fills with pokes, drains 0.07 per second, and at 1 the dragon is annoyed for 4.5 s (a long teasing stretches it to 8 s): the `annoyed` face, a shake, a vein and stars marks, smoke every 0.45 s, a blink twice as often, the jaw working, the tail lashing, the body swelling 5 percent. Labels become STOP IT (head), GRRR (the others) and LET GO (tail), also while the pointer rests on a part. After it the meter starts at 0.3. A touch visitor presses and drags the same targets (no hover). Verified in the lab by a scripted mouse: all five parts were found by a grid scan, five pokes on the head gave 0.2, 0.39, 0.59, 0.8 and the annoyed state, the label read STOP IT, and about 7 s later it was calm.

## 4. Hooks for the helpers that are not this one

**Sockets** (`sb.socket(name)`, an `Object3D` that follows its bone; parent another actor's root with `attach` to keep its world transform, or read `getWorldPosition`). Their space is the model's: 1 unit is one metre of the 3.5 m dragon, so a doll that is 0.12 m beside the 1.4 m dragon of the clips is **0.30** tall there (`SilverboltActor.dollMetres`), and the group's scale carries it to the screen.

| socket                             | bone   | model point              | use                                                                                                                                                                                    |
| ---------------------------------- | ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `headTop`                          | head   | (0, 3.73, 0.22)          | the doll rides here (upright whatever the head does); marks of the head. Rest point: the skull between the horns and the eyes of the straightened head                                 |
| `mouth`                            | head   | (0, 3.17, 0.15)          | the middle of the gap when the jaw is at 0.7; stays put while the jaw swings. A doll box 0.12 x 0.30 x 0.08 centred on it sits between the upper teeth and the lower jaw at `jaw(0.7)` |
| `jawTip`                           | jaw    | (0, 3.256, 0.30)         | the front teeth of the lower jaw; swings with it                                                                                                                                       |
| `tongue`                           | tongue | (0, 3.265, 0.14)         |                                                                                                                                                                                        |
| `snout`                            | head   | (0, 3.33, 0.38)          | the nose tip: smoke                                                                                                                                                                    |
| `tailTip`, `bodyCentre`            | tail   |                          |                                                                                                                                                                                        |
| `wingL`, `wingR`                   | blades | (+-0.344, 3.553, -0.857) | gusts, trails                                                                                                                                                                          |
| `cheekL`, `cheekR`, `eyeL`, `eyeR` |        |                          |                                                                                                                                                                                        |

The jaw: `open` 0 to 1 maps to -0.3 rad (shut) to 1.0 (wide); the model's own mouth is 0.23. The gap between the front teeth, at the rest scale, is 0.112 m shut, 0.231 at the model's mouth, 0.396 at 0.6 rad and 0.488 wide; times 0.4 for the dragon of the clips: 0.045, 0.092, 0.158 and 0.195 m against a doll of 0.12 m, so the doll fits between the teeth from an opening of about 0.4 up.

**Comic marks** (the `fx/comic-marks` helper): `const off = sb.onMark((m) => marks.spawn(m.kind, m.at, m.strength))`. Kinds: `sparks`, `smoke`, `vein`, `sweat`, `stars`, `gust`, `puff`, `heart`, `chomp`; `m.at` is the socket (`m.socket` is its name). Nothing is drawn here. A section may also emit its own by reading the sockets.

**Trails** (the `fx/trail` helper): `sb.trailAnchors` is `[wingL, wingR, tailTip]`.

## 5. Numbers to tune

All in `actor.ts` unless said. `BEAT_HZ` 1.7 and `DANCE_HZ` 0.95 (wing beats and bars per second at speed 1). `FOLLOW` (the tail's spring frequency per joint, `[0, 9, 7.5, 6.3, 5.4, 4.7, 4.2]`, damping 0.55: lower is a longer, lazier tail). `DRAG` `maxPull` 0.42, `DRAG_OMEGA` 20. `FOLLOW_YAW` 0.55, `FOLLOW_UP` 0.35, `FOLLOW_DOWN` 0.45 (head limits toward the pointer, soft clamped; the follow eases off inside 14 to 90 px of the head so the head does not spin when the pointer is on it). `LAG_K`, `LAG_MAX`. Poke amounts in `press`. `ANNOY` in `mood.ts` (decay 0.07, hold 4.5, holdMax 8, after 0.3) and `REACTION_LENGTH`. Faces in `face.ts` (`FACES`). The poses in `pose.ts` (an amplitude of 1.2 keeps every joint under 1 rad; a test holds that). Materials, `BODY_STEPS`, `RIBBON_STEPS` and the ink weight in `materials.ts`; `HEAD_DROP` in `facts.ts` and `LIFT_SAMPLES` in `actor.ts`. `BODY_HEIGHT_M` and `BODY_CENTRE` in `facts.ts` (measured, see the comments).

## 6. Looking at it (the lab)

`window.__home.lab("silverbolt")` returns the real actor, shown and pinned, in the real renderer (the line in `kernel/lab.ts`). Every setter lasts one frame, so a script installs a per-frame driver and lets the weights settle before it freezes:

```js
const sb = (window.__sb = await window.__home.lab("silverbolt"));
const loop = (ms) => {
  window.__driver?.(sb, ms / 1000);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
window.__driver = (sb, t) => {
  sb.place({ x: 0, y: 0, z: 0, height: 300, yaw: 0.6 });
  sb.fly(t, { amplitude: 1.2 });
};
// wait 1.5 s unfrozen, then window.__home.freeze(true) and take the picture.
```

While the scene is frozen `update` still runs every frame with `dt` 0 (so the hit cache stays live and the pose holds), but weights and springs do not move: settle first. The scripts I used (angles, poses, faces, eyes, sockets, interaction, scrub with the baked camera, perf, phone and resize, the velocity springs) are in `D:\ren\aspirant-work\home\SB\` (outside the repository: `lib.cjs` has `open`, `drive`, `settle`, `sheet`). The actor exposes `snapshot()` (plain data: annoyed, meter, hover, cost, face) and `cost` (ms of `update`, exponential mean) for a probe. `sb.cast`, `sb.tail`, `sb.mats` and `sb.rig` are private in TypeScript and reachable at run time in the lab.

## 7. Checked, and how

- **Looked at, in real Chrome on the dev server** (1440 x 900 and 390 x 844): the rest pose from the front, three quarters, profile (both sides) and the back; the flight loop at four phases (amplitude 1.5) and the dance at four phases; eight faces at 560 px and at 120 px (the five main ones re-shot at 120 px after the smile was retuned); the eyes (lids 0.05, 1, 1.3 and the moods) on the near eye; sockets as coloured boxes with a doll-sized box in the mouth at jaw 0 to 1; a tail drag with a scripted mouse (up and left, then right, release and the swing back); pokes to the annoyed state and back, with the real site cursor showing PET, STOP IT, POKE and BOOP; the clip `city_intercation03` at 0, 1.5, 3, 3.73, 4.2 and 5 s, pinned, and kept with the baked camera (the kept tiles at 0 s and 5 s are empty on purpose: the baked camera has the dragon in frame only from about 1.1 s to 3.9 s; it enters from the top right at 1.5 s, passes huge, low and central at 3.73 s, leaves to the left by 4.2 s, as the recon says); a full size frame at 3.6 s (geometry, teeth, trim and the outline hold at that size, the ribbon sorts behind the armour); the phone viewport; a resize from 390 x 844 to 1000 x 700 and 1440 x 900 mid run (the outline's width follows); `dispose()` (GPU geometries 7 to 2, textures 7 to 2, no console error).
- **Measured** (real Chrome, headless, the dev server, 1440 x 900, 60 fps, GPU time not measured): `update` 0.19 to 0.22 ms on average and 0.4 to 0.8 ms at worst; the cast pass's `render` call 0.31 to 0.41 ms of CPU, at rest at height 300, flying and dancing at 600, and the kept clip. The dev server is 2 to 3 times slower than production.
- **Jumps:** a clip scrub from 1.5 s to 3.73 s in one frame gave a tail deviation of 0 on the frame of the jump and after: the springs snap.
- **Tests** (`npx vitest run src/features/home/actors/silverbolt`: 9 files, 75 tests): math, springs and the pixel camera; FABRIK (lengths exact, root fixed, out of reach straight, collapsed chain), the drag (`maxPull`), `TailBody` (trails, catches up, lengths exact, finite for a long step); faces, blink envelope and the blinker; the annoyed meter and the reactions; the poses (the wings repeat every beat, the whole flight every two, extents under 1 rad); hit capsules; the clip sampler on real three tracks; `facts.ts` against `silverbolt.facts.json`; the loading list and the file's real size. `eslint`, `tsc` and knip are clean for this folder, `scan-text` reports 0 problems.

## 8. Calls made without the owner

- The `mouth` socket is on the **head** bone, not the jaw, so a doll placed there stays in the gap while the jaw opens and closes around it. `jawTip` is the socket that swings with the jaw.
- The eyes are small. Expressions are carried by the whole head (cheek blades, crest, dip, tilt, glow, breath, tail lash) with the eyes as a detail, because at 120 px an eye is 3 px.
- The loading list has the lazy chunk of the actor (`chunk:home-silverbolt`) as well as the model, like the drone's.
- `facing`, `JAW_GAP`, `BLADE_LENGTH` and the other numbers that no code but a test or a section reads were kept only where a test uses them; `REST_LENGTH_M`, `PartRange` and `hitRange` were removed (knip).
- Poke amounts, the 4.5 s hold, the labels (PET, BOOP, POKE, FLAP, DRAG, STOP IT, GRRR, LET GO) and the reactions are my choices; the owner's request names the kinds of reaction and the annoyed state, not the numbers.

## 9. Not done, not verified

- **Hit tests and the head follow assume the pixel camera.** Under `cast.setCamera(camera)` (the baked camera of the Selena section) the capsules are projected through the pixel camera and are wrong, and the pointer gaze too. A section that wants it interactive there needs a `view(camera)` that projects through the real camera; it is not built. The dragon is not meant to be poked in the `city_intercation03` pass.
- Not looked at: touch (the targets use the pointer hub's touch rule but I did not try it), Firefox, Safari, a weak machine, GPU time, the production build, a real context loss. The actor holds no GPU object outside three's own tracking (the shell is a three material and geometry, the environment belongs to the cast), so it has no `rebuild()`; that is reasoned, not tried.
- The flight loop's hinge signs were judged by eye in stills (no blade passes through the body, the two sides beat together); nobody has seen it in motion on a screen recording.
- Not built, by the brief: the comic marks and the trail (other helpers), the doll's own parenting, the tib path and the sections' choreography, the white-out. The annoyed state lives in the shared actor, so it carries from one section to the next; call `calm()` where a section wants a fresh start.
- Pinned clips are almost still bodies (see section 2): a section that wants a body in motion uses `fly` or `dance`, or `keep`.
- **`clip()` has no weight.** Going from a clip to `fly()`, `dance()` or the rest pose swaps the base pose in one frame (the tail snap hides only the tail); clip to clip is covered by `blend`. The planned sections change mode while the dragon is off screen or at the white-out, so it should not show. The cheap shape to add it: a `weight` in `ClipOptions`, `sampler.mix(name, t, w)` over the rest pose, the procedural pose scaled by `1 - w`, and a weight ramp must not count as a clip jump in `integrate`.
- (Round one's note on the flat armour is closed by round two: the look is the toon bands now. To tune it: `TOON_LOOKS.metal` in `toon.ts`, the picks and `BODY_STEPS`, `RIBBON_STEPS` in `materials.ts`.)

## 10. Round two: checked, not checked, how to look

Probes are in `D:\ren\aspirant-work\home\TOON-SB\` (outside the repository): `lib.cjs` (opens the home, puts a plain ground behind the canvas, turns every pass but `cast` off, builds the lab actor), `run.sh` (retries a probe when another helper's edit reloads the page), `look.cjs`, `faces.cjs`, `clips.cjs`, `straight.cjs`, `sockets.cjs`, `seat.cjs`, `pokes.cjs`, `perf.cjs`, `sec.cjs` (the real section at a fraction of its length: `node sec.cjs name bolt:0.2,bolt:0.6 [w h]`).

- **Checked:** the straight head in rest, fly, dance, and all five clips (pinned), side, 3/4 and front; eight faces; the sockets as boxes on the straight head (headTop upright on the skull, snout at the nose, jawTip at the lower teeth); the scripted pointer test (all five parts found, PET, STOP IT, POKE, FLAP and BOOP, the annoyed state after six pokes, and every mark: heart, sparks, vein, stars, smoke, puff, gust, chomp); the doll on the head in the real bolt section, desktop and phone; ink at 120 px, 650 px and 1200 px, and the thin blades (no artefact). 87 unit tests in the folder, 164 with the shared toon files; lint, tsc, prettier and `scan-text` clean for the folder; knip reports nothing of this folder.
- **Cost:** the draw calls of the dragon are the same as round one (body, hull, eyes, lids, crystals, ribbon: six). The cast pass in real Chrome on the shared machine, with `gl.finish`: 1.6 to 2.4 ms with the dragon, 1.8 with it hidden (the drone and the rest are in that number), 45 to 56 fps while ten helpers shared the GPU: the dragon adds under 0.6 ms in any state, 2.4 ms at 1400 px. `update` was 0.65 to 0.88 ms on that loaded machine (0.2 on a quiet one in round one); what round two adds per frame is a quaternion premultiply, two map reads and three uniform writes.
- **Not verified:** the Selena section's film (the dragon under the baked camera, the doll in the mouth, the bite): the section did not show the dragon at any fraction I shot, so I could not see it. The straightening is on there by default (the clip is `city_idle` kept, blended with `city_intercation03`); the per clip lift keeps the clip's motion, but the head is about 20 degrees more level than the recording and the doll in the mouth is turned with the head. If the bite no longer lines up, call `sb.straighten(1 - b.pose)` there. A dragon at the first screen of the home (no section uses it there); other browsers and GPUs; the toon ink with the corrected normal on the doll, the hand and Selena (only Selena was looked at).

## Round four: rider sockets and shake

Written early by SB-dragon (20 Nov 2026). The request: `docs/superpowers/specs/2026-11-20-home-feedback-4-request.md`. The API below is what the actor gives to the bolt section and to the doll helper. Numbers marked (tune) are placed by eye and may move by a few percent: the names and meanings will not.

**Side view and length.** The dragon's default orientation is now a pure side view: yaw -PI/2 (nose toward screen left), the body axis in the screen plane, nothing toward the camera. `place({ heading })` is new: the screen angle of the nose in radians (0 right, PI/2 up, 3PI/4 upper left, the bolt section's heading), and it gives the exact side view for any heading (the dragon never turns upside down: a heading to the left uses the left facing pose and tilts it). `yaw`, `pitch` and `roll` still work and win over a default, but `heading` overrides them when it is set. A section that lets the dragon fly any other way than the side view is a bug now. The whole body is about 3.6 m long at the model scale: `SilverboltActor.LENGTH_M` (snout to tail tip, rest). On screen it is `sb.metre * LENGTH_M` pixels long (`height` of `place` is still the body block, 1 m: `height = lengthPx / LENGTH_M` makes a dragon of a given length). Nothing is stretched or squashed: the proportions are the model's, and the body block never changes its scale except a 2 percent breath.

**The head is locked.** It is straight and parallel to the body (round two's `straightenHead`) and has no motion of its own any more: no follow, no look, no dip, no tilt, no lag, no hover or press reaction. When the pointer moves only the body answers: a slow lean (a turn in the screen plane, at most 0.12 rad), a small bank (0.07 rad), a shift along the body of at most 0.09 m toward the pointer, and a livelier tail wave. Call `sb.follow(1)` every frame to give the pointer its full say (the lean is measured against the body's own axis: a pointer straight ahead of or behind the dragon leans it little, a pointer above or below it leans it most). The head is one rigid piece with the body, so it leans with it. `sb.follow(w)` and `sb.look(x, y)` still exist and now steer the body lean only. The eyes do not follow the pointer. The head and the jaw hit targets are folded into the body target (label POKE); wings (FLAP) and tail (DRAG) stay.

**Shake (the throw).** `sb.shake(strength: 0..1)` starts one hard whole body shake of 0.8 to 1.2 s (longer with strength): the body rattles along its own axis with a decaying oscillation (about 6 Hz, up to 0.12 m at strength 1), a brief violent roll of the spine (about 0.35 rad), the wings and cheek blades flare. It is a pure pose: no collision, no hit. `sb.shakeAmount` is the envelope 0..1 over time (1 at the start, 0 at the end), `sb.shakeOsc` is the signed oscillation -1..1 (positive is the motion toward the tail), for the rider's physics to read on the same frame. Calling `shake` while one is running restarts it at the larger strength.

**Rider sockets** (`sb.socket(name)`, as before; the old ones keep working):

| socket      | on bone          | meaning                                                                                                                                               |
| ----------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seat`      | neck (wing root) | where the doll sits: the top of the neck behind the head. Orientation: model frame (+Y up, +Z the nose). It follows the body's lean and shake. (tune) |
| `gripL`     | head             | the left crest edge, where her left hand holds. Position only. (tune)                                                                                 |
| `gripR`     | head             | the right crest edge. Position only. (tune)                                                                                                           |
| `headPoint` | head             | the middle of the head (between the eyes and the cheek blades): the point the section anchors the flight on and points a camera at                    |
| `snout`     | head             | the nose tip (old)                                                                                                                                    |

`sb.motion` is a plain object updated every frame (read only, no allocation): `seatVel` (stage px per second of the `seat` socket's world position, x, y, z), `seatAcc` (px per second squared, the first difference of `seatVel` over the frame), `shake` (the envelope), `shakeOsc`, `lean` (the body's lean in radians) and `tilt` (the angle of the body axis in the screen, radians, so the doll knows her seat's up). The doll may equally compute velocity from the socket's `getWorldPosition` frame to frame: both are right, `motion` is cheaper and already smooth.
