import subprocess, json, os, time, math, glob, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import feature

BL = r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
BLEND = r"D:\ren\aspirant\3d\selena_silverbolt_raiko\selena_silverbolt_raiko\entrance\selena_silverbolt_raiko_entrance.blend"
HERE = os.path.dirname(os.path.abspath(__file__))
VID = r"D:\ren\aspirant\media\_others\in-game-animation\selena"
W, H = 960, 432

class Server:
    def __init__(self, name="a"):
        self.q = os.path.join(HERE, "q_" + name); self.o = os.path.join(HERE, "o_" + name)
        os.makedirs(self.q, exist_ok=True); os.makedirs(self.o, exist_ok=True)
        for f in glob.glob(self.q + "/*"): os.remove(f)
        self.log = open(os.path.join(HERE, "server_%s.log" % name), "w")
        self.p = subprocess.Popen([BL, "-b", BLEND, "--python", os.path.join(HERE, "blender", "server.py"), "--", "--queue", self.q, "--out", self.o],
                                  stdout=self.log, stderr=subprocess.STDOUT)
        self.n = 0
        t0 = time.time()
        while "SERVER READY" not in open(os.path.join(HERE, "server_%s.log" % name), errors="ignore").read():
            time.sleep(0.3)
            if time.time() - t0 > 90: raise RuntimeError("blender did not start")
    def render(self, jobs):
        """jobs: list of dicts (id added). Returns list of RGBA float arrays (H,W,4)."""
        self.n += 1
        for i, j in enumerate(jobs): j["id"] = "r%d_%d" % (self.n, i)
        f = os.path.join(self.q, "%06d.json" % self.n)
        json.dump(jobs, open(f + ".tmp", "w")); os.replace(f + ".tmp", f)
        t0 = time.time()
        while not os.path.exists(f + ".done"):
            time.sleep(0.03)
            if time.time() - t0 > 300: raise RuntimeError("render timeout")
        out = []
        for j in jobs:
            p = os.path.join(self.o, j["id"] + ".png")
            out.append(np.asarray(Image.open(p).convert("RGBA"), dtype=np.float32) / 255.0)
            try: os.remove(p)
            except OSError: pass
        return out
    def close(self):
        open(os.path.join(self.q, "stop"), "w").close()
        try: self.p.wait(20)
        except Exception: self.p.kill()

def video_frame(name, t, w=W, h=H):
    p = os.path.join(HERE, "vf", "%s_%0.3f.png" % (name, t))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if not os.path.exists(p):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % t, "-i", os.path.join(VID, name + ".mkv"), "-frames:v", "1", "-vf", "scale=%d:%d" % (w, h), p], check=True)
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) / 255.0

def lum(a): return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114

class VideoRef:
    def __init__(self, img):
        self.img = img
        g = ndi.gaussian_filter(lum(img), 0.8)
        self.edges = feature.canny(g, sigma=1.3, low_threshold=0.04, high_threshold=0.1)
        self.dist = ndi.distance_transform_edt(~self.edges).astype(np.float32)

def render_edges(rgba):
    a = rgba[..., 3]
    mask = a > 0.5
    L = ndi.gaussian_filter(lum(rgba[..., :3]) * a, 0.8)
    e_tex = feature.canny(L, sigma=1.3, low_threshold=0.03, high_threshold=0.08)
    sil = mask & ~ndi.binary_erosion(mask, iterations=1)
    edges = e_tex | sil
    return edges, mask

def score(ref, rgba, maxd=25.0):
    edges, mask = render_edges(rgba)
    if edges.sum() < 50: return -1e3
    d1 = np.minimum(ref.dist[edges], maxd).mean()
    dil = ndi.binary_dilation(mask, iterations=6)
    ev = ref.edges & dil
    if ev.sum() < 20: return -1e3
    dr = ndi.distance_transform_edt(~edges).astype(np.float32)
    d2 = np.minimum(dr[ev], maxd).mean()
    return -(d1 + d2)

def mat_from_cam(loc, rot):
    from math import cos, sin
    rx, ry, rz = rot
    Rx = np.array([[1,0,0],[0,cos(rx),-sin(rx)],[0,sin(rx),cos(rx)]])
    Ry = np.array([[cos(ry),0,sin(ry)],[0,1,0],[-sin(ry),0,cos(ry)]])
    Rz = np.array([[cos(rz),-sin(rz),0],[sin(rz),cos(rz),0],[0,0,1]])
    R = Rz @ Ry @ Rx  # blender XYZ euler
    M = np.eye(4); M[:3,:3] = R; M[:3,3] = loc
    return M

def euler_xyz_to_mat(d):
    return mat_from_cam([0,0,0], d)[:3,:3]

