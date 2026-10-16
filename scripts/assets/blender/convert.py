"""Convert one OBJ/MTL character into a Y-up GLB (about 2 units tall, centred at the origin).

Run:  blender --background --python convert.py -- <obj> <tex_dir> <out.glb> <name> [max_tex=1024] [draco=1] [rot_z_deg=0]
"""
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
obj_path, tex_dir, out_path, name = argv[:4]
max_tex = int(argv[4]) if len(argv) > 4 else 1024
use_draco = (argv[5] != "0") if len(argv) > 5 else True
rot_z = float(argv[6]) if len(argv) > 6 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
# The source OBJs are Y-up: the default importer conversion (-Z forward, Y up) makes them Z-up in Blender.
bpy.ops.wm.obj_import(filepath=obj_path, forward_axis="NEGATIVE_Z", up_axis="Y")

# Split the single imported mesh by material so the web side can hide or move the weapon and the robot companion.
for ob in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]


def part_name(mat_name):
    if "jiqirenbiaoqing" in mat_name:
        return "robot_screen"
    if "jiqiren" in mat_name:
        return "robot"
    if "weapon" in mat_name or "wuqi" in mat_name:
        return "weapon"
    if "eye_hair_tooth" in mat_name:
        return "hair_eyes"
    if "_face_" in mat_name:
        return "face"
    if "_body_" in mat_name:
        return "body"
    return mat_name


for ob in meshes:
    ob.name = ob.data.name = part_name(ob.material_slots[0].material.name)
print("IMPORTED", len(meshes), "mesh objects:", sorted(o.name for o in meshes))


def texture_for_material(mat_name):
    """Find <tex_dir>/<material name>.png (the MTL names materials after their textures)."""
    for ext in (".png", ".jpg"):
        p = os.path.join(tex_dir, mat_name + ext)
        if os.path.exists(p):
            return p
    return None


# Rebuild every material as a clean Principled BSDF: base colour from the texture, no emission, matte.
used = set()
for ob in meshes:
    for slot in ob.material_slots:
        if slot.material:
            used.add(slot.material)
for mat in used:
    tex = texture_for_material(mat.name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    if tex:
        img = bpy.data.images.load(tex, check_existing=True)
        if max(img.size) > max_tex:
            s = max_tex / max(img.size)
            img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
        # The alpha channel of these game textures is a mask, not transparency: leave the material opaque.
        mat.blend_method = "OPAQUE"
        print("MATERIAL", mat.name, "->", os.path.basename(tex), img.size[:], "alpha_mode", img.alpha_mode)
    else:
        print("MATERIAL", mat.name, "has NO texture")

# Rotate about the vertical axis so the character faces -Y (glTF +Z after export), then normalise.
import math
from mathutils import Matrix

rot = Matrix.Rotation(math.radians(rot_z), 4, "Z")
bpy.ops.object.select_all(action="DESELECT")
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

CORE_KEYS = ("_body_", "eye_hair_tooth", "_face_")


def is_core(mat_name):
    return any(k in mat_name for k in CORE_KEYS)


def bounds(core_only):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob in meshes:
        me = ob.data
        for p in me.polygons:
            if core_only and not is_core(me.materials[p.material_index].name):
                continue
            for vi in p.vertices:
                w = rot @ (ob.matrix_world @ me.vertices[vi].co)
                lo = Vector((min(lo[i], w[i]) for i in range(3)))
                hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi


lo, hi = bounds(True)
print("CORE_BOUNDS_BEFORE", tuple(round(c, 3) for c in lo), tuple(round(c, 3) for c in hi))
scale = 2.0 / (hi.z - lo.z)
centre = (lo + hi) / 2
for ob in meshes:
    for v in ob.data.vertices:
        v.co = (rot @ v.co - centre) * scale
    ob.data.update()
rot = Matrix.Identity(4)
lo, hi = bounds(True)
print("CORE_BOUNDS_AFTER", tuple(round(c, 3) for c in lo), tuple(round(c, 3) for c in hi))
lo, hi = bounds(False)
print("ALL_BOUNDS_AFTER", tuple(round(c, 3) for c in lo), tuple(round(c, 3) for c in hi))

for ob in meshes:
    print("OBJECT", ob.name, "verts", len(ob.data.vertices), "materials", [m.name for m in ob.data.materials])

bpy.ops.object.select_all(action="SELECT")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
kwargs = dict(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_image_format="AUTO",
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_extras=False,
)
if use_draco:
    kwargs.update(
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
bpy.ops.export_scene.gltf(**kwargs)
print("EXPORTED", out_path, os.path.getsize(out_path), "bytes", "draco" if use_draco else "raw")
