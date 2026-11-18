# Home: the doll actor (workstream DL, 18 Nov 2026; round two TOON-DOLL, 19 Nov 2026)

Obsidia's doll as a plain TypeScript actor of the home stage. Code: `apps/web/src/features/home/actors/doll/`. Assets and their checks: `docs/design/home/models-doll-gramophone.md` (read its "What an actor needs"). Design: `docs/superpowers/specs/2026-11-18-home-page-redesign.md`. Kernel: `docs/design/home/kernel.md`.

## Round two (19 Nov 2026): the toon look and the smaller doll

The owner (`docs/superpowers/specs/2026-11-19-home-feedback-request.md`): every 3D model in the anime style of Tetra and the drone, and "the obsidia doll are too big".

**The look.** She is drawn with the shared toon system (`actors/shared/toon.ts`, `toon.md`), no PBR, no environment, no scene light. Her one skinned mesh is sorted at build into three groups by `parts.ts` and drawn as a material array: cloth (look `default`), skin (look `skin`, rim 0.22) and hair (look `hair`, glint 0.6). A vertex is hair when its weight is mostly on the `Head` bone and it is not in the face shell (`_face`), skin when it is in the face shell or on a shoulder, arm or hand bone, cloth otherwise; a triangle takes the part most of its corners have. The numbers are in `look.ts` (`PART_LOOKS`, `INK_BOOST`, `INK_SLOPE`, `trimLook`).

**The face** is still her own GLSL (24 expressions, unchanged: `face/shader.ts` is generated and untouched). `face/toon-face.ts` wires it into the skin's toon material: the drawn features (eyes, glyphs, brows, tears, mouth, sweat) write their coverage into `gPaint` (eight one line patches of the generated text, each checked by `toon-face.test.ts`), and the pixel is the toon shade of the skin with the features laid back on top unshaded (`mix(outgoingLight, diffuseColor.rgb, clamp(gPaint * 1.5, 0, 1))` before `#include <opaque_fragment>`). So a band edge never crosses an eye, and the lashes and brows are the ink colour (`uInk` is `INK_COLOR`). The blush, flush, shock and gloom lines are skin colour and are shaded with the face. The program key is `home-toon-b2-doll-face-v2` (never share it with another actor).

**The line** is `ink.ts`, not the toon system's hull. A hull pushed along the normals cannot outline her: her hair is open sheets with no inside (measured: the hull's silhouette equalled the body's, the ring was missing along most edges). The mesh is drawn again 8 times in `INK_COLOR`, each copy shifted on the screen by the line's width in another direction and sent back in depth. The depth push is `INK_SLOPE` (7) line widths and moves only the depth: the toon system's view space push also shrinks the copy toward the middle of the screen, harmless for a pixel and fatal for 30 (it ate the line; found by comparing the masks of the ink alone and the body alone). The width is the toon system's `outlineFor` for her drawn height, times `inkBoost(h)` (1 under 100 px tall, 1.4 over 400). It gives a clean outer line, and inner lines where a part is more than the push in front of another (hair over the face, the head over the collar). 11 draw calls (3 groups and 8 ink copies), 129k triangles, `update` 0.07 ms.

