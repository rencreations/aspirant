import bpy, math, json, numpy as np
P = "selena_silverbolt_raiko_entrance_"
arm = bpy.data.objects[P + "armature"]
arm.animation_data_create()
sc = bpy.context.scene
OUT = "D:/ren/aspirant-work/home/CAM-landscape/mesh_%s_%s.npz"
def to_gltf(v):
    return np.array([v[0], v[2], -v[1]])
print("armature world", [list(r) for r in arm.matrix_world])
jobs = [("city_idle", 0.0), ("city_idle", 1.0), ("city_interaction_R_loop", 0.0), ("city_interaction_R_loop", 1.0)]
for clip, t in jobs:
    act = bpy.data.actions[P + clip]
    arm.animation_data.action = act
    if act.slots: arm.animation_data.action_slot = act.slots[0]
    f = 1.0 + t * 24.0
    sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    verts, grp, obj_id, names = [], [], [], []
    gnames = []
    for oi, ob in enumerate(bpy.data.objects):
        if ob.type != 'MESH': continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        names.append(ob.name)
        vg = [g.name for g in ob.vertex_groups]
        for v in me.vertices:
            w = mw @ v.co
            verts.append(to_gltf(w))
            best, bw = -1, 0.0
            for g in v.groups:
                if g.weight > bw: bw, best = g.weight, g.group
            gi = -1
            if best >= 0:
                nm = vg[best]
                if nm not in gnames: gnames.append(nm)
                gi = gnames.index(nm)
            grp.append(gi); obj_id.append(len(names) - 1)
        ev.to_mesh_clear()
    bones = {pb.name: to_gltf(arm.matrix_world @ pb.head) for pb in arm.pose.bones}
    np.savez(OUT % (clip, int(t)), verts=np.array(verts), grp=np.array(grp), obj=np.array(obj_id), names=np.array(names), gnames=np.array(gnames), bnames=np.array(list(bones)), bpos=np.array(list(bones.values())))
    print("dumped", clip, t, len(verts))
print("DONE")
