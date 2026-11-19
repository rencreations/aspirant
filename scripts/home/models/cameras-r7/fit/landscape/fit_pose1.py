import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import json
from solve import *
d = np.load('mesh_city_interaction_R_loop_0.npz'); v = d['verts']; grp = d['grp']; gn = list(d['gnames']); names = [str(n).split('entrance_')[1] for n in d['names']]
bn = [str(x) for x in d['bnames']]; bp = d['bpos']; B = lambda n: bp[bn.index(n)]
use = np.array([names[o] in ('body_01','body_02','body_03') for o in d['obj']])
def tip(side, fi):
    wr = B(f'Bip001 {side} Hand'); cand = [i for i,g in enumerate(gn) if g.startswith(f'Bip001 {side} Finger{fi}')]
    m = use & np.isin(grp, cand); vv = v[m]; return vv[np.argmax(np.linalg.norm(vv-wr, axis=1))]
L = [('eyeR', B('Bone01_Eye_R_02'), (1065,337)), ('eyeL', B('Bone01_Eye_L_02'), (1162,367)),
     ('Rt0', tip('R',0), (428,405)), ('Rt1', tip('R',1), (362,270)), ('Rt2', tip('R',2), (390,222)), ('Rt3', tip('R',3), (454,207)), ('Rt4', tip('R',4), (512,228))]
P = np.array([l[1] for l in L]); uv = np.array([l[2] for l in L], float)
for fv, rms, C, R, err in scan(P, uv, range(20, 121, 10)):
    print(fv, round(rms,1), C.round(2))
fv, rms, C, R, err = [r for r in scan(P, uv, [60])][0]
print(C.tolist(), Rot.from_matrix(R).as_rotvec().tolist(), err.round(1))
json.dump({'C': C.tolist(), 'rv': Rot.from_matrix(R).as_rotvec().tolist()}, open('cur_pose.json','w'))
