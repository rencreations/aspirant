# The drone of the About page (`scripts/about/drone/`)

Turns the rigged model `D:\ren\aspirant\3d\angela\drone.fbx` (read only) into the two files the page uses:

| File                                     | What it is                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/web/public/models/about/drone.glb` | The model: 250,192 bytes, unlit, ten bones, two pictures inside. `DRONE_MODEL` in `features/about/media.ts`.      |
| `apps/web/public/img/about/drone.webp`   | The still for a browser that cannot draw the scene: 1440 by 740, transparent ground, 35,914 bytes. `DRONE_STILL`. |

Never edit the two files by hand. Change the build and run it.

## How to run

```
node scripts/about/drone/build.cjs
node scripts/about/drone/build.cjs --renders D:\some\folder          # where the check pictures go
node scripts/about/drone/build.cjs --out D:\trial --quality 0.8      # a trial: both files go to D:\trial
node scripts/about/drone/build.cjs --fbx D:\other\drone.fbx          # another source (or ABOUT_DRONE_FBX)
```

It needs Chrome (the build runs in real Chrome through Playwright, headless, with the GPU) and the packages of `apps/web` installed: Playwright and three come from there, so the model is written by the same three the page loads it with. The build starts a small server on a free port and stops it again. It takes about ten seconds.

The build is repeatable: the same source gives the same bytes. If the byte count changes, write the new one into `DRONE_MODEL_BYTES` (the build says so when the number in `media.ts` is not the file's). If the file was ever published under this name, also bump the cache name in `apps/web/src/lib/media-store.ts`.

| File here                         | What it does                                                              |
| --------------------------------- | ------------------------------------------------------------------------- |
| `build.cjs`                       | The steps, the checks, the pose and the size of the still.                |
| `page/convert.js`                 | FBX to GLB, in the page.                                                  |
| `page/stage.js`                   | Loads the GLB back, describes it, draws the check pictures and the still. |
| `page/index.html`, `page/main.js` | The page the build opens.                                                 |

## What the build does

1. **Reads the FBX** with three's `FBXLoader`.
2. **Replaces the two materials** with `MeshBasicMaterial`, the picture only. The paint already carries the shading, so nothing is lit and the emission mask of the FBX is dropped. They are written as `KHR_materials_unlit` and come back as `MeshBasicMaterial`. The names stay: `drone_body` and `drone_face`.
3. **Drops the eight hidden faces.** In the FBX the face is nine copies of the screen: one is shown and eight are collapsed inside the head until a morph target opens them. The page picks a face by sliding the picture instead (see below), so the eight copies and all morph targets are left out. 4,632 triangles become 2,072 (1,752 body, 320 screen).
4. **Merges the vertices** (`mergeVertices`): 13,896 loose corners become 2,251 vertices with an index.
5. **Writes one binary file** with `GLTFExporter`. The two pictures (512 by 512 each) are inside as lossless WebP (`EXT_texture_webp`, which `GLTFLoader` reads with no plugin).
6. **Loads the file back** with `GLTFLoader`, as the page does, and stops with an error if anything the page relies on is wrong: the ten bones with their names and parents, the rest pose of each against the FBX (to 0.0001), one skin of ten joints, two skinned meshes found by material name, both `MeshBasicMaterial` with a picture, no morph target, no animation, the same box.
7. **Compares the pictures** in the file with the ones in the FBX, pixel by pixel. Lossless gives a difference of 0.
8. **Draws check pictures** into `--renders` (default: `aspirant-about-drone` in the temp folder). Read them after every build:
   - `views.png`: front, three-quarter, back, three-quarter back, two wing poses, the still's pose.
   - `faces.png`: the nine faces, each with its offset.
   - `hero-2x.png`: the still's pose at 1500 px, the size of the first screen on a 2x display.
   - `still-on-grounds.png`: the still over the paper colour and over black, to look for a fringe.
   - `summary.json`: every number below.
9. **Draws the still** and writes both files (each beside its target first, then moved over it).

## Why the pictures are lossless

On the first screen the drone is about 600 px wide on a 2x display, so the 512 px body picture is enlarged about three times. Tried at that size (`--out`, then `hero-2x.png` side by side):

| Pictures                                   | File    | Largest pixel error | What shows at the hero's size                                                     |
| ------------------------------------------ | ------- | ------------------- | --------------------------------------------------------------------------------- |
| WebP, quality 0.8 (the exporter's default) | 168,140 | 60 of 255           | The thin panel lines of the armour break up and the edge of the eyes gets blocks. |
| WebP, quality 0.92                         | 183,944 | 55 of 255           | Better, the same faults remain on the panel lines.                                |
| WebP, lossless                             | 250,192 | 0                   | As painted.                                                                       |
| PNG                                        | 268,208 | 0                   | As painted, 18 KB more.                                                           |

Lossless WebP is the choice: 82 KB more than the default for a picture with no fault, and well under the 400 KB the loading bar allows this file. (`canvas.toBlob` with a WebP quality of 1 is Chrome's lossless encoder; `convert.js` passes the quality to the exporter.)

## What is in the file

```
drone (Group)
  drone_armature (Group)
    drone_root (Bone)
      body (Bone)
        wing_L, wing_R, fin_L, fin_R (Bone)
        antenna_L_01 (Bone) > antenna_L_02 (Bone)
        antenna_R_01 (Bone) > antenna_R_02 (Bone)
  drone_body (Group)
    two SkinnedMesh, one per material, sharing one Skeleton
