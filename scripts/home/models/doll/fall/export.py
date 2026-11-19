# Reads Falling.fbx in Blender and writes, for each frame, the armature-space rotation and head position
# of the 22 bones that map to the doll, plus the bind pose. Armature space of this import is the FBX's
# own space: +Y up, +Z forward, +X her left, which is also the doll's model space.
import bpy, json, sys
args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
src = args[1] if len(args) > 1 else r"C:\Users\muham\Downloads\Falling.fbx"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
arm = [o for o in bpy.data.objects if o.type=='ARMATURE'][0]
MAP = {
 "Hips":"mixamorig:Hips","Spine02":"mixamorig:Spine","Spine01":"mixamorig:Spine1","Spine":"mixamorig:Spine2",
 "neck":"mixamorig:Neck","Head":"mixamorig:Head",
 "LeftShoulder":"mixamorig:LeftShoulder","LeftArm":"mixamorig:LeftArm","LeftForeArm":"mixamorig:LeftForeArm","LeftHand":"mixamorig:LeftHand",
 "RightShoulder":"mixamorig:RightShoulder","RightArm":"mixamorig:RightArm","RightForeArm":"mixamorig:RightForeArm","RightHand":"mixamorig:RightHand",
 "LeftUpLeg":"mixamorig:LeftUpLeg","LeftLeg":"mixamorig:LeftLeg","LeftFoot":"mixamorig:LeftFoot","LeftToeBase":"mixamorig:LeftToeBase",
 "RightUpLeg":"mixamorig:RightUpLeg","RightLeg":"mixamorig:RightLeg","RightFoot":"mixamorig:RightFoot","RightToeBase":"mixamorig:RightToeBase",
}
extra = ["mixamorig:HeadTop_End","mixamorig:LeftToe_End","mixamorig:RightToe_End","mixamorig:LeftHandMiddle1","mixamorig:RightHandMiddle1"]
bones = arm.data.bones
print("TOE", [b.name for b in bones if "Toe" in b.name])
act = arm.animation_data.action
f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
bind = {}
for dn, sn in MAP.items():
    b = bones[sn]
    q = b.matrix_local.to_quaternion()
    bind[dn] = {"q":[q.w,q.x,q.y,q.z], "p":list(b.matrix_local.translation), "src":sn}
for sn in extra:
    if sn in bones:
        bind[sn] = {"q":[1,0,0,0], "p":list(bones[sn].matrix_local.translation), "src":sn}
frames = []
sc = bpy.context.scene
for f in range(f0, f1+1):
    sc.frame_set(f)
    row = {}
    for dn, sn in list(MAP.items()) + [(e,e) for e in extra if e in bones]:
        pb = arm.pose.bones[sn]
        q = pb.matrix.to_quaternion()
        row[dn] = {"q":[q.w,q.x,q.y,q.z], "p":list(pb.matrix.translation)}
    frames.append(row)
json.dump({"fps":sc.render.fps, "f0":f0, "f1":f1, "bind":bind, "frames":frames}, open(out,"w"))
print("WROTE", out, len(frames))
