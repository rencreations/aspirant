# Home actor: Silverbolt (workstream SB)

The dragon of the rebuilt home. A plain class (`apps/web/src/features/home/actors/silverbolt/`) that a section drives and the shared cast pass draws. Model and facts: `docs/design/home/models-selena-silverbolt.md` (`public/models/home/silverbolt.glb`, 300,108 B, and `silverbolt.facts.json`). Built 18 Nov 2026.

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
sb.blink(); sb.annoyBy(1); sb.calm(); sb.react("shake" | "puff" | "flutter" | "chomp" | "flinch" | "yelp", strength);
sb.annoyed; sb.annoyance;                          // the state, for the section's own use
sb.socket(name); sb.trailAnchors; sb.onMark(fn);   // hooks, section 4
sb.metre;                                          // stage px of one model metre at the dragon's depth
SilverboltActor.dollMetres;                        // 0.30: the doll's height in a socket's space
```

`place.height` is the on-screen height of the **body block**: the head with its horns, the blades and the chin, seen from the front at rest. Measured in the lab: `height: 300` drew a silhouette 303 px tall, centred on `(x, y)`. The whole dragon is about 3.5 of these long, so a side view at `height: 300` is a 1050 px dragon: a section that flies it across the screen decides where the tail goes. `yaw` positive turns the head toward screen **right** (`facing(hx, hy, toward)` in `actors/silverbolt/math.ts`, a module with no three in it, gives the yaw and pitch for a heading drawn on the screen: import it from there). `z` may be negative (smaller and behind); the nearest it may come is 0.985 of the camera distance.

A jump never flies: if `place` moves more than 0.6 of the screen height in a frame, or the scale changes by 2x, or the clip name or time jumps by more than 0.3 s, or the actor was hidden for a frame, every spring and the tail snap to the new pose. A single-frame step above a quarter of the screen height is a teleport and gives no speed to the lag springs.

## 2. How it works

Files (`silverbolt/`): `actor.ts` the class; `facts.ts` the numbers of the model (a test reads `silverbolt.facts.json` and compares); `rig.ts` the bone layer; `sampler.ts` the clip player; `pose.ts` hover, flight and dance as pure functions of a phase; `face.ts` the presets, blend and blinker; `mood.ts` the annoyed meter and the timed reactions; `tail.ts` FABRIK and the tail's damped follower; `hit.ts` the projected capsules; `marks.ts` the mark hook; `materials.ts` the look and the ink shell; `preload.ts`, `index.ts`.

**Order of a frame** (`update`): integrate (snap checks, moods, face blend, velocity springs, gaze, cursor label) -> pose the bones (`rig.reset()`, a clip or nothing, the procedural pose, the head, jaw, eyes, tail wave, `rig.apply()`) -> place the group -> `updateMatrixWorld` -> the tail (read the animated joints, follow or drag, aim each bone at the next joint) -> project the hit capsules -> dress the materials. Nothing is allocated in it.

**Clips are not played by the mixer.** Three's `AnimationMixer` writes a bone only when its own last output changed; the actor puts every bone back to rest at the start of each frame (so turns never pile up), so a clip held at one time left the dragon at rest. `ClipSampler` evaluates each track's interpolant and always writes. It has `pose(name, time)` and `mix(name, time, weight)` (a second clip blended in). Loops wrap on the duration, the others hold their ends.

**Pinned or kept.** `root: "pin"` (default) puts the root bone back to its rest place and scale, so the clip animates the body at the size `place` says. The clips barely move the body against the root (the idle is nearly still; the jaw and the tail do the work), so a pinned scrub of `city_intercation03` is a snapping jaw and a swinging tail. `root: "keep"` keeps the clip's own path and scale (0.4 to 0.64 in `03`): the dragon travels through the world of the file. Use it with `placeWorld({ x: 0, y: 0, z: 0 }, 1)` and `cast.setCamera(camera)` built from `cameras.json` (field of view `vfovDeg`, `aspect = W / (1.25 H)`, `setViewOffset(W, 1.25 H, 0, 0.25 H, W, H)`, keys are a flat array with stride 7: position then quaternion, key `round(t * 30)`, near 0.01). `setCamera` lasts one draw: call it every frame.

**The bones.** Procedural turns come in two kinds (`rig.ts`): `turnLocal` about a bone's own axis (the hinge axes of the blades, the jaw, the tongue, the tail are in `facts.ts`, measured on the finished file) and `turnFrame`, a rotation in the model's frame ("yaw the head 20 degrees" needs no knowledge of the bone's roll). There is no neck bone: the head turn is carried a quarter of the way into the wing root. The eyes are bones `sb_eye_L` and `sb_eye_R`: a squash in Y is the lid (a silver socket behind the gem shows as a shut eye), a roll about the face axis is the slant, a small offset is the gaze. The lid squash was seen at 560 px (shut, open and wide are clear, the silver socket reads as a lid). The slant's direction (inner ends down when annoyed) is reasoned from the axes and the preset's sign is tested, but the eye is seen obliquely and I did not confirm the direction in a picture. At 120 px an eye is 3 px, so the mood reads by the cheek blades flaring, the crest, the head's dip and tilt, the open mouth and the glow of the crystals, which is why every face carries those and not only the eyes. Seen at 120 px: neutral, smile (a tilt, the chin up, the mouth open with the violet tongue), annoyed (wide low cheek blades, the head dipped, a closed mouth), surprised (blades up with the crystals bright and the mouth open) and growl. The smile did not read on the first sheet and was retuned (`jaw` 0.55, `headTilt` 0.15, `headDip` -0.12, `glow` 1.5, `flare` 0.2). Content, proud and sleepy are mostly eye and tilt faces: weak at 120 px, not re-checked after the tuning.

**The tail** is a chain of seven joints (`tail.ts`). Each frame the animated joint positions are read off the bones; `TailBody` follows them on springs (softer toward the tip, lengths made exact after every step) so the tail trails the body and swings back after a drag. A press on the tail starts a drag: the tip goes to the pointer's offset at the tip's own depth, limited to `maxPull` (0.42) of the tail's length, every joint takes a share of the pull (`dragWeights`, power 1.7), FABRIK makes the lengths exact, and the body chases that pose at omega 20. The chain is written back as rotations (each bone aimed at the next joint, keeping its own roll). Release lets it swing back with a flinch and a yelp.

**Light springs on the dragon's own velocity.** The head lags its sideways and vertical motion (`LAG_K` 2.4e-4 rad per px/s, at most 0.3) and the wings lift with speed. Measured: 0.17 rad at 700 px/s, back to 0 about 0.7 s after it stops.

**The look.** `MeshStandardMaterial` from the loader, given the cast's environment: body `metalness 0.32`, `roughness 0.46`, `envMapIntensity 0.85`; gem and crystal emissive and glassy; the ribbon `transparent`, `depthWrite false`, `renderOrder 1`. The two emissive parts get a mood: glow follows the face, the tint goes red with anger. An ink outline: a second `SkinnedMesh` over the head's skeleton with a back-face material, pushed along the screen-space normal by 1.6 CSS px (the same width at any size, `OUTLINE_PX` in `materials.ts`), colour `#1c1233`, with a polygon offset so thin blades do not speckle. The shell follows the canvas size without a rebuild. No tone mapping (the cast has none).

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
| `headTop`                          | head   | (0, 3.93, -0.1)          | the doll rides here; marks of the head                                                                                                                                                 |
| `mouth`                            | head   | (0, 3.17, 0.15)          | the middle of the gap when the jaw is at 0.7; stays put while the jaw swings. A doll box 0.12 x 0.30 x 0.08 centred on it sits between the upper teeth and the lower jaw at `jaw(0.7)` |
| `jawTip`                           | jaw    | (0, 3.256, 0.30)         | the front teeth of the lower jaw; swings with it                                                                                                                                       |
| `tongue`                           | tongue | (0, 3.265, 0.14)         |                                                                                                                                                                                        |
| `snout`                            | head   | (0, 3.52, 0.52)          | smoke                                                                                                                                                                                  |
| `tailTip`, `bodyCentre`            | tail   |                          |                                                                                                                                                                                        |
| `wingL`, `wingR`                   | blades | (+-0.344, 3.553, -0.857) | gusts, trails                                                                                                                                                                          |
| `cheekL`, `cheekR`, `eyeL`, `eyeR` |        |                          |                                                                                                                                                                                        |

