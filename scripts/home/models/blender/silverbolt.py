"""Silverbolt (abyssal_devil_01 and 02) from the entrance file: a clean skinned mesh and baked clips.

    blender -b entrance.blend --python silverbolt.py -- --work DIR

Writes into DIR: silverbolt.raw.glb (mesh, skin, materials, no animation) and
silverbolt.bake.json (rest transforms, the baked clips, numbers for the checks).

What it fixes in the source (README.md has the reasons):
- the tail: the seven body bones She_09 to She_23 are siblings in the file. They become a
  chain, each bone aimed at the next, so a solver or a spring can drive them as a tail;
- the clips are baked from the evaluated pose (the entrance file's actions are slotted);
- bones that skin nothing of Silverbolt are removed, with the 310 unused vertex groups.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from common import *  # noqa: E402,F401,F403
from common import (  # noqa: E402
    PREFIX,
    FPS,
    armature,
    bake_clip,
    bone_report,
    clear_animation,
    drop_actions,
    drop_objects_except,
    drop_vertex_groups_except,
    export_raw,
    fk_heads,
    probe_heads,
    local_tracks,
    prune_armature,
    rest_local,
    trs,
    work_dir,
    write_json,
)
from mathutils import Vector  # noqa: E402

CLIPS = ["idle", "idle_BP", "interaction_R_loop", "intercation03", "action"]
MESHES = [PREFIX + "abyssal_devil_01", PREFIX + "abyssal_devil_02"]
# The tail, from the body outward. In the source all seven hang on D_she_root.
CHAIN = ["Bone02_She_%02d" % n for n in (9, 10, 11, 12, 21, 22, 23)]
ROOT = "D_she_root"

work = work_dir()
arm = armature()
clear_animation(arm)

she = [b.name for b in arm.data.bones if "She" in b.name or b.name == ROOT]
assert len(she) == 22, len(she)

# 0. Two bones for the eyes, children of the head bone, at the middle of each blue gem. They
# have no pose of their own (they follow the head); the page scales them up and down about
# their head to blink. Their Y axis is the armature's up and their frame has no roll, so
# scale.y is the vertical squash of an upright head. L is the +X side (the head faces +Z in
# glTF space, so +X is the head's left).
EYES = {"sb_eye_L": (0.108, 3.576, 0.151), "sb_eye_R": (-0.108, 3.576, 0.151)}
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for eye_name, (ex, ey, ez) in EYES.items():
    bone = arm.data.edit_bones.new(eye_name)
    bone.head = Vector((ex, ey, ez))
    bone.tail = Vector((ex, ey + 0.02, ez))
    bone.roll = 0.0
    bone.parent = arm.data.edit_bones["Bone02_She_01"]
    bone.use_connect = False
    bone.use_deform = True
bpy.ops.object.mode_set(mode="OBJECT")
she += list(EYES)
# Parents before children, as the file has them.
order = []
for bone in arm.data.bones:
    if bone.name in she:
        order.append(bone.name)
parent_source = {}
for name in order:
    parent = arm.data.bones[name].parent
    parent_source[name] = parent.name if parent is not None and parent.name in she else None
assert parent_source[ROOT] is None
original_rest = {name: arm.data.bones[name].matrix_local.copy() for name in order}

# 1. Bake the deformation of every clip while the whole rig is still there.
baked = {}
for clip in CLIPS:
    frames, deform = bake_clip(arm, clip, order)
    baked[clip] = (frames, deform)
    print("BAKED", clip, frames)

# 2. Keep Silverbolt only.
drop_objects_except(set(MESHES))
for name in MESHES:
    drop_vertex_groups_except(bpy.data.objects[name], set(she))
arm.animation_data_clear()
drop_actions()
prune_armature(arm, set(she))

# 3. The tail as a chain, each bone aimed at the next. Heads do not move, so the mesh and
# its weights are untouched; only the frames of the bones are turned.
bpy.ops.object.mode_set(mode="EDIT")
edit = arm.data.edit_bones
heads = [edit[name].head.copy() for name in CHAIN]
for i, name in enumerate(CHAIN):
    bone = edit[name]
    bone.use_connect = False
    bone.parent = edit[ROOT] if i == 0 else edit[CHAIN[i - 1]]
    if i + 1 < len(CHAIN):
        step = heads[i + 1] - heads[i]
    else:
        step = heads[i] - heads[i - 1]  # the last bone goes on in the same direction
    bone.tail = heads[i] + step
    # The Z axis of the bone points up (armature Y), so X is across the tail, Y along it.
    bone.align_roll(Vector((0, 1, 0)))
bpy.ops.object.mode_set(mode="OBJECT")
parent_final = dict(parent_source)
for i, name in enumerate(CHAIN):
    parent_final[name] = ROOT if i == 0 else CHAIN[i - 1]
# Parents must come before children for the sums below.
rank = {}
def depth(name):
    if name not in rank:
        parent = parent_final[name]
        rank[name] = 0 if parent is None else depth(parent) + 1
    return rank[name]
order = sorted(order, key=lambda n: (depth(n), order.index(n)))
rest = {name: arm.data.bones[name].matrix_local.copy() for name in order}
rest_heads = {name: rest[name].to_translation() for name in order}
for name in order:
    assert (rest_heads[name] - original_rest[name].to_translation()).length < 1e-6, name

# 4. Node-local tracks under the new hierarchy, and the proof that nothing moved.
clips = {}
worst_move = 0.0
worst_scale = 0.0
for clip, (frames, deform) in baked.items():
    tracks, scale_error = local_tracks(deform, rest, parent_final, order)
    worst_scale = max(worst_scale, scale_error)
    # Where the original rig put each head, frame by frame, against the rebuilt chain.
    for f in range(frames):
        built = fk_heads(tracks, parent_final, order, f, rest_heads)
        for name in order:
            wanted = (deform[name][f] @ original_rest[name]).to_translation()
            worst_move = max(worst_move, (built[name] - wanted).length)
    clips[clip] = {
        "frames": frames,
        "tracks": tracks,
        "probe": probe_heads(deform, original_rest, order, frames),
    }
print("CHECK joints moved by at most", worst_move, "m; worst uneven scale", worst_scale)
assert worst_move < 2e-5, worst_move
assert worst_scale < 1e-3, worst_scale

# 5. The mesh, the skin and the pictures.
raw = os.path.join(work, "silverbolt.raw.glb")
size = export_raw(raw)
print("EXPORTED", raw, size)

write_json(
    os.path.join(work, "silverbolt.bake.json"),
    {
        "fps": FPS,
        "bones": order,
        "parent": parent_final,
        "parentSource": parent_source,
        "chain": CHAIN,
        "restLocal": rest_local(rest, parent_final, order),
        "rest": bone_report(arm, order),
        "clips": clips,
        "checks": {"worstJointMove": worst_move, "worstUnevenScale": worst_scale},
    },
)
print("DONE")
