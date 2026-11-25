# Mr. Bunny of the About page (`scripts/about/bunny/`)

Turns Chang'e's drone, Mr. Bunny, out of `D:\ren\aspirant\3d\change\change.fbx` (read only) into the one file the page uses:

| File                                     | What it is                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/public/models/about/bunny.glb` | The model: 268,204 bytes, unlit, nine bones, 17 morph targets, a blank screen for the page's face, one picture inside. `BUNNY_MODEL` in `apps/web/src/features/about/bunny/model.ts`. |

Never edit the file by hand. Change the build and run it.

## How to run

```
node scripts/about/bunny/build.cjs
node scripts/about/bunny/build.cjs --renders D:\some\folder      # where the check pictures go
node scripts/about/bunny/build.cjs --out D:\trial                # a trial: the file goes to D:\trial
node scripts/about/bunny/build.cjs --source D:\other\change.fbx  # another source (or ABOUT_BUNNY_FBX)
node scripts/about/bunny/build.cjs --no-renders                  # the file and its checks, no pictures
```

It needs Chrome (the build runs in real Chrome through Playwright, headless, with the GPU), the packages of `apps/web` (Playwright, three, TypeScript) and those of the repository's root (glTF Transform, sharp). The build starts a small server on a free port and stops it again. It takes about ten seconds. The same source gives the same bytes (checked: two builds, identical files).

If the byte count changes, write the new one into `BUNNY_MODEL_BYTES` (the build says so, and `model.test.ts` fails until it matches). If the file was ever published under this name, also bump the cache name in `apps/web/src/lib/media-store.ts`.

| File here                         | What it does                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `build.cjs`                       | The steps, the checks of the file and of what GLTFLoader reads back.                                               |
| `write.cjs`                       | Writes the GLB with glTF Transform: quantised attributes, sparse targets, one WebP picture.                        |
| `pictures.cjs`                    | The check pictures, and the checks that need the loaded file (the source against the build, the hinges, the face). |
| `page/convert.js`                 | The drone out of the FBX: its frame, its parts, the bones, the weights, the targets, the picture.                  |
| `page/geometry.js`                | Pieces, fits, a ray, the cutting of the ears, the outline's normals.                                               |
| `page/targets.js`                 | The morph targets, as fields of the body's frame, and what they do to the hinges.                                  |
| `page/paint.js`                   | The crop of the picture.                                                                                           |
| `page/stage.js`                   | Loads the GLB back, describes it, poses it through the recipe below, draws the check pictures.                     |
| `page/index.html`, `page/main.js` | The page the build opens.                                                                                          |

## The source, as it was checked

- **One file, several meshes, no skeleton.** `change.fbx` is the earlier single-mesh conversion: Chang'e's body, face, eyes, hair, glasses and moon weapon, three collapsed copies of her face, and the drone. The drone is the mesh `jiqiren` ("robot", 2,080 triangles). Its painted face is two more meshes, `jiqibiaoqing` ("robot face", 88 triangles): cyan pixel shapes that float 2 to 30 mm in front of the glass. Nothing else is kept.
- **The picture is the weapon's.** The drone uses a band of the 1024 by 1024 picture it shares with Chang'e's weapon (`change_skin09_high_weapon_d.png`).
- **It stands upright and faces +Z already.** The top of the crest faces (0, 0.9994, 0.035). The glass faces 11.6 degrees down: that is the drawing, not a tilt.
- **It is its own mirror** across x = -0.81728 of the file, to 0.15 mm, except the round pieces of the back (the back plate, the lens and its ring: discs triangulated at a turn), whose boxes sit on the mirror to 0.4 mm.
- **Nine pieces** by shared places: the shell (1,196 triangles), two ears (136 each), two small brackets at the roots of the ears (12), two foot blades with most of their pins (240) and the rest of the two pins (54). The side discs, the back lens and the screen are welded into the shell.
- **Size, as in the source** (the drone at its size beside Chang'e in the same file): 0.520 m across the ears, 0.515 m from the foot blades to the ear tips, 0.413 m deep. The body alone is 0.458 by 0.343 by 0.413 m.

## What the build does

1. **Reads the FBX** with three's `FBXLoader` and keeps `jiqiren`. It stops if any count above is not what it was.
2. **Finds the frame.** The axes are the file's: Y up, the screen to +Z, the bunny's own left is +X. The origin is the middle of the body's box (the shell and the brackets; the ears and the feet left out), at (-0.81728, 1.68395, 0.18703) of the file.
3. **Cuts the parts.** The glass is the piece of the shell (cut at its UV seams) that faces forward and is largest: 100 triangles, black in the paint. It gets its own material, so the page can draw the face. The ears and the feet (each blade with its pin) are rigid pieces of their own.
4. **Places the bones** (table below). An ear's long axis is the long axis of its spread, its facing the normal of its flat blade, its hinge the place where that axis meets the shell. A foot's Y runs from the pivot to the blade's far end, Z out of the blade's face, and X (across both) is the pin: the pin's discs (the small pieces that face along X) are found on both sides and span 3.0 cm, and the pivot is the middle of their box. Left and right are made exact mirrors.
5. **Cuts the ears finer.** The right ear is first checked against the left, corner for corner and UV for UV (to 0.15 mm). The left ear is then cut until no edge runs more than 16 mm along it (136 triangles become 792), so it bends as a curve, and the right ear is made as its mirror. Nothing moves: the new corners lie on the old triangles.
6. **Weights** one bone a corner, except along the ears: each of an ear's two upper joints blends over 9 percent of the ear's length on either side.
7. **Writes the targets** (table below) as fields of the place only, so corners that share a place (a UV seam, the rim of the glass on the shell) move together. The build checks it for every target in both meshes (895 shared corners).
8. **Gives each corner the normal the outline needs:** the mean of the face normals at its place that do not face the other way, so the outline stays closed at hard edges and the two sides of a thin plate keep a normal each.
9. **Crops the picture** to the band the drone uses (915 by 404 texels of the source). Every texel a kept triangle touches stays as it was (69,259 texels, checked), the paint is carried 6 texels further out for the smaller mip levels, and the rest is one flat colour: nothing of the weapon's paint ships. Lossless WebP, 30,900 bytes, decoded again and compared texel for texel.
10. **Writes the GLB** (`write.cjs`, below).
11. **Loads it back** with `GLTFLoader` and stops if anything the page relies on is wrong: the nine bones and their parents, no scale, the two meshes by material, unlit, one sided, skinned to the nine bones, the 17 targets by name on both, every target reaching as far as it was computed to, the mirrored pivots, the size to 2 mm, the extras.
12. **Checks the look** against the source: the source's drone and the build drawn from four sides share their outline to 0.04 percent and differ by more than 40 of 255 on under 1 percent of the pixels (the face, drawn by the shader, is most of that). It checks the recipe for the bones under the body targets (below) on real vertices, to 0.02 mm. Then it draws the check pictures.

### The file's layout (`write.cjs`)

- Places, normals and UVs are normalised integers (`KHR_mesh_quantization`, required). A place is a signed 16-bit share of one metre (steps of 0.03 mm, with no node scale to undo), a normal a signed byte, a UV an unsigned 16-bit share of the picture. Joints and weights are bytes. **Read an attribute with `getX` and friends, never from `.array`.**
- The morph targets hold places only (nothing is lit, so no normals), as normalised 16-bit offsets in metres. A target that moves under half the corners of a mesh is written sparse; one that moves none of them (the ear targets on the glass) has no data at all, which glTF reads as zeros.
- glTF Transform 4.5.1 writes the values of a sparse normalised accessor by decoding them to floats and storing the floats in an integer array, which would make every offset 0. So the targets are handed to it as plain integers and marked normalised in the JSON afterwards (`normalise` in `write.cjs`). The reach check in step 11 catches this kind of loss.

| Part                                              |   Bytes |
| ------------------------------------------------- | ------: |
| Morph targets (with their padding)                | 138,268 |
| Vertex attributes (2,623 vertices, 24 bytes each) |  62,952 |
| Triangles (3,392)                                 |  20,352 |
| The picture                                       |  30,900 |
| JSON (nodes, extras, accessors)                   |  15,128 |
| Bind matrices and the GLB's headers               |     604 |
| The whole file                                    | 268,204 |

## What is in the file

```
bunny_scene (Group)
  bunny (Object3D)              the root; its userData holds the extras below
    body (Bone)
      ear_L_1 > ear_L_2 > ear_L_3 (Bone)
      ear_R_1 > ear_R_2 > ear_R_3 (Bone)
      foot_L, foot_R (Bone)
    bunny_mesh (Group)
      two SkinnedMesh, one per material, sharing one Skeleton
