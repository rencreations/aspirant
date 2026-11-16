# Tetra of the About page (`scripts/about/tetra/`)

Turns the rigged model `D:\ren\aspirant\3d\angela\tetra.fbx` (read only), its rig file and three Mixamo clips into the one file the page uses:

| File                                     | What it is                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/public/models/about/tetra.glb` | The model: 573,716 bytes, unlit, 37 bones, three pictures and three clips inside. `TETRA_MODEL` in `apps/web/src/features/about/tetra/model.ts`. |

Never edit the file by hand. Change the build and run it.

## How to run

```
node scripts/about/tetra/build.cjs
node scripts/about/tetra/build.cjs --renders D:\some\folder      # where the check pictures go
node scripts/about/tetra/build.cjs --out D:\trial --quality 1    # a trial: the file goes to D:\trial
node scripts/about/tetra/build.cjs --source D:\other\3d          # another source folder (or ABOUT_TETRA_SOURCE)
```

It needs Chrome (the build runs in real Chrome through Playwright, headless, with the GPU) and the packages of `apps/web` installed: Playwright and three come from there, so the model is written by the same three the page loads it with. The build starts a small server on a free port and stops it again. It takes about fifteen seconds.

If the byte count changes, write the new one into `TETRA_MODEL_BYTES` (the build says so when the number in `model.ts` is not the file's). If the file was ever published under this name, also bump the cache name in `apps/web/src/lib/media-store.ts`.

| File here                         | What it does                                                           |
| --------------------------------- | ---------------------------------------------------------------------- |
| `build.cjs`                       | The steps, the checks and the check pictures.                          |
| `page/convert.js`                 | FBX to GLB, in the page: the parts, the eyes, the skeleton, the clips. |
| `page/stage.js`                   | Loads the GLB back, describes it, draws the check pictures.            |
| `page/index.html`, `page/main.js` | The page the build opens.                                              |

## The rig, as it was checked

The source is one skinned mesh of 4,872 triangles (14,616 loose corners), 0.649 m tall, feet on the ground, facing +Z, with 96 bones: the 65 Mixamo bones by name, 15 spring bones (hair, ears, skirt), IK targets and sockets. What the check found:

- **The Mixamo names and frames are right.** The four clips of the source's viewer play by bone name. Knees and elbows bend the right way and nothing twists. The hips' position needs the rig file's scale (0.001769).
- **The skin is sound.** Every corner's weights sum to 1, at most four bones each. The fingers past the first joint, the feet, the toes, the IK bones and the sockets carry no skin. The hands are mittens and the legs end in a point.
- **The proportions limit the clips.** Her arm is shorter than her head is tall and the sleeves are wide: in a human dance the sleeves meet in front of the chest. The page holds her arms a little open while a clip plays.
- **The eyes are three pieces each**: the iris (a disc on the bone `eye_L` or `eye_R`), the lash over it, and a dark chevron on `eyelid_L` or `eyelid_R`, which is the squeezed eye of a "> <" face. In the game the chevron is surely hidden until it is wanted. In the source file it sits behind the iris at full size, so **a dark wedge shows at the inner corner of each open eye**.
- **The blink was wrong.** The source's `blink` target slides the chevron 2.6 cm down the cheek while it sinks the iris and the lash 1.2 cm into the head. Half way there the eye is a dark slab over a shrinking iris, and shut it is "> <" lying on the cheeks, under where the eyes were. `eyes_sleepy` is the same target at half strength, so the rig file's `happy`, `sad`, `angry` and `sleepy` faces had the same fault. The look targets slid the iris across the chevron, which drew a dark bar over one eye.
- **The mouth is eight drawings** (15 triangles each, one atlas of 768 by 256 with a separate mask), each a point inside the face until its target opens it. That works and is kept. A ninth, stray piece of 8 triangles hangs partly on a hair bone and is thrown 14 cm back, into the head, by every mouth target: it is dropped.

## What the build does

1. **Splits the mesh** into the pieces that hang together and sorts them by the bone they hang on: the body and hair, the two irises, the two lashes, the two chevrons, the mouth. The build stops if a piece is not the size it expects.
2. **Makes the eyes again**, as a small mesh of their own (216 vertices) with six new targets. The chevrons rest as one point inside the head, so nothing shows at the corner of the open eye.
   - `blink_L`, `blink_R`: the iris is squashed onto a line three tenths of the way up the eye and the lash rides its top edge down to that line, a little flatter and a hair in front. Nothing sinks and nothing slides: shut, the eye is the lash alone, a clean arc. Half shut is a sleepy lid. (`BLINK` in `page/convert.js`.)
   - `squeeze`: the chevrons open where they were modelled, over the eyes, and the iris and lash go inside the head. It is a face of its own ("> <"), switched on whole, never a step of the blink.
   - `wide`: the iris a tenth larger, the lash a little higher.
   - `look_x`, `look_y`: the iris slides 5 mm or 4 mm, the lash follows by less. Weights from -1 to 1.
3. **Keeps the mouth** as a second small mesh (112 vertices) with its eight targets (`mouth_a`, `mouth_i`, `mouth_u`, `mouth_e`, `mouth_o`, `smile_mouth`, `grin`, `frown_mouth`), and joins its colour and its mask into one picture with an alpha channel. A target under 1 draws the same mouth smaller.
4. **Welds the vertices** (the body: 13,482 corners to 3,255 vertices). The build has its own weld, because three's `mergeVertices` does not look at morph targets. No normals are written: nothing is lit, and the page works out the smooth ones its outline needs.
5. **Drops the bones nothing needs**: 96 become 37. The eyes and the mouth hang on the head.
6. **Replaces the materials** with unlit ones (`KHR_materials_unlit`): `tetra_body`, `tetra_hair`, `tetra_eyes` (the hair's picture), `tetra_mouth` (see-through).
7. **Fits three clips** and writes them into the file: `walk` (1.37 s), `hiphop` (4.47 s), `rumba` (2.37 s). Rotations of the kept bones only (no fingers), and the hips' position in the model's metres. The walk's steady travel is taken out and written down as a speed (0.186 m/s): the page moves her at exactly that speed times the rate it plays the clip at, so the feet do not slide. The dances are centred on their own middle.
8. **Writes the facts a GLB has no place for** into the extras of the node `tetra`: the 15 springs and 12 capsules of the rig file, and the clips' lengths and the walk's speed.
9. **Writes one binary file** with `GLTFExporter`: the two painted pictures (512 by 512) as WebP at quality 0.95, the mouth's flat picture lossless.
10. **Loads the file back** with `GLTFLoader` and stops with an error if anything the page relies on is wrong (the bones it turns, the targets, the clips, the materials, the springs, the height, a size over 1.2 MB).
11. **Draws check pictures** into `--renders` (default: `aspirant-about-tetra` in the temp folder). Read them after every build:
    - `blink-before.png`: the source's blink at 0, 0.25, 0.5, 0.75 and 1, from the front and three-quarter.
    - `blink-after.png`: the new blink at the same steps from three sides, at the page's size, a wink, half shut, the squeeze.
    - `faces.png`: every target and the faces the page makes of them, front and side.
    - `views.png`, `clip-walk.png`, `clip-hiphop.png`, `clip-rumba.png`.
    - `summary.json`: every number here, and how high each clip leaves the legs' ends (`legTips`; the rest pose is 0.012). The page takes that difference out (`CLIP_LIFT` in `model.ts`).

## What the page moves by hand

The performance (`apps/web/src/features/about/tetra/performance.ts`) writes turns about her own axes (x her left, y up, z forward) and the scene lays them on these bones, after the clip and before the springs:

| Turn             | Bones                                              |
| ---------------- | -------------------------------------------------- |
| `hips`           | `mixamorigHips`                                    |
| `spine`          | `mixamorigSpine1`                                  |
| `head`           | `mixamorigNeck` (35 percent), `mixamorigHead` (65) |
| `armL`, `armR`   | `mixamorigLeftArm`, `mixamorigRightArm`            |
| `foreL`, `foreR` | `mixamorigLeftForeArm`, `mixamorigRightForeArm`    |
| `legL`, `legR`   | `mixamorigLeftUpLeg`, `mixamorigRightUpLeg`        |

The 15 spring bones (`hair_*`, `ear_L`, `ear_R`, `skirt_*`) belong to the solver alone (`spring.ts`, the viewer's `spring.js` ported and stepped at a fixed sixty a second). No clip and no turn touches them. Squash and stretch is done in the shader, after the skin, so the bones and the springs never see it.
