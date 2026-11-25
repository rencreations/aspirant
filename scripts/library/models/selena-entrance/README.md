# Selena's Entrance view (`scripts/library/models/selena-entrance/`)

One command turns the owner's Entrance file into the file the 3D Models room loads for Selena's Entrance view, with the fourteen clips of the room, a camera for each clip fitted to the game's own recordings, and the anchor of the sticker:

```
node scripts/library/models/selena-entrance/build.mjs              # the file and every check
node scripts/library/models/selena-entrance/build.mjs --no-check   # the file only
node scripts/library/models/selena-entrance/build.mjs --pack-only  # the size pass and the extras again (after a change of cameras/fits.json or sticker.mjs)
```

Before the first build, and whenever the source changes, bake the game's cameras (Blender 4.5, about 20 seconds):

```
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b <entrance.blend> --python scripts/library/models/selena-entrance/blender/cameras.py -- --out D:\ren\aspirant-work\models-room\entrance\work
```

Never edit the output by hand. The room's contract is `docs/superpowers/specs/2026-11-25-models-room-redesign.md` ("Every GLB", `extras.cameras`, `extras.sticker`). A file replaced under the same key needs a new folder (`models/v2/`): the bucket caches for 30 days.

## What it reads and writes

Reads (read only): the owner's `entrance/selena_silverbolt_raiko_entrance.glb` (Blender 5.1 export: the meshes, the skin, the clips) and `.blend` (only for the camera actions `cam_city_*`, which the GLB does not carry), the recordings in `D:\ren\aspirant\media\_others\in-game-animation\selena\` (for the camera fit and the checks).

