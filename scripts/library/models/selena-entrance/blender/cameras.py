"""The game's camera of every Entrance clip, baked to glTF space.

    blender -b entrance.blend --python cameras.py -- --out DIR

The entrance file has one camera and one action per clip (`cam_city_*`). The camera actions are
keyed at 30 frames a second while the bone actions are keyed at 24, and both last as long in
seconds: key i of a camera action is at i / 30 s, frame 1 of a bone action is at 0 s. The camera
has no parent, so a key is a world transform. Blender world (x, y, z) is glTF (x, z, -y), and the
camera's quaternion is turned by -90 degrees about X so that it looks down its local -Z as a
three.js camera does. The armature's own turn and the exporter's cancel (see
scripts/home/models/blender/common.py), so this is the space of the bones in the owner's GLB.

Writes DIR/cameras.game.json: the lens and, for each clip id, every key of its action
(px, py, pz, qx, qy, qz, qw).
"""

import json
import math
import os
import sys

import bpy
from mathutils import Euler, Quaternion, Vector

PREFIX = "selena_silverbolt_raiko_entrance_"
FPS = 30

# Clip id of the room -> camera action. `interaction_R_` has a trailing underscore in the file.
CLIPS = {
    "idle": "cam_city_idle",
    "idle-standing": "cam_city_idle_BP",
    "phone-in": "cam_city_intercation_in",
    "phone-loop": "cam_city_intercation04",
    "phone-out": "cam_city_intercation_out",
    "interaction-l-in": "cam_city_interaction_L",
    "interaction-l-loop": "cam_city_interaction_L_loop",
    "interaction-l-out": "cam_city_interaction_back_L",
    "interaction-r-in": "cam_city_interaction_R_",
    "interaction-r-loop": "cam_city_interaction_R_loop",
    "interaction-r-out": "cam_city_interaction_back_R",
    "interaction-1": "cam_city_intercation01",
    "interaction-2": "cam_city_intercation02",
    "interaction-3": "cam_city_intercation03",
}


def option(name):
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    for i, item in enumerate(argv):
        if item == "--" + name and i + 1 < len(argv):
            return argv[i + 1]
    raise SystemExit("--%s is required" % name)


out_dir = option("out")
os.makedirs(out_dir, exist_ok=True)
camera = bpy.data.objects[PREFIX + "camera"]
assert camera.parent is None, "the camera must not be parented"
data = camera.data
turn = Quaternion((1, 0, 0), -math.pi / 2)

result = {
    "fps": FPS,
    "lensMm": data.lens,
    "sensorMm": [data.sensor_width, data.sensor_height],
    "sensorFit": data.sensor_fit,
    "shift": [data.shift_x, data.shift_y],
    "clips": {},
}
for clip, action_name in CLIPS.items():
    action = bpy.data.actions[PREFIX + action_name]
    start, end = action.frame_range
    assert abs(start - 1.0) < 1e-6, (action_name, start)
    frames = int(round(end - start)) + 1
    curves = {(c.data_path, c.array_index): c for c in action.fcurves}
    keys = []
    previous = None
    worst_scale = 0.0
    for i in range(frames):
        f = start + i
        loc = [curves[("location", k)].evaluate(f) for k in range(3)]
        rot = [curves[("rotation_euler", k)].evaluate(f) for k in range(3)]
        scale = [curves[("scale", k)].evaluate(f) for k in range(3)]
        worst_scale = max(worst_scale, max(abs(s - 1.0) for s in scale))
        q = turn @ Euler(rot, "XYZ").to_quaternion()
        if previous is not None and q.dot(previous) < 0:
            q = Quaternion((-q.w, -q.x, -q.y, -q.z))
        previous = q
        keys.append([loc[0], loc[2], -loc[1], q.x, q.y, q.z, q.w])
    assert worst_scale < 1e-4, (action_name, worst_scale)
    flat = []
    for row in keys:
        flat += [round(v, 6) for v in row]
    spread = max(math.dist(keys[0][:3], r[:3]) for r in keys)
    result["clips"][clip] = {
        "action": PREFIX + action_name,
        "frames": frames,
        "spread": round(spread, 5),
        "keys": flat,
    }
    print("CAMERA", clip, action_name, frames, "spread", round(spread, 4))

path = os.path.join(out_dir, "cameras.game.json")
with open(path, "w", encoding="utf8") as handle:
    json.dump(result, handle, separators=(",", ":"))
print("DONE", path)
