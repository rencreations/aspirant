import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import json, numpy as np
from camlib import qmat
d = json.load(open('D:/aspirant/apps/web/public/models/home/cameras-r7.json')); k = np.array(d['clips']['city_intercation02']['keys']).reshape(-1, 9)
m = np.load('mesh_out.npz'); worst = 9
for key in m.files:
    t = float(key); i = min(len(k)-1, int(round(t*30))); p = k[i,:3]; R = qmat(k[i,3:7]); fwd = -R[:,2]
    P = m[key]; v = P - p; dist = np.linalg.norm(v, axis=1); front = (v @ fwd) > 0
    # distance of nearest vertex that is in front of the camera (what could clip the near plane) and overall
    print(key, 'cam', p.round(2), 'nearest vertex', dist.min().round(3), 'nearest in front', dist[front].min().round(3) if front.any() else None)
    worst = min(worst, dist.min())
print('minimum over the clip', round(worst, 3), '(near plane 0.04 m)')