def cem(server, targets, base, vfov0, gens=7, pop=56, elite=10, std0=None, init=None, log=print, fixed_t=False):
    """targets: list of dict(ref=VideoRef, clip=str, trange=(a,b) or t=float). base: 4x4 list (blender world).
    Params: dx dy dz rx ry rz lnf then one t per target with trange."""
    K = len(targets)
    free_t = [i for i, t in enumerate(targets) if "trange" in t]
    nd = 7 + len(free_t)
    mean = np.zeros(nd)
    std = np.array([0.45,0.45,0.6,0.12,0.12,0.08,0.3] + [ (targets[i]["trange"][1]-targets[i]["trange"][0])/3 for i in free_t])
    if std0 is not None: std = np.array(std0, dtype=float)
    for k, i in enumerate(free_t): mean[7+k] = 0.5*(targets[i]["trange"][0]+targets[i]["trange"][1])
    if init is not None: mean = np.array(init, dtype=float)
    rng = np.random.default_rng(1)
    best = (-1e9, None)
    for g in range(gens):
        P = mean + std * rng.standard_normal((pop, nd))
        P[0] = mean
        jobs = []
        for p in P:
            for ti, t in enumerate(targets):
                tt = t["t"] if "t" in t else float(np.clip(p[7+free_t.index(ti)], t["trange"][0], t["trange"][1]))
                jobs.append({"clip": t["clip"], "t": tt, "base": [list(r) for r in base], "d": list(map(float, p[:6])),
                             "vfov": float(vfov0 * math.exp(p[6])), "shift": t.get("shift", [0,0])})
        res = server.render(jobs)
        sc = np.zeros(pop)
        for pi in range(pop):
            s = 0
            for ti, t in enumerate(targets):
                s += score(t["ref"], res[pi*K+ti])
            sc[pi] = s / K
        order = np.argsort(-sc)
        if sc[order[0]] > best[0]: best = (sc[order[0]], P[order[0]].copy())
        el = P[order[:elite]]
        mean = el.mean(0); std = np.maximum(el.std(0), np.array([0.004,0.004,0.006,0.0008,0.0008,0.0006,0.004] + [0.01]*len(free_t))) * 1.15
        log("gen %d best %.3f mean-elite %.3f  p=%s" % (g, sc[order[0]], sc[order[:elite]].mean(), np.round(best[1],3)))
    return best, free_t

def cem2(server, targets, spec, build, gens=6, pop=40, elite=8, log=print, seed=1):
    """spec: list of (name, mean, std, floor). build(p: dict, target, tvals) -> job.
    Per-target time params are named 't0','t1'... in spec if the target has 'trange'."""
    names = [s[0] for s in spec]
    mean = np.array([s[1] for s in spec], float); std = np.array([s[2] for s in spec], float)
    floor = np.array([s[3] for s in spec], float)
    rng = np.random.default_rng(seed)
    K = len(targets); best = (-1e9, None)
    for g in range(gens):
        P = mean + std * rng.standard_normal((pop, len(spec)))
        P[0] = mean
        jobs = []
        for p in P:
            d = dict(zip(names, p))
            for ti, t in enumerate(targets):
                jobs.append(build(d, t, ti))
        res = server.render(jobs)
        sc = np.zeros(pop)
        for pi in range(pop):
            sc[pi] = np.mean([score(t["ref"], res[pi*K+ti]) for ti, t in enumerate(targets)])
        order = np.argsort(-sc)
        if sc[order[0]] > best[0]: best = (sc[order[0]], P[order[0]].copy())
        el = P[order[:elite]]
        mean = el.mean(0); std = np.maximum(el.std(0), floor) * 1.1
        log("gen %d best %.3f elite %.3f %s" % (g, sc[order[0]], sc[order[:elite]].mean(), dict(zip(names, np.round(best[1], 4)))))
    return best, dict(zip(names, best[1]))

def edge_overlay(vid, rgba, color=(1.0, 0.0, 0.6)):
    edges, mask = render_edges(rgba)
    sil = mask & ~ndi.binary_erosion(mask, iterations=1)
    out = vid.copy()
    sil2 = ndi.binary_dilation(sil, iterations=1)
    out[sil2] = color
    e2 = edges & ~sil
    out[e2] = (0.0, 1.0, 0.9)
    return out

class Multi:
    def __init__(self, n=4, tag="m"):
        self.s = [Server("%s%d" % (tag, i)) for i in range(n)]
    def render(self, jobs):
        from concurrent.futures import ThreadPoolExecutor
        n = len(self.s)
        chunks = [jobs[i::n] for i in range(n)]
        with ThreadPoolExecutor(n) as ex:
            outs = list(ex.map(lambda p: p[0].render(p[1]) if p[1] else [], zip(self.s, chunks)))
        res = [None] * len(jobs)
        for i in range(n):
            for j, r in enumerate(outs[i]): res[i + j * n] = r
        return res
    def close(self):
        for s in self.s: s.close()
