"""Shared helpers of the Blender steps (run inside Blender 4.5, headless).

Every script here is started by build.mjs as
    blender -b <entrance.blend> --python <script>.py -- --work DIR [more options]
and writes its results into DIR. Nothing here touches the repository.

Two facts shape the code (found while mapping the source, see README.md):

1. The entrance file was saved by Blender 5.1. Blender 4.5 loads its actions as slotted
   actions and its NLA strips come in empty. An action that is assigned without its slot
   evaluates ONE pose for every frame, and the glTF exporter then writes clips that look
   right (names, durations) and do not move. So animation is never exported by Blender
   here: `bake_clip` evaluates the real pose frame by frame, and build.mjs writes the clips.
2. The armature object carries a +90 degree turn about X and the glTF exporter turns the
   world by -90 degrees about X, so the two cancel: glTF space IS the armature's own space.
   A bone's pose matrix in armature space is its glTF world matrix. The local transform of
   a node is then `parent_pose^-1 @ pose`, with no axis conversion.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

PREFIX = "selena_silverbolt_raiko_entrance_"
FPS = 24
# Digits kept in the baked numbers. 1e-6 of a metre is far below anything a screen shows.
DIGITS = 6


def options():
    """The `--key value` pairs after the `--` of the Blender command line."""
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    found = {}
    key = None
    for item in argv:
        if item.startswith("--"):
            key = item[2:]
            found[key] = True
        elif key is not None:
            found[key] = item
            key = None
    return found


def work_dir():
    path = options().get("work")
    if not path or path is True:
        raise SystemExit("--work DIR is required")
    os.makedirs(path, exist_ok=True)
    return path


def armature():
    return bpy.data.objects[PREFIX + "armature"]


def clear_animation(arm):
    """No NLA, no active action: the pose is the rest pose until `bake_clip` sets one."""
    if arm.animation_data:
        for track in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(track)
        arm.animation_data.action = None


def evaluated_pose(arm):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return arm.evaluated_get(depsgraph).pose


def bake_clip(arm, clip, bone_names):
    """The deformation of each bone, frame by frame, for the action city_<clip>.

    Returns (frames, {bone: [Matrix per frame]}). The matrix is `pose @ rest^-1` in armature
    space, the one thing the skin cares about. It does not depend on how a bone is turned
    in the rest pose, so a bone can be re-parented or re-oriented afterwards without
    touching the look of the clip.
    """
    action = bpy.data.actions[PREFIX + "city_" + clip]
    # The start frame is 1 in every action of the file. The loop below relies on it.
    assert abs(action.frame_range[0] - 1.0) < 1e-6, (clip, tuple(action.frame_range))
    frames = int(round(action.frame_range[1]))
    scene = bpy.context.scene
    arm.data.pose_position = "POSE"
    arm.animation_data_create()
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    rest_inverse = {name: arm.data.bones[name].matrix_local.inverted() for name in bone_names}
    out = {name: [] for name in bone_names}
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        arm.update_tag()
        bpy.context.view_layer.update()
        pose = evaluated_pose(arm)
        for name in bone_names:
            out[name].append(pose.bones[name].matrix.copy() @ rest_inverse[name])
    arm.animation_data.action = None
    return frames, out


def rounded(values):
    return [round(float(v), DIGITS) for v in values]


def trs(matrix):
    """(translation, quaternion x y z w, scale) of a matrix, rounded."""
    t, q, s = matrix.decompose()
    return rounded(t) + rounded((q.x, q.y, q.z, q.w)) + rounded(s)


def local_tracks(deform, rest, parent_of, bones):
    """Node-local transforms for each frame under the hierarchy `parent_of`.

    deform[b][f]: the deformation matrices from `bake_clip`.
    rest[b]: armature-space rest matrix of b in the NEW rest pose (any orientation).
    Returns ({bone: flat list, ten numbers per frame}, worst non-uniform scale). The scale of a
    bone may be anything as long as it is the same on all three axes: the source clips scale
    the whole dragon by 0.4 through D_she_root. A bone that is scaled unevenly under a turned
    parent would shear, and a glTF node cannot hold a shear.
    """
    frames = len(next(iter(deform.values())))
    tracks = {name: [] for name in bones}
    worst_scale = 0.0
    previous_q = {}
    for f in range(frames):
        pose = {name: deform[name][f] @ rest[name] for name in bones}
        for name in bones:
            parent = parent_of[name]
            local = pose[name] if parent is None else pose[parent].inverted() @ pose[name]
            t, q, s = local.decompose()
            worst_scale = max(worst_scale, max(s) - min(s))
            # One hemisphere through the whole clip: a flip would turn the short way round
            # between two keys and the mixer would spin the bone.
            before = previous_q.get(name)
            if before is not None and q.dot(before) < 0:
                q = Quaternion((-q.w, -q.x, -q.y, -q.z))
            previous_q[name] = q
            tracks[name] += rounded(t) + rounded((q.x, q.y, q.z, q.w)) + rounded(s)
    return tracks, worst_scale


def rest_local(rest, parent_of, bones):
    """Node-local rest transform (ten numbers) of each bone."""
    out = {}
    for name in bones:
        parent = parent_of[name]
        local = rest[name] if parent is None else rest[parent].inverted() @ rest[name]
        out[name] = trs(local)
    return out


def prune_armature(arm, keep):
    """Delete every bone that is not in `keep` (a set of names)."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in list(arm.data.edit_bones):
        if bone.name not in keep:
            arm.data.edit_bones.remove(bone)
    bpy.ops.object.mode_set(mode="OBJECT")


