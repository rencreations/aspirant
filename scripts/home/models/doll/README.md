# The Obsidia doll of the home page (`scripts/home/models/doll/`)

Turns the Meshy rig of the chibi boxer doll, its Mixamo walk and its four maps into the files the home page loads:

| File                                               | What it is                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/web/public/models/home/doll.glb`             | The model: 1,132,208 bytes, lit PBR, 22 bones, three WebP maps, the clip `walk`, a clean face.       |
| `apps/web/public/models/home/doll-rig.json`        | Every number the actors need: bones, sockets, face frame, walk facts, stretch recipe, limits, light. |
| `scripts/home/models/doll/face/face.glsl`          | The face, drawn in the doll's material (generated). `presets.json` holds 24 expressions.             |
| `scripts/home/models/doll/curation/face-tris.json` | The triangles of the face (753) and of the lash and brow pieces pressed onto it (94).                |

Never edit the outputs by hand. Change a script and run it.

## How to run

```
node scripts/home/models/doll/build.cjs                      # doll.glb + doll-rig.json into apps/web/public/models/home
node scripts/home/models/doll/build.cjs --out D:\trial --renders D:\trial\pictures
node scripts/home/models/doll/build.cjs --reselect           # choose the face triangles again (face-select.py)
node scripts/home/models/doll/build.cjs --dump D:\work       # only write the source mesh as JSON
node scripts/home/models/doll/face/build-face.cjs            # face.glsl and presets.json from face.glsl.in, params.json, presets.src.cjs
node scripts/home/models/doll/face/preview.cjs               # every expression at 0, 30 and 60 degrees, large and 120 px tall
```

It needs Chrome (real Chrome through Playwright, headless, with the GPU), the packages of `apps/web` (Playwright and three come from there, so the file is written by the same three the page loads it with) and the anaconda Python (`HOME_PYTHON`, default `C:\Users\muham\anaconda3\python.exe`: Pillow, numpy, scipy). The source is read only: `D:\ren\aspirant\3d\obsidia\Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking\` (`--source` or `HOME_DOLL_SOURCE` names another folder). The build takes about 40 seconds and prints its numbers; the check pictures go to `--renders` (default: the temp folder). Read them after every build.

| File here                            | What it does                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `build.cjs`                          | The steps, the checks, the check pictures, the facts file.                                                     |
| `face-select.py`                     | Chooses the face triangles (numpy, scipy) and where the lash pieces are pressed to.                            |
| `bake.py`                            | Takes the painted face out of the maps and makes them small (Pillow, numpy, scipy).                            |
| `page/convert.js`                    | The FBX to the GLB, in the page: mesh, skeleton, clip, export, and the proof against the source.               |
| `page/source.js`, `page/analysis.js` | Reading the FBX; looking at a selection of triangles (magenta on the base picture).                            |
| `page/stage.js`                      | Loads the GLB back, draws the check pictures, poses by the world-axis formula.                                 |
| `poses.json`                         | The poses (turns in model axes), the formula and notes.                                                        |
| `face/`                              | `params.json` (the 55 floats), `face.glsl.in`, `presets.src.cjs`, `build-face.cjs`, `preview.cjs`, `preview/`. |

## The rig, as it was checked

- **Units.** The FBX is in centimetres. The file is in metres, **1.7 m tall**, feet on y 0, front +Z. The body's line was 3.6 cm off the hair's middle and the feet 19.9 cm in front of the origin: both are moved out (`ORIGIN_CM` in `convert.js`). A page that draws her 0.30 m tall scales the whole by 0.1765.
- **No node has a rotation or a scale.** The FBX has an `Armature` group turned -90 degrees about X above `Hips`. The build rebuilds the skeleton from the world bind pose with `Hips` as the root, and writes the inverse bind matrices again. The proof: the rebuilt doll and the source rig, both posed by the walk clip at four times, differ by at most 1.2 mm (mean 0.2 mm) on every vertex that is not on the face. The check is in the build and fails it above 12 mm.
- **22 bones, not 24.** `head_end` and `headfront` never move and carried weight on 5,475 and 55 vertices: folded into `Head`. At most four influences, weights as normalised bytes that add up to 255.
- **Names.** The Meshy names stay (`Spine02` is Mixamo's `Spine`, `Spine01` is `Spine1`, `Spine` is `Spine2`, `neck` is `Neck`: the numbering is reversed, the map is in `doll-rig.json`). Nodes: `doll` (the group), `doll_body` (the one SkinnedMesh), `Hips` and its bones, `socket_hand_L`, `socket_hand_R`, `socket_head_top`.
- **The mesh.** 14,385 triangles, 14,516 vertices (the 10,948 of the source, split where a normal or the face border needs it). Position and normal float, uv as normalised 16 bit (v flipped to glTF's, the maps stay upright), joints bytes, weights normalised bytes, `_FACE` float. Normals are smooth with a 60 degree crease: the FBX's own are flat per triangle (the smoothness of the original came from its normal map), the hard edges of the tiara and the leotard stay hard.
- **The maps.** Base 2048, normal 1024, one packed 1024 for roughness (G) and metalness (B), WebP at 0.85. The colour is the picture the FBX carries itself (warmer and brighter than the separate base file, which is a plain albedo and comes out grey and washed in any sensible light), with the face area replaced by skin.
- **The walk.** The clip from the Walking file, 22 rotation tracks plus the hips' position, `walk`, 1.0333 s, in place, the last key equal to the first. The hips' path is retargeted by its offset from each file's own bind pose and lifted 0.02126 m so the lowest foot touches y 0 (the walk's skeleton stands 3.5 cm taller). The planted foot goes back at 0.54 m/s (in the 1.7 m units).

## The face

The face of the doll is paint on a chart soup atlas (hundreds of small islands), so morph targets cannot reshape it. The page draws a face of its own in the doll's material:

1. **Which triangles.** `face-select.py`: for every 1 cm cell of the front of the head, the deepest front-facing triangle is the skull; a triangle within 1.6 cm of that surface is the skin or paint on it; one whose picture is the pink of the hair is dropped (the bangs lie on the face); one neighbour-vote pass fills holes and removes specks; the largest piece is kept (753 triangles). The dark lash, lid and brow pieces that stand off the face (94 more) are the "relief": found by colour (dark, or touching dark paint at two of ten sample points). The list is committed (`curation/face-tris.json`); `curation/face-edits.json`, if it exists, adds or removes triangles by hand with a reason (none was needed).
2. **The maps (`bake.py`).** The face area is repainted in the base with the skin colour (a normalised blur of the skin pixels only, held within 9 of 255 of their mean, so the paint leaves no trace and the glow round the eyes does not show as patches), flat in the normal map, and the skin's own gloss in the roughness. The area is grown 6 pixels into free texels only (never into another triangle's area), so the gutter round each chart, which holds the old paint spread outward, cannot bleed back through the filtering. 4.0 percent of the atlas is repainted.
3. **The geometry.** The relief pieces are pressed flat onto the face, their normals taken from the face under them, and the shell of the face is smoothed (Taubin, eight rounds, borders fixed) so the sockets and lid rims of the painted eyes do not show as dents and fins that the drawn eyes do not follow. The largest move is 5.7 cm in the file's units (1.0 cm on a 0.30 m doll).
4. **The gate.** `_FACE` is 1 on those triangles and constant per triangle (vertices are split on the border). The shader draws only where it is 1, from `vBind = position` (the bind position, rigid in head space): it follows the head, the hair hides it exactly (no feather and no UV mask, so nothing can bleed onto the bangs), and a 60 degree turn shows no ghost.
5. **The drawing (`face/face.glsl`).** Signed distance shapes over the sampled base: two eyes with sclera, a crystal iris (red on the screen's left, blue on the right, as modelled), pupil, two highlights, heavy upper lash with the outer flick; eight glyph eyes that blend (`^`, `>` `<`, spiral, heart, sparkle, X, dot, sleepy line); brows; the mouth (line that bends from frown to smile, D, O, scream, cat, wavy, pout, fangs, teeth, tongue); tears, sweat, blush, forehead gloom, an angry red, a shocked pale. 55 floats in a uniform array (`face/params.json`), 24 expressions (`face/presets.json`). Every stroke has a one pixel floor from `fwidth`, so the face reads at 120 px tall. See the header of `face.glsl.in` for how a page wires the four chunks in (`face/preview/main.js` does it, as a reference).
6. **Blends.** Any two expressions interpolate their numbers; open eyes and glyph eyes cross-fade (a ghost), so swap a glyph behind a blink (`blinkL`, `blinkR`) over 60 to 100 ms.

Faces are placed in head-bind metres, measured on an orthographic front view (plus or minus 1 cm): red iris (-0.181, 0.884), blue iris (0.2015, 0.912), mouth (0.005, 0.757). The head is tilted: the blue eye is 2.8 cm higher, and the face space is levelled on the eye line (`roll` 0.0731 rad, in `doll-rig.json`).

## Poses

`poses.json` holds the poses the page needs (stand on a palm, ride astride, scream with fists up, fall, sit on a frame, reach with a stretched arm, run, held) as turns about the model's axes in the parent's bind frame: `q_local = inverse(pBind) * R * pBind * restLocal`. `poses.png` (from the build) draws them from the front and the side. What they can and cannot do: **hands are mittens, legs end in stumps** (no gloves, fingers, toes, stirrups); head and hair are 82 percent of the vertices, so any arm above the shoulder line vanishes into the hair from the front (fists up is a forward-arms pose). **A hang by one hand is not achievable**: the arm straight up (a turn about Z of 100 to 150 degrees, stretched, with a hips roll of 28 degrees either way) is inside the hair from the front, the three-quarter and the side; the forward and up `reach` clears the hair but ends at head height. Put the edge she holds at `socket_hand_L` and let her legs dangle (`held`), or shoot from below. The stretch: `LeftArm.scale.y = 1.6` with `LeftHand.scale.y = 0.625`, **never `ForeArm` too** (it compounds). Never mirror a pose by negating X: the left and right bone frames are not mirrors.

## Lighting

A lit `MeshStandardMaterial` (a recorded exception to the site's unlit style): a PMREM of `RoomEnvironment` (`fromScene(env, 0.04)`) at intensity 0.45, a warm key 1.0, a cool fill 0.35, a rim 0.5 and a hemisphere 0.25, `NoToneMapping`. The sum is about 1: any more burns the skin to white; ACES and AgX wash the pink out. The exact recipe is in `doll-rig.json` (`lighting`).

## Not verified

Firefox and Safari (WebP maps and the uniform array on the shader), a real weak machine, the doll under the home's own post passes, the face under a different light rig, the walk's speed against the feet on a real floor (measured, not looked at in motion), the `crying`, `scared` and `laughing` tears on every yaw. The face has a faint seam where the face region meets the bangs above the eyes (a ridge line across the forehead at 30 to 70 degrees); the drawn brows cover most of it.
