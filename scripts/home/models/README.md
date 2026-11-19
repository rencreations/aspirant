# The models of the home page: Silverbolt, Selena, her hand, the cameras (`scripts/home/models/`)

One command turns the owner's rigged files into four web files and checks them in a browser:

```
node scripts/home/models/build.mjs                    # all four, into apps/web/public/models/home/
node scripts/home/models/build.mjs hand cameras       # some of them (the cameras need silverbolt.glb and selena.glb)
node scripts/home/models/build.mjs --out D:\trial     # a trial: nothing in the repository changes
node scripts/home/models/build.mjs --skip-blender     # reuse the last Blender step (the work folder)
```

Tests of the pure code: `node --test "scripts/home/models/**/*.test.mjs"` (16 tests; `pnpm check` does not run them). Options: `--work DIR` (raw exports, baked JSON, check pictures; the default is `D:\ren\aspirant-work\home\models` when that folder exists, else the temp folder: C: is nearly full on this machine), `--renders DIR`. `HOME_SOURCE` names another source folder, `BLENDER` another Blender 4.5. It takes about one minute. The same source gives the same bytes (checked: two builds from scratch, identical files).

Never edit an output by hand. Change the script and run it. A file replaced under the same address needs the cache name bump in `lib/media-store.ts` (the first publish of these files does not).

## What it reads and writes

