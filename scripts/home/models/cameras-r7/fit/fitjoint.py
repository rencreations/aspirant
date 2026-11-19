"""Fit one static camera to a loop segment of horizontal.mkv.
usage: fitseg.py name clip camclip loop vt1,vt2,.. out.json [video=horizontal]"""
import sys, json, math, time, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from fitlib import *
from concurrent.futures import ThreadPoolExecutor
name, out = sys.argv[1], sys.argv[2]
SEG = [("city_idle", 2.7, [1.0, 2.5, 4.0, 5.5, 7.0]), ("city_interaction_R_loop", 3.3333, [12.0, 14.0, 17.0, 21.0, 26.0])]
camclip = "cam_city_idle"
vts = [v for c, l, vs in SEG for v in vs]
clip = None; loop = None
video = "horizontal"
nsrv = int(sys.argv[3]) if len(sys.argv) > 3 else 6
cams = json.load(open("cams_src.json"))
row = cams[camclip][0]
base = mat_from_cam(row[:3], row[3:]).tolist()
V0 = 2*math.degrees(math.atan(0.8*math.tan(math.radians(61.9275/2))))
refs = [VideoRef(video_frame(video, vt)) for vt in vts]
vimg = [ndi.gaussian_filter(r.img, (3, 3, 0)) for r in refs]
K = len(refs)
srv = Multi(nsrv, name)
def color_loss(rgba, ti):
    a = rgba[..., 3]; m = ndi.binary_erosion(a > 0.5, iterations=2)
    if m.sum() < 200: return 1.0
    rb = ndi.gaussian_filter(rgba[..., :3] * a[..., None], (3, 3, 0)) / np.maximum(ndi.gaussian_filter(a, 3)[..., None], 1e-3)
    return float(np.abs(rb[m] - vimg[ti][m]).mean())
def tscore(rgba, ti):
    return score(refs[ti], rgba) - 30.0 * color_loss(rgba, ti)
def build(p):
    jobs = []
    for ti in range(K):
        si = 0 if ti < 5 else 1
        tt = (vts[ti] + p[8 + si]) % SEG[si][1]
        dd = [float(x) for x in p[:6]]
        if si == 1: dd[3] += float(p[10]); dd[4] += float(p[11]); dd[5] += float(p[12])
        jobs.append({"clip": SEG[si][0], "t": float(tt), "base": base, "d": dd, "vfov": float(V0 * math.exp(p[6])), "shift": [0.0, float(p[7])]})
    return jobs
def evaluate(P):
    out = []
    for c0 in range(0, len(P), 24):
        chunk = P[c0:c0+24]
        jobs = [j for p in chunk for j in build(p)]
        res = srv.render(jobs)
        def sc(i): return float(np.mean([tscore(res[i*K+ti], ti) for ti in range(K)]))
        with ThreadPoolExecutor(8) as ex: out += list(ex.map(sc, range(len(chunk))))
        del res
    return np.array(out)
rng = np.random.default_rng(3)
names = ["tx", "ty", "tz", "rx", "ry", "rz", "lnf", "shy", "phiA", "phiB", "brx", "bry", "brz"]
mean = np.array([0, 0, 0.0, 0, 0, 0, 0.4, 0.05, 1.35, 1.65, 0, 0, 0])
std = np.array([0.1, 0.1, 0.18, 0.2, 0.3, 0.15, 0.2, 0.1, 0.85, 1.05, 0.04, 0.08, 0.03])
t0 = time.time(); best = (-1e9, None)
for g, pop in enumerate([120] + [50]*6):
    P = mean + std * rng.standard_normal((pop, 13)); P[0] = mean
    if best[1] is not None: P[1] = best[1]
    P[:, 8] %= 2.7; P[:, 9] %= 3.3333
    sc = evaluate(P)
    order = np.argsort(-sc); el = P[order[:max(8, pop//10)]]
    if sc[order[0]] > best[0]: best = (sc[order[0]], P[order[0]].copy())
    mean = el.mean(0); std = np.maximum(el.std(0), np.array([0.01,0.01,0.015,0.003,0.003,0.002,0.01,0.004,0.03,0.03,0.003,0.003,0.003])) * 1.1
    print("gen %d best %.3f elite %.3f t=%.0fs %s" % (g, best[0], sc[order[:len(el)]].mean(), time.time()-t0, dict(zip(names, np.round(best[1], 3)))), flush=True)
json.dump({"score": best[0], "p": dict(zip(names, [float(x) for x in best[1]])), "base": base, "V0": V0, "vts": vts, "camclip": camclip}, open(out, "w"))
srv.close()
