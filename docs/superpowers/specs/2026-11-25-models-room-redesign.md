# The 3D Models room, rebuilt (25 Nov 2026): design and calls

The owner's words are in [2026-11-25-models-room-request.md](2026-11-25-models-room-request.md). This file is the contract between the parts: the pipelines that make the model files, the data file and the room.

## What the room is

`/collection/models` is one full screen stage, a three.js canvas under the bare top bar, and a few quiet controls around it. One model is shown at a time. The words are the model's name and, for an Aspirant, her title (Blade of Kibou for Fanny). Nothing technical is shown: no points, triangles, files, formats, notes or downloads. The zoom buttons are gone: the wheel, a pinch or a trackpad zooms.

- **The list** has the fifteen entries in the owner's order. An entry with more than one view shows its views under it when it is chosen (Selena: In Game, Entrance, Phone).
- **Camera rules** come from the view's `mode`:
  - `character`: the camera turns round the model and can rise above it, but never goes under the plane of the target, and the target never drops below the hips. Nobody can look up a skirt. No pan.
  - `item`: the object turns freely on every axis (a trackball), so every side can be seen.
  - `free`: Selena's In Game and Entrance and Silverbolt. The camera goes anywhere (orbit on the whole sphere, zoom and pan). A sticker covers Selena in the Entrance idle when the camera comes close behind her.
- **Animations.** A view with clips lists them. A clip loops. A timeline under the stage shows every key, a playhead that can be dragged, the frame and the time. Space or the button plays and pauses. The comma and full stop keys step one frame when the clip is paused.
- **Cinematic camera (Entrance).** Each clip has its camera, fitted to the game's own recording. The camera follows it until the visitor moves it; "Default camera" goes back. The clip keeps playing while the visitor moves around.
- **Forms (In Game).** A Normal and Abyssal switch. A change blends whatever is playing into the form's idle, plays the two transform clips timed as one move (the first form is hidden from the frame where the game sends it under the ground), and blends into the other form's idle. The switch is disabled until it is done.
- **Takedown.** Every model is 3D and carries `ReportLink` (the rules file, "Legal pages"): a small "Copyright or takedown" line stays at the foot, with the fan archive line.

## Files and keys

Every file is in the R2 bucket, made by `scripts/library/models/` into the mirror `D:\ren\aspirant-r2\library\v1\models\v1\`:

| Key                                  | What                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `models/v1/<view id>.glb`            | one view, one file (the view ids are in `scripts/library/models/entries.json`) |
| `models/v1/posters/<view id>-p.webp` | the poster, 800 by 1000, transparent ground: the picture shown without WebGL   |
| `models/v1/posters/<view id>-t.webp` | the same, 240 by 300: the list and the search                                  |

The posters are rendered from the finished GLB files by one script (`scripts/library/models/posters.cjs`), so they all have the same look. The old keys under `others/3d/` are never changed or moved. A file replaced under the same key needs a new folder (`models/v2/`): the bucket caches for 30 days.

### Every GLB

- glTF 2.0 binary, Y up, metres, the front of the model toward **+Z** (the default camera looks from +Z).
- A character stands with her feet on the ground (y = 0), centred on x = 0, z = 0. An item is centred on the origin (its bounding box's middle at 0, 0, 0) and turned so it reads at once: long things straight (a staff, a sword and a scythe stand up with the head or blade at the top; a gun and a sniper lie level, muzzle toward +X); the crescent moon faces +Z.
- Size pass as `scripts/home/models/lib/optimize.mjs` does: meshopt (`EXT_meshopt_compression`, `KHR_mesh_quantization`), textures as WebP (`EXT_texture_webp`), no Draco, no KTX2. Textures at most 2048 (characters) or 1024 (items).
- Materials: metallic-roughness with `baseColorTexture`, `alphaMode` MASK for cut-outs and BLEND only where the part is really see-through. The room draws the base colour with its own light; nothing else of a material is read.
- Skinned meshes keep their bones; bone names as in the source (three sanitises them: `mixamorig:Spine` is read as `mixamorigSpine`).
- What the room needs that a GLB has no place for goes in the **default scene's extras** (`gltf.scene.userData` in three), as below.

### The views and what each file carries

| View                                                                                                                                                                                                                                                                                     | Made by                    | Carries                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selena-entrance`                                                                                                                                                                                                                                                                        | `selena/entrance` pipeline | Selena (normal form) and Silverbolt, one skeleton, the 14 clips of `entries.json` by their ids, `extras.cameras`, `extras.sticker`                             |
| `selena-in-game`                                                                                                                                                                                                                                                                         | `selena/in-game` pipeline  | two roots, `normal` and `abyssal`, each its own skeleton, the clips `normal/*` and `abyssal/*` of `entries.json` plus the four transform clips, `extras.forms` |
| `selena-phone`, `silverbolt`                                                                                                                                                                                                                                                             | `selena/in-game` pipeline  | the phone alone; Silverbolt alone with clip `idle`                                                                                                             |
| `fanny`, `fanny-blade`, `fanny-thruster`, `layla`, `layla-gun`, `ruby`, `ruby-scythe`, `angela`, `lesley`, `lesley-sniper`, `lesley-mecha`, `change`, `change-moon`, `guinevere`, `guinevere-weapon`, `vexana`, `vexana-staff`, `eternal-guard`, `eternal-guard-sword`, `aspirant-drone` | `parts` pipeline           | one model each; `ruby` and `angela` keep their Mixamo skeleton (the room breathes them); `aspirant-drone` keeps its face morph targets                         |
| `guinevere-drone`, `mr-bunny`, `tetra`                                                                                                                                                                                                                                                   | `companions` step          | the About page's own files (`public/models/about/companion.glb`, `bunny.glb`, `tetra.glb`), copied byte for byte into the bucket                               |

