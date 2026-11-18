"""The camera clips of the entrance file, in glTF space.

    blender -b entrance.blend --python cameras.py -- --work DIR

The file has one camera and fifteen camera actions, sampled at 30 frames a second (the bone clips
are 24). Both are as long in seconds: key i of a camera clip is at i / 30 s, frame 1 of a bone clip
is at 0 s. The camera is not parented, so a key is a world transform. Blender world (x, y, z)
becomes glTF (x, z, -y); the camera quaternion is turned by -90 degrees about X so that the camera
looks down -Z as a three.js camera does. Writes cameras.raw.json in DIR.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Euler, Quaternion  # noqa: E402

from common import PREFIX, work_dir, write_json  # noqa: E402

# Camera action -> name of the bone clip it goes with. `interaction_R` has a trailing underscore
# in the file: that is not a second clip.
WANTED = {
    "cam_city_idle": "city_idle",
    "cam_city_interaction_R_": "city_interaction_R",
    "cam_city_interaction_R_loop": "city_interaction_R_loop",
    "cam_city_interaction_back_R": "city_interaction_back_R",
    "cam_city_intercation03": "city_intercation03",
}
FPS = 30
STATIC_LIMIT = 2e-3  # metres: a camera that never moves further than this is stored as one key

work = work_dir()
camera = bpy.data.objects[PREFIX + "camera"]
assert camera.parent is None
sensor = camera.data.sensor_width
lens = camera.data.lens
# The 30 mm lens on the 36 mm sensor: the game reads it as the VERTICAL field of view of a 16:9 frame
# (that is what matched the recordings, see README.md).
vfov = math.degrees(2 * math.atan((sensor / 2) / lens))
turn = Quaternion((1, 0, 0), -math.pi / 2)

clips = {}
for action in bpy.data.actions:
    short = action.name.replace(PREFIX, "")
    if short not in WANTED:
        continue
    start, end = action.frame_range
    assert abs(start - 1.0) < 1e-6, (short, start)
    frames = int(round(end - start)) + 1
    curves = {(c.data_path, c.array_index): c for c in action.fcurves}
    rows = []
    scale_deviation = 0.0
    for i in range(frames):
        f = start + i
        loc = [curves[("location", k)].evaluate(f) for k in range(3)]
        rot = [curves[("rotation_euler", k)].evaluate(f) for k in range(3)]
        scale = [curves[("scale", k)].evaluate(f) for k in range(3)]
        scale_deviation = max(scale_deviation, max(abs(s - 1.0) for s in scale))
        q = turn @ Euler(rot, "XYZ").to_quaternion()
        rows.append([loc[0], loc[2], -loc[1], q.x, q.y, q.z, q.w])
    # One hemisphere through the clip, so a slerp never takes the long way round.
    for i in range(1, frames):
        a, b = rows[i - 1], rows[i]
        if sum(a[3 + k] * b[3 + k] for k in range(4)) < 0:
            rows[i] = b[:3] + [-v for v in b[3:]]
    spread = max(
        math.dist(rows[0][:3], r[:3]) for r in rows
    )
    static = spread < STATIC_LIMIT
    keys = rows[:1] if static else rows
    flat = []
    for r in keys:
        flat += [round(v, 4) for v in r[:3]] + [round(v, 5) for v in r[3:]]
    clips[WANTED[short]] = {
        "frames": frames,
        "duration": round((frames - 1) / FPS, 6),
        "static": static,
        "stride": 7,
        "positionSpread": round(spread, 5),
        "keys": flat,
    }
    print("CAMERA", short, frames, "static" if static else "moving", round(spread, 4), "scale dev", scale_deviation)
    assert scale_deviation < 1e-4, scale_deviation

write_json(
    os.path.join(work, "cameras.raw.json"),
    {
        "fps": FPS,
        "vfovDeg": round(vfov, 4),
        "lensMm": lens,
        "sensorMm": sensor,
        "clips": clips,
    },
)
print("DONE")
