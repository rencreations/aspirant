import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.optimize import least_squares
from PIL import Image
from scipy import ndimage as ndi
exec(open("skyfit_lib.py").read())
# landmarks: (video x,y at 960x432), (equirect x,y at 1774x887)
LM = json.load(open(sys.argv[1]))
W, H = 960, 432
def ray_from_eq(x, y):
    lon = (x / 1774 - 0.5) * 2 * math.pi; lat = (0.5 - y / 887) * math.pi
    return np.array([math.cos(lat) * math.sin(lon), math.sin(lat), -math.cos(lat) * math.cos(lon)])
Wd = np.array([ray_from_eq(*e) for v, e in LM])
V = np.array([v for v, e in LM], float)
def resid(p):
    yaw, pitch, roll, lnf, shx, shy = p
    R = rot(yaw, pitch, roll)
    ty = math.tan(math.radians(49.54) / 2) * math.exp(lnf); tx = ty * ASPECT
    out = []
    for w, (vx, vy) in zip(Wd, V):
        c = R.T @ w                         # world(sky) -> camera
        if c[2] >= -1e-3: out += [1e3, 1e3]; continue
        nx = c[0] / -c[2] / tx + shx; ny = c[1] / -c[2] / ty + shy
        px = (nx + 1) / 2 * W; py = (1 - ny) / 2 * H
        out += [px - vx, py - vy]
    return np.array(out)
best = None
rng = np.random.default_rng(1)
for _ in range(300):
    p0 = [rng.uniform(-3.1, 3.1), rng.uniform(-0.3, 1.0), rng.uniform(-0.8, 0.8), rng.normal(0.3, 0.3), 0.0, 0.0]
    try:
        r = least_squares(resid, p0, bounds=([-7, -1.5, -1.5, -0.6, -0.4, -0.4], [7, 1.5, 1.5, 1.2, 0.4, 0.4]))
    except Exception: continue
    if best is None or r.cost < best.cost: best = r
print("cost", best.cost, "rms px", math.sqrt(2 * best.cost / len(V) / 2), dict(zip(["yaw","pitch","roll","lnf","shx","shy"], np.round(best.x, 4))))
print(np.round(resid(best.x).reshape(-1, 2), 1).tolist())
json.dump(dict(zip(["yaw","pitch","roll","lnf","shx","shy"], [float(x) for x in best.x])), open(sys.argv[2], "w"))
