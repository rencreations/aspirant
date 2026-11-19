import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import numpy as np, json, math
from scipy.spatial.transform import Rotation as Rot
j = json.load(open('joint.json')); R = np.array(j['R']); C = np.array(j['C'])
import re
txt = open('D:/aspirant/apps/web/src/features/home/actors/selena/constants.ts').read()
m = re.search(r'ANCHOR[^=]*=\s*\[?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)', txt)
A = np.array([float(m.group(i)) for i in (1,2,3)]) if m else np.array([-0.2, 0.9, -0.15]); print('anchor', A)
f = 324/math.tan(math.radians(30)); W, H = 1440, 648
def pr(P, C, R):
    pc = (P - C) @ R; return np.stack([W/2 + f*pc[:,0]/-pc[:,2], H/2 - f*pc[:,1]/-pc[:,2]], 1)
d = np.load('mesh_city_idle_0.npz'); bn = [str(x) for x in d['bnames']]; bp = d['bpos']
B = lambda n: bp[bn.index(n)]
pts = {'eye': B('Bone01_Eye_R_02'), 'Rhand': B('Bip001 R Hand'), 'Lfoot': B('Bip001 L Foot'), 'Rfoot': B('Bip001 R Foot'), 'head': B('Bip001 Head'), 'pelvis': B('Bip001 Pelvis')}
P = np.array(list(pts.values())); base = pr(P, C, R)
for nx, ny in ((-1,1),(1,1),(-1,-1),(1,-1)):
    yaw = -nx*math.radians(4); pitch = ny*math.radians(2)
    Ry = Rot.from_rotvec([0, yaw, 0]).as_matrix(); R1 = Ry @ R; C1 = A + Ry @ (C - A)
    ax = R1[:,0]; Rp = Rot.from_rotvec(ax*pitch).as_matrix(); R2 = Rp @ R1; C2 = A + Rp @ (C1 - A)
    sh = pr(P, C2, R2) - base
    print((nx, ny), {k: tuple(sh[i].round(1)) for i, k in enumerate(pts)})
