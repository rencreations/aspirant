# Guinevere's two drones of the About page (`scripts/about/companions/`)

Turns the two source files `D:\ren\aspirant\3d\guinevere\drone1.fbx` and `drone2.fbx` (read only) into the one file the page uses:

| File                                         | What it is                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/public/models/about/companion.glb` | The model: 241,420 bytes, unlit, six rigid parts, one picture inside. `COMPANION_MODEL` in `apps/web/src/features/about/companions/model.ts`. |

Never edit the file by hand. Change the build and run it. The home's two guest drones read the same file at the same address (`features/home/actors/duo/`): never rename it or move it.

On the About page the two fly with the page's drone through the fourth phase (since 25 Nov 2026; until then they had a corner of that phase with a canvas of their own). They are drawn by the drone's own renderer, in a flat pass of its scene (`apps/web/src/features/about/drone/companion-model.ts`, the parts built from this file as below), and posed by `apps/web/src/features/about/choreo/companion.ts` (their springs, their idle life and their gestures), from the places and routines of `choreo/friends.ts` and `choreo/routines.ts`. The facts the page and the home share stay in `apps/web/src/features/about/companions/` (`model.ts`, `face.ts`, `pose.ts`).

## How to run

```
node scripts/about/companions/build.cjs
node scripts/about/companions/build.cjs --renders D:\some\folder      # where the check pictures go
node scripts/about/companions/build.cjs --out D:\trial --quality 0.9  # a trial: the file goes to D:\trial
node scripts/about/companions/build.cjs --source D:\other\folder      # another source folder (or ABOUT_COMPANION_SOURCE)
```

It needs Chrome (the build runs in real Chrome through Playwright, headless, with the GPU) and the packages of `apps/web` installed: Playwright, three and TypeScript come from there. The build starts a small server on a free port and stops it again. It takes about ten seconds.

If the byte count changes, write the new one into `COMPANION_MODEL_BYTES` (the build says so when the number in `model.ts` is not the file's). If the file was ever published under this name, also bump the cache name in `apps/web/src/lib/media-store.ts`.

| File here                         | What it does                                                           |
| --------------------------------- | ---------------------------------------------------------------------- |
| `build.cjs`                       | The steps, the checks and the check pictures.                          |
| `page/convert.js`                 | FBX to GLB, in the page: the parts, their frames, the cleaned picture. |
| `page/stage.js`                   | Loads the GLB back, describes it, draws the check pictures.            |
| `page/index.html`, `page/main.js` | The page the build opens.                                              |

## The sources, as they were checked

- **The two files are one model.** Both are one skinned mesh of 3,476 triangles with the same UVs and the same 512 by 512 picture (pixel for pixel). Part by part the second is the first turned as a whole by about 17 degrees (the shapes agree to a quarter of a millimetre). So one file is built, from `drone1.fbx`, and the page draws it twice. The build fails if the two ever differ.
- **It is rigid, not rigged for animation.** Six bones (`drone_root`, `body`, `pom_L_01`, `pom_R_01`, `ear_L_01`, `ear_R_01`) and every corner hangs wholly on one of them: no blended weight anywhere. The "poms" are boxing gloves that float beside the ball.
- **It is modelled in a tilted pose**: the ball is pitched 8, yawed 8 and rolled 6 degrees, the gloves sit at two unlike places, and the bones' pivots are not where the parts turn (a glove's bone is about 6 cm behind the glove).
- **The face is paint.** The screen is one island of 126 triangles on the body's picture, with two red hearts and a yellow mouth painted on it. There is no morph target, no second picture, nothing to animate.

## What the build does

1. **Finds the body's own frame.** The body is two mirrored halves (the second half's UVs are the first's, one tile to the right): 601 pairs of corners give the mirror's normal (left). Up is the normal of the red belt, made square to it. The origin is the middle of the ball (a sphere fitted to the two big shells, radius 0.07225 m). Everything is turned into that frame: Y up, the screen to +Z, left is +X.
2. **Takes the mesh apart into six rigid parts**, each in a frame that means something, and drops the skin:

   | Node                 | Hangs on    | Pivot                                                     | Its own axes                                                                                             |
   | -------------------- | ----------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
   | `body`               | `companion` | The middle of the ball.                                   | Y up, Z out through the screen.                                                                          |
   | `face`               | `body`      | The same (it is the screen's patch, in the body's frame). | The page draws the face from its x and y.                                                                |
   | `ear_L`, `ear_R`     | `body`      | The yellow bracket at the foot of the ear (the hinge).    | Y along the ear, Z out of its dark panel. Exact mirrors of each other.                                   |
   | `glove_L`, `glove_R` | `companion` | The middle of the glove.                                  | Z from the cuff out through the star (the way a punch goes), Y up, the thumb at the top toward the ball. |

   The gloves hang on the root, not on the body, so the ball can roll like a wheel without taking them round. They rest as mirrors beside the ball with no rotation. Where they were modelled is kept in the root's extras (`asModelled`).

3. **Welds the corners** and writes, as each corner's normal, the mean of the face normals at its place: nothing is lit, and the page's ink outline (the part again, pushed out along its normals, drawn inside out) then has no gaps at the hard edges.
4. **Cleans the picture**: the hearts and the mouth are filled with the navy round them, so the screen is blank glass. Nothing else of the paint is touched. It is written as lossless WebP.
5. **Writes one binary file** with `GLTFExporter`, two unlit materials on the one picture: `companion_body` and `companion_face`. The root's extras hold the ball's radius and the screen's middle and size.
6. **Loads the file back** with `GLTFLoader` and stops with an error if anything the page relies on is wrong (the six nodes and what each hangs on, no skin, no scale, mirrored hinges and gloves, the extras, a size over 400 KB).
7. **Draws check pictures** into `--renders` (default: `aspirant-about-companions` in the temp folder). Read them after every build: `source-drone1.png`, `source-drone2.png`, `views.png`, `parts-ears.png`, `parts-gloves.png`, `parts-body.png` (every part turned about its pivot), `picture-cleaned.png`, `faces.png`, `faces-live.png`, `faces-small.png`, `summary.json`.

## How the parts are turned

| Motion    | How                                                                                             | Range that looks whole |
| --------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| Ear splay | Rest, then about its own Z: left `-a`, right `+a`. Above 0 leans outward (a cross cat).         | -15 to 85 degrees      |
| Ear fold  | Then about its own X, the same sign on both. Above 0 tips it forward.                           | -35 to 35              |
| Ear twist | Then about its own Y: left `-a`, right `+a`.                                                    | -40 to 40              |
| Glove     | A place in radii of the ball from its middle, and a turn about the glove's own Y, X, Z.         | Anything               |
| The ball  | The node `body` about its own Z rolls it like a wheel; the page tilts the whole drone above it. | All the way round      |

## The face

The face is not a picture. `apps/web/src/features/about/companions/face.ts` draws it in the screen's shader from about twenty numbers (`FaceShape`): each eye is a rounded box with an upper lid, a slant and a lower lid, mixed by weight with an arch, a heart, a spiral and a chevron; the mouth is a mix of a dash, a cat's "w", an open mouth and an "o"; there is a blush, and a tone from gold to the red of the hearts. Every number blends, so any face turns into any other with no step, a blink squashes whatever the eye is toward a short line, and a look slides it. The edges are sharp at any size. The build's check pictures import that same file.

The faces follow what these drones wear in the game's art and films (the owner's reference pictures):

| Face                                     | From the reference                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `bold`                                   | The slanted eyes and crooked mouth of the splash art. The first drone's own face. |
| `soft`                                   | The rounded eyes over a small "w" of the film. The second drone's own face.       |
| `bars`                                   | Two bars and a dash (the film, in flight).                                        |
| `happy`                                  | Arches, an open mouth and a blush (the trailer).                                  |
| `angry`                                  | The big slanted eyes with no mouth (the trailer, with the anger mark).            |
| `dizzy`                                  | Spirals and a crooked dash (knocked down, in the film).                           |
| `love`                                   | Hearts and an open mouth, in red: the face the model itself was painted with.     |
| `glad`, `wide`, `squeeze`, `flat`, `shy` | Made for the scene from the same parts.                                           |

`FaceLive` holds what changes every frame: the two blinks, the look, how lit the screen is and the turn of the spirals.
