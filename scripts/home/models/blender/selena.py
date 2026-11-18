"""Selena (the normal form) from the entrance file: a clean skinned mesh, baked clips, face morphs.

    blender -b entrance.blend --python selena.py -- --work DIR --raw RAW.blend

Writes into DIR: selena.raw.glb (mesh, skin, morph targets, materials, no animation) and
selena.bake.json (rest transforms, the baked clips, numbers for the checks, the morph report).

What it does (README.md has the reasons):
- keeps head, eye, hair_01, hair_02, body_01, body_02, body_03 and the bones that skin them
  (and their ancestors); the abyssal form, the weapons of the abyssal form and the two UI cards go;
- bakes four clips from the evaluated pose (the entrance file's actions are slotted);
- moves the face morph targets of the raw head onto the entrance head by the nearest vertex in
  world space, in the rest pose, and writes how well they matched.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402

from common import (  # noqa: E402
    FPS,
    PREFIX,
    armature,
    bake_clip,
    bone_report,
    clear_animation,
    drop_actions,
    drop_objects_except,
    drop_vertex_groups_except,
    export_raw,
    local_tracks,
    options,
    probe_heads,
    prune_armature,
    rest_local,
    work_dir,
    write_json,
)

CLIPS = ["idle", "interaction_R_loop", "interaction_back_R", "intercation03"]
KEEP = [PREFIX + n for n in ("head", "eye", "hair_01", "hair_02", "body_01", "body_02", "body_03")]
RAW_HEAD = "selena_silverbolt_raiko_head"

# The face targets of the raw head are numbered by the game. What each one does was read from a
# render of every target on the bare head (README.md has the sheet). The names are ours.
FACES = {
    "biyan": "blink",
    "194": "wince_open",
    "249": "strain",
    "257": "shout",
    "1156": "laugh",
    "1163": "smile_closed",
    "780": "smile",
    "500": "smile_soft",
    "240": "angry",
    "915": "angry_shout",
    "937": "snarl",
    "149": "surprised",
    "2215": "lips_pursed",
    "155_2": "mouth_o",
    "2170": "mouth_tiny_o",
}
MATCH_LIMIT = 0.003  # metres: a vertex whose nearest raw vertex is farther keeps its basis position

work = work_dir()
arm = armature()
clear_animation(arm)

# 1. The bones that skin Selena, and their ancestors.
used = set()
for name in KEEP:
    obj = bpy.data.objects[name]
    groups = [g.name for g in obj.vertex_groups]
    for vertex in obj.data.vertices:
        for g in vertex.groups:
            if g.weight > 1e-4:
                used.add(groups[g.group])
keep = set(used)
for name in list(used):
    bone = arm.data.bones[name]
    while bone.parent:
        keep.add(bone.parent.name)
        bone = bone.parent
parent_of = {}
for name in keep:
    parent = arm.data.bones[name].parent
    parent_of[name] = parent.name if parent is not None else None
rank = {}


def depth(name):
    if name not in rank:
        rank[name] = 0 if parent_of[name] is None else depth(parent_of[name]) + 1
    return rank[name]


source_order = [b.name for b in arm.data.bones]
order = sorted(keep, key=lambda n: (depth(n), source_order.index(n)))
print("BONES kept", len(order), "weighted", len(used))

# 2. Bake the clips.
baked = {}
for clip in CLIPS:
    frames, deform = bake_clip(arm, clip, order)
    baked[clip] = (frames, deform)
    print("BAKED", clip, frames)
original_rest = {name: arm.data.bones[name].matrix_local.copy() for name in order}
rest_heads = {name: original_rest[name].to_translation() for name in order}

# 3. The face morph targets, from the raw head, in the rest pose.
arm.data.pose_position = "REST"
raw_blend = options().get("raw")
with bpy.data.libraries.load(raw_blend, link=False) as (src, dst):
    dst.objects = [RAW_HEAD]
raw = dst.objects[0]
head = bpy.data.objects[PREFIX + "head"]
mesh = head.data
raw_keys = raw.data.shape_keys.key_blocks
basis = raw_keys[0]
raw_world = [raw.matrix_world @ p.co for p in basis.data]
tree = KDTree(len(raw_world))
for i, p in enumerate(raw_world):
    tree.insert(p, i)
tree.balance()
to_world = head.matrix_world
to_local = to_world.to_3x3().inverted()
nearest = []
distances = []
for vertex in mesh.vertices:
    _, index, distance = tree.find(to_world @ vertex.co)
    nearest.append(index)
    distances.append(distance)
bad = sum(1 for d in distances if d > MATCH_LIMIT)
print(
    "MORPH match: vertices %d, mean %.6f m, max %.6f m, farther than %.3f m: %d"
    % (len(distances), sum(distances) / len(distances), max(distances), MATCH_LIMIT, bad)
)
head.shape_key_add(name="Basis", from_mix=False)
morph_report = {}
for source, name in FACES.items():
    block = raw_keys[source]
    key = head.shape_key_add(name=name, from_mix=False)
    key.value = 0.0
    moved = 0
    largest = 0.0
    for i, vertex in enumerate(mesh.vertices):
        if distances[i] > MATCH_LIMIT:
            continue
        j = nearest[i]
        delta_world = block.data[j].co - basis.data[j].co
        if delta_world.length < 1e-5:
            continue
        delta = to_local @ delta_world
        key.data[i].co = vertex.co + delta
        moved += 1
        largest = max(largest, delta_world.length)
    morph_report[name] = {"source": source, "vertices": moved, "largestMetres": round(largest, 5)}
    print("MORPH", name, source, moved, round(largest, 4))
morph_stats = {
    "vertices": len(distances),
    "meanDistance": sum(distances) / len(distances),
    "maxDistance": max(distances),
    "farther": bad,
    "limit": MATCH_LIMIT,
}
bpy.data.objects.remove(raw, do_unlink=True)

# 4. Keep Selena only.
drop_objects_except(set(KEEP))
for name in KEEP:
    drop_vertex_groups_except(bpy.data.objects[name], keep)
arm.animation_data_clear()
drop_actions()
prune_armature(arm, keep)

# 5. Node-local tracks. The hierarchy is the source's: only the bones it does not need are gone.
rest = {name: arm.data.bones[name].matrix_local.copy() for name in order}
clips = {}
worst_scale = 0.0
for clip, (frames, deform) in baked.items():
    tracks, scale_error = local_tracks(deform, rest, parent_of, order)
    worst_scale = max(worst_scale, scale_error)
    clips[clip] = {
        "frames": frames,
        "tracks": tracks,
        "probe": probe_heads(deform, original_rest, order, frames),
    }
print("CHECK worst uneven scale", worst_scale)
assert worst_scale < 1e-3, worst_scale

raw_path = os.path.join(work, "selena.raw.glb")
size = export_raw(raw_path, morph=True)
print("EXPORTED", raw_path, size)

write_json(
    os.path.join(work, "selena.bake.json"),
    {
        "fps": FPS,
        "bones": order,
        "parent": parent_of,
        "restLocal": rest_local(rest, parent_of, order),
        "rest": bone_report(arm, order),
        "clips": clips,
        "morph": {"report": morph_report, "stats": morph_stats},
        "checks": {"worstUnevenScale": worst_scale},
    },
)
print("DONE")
