import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import numpy as np, json, math, cv2
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as Rot
exec(open('skyfit.py').read().split("pts_r, pts_s = [], []")[0].split("sift = ")[0].replace("import cv2, numpy as np, json, math",""))
SW, SH = 1774, 887; W_, H_ = 1920, 864
j = json.load(open('joint.json')); Rc = np.array(j['R'])
def rays(k, uv, f0=(H_/2)/math.tan(math.radians(30))):
    x = (uv[:,0]-W_/2)/f0*k; y = -(uv[:,1]-H_/2)/f0*k; d = np.stack([x, y, -np.ones(len(uv))], 1)
    return d/np.linalg.norm(d, axis=1, keepdims=True)
def to_sky(S, dw):
    s = dw @ S.T; lon = np.arctan2(s[:,0], -s[:,2]); lat = np.arcsin(np.clip(s[:,1], -1, 1))
    return np.stack([(0.5+lon/(2*np.pi))*SW, (0.5-lat/np.pi)*SH], 1)
pairs = json.load(open(sys.argv[1]))
pr = np.array([p[0] for p in pairs], float); ps = np.array([p[1] for p in pairs], float)
def resid(x):
    S = Rot.from_rotvec(x[:3]).as_matrix(); q = to_sky(S, rays(x[3], pr) @ Rc.T); d = q - ps; d[:,0] = (d[:,0]+SW/2) % SW - SW/2; return d.ravel()
rng = np.random.default_rng(0); best = None
for it in range(600):
    x0 = np.concatenate([Rot.random(random_state=int(rng.integers(1e9))).as_rotvec(), [rng.uniform(1.0, 3.0)]])
    try: r = least_squares(resid, x0, bounds=([-9,-9,-9,0.6],[9,9,9,3.5]), max_nfev=200)
    except Exception: continue
    if best is None or r.cost < best.cost: best = r
x = best.x; e = np.linalg.norm(resid(x).reshape(-1,2), axis=1)
print('k', x[3].round(3), 'rotvec', x[:3].round(4), 'err sky px', e.round(1), 'rms', np.sqrt((e**2).mean()).round(1))
json.dump({'rotvec': x[:3].tolist(), 'k': float(x[3]), 'S': Rot.from_rotvec(x[:3]).as_matrix().tolist()}, open(sys.argv[2], 'w'))
