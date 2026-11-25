# Selena in game, her phone and Silverbolt (`scripts/library/models/selena-in-game/`)

Three files of the 3D Models room, made from the owner's Selena sources. The contract with the room is `docs/superpowers/specs/2026-11-25-models-room-redesign.md` ("Every GLB", `extras.forms`). The owner's words are in `...-models-room-request.md`.

| File                 | What                                                                             |     Bytes |
| -------------------- | -------------------------------------------------------------------------------- | --------: |
| `selena-in-game.glb` | the normal and the abyssal form, two roots on one spot, 27 clips, `extras.forms` | 1,639,752 |
| `selena-phone.glb`   | her phone alone, a still model                                                   |    21,788 |
| `silverbolt.glb`     | Silverbolt alone, 22 joints, one clip `idle`                                     |   192,200 |

## How to run

```
node scripts/library/models/selena-in-game/build.mjs                  # all three, into the mirror
node scripts/library/models/selena-in-game/build.mjs in-game phone    # some of them
node scripts/library/models/selena-in-game/verify.mjs                 # the checks, materials.png, phone.png, silverbolt.png
node scripts/library/models/selena-in-game/sheets.mjs                 # the frame sheets of the form change and of every clip
```

`MODELS_OUT=<folder>` writes a trial instead of the mirror; `verify.mjs --dir <folder>` and `sheets.mjs <file> --out <folder>` read it. `MODELS_WORK` names another work folder, `SELENA_SOURCE` another source folder. `build.mjs in-game --carry=toNormal` builds a trial with the carry on that change only (the default is in `config.mjs`). The build takes about one minute, the checks and sheets a few minutes. The same sources give the same bytes (checked: two builds, identical files). They use the site's three and Playwright from `apps/web`, gltf-transform, meshoptimizer and sharp from the repository, and real Chrome. No Blender.

Never edit an output by hand. Change `config.mjs` or the script and run it. A file replaced under the same key needs a new folder (`models/v2/`): the bucket caches for 30 days.

## What it reads and writes

