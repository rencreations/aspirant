import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import cv2, numpy as np, json
SRC = open("warpfit2.py").read(); MARK = chr(10) + "rng = np.random"
exec(SRC.split(MARK)[0])
sky = cv2.imread('D:/ren/aspirant-work/home/SEL-camera-sky/w/skybox.png')
fitsp = 'D:/aspirant/scripts/home/models/cameras-r7/fits.json'
poly = json.load(open(fitsp))['skyPoly']; cx, cy = np.array(poly[:10]), np.array(poly[10:])
gx, gy = np.meshgrid(np.arange(1920, dtype=np.float32), np.arange(864, dtype=np.float32)); GP = np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float64); FG = feats(GP, 3)
def warp_with(cx, cy):
    mx = (FG @ cx).reshape(864, 1920).astype(np.float32); my = (FG @ cy).reshape(864, 1920).astype(np.float32)
    return cv2.remap(sky, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE), mx, my
fr = {n: cv2.imread(f'f/r_{n}.png') for n in ['0.0','20.0','36.0','43.0','2.7']}
f32 = {n: v.astype(np.float32) for n, v in fr.items()}
# background mask: where pose differs from every idle frame little (character absent in both)
def mask_pair(n_a, n_b, th=16):
    d = np.abs(f32[n_a] - f32[n_b]).max(2); return (d < th).astype(np.uint8)
bgm = (mask_pair('20.0','0.0') & mask_pair('20.0','36.0') & mask_pair('20.0','43.0')); bgm = cv2.erode(bgm, np.ones((7,7), np.uint8)); print('bg frac', bgm.mean().round(2))
rec = cv2.cvtColor(fr['20.0'], cv2.COLOR_BGR2GRAY).astype(np.float32); rec = cv2.GaussianBlur(rec, (0,0), 2.0)
# SIFT inlier data (fixed)
for it in range(3):
    w, mx, my = warp_with(cx, cy)
    cur = cv2.GaussianBlur(cv2.cvtColor(w, cv2.COLOR_BGR2GRAY).astype(np.float32), (0,0), 2.0)
    flow = cv2.calcOpticalFlowFarneback(cur, rec, None, 0.5, 5, 41, 5, 7, 1.5, 0)
    pts = []
    for y in range(10, 864, 16):
        for x in range(10, 1920, 16):
            if bgm[y, x]:
                fx, fy = flow[y, x]
                if abs(fx) < 80 and abs(fy) < 80: pts.append((x+fx, y+fy, mx[y, x], my[y, x], np.hypot(fx, fy)))
    pts = np.array(pts)
    print('iter', it, 'samples', len(pts), 'median |flow|', np.median(pts[:,4]).round(2), 'p90', np.percentile(pts[:,4], 90).round(1))
    Pf = pts[:, :2]; Qf = pts[:, 2:4]
    Pall = np.vstack([Pi, Pf]); Qall = np.vstack([Qi, Qf])
    C = fit2(Pall, Qall, 3, 0.02, 0.0)
    cx, cy = C[:, 0], C[:, 1]
# validate on the idle frame: flow between current warp and the idle frame in the background mask of idle vs 36/43
w, mx, my = warp_with(cx, cy)
cur = cv2.GaussianBlur(cv2.cvtColor(w, cv2.COLOR_BGR2GRAY).astype(np.float32), (0,0), 2.0)
idl = cv2.GaussianBlur(cv2.cvtColor(fr['0.0'], cv2.COLOR_BGR2GRAY).astype(np.float32), (0,0), 2.0)
fl = cv2.calcOpticalFlowFarneback(cur, idl, None, 0.5, 5, 41, 5, 7, 1.5, 0)
m2 = (mask_pair('0.0','36.0') & mask_pair('0.0','43.0') & mask_pair('0.0','2.7')); m2 = cv2.erode(m2, np.ones((7,7), np.uint8))
mag = np.hypot(fl[...,0], fl[...,1])[m2 > 0]; print('validation on idle frame (bg px', int(m2.sum()), '): median |flow|', np.median(mag).round(2), 'p75', np.percentile(mag, 75).round(1), 'p90', np.percentile(mag, 90).round(1))
poly2 = [round(float(v), 4) for v in cx] + [round(float(v), 4) for v in cy]
json.dump(poly2, open('poly_flow.json', 'w'))
cv2.imwrite('warp_poly2.png', cv2.resize(w, None, fx=0.5, fy=0.5))
print(poly2)