**The size.** `DOLL_SIZE` 0.6 (`place.ts`, exported with `drawnHeight` from `index.ts`). A section still asks for the height it always asked for; the actor draws 60 percent of it. It is applied once, to `rootScale` and `fitScale` (so `place`, the fitting under a socket, the hang and the hop), and the hit shapes, the sockets and `markPoint` follow because they come from her matrices. `pheight` stays the height ASKED (the head's lag, the fall's stretch and the jump test are in the asked height, so they feel as before); `attach` and `detach` convert her world height back (`/ DOLL_SIZE`), so an attach round trip does not shrink her again. `walkPhaseFor`, `strideSpeed` and `walkRateFor` apply it too (the chase's feet do not slide). J6 (fall to hand) compares asked heights on both sides, so it is unchanged. Drawn heights seen on the live page at 1440x900: on Silverbolt's head about 75 px, in the fall about 80 to 130, in Selena's palm about 100, on the list frame's top edge about 80, hanging from the top about 90.

**Section edits the smaller doll needed** (surgical, in other helpers' files):

- `sections/bolt/scene.ts`: `SEAT` y 0.12 to 0.5 and z 0.4 to 0.8 (the pivot is her hips and she shrinks toward them, so at the old seat she sank behind the head plate; now she rides between the horns and her face reads); the mark size `max(46, dollHeight * 0.55)` to `max(30, drawnHeight(dollHeight) * 0.6)`.
- `sections/chase/runtime.ts`: the speed lines' anchor and the dust read `drawnHeight(g.dollH)`.
- `sections/funny/runtime.ts`: `DOLL_SCALE` 1.7 to `1.45 / DOLL_SIZE` (the gag needs her wedged in the mouth: she is now drawn at 1.45 mouths, 15 percent smaller than before, still bigger than the mouth). NOT SEEN: the funny and the chase sections had no doll on the live page while I looked (other helpers were rewriting the timeline); these two edits are by reading the code.
- `actors/doll/index.ts`: exports `DOLL_SIZE` and `drawnHeight`.

**API changes.** `light(direct = 1, ambient = 1)` replaces `light(direct, ambient, env)`: it trims her looks (`trimLook`: the lit colour by `direct`, the shades by `ambient`); the environment is gone. No other method changed. `dispose` frees the source material's textures (the normal, metalness and roughness maps are no longer uploaded: `warm` sends only her picture).

**Tests added**: `parts.test.ts`, `ink.test.ts` (the shader anchor in three's basic vertex shader, the exact depth line), `face/toon-face.test.ts` (every paint anchor appears once in the generated face text, the patched fragment has the face before the shade and the features after it), `look.test.ts`, `place.test.ts` (`DOLL_SIZE`), `motion.test.ts` (the stride). 161 tests in the folder.

**How to look.** `D:\ren\aspirant-work\home\TD\`: `matrix.cjs <tag> [faces|poses|sizes]` (all 24 faces at 600 and 120, ten poses at two yaws, four sizes; the lab on a plain ground), `look1.cjs`, `sizes2.cjs`, `bysec.cjs id:local,...` (the real page at a section's local position, `W=390 H=844` for the phone), `perf.cjs`, `inktest.cjs` (width and push side by side). `window.__home.seek(0)` is a fair ground for the lab (do not seek near the end: the footer action leaves the page).

**Not done, not verified.** The funny and chase placements (above). The line under a baked camera (Selena's film): it is sized from the pixel camera's height. Firefox, Safari, a real phone (390x844 touch at dpr 2 was seen in the palm and the list frame: she reads; the ride frame on the phone showed no doll at one scroll position, not traced, Silverbolt's head was being changed by another helper). GPU time (the pass cost read 0.07 ms with `gl.finish`, too small to be the GPU: treat it as the submit cost; the frame time median stayed 16.7 ms with her shown or hidden, p95 18.3 against 17.4). Faces at 60 px drawn are told apart by colour and by the glyphs; the subtle five (neutral, pout, gloom, worried, annoyed) are close, as before. The pale rim on the shadow side of the face shell still shows as a thin lilac line inside the face edge at big sizes (rim 0.22; lower it in `PART_LOOKS` if the owner dislikes it). The line is 8 copies: a width over 4 px would scallop (it is capped at 3.5 x 1.4). A pose whose hair sheets cross at a grazing angle can still show a short stray ink stroke where a shifted copy wins the depth test (seen at a push of 0.018 of the height, not at the shipped 7 widths).

## Files

```
index.ts        ensureDoll(ctx) (builds once, warms the GPU), type and helper re-exports (DOLL_SIZE, drawnHeight, walkPhaseFor)
parts.ts        pure: sorts the triangles into cloth, skin and hair (the three groups and materials)
look.ts         the three looks, the ink numbers, trimLook (the numbers to tune the look by eye)
ink.ts          the line: eight shifted copies of the mesh in ink, depth only push
face/toon-face.ts  the face shader wired into the toon material (paint mask, patches, tested)
actor.ts        DollActor: the whole API below (one class, no React)
preload.ts      dollItems({ deferred?, priority? }), DOLL_MODEL_PATH, DOLL_MODEL_BYTES (no three here: safe for a section's preload.ts)
place.ts        pure: depth scale, rootScale, fitScale, projection, circle and capsule hit shapes
motion.ts       pure: Spring (exact for any dt), approach, hash, stride (walkPhaseFor, walkRateFor, strideSpeed)
hang.ts         HANG_POSE, rollToHang, hangSway, wrapPi
interaction.ts  Reactions: hover hop, press squeak and spin, spam dizzy (a state machine, no three)
rig.ts          GENERATED from public/models/home/doll-rig.json (22 bones, walk, face points)
pose/poses.ts   GENERATED from scripts/home/models/doll/poses.json (the nine poses)
pose/math.ts    flat typed-array pose data, the model-axis turn formula, blend, stretchArm
pose/layers.ts  turns added on a pose: flail, breath, run lean, dangle, head
pose/walk.ts    WalkSampler: reads the baked clip at any phase (no mixer)
face/presets.ts GENERATED from scripts/home/models/doll/face/presets.json (55 floats, 24 faces)
face/shader.ts  GENERATED from scripts/home/models/doll/face/face.glsl (the four chunks)
face/mix.ts     FACES, mixFaces (glyph swap behind a blink), autoBlink, applyLive, talk
face/sequence.ts moodAt: the mood sequencer
gen.mjs         regenerates the four GENERATED files:  node apps/web/src/features/home/actors/doll/gen.mjs, then prettier
```

`*.test.ts` sits beside each (135 tests). `rig.test.ts`, `face/mix.test.ts` read the asset files and fail when a copy drifts from its source.

## API (what a section uses)

```ts
import { ensureDoll } from "../../actors/doll";            // lazy: in the section's runtime
import { dollItems } from "../../actors/doll/preload";     // in the section's preload.ts
const doll = await ensureDoll(ctx);                        // the section's ctx, or a plain ActorCtx

// Every frame the section shows her (the kernel hides every actor first):
doll.visible = true;
doll.place({ x, y, z, height, yaw, pitch, roll, pivot });  // stage pixels; height = on-screen height standing; pivot "feet"|"hips"|"center"|"head"|"handL"|"handR"
doll.pose("scream", w);                                    // name over "stand" at weight w (stand ride scream fall sit run held reach rest)
doll.setPose("stand", "sit", w);                           // blend two poses, scrub with the scroll
doll.walk(weight, { phase, rate, lean });                  // baked walk over the pose; phase = cycles (scrub by distance: walkPhaseFor(px, height)), or rate for time; lean 0..1 is the run lean
doll.flail(amount, rate); doll.dangle(amount);             // fall flail, swinging shins
doll.squash(-0.3..0.3); doll.stretch("L"|"R", 0..1);       // squash and stretch, arm stretch (1.6x at 1)
doll.hang(w, swing);                                       // the faked hang by one hand (below)
doll.bump(strength);                                       // a landing: squash, head kick, hang swing
doll.face("angry", w);                                     // preset over neutral at weight w (pure, scrubbable)
doll.setFace("neutral", "dizzy", w);                       // two presets, blend w
doll.mood(steps, t);                                       // mood sequencer: steps [{ face, hold, blend? }], t seconds
doll.faceTo("shocked", 0.2);                               // timed change from the face now (call once, or every frame with the same name)
doll.talk(0..1); doll.blinkAuto(true); doll.look({ x, y } | null);   // mouth wobble, blink, eyes (stage pixels)
doll.socket("handL"|"handR"|"headTop"|"head"|"mouth"|"cheekL"|"cheekR"|"hips"): Object3D;   // moves with the bone
doll.markPoint("headTop", out): { x, y, s, unit };         // stage pixels, for a comic mark to follow; valid after update
doll.attach(otherActor.socket, { keepWorld? }); doll.detach();   // reparent under a socket; place() is then an offset in the socket's axes
doll.onReact = (kind: "hover" | "press" | "dizzy") => {};  // marks (stars, sweat) hang on this
doll.setInteractive(false); doll.light(direct, ambient); doll.reset();   // light: round two, no env
```

`reset()` puts every section-set target back to rest (stand, no walk, no flail, no hang, no look, no talk). Placement, face and attachment stay. A section that wants a clean state each frame calls it first. `tunePose(name, def)` replaces a pose with a hand authored one (turns in degrees about the model's axes).

`place` sets the whole placement (an omitted field is its default). `height` is her on-screen height standing, feet to the crown of the hair, whatever the depth `z` or the parent's scale. A jump of the target larger than 1.2 heights in one frame resets the springs (head lag, squash), so a scrollbar drag leaves nothing flying (checked: after a 2000 px jump the three springs are 0, after a 40 px a frame drag the head roll is 0.19).

**Cast pass.** She is drawn in the shared `cast` pass (perspective, order 30). To sit in Silverbolt's mouth or Selena's palm attach to a socket of an actor in the same pass: a socket of another pass draws her unlit and in the wrong depth.

## How it works

- **Hierarchy.** `root` (position, rotation order ZXY: yaw about her own vertical, then pitch, then roll in the screen plane; scale) > `squash` (scale about the pivot) > `shift` (puts the pivot at the origin) > the GLB group (22 bones, the one skinned mesh `doll_body`, frustum culling off because the bounds are the bind pose's). The pivot is a point of the model or her posed hand.
- **Poses** are turns about the MODEL's axes (+X her left, +Y up, +Z forward) in the parent's bind frame: `q = inv(pBind) * R * pBind * restLocal`. The limb bones are Blender frames and the two sides are not mirrors, so this is the only safe way (`pose/math.test.ts` proves a turn changes a bone's world rotation by exactly R, for every bone). Poses, the walk and the layers are flat typed arrays blended by slerp; nothing is allocated per frame.
- **Layers** (all pure in time and a few numbers): `addFlail` (every limb at its own rate, knees one way only), `addBreath` (always on), `addRunLean`, `addDangle`, `addHead` (a spring on the head's roll and nod from her own motion, plus the look turn). A fast fall stretches her up to 16 percent along her height.
- **Walk.** The baked `walk` (32 keys, 22 rotation tracks and the hips, in place) is read by `WalkSampler` at a phase, not played by a mixer (a mixer would fight the poses). Scrub it by distance: `walk(1, { phase: walkPhaseFor(distancePx, height), lean: 1 })`. At rate 1 the planted foot moves at `WALK_SPEED` (0.5418 file units a second). A run is rate 2 to 2.4 with `lean`.
- **Face.** The shader chunks of the asset are wired into `doll_body.material.onBeforeCompile` (`_face` attribute, `uFaceF[56]`, `uFaceFrame`, `uIrisL/R`, `uInk`). An expression is 55 floats; `mixFaces` lerps any two. Two faces of different eye families (open eyes, or one of eight glyphs) would ghost, so below the middle of the blend the glyphs are `a`'s, above it `b`'s, and both lids shut across the middle (`SWAP_HALF` 0.14): the swap is behind a blink. `faceTo` takes at least 0.2 s for such a change. **Hold a glyph face (spirals, hearts, sparkles, `X X`, `> <`, arcs) at weight 0 or 1.** `face("dizzy", 0.5)` held still shows shut lids (the swap blink is at its peak at the middle); a weight is for passing through. Live layers on top, each frame: automatic blink (only on the open-eye share, a double blink one time in five), the eyes' look, the spirals' turn, and `talk`. Talk on an open mouth (scream, cursing, laughing) opens and closes it between 28 percent and all of its own; on a line mouth it turns into a grin that follows syllables (`talkWobble`, about six a second). Comic cues (sweat, anger vein, stars, grawlix) are not in the shader: use the marks pass with `markPoint` and `onReact`.
- **Light.** (Round one: PBR with the shared environment. Round two: the toon system, see the top of this note.) The toon light is `getCast(stage).toon`, shared by every toon character; the doll never writes it. `light(direct, ambient)` trims her own looks.
- **Interaction.** One hit target `doll` with cursor `POKE`: a circle on the head and hair (0.56 of the file's height) and three capsules (trunk, two legs), projected once a frame from the final bones; `test` is 4 distance checks. Hover: she looks at the pointer, a hop of 7 percent of her height, `onReact("hover")`. Press: a random squeak face (shocked, angry or dizzy) for 0.95 s, one spin about her vertical (a spring that lands exactly on a whole turn and resets the angle), squash and stretch. Three presses within 1.5 s: dizzy for 2.6 s (spirals, head wobble). Every reaction has a fixed length: 12 s of random hovers and presses, then 6 s of nothing leaves `busy` false and spin, hop, squash and wobble at 0 (`interaction.test.ts`).
- **The faked hang by one hand.** The rig cannot do it: her arm is 0.52 of 1.7 and head plus hair are 59 percent of her height, so an arm raised straight up ends behind the bangs from every side. What `hang(w)` does: the left arm is raised 104 degrees about Z and stretched three times (the rig's recipe: the upper arm bone is scaled, the hand bone scaled back, never the forearm), which brings the mitten out above the crown; the other arm and the legs go limp; her pivot slides from the section's pivot to her left hand as `w` grows (so a section places the hand at the ledge: `place({ x, y })` is then the hand); and the root rolls about the hand so the line from the hand to her hips points straight down, 24 degrees at full weight, with a small pendulum (`hangSway`) and a swing from `bump()`. The roll uses the line of the FULL hang pose measured once (`measureHang`), so it grows smoothly with `w` (an earlier version used the pose of the moment and flipped by 140 degrees at `w` 0.45: caught on a sweep and fixed). A forward arm (the `reach` pose) was tried and rejected: the hand is then over her face and the roll needed is 55 to 75 degrees, which reads as lying on her side. What it does not give: a hand that grips. The mitten shows as a small fork above the hair at 360 px tall and is a thumb's width wide, and the arm is a thin stretched tube. A section that wants a grip puts its own ledge or fingers over the mitten (the `below` DOM is under the canvas, so a ledge cannot hide the hand: draw the ledge in a perspective or ortho pass above, or leave the hand in the open).
- **Attach.** `attach(socket)` keeps her world transform (checked: the world matrix differs by 3e-14 after attaching to a dummy with a roll and a scale of 2.5, follows the dummy when it moves by exactly its move, and `detach()` changes it by 1e-14). Her size is fitted to her own world depth, so `height` stays her on-screen height. `{ keepWorld: false }` puts her upright at the socket's origin. Her hit shapes and `markPoint` read the parent's matrices as they stand when her `update` runs: if the other actor poses its bones after her in the frame they lag one frame (the drawing does not, three updates the whole scene before it draws). The kernel should update a parent before the actors attached to it. The doll of 12 cm next to Silverbolt's 1.4 m body needs nothing more than `place({ height: 90 })`.
- **GPU.** `ensureDoll` awaits `warm()`: it compiles her program (about 3 ms to queue it) and sends her three maps to the GPU one to a frame (about 25 ms together on a fresh load, measured twice at 24 and 28 ms; spread over three frames so a scroll drops none). It sits inside the section's mount, which runs about two screens ahead, so a section far down the page pays it while the visitor scrolls: put `dollItems()` in the loading list so the model itself is already in memory. `stats.warmMs` and `stats.warmCompileMs` say what it took. She holds nothing outside three's own tracking (no render targets, no PMREM of her own: the environment is the cast's), so a lost context needs no `rebuild()` of hers. `dispose()` frees the geometry, skeleton, maps and material, removes the hit target and forgets the parsed model. Nothing is allocated in a frame (the live face layer, the mood sequencer and every vector are reused).

## Numbers to tune

`actor.ts`: `HEAD_HIT` (0.56), `BODY_HIT_R`, `LEG_HIT_R`, `HOP_SHARE` 0.07, `STRETCH_SPEED` 7 and `MAX_STRETCH` 0.16 (the fall's stretch), `JUMP_HEIGHTS` 1.2, `DEFAULT_LIGHT`, the head springs (omega 15, zeta 0.3). `hang.ts`: `HANG_POSE` (arm 104 degrees, stretch 3), `hangSway`. `interaction.ts`: `HOP_SECONDS`, `SQUEAK_SECONDS`, `DIZZY_SECONDS`, `SPAM_COUNT`, `SPAM_WINDOW`, the springs and the `squash` scale. `pose/layers.ts`: every amplitude in degrees. `pose/math.ts`: `MAX_ARM_SCALE` 3.2. `face/mix.ts`: `SWAP_HALF`, the blink timing in `autoBlink`, `talkWobble`. The nine poses and the 24 faces are the asset's: change them at their source (`scripts/home/models/doll/`) and run `gen.mjs`.

## How to look (the lab)

Dev server on 3100, real Chrome through Playwright with `sessionStorage aspirants:intro = off`, `aspirants:entered = 1`, `localStorage aspirants:consent = {choice:"rejected"}`; open `/`, wait for `window.__home.state().open`, then:

```js
const d = await window.__home.lab("doll"); // real actor, real renderer, pinned shown
d.place({ x: 0, y: 0, height: 600, pivot: "head" });
d.setFace("shocked");
d.blinkAuto(false);
window.__home.freeze(true); // dt 0: a frame holds still (springs and the flail stand still too)
```

Hide the page's own layers with a style (`[data-home-text],[data-home-below],.grounds{visibility:hidden}`) and take a screenshot clip. A flail or a spring needs `freeze(false)` and several shots 90 to 120 ms apart. Private fields can be read from the page for a check (`d.headRoll.x`). The scripts of this run are in `D:\ren\aspirant-work\home\DL\` (outside the repository): `faces.cjs`, `poses2.cjs`, `fall.cjs`, `hang*.cjs`, `attach.cjs`, `touch.cjs`, `sockets.cjs`, `walk.cjs`, `perf.cjs`, `resize.cjs`, `dispose.cjs`, with the sheets in `shots/`.

## Measured (dev server, real Chrome, real GPU, headless)

- 135 unit tests pass; eslint, typecheck, knip and prettier are clean for the folder; `scan-text` 0 problems.
- Per frame with every layer on (fall pose, flail, walk at 0.5, mood sequence, talk, dangle, 600 px tall): `update` 0.11 to 0.19 ms, frame time median 16.7 ms and p95 17.0 to 17.2 ms at 1440x900 and 390x844. The cast scene's CPU time inside `renderer.render` was 0.15 to 0.22 ms on a quiet machine and averaged 5 to 14 ms in other runs of the same code: 38 Chrome processes of the other helpers were running, so the driver was blocking on a busy GPU (the frame time did not change, the vsync held). The draw is one skinned mesh of 14.5k vertices and one material. One frame of 36 to 83 ms shows at the start of the first measuring loop after a page opens; it appears with the plainest state too (pose and place only) and never in a second loop in the same page, so it is the page's first loop and not the doll (not traced further). This is the dev server (2 to 3 times slower than production for JS) and the CPU side only. GPU time was not measured.
- Looked at: all 24 faces at 600 px tall and at 120 px tall (they all read at 600; at 120 the glyph faces are told apart at a glance: spirals, `X X`, hearts, sparkles, `> <`, arcs; the subtle ones (neutral, pout, gloom, worried, annoyed) differ by brows and mouth and are close to each other at that size), the nine poses front and at 40 degrees, the walk as a run facing right in eight phases, a falling flail sequence with the mood sequencer and `talk` (scared, scream with a moving mouth, dizzy), the hang scrubbed 0 to 1 and a swing after a bump, the eyes looking left, right, up and down, sockets drawn as dots on a reach pose at 40 degrees, the real pointer (hover gives hit `doll`, cursor label `POKE`, `onReact` hover; press; spam gives dizzy; at rest again after 6 s), 390x844 and a resize in the middle (1000x700, 700x500, back), dispose twice with no error.

## Calls I made without the owner

- `face(name, w)` is a weight over neutral (the same shape as `pose(name, w)`); the timed change is `faceTo(name, seconds)`.
- The hang is the stretched-arm cartoon hang above, not a grip. Said plainly: the hand is a small mitten above the hair.
- The press reaction's squash is about 13 percent at its peak (the first version was 1.6 percent and invisible).
- `stand` keeps the asset's arms out a little for balance (it is the standing-on-a-palm pose). A relaxed arms-down stand is `rest` (the A pose).
- `fall` is the asset's pose: face up, head away from the camera. For a face to the camera use `place({ pitch: 0.95 })` (about 55 degrees): the contact sheet shows the face, the legs and the flailing arms. The arms are small beside the hair, so the fall reads as a screaming ball of hair with limbs; the `flail` amplitude is the lever.
- The generated data files are checked into the folder with their generator (`gen.mjs`), and tests compare them with the asset sources.

## Not done, not verified

- Silverbolt's head and Selena's palm sockets: the attach round trip was done on a dummy `Group`, not on their real sockets (their actors were not finished when this was written). `attach` only needs an `Object3D` in the cast scene.
- No prop in her hands was drawn (the sockets `handL` and `handR` were checked by position only).
- The kernel's real section loop was not run with her (no section uses her yet): `update` and `visible` were driven from the lab.
- Firefox, Safari, a real phone with touch, a weak machine, the production build, GPU time, a context loss with a doll on screen (the code holds nothing of its own on the GPU; not exercised).
- The program-info-log warning `X4122` (D3D compiler, a double precision sum) shows in the console on the first draw. Its source was not traced; the doll's shader has no such constant.
- Five faces are close to each other at 120 px (neutral, pout, gloom, worried, annoyed): a partial miss of the "reads at 120 px" rule. Their owner is the asset workstream (`presets.json`).
- Faint pale patches around the eyes on the glyph faces (sleepy, sparkle, dead): the asset's repainted skin patch, see the asset notes.
- Only the left arm stretches for the hang (`stretch("R")` exists for a gag but no pose uses it).