```

- Find the two meshes by `material.name` (`drone_body`, `drone_face`). The node names of the meshes are the exporter's and may change.
- Metres, Y up, **the front is +Z**. No node carries a rotation or a scale. The origin is the middle of the box, so a roll, a flip and a turn spin the drone in place.
- The box: from (-0.2202, -0.2237, -0.2713) to (+0.2202, +0.2237, +0.2713). 0.44 m wide, 0.45 tall, 0.54 long with the wings folded.
- Attributes: `position`, `normal`, `uv`, `skinIndex`, `skinWeight`. At most two bones per vertex.
- No animation. Every movement is made by the page.
- The pictures load with `flipY = false`. Set `toneMapped = false` on both materials, or the colours wash out.

## The bones

Left and right bones have the same frame (not mirrored). Left is +X. The long axis of every bone is its local +Y. A pose is `rest * rotation about a local axis`.

| Bone                           | Parent           | Rest position (m)        | Rest rotation        | Drives                                                       |
| ------------------------------ | ---------------- | ------------------------ | -------------------- | ------------------------------------------------------------ |
| `drone_root`                   | `drone_armature` | 0, 0, 0                  | none                 | Nothing (weight 0). A spare handle.                          |
| `body`                         | `drone_root`     | 0, 0, 0                  | none                 | Everything, the whole screen too.                            |
| `wing_L`, `wing_R`             | `body`           | ±0.1901, 0.0110, 0.0644  | X by -108.27 degrees | The whole wing, rigid (0.354 m long).                        |
| `fin_L`, `fin_R`               | `body`           | ±0.1189, 0.0816, -0.0116 | none                 | The grey ear blade (0.131 m); its base blends into the head. |
| `antenna_L_01`, `antenna_R_01` | `body`           | ±0.1284, 0.1164, -0.0512 | none                 | Almost nothing by itself.                                    |
| `antenna_L_02`, `antenna_R_02` | the `_01`        | 0, 0.0537, 0             | none                 | The top edge of the cyan strip behind the fin (4 vertices).  |

| Motion                | Bones and local axis                                   | Sign                                                                                                               | Range that looks whole                                                   |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Wing raise            | `wing_L.x`, `wing_R.x`, the same sign                  | + lifts the tip                                                                                                    | -60 to +75 (rigid, nothing tears from -90 to +120)                       |
| Wing spread           | `wing_L.z = -a`, `wing_R.z = +a`                       | + a opens outward                                                                                                  | 0 to +90; below -10 it cuts into the body                                |
| Wing twist            | `wing_L.y = -a`, `wing_R.y = +a`                       | + a turns the cupped shell flat                                                                                    | 0 to +90; negative cuts into the body                                    |
| Fin stand or lie back | `fin_L.x`, `fin_R.x`, the same sign                    | + stands up                                                                                                        | -15 to +15 as the file is; -30 to +45 once the strip is attached (below) |
| Fin splay             | `fin_L.z = -a`, `fin_R.z = +a`                         | + a leans outward                                                                                                  | 0 to +45                                                                 |
| Fin swivel            | `fin_L.y = -a`, `fin_R.y = +a`                         | + a turns the flat sides forward                                                                                   | -30 to +30                                                               |
| Strip tip             | `antenna_*_02.x` the same sign; `.z` left -a, right +a | + x forward                                                                                                        | about 20 either way                                                      |
| Nod, tilt, turn       | `body` or the root: x, z, y                            | x + is nose down; z + is counter-clockwise seen from the front; y + turns the face to +X (the right of the screen) | all the way round                                                        |

A flap like a bird's is the spread, then the raise: `rest * Rz(spread) * Rx(raise)`. Poses that read well: a glide is spread 50 with raise 20, the up stroke is spread 60 with raise 60, the down stroke is spread 50 with raise -20. Raise alone on folded wings reads as paddling oars.

Three things to know:

1. The Y and Z rotations need opposite signs on the two sides.
2. The fin and its cyan strip are on different bones and the strip is not the fin's child. Past about 15 degrees the blade leaves the strip behind. Attach it once at load: `fin_L.attach(antenna_L_01)`, and the same on the right.
3. The spring solver of the old viewer resets these bones every frame. Do not run it on a bone the page animates.

## The face

`drone_face` is one screen over one picture: an atlas of three cells by three (each a third of the picture). The mesh's own UVs show the cell "normal" (u 0.338 to 0.666, v 0.663 to 0.989). Another face is the same UVs moved by whole cells:

|        | left                               | middle                                   | right                                       |
| ------ | ---------------------------------- | ---------------------------------------- | ------------------------------------------- |
| top    | `angry` (-1, 0): slanted teardrops | `normal` (0, 0): tall ovals              | `squint` (1, 0): `> <`                      |
| middle | `happy` (-1, -1): `^ ^`            | `dead` (0, -1): `X X`                    | `scan` (1, -1): a small waveform and a line |
| bottom | `ecg` (-1, -2): a heartbeat trace  | `sleepy` (0, -2): flat thin hollow ovals | `alert` (1, -2): tall sharp blades          |

The pair is (cells in U, cells in V). As a UV offset it is the pair divided by three:

```js
map.wrapS = map.wrapT = THREE.RepeatWrapping;
map.offset.set(du / 3, dv / 3); // or add the same to vUv in the shader
```

These signs hold for this file (`faces.png` draws all nine with them on every build). A GLB made by another tool may store the picture the other way up, and then the row signs flip.

There is no closed eye in the atlas. A blink is made in the shader: squash V about the eye line (v 0.585 of the cell) until the ovals close to a line near 0.94; a look is a slide of the cell by up to 0.10 of a cell. Both work on every cell.

## The still

The pose is `HERO_POSE` in `build.cjs`, the pose the live drone rests in on the first screen: yaw 40 (the face to the right of the screen and a little to the visitor), pitch 6 (the nose a touch down, so the top of the head shows), roll -4, wings spread 35 and raised 12. Unlit, with the outline the page also draws: the same skin, back faces only, pushed 3.5 mm along normals that are averaged per position (so the hull stays closed at hard edges), in `#2a3342`.

- 1440 by 740, WebP quality 0.9 with alpha, drawn at twice the size and scaled down.
- **The drone's own origin is the exact middle of the picture**, so the page lays the picture where the live drone would be. That is why the picture is wider than the drone: the paint runs from 0.9 to 76.7 percent of the width (about 1,090 px) and from 0.8 to 95.5 percent of the height.
- The picture is 0.98334 m of the model across (0.50533 m tall), seen from 3.2 m. `features/about/drone/model.ts` holds these three numbers as `STILL`: if the pose or the size changes, the build prints the new ones and they must be written there.