Reads (read only), in `D:\ren\aspirant\3d\selena_silverbolt_raiko\selena_silverbolt_raiko\`:

- `in_game\selena_silverbolt_raiko_in_game.glb` (the normal form) and `..._in_game_abyssal_form.glb` (the abyssal form). Both are exports of the owner's own Blender files and play correctly as they are.
- `in_game\abyssal_form\matcap1.png` (the crystal picture of the abyssal orbs, see below).
- `entrance\selena_silverbolt_raiko_entrance.glb` (the phone and Silverbolt).

Writes `selena-in-game.glb`, `selena-phone.glb` and `silverbolt.glb` into `D:\ren\aspirant-r2\library\v1\models\v1\`, and its reports and pictures into `D:\ren\aspirant-work\models-room\in-game\`.

## `selena-in-game.glb`

### Two roots

The scene has two nodes, `normal` and `abyssal`. Each holds its source armature as it was (its node transforms and its skin), so three draws each form exactly as it draws the source. Both stand on the game's own origin: the game places both models at one hero position and the transform clips are authored there, so no root was moved. What the checks measured in each idle (`verify.json`):

| Form    | Lowest point            | Pelvis from the vertical axis | Facing (0 is +Z)   | Head bone |
| ------- | ----------------------- | ----------------------------- | ------------------ | --------- |
| normal  | -0.025 m (the sash tip) | 0.043 m                       | -31 to -27 degrees | 1.521 m   |
| abyssal | 0.000 m                 | 0.189 m                       | +15 to +16 degrees | 1.500 m   |

Both face +Z. The angles are the turn of each idle stance (hips and shoulders), not of the root: the same measure averaged over each form's run loop is +1.0 degrees (normal) and -0.4 degrees (abyssal). The scale is the same (head 1.52 and 1.50 m).

- **Rest pose.** Each form's rest pose is the first key of its idle, so the file stands before a clip plays. The abyssal source lies flat at rest without it. Both roots are visible at load: the room shows one.
- **Names.** The bones keep their source names. Both forms have a `Bip001 Pelvis` and so on, so three renames the second form's copies (`Bip001_Pelvis_1`). The clips are bound by the loader, so they play right on a mixer at `gltf.scene` or at either root. To find a bone of one form, search inside its root by `userData.name` (the source name).
- **Clip names** are the ids of `entries.json` plus the four transform clips, all unique.

### Clips

Renamed, cut to where they stop moving and listed in this order. A clip stops moving at the last key where any channel changes by more than 1e-4 from the key before. The abyssal source starts every clip at 1/30 s (its frame 1); those clips are moved to start at 0. `attack4` of the abyssal form is left out. Lengths in seconds, before (the source clip's last key) and after:

| Id                    | Source     | Before |  After |
| --------------------- | ---------- | -----: | -----: |
| `normal/idle`         | fight_idle | 1.0667 | 1.0667 |
| `normal/random-idle`  | oddshold1  | 3.8333 | 3.8333 |
| `normal/run`          | run        | 4.0000 | 0.6667 |
| `normal/sprint`       | fastrun    | 1.6000 | 0.5333 |
| `normal/random-move`  | oddsmove1  | 3.8333 | 2.9667 |
| `normal/attack-1`     | attack1    | 1.0667 | 1.0667 |
| `normal/attack-2`     | attack2    | 1.0667 | 1.0667 |
| `normal/skill-1`      | skill1     | 4.0000 | 1.0667 |
| `normal/skill-2`      | skill2     | 4.0000 | 1.0667 |
| `normal/stunned`      | verigo     | 4.0000 | 1.6000 |
| `normal/recall`       | recall     | 4.0000 | 4.0000 |
| `normal/landing`      | landing    | 1.6000 | 1.0000 |
| `normal/dead`         | dead       | 1.6000 | 1.6000 |
| `normal/respawn`      | birth      | 4.0000 | 1.3333 |
| `normal/to-abyssal`   | skill3_1   | 4.0000 | 0.2667 |
| `normal/from-abyssal` | skill3_2   | 4.0000 | 0.5333 |
| `abyssal/idle`        | fight_idle | 2.0667 | 2.0000 |
| `abyssal/run`         | run        | 0.8000 | 0.7333 |
| `abyssal/sprint`      | fastrun    | 0.6000 | 0.5333 |
| `abyssal/attack-1`    | attack1    | 1.5667 | 1.5000 |
| `abyssal/attack-2`    | attack2    | 1.6667 | 1.6000 |
| `abyssal/skill-1`     | attack3    | 1.7333 | 1.6667 |
| `abyssal/skill-2`     | skill2     | 1.1333 | 1.0667 |
| `abyssal/stunned`     | verigo     | 1.7333 | 1.6667 |
| `abyssal/dead`        | dead       | 2.0667 | 2.0000 |
| `abyssal/from-normal` | skill3_2   | 0.7000 | 0.6667 |
| `abyssal/to-normal`   | skill3     | 0.3667 | 0.3000 |

The normal clips of exactly 4.00 s were padded with still keys (run moves for 0.67 s of its 4 s). Only `normal/recall` moves for the whole 4 s. The loops close: the last pose of every idle, run, sprint and random clip is within 0.5 degrees and 1.4 mm of its first, `normal/stunned` within 1.7 degrees and 6 mm. `normal/to-abyssal` is cut at its last key before the sink (below).

**Size pass**, as `scripts/home/models/lib/optimize.mjs` does it (`lib/optimize.mjs`): dedup, prune, resample (1e-4), reorder, quantise (position 14 bits, normal 10, UV 12, weights 8), meshopt (`EXT_meshopt_compression`, `KHR_mesh_quantization`), pictures as WebP (`EXT_texture_webp`) at most 2048 px (1024 for the phone). No Draco, no KTX2.

### Materials

- Every material is the plain metal-rough material (`KHR_materials_specular` taken off, so three builds `MeshStandardMaterial`), metallic 0, roughness 1, its picture as base colour. `COLOR_0`, `COLOR_1` and `TEXCOORD_1` (game data the room never reads) are dropped. The pictures are the GLB's own, the same bytes as the files in the folders beside them (512 px at most), as WebP.
- **The abyssal orbs (a call of this build, reversible).** Two small low-poly orbs float beside her shoulders. Their UV islands point at a patch of `evilgirl_skin11_pbs_02_d` that is painted plain black, and the mask `pbs_02_m2` marks that patch apart from the rest. Drawn with base colour only they were flat black hexagons. This build reads them as crystal balls drawn by the game's shader with `matcap1.png`, the crystal sphere in the same folder. That is an inference from the folder and the mask, not something the files state. The build gives them a primitive and a material of their own (`abyssal_orb`) with `matcap1` laid on each orb as a sphere seen from the front in the idle (`lib/orbs.mjs`). They now read as small crystal balls. It is a still picture: it turns with the orb, it does not follow the camera as a matcap does. To undo it, take the `splitOrbs` call out of `in-game.mjs`.
- **The sparkles** of the abyssal form (`FX_M_63_skin11_WMD_27`, picture `pbs_02_m1`) stay `BLEND`: stars cut out by their alpha. The colour under the clear pixels was magenta; it is filled with the stars' mean colour, so no magenta bleeds into their edges.
- **The flow light of the normal form is left out (a call of this build, reversible: `DROPPED_MESHES` in `config.mjs`).** `body_03` (34 vertices, picture `liuguang_2`, neon lines on black) is a strip that repeats the sash, drawn by the game additively with a scrolling picture. A web file cannot scroll it. Standing still it read as a pale smear beside the sash, and it hangs up to 0.25 m under the ground. The sash itself (`body_01`) keeps all its colour.
- Opaque materials stay opaque. Nothing renders black or bare (`materials.png`, on a light and a magenta ground).

### The form change

The numbers come from sampling the four clips in Chrome every 1/120 s (`probe/analyse-forms.mjs`: the world positions of the 18 Biped joints both skeletons share) and from frame sheets of every key (`probe/probe-candidates.mjs`).

**To abyssal.** In `normal/to-abyssal` she crouches (pelvis 0.51 m), jumps (pelvis 1.51 m at 0.167 s), curls, and right after her key at 0.2667 s (pelvis 1.17 m) the game sends the model 2.2 m under the ground (pelvis -1.08 m at 0.3 s). Her floating claws stay up there and the tip of her hair still shows above the ground, so the whole form must be hidden. Between the two keys three would draw her sliding into the ground, so the clip is cut at 0.2667 s: no frame and no blend can show the sink. `abyssal/from-normal` starts curled in the air at the same place (pelvis 1.20 m, the form's lowest point 0.85 m above the ground) and is visible from its first key, so it plays from 0. It then rises to 1.63 m, unfolds, lands at 0.53 s and ends on the first key of the abyssal idle. The two curled poses match: this is the hand-off the game authored.

**To normal.** `abyssal/to-normal` never goes under the ground. She crouches, springs up leaning forward and the clip ends in the air at 0.3 s (pelvis 1.57 m). The game swaps the model there. `normal/from-abyssal` starts upright in the air (pelvis 1.22 m, never higher than 1.23 m), turns once and lands at 0.53 s on the first key of the normal idle. No pair of times lines up both heights (the best whole-pose match was 0.42 m off), so the swap is at the end of the first clip and the start of the second.

**The carry.** At the swap the second form starts where the first one's pelvis is, and the gap closes over 0.4 s with an eased curve. It is written into the second clip as a translation track on the second form's root, so the room does nothing for it. The gaps are 0.16 m to abyssal (mostly depth) and 0.39 m to normal (mostly height: the normal form drops 0.35 m without it and reads as a jump cut; with it she lands from the abyssal jump). With the carry the pelvis is within 1 mm at both swaps, and the remaining whole-pose difference of the shared joints is about 0.16 m (two different bodies). The plain and the carried versions were compared on the sheets before the carry was kept: `seam-to-normal-plain.png` and `seam-to-abyssal-plain.png` in the work folder are the plain ones (`build.mjs in-game --carry=` makes them again).

The carry departs from the contract's line "the two roots share one place, so no offset is needed": the roots do share one place at rest, but two clips now move a root for 0.4 s. So the room must never move the `normal` or `abyssal` node itself. Move `gltf.scene` (or a parent of it) to place the model.

### `extras.forms` (the default scene's extras, `gltf.scene.userData.forms`)

```json
{
  "roots": { "normal": "normal", "abyssal": "abyssal" },
  "toAbyssal": {
    "first": "normal/to-abyssal",
    "hideAt": 0.2666,
    "second": "abyssal/from-normal",
    "secondFrom": 0,
    "showAt": 0,
    "carry": [-0.0639, -0.0288, -0.1449],
    "carryFor": 0.4
  },
  "toNormal": {
    "first": "abyssal/to-normal",
    "hideAt": 0.3,
    "second": "normal/from-abyssal",
    "secondFrom": 0,
    "showAt": 0,
    "carry": [-0.1657, 0.3522, -0.0546],
    "carryFor": 0.4
  },
  "trim": { "normal/run": [0, 0.6667], "abyssal/idle": [0.0333, 2.0333], "...": "..." }
}
```

| Field        | Meaning                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roots`      | the node names of the two forms                                                                                                                                                                                                  |
| `first`      | the clip the leaving form plays (from 0, after the room's blend from its idle)                                                                                                                                                   |
| `hideAt`     | seconds of `first` at which the leaving form is hidden. Here it is the clip's last key as stored (8/30 = 0.26666668 and 0.30000001), floored to 1e-4 so a clamped action always reaches it: hide when `time >= hideAt`.          |
| `second`     | the clip the arriving form plays at that moment                                                                                                                                                                                  |
| `secondFrom` | seconds of `second` it starts from at the swap                                                                                                                                                                                   |
| `showAt`     | seconds of `second` from which the arriving form is in place and above the ground. Here it equals `secondFrom`: show the form at the swap.                                                                                       |
| `carry`      | for information: the gap (metres, world) between the two pelvises at the swap, already in `second` as a translation track on its root that eases to 0                                                                            |
| `carryFor`   | for information: the seconds after `secondFrom` over which the carry closes                                                                                                                                                      |
| `trim`       | every clip cut or moved by the build: `[start, end]` of the source clip that was kept, in the source clip's own seconds. In the file every clip starts at 0. The abyssal ones start at 0.0333 because their source starts there. |

For the room: play `first`; when its time reaches `hideAt` (or it ends), hide that root, show the other root and play `second` from `secondFrom` at full weight with no blend (the two forms are different bodies), then blend from the end of `second` into the new idle (it ends on the idle's first pose). Do not move the two roots yourself: move `gltf.scene`. The sheets blend 0.15 s from the idle into `first`, which reads well (the clip starts in a crouch).

## `selena-phone.glb`

**How it was found.** The entrance file has two small meshes off to the side, both bound only to `neutral_bone`. Rendered alone (`probe/probe-phone.mjs`), `accessory_01` (88 vertices, picture `selena_skin11_high_fx02_d`) is the phone: a purple case with the chibi art, the lens and "ASPIRANTS" on the back, the lock screen at 14:55 in front. `accessory_02` (picture `fx03_d`) is the stack of four message cards. The parts with the `npc` pictures are the abyssal form of the entrance file. The game moves the phone with `Bone259` under `D_daoju` (that bone scales 0.02 to 0.9 in the phone clips), but the export did not keep that binding, so the phone lies flat at x = -4 m in the file.

**What was done.** The phone's own axes come from its vertices (the longest is up, the thinnest goes through it). The picture decides the signs: the case back (u < 0.46 of the picture) faces +Z, its top (small v, the lens corner) is up, and u grows to the right, so the art reads as in the game and is not mirrored. The phone is a plain mesh (no skin), centred on the origin, 0.223 by 0.469 by 0.032 m: the size it is modelled at. In the phone loop the game scales its bone to 0.736, which would make it 0.345 m tall. Picture as WebP at 1024 px at most (it is 256 px). `phone.png` shows it from six sides: the lens is in the top left of the back, as in the recording.

## `silverbolt.glb`

- **Meshes and joints.** `abyssal_devil_01` (the dragon, opaque) and `abyssal_devil_02` (the long translucent body ribbon, `BLEND`), and the 22 joints they are skinned to, with their parents up to `D_she_root` (the source skeleton has 342). One new skin, the joint indices and inverse bind matrices remapped. Everything else of the entrance file is gone. The normal map is dropped (the room reads base colour only).
- **The clip.** One clip, `idle`, from `selena_silverbolt_raiko_entrance_city_idle` (24 keys a second), moved to start at 0: 2.7083 s (2.75 s in the source, first key at 1/24 s). It loops: the last pose is within 6 mm of the first at 0.2 m from each bone.
- **The scale.** `D_she_root` places, turns and scales the whole dragon beside Selena: in city_idle it is at (-0.40, 1.06, 0.43), tilted about 26 degrees, at scale 0.4. Here its scale is 1, the size the dragon is modelled at (3.7 m from the head to the end of the ribbon, 1.6 m across, 2.1 m high). Its turn is its rest turn (head toward +Z, upright), with the small sway of the idle kept on top of it. Its place is fixed so the dragon's box over the loop is centred on the origin; the box's centre stays within 0.24 m of it.
- **Motion kept.** The tail moves up to 0.28 m, the wings 0.04 m and the jaw 0.02 m (a point 0.2 m from each bone, `verify.json`). `silverbolt.png` shows four times from six sides.
- In the game the dragon idles side-on to Selena's camera (head toward +X, 72 degrees from +Z). Facing +Z, the default camera sees the head first and the body behind it; a three quarter camera shows the whole dragon.

## What was checked (`verify.mjs`, all passing)

- Every clip of `entries.json` is in the file, plus the four transform clips, 27 in all, nothing else. Two roots, `normal` and `abyssal`.
- Each form at rest and through its idle: on the ground, near the vertical axis, facing +Z within 35 degrees; the same scale.
- At both swaps the pelvis gap is 1 mm. The leaving form never shows a point more than 4.1 cm under the ground before `hideAt`, and the arriving form never one more than 1.3 cm from `secondFrom` (feet and sash tips).
- Every mesh has its picture and is a `MeshStandardMaterial`.
- The phone: one mesh, no clip, centred, long side up, thin through Z.
- Silverbolt: one clip `idle`, loops, centred near the origin, tail, wings and jaw move.

Pictures to read (in `D:\ren\aspirant-work\models-room\in-game\`): `change-to-abyssal.png` and `change-to-normal.png` (idle, the blend, the first clip to `hideAt`, the swap, the second clip, the blend, the other idle, at 12 frames a second from a fixed three quarter camera), `seam-to-abyssal.png` and `seam-to-normal.png` (30 frames a second around the swap, three quarter and front), `clips-normal.png` and `clips-abyssal.png` (every clip at 0, 1/3, 2/3 and its end), `materials.png`, `phone.png`, `silverbolt.png`.

## What is not verified

- Only Chrome on this machine.
- The game's own shaders (toon ramps, the flow light, the matcap of the orbs, rims) are not reproduced. The room draws base colour only.
- The phone's size in her hand is not known from the file (see above).
- The sheets simulate the room's blends with a fixed 0.15 s; the room chooses its own.

## Files here

| Path                                         | What                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `build.mjs`                                  | the command                                                                                                  |
| `config.mjs`                                 | the clip tables, what is left out, the form change settings                                                  |
| `in-game.mjs`, `phone.mjs`, `silverbolt.mjs` | one build each                                                                                               |
| `verify.mjs`, `sheets.mjs`                   | the checks and the pictures                                                                                  |
| `lib/`                                       | paths (`env`), clip cuts (`clips`), rig maths (`rig`), the orbs, pictures, the size pass, Chrome, the sheets |
| `page/`                                      | the page the checks run in: the site's three, GLTFLoader, the meshopt decoder                                |
| `probe/`                                     | the looks that led to the choices above (the sources, the parts, the orbs, the transform clips, the phone)   |
