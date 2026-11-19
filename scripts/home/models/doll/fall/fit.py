"""
Fits the Mixamo clip Falling.fbx to the doll and writes the loop the home page plays.

    blender -b --python export.py -- fall_src.json [Falling.fbx]     (the source clip, read only)
    python fit.py fall_src.json ../../../../../apps/web/public/models/home/doll-fall.json

The source is the standard Mixamo mannequin: a T pose, +Y up, +Z forward, +X its left, which are the
doll's own axes (the doll is 1.7 file units tall, front +Z, +X her left, her bind pose is an A pose with
the arms 35 degrees below the horizontal). So the clip is fitted in world space, bone by bone:

  1. The world turn of a bone from its bind pose, D = W(frame) * W(bind)^-1, is the same for any frame
     of reference of the bone, so it carries over to a doll whose bone frames differ (they do: the
     limb bones of the Meshy rig are Blender frames).
  2. The doll is not in a T pose. A swing R takes the doll's bind bone direction onto the source's, so
     the doll bone's world rotation is D * R * Wdoll(bind): the doll bone points where the source's does.
     A leaf bone (head, hand, toe) takes its parent's swing.
  3. The local rotation of a bone is the inverse of its parent's world rotation times its own, so the
     fitted pose follows the doll's own hierarchy and her short limbs.
  4. The whole body is turned by ROOT (the orientation of the fall: set below) and the swing of every
     limb is scaled by AMP (the doll is a chibi: a big head, short limbs).
  5. The loop is the clip's own (first frame equals last in the source): the last frame is dropped.

Nothing is allocated at run time: the page reads `q` (x, y, z, w per bone per key) and `hips`.
"""
import json
import sys

import numpy as np

from qmath import qaxisangle, qfromto, qinv, qmul, qnorm, qrot, qslerp

RIG = "D:/aspirant/apps/web/public/models/home/doll-rig.json"
FPS = 30

# The orientation of the fall: turns applied to the whole body in the doll's frame, in this order
# (each is axis, degrees, about the model's axes and applied after the one before). The source falls
# belly down with the head toward +Z (a skydiver). Here: a turn of -25 degrees about her vertical, then
# -75 about X (the belly comes round to the camera and the head goes up), then 12 in the screen plane.
# Set by looking at the renders: her face shows, three quarters, and she reads as a diver.
ROOT = [("y", -25.0), ("x", -75.0), ("z", 12.0)]

# The scale of each bone's turn away from the doll's own bind pose, 1 is the source's full swing.
AMP = {
    "default": 1.0,
}

AIM = {
    "Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck", "neck": "Head",
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase",
    "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase",
}
AXIS = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1)}


def load_config(path):
    """Optional JSON that overrides ROOT and AMP while looking: {"root": [["x", -90]], "amp": {"LeftArm": 0.5}}."""
    global ROOT, AMP
    cfg = json.load(open(path))
    if "root" in cfg:
        ROOT = [tuple(r) for r in cfg["root"]]
    if "amp" in cfg:
        AMP = {**AMP, **cfg["amp"]}


def root_quat():
    q = np.array([1.0, 0, 0, 0])
    for axis, deg in ROOT:
        q = qmul(qaxisangle(AXIS[axis], np.radians(deg)), q)
    return q


def doll_bones():
    rig = json.load(open(RIG))["bones"]
    names = list(rig.keys())
    parent = {n: rig[n]["parent"] for n in names}
    local = {}
    for n in names:
        x, y, z, w = rig[n]["localQuaternion"]
        local[n] = np.array([w, x, y, z])
    world = {}
    for n in names:  # parents come first
        world[n] = local[n] if parent[n] is None else qmul(world[parent[n]], local[n])
    pos = {n: np.array(rig[n]["bindWorld"]) for n in names}
    return names, parent, local, world, pos


def fit(src_path, out_path):
    src = json.load(open(src_path))
    bind, frames = src["bind"], src["frames"]
    names, parent, local, world, dpos = doll_bones()

    # The swing that takes the doll's bind bone direction onto the source's.
    fix = {}
    for n in names:
        if n in AIM:
            c = AIM[n]
            dd = dpos[c] - dpos[n]
            sd = np.array(bind[c]["p"]) - np.array(bind[n]["p"])
            fix[n] = qfromto(dd, sd)
        else:
            fix[n] = fix[parent[n]]
    root = root_quat()
    key = len(frames) - 1  # the last frame repeats the first
    count = key
    hips_bind = np.array(json.load(open(RIG))["bones"]["Hips"]["bindWorld"])
    src_scale = hips_bind[1] / bind["Hips"]["p"][1]

    q_out = np.zeros((count, len(names), 4))
    hips_out = np.zeros((count, 3))
    hips_src = np.array([frames[f]["Hips"]["p"] for f in range(count)])
    hips_mean = hips_src.mean(axis=0)
    for f in range(count):
        wd = {}
        for n in names:
            D = qmul(np.array(frames[f][n]["q"]), qinv(np.array(bind[n]["q"])))
            # the whole body is turned by the root, so every bone's world rotation takes it
            wd[n] = qnorm(qmul(root, qmul(qmul(D, fix[n]), world[n])))
        for i, n in enumerate(names):
            loc = wd[n] if parent[n] is None else qmul(qinv(wd[parent[n]]), wd[n])
            amp = AMP.get(n, AMP["default"])
            if n != "Hips" and amp != 1.0:
                loc = qslerp(local[n], qnorm(loc), amp)
            loc = qnorm(loc)
            # one hemisphere along the clip, so a track never takes the long way round
            if f > 0 and np.dot(loc, q_out[f - 1, i, [3, 0, 1, 2]]) < 0:
                loc = -loc
            q_out[f, i] = [loc[1], loc[2], loc[3], loc[0]]
        hips_out[f] = hips_bind + qrot(root, (hips_src[f] - hips_mean)) * src_scale
    data = {
        "version": 1,
        "source": "Falling.fbx (Mixamo mannequin), fitted by scripts/home/models/doll/fall/fit.py",
        "fps": FPS,
        "keys": count,
        "seconds": count / FPS,
        "bones": names,
        "q": [round(float(v), 4) for v in q_out.reshape(-1)],
        "hips": [round(float(v), 5) for v in hips_out.reshape(-1)],
    }
    json.dump(data, open(out_path, "w"), separators=(",", ":"))
    # The seam: the step from the last key to the first against the typical step.
    step = np.abs(np.diff(q_out, axis=0)).max()
    seam = np.abs(q_out[0] - q_out[-1]).max()
    print(f"keys {count} ({count / FPS:.2f} s), largest step {step:.4f}, seam step {seam:.4f}, file {len(json.dumps(data))} bytes")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--config" in args:
        i = args.index("--config")
        load_config(args[i + 1])
        del args[i:i + 2]
    fit(args[0], args[1])
