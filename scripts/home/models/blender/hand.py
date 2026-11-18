"""Selena's LEFT hand (the black clawed glove and the bracer) cut out of body_01.

    blender -b entrance.blend --python hand.py -- --work DIR

Writes into DIR: hand.raw.glb (mesh, skin, material, no animation) and hand.bake.json (rest
transforms, the two clips, the picture box, the numbers for the checks).

What it does (README.md has the reasons):
- takes the islands of body_01 that belong to the glove and the bracer (weights on the forearm,
  the hand, the fifteen finger bones and the bracer bone) and welds the seams;
- the cuff of the glove is OPEN in the source (a ring of 14 edges). Filling it would make a flat
  cap. Instead a sleeve is grown from the ring along the arm, tapering, closed by a soft cone;
- moves the UVs into a crop of the picture (build.mjs crops it);
- keeps the 20 bones that skin it (the upper arm is the root), turns the whole model so that the
  forearm lies along +Z toward the camera, the palm up and a little toward the camera, the fingers
  away (-Z), the wrist at the origin;
- bakes `palm_up` (a reach, from the bind pose to an open palm) and `breath` (a loop).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Euler, Matrix, Quaternion, Vector  # noqa: E402

from common import (  # noqa: E402
    FPS,
    PREFIX,
    armature,
    bone_report,
    clear_animation,
    drop_actions,
    drop_objects_except,
    drop_vertex_groups_except,
    evaluated_pose,
    export_raw,
    local_tracks,
    probe_heads,
    prune_armature,
    rest_local,
    rounded,
    work_dir,
    write_json,
)

FINGERS = {
    "thumb": ["Finger0", "Finger01", "Finger02"],
    "index": ["Finger1", "Finger11", "Finger12"],
    "middle": ["Finger2", "Finger21", "Finger22"],
    "ring": ["Finger3", "Finger31", "Finger32"],
    "pinky": ["Finger4", "Finger41", "Finger42"],
}
P_L = "Bip001 L "
ARM_BONES = [P_L + n for n in ("Forearm", "ForeTwist", "Hand")] + [P_L + n for chain in FINGERS.values() for n in chain]
BRACER = "Bone01_JianJia_L_03"
KEEP = [P_L + "UpperArm"] + ARM_BONES + [BRACER]
SLEEVE_LENGTH = 0.16  # metres grown behind the cuff
SLEEVE_TAPER = 0.5  # the last ring is this fraction of the cuff's size
SLEEVE_RINGS = 5
# Where the forearm points in the finished model (toward the hand): away from the camera, a little down.
FOREARM_DIRECTION = Vector((0.0, -0.10, -0.995)).normalized()
# The thumb side of the hand points to the left of the picture.
THUMB_SIDE = Vector((-1.0, 0.0, 0.0))
CLIP_FRAMES = {"palm_up": 25, "breath": 97}  # 24 per second: one second of reach, four seconds of breath

# The pose, in bone-local Euler degrees XYZ: X rolls about the bone, Y spreads (positive toward the
# thumb side), Z flexes (positive toward the palm). The thumb flexes about Y and abducts about Z.
# This is the pose of hand.jpg (an open palm reaching to the viewer, fingers loosely spread and a
# little cupped, thumb out) written for this glove. build.mjs measures the axes again in three.
POSE = {
    "Hand": (0, 0, 22),
    "Finger0": (6, 10, -30),
    "Finger01": (0, 12, -4),
    "Finger02": (0, 16, 0),
    "Finger1": (0, 12, 6),
    "Finger11": (0, 0, 14),
    "Finger12": (0, 0, 10),
    "Finger2": (0, 3, 4),
    "Finger21": (0, 0, 16),
    "Finger22": (0, 0, 10),
    "Finger3": (0, -7, 8),
    "Finger31": (0, 0, 20),
    "Finger32": (0, 0, 12),
    "Finger4": (0, -16, 10),
    "Finger41": (0, 0, 24),
    "Finger42": (0, 0, 14),
}

work = work_dir()
arm = armature()
clear_animation(arm)
arm.data.pose_position = "REST"
src = bpy.data.objects[PREFIX + "body_01"]
drop_objects_except({src.name})
groups = [g.name for g in src.vertex_groups]
group_index = {name: i for i, name in enumerate(groups)}

# 1. The glove and the bracer: whole islands of the mesh (the seams are splits of the vertices).
me = src.data
weight = {v.index: sum(g.weight for g in v.groups if groups[g.group] in ARM_BONES + [BRACER]) for v in me.vertices}
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
seen = set()
keep_vertices = set()
for v in bm.verts:
    if v.index in seen:
        continue
    stack = [v]
    comp = []
    seen.add(v.index)
    while stack:
        x = stack.pop()
        comp.append(x.index)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y.index not in seen:
                seen.add(y.index)
                stack.append(y)
    if sum(weight[i] for i in comp) / len(comp) > 0.5:
        keep_vertices.update(comp)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep_vertices], context="VERTS")
before = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
print("HAND welded", before, "->", len(bm.verts))
boundary = [e for e in bm.edges if e.is_boundary]
print("HAND open edges after the weld", len(boundary))
assert len(boundary) == 14, len(boundary)  # the ring of the cuff, nothing else
assert not [e for e in bm.edges if not e.is_manifold and not e.is_boundary], "a non-manifold edge"

# 2. The sleeve. Order the ring of the cuff, then grow tapering rings along the arm.
ring = [boundary[0].verts[0]]
edges_left = set(boundary)
while edges_left:
    last = ring[-1]
    nxt = None
    for e in list(edges_left):
        if last in e.verts:
            nxt = e.other_vert(last)
            edges_left.remove(e)
            break
    assert nxt is not None
    if nxt is ring[0]:
        break
    ring.append(nxt)
assert len(ring) == 14, len(ring)
centre = sum((v.co for v in ring), Vector()) / len(ring)
normal = Vector()
for i, v in enumerate(ring):  # Newell's method
    a, b = v.co, ring[(i + 1) % len(ring)].co
    normal += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
normal.normalize()
forearm_head = arm.data.bones[P_L + "Forearm"].head_local.copy()
hand_head_bind = arm.data.bones[P_L + "Hand"].head_local.copy()
toward_elbow = (forearm_head - hand_head_bind).normalized()
if normal.dot(toward_elbow) < 0:
    normal = -normal
# The source cuff is cut at a slant (its ring faces the palm side, 52 degrees off the arm). The
# sleeve grows along the arm, not along the ring normal.
grow = toward_elbow
print("HAND cuff ring: centre", tuple(round(x, 3) for x in centre), "normal", tuple(round(x, 3) for x in normal), "toward the elbow", tuple(round(x, 3) for x in toward_elbow))

deform = bm.verts.layers.deform.verify()
uv_layers = list(bm.loops.layers.uv.values())
uv_mid = [Vector((0, 0)) for _ in uv_layers]
count = 0
for v in ring:
    for loop in v.link_loops:
        for k, layer in enumerate(uv_layers):
            uv_mid[k] += loop[layer].uv
        count += 1
uv_mid = [u / count for u in uv_mid]
radius = sum((v.co - centre).length for v in ring) / len(ring)
rings = [ring]
new_faces = []
for k in range(1, SLEEVE_RINGS + 1):
    t = k / SLEEVE_RINGS
    scale = 1.0 - (1.0 - SLEEVE_TAPER) * (t * t * (3 - 2 * t))
    row = []
    for v in ring:
        nv = bm.verts.new(centre + (v.co - centre) * scale + grow * (SLEEVE_LENGTH * t))
        nv[deform][group_index[P_L + "Forearm"]] = 1.0
        row.append(nv)
    for i in range(len(ring)):
        new_faces.append(bm.faces.new((rings[-1][i], rings[-1][(i + 1) % len(ring)], row[(i + 1) % len(ring)], row[i])))
    rings.append(row)
apex = bm.verts.new(centre + grow * (SLEEVE_LENGTH + 0.45 * radius * SLEEVE_TAPER))
apex[deform][group_index[P_L + "Forearm"]] = 1.0
for i in range(len(ring)):
    new_faces.append(bm.faces.new((rings[-1][i], rings[-1][(i + 1) % len(ring)], apex)))
bm.faces.ensure_lookup_table()
for f in new_faces:
    f.smooth = True
    for loop in f.loops:
        for k, layer in enumerate(uv_layers):
            loop[layer].uv = uv_mid[k]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
assert not [e for e in bm.edges if e.is_boundary], "the sleeve left an open border"
assert not [e for e in bm.edges if not e.is_manifold], "the sleeve left a non-manifold edge"
bm.to_mesh(me)
bm.free()
me.update()
print("HAND tris", sum(len(p.vertices) - 2 for p in me.polygons), "verts", len(me.vertices))
src.name = "selena_hand_L"
drop_vertex_groups_except(src, set(KEEP))

# 3. UVs into a crop of the picture. The box is in pixels of the 1024 square base picture (y from
# the top), grown to a multiple of 8 so the half size normal map crops on a whole pixel too.
uvd = me.uv_layers[0].data
us = [loop.uv.x for loop in uvd]
vs = [loop.uv.y for loop in uvd]
size = 1024
x0 = int(math.floor(min(us) * size / 8) * 8) - 8
x1 = int(math.ceil(max(us) * size / 8) * 8) + 8
y0 = int(math.floor((1 - max(vs)) * size / 8) * 8) - 8
y1 = int(math.ceil((1 - min(vs)) * size / 8) * 8) + 8
x0, y0 = max(0, x0), max(0, y0)
x1, y1 = min(size, x1), min(size, y1)
print("HAND picture box", x0, y0, x1, y1, "of", size)
for layer in me.uv_layers:
    for loop in layer.data:
        loop.uv.x = (loop.uv.x * size - x0) / (x1 - x0)
        loop.uv.y = 1 - ((1 - loop.uv.y) * size - y0) / (y1 - y0)

# 4. Bones.
prune_armature(arm, set(KEEP))
hand_head = arm.data.bones[P_L + "Hand"].head_local.copy()

# 5. The orientation. Forearm axis (toward the hand) and the thumb axis, as measured on the bind pose.
forearm_axis = (hand_head_bind - forearm_head).normalized()
thumb = Vector((0, 0, 1))
thumb -= forearm_axis * thumb.dot(forearm_axis)
thumb.normalize()
side_bind = forearm_axis.cross(thumb)
frame_bind = Matrix((forearm_axis, thumb, side_bind)).transposed()  # columns
thumb_t = THUMB_SIDE - FOREARM_DIRECTION * THUMB_SIDE.dot(FOREARM_DIRECTION)
thumb_t.normalize()
frame_target = Matrix((FOREARM_DIRECTION, thumb_t, FOREARM_DIRECTION.cross(thumb_t))).transposed()
turn = frame_target @ frame_bind.inverted()
place = Matrix.Translation(Vector()) @ turn.to_4x4() @ Matrix.Translation(-hand_head)
print("HAND turn", [[round(x, 3) for x in row] for row in turn])
me.transform(place)
me.update()
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for bone in arm.data.edit_bones:
    bone.transform(place)
bpy.ops.object.mode_set(mode="OBJECT")
# The mesh is a child of the armature object, which carries its own +90 degree turn: the vertices
# are in armature space, which is what the glTF file calls world space. Nothing else to do.
src.matrix_parent_inverse = Matrix.Identity(4)

# 6. Bones in order, parents first. Clips by posing the bones and reading the evaluated pose.
parent_of = {}
for bone in arm.data.bones:
    parent_of[bone.name] = bone.parent.name if bone.parent else None
order = []
for name in [b.name for b in arm.data.bones]:
    chain = []
    cur = name
    while cur is not None and cur not in order:
        chain.append(cur)
        cur = parent_of[cur]
    order += reversed(chain)
rest = {name: arm.data.bones[name].matrix_local.copy() for name in order}
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"


def euler_quat(degrees):
    return Euler([math.radians(x) for x in degrees], "XYZ").to_quaternion()


def ease(p):
    return p * p * (3 - 2 * p)


def pose_frame(amount, extra=None):
    """Sets every pose bone to POSE * amount (+ extra: {bone short name: degrees})."""
    for pb in arm.pose.bones:
        short = pb.name.replace(P_L, "")
        d = POSE.get(short, (0, 0, 0))
        e = (extra or {}).get(short, (0, 0, 0))
        pb.rotation_quaternion = euler_quat([d[i] * amount + e[i] for i in range(3)])
    arm.update_tag()
    bpy.context.view_layer.update()


def sample():
    pose = evaluated_pose(arm)
    return {name: pose.bones[name].matrix.copy() @ rest[name].inverted() for name in order}


arm.data.pose_position = "POSE"
clips = {}
reach = []
for f in range(CLIP_FRAMES["palm_up"]):
    p = ease(f / (CLIP_FRAMES["palm_up"] - 1))
    pose_frame(p)
    reach.append(sample())
breathing = []
frames = CLIP_FRAMES["breath"]
phase = {}
for i, name in enumerate(order):  # a little different for every bone, so the fingers ripple
    phase[name.replace(P_L, "")] = i * 0.35
for f in range(frames):
    s = 2 * math.pi * f / (frames - 1)
    extra = {}
    for short in POSE:
        a = 1.6 if short != "Hand" else 1.1  # degrees: far below what the eye reads as a move
        extra[short] = (0, 0.5 * math.sin(s + phase.get(short, 0)) * (short.startswith("Finger") and 1 or 0), a * math.sin(s + phase.get(short, 0)))
    pose_frame(1.0, extra)
    breathing.append(sample())
arm.data.pose_position = "REST"
for pb in arm.pose.bones:
    pb.rotation_quaternion = Quaternion((1, 0, 0, 0))

bake = {}
for name, series in (("palm_up", reach), ("breath", breathing)):
    deform_by_bone = {b: [frame[b] for frame in series] for b in order}
    tracks, scale_error = local_tracks(deform_by_bone, rest, parent_of, order)
    assert scale_error < 1e-3, scale_error
    bake[name] = {
        "frames": len(series),
        "tracks": tracks,
        "probe": probe_heads(deform_by_bone, rest, order, len(series)),
    }
print("BAKED", {k: v["frames"] for k, v in bake.items()})

# 7. The mesh, the skin and the picture.
raw_path = os.path.join(work, "hand.raw.glb")
size_bytes = export_raw(raw_path)
print("EXPORTED", raw_path, size_bytes)
write_json(
    os.path.join(work, "hand.bake.json"),
    {
        "fps": FPS,
        "bones": order,
        "parent": parent_of,
        "restLocal": rest_local(rest, parent_of, order),
        "rest": bone_report(arm, order),
        "clips": bake,
        "pictureBox": [x0, y0, x1, y1],
        "pictureSize": size,
        "pose": {k: list(v) for k, v in POSE.items()},
        "sleeve": {"length": SLEEVE_LENGTH, "taper": SLEEVE_TAPER, "rings": SLEEVE_RINGS},
        "forearmDirection": rounded(FOREARM_DIRECTION),
        "palmNormalBind": rounded(turn @ Vector((-1, 0, 0))),
        "thumbSideBind": rounded(turn @ Vector((0, 0, 1))),
        "checks": {},
    },
)
print("DONE")
