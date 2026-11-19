"""Round seven's cameras: the game's camera clips with the correction fitted to the recording.

    blender -b entrance.blend --python cameras_r7.py -- --work DIR --fits FITS.json

The game's cameras (`cam_city_*`) are tighter than the recording (`horizontal.mkv`, the truth), so
each loop (idle and pose) has a fitted correction: a local offset of the camera (a move in its own
axes and a turn, Blender XYZ euler), a vertical field of view and a lens shift. The two transitions
and the out clip move the way the game's cameras move, with the offset of the loop they leave
blended into the offset of the loop they reach (a smooth step over the clip). Written in glTF space
(Blender (x, y, z) becomes (x, z, -y), the quaternion is turned by -90 degrees about X), a key every
1/30 s: px, py, pz, qx, qy, qz, qw, vfov, shy. A loop is one key.

FITS.json: { "idle": {matrix: [16 numbers, Blender world, row major], vfov, shy}, "pose": {...}, "sky": [9 numbers, row
major] }. A loop's camera is the absolute camera of the recording; its offset from the game's own camera of that
loop is taken once and carried through the clip.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Euler, Matrix, Quaternion, Vector  # noqa: E402

from common import PREFIX, options, work_dir  # noqa: E402

FPS = 30
ASPECT = 3840 / 1728
# clip name -> (camera action, offset from, offset to)
CLIPS = {
    "city_idle": ("cam_city_idle", "idle", "idle"),
    "city_interaction_R_loop": ("cam_city_interaction_R_loop", "pose", "pose"),
    "city_interaction_R": ("cam_city_interaction_R_", "idle", "pose"),
    "city_interaction_back_R": ("cam_city_interaction_back_R", "pose", "idle"),
    "city_intercation02": ("cam_city_intercation02", "idle", "idle"),
}

opt = options()
work = work_dir()
fits = json.load(open(opt["fits"]))
turn = Quaternion((1, 0, 0), -math.pi / 2)
# `landscape` (horizontal.mkv): one static camera, held for idle, pose and both transitions. The
# out clip keeps the game's own path, started from this camera (the idle's offset).
LAND = fits.get("landscape")
if LAND:
    fits["idle"] = fits["pose"] = LAND


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def mix(a, b, w):
    if isinstance(a, list):
        return [x + (y - x) * w for x, y in zip(a, b)]
    return a + (b - a) * w


def source_matrix(action_name, f=1.0):
    action = bpy.data.actions[PREFIX + action_name]
    curves = {(c.data_path, c.array_index): c for c in action.fcurves}
    loc = [curves[("location", k)].evaluate(f) for k in range(3)]
    rot = [curves[("rotation_euler", k)].evaluate(f) for k in range(3)]
    return Matrix.LocRotScale(Vector(loc), Euler(rot, "XYZ").to_quaternion(), None)


def local_of(d):
    return Matrix.Translation(Vector(d[:3])) @ Euler(d[3:6], "XYZ").to_matrix().to_4x4()


def mat_of(flat):
    return Matrix([flat[0:4], flat[4:8], flat[8:12], flat[12:16]])


SOURCE_LOOP = {"idle": "cam_city_idle", "pose": "cam_city_interaction_R_loop"}
# The offset of each loop's fitted camera from the game's camera of that loop, in the camera's own axes.
# `matrix` null means the game's own camera (no offset).
OFFSET = {
    k: (
        Matrix.Identity(4)
        if fits[k].get("matrix") is None
        else source_matrix(SOURCE_LOOP[k]).inverted() @ mat_of(fits[k]["matrix"])
    )
    for k in ("idle", "pose")
}


def offset_mix(a, b, w):
    qa, qb = OFFSET[a].to_quaternion(), OFFSET[b].to_quaternion()
    q = qa.slerp(qb, w)
    t = OFFSET[a].to_translation().lerp(OFFSET[b].to_translation(), w)
    return Matrix.Translation(t) @ q.to_matrix().to_4x4()


out = {
    "fps": FPS,
    "aspect": round(ASPECT, 5),
    "clips": {},
    "sky": {"fromFilm": fits["sky"], "poly": fits["skyPoly"]},
}
# The portrait window is a crop of the recording's frame (the same camera): [fx, fy, h] for the idle
# and the pose (`portrait.crop` of fits.json, see round7-CAM-portrait.md).
if fits.get("portrait", {}).get("crop"):
    out["portraitCrop"] = fits["portrait"]["crop"]
for clip, (action_name, a_name, b_name) in CLIPS.items():
    action = bpy.data.actions[PREFIX + action_name]
    start, end = action.frame_range
    frames = int(round(end - start)) + 1
    curves = {(c.data_path, c.array_index): c for c in action.fcurves}
    rows = []
    flat = []
    for i in range(frames):
        f = start + i
        loc = [curves[("location", k)].evaluate(f) for k in range(3)]
        rot = [curves[("rotation_euler", k)].evaluate(f) for k in range(3)]
        base = Matrix.LocRotScale(Vector(loc), Euler(rot, "XYZ").to_quaternion(), None)
        w = smooth(i / max(1, frames - 1)) if a_name != b_name else 0.0
        fa, fb = fits[a_name], fits[b_name]
        vfov = mix(fa["vfov"], fb["vfov"], w)
        shy = mix(fa["shy"], fb["shy"], w)
        m = base @ offset_mix(a_name, b_name, w)
        p = m.to_translation()
        q = turn @ m.to_quaternion()
        rows.append([p.x, p.z, -p.y, q.x, q.y, q.z, q.w, vfov, shy])
    for i in range(1, frames):
        a, b = rows[i - 1], rows[i]
        if sum(a[3 + k] * b[3 + k] for k in range(4)) < 0:
            rows[i] = b[:3] + [-v for v in b[3:7]] + b[7:]
    if LAND and clip != "city_intercation02":
        m = mat_of(LAND["matrix"])
        p = m.to_translation()
        q = turn @ m.to_quaternion()
        rows = [[p.x, p.z, -p.y, q.x, q.y, q.z, q.w, LAND["vfov"], LAND["shy"]]] * frames
    static = (a_name == b_name or bool(LAND and clip != "city_intercation02")) and all(
        max(abs(rows[i][k] - rows[0][k]) for k in range(9)) < 2e-4 for i in range(frames)
    )
    if static:
        rows = rows[:1]
    for r in rows:
        flat += [round(v, 4) for v in r[:3]] + [round(v, 5) for v in r[3:7]] + [round(r[7], 3), round(r[8], 4)]
    out["clips"][clip] = {
        "frames": frames,
        "duration": round((frames - 1) / FPS, 6),
        "static": static,
        "keys": flat,
    }

path = os.path.join(work, "cameras-r7.json")
with open(path, "w") as handle:
    json.dump(out, handle, separators=(",", ":"))
print("DONE", path, {k: len(v["keys"]) // 9 for k, v in out["clips"].items()})
