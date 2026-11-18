# The gramophone of the home page (`scripts/home/models/gramophone/`)

Turns the FBX `D:\ren\aspirant\3d\gramophone\source\ponograph.fbx` and its four maps into the files the home page loads:

| File                                              | What it is                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web/public/models/home/gramophone.glb`      | The model: 788,884 bytes, lit PBR, one material, three WebP maps, six parts, five anchors. |
| `apps/web/public/models/home/gramophone-rig.json` | The pivots, axes, throws, sizes, the lighting recipe and the numbers the tests found.      |

Never edit the outputs by hand. Change the build and run it.

## How to run

```
node scripts/home/models/gramophone/build.cjs
node scripts/home/models/gramophone/build.cjs --renders D:\some\folder          # where the check pictures go
node scripts/home/models/gramophone/build.cjs --out D:\trial --renders D:\trial   # a trial: the files go to D:\trial
```

It needs Chrome (real Chrome through Playwright, headless, with the GPU) and the packages of the repository (Playwright and three from `apps/web`, `sharp` from the root: it resizes the maps and packs the roughness and metal picture). About 15 seconds. The file is loaded back with a plain `GLTFLoader` (no Meshopt, no Draco: the page loads it the same way) and the build stops if a pivot does not turn its part about its axis, the default record is still in, a map is missing, or the file is over 1.3 MB.

| File here                         | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `build.cjs`                       | The steps, the checks, the check pictures, the facts file.    |
| `page/convert.js`                 | FBX to GLB in the page: align, re-pivot, merge, maps, export. |
| `page/stage.js`                   | Loads the GLB back, tests the pivots, draws the pictures.     |
| `page/index.html`, `page/main.js` | The page the build opens.                                     |

## What the build does

1. **Aligns it.** Every mesh of the FBX is at an identity transform with the pivot at the scene origin, and the whole model is turned **56.68 degrees** about Y (the smallest rectangle of the cabinet's footprint, searched in 0.01 degree steps). The vertices are moved into the aligned frame: metres, Y up, the floor at y 0, the cabinet's middle on the Y axis, **the horn along +X** (tilted 19.4 degrees up), the crank on the -Z face, the tonearm's post on -X. The build stops if the horn does not point +X or the crank is not on -Z.
2. **Merges and re-pivots.** 22 meshes become six nodes. `cabinet` (13 source meshes: the cabinet, the four turned columns, the post, the brass fittings and plates, 10,752 triangles) and `horn` (the bell and the black elbow, welded in the file, 1,650) are static. `crank` (pivot (-0.092, 0.104, -0.141), axis Z, 1,480), `platter` (pivot (0, 0.148, 0), axis Y, 320) and `soundbox` (the brass drum and the needle, pivot (-0.081, 0.193, -0.045), 1,440) have their vertices relative to their pivot, so `rotation` turns them. **The default record (`disk`, "Gold Star") is dropped**: the page puts its own on. Each pivot is checked against its part's own box (4 mm).
3. **Maps by hand** (the FBX has no texture links): base at 2048, normal at 1024, and one packed picture at 1024 for roughness (G) and metalness (B) (R is 255: no baked occlusion), WebP at 0.85 (0.8 for the small ones). The one picture is `metalnessMap` and `roughnessMap`. **The normal maps are DirectX** (green down, an Unreal export): the build flips green. Decided by looking at the raised brass ornament on the +X face under one lamp from the upper left with no environment (`normal-check.png`): flipped, it is raised and shadowed to the lower right; as stored, it reads as pressed in. The uvs are written as normalised 16 bit and turned to glTF's v-down, so the maps stay upright.
4. **Writes** one GLB (`GLTFExporter`), loads it back, tests the pivots on the loaded copy (the crank's box turns on a circle about its pivot, the platter does not wander, the needle's tip is followed through the lift), and draws the pictures.

## The nodes and the numbers (aligned frame, metres)

- Whole: x -0.220 to +0.221, y 0 to 0.532, z -0.223 to +0.177 (the depth is the crank's handle to the bell). The cabinet is 0.355 square.
- `crank`: turns about Z through (-0.092, 0.104); the arm lies along +X at rest, throw radius 0.06, the handle's middle at (-0.032, 0.104, -0.199). A whole turn is free (`crank.png` at 0, 90, 180, 270).
- `platter`: turns about Y through (0, 0.148, 0); radius 0.1415. **The plate's top is y 0.1467**, the spindle ends at 0.1561, the rim is brass. A record 4 to 5 mm thick (radius 0.14) sits on `anchor_record_seat` (0, 0.1475, 0), as a child of `platter` so it spins with it; the label needs a hole of radius 0.006 for the spindle.
- `soundbox`: the lift is a **roll about (0.38, 0, 0.93)** through the pivot (the elbow's end), `quaternion.setFromAxisAngle`. The needle's tip (-0.0815, 0.152, -0.0525), 0.097 from the platter's middle, rests on the top of a 4 to 5 mm record at 0. A **positive angle lifts it**: 9 mm at 35 degrees, 14 mm at 45, 17 mm at 50, 23 mm at 60, and draws it 3 cm in toward the platter's middle (the full trace per angle is in `gramophone-rig.json`). A negative angle swings it out over the rim. The drum tilts like a soundbox rocked on its hinge and nothing intersects the horn (`tonearm.png`). The horn is welded to the elbow in the file and does not move.
- **Anchors on a moving part are children of it**, so they travel: `anchor_crank_handle` rides on `crank` (a glove following it moves on a circle of 0.060 about the pivot: tested at 0, 90, 180 and 270 degrees), `anchor_needle_tip` on `soundbox` (within 0.3 mm of the tip at lifts of 0 to 60 degrees), `anchor_record_seat` on `platter` (the record is its child anyway). `gramophone-rig.json` gives each one's parent, local position and world position at rest.
- Anchors (empty nodes): `anchor_needle_tip`, `anchor_record_seat`, `anchor_crank_handle` (where a drone's glove takes the handle), `anchor_bell_mouth` (0.165, 0.376, 0; the mouth is 0.331 across and faces (0.94, 0.33, 0): where the notes come out), `anchor_elbow`.
- **Presentation.** Turn the root `gramophone` about Y by **220 degrees (3.84 rad)** to put the horn on the left of the screen, the crank on the right face and the platter's top in view, as in the owner's screenshot (`Screenshot 2026-11-18 082029.png`); the range that matches is 205 to 235. The horn is +X, so 180 degrees is exactly screen left. `hero-1440x900.png` is that view.
- **Scale.** 0.53 m tall: 2.1 times a Guinevere drone's height. A uniform 0.65 to 0.8 makes them able to pull it; the crank's throw is then 0.04 to 0.05 m.

## Lighting: what makes it brass and wood

A lit `MeshStandardMaterial` needs light (an unlit bake loses the brass): this is a recorded exception to the site's unlit style. The recipe of the pictures:

- `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)` as `scene.environment`, `environmentIntensity` 1.0;
- a warm key `DirectionalLight(0xfff0d8, 2.6)` at (-0.9, 1.6, 1.4), a cool rim `DirectionalLight(0xa8c4ff, 0.9)` at (1.2, 0.6, -1.4), a `HemisphereLight(0xffffff, 0x4a3a30, 0.25)`;
- `ACESFilmicToneMapping` at exposure 1, `SRGBColorSpace`.

`recipes.png` compares it with none, AgX and other balances. **With the site's usual `NoToneMapping`** use `environmentIntensity` 0.8 and key 2.0: the highlight on the bell is hotter, the brass more saturated, nothing washes out. The maps are not tone mapped in the file: set `toneMapped` per material as the page needs.

## Not verified

Firefox and Safari, a real weak machine, the model under the home's one shared renderer and its post passes, the soundbox's lift against a generated record's real height (the needle rests on y 0.152: a record thicker than 5 mm would lift the arm's rest), the horn's faceted rim at close range (16 sides, the source's).