def drop_objects_except(keep_names):
    for obj in list(bpy.data.objects):
        if obj.type in ("MESH", "CAMERA", "EMPTY", "LIGHT") and obj.name not in keep_names:
            bpy.data.objects.remove(obj, do_unlink=True)


def drop_vertex_groups_except(obj, keep):
    for group in list(obj.vertex_groups):
        if group.name not in keep:
            obj.vertex_groups.remove(group)


def drop_actions():
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def export_raw(path, attributes=False, morph=False):
    """The mesh, the skin and the materials, no animation. Pictures stay PNG: build.mjs
    converts them. The materials are re-written there, so nothing is trusted from here."""
    armature().data.pose_position = "REST"
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_apply=False,
        export_morph=morph,
        export_morph_normal=False,
        export_skins=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_extras=False,
        export_attributes=attributes,
        export_vertex_color="ACTIVE",
    )
    return os.path.getsize(path)


def write_json(path, data):
    with open(path, "w", encoding="utf8") as handle:
        json.dump(data, handle, separators=(",", ":"))


def glb_space(vec):
    """A point of the armature's space (what the glTF file calls world) as a plain list."""
    return rounded(Vector(vec))


def bone_report(arm, names):
    """Names, parents and rest heads of bones, in glTF space. Written into the bake JSON."""
    rows = []
    for name in names:
        bone = arm.data.bones[name]
        rows.append(
            {
                "name": name,
                "parent": bone.parent.name if bone.parent else None,
                "head": glb_space(bone.head_local),
                "tail": glb_space(bone.tail_local),
                "length": round(bone.length, DIGITS),
            }
        )
    return rows


def probe_heads(deform, original_rest, names, frames, count=3):
    """Where the source clip puts every bone head at a few frames (armature space). The build
    checks the finished file against these numbers after it has been compressed and loaded
    back in a browser."""
    picks = sorted({0, frames // 2, frames - 1})
    out = {}
    for f in picks:
        out[str(f)] = {
            name: rounded((deform[name][f] @ original_rest[name]).to_translation()) for name in names
        }
    return out


def fk_heads(tracks, parent_of, bones, frame, heads):
    """Rebuild the posed head of each bone from node-local tracks (what a viewer does).

    tracks: from `local_tracks`. The head of a bone is the origin of its own node, so the
    posed head is the translation of the node's world matrix. Used to prove that a
    re-parented rig still puts every joint where the original clip put it.
    """
    world = {}
    out = {}
    for name in bones:  # parents come before children in `bones`
        row = tracks[name][frame * 10 : frame * 10 + 10]
        local = Matrix.LocRotScale(
            Vector(row[0:3]), Quaternion((row[6], row[3], row[4], row[5])), Vector(row[7:10])
        )
        parent = parent_of[name]
        world[name] = local if parent is None else world[parent] @ local
        out[name] = world[name].to_translation()
    return out


__all__ = [
    "PREFIX",
    "FPS",
    "options",
    "work_dir",
    "armature",
    "clear_animation",
    "bake_clip",
    "trs",
    "local_tracks",
    "rest_local",
    "prune_armature",
    "drop_objects_except",
    "drop_vertex_groups_except",
    "drop_actions",
    "export_raw",
    "write_json",
    "bone_report",
    "fk_heads",
    "probe_heads",
    "math",
    "Matrix",
    "Vector",
]
