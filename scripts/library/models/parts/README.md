# The parts pipeline (3D Models room)

Cuts the character and item views of `/collection/models` out of the owner's model files, one GLB per view, each showing one thing. The contract for every file is in `docs/superpowers/specs/2026-11-25-models-room-redesign.md` ("Every GLB"); the view ids are in `../entries.json`. Selena, Silverbolt, the Guinevere drones, Mr. Bunny and Tetra are made elsewhere.

## Run

```
node scripts/library/models/parts/build.mjs              # every view
node scripts/library/models/parts/build.mjs --only ruby,angela
node scripts/library/models/parts/sheets.mjs             # the contact sheets (after a build)
node scripts/library/models/parts/sheets.mjs ruby lesley
node scripts/library/models/parts/explore.mjs <source> <out.png> [--only <regexp>] [--min <tris>] [--within x0,y0,z0,x1,y1,z1] [--whole]
```

It needs the installed Chrome (Playwright from `apps/web`, `channel: "chrome"`), the site's three from `apps/web/node_modules/three`, and the root packages `@gltf-transform/*`, `meshoptimizer` and `sharp`. It starts its own server on a free port and stops it.

## What it reads and writes

Reads (never writes):

- `D:\ren\aspirant-r2\library\v1\others\3d\<slug>\`: the game client OBJ files the old room showed (Fanny, Layla, Lesley, Chang'e, Guinevere, Vexana, Eternal Guard), with their `.mtl` and pictures.
- `D:\ren\aspirant\3d\<name>\`: the rigged conversions (`ruby/ruby.fbx`, `ruby/scythe.fbx`, `angela/angela.fbx`, `angela/drone.fbx`), pictures embedded.
- For the sheets only: the old room's screenshots, cropped, in `D:\ren\aspirant-work\models-room\parts\before-crop\`, and Angela's original FBX in the mirror (`others/3d/angela/`).

The owner's downloads (`C:\Users\muham\Downloads\3d\`, unpacked into `D:\ren\aspirant-work\models-room\parts\src\`) were all looked at while deciding. They hold the same client files as the mirror, plus Ruby's and Angela's original FBX and their pictures (Ruby's `29_Ruby_skin07_high_04_alpha.png` among them). Nothing in the pipeline reads them.

Writes:

- `D:\ren\aspirant-r2\library\v1\models\v1\<view id>.glb`: the 20 views below, and nothing else in that folder (other pipelines write there too). A file replaced under the same key needs a new folder (`models/v2/`): the bucket caches for 30 days.
- `D:\ren\aspirant-work\models-room\parts\raw\<view id>.glb` (the exporter's file before the size pass), `build-report.json` (size, parts, placement and pictures of each view) and `sheet-<name>.png`.

## How it works

1. **Cut, in Chrome, with the site's three** (`page/recipes.js`, one recipe per view). The sources are loaded the way the old room loaded them (OBJ with one plain material per `.mtl` entry, the pictures repeating, the `.mtl` opacity kept; FBX with FBXLoader), split into pieces by object and material, and into islands (triangles that share a corner) where a part has to be found inside a piece. Then turned and placed (below) and written by three's `GLTFExporter`.
   - Why three and not Blender: Blender's FBX import and glTF export keep the bones' places but change their local frames (up to 180 degrees on Ruby's hips and legs). The room turns Mixamo bones by name and Mixamo clips set local rotations, so the frames must stay exactly as three reads the FBX.
   - **One skeleton.** FBXLoader gives each skinned mesh of a file its own copy of every shared bone, nested in the first with no offset. Written as they are, the copies get new names (`mixamorigSpine1_1`) and a turn of `mixamorigSpine1` moves one mesh only. Every mesh is bound to the outermost copy (checked to be in the same place) and the copies are removed, so each file has one skeleton with the source's names (Ruby 130 bones, Angela 116, the drone 10).
   - **Mouth patches left out.** The conversions add a generated mouth patch (`*_mouth` material, drawn atlas with a separate alpha picture) over the mouth painted on the face. It is left out, so the face shows the game's own painted mouth. Ruby's file had one; Angela's mouth is real blendshapes and has none.
2. **Size pass, in node** (`build.mjs`). The exporter draws every picture through a canvas, which loses the colour wherever alpha is 0. So each picture is replaced by the original file (from disk, or the bytes embedded in the FBX), turned upside down as the exporter stores it. A guard compares the exporter's copy with the original and stops the build if they differ. Alpha is dropped where every material that uses a picture is opaque. Pictures become WebP (quality 92) at most 2048 px for characters and 1024 for items (no source is larger than 1024). Geometry is welded, quantised (position 14 bits, normal 10, UV 12, weights 8) and meshopt compressed, as `scripts/home/models/lib/optimize.mjs` does.
3. **Checks** (`sheets.mjs`): every file is loaded back with GLTFLoader and the meshopt decoder and drawn from the front, three quarters, the side and the back (items also from the top), on a plain light ground with a sky light and one key light, the base colour lit with MeshLambert as the room lights it.

Materials: metallic-roughness, the picture as base colour, double sided (the old room drew everything double sided), `BLEND` with the `.mtl` opacity only where the old room made a part see-through (Chang'e's glasses 0.758, Vexana's cape 0.76). No source picture has a cut-out, so there is no `MASK`:

- Guinevere's face and Vexana's eye pictures carry alpha that the old room ignored; their files are opaque and look the same as before (checked side by side in the sheets).
- Ruby's ribbons (`ruby_body02`, the zigzag frill under her skirt) have a separate `29_Ruby_skin07_high_04_alpha.png` in her original download. Its lowest value is 196 of 255: a soft see-through, not a hole. The frill's zigzag is in its geometry, so it stays opaque.
- Angela's `Angela_body_Alpha.png` marks a few texels only and is not used either.

## Placement and scale

- Y up, metres, front toward +Z (every source already faces +Z).
- **Characters**: the figure (body, face and hair, without what it holds) is scaled to 2.00 m tall, as the rigged conversions are; the figure's middle is on x = 0, z = 0; the lowest point of the whole view is on y = 0 (for Chang'e that is the bottom of her moon). Ruby, Angela and the drone are not scaled (the conversions are already 2.00 m; their skeletons stay as they are).
- **Items** keep their owner's factor (so an item is the size it is in its owner's hand), are turned as the table says, and have their box's middle on the origin. Long items are turned by their principal axes (the length on Y or X, the width on X or Y, the thin side toward Z) with a hint for which end is the tip.

Factors (from `build-report.json`): Fanny 1.0076, Layla 1.0867, Lesley 0.8427, Chang'e 0.9466, Guinevere 109.69 (her client file is a hundredth of the others; it is scaled by 100 before the islands are found, then by 1.0969), Vexana 1.0141, Eternal Guard 0.7508.

## The views

| View                  | Source                                 | How it is cut                                                                                                                                                                            | Turned                                                                              |
| --------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `fanny`               | Fanny's client OBJ                     | every object but the drone (`jiqiren007_0/1`) and the two weapon sets (`fanni_wuqi_0`)                                                                                                   | as she stands                                                                       |
| `fanny-blade`         | same                                   | the blade of the first weapon set (the island over 1000 triangles, longer than 1.4, at x below 1.7)                                                                                      | a quarter turn about Z: tip up, flat toward the front                               |
| `fanny-thruster`      | same                                   | the rest of the first set: the housing with its turbine discs, fins and side plates (8 islands). It sits under the blade in her weapon set                                               | level, nose toward +X, its side toward the front                                    |
| `layla`               | Layla's client OBJ                     | every object but the drone and the gun (`leila_2`)                                                                                                                                       | as she stands                                                                       |
| `layla-gun`           | same                                   | `leila_2`, every island                                                                                                                                                                  | half a turn about Y: muzzle toward +X, grip down                                    |
| `ruby`                | `ruby/ruby.fbx` with `ruby/scythe.fbx` | Ruby as converted (no drone, no mouth patch), the scythe a child of `weapon_R`                                                                                                           | see "Ruby's hold"                                                                   |
| `ruby-scythe`         | `ruby/scythe.fbx`                      | the scythe                                                                                                                                                                               | already upright, blade at the top; centred                                          |
| `angela`              | `angela/angela.fbx`                    | Angela as converted (no Tetra, no drone)                                                                                                                                                 | as she stands                                                                       |
| `lesley`              | Lesley's client OBJ                    | the whole file, as the old room drew it                                                                                                                                                  | as she stands                                                                       |
| `lesley-sniper`       | same                                   | `0007_..._weapon`                                                                                                                                                                        | level, muzzle (the top end as she holds it) toward +X, rail up                      |
| `lesley-mecha`        | same                                   | `0006_..._NPC01`: both shoulder wing units, one piece of equipment                                                                                                                       | as mounted, their front toward +Z                                                   |
| `change`              | Chang'e's client OBJ                   | every object but Mr. Bunny (`0009_..._jiqiren`), his face (`0008_..._jiqibiaoqing`, two objects) and three empty face meshes (material `None`) the old room hid                          | as she sits                                                                         |
| `change-moon`         | same                                   | `0010_..._weapon`                                                                                                                                                                        | the least turn that brings the crescent's plane (its thinnest direction) to face +Z |
| `guinevere`           | Guinevere's client OBJ                 | every object but the two drones (`weapon01` and `weapon01.001`), the one-triangle alpha stub (`body01_alpha`) and the charm in her right palm                                            | as she stands                                                                       |
| `guinevere-weapon`    | same                                   | the charm in her right palm: island of `body01` (160 triangles, a flat chibi head on a lilac strap)                                                                                      | its face toward +Z, strap up                                                        |
| `vexana`              | Vexana's client OBJ                    | the whole file but the sphere with the missing picture (`Material.010`) the old room hid                                                                                                 | as she stands                                                                       |
| `vexana-staff`        | same                                   | island 0 of `body02_mat` (the staff, 1946 triangles) and the white cap on top of the staff head (150 triangles)                                                                          | head up, broad side toward the front                                                |
| `eternal-guard`       | Eternal Guard's client OBJ             | the whole file, as the old room drew it                                                                                                                                                  | as he stands                                                                        |
| `eternal-guard-sword` | same                                   | the sword: the largest island of `weapon02` (1308 triangles). The four gold stars, four black stars and four crystals are left out                                                       | blade up, broad side toward the front                                               |
| `aspirant-drone`      | `angela/drone.fbx`                     | the drone as converted: 10 bones, 8 face morph targets (`face_angry`, `face_squint`, `face_happy`, `face_dead`, `face_scan`, `face_ecg`, `face_sleepy`, `face_alert`; there is no blink) | already centred, face toward +Z                                                     |

Why these sources: the client OBJ files are the game's own geometry and UVs and are what the old room showed, so the "must not change" views (Lesley, Vexana, Eternal Guard) are the same data drawn the same way. The rigged conversions are used where the room animates the model (Ruby, Angela) or needs the morphs (the drone).

## Angela: what was wrong

The old room loaded her original FBX (`hero_angela_skin08_high_add.fbx`) and gave each skinned mesh one picture only, the one of its first material (`splitByMaterial` in the old `engine.ts` skips skinned meshes). Her body mesh has three materials (body, hair, body_A) and her face mesh two (face, hair), and her eyes are painted in the hair picture. So the hair was drawn with the body picture (pale grey instead of peach) and the eyes with the face picture (no eyes, a pink band of skin where they should be). Tetra, in the same mesh, got the same fault. The sheet `sheet-angela.png` draws that file both ways to show it.

The fix: `angela/angela.fbx` (the rigged conversion) has every material on its part. Written with one material per part, she has blue eyes and peach hair, as in her official art (`apps/web/public/img/home/wall/arts-splash-angela-*.webp`). `body_A` is her dark bodysuit, opaque. Her separate `Angela_body_Alpha.png` marks only a few texels and is not used.

## Ruby's hold

The scythe hangs on **`weapon_R`** (her right hand socket), so it follows the hand. In the rig's resting pose the hand is open and its grip axis points forward, so a vertical shaft could only sit beside the open hand. The resting pose of her right arm is therefore changed (and nothing else): the elbow bends 50 degrees about the forearm's Z, the forearm and the wrist share a 40 degree twist about their length (the angle that brings the grip axis nearest to upright), and the four fingers close (60, 70 and 45 degrees per joint). The shaft runs along the hand's grip axis through the palm, the blade's broad side toward the front and its edge away from her. The bone names and axes are the source's; only the starting rotations of those arm and finger bones differ (`RUBY_GRIP` in `page/recipes.js`). A test pose drawn on the source and on the file matches everywhere else, and the scythe follows the hand.

The rig viewer's plain hold (the scythe upright at the socket, the hand left open) was tried first: the shaft only stood beside the open hand. A twist alone, without the elbow, leaned the scythe 42 degrees out to her side and put the lower shaft through her skirt.

For the room: Ruby's box is about 1.99 by 2.57 by 1.31 m and its middle is not her middle (the scythe leans over her right side), so the camera should turn round the origin (her feet), not the box's middle. A breath must add its turns to the file's resting rotations, not set rotations outright. The shaft may graze the hem of her skirt on that side.

## Calls a reader should know

- **Guinevere's weapon.** The small thing in her right palm is a keychain charm (a lilac-haired chibi head on a strap) hanging from her wrist. That is the piece cut out. Her left wrist carries its twin (a chibi of Guinevere herself); it stays on the model, since the request names one piece. The sheet shows both hands.
- **Vexana's staff cap.** The rigged `vexana.fbx` weights the white cap on top of the staff head to her head bone. In the client file it sits 0.7 m from her head, on the staff, as the top point of the staff head's four-point design, so it belongs to the staff.
- **The Aspirant drone.** The four drone files (Angela, Fanny, Layla, Ruby) are the same model: equal geometry, UVs, morph targets and bones.
- **Fanny's thruster.** Her weapon set (two sets in the file, one per side) is a blade over a jet unit with two turbine discs and fins. The jet unit is the thruster.
- **Fanny's hips.** The long blade shapes at her hips and behind her legs are part of her body mesh (`polySurface59`, her outfit), not the weapon sets, so they stay on `fanny`.
- **Vexana's staff head** has an empty ring: the orb inside it (`Material.010`) has no picture in the client files and was hidden by the old room too, so it is left out of both views.
- **Lesley's mecha** is both wing units together (they are one piece of equipment on her shoulders).

## Repeating it

Every decision is in `page/recipes.js` as a test on object names, materials and island sizes or positions, so a run on the same sources gives the same files. `explore.mjs` draws every island of a source (alone and in red on the whole model) for deciding a new cut; `sheets.mjs` draws the results.