Writes: `D:\ren\aspirant-r2\library\v1\models\v1\selena-entrance.glb` (the R2 mirror; `python scripts/library/r2.py sync` uploads it). Work files, check pictures and the fitting runs go to `D:\ren\aspirant-work\models-room\entrance\` (`--work DIR` or `ENTRANCE_WORK` for another place; C: is nearly full on this machine).

## The file

- Selena (normal form) and Silverbolt: `body_01`, `body_02`, `body_03`, `head`, `eye`, `hair_01`, `hair_02` and `abyssal_devil_01`, `_02` (the dragon). Gone: the abyssal form (`abyssal_form`, `_hair_01`, `_hair_02`) and `accessory_01`, `_02`, which are the phone and its four message cards, parked 3.5 to 4 m to the side on `neutral_bone`, a bone no clip moves (the game puts the phone in her hand at run time; the room has the phone as a view of its own). With them go the 165 bones that only they needed; 177 are kept (172 carry a weight, the rest are their ancestors).
- The armature node is folded away (its turn goes into the root bones and their keys), so every mesh node is at the origin with no transform and three binds the skins with an identity matrix. World space, Y up, metres, the same space as the owner's file: her front is toward +Z (the recordings' camera is on +Z), and she is not moved or put on the ground (the cameras are in this space; idle-standing has her feet at y = 0).
- Clips: the 14 of `scripts/library/models/entries.json` by their ids (`city_action` is left out on purpose). Each starts at 0 s (the source's first key is at 1/24 s) and has one key a frame at 24 frames a second.
- Materials: base colour only (`KHR_materials_specular`, the normal maps and the other pictures removed; the two hair materials that paint on their second UV set now use the first). The owner's file blends `hair_01` and the dragon's ribbon (`abyssal_devil_02`). The ribbon is really see-through (a third of its texels are clear) and stays blended; `hair_01`'s picture has no texel under full alpha, so it is drawn opaque (the build does this for any such material and lists it in `model.report.json`): blended hair sorts badly from a free camera. The body pictures carry alpha too, but the owner exported them opaque and the silhouettes match the recordings that way, so they stay opaque.
- Size pass as `scripts/home/models/lib/optimize.mjs` (copied to `lib/optimize.mjs`): dedup, prune, resample (1e-4), reorder, quantise, meshopt, WebP pictures (all at their source size, at most 1024 here). Quantisation gives each mesh its own copy of the skin (the inverse bind matrices absorb the dequantisation), which three reads as usual.
- `extras.cameras` and `extras.sticker` on the default scene, as the contract says.

## Clips: lengths and loops

Nothing was trimmed. The build looks for a still stretch at the end of every clip (no bone turning by more than 0.05 degrees or moving by more than 0.1 mm, and the game's camera of the clip counted as motion too) and finds none: on the last frame of every clip some bone still moves (the hair and the skirt keep swinging). It checks this on every run; `model.report.json` in the work folder lists, per clip, when it would be still and which bone moves last.

| clip               | source                  | seconds |
| ------------------ | ----------------------- | ------: |
| idle               | city_idle               |   2.708 |
| idle-standing      | city_idle_BP            |   2.042 |
| phone-in           | city_intercation_in     |   2.625 |
| phone-loop         | city_intercation04      |   3.958 |
| phone-out          | city_intercation_out    |   5.292 |
| interaction-l-in   | city_interaction_L      |   3.292 |
| interaction-l-loop | city_interaction_L_loop |   2.708 |
| interaction-l-out  | city_interaction_back_L |   3.042 |
| interaction-r-in   | city_interaction_R      |   3.292 |
| interaction-r-loop | city_interaction_R_loop |   2.708 |
| interaction-r-out  | city_interaction_back_R |   3.208 |
| interaction-1      | city_intercation01      |   6.292 |
| interaction-2      | city_intercation02      |   5.958 |
| interaction-3      | city_intercation03      |   6.292 |

Loops, first key against last key (largest turn of any bone, largest move): `idle` 0.33 degrees and 1.7 mm, `interaction-l-loop` 0.56 degrees, 0.1 mm, `interaction-r-loop` 0.99 degrees, 0.1 mm, `idle-standing` 0.39 degrees, 1.2 mm: these end on their first pose (one frame of motion is 8 to 14 degrees). `phone-loop` does not: Selena is 5.5 degrees and 3 mm off, and Silverbolt jumps back 1 m (his tail flies a path off the recorded picture and starts again). In the game this loop repeats every 4.0 s (96 frames), not 3.958 s: the recording shows it.

## The cameras

`extras.cameras` is made by `cameras.mjs` from the game's baked camera (`blender/cameras.py`) and the fit in `cameras/fits.json`. A key every 1/30 s from the clip's first frame to its last, three's convention, the vertical field of view over the 2.2222 frame (3840 by 1728).

What the recordings showed (the method is below):

- **The game's camera data is not the recording's camera.** Where the recording's camera stands still the game's actions sway by 1.7 to 2 degrees, and in the idle the game's camera looks 20 degrees to the side of the recording's and has none of its 15 degrees of roll. The lens is a vertical field of view of 60 degrees over the 2.2222 frame (as round seven found), measured again here at 59.5 to 60.4 on every clip; the moving cameras were solved with it held at 60.
- **Idle, Interaction L and Interaction R (in, loop, out)** use one camera that never moves (`idle.mkv`, `vertical.mkv`, `horizontal.mkv`): round seven's landscape camera (position 0, 1.1053, 0.9545) turned by 0.55 degrees to the left, 0.1 down and 0.15 of roll (the median of 13 frames of the three recordings). Every camera of the file has the vertical field of view 60 degrees (the still cameras measured 59.9 and 60.1, within the noise of 60). The game's own L and R paths turn by 30 to 45 degrees; the recording does not, so these clips hold the still camera.
- **Phone loop** has its own still camera (`phone-empty.mkv` 9.5 to 21.5 s never moves): the game's position with a turn of yaw 8.3, pitch -9.1 and roll -11.3 degrees (YXZ).
- **Phone in and out and Interaction 1 to 3** move. Their cameras were solved frame by frame from the recordings every 0.05 s and smoothed (below); where the recording's camera stands still at the start or the end the clip holds that camera, so an in clip leaves the idle camera and lands on its loop's camera exactly, and an out clip ends on the idle camera.
- **Interaction 1** has no camera of its own in the game data: `cam_city_intercation01` is a copy of `cam_city_intercation_out` (the same keys for its first 5.3 s; it starts on the phone camera). Its camera comes from `short-2.mkv` (8 to 13 s), which shows this clip (the candy, the hand to her brow).
- **Idle Standing** has no recording. Its camera is made (`fit/standing.mjs`): static, from the front three quarter (30 degrees to her left), the eye 0.27 m above her pelvis, aimed at the middle of her height, far enough that her whole figure through the loop takes 76 percent of the frame's height.

Time in the recordings (video time = clip time + offset; loops repeat): idle `idle.mkv` + 0.17, phone in `phone-empty.mkv` + 6.95, phone loop + 13.83, phone out + 22.27, L in `vertical.mkv` + 6.27, L loop + 12.39, L out + 32.83, R in `horizontal.mkv` + 7.54, R loop + 10.875, R out + 29.75, interaction 1 `short-2.mkv` + 7.425, interaction 2 `short-3.mkv` + 8.65, interaction 3 `short-1.mkv` + 6.19. The owner's time spans were close; these are where the clip's poses really are.

### How the cameras were fitted (`fit/`)

The scores lie and the overlays tell the truth (round seven), so every fit was judged on a sheet: the recording | ours (base colour) | ours over the recording at 50 percent | our outline on the recording.

1. `fit/renders.mjs` renders a clip through a camera at many times and cuts a stretch of a recording into frames of the same size.
2. Time: `fit/ecc_search.py` lays each render on a frame by ECC (OpenCV, a homography masked by our silhouette) and keeps the clip time that lays best; where the camera stands still that also gives the turn and the field of view the camera lacks (`fit/ecc.py`: a turn of the camera moves the picture by a homography, whatever the depth).
3. Still cameras: the median of those corrections over many frames.
4. Moving cameras: `fit/pnp.mjs` renders our model at the frame's clip time through a guess, with the world position under every pixel (`window.stage.positions`); `fit/pnp.py` matches SIFT features of the render and of the recording's frame, and each match gives a 3D point and the pixel it lands on, so the camera is solved (RANSAC, then a least squares fit of the pose; the field of view held at 60). Each frame starts from the answer of the frame next to it (`chain: "hold"`), run from both ends of the clip. A solve from under 20 points (12 for the far frames of interaction 2, solved at 1920 px), or one that leaps more than 0.2 m from its start, is thrown away; `fit/keys.py` then keeps frames with at least 25 points (15 for interaction 2) and a residual under 4 px. Typical residual: 1.5 to 3 px of a 960 px frame.
   Interaction 2 is the hard one: from 1 s to 3.5 s she is small in a dark scene full of effects, so those frames were solved one by one at 1920 px from the game's own path (`start` per frame, not chained), and from 3.5 s to 4.3 s a white flash hides everything, so there the camera is the game's path carried by the offset of the solved frames on either side (`gaps` in `fit/keys.py`). Between 0.8 s and 1.0 s its camera pulls back about 2.5 m in a fifth of a second, as in the recording and the game's path.
5. `fit/keys.py` smooths the solved cameras in time (a Gaussian of 0.06 s over position and turn), samples them every 0.1 s and writes them into `cameras/fits.json` as `keys`, with the holds at the ends. `cameras.mjs` reads them on a cubic curve.

The check (`verify/check.mjs`, run by the build) draws the sheets from the finished file's own `extras.cameras`. The fitting tools write `cameras/fits.json` with Python's layout: run Prettier on it afterwards (`pnpm format` does), so `pnpm check` passes.

## The sticker

`extras.sticker` is `{ clip: "idle", bone: "Bip001_Pelvis", offset: [0.0275, 0.013, -0.0112], normal: [-0.2232, -0.9433, 0.2457], radius: 0.17 }` (`sticker.mjs`), measured by `node verify/sticker.mjs --find`: the idle at four times, seen from behind (the angle of the owner's screenshot: her legs up in the picture, the bottom in the middle), from behind and below and from below; every pixel of the shorts (dark or wine red, on `body_01`) and of the bare skin between the shorts and the stockings (pale pink) within 20 cm of the pelvis is followed back to the posed mesh through a position pass of the same camera. The point is the middle of those points, inside the body (the surface along the normal is about 9 cm out), so a sticker that faces the camera there is centred on her bottom from all three angles; **the room must draw it over the body (no depth test, or moved toward the camera by its radius)**. The radius takes in 85 percent of the points, so the back above and the legs below stay in view. The pelvis bone's world scale is 1, so the radius is metres. `sticker-views.png` shows it, drawn as the room must (no depth test).

The normal points down and back (in world space about (-0.47, -0.72, -0.51) through the loop). The angle between it and the direction from the sticker to the camera is about 55 degrees from behind (the owner's screenshot), 34 degrees from behind and below, 36 degrees from below, and 132 degrees for the recordings' own camera in front of her. So a test of "the camera is on that side" must let the sticker show up to at least 65 degrees from the normal, or it hides it at the owner's own angle.

## Check pictures (in the work folder)

- `cameras-<clip>.png`: every clip with a recording, six times through the clip.
- `idle-standing-camera.png`: the made camera of idle-standing at four times.
- `clips-1.png`, `clips-2.png`: every clip at four times from one fixed three quarter camera.
- `sticker-views.png`: the sticker's disc from the three angles at four times of the idle, beside the same view without it.
- `check.json`: the file's size, its meshes and bones, per clip its length, its camera keys and the largest distance of any bone from the owner's file at five times.

## Files here

| Path                                                                                             | What                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build.mjs`                                                                                      | the command: the model (`model()`), the size pass and the extras (`pack()`), the checks                                                               |
| `clips.mjs`                                                                                      | the clip ids, their bone actions and camera actions                                                                                                   |
| `cameras.mjs`, `cameras/fits.json`                                                               | `extras.cameras` from the game's cameras and the fit                                                                                                  |
| `sticker.mjs`                                                                                    | `extras.sticker`                                                                                                                                      |
| `blender/cameras.py`                                                                             | bakes the camera actions of the .blend into glTF space                                                                                                |
| `lib/env.mjs`, `rig.mjs`, `optimize.mjs`, `browser.mjs`, `sheet.mjs`, `compose.mjs`, `video.mjs` | paths, the skin and the clips, the size pass, Chrome, the sheets, the pictures, the recordings' frames                                                |
| `verify/check.mjs`, `compare.mjs`, `sticker.mjs`, `page/`                                        | the checks and the page they run in (the site's three)                                                                                                |
| `fit/`                                                                                           | the fitting aids above (not run by the build); the job files of the fit runs are in the work folder (`fit/`), and `cameras/fits.json` is their result |

## Not done, or not verified

- The phone is not in her hand in the phone clips (the source has no attachment for it; the recording shows it). The candy of interaction 1 and the effects of interaction 2 are not in the source either.
- The camera keys of the moving clips are smoothed solves (a key every 0.05 to 0.1 s), not the recording frame by frame; the residual of a solved frame is 1.5 to 3 px of 960. The least sure stretches: interaction 2 from 1 to 3.5 s (a frame solved every 0.15 to 0.3 s) and 3.5 to 4.3 s (the flash, no frame to solve), and the first 0.3 s of interaction 2 and 3, where she moves fast.
- The time offsets of the loops (idle, the L, R and phone loops) are found to a few frames only: their poses change little, and their cameras do not move, so it does not change a camera.
- Only Chrome on this machine.
