"""The camera of the out clip (round seven), in glTF space, in the format of cameras.json.

    blender -b entrance.blend --python cameras_out.py -- --work DIR

Writes cameras-out.json into DIR: the camera action `cam_city_intercation02` (181 keys, 30 a second,
6 s), converted exactly as cameras.py does (Blender (x, y, z) becomes glTF (x, z, -y), the quaternion
is turned by -90 degrees about X so the camera looks down -Z). Its first and last keys are the idle
camera of the game, so the clip starts and ends on the picture the room shows.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Euler, Quaternion  # noqa: E402

from common import PREFIX, work_dir  # noqa: E402

FPS = 30
ACTION = "cam_city_intercation02"
CLIP = "city_intercation02"

work = work_dir()
camera = bpy.data.objects[PREFIX + "camera"]
vfov = math.degrees(2 * math.atan((camera.data.sensor_width / 2) / camera.data.lens))
turn = Quaternion((1, 0, 0), -math.pi / 2)

action = bpy.data.actions[PREFIX + ACTION]
start, end = action.frame_range
assert abs(start - 1.0) < 1e-6, start
frames = int(round(end - start)) + 1
curves = {(c.data_path, c.array_index): c for c in action.fcurves}
rows = []
for i in range(frames):
    f = start + i
    loc = [curves[("location", k)].evaluate(f) for k in range(3)]
    rot = [curves[("rotation_euler", k)].evaluate(f) for k in range(3)]
    q = turn @ Euler(rot, "XYZ").to_quaternion()
    rows.append([loc[0], loc[2], -loc[1], q.x, q.y, q.z, q.w])
# One hemisphere through the clip, so a slerp never takes the long way round.
for i in range(1, frames):
    a, b = rows[i - 1], rows[i]
    if sum(a[3 + k] * b[3 + k] for k in range(4)) < 0:
        rows[i] = b[:3] + [-v for v in b[3:]]
flat = []
for r in rows:
    flat += [round(v, 4) for v in r[:3]] + [round(v, 5) for v in r[3:]]

out = {
    "fps": FPS,
    "vfovDeg": round(vfov, 4),
    "clips": {
        CLIP: {
            "frames": frames,
            "duration": round((frames - 1) / FPS, 6),
            "static": False,
            "stride": 7,
            "keys": flat,
        }
    },
}
path = os.path.join(work, "cameras-out.json")
with open(path, "w") as handle:
    json.dump(out, handle, separators=(",", ":"))
print("DONE", path, frames, len(flat))
