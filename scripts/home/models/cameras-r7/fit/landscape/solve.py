import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import numpy as np, math
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as Rot
from camlib import W, H

def proj(P, C, R, f, cx, cy):
    pc = (P - C) @ R
    return np.stack([cx + f*pc[:,0]/(-pc[:,2]), cy - f*pc[:,1]/(-pc[:,2])], 1), -pc[:,2]

def solve_fov(P, uv, vfov, shy=0.0, cxo=0.0, starts=12, rng=None, weights=None, prior=None):
    f = (H/2)/math.tan(math.radians(vfov)/2); cx = W/2 + cxo; cy = H/2 + shy*H
    cen = P.mean(0); best = None
    rng = rng or np.random.default_rng(1)
    w = np.ones(len(P)) if weights is None else np.asarray(weights)
    def res(x):
        C = x[:3]; R = Rot.from_rotvec(x[3:6]).as_matrix()
        q, z = proj(P, C, R, f, cx, cy)
        r = ((q - uv) * w[:, None]).ravel()
        pen = np.maximum(0.05 - z, 0) * 1e4
        return np.concatenate([r, pen])
    for s in range(starts):
        # look at centroid from a random direction at ~1 m
        d = rng.normal(size=3); d[2] = abs(d[2]) + 0.5; d /= np.linalg.norm(d)
        dist = rng.uniform(0.6, 3.0)
        C0 = cen + d * dist
        zc = (cen - C0); zc /= np.linalg.norm(zc)   # camera looks along -z => z axis = -zc
        zax = -zc; up = np.array([0, 1, 0.0]); xax = np.cross(up, zax); xax /= np.linalg.norm(xax); yax = np.cross(zax, xax)
        R0 = np.stack([xax, yax, zax], 1)
        x0 = np.concatenate([C0, Rot.from_matrix(R0).as_rotvec()])
        try:
            r = least_squares(res, x0, method='lm', max_nfev=400)
        except Exception as e:
            continue
        if best is None or r.cost < best.cost: best = r
    C = best.x[:3]; R = Rot.from_rotvec(best.x[3:6]).as_matrix()
    q, z = proj(P, C, R, f, cx, cy)
    err = np.linalg.norm(q - uv, axis=1)
    return C, R, err, best.cost

def scan(P, uv, fovs=range(20, 121, 4), **kw):
    out = []
    for fv in fovs:
        C, R, err, cost = solve_fov(P, uv, fv, **kw)
        out.append((fv, float(np.sqrt((err**2).mean())), C, R, err))
    return out
