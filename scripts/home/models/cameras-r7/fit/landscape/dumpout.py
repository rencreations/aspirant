import bpy, math, numpy as np
P = "selena_silverbolt_raiko_entrance_"
arm = bpy.data.objects[P + "armature"]; arm.animation_data_create(); sc = bpy.context.scene
act = bpy.data.actions[P + "city_intercation02"]; arm.animation_data.action = act
if act.slots: arm.animation_data.action_slot = act.slots[0]
print("RANGE", act.frame_range)
KEEP = ('body_01','body_02','body_03','head','hair_01','hair_02','abyssal_devil_01','abyssal_devil_02')
out = {}
t = 0.0
dur = (act.frame_range[1] - act.frame_range[0]) / 24.0
while t <= dur + 1e-6:
    f = act.frame_range[0] + t * 24.0
    sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f)); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); pts = []
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or ob.name.split('entrance_')[-1] not in KEEP: continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); mw = ev.matrix_world
        a = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', a); a = a.reshape(-1, 3)
        w = np.array(mw)[:3, :3] @ a.T + np.array(mw)[:3, 3:4]
        pts.append(np.stack([w[0], w[2], -w[1]], 1)); ev.to_mesh_clear()
    out['%.2f' % t] = np.vstack(pts)
    t += 0.2
np.savez('D:/ren/aspirant-work/home/CAM-landscape/mesh_out.npz', **out)
print("DONE", dur, len(out))
