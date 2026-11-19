# The doll's fall loop (`scripts/home/models/doll/fall/`)

Fits the Mixamo clip `Falling.fbx` (the owner's, read only) to the doll and writes `apps/web/public/models/home/doll-fall.json`, the loop the home page plays (`actors/doll/fall.ts`). Never edit the output by hand: change `ROOT` or `AMP` in `fit.py` and run it.

```
blender -b --python export.py -- D:\work\fall_src.json "C:\Users\muham\Downloads\Falling.fbx"
python fit.py D:\work\fall_src.json apps\web\public\models\home\doll-fall.json
python fit.py D:\work\fall_src.json out.json --config look.json     # {"root": [["y", -25], ["x", -75]], "amp": {"LeftArm": 0.8}}
```

`export.py` runs in Blender 4.5 (background) and writes the rotation and position of the 22 mapped bones for every frame, in the armature's own space (+Y up, +Z forward, +X its left: the doll's axes). `fit.py` needs numpy only. After a change bump `?v=` in `FALL_DATA_PATH` (`actors/doll/fall.ts`): the browser saves the file.

The fit, in order: the world turn of each bone from its bind pose; the swing that takes the doll's A pose bone onto the source's T pose bone (a leaf bone takes its parent's); the root's turn on every bone (`ROOT`: -25 degrees about her vertical, -75 about X, 12 in the screen plane, so she is on her front, her face three quarters to the camera, head up and to the left); local rotations in the doll's own hierarchy; `AMP` scales a bone's turn from the doll's own bind pose (all 1 now). 135 keys at 30 fps, 4.5 s; the source's last frame repeats the first and is dropped.

A bug worth remembering: the root's turn must go on every bone's world rotation, not on the hips only (the children's locals are taken against the hips' new world rotation).