```

- Find the two meshes by `material.name`: `bunny_body` (everything but the glass) and `bunny_face` (the glass). Their node names are the loader's.
- Metres, Y up, **the front is +Z**, the bunny's own left is +X. No node carries a scale. The origin is the middle of the body's box.
- The box: from (-0.2598, -0.2054, -0.2063) to (+0.2598, +0.3092, +0.2063).
- Both materials load as `MeshBasicMaterial` on the one picture (`flipY` false, sRGB). Set `toneMapped = false` on both, and `frustumCulled = false` on the skinned meshes.
- No animation. Every movement is made by the page.
- The root's extras: `body` (the body's box), `screen` (below), `ears` (length 0.25333 m, joints), `feet` (length 0.12599 m), `hinges` (below), `targets` and `bodyTargets` (the names).

## The bones

Every bone's long axis is its local +Y. A pose is `rest * turn` about the bone's own axes. Left and right frames are mirrors made right-handed, so a turn about X has the same sign on both sides and turns about Y and Z have opposite signs.

| Bone                 | Hangs on | Rest place (m)              | Rest turn (quaternion x, y, z, w)     | Pivot and axes                                                                                                 |
| -------------------- | -------- | --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `body`               | `bunny`  | 0, 0, 0                     | none                                  | The middle of the body. Carries the shell, the screen, the side discs, the lens and the ear brackets.          |
| `ear_L_1`, `ear_R_1` | `body`   | ±0.13314, 0.10624, 0.0601   | -0.21455, ±0.06757, ∓0.25425, 0.94062 | Where the ear's axis meets the shell. Y along the ear (out 30, back 29 degrees), Z out of its front panel.     |
| `ear_L_2`, `ear_R_2` | the `_1` | 0, 0.08444, 0               | none                                  | A third of the way up the ear (the ear is 0.25333 m from the hinge).                                           |
| `ear_L_3`, `ear_R_3` | the `_2` | 0, 0.08444, 0               | none                                  | Two thirds of the way up.                                                                                      |
| `foot_L`, `foot_R`   | `body`   | ±0.12911, -0.11727, 0.08584 | ±0.31411, -0.16758, 0.84979, ∓0.38872 | The middle of the pin at the blade's root. Y to the blade's tip (0.126 m), Z out of its face, X along the pin. |

There is no separate head: the drone is one round shell with the screen in it. The side discs (with their cyan rings), the back lens and the screen are welded into the shell, so a bone would tear them out: they stay on `body` and move by their targets (`pods_out`, `lens_out`, `brow_up`, `brow_down`) instead. The ear brackets stay on the body; the ears turn inside them.

| Motion          | Bones and local axis                                   | Sign                                                                                     | Range that looks whole |
| --------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------- |
| Ear splay       | `ear_*_1` about Z: left `-a`, right `+a`               | + leans the ear outward                                                                  | -25 to 60 degrees      |
| Ear fold        | `ear_*_1` about X, the same sign                       | + tips it forward, - lays it back along the head                                         | -60 to 40              |
| Ear twist       | `ear_*_1` about Y: left `-a`, right `+a`               | turns the ear about its own length                                                       | -45 to 45              |
| Ear bend        | `ear_*_2` and `ear_*_3` about X, the same sign         | + forward                                                                                | -35 to 35 each         |
| Ear bend aside  | `ear_*_2` and `ear_*_3` about Z: left `-a`, right `+a` | + outward (a flop)                                                                       | -30 to 45 each         |
| Foot swing      | `foot_*` about X (the pin), the same sign              | + swings the tip forward and out, - tucks it under                                       | -100 to 110            |
| Foot splay      | `foot_*` about Z: left `+a`, right `-a`                | + outward                                                                                | -15 to 30              |
| Foot twist      | `foot_*` about Y: left `-a`, right `+a`                |                                                                                          | -40 to 40              |
| Nod, turn, tilt | `body` (or the root) about X, Y, Z                     | X + is nose down; Y + turns the face to +X; Z + is counter-clockwise seen from the front | all the way round      |

Combine the ear's turns as `rest * Rz(splay) * Rx(fold) * Ry(twist)`, as the check pictures do. Bend an ear either with its targets or with `ear_*_2` and `ear_*_3`, not both far: an ear target moves the ear's middle in the rest pose, and the upper bones then turn about places it has moved (on a drooped ear a 30 degree bend puts the tip about 2 cm off). `ear_*_1` combines with every ear target exactly, because its hinge does not move.

## Body targets and the bones

`squash`, `stretch`, `puff`, `lean_L` and `lean_R` reshape the whole shell. The ears and the feet ride on it as rigid pieces: each target moves a whole piece by where its hinge goes, so with the bones at rest everything stays on. But a bone turns about its rest place, and the target has moved the piece away from it. So when a bone of a piece is turned (`ear_*_1`, `ear_*_2`, `ear_*_3`, `foot_*`), the page moves the bone with the piece. The root's extras give, for each body target and each piece (named by its first bone: `ear_L_1`, `ear_R_1`, `foot_L`, `foot_R`) at full weight, `shift` (how far the hinge moves, in the body's frame) and `turn` (how the shell turns there, a quaternion). Each frame, after setting the bones' turns and the influences, for each piece:

```js
// Once, for every bone: rest[bone.name] = { position: ..clone(), quaternion: ..clone() }
const shift = new THREE.Vector3();
const turn = new THREE.Quaternion();
for (const target of BUNNY_BODY_TARGETS) {
  const w = influence(target);
  if (!w) continue;
  const h = root.userData.hinges[target][first.name]; // first: ear_L_1, ear_R_1, foot_L or foot_R
  shift.addScaledVector(new THREE.Vector3(...h.shift), w);
  turn.premultiply(new THREE.Quaternion().slerp(new THREE.Quaternion(...h.turn), w));
}
first.quaternion.premultiply(turn); // optional: the piece tilts with the shell
// A bone turned away from its rest moves by (shift - turned shift), the shift seen from its parent.
const follow = (bone, s) => {
  const r = rest[bone.name];
  const away = bone.quaternion.clone().multiply(r.quaternion.clone().invert());
  bone.position.copy(r.position).add(s).sub(s.clone().applyQuaternion(away));
};
follow(first, shift);
if (first.name.startsWith("ear")) {
  // ear_*_2 and ear_*_3 hang below ear_*_1, so the shift is seen from its rest frame.
  const own = shift.clone().applyQuaternion(rest[first.name].quaternion.clone().invert());
  follow(ear2, own);
  follow(ear3, own);
}
```

`stage.js` poses every check picture this way. Measured on real vertices, with no tilt: the tip of the left ear (all three of its bones turned) and the tip of the left foot (swung 70 degrees) land, under every body target at 1, where they land with no target plus the shift, to 0.02 mm (the steps the file stores places in). Without the recipe they are off by 10 to 135 mm (`summary.json`, `checks.hinges`).

## The morph targets

Both meshes have all 17, in this order, with the same names (`morphTargetDictionary`). Set an influence on both meshes. The left and right ones are exact mirrors. A target is linear, so a bent ear at 0.5 is a little shorter than at 0 or 1 (its tip moves along a chord): `targets.png` draws every target at 0.5 and at 1.

| Target                       | At 1                                                                                                                    | Moves a corner up to |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------: |
| `squash`                     | The body 20 percent lower about its middle, bulging up to 15 percent at the waist (12 front and back). The pieces ride. |                34 mm |
| `stretch`                    | 20 percent taller, up to 9 percent thinner.                                                                             |                34 mm |
| `puff`                       | Swells: up to 12 percent to the sides, 10 front and back, 5 up.                                                         |                27 mm |
| `lean_L`, `lean_R`           | Bends from its foot toward its own left or right: each height turns about the bottom by up to 16 degrees.               |                95 mm |
| `brow_down`                  | The crest's point over the screen comes down 26 mm and in 7 mm, with the top of the glass: a frown. Fades over 6 cm.    |                27 mm |
| `brow_up`                    | The point goes up 20 mm: surprise.                                                                                      |                21 mm |
| `pods_out`                   | The side discs push out 24 mm; the shell round them follows.                                                            |                24 mm |
| `lens_out`                   | The back lens pushes out 12 mm.                                                                                         |                12 mm |
| `ear_L_droop`, `ear_R_droop` | The ear bends out and down in its own plane, 70 degrees along its length from 15 percent up: limp.                      |               129 mm |
| `ear_L_fold`, `ear_R_fold`   | The upper half folds forward 95 degrees at 44 to 62 percent of its length: a lop ear.                                   |               176 mm |
| `ear_L_perk`, `ear_R_perk`   | The ear turns 60 percent of the way to upright and grows 10 percent longer: alert.                                      |               111 mm |
| `ear_L_curl`, `ear_R_curl`   | The tip rolls back, 110 degrees, more toward the tip.                                                                   |               125 mm |

The face rides every target with the glass (it is drawn from the rest place, see below): `brow_down` squeezes the inner tops of the eyes, `squash` and `stretch` squash and stretch the whole face (`targets-face.png`).

## The face

The face is not a picture. In the source it is separate geometry, not paint, and the source has only the one face, so there was nothing to build an atlas of faces from. An atlas would also be a second picture (more bytes) and a fixed set of faces that cannot blend, blink or look. So the glass is left blank with its own material (`bunny_face`) and the page draws the face in its shader from a handful of numbers: `apps/web/src/features/about/bunny/face.ts` (the `BunnyFace` shape, the faces, `blendFace`, `packFace`, the shader chunks; tests in `face.test.ts`).

- It draws on the source's own grid of 5 mm cells (the screen is about 52 by 38 cells), so `neutral` is the source's face: two eyes 7 by 14 cells with a 3 by 2 notch at each end, and the cat's mouth cell for cell. Laid over the source's painted face (`face-source.png`), 85 percent of the lit pixels are shared; the rest is the source's shapes curving in front of the glass.
- Every number blends, so any face turns into any other with no step; a blink squashes whatever the eye is to a short line; the eyes look and the mouth follows by half; `talk` opens any mouth for a word or a note; `on` lights the screen; `glow` adds an LED's soft light; `pixel` set to 0 draws it smooth. When a cell would be under about two screen pixels it is drawn smooth anyway, so it never shimmers: smooth with the bunny under about 170 pixels wide, in cells over about 260.
- L and R are the bunny's own left and right, as in the rig: `blinkL` and `winkL` are the eye on the viewer's right.

The screen, in the root's extras (`screen`): `centre` (0, -0.04295, 0.196784), `right` (1, 0, 0), `up` (0, 0.979555, 0.201175), `normal`, `pixel` 0.005, and its half size in cells (26.1 by 19.2). `setScreen` writes it into the uniforms. To fit the face to the material:

```js
const u = makeFaceUniforms();
setScreen(u, root.userData.screen);
u.uCyan.value = new THREE.Color(FACE_CYAN).toArray(); // linear; the same for uPink, uRed, uBlue
material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, u);
  shader.vertexShader =
    FACE_VERTEX_HEAD +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\n${FACE_VERTEX_BODY}`,
    );
  shader.fragmentShader =
    FACE_FRAGMENT_HEAD +
    shader.fragmentShader.replace("#include <map_fragment>", FACE_FRAGMENT_MAP);
};
// Every frame: packFace(u, shape, live), with shape blended from FACES.
```

