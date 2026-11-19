"""fit_J.json + sky landmarks -> fits.json for scripts/home/models/cameras-r7/ (and prints the checks)."""
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.optimize import least_squares
from fitlib import mat_from_cam
from skyfit_lib import rot, ASPECT
J = json.load(open("fit_J.json")); p = J["p"]
cams = json.load(open("cams_src.json"))
row = cams["cam_city_idle"][0]
B = mat_from_cam(row[:3], row[3:])
def local(d):
    L = np.eye(4); L[:3, :3] = mat_from_cam([0,0,0], d[3:6])[:3, :3]; L[:3, 3] = d[:3]; return L
d_idle = [p["tx"], p["ty"], p["tz"], p["rx"], p["ry"], p["rz"]]
vfov = J["V0"] * math.exp(p["lnf"]); shy = p["shy"]
M_idle = B @ local(d_idle)
rowP = cams["cam_city_interaction_R_loop"][0]
BP = mat_from_cam(rowP[:3], rowP[3:])
d_poseB = [p["tx"], p["ty"], p["tz"], p["rx"] + p["brx"], p["ry"] + p["bry"], p["rz"] + p["brz"]]
M_pose = B @ local(d_poseB)
T = np.array([[1,0,0],[0,0,1],[0,-1,0]], float)   # blender world -> gltf
def rw(M): return T @ M[:3, :3]
print("vfov", vfov, "shy", shy)
# sky landmarks: (video px at 960x432, equirect px at 1774x887)
LM = json.load(open(sys.argv[1]))     # {"idle": [...], "pose": [...]}
def ray_from_eq(x, y):
    lon = (x / 1774 - 0.5) * 2 * math.pi; lat = (0.5 - y / 887) * math.pi
    return np.array([math.cos(lat) * math.sin(lon), math.sin(lat), -math.cos(lat) * math.cos(lon)])
def solve(lms):
    ty = math.tan(math.radians(vfov) / 2); tx = ty * ASPECT
    Wd = np.array([ray_from_eq(*e) for v, e in lms]); V = np.array([v for v, e in lms], float)
    def resid(q):
        R = rot(*q)
        out = []
        for w, (vx, vy) in zip(Wd, V):
            c = R.T @ w
            if c[2] >= -1e-3: out += [1e3, 1e3]; continue
            nx = c[0] / -c[2] / tx; ny = c[1] / -c[2] / ty - shy * 0  # shift handled below
            # blender shift_y positive: optical axis below the frame centre by shy of the frame height
            px = (nx + 1) / 2 * 960; py = (1 - ny) / 2 * 432 + shy * 432
            out += [px - vx, py - vy]
        return np.array(out)
    best = None
    rng = np.random.default_rng(2)
    for _ in range(200):
        q0 = [rng.uniform(-3.1, 3.1), rng.uniform(-1.0, 1.0), rng.uniform(-0.8, 0.8)]
        r = least_squares(resid, q0)
        if best is None or r.cost < best.cost: best = r
    return rot(*best.x), math.sqrt(2 * best.cost / len(lms) / 2), resid(best.x)
res = {}
for name, M in (("idle", M_idle), ("pose", M_pose)):
    Rs, rms, r = solve(LM[name])
    S = Rs @ rw(M).T        # film -> sky lookup
    res[name] = S
    print(name, "rms px", round(rms, 1), "resid", np.round(r.reshape(-1, 2), 1).tolist())
ang = math.degrees(math.acos(max(-1, min(1, (np.trace(res["idle"].T @ res["pose"]) - 1) / 2))))
print("S idle vs pose differ by", round(ang, 2), "deg")
S = res["idle"]
json.dump({
  "idle": {"d": d_idle, "vfov": vfov, "shy": shy},
  "pose": {"sameWorldAs": "idle", "dFromIdle": d_poseB},
  "sky": [float(x) for x in S.ravel()],
  "fit": {"score": J["score"], "phiA": p["phiA"], "phiB": p["phiB"]},
}, open("fits_out.json", "w"), indent=1)
print("wrote fits_out.json")
