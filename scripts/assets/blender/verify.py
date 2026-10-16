"""Load a GLB back into Blender, print counts and render preview PNGs (Workbench, textured).

Run:  blender --background --python verify.py -- <glb> <out_prefix> [size=640]
Writes <out_prefix>-front.png and <out_prefix>-side.png.
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
glb, prefix = argv[:2]
size = int(argv[2]) if len(argv) > 2 else 640

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
verts = sum(len(o.data.vertices) for o in meshes)
tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
mats = {m.name for o in meshes for m in o.data.materials if m}
imgs = {i.name: tuple(i.size) for i in bpy.data.images if i.size[0]}
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for o in meshes:
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        lo = Vector((min(lo[i], w[i]) for i in range(3)))
        hi = Vector((max(hi[i], w[i]) for i in range(3)))
print("VERIFY meshes", len(meshes), "verts", verts, "tris", tris, "materials", len(mats), "images", imgs)
print("VERIFY bbox (blender z-up)", tuple(round(c, 3) for c in lo), tuple(round(c, 3) for c in hi))
untextured = []
for m in mats:
    mat = bpy.data.materials[m]
    if not any(n.type == "TEX_IMAGE" and n.image for n in mat.node_tree.nodes):
        untextured.append(m)
print("VERIFY untextured materials:", untextured)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "FLAT"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x = size
scene.render.resolution_y = size
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("w")
scene.world.color = (0.18, 0.18, 0.22)

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
span = max(hi.z - lo.z, hi.x - lo.x, hi.y - lo.y) * 1.1
cam_data.ortho_scale = span
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
centre = (lo + hi) / 2
for tag, az in (("front", 0), ("side", 90)):
    # glTF front is +Z = -Y in Blender, so the front camera sits at -Y looking +Y.
    d = 12
    cam.location = centre + Vector((math.sin(math.radians(az)) * d, -math.cos(math.radians(az)) * d, 0))
    cam.rotation_euler = (math.radians(90), 0, math.radians(az))
    scene.render.filepath = f"{prefix}-{tag}.png"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", scene.render.filepath)
