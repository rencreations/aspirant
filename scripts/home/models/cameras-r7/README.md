# Round seven's cameras (`cameras-r7.json`)

`apps/web/public/models/home/cameras-r7.json` holds one camera for each of the five clips Selena plays
(`city_idle`, `city_interaction_R_loop`, `city_interaction_R`, `city_interaction_back_R`,
`city_intercation02`): a key every 1/30 s in her own space, the vertical field of view of the
recording's frame (2.222 wide) and the lens shift. Never edit it by hand.

```
node scripts/home/models/cameras-r7.mjs
```

runs `blender/cameras_r7.py` on the entrance file with `fits.json` (this folder) and copies the result
to the models folder. The file name is new, so no cache name moves.

## State of the work: NOT 1:1 with the recording yet

What ships today (`fits.json`): **the game's own cameras** (`cam_city_*`, a 30 mm lens read as the
vertical field of view of a 16:9 frame of which the recording shows the bottom 80 percent: 51.28
degrees, shift -0.125) with no correction. The idle and pose loops are the game's static cameras, the
two transitions and the out clip keep the game's own paths, and the out clip starts and ends on the
idle camera. These are about 1.7 times tighter than `horizontal.mkv` (the recording shows more: the
dragon's head at the left of the idle, both claws and the dragon in the pose). They are a coherent,
good looking framing, not the owner's reference. The sky's turn is solved from one landmark (the star
at (335, 15) of the 960 by 432 recording frame, no roll).

`fits.json` also accepts a fitted camera: `idle.matrix` and `pose.matrix` are 16 numbers (a Blender
world matrix, row major) with their own `vfov` and `shy`; the build takes the offset of each from the
game's camera of that loop and carries it through the clip, blending the offset of the loop a
transition leaves into the one it reaches. `matrix: null` is the game's camera.

## What was tried to find the recording's camera, and why it is not done

The recording is the truth, so the camera has to be found against it. Findings (all work files are in
`D:\ren\aspirant-work\home\SEL-camera-sky\`, the scripts that matter are copied to `fit/`):

- The recording's timeline (`horizontal.mkv`, 45.3 s): **idle** (the lying pose with the dragon's head
  at the left) 0 to 8 s, idle to pose about 8 to 10.5 s, **pose** (standing, claws out, the dragon at
  the right) 10.5 to 30.4 s, pose to idle about 30.4 to 32.5 s, idle again to the end. `vertical.mkv` is also
  3840 by 1728 (not a portrait file): its idle is the horizontal one, its pose is a closer camera
  with her centred.
- The game's cameras are not the recording's. The recording looks like a much wider lens
  (a horizontal field of view near 130 degrees) from nearer her, so a single clip of the game's
  camera data cannot be corrected by a lens change alone.
- `fit/fitjoint.py` / `fit/fitrefine.py`: a cross entropy search of a camera (move, turn, field of
  view, shift) and the loop phase, scored by Blender workbench renders of the entrance file
  (`fit/blender_server.py`) against the recording's edges and colours. **It is wrong as a score.**
  A camera that sees only her face scores as well as one that sees all of her (the first joint fit
  ended with 4.6 percent of the frame covered and looked perfect in a blend because nothing else was
  drawn). A coverage penalty was added late and the refinement then did not converge (see
  `D:\ren\aspirant-work\home\SEL-camera-sky\w\evalR.png`).
- `fit/lmfit.py`: a camera from landmarks (bones projected against points read by eye in a frame)
  fits the idle to about 20 to 70 px of 960 (`w/evalA4.png`: the body is in the right place, the
  camera is too close), and fails for the pose (the pose clip's landmarks I picked disagree: `Bip002
Head` stays at one point 4.6 m behind her in both clips, so it is not the dragon's head).
- The sky: the equirectangular picture and the recording's background do not agree geometrically
  (the star and the tower's ring are 84 degrees apart in the picture and about 25 percent of the
  frame apart in the recording; every solve with the fitted lens left residuals of 70 to 170 px). The
  image based registration cannot tell orientations apart (every score is -0.08). So the sky is
  placed by its star only.

What would finish it: pick landmarks that are real bones (`Bip001 *`, and the dragon's own bones,
which are probably `Bone02_She_*`, instead of `Bip002 Head`) at the exact clip time of a frame, solve both loops with a
prior that keeps the camera near the game's, and judge by a full body overlay (coverage near 40
percent and silhouettes on the video's). Then put the 4 numbers of each loop into `fits.json`
(`matrix`, `vfov`, `shy`) and run the build. Nothing else changes: the runtime already takes the data.
