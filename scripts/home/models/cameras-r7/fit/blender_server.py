"""Persistent Blender render server. Polls QUEUE for *.json job lists, renders workbench alpha PNGs at 960x432."""
import bpy, json, math, os, sys, time, glob
from mathutils import Euler, Matrix, Vector
PREFIX = "selena_silverbolt_raiko_entrance_"
argv = sys.argv[sys.argv.index("--")+1:]
opt = dict(zip(argv[0::2], argv[1::2]))
Q = opt["--queue"]; OUT = opt["--out"]
os.makedirs(Q, exist_ok=True); os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
W = int(opt.get("--w", 960)); H = int(opt.get("--h", 432))
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.display.shading.light = "FLAT"; sc.display.shading.color_type = "TEXTURE"
sc.display.shading.show_object_outline = False
sc.view_settings.view_transform = "Standard"
arm = bpy.data.objects[PREFIX+"armature"]; cam = bpy.data.objects[PREFIX+"camera"]
cam.data.sensor_fit = "VERTICAL"; cam.data.sensor_height = 36.0
cam.animation_data_clear()
sc.camera = cam
for o in bpy.data.objects:
    if o.type == "MESH":
        n = o.name.replace(PREFIX, "")
        o.hide_render = n in ("abyssal_form","abyssal_form_hair_01","abyssal_form_hair_02","accessory_01","accessory_02")
arm.data.pose_position = "POSE"; arm.animation_data_create()
cur = {"clip": None, "t": None}
def set_pose(clip, t):
    if cur["clip"] != clip:
        action = bpy.data.actions[PREFIX+clip]
        arm.animation_data.action = action
        if action.slots: arm.animation_data.action_slot = action.slots[0]
        cur["clip"] = clip; cur["t"] = None
    if cur["t"] != t:
        frame = 1.0 + t*24.0
        sc.frame_set(int(math.floor(frame)), subframe=frame-math.floor(frame))
        arm.update_tag(); bpy.context.view_layer.update()
        cur["t"] = t
def cam_pose(camclip, tc):
    action = bpy.data.actions[PREFIX+camclip]
    f = 1.0 + tc*30.0
    curves = {(c.data_path, c.array_index): c for c in action.fcurves}
    loc = [curves[("location",k)].evaluate(f) for k in range(3)]
    rot = [curves[("rotation_euler",k)].evaluate(f) for k in range(3)]
    return Matrix.LocRotScale(Vector(loc), Euler(rot, "XYZ").to_quaternion(), None)
print("SERVER READY", flush=True)
while True:
    if os.path.exists(os.path.join(Q, "stop")): break
    files = sorted(glob.glob(os.path.join(Q, "*.json")))
    if not files: time.sleep(0.05); continue
    for f in files:
        jobs = json.load(open(f))
        for job in jobs:
            set_pose(job["clip"], job["t"])
            if "base" in job:
                base = Matrix(job["base"])
            else:
                base = cam_pose(job["cam"], job["tc"])
            d = job.get("d", [0,0,0,0,0,0])
            local = Matrix.Translation(Vector(d[:3])) @ Euler(d[3:6], "XYZ").to_matrix().to_4x4()
            cam.matrix_world = base @ local
            vf = job["vfov"]
            cam.data.lens = 18.0/math.tan(math.radians(vf)/2.0)
            if "shift" in job:
                cam.data.shift_x, cam.data.shift_y = job["shift"]
            else:
                cam.data.shift_x = cam.data.shift_y = 0.0
            sc.render.filepath = os.path.join(OUT, job["id"]+".png")
            bpy.ops.render.render(write_still=True)
        os.rename(f, f+".done")
        print("DONE", f, flush=True)