### `extras.cameras` (Entrance)

```json
{ "fps": 30, "aspect": 2.2222, "clips": { "<clip id>": { "frames": 82, "keys": [px, py, pz, qx, qy, qz, qw, vfov, ...] } } }
```

One key every 1/30 s from the clip's first frame to its last (the same length as the trimmed clip), in the GLB's own world space, three's camera convention (looks down its local -Z), `vfov` in degrees over a frame of `aspect`. The room fits that frame into the screen (the whole width on a wide screen, the subject's box on a tall one).

### `extras.sticker` (Entrance)

```json
{ "clip": "idle", "bone": "<three's name of the bone>", "offset": [x, y, z], "normal": [x, y, z], "radius": 0.16 }
```

`offset` is the middle of the part to cover in the bone's local space, `normal` the outward direction of it (bone space, unit), `radius` its size in metres. The room draws the owner's sticker there, facing the camera, when the camera is near and on that side.

### `extras.forms` (In Game)

```json
{
  "roots": { "normal": "normal", "abyssal": "abyssal" },
  "toAbyssal": { "first": "normal/to-abyssal", "hideAt": 1.23, "second": "abyssal/from-normal", "secondFrom": 0.0 },
  "toNormal": { "first": "abyssal/to-normal", "hideAt": 0.3, "second": "normal/from-abyssal", "secondFrom": 0.0 },
  "trim": { "<clip id>": [start, end] }
}
```

`hideAt` is the time in the first clip when the game sends the form under the ground (it is hidden from then on); the second clip starts at `secondFrom` on the other form at that moment. The pipeline also writes `showAt`, `carry` and `carryFor`: the arriving form starts where the leaving one's pelvis was and the gap closes over 0.4 s, written into the second clip as a track on its root, so the room only swaps (it must never move the `normal` or `abyssal` node itself). `scripts/library/models/selena-in-game/README.md` documents every field.

## Clips

- Every clip is trimmed of the still keys at its end (a stretch where no bone moves), so a loop has no pause. A loop whose last pose is not its first gets a short blend over the seam in the room.
- Ids are the ones of `entries.json`. The timeline draws a tick for every key time the clip really has.

## Calls made for the owner

- The list order follows the owner's numbered list. Inside Entrance, Idle and Idle Standing come first, then Phone, Interaction L and R (each a dropdown of In, Loop and Out) and Interaction 1 to 3: Idle is the default and a list that starts with it reads better.
- "Can't look down" is read as: the camera cannot get under a character. Selena (In Game, Entrance) and Silverbolt are free, as the owner said for Selena.
- Guinevere Drone is one view with both drones, because the owner asked for them to interact.
- Eternal Guard is not an Aspirant, so it shows its name only. The drone, Mr. Bunny, Tetra and Silverbolt show their names only.
- Ruby's and Angela's idle is a breath made in the room (small turns of the spine, neck, head and arms by their Mixamo bones), not a baked clip.
- The current room's points, triangles, format, files, download, layers, robot faces, plinth readout and zoom buttons are gone, as asked. The takedown line stays (legal).
- The Entrance's camera fits the game's whole wide frame into the screen on a laptop (the list and the animations are thin words over its edges, on a soft veil), because a frame squeezed between them needs a lens so wide that she reads small. On a phone the frame is cut at the sides and slides to keep her in the middle.
- The sticker shows only in the idle, when the camera is on the side her bottom faces (from about 80 degrees off its outward direction, so from behind as in the owner's screenshot and from below) and within about 2.4 m. It is whole or gone (it grows in on a spring), never half grown. From the front and the sides it is not there.
- Clips were trimmed of still ends where the source had them: none of the Entrance clips has one (the hair and the skirt still move on their last frame); several In Game clips were padded to 4 s and were cut. The Phone Loop does not end on its first pose (the dragon flies a path and starts again), so the room blends over its seam like every other open loop.
- In the game the phone sits in her hand by a bone the export lost, so the Entrance clips show her hand empty; the phone is its own view.
- Ruby holds her scythe on her right hand's socket; her right arm's resting pose was closed round the shaft by the parts pipeline (`parts/README.md`). Every character turns about the origin where her feet stand, so the scythe does not pull the axis aside.
- Guinevere's "weapon" is the keychain charm on her right wrist (a chibi head); its twin on her left wrist stays on her model. Vexana's staff keeps the white cap at its head.
- Silverbolt opens from its side (it idles side-on in the game) at its own scale 1 (the source scaled it to 0.4 in the clips).