| Face        | Drawn as                                                                      |
| ----------- | ----------------------------------------------------------------------------- |
| `neutral`   | The source's own: notched tall eyes and the cat's mouth.                      |
| `happy`     | Arches, a small open mouth, a blush.                                          |
| `laugh`     | Squeezed shut (`> <`), a wide open mouth, a blush.                            |
| `surprised` | Rings and a small "o".                                                        |
| `scared`    | Small eyes, a wobbling mouth, a drop of sweat.                                |
| `angry`     | Eyes cut by slanted lids, a frown, the cross-shaped vein mark.                |
| `sleepy`    | Half shut, level, a small "o", and z.                                         |
| `love`      | Hearts and an open mouth in pink, a blush.                                    |
| `wink`      | The left eye shut in an arch, a smile tilted up to that side.                 |
| `dizzy`     | Spirals and a wobbling mouth (`spin` turns them).                             |
| `smug`      | Lids half down, one lower than the other, the lower lids up, a crooked smile. |
| `sad`       | The outer ends of the lids down, a frown, a tear under each eye.              |
| `singing`   | Content arches, a tall open mouth, a note.                                    |
| `ko`        | Crosses and a wobbling mouth.                                                 |

## The check pictures

The build draws them into `--renders` (default: `aspirant-about-bunny\renders` in the temp folder). Read them after every build.

- `source-whole.png` (the whole file), `source.png` (the drone as it is in the source), `compare.png` (source and build side by side from four sides), `views.png` (eight views, the outline on, one sided).
- `bones-ears.png`, `bones-feet.png`, `bones-body.png`: every bone to both ends of its range.
- `targets.png` (every target at 0.5 and 1), `targets-front.png`, `targets-face.png`, `targets-bones.png` (the body targets with the ears and the feet turned), `targets-bones-recipe.png` (with and without the hinge recipe).
- `face-source.png`, `faces.png`, `faces-live.png` (blinks, looks, talk, blends, light, smooth), `faces-small.png` and `faces-small-quarter.png` (the bunny about 150 pixels wide).
- `picture.png` (the picture in the file), `summary.json` (every number above).
