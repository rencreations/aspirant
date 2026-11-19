import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import cv2, numpy as np, json, math
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as Rot
SW, SH = 1774, 887
sky = cv2.imread('D:/ren/aspirant-work/home/SEL-camera-sky/w/skybox.png')
sift = cv2.SIFT_create(nfeatures=12000, contrastThreshold=0.02)
ks, ds = sift.detectAndCompute(cv2.cvtColor(sky, cv2.COLOR_BGR2GRAY), None)
pts_r, pts_s = [], []
for rec in ['f/r_20.0.png', 'f/r_0.0.png', 'f/r_36.0.png', 'f/r_43.0.png', 'f/r_2.7.png']:
    r = cv2.imread(rec); kr, dr = sift.detectAndCompute(cv2.cvtColor(r, cv2.COLOR_BGR2GRAY), None)
    m = cv2.BFMatcher().knnMatch(dr, ds, k=2)
    for a, b in m:
        if a.distance < 0.85*b.distance:
            pts_r.append(kr[a.queryIdx].pt); pts_s.append(ks[a.trainIdx].pt)
pts_r = np.array(pts_r); pts_s = np.array(pts_s); print('matches', len(pts_r))
j = json.load(open('joint.json')); Rc = np.array(j['R'])   # camera->world (glTF her space)
W_, H_ = 1920, 864
def rays(k, uv, f0=(H_/2)/math.tan(math.radians(30))):
    x = (uv[:,0]-W_/2)/f0*k; y = -(uv[:,1]-H_/2)/f0*k; d = np.stack([x, y, -np.ones(len(uv))], 1)
    return d/np.linalg.norm(d, axis=1, keepdims=True)
def to_sky(S, d_world):
    s = d_world @ S.T
    lon = np.arctan2(s[:,0], -s[:,2]); lat = np.arcsin(np.clip(s[:,1], -1, 1))
    return np.stack([(0.5+lon/(2*np.pi))*SW, (0.5-lat/np.pi)*SH], 1)
def resid(x, pr, ps):
    S = Rot.from_rotvec(x[:3]).as_matrix(); k = x[3]
    dw = rays(k, pr) @ Rc.T
    q = to_sky(S, dw); d = q - ps
    d[:,0] = (d[:,0] + SW/2) % SW - SW/2
    return d.ravel()
rng = np.random.default_rng(0); best = None
for it in range(400):
    x0 = np.concatenate([Rot.random(random_state=int(rng.integers(1e9))).as_rotvec(), [rng.uniform(1.0, 2.6)]])
    try: r = least_squares(resid, x0, args=(pts_r, pts_s), loss='cauchy', f_scale=12, max_nfev=60)
    except Exception: continue
    e = np.linalg.norm(resid(r.x, pts_r, pts_s).reshape(-1,2), axis=1); n = int((e < 14).sum())
    if best is None or n > best[0]: best = (n, r.x, np.median(e)); print(it, n, r.x.round(3), np.median(e).round(1))
x = best[1]
# refine on inliers
for _ in range(3):
    e = np.linalg.norm(resid(x, pts_r, pts_s).reshape(-1,2), axis=1); m = e < 14
    r = least_squares(resid, x, args=(pts_r[m], pts_s[m]), loss='soft_l1', f_scale=6); x = r.x
e = np.linalg.norm(resid(x, pts_r, pts_s).reshape(-1,2), axis=1); print('final inliers(<14)', int((e<14).sum()), 'of', len(e), 'median in', np.median(e[e<14]).round(2), x.tolist())
json.dump({'rotvec': x[:3].tolist(), 'k': float(x[3]), 'S': Rot.from_rotvec(x[:3]).as_matrix().tolist(), 'inl': int((e<14).sum()), 'n': len(e)}, open('skyfit.json', 'w'))
