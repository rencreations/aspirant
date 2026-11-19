import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
from fixfit import *
import json
exec(open('fit_both.py').read().split("res = {}")[0].split("from fixfit import *")[1])
B2, d2 = mk('city_idle')
Li = [(B2('Bone01_Eye_R_02'), (1198,347)), (B2('Bone01_Eye_L_02'), (1288,408)), (B2('Bip001 R Hand'), (990,308))]
Pall = np.vstack([P, np.array([a for a,b in Li])]); uvall = np.vstack([uv, np.array([b for a,b in Li], float)])
wts = np.array([1.0]*len(P) + [1.6]*len(Li))
R, err = fit_rot(Pall, uvall, Cg, 60.0, 0.0, w=wts)
print('joint rms', np.sqrt((err**2).mean()).round(1), err.round(1))
rv = Rot.from_matrix(R).as_rotvec(); print('rotvec', rv.tolist())
# Blender matrix: rotation = Rx(+90) @ R_gltf, translation (gx, -gz, gy)
Rb = Rot.from_euler('x', 90, degrees=True).as_matrix() @ R
M = np.eye(4); M[:3,:3] = Rb; M[:3,3] = [Cg[0], -Cg[2], Cg[1]]
print(json.dumps([round(float(x),7) for x in M.flatten()]))
json.dump({'R': R.tolist(), 'M': M.flatten().tolist(), 'C': Cg.tolist(), 'rotvec': rv.tolist()}, open('joint.json','w'))
