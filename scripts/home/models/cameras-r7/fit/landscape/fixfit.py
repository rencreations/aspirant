import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
from solve import *
def fit_rot(P, uv, C, vfov, shy=0.0, w=None, starts=30):
    f = (H/2)/math.tan(math.radians(vfov)/2); cx = W/2; cy = H/2 + shy*H
    w = np.ones(len(P)) if w is None else np.asarray(w)
    def res(x):
        R = Rot.from_rotvec(x).as_matrix(); q, z = proj(P, C, R, f, cx, cy); return ((q-uv)*w[:,None]).ravel()
    best = None; rng = np.random.default_rng(3)
    cen = P.mean(0)
    for s in range(starts):
        zc = (cen - C); zc /= np.linalg.norm(zc); zax = -zc; zax = zax + rng.normal(size=3)*0.15; zax /= np.linalg.norm(zax)
        xax = np.cross([0,1,0], zax); xax /= np.linalg.norm(xax); yax = np.cross(zax, xax)
        x0 = Rot.from_matrix(np.stack([xax,yax,zax],1)).as_rotvec()
        r = least_squares(res, x0, method='lm')
        if best is None or r.cost < best.cost: best = r
    R = Rot.from_rotvec(best.x).as_matrix(); q, z = proj(P, C, R, f, cx, cy)
    return R, np.linalg.norm(q-uv, axis=1)