The jaw: `open` 0 to 1 maps to -0.3 rad (shut) to 1.0 (wide); the model's own mouth is 0.23. The gap between the front teeth, at the rest scale, is 0.112 m shut, 0.231 at the model's mouth, 0.396 at 0.6 rad and 0.488 wide; times 0.4 for the dragon of the clips: 0.045, 0.092, 0.158 and 0.195 m against a doll of 0.12 m, so the doll fits between the teeth from an opening of about 0.4 up.

**Comic marks** (the `fx/comic-marks` helper): `const off = sb.onMark((m) => marks.spawn(m.kind, m.at, m.strength))`. Kinds: `sparks`, `smoke`, `vein`, `sweat`, `stars`, `gust`, `puff`, `heart`, `chomp`; `m.at` is the socket (`m.socket` is its name). Nothing is drawn here. A section may also emit its own by reading the sockets.

**Trails** (the `fx/trail` helper): `sb.trailAnchors` is `[wingL, wingR, tailTip]`.

## 5. Numbers to tune

All in `actor.ts` unless said. `BEAT_HZ` 1.7 and `DANCE_HZ` 0.95 (wing beats and bars per second at speed 1). `FOLLOW` (the tail's spring frequency per joint, `[0, 9, 7.5, 6.3, 5.4, 4.7, 4.2]`, damping 0.55: lower is a longer, lazier tail). `DRAG` `maxPull` 0.42, `DRAG_OMEGA` 20. `FOLLOW_YAW` 0.55, `FOLLOW_UP` 0.35, `FOLLOW_DOWN` 0.45 (head limits toward the pointer, soft clamped; the follow eases off inside 14 to 90 px of the head so the head does not spin when the pointer is on it). `LAG_K`, `LAG_MAX`. Poke amounts in `press`. `ANNOY` in `mood.ts` (decay 0.07, hold 4.5, holdMax 8, after 0.3) and `REACTION_LENGTH`. Faces in `face.ts` (`FACES`). The poses in `pose.ts` (an amplitude of 1.2 keeps every joint under 1 rad; a test holds that). Materials and `OUTLINE_PX` in `materials.ts`. `BODY_HEIGHT_M` and `BODY_CENTRE` in `facts.ts` (measured, see the comments).

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
- The model's silver armour reads a little flat and white against the daybreak ground; it is the model's own painted palette with the cast's environment on top. A darker ground (the storm sections) will show the gold and violet more. Tune `envMapIntensity` and `metalness` in `materials.ts` if the owner wants more punch.