Reads (read only): `D:\ren\aspirant\3d\selena_silverbolt_raiko\selena_silverbolt_raiko\entrance\...entrance.blend` (and `raw\...raw.blend` for Selena's face targets); the recording `D:\ren\aspirant\media\_others\in-game-animation\selena\short-1.mkv` for the camera check (skipped with a note if it is not there).

Writes to `apps/web/public/models/home/`:

| File                | What                                                                                                                                                                                                  |       Size |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: |
| `silverbolt.glb`    | Silverbolt: 24 bones, 5 meshes, 5 clips                                                                                                                                                               |    300,108 |
| `selena.glb`        | Selena (normal form): 155 bones, 7 meshes, 15 face targets, 4 clips                                                                                                                                   |  1,753,200 |
| `selena-r7.glb`     | The same with 6 clips (round seven adds `interaction_R` and `intercation02`): built with `build.mjs selena --out <trial folder>`, the two files copied under the `-r7` name. The site loads this one. |  1,984,760 |
| `hand.glb`          | Selena's left glove and bracer: 20 bones, 2 clips                                                                                                                                                     |    271,760 |
| `cameras.json`      | the camera of the five clips, 30 keys a second; 4.2 KB gzipped                                                                                                                                        |     13,949 |
| `<name>.facts.json` | the numbers an actor needs (also inside each GLB, `gltf.scene.userData.home`), not loaded by a page                                                                                                   | 3 to 65 KB |

`doll.glb`, `gramophone.glb` and their rig files in the same folder come from `scripts/home/models/doll/` and `gramophone/`, which are another set of scripts.

## Which loader the actors use

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
```

The files use `EXT_meshopt_compression` and `KHR_mesh_quantization` (both required) and `EXT_texture_webp` (GLTFLoader reads it with no plugin). No Draco, no KTX2. The decoder is one small chunk: import it where the actors load, never on the first screen. The loader builds `MeshStandardMaterial` everywhere (the build removes `KHR_materials_specular`, so no `MeshPhysicalMaterial` appears). Set `frustumCulled = false` on every skinned mesh. Load a model with `loadMedia` (it saves the bytes in the cache) and `parseAsync` as `drone-scene.ts` does.

Space: glTF world, metres, Y up. Selena and Silverbolt share it with `cameras.json`. Bones hang on the scene root (there is no armature node), so `bone.position` and `bone.quaternion` are plain, and `bones[name].three` in the facts is the name three gives a bone (spaces become underscores: `Bip001_R_Hand`).

## How it is built

```
Blender (blender/*.py, headless)            Node (lib/*.mjs, gltf-transform, sharp, meshoptimizer)            Chrome (verify/*.mjs, the site's three)
 silverbolt.py  bake, re-parent the tail  -> normalizeRig: scene root, rest from the bake, IBMs rebuilt   -> load the file as the page does
 selena.py      bake, face targets        -> split the gems (Silverbolt), prune morphs (Selena)          -> bone heads against Blender, 3 frames a clip
 hand.py        sleeve, turn, two clips   -> buildAnimations: one key a frame, N-1 frames long           -> measure axes, draw the sheets, stop on a failure
 cameras.py     bake the camera actions   -> textures to WebP, quantise, meshopt, facts into the file    -> the file is loaded again at the end (final-check)
```

- **Blender never exports an animation.** The entrance file was saved by Blender 5.1. Blender 4.5 loads its actions as slotted actions and its NLA strips empty; an action assigned without its slot evaluates one pose, and the exporter writes clips that have the right names and lengths and do not move (this cost the first prototype). `blender/common.py` evaluates the real pose frame by frame (`bake_clip`) and writes the node-local transform of every bone per frame into `*.bake.json`; `lib/rig.mjs` writes them as glTF animations. A clip of N frames lasts (N - 1) / 24 s and ends on its last key. The loops end on their first key exactly.
- **The armature node is taken out** (`normalizeRig`). The exporter keeps the +90 degree turn of the armature object and turns the bones by the Y-up swizzle, so `D_she_root.position` would move along turned axes. Without it the glTF world is the armature space and local transforms are `parent^-1 * pose`. The build proves its maths: the exporter's rest nodes agree with the rest transforms computed from the Blender matrices (below 1e-6), and every bone head at three frames of every clip, read back in Chrome from the finished file, agrees with Blender (the worst numbers are in the facts, `checks`). A second opinion comes from outside the build: the owner's own `entrance.glb` (Blender 5.1) is loaded next to each finished file and the bone heads of three frames of every clip are compared with it (worst 2.5 mm for Silverbolt, 0.8 mm for Selena; limit 6 mm).
- **Size pass** (`lib/optimize.mjs`): dedup, prune, resample (1e-4), reorder, quantise (position 14 bits, normal 10, texcoord 12), pictures re-encoded as WebP with sharp, meshopt. `optimize` is not used on purpose: its `simplify` edits the gem islands and the cuff, `palette` folds an untextured material away, `join` and `flatten` move skinned nodes.
- **Facts** (`lib/facts.mjs`, `selena-facts.mjs`, `hand-facts.mjs`, `silverbolt.mjs`): written through the repository's Prettier, so they pass `pnpm format:check`.

## Files here

| Path                                                               | What                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `build.mjs`                                                        | the command above, the size budgets, the final load                                                                                   |
| `silverbolt.mjs`, `selena.mjs`, `hand.mjs`, `cameras.mjs`          | one build each; `selena-facts.mjs`, `hand-facts.mjs` hold the long facts                                                              |
| `cameras-r7.mjs`                                                   | round seven: the cameras fitted to the recording, with the sky's orientation (`cameras-r7/README.md`)                                 |
| `blender/common.py`                                                | the bake, the node-local tracks, the probes, the export                                                                               |
| `blender/silverbolt.py`, `selena.py`, `hand.py`, `cameras.py`      | the Blender steps (run by `build.mjs`)                                                                                                |
| `lib/env.mjs`, `rig.mjs`, `split.mjs`, `optimize.mjs`, `facts.mjs` | paths and Blender, the rig and the clips, cutting primitives, the size pass, the facts                                                |
| `lib/browser.mjs`, `sheet.mjs`                                     | the local server and Chrome, the contact sheets                                                                                       |
| `verify/*-check.mjs`, `fingers.mjs`, `final-check.mjs`             | the checks and measurements in Chrome                                                                                                 |
| `verify/page/stage.html`, `stage.js`                               | the page the checks run in: the site's three, GLTFLoader, meshopt, `window.stage` (pose, shot, measure, markers, the material recipe) |

The check pictures go to `--renders` (default: the work folder). Read them after every build: `silverbolt-angles.png`, `silverbolt-head.png`, `silverbolt-clips.png`, `selena-faces.png`, `selena-blink.png`, `selena-clips.png`, `selena-material.png`, `hand-views.png`, `hand-closed.png`, `hand-closed-views.png`, `hand-breath.png`, `cameras-vs-recording-1..3.png`.

## What each model has (the facts files hold the numbers)

**Silverbolt.** Only `abyssal_devil_01` and `02`. The tail is a chain (`She_09` to `She_23`, each bone aimed at the next, local +Y along the tail, +X across, +Z up; in the source they were seven siblings). The jaw is `She_02`: a positive angle about local -Z opens the mouth, 0 is as modelled (a little open), about -0.3 is shut, 1.0 is wide (0.38 m between the jaws at rest scale, 0.15 m at the clips' scale of 0.4, the doll is 0.12 m). The eyes are two almond gems cut out of the head (UV box on the atlas, 14 triangles a side) and skinned to two new bones, `sb_eye_L` and `sb_eye_R`: scale their Y to blink, a flat silver socket 2.5 mm behind each shows when the gem is squashed, so the head never shows through (drawn with culling on and a magenta ground). The cheek crystals are their own material for a glow. The ribbon is alpha blended (the loader sets `depthWrite = false`; draw it after the head). The wing and cheek blades, the crest and the tongue have their hinge axes measured (`wings`, `tongue`). The clips are `city_idle`, `city_idle_BP`, `city_interaction_R_loop`, `city_intercation03` (the source's spelling), `city_action` (the long flight path); the source scales the whole dragon through `D_she_root` (0.4 in the loops, up to 0.64 in `03`, 0.105 to 1 in `action`).

**Selena.** The normal form only. Her two white floating claws are part of `body_02` and `body_03` (they show in the recording) and stay; the abyssal form and the two UI cards are gone. 155 bones (the 151 that skin something and their ancestors). The clips key every hair and skirt bone: that is the authored motion, and `interaction_03` has its hair whips in it (at 0.4 s and 4.0 s), which a spring only solve would not reproduce. So the tracks stay and `springs` in the facts lists the rows (hair 31, skirt 32, ears 4, jewelry 2, cloth 7) for a spring solver that runs on top of the pose the mixer wrote. Fifteen face targets of the raw head sit on the final head: the two heads share every vertex (mean distance 1e-6 m, no vertex farther than 3 mm), so the transfer is exact. Targets: `blink`, `wince_open`, `strain`, `shout`, `laugh`, `smile_closed`, `smile`, `smile_soft`, `angry`, `angry_shout`, `snarl`, `surprised`, `lips_pursed`, `mouth_o`, `mouth_tiny_o` (the game numbers them; the names were read from a render of each, `selena-faces.png`). The blink closes the lids over the eyeballs on the final head (`selena-blink.png`). Finger axes of both hands and the forward axis of each eyeball are measured in three. Clips: `city_idle`, `city_interaction_R_loop` (hands at the mouth), `city_interaction_back_R` (the way back), `city_intercation03`.

**The hand.** Selena's left glove and the bracer, cut from `body_01`. The cuff is open in the source (a ring of 14 edges). Filling it makes a flat cap, so the build grows a sleeve from the ring along the arm (0.16 m, tapering, five rings, a soft cone at the end), skinned to the forearm. The model is turned for the page: the wrist is the origin, the forearm lies along +Z toward the camera, the palm faces up and a little toward the camera, the fingers point -Z, the thumb is on the left. `palm_up` is a one second reach from a flat hand to the open palm of `hand.jpg`; `breath` is a four second loop. The recommended camera (`view` in the facts) is behind and above the wrist, aimed so that the wrist falls under the bottom edge; the build asserts at 16:9, 21:9 and 9:16 that the wrist is out, the palm and four claws are in, the end of the sleeve is out and the palm faces the camera within 55 degrees (44.6); `hand-views.png` shows it, `hand-closed*.png` shows with culling on and a magenta ground that nothing is open. A white glove or a bare hand cannot be made from the sources (design call 6): the black glove is the design.

**The cameras.** `cameras.json` holds the camera of `city_idle`, `city_interaction_R`, `city_interaction_R_loop`, `city_interaction_back_R` (all four static, one key each) and `city_intercation03` (190 keys, 6.3 s). The game reads the 30 mm lens on the 36 mm sensor as the vertical field of view (61.9275 degrees) of a 16:9 frame; the recording shows the bottom 80 percent of it. `cameras.facts.json` has the recipe, when Silverbolt passes the camera (closest at 3.73 s, 0.66 m away, in the middle of the frame, gone to the left at 3.90 s), and where the doll hovers over her right hand.

## What is not verified

- Only Chrome on this machine. No Firefox, Safari or phone.
- The camera of `interaction_03` matches the recording from 1.0 s to 3.2 s. It does not at 0.4 to 0.9 s (the recording lags the clip by about 0.2 s) and after 3.4 s (Silverbolt is higher and farther in the recording; the recording lags by about 0.4 s after 4.4 s). The doll's world anchor is within about 0.3 m of the recording; a table of its screen positions is in the facts for an exact match.
- The toon pipeline of the game (a colour ramp per region, the face shadow SDF, the masks) is not shipped. `selena-material.png` shows the recommended recipe (toon steps, rim, ink outline); the outline of hard edged armour needs smoothed normals made at load.
- The wing and blade axes are measured by following the farthest vertex of each blade; check them against a flight loop before trusting a sign.
- No outline mesh and no baked ambient occlusion were prepared (the pictures are painted with the light in them).
