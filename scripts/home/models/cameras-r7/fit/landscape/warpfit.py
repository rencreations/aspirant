import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import cv2, numpy as np, json
from scipy.optimize import least_squares
d = np.load('matches.npz'); P = d['P'].astype(np.float64); Q = d['Q'].astype(np.float64)
A0, m = cv2.estimateAffine2D(P.astype(np.float32), Q.astype(np.float32), method=cv2.RANSAC, ransacReprojThreshold=14, maxIters=50000, confidence=0.9999)
e0 = np.linalg.norm(P @ A0[:, :2].T + A0[:, 2] - Q, axis=1); inl = e0 < 18
Pi, Qi = P[inl], Q[inl]; print('inliers', inl.sum(), 'x-range', np.percentile(Pi[:,0],[5,25,50,75,95]).round(0), 'y', np.percentile(Pi[:,1],[5,50,95]).round(0))
def feats(P, deg):
    x = (P[:,0]-960)/960; y = (P[:,1]-432)/432
    cols = [np.ones_like(x), x, y]
    if deg >= 2: cols += [x*x, x*y, y*y]
    if deg >= 3: cols += [x**3, x*x*y, x*y*y, y**3]
    return np.stack(cols, 1)
def fit(P, Q, deg):
    F = feats(P, deg); w = np.ones(len(P))
    for _ in range(6):
        C, *_ = np.linalg.lstsq(F*w[:,None], Q*w[:,None], rcond=None)
        e = np.linalg.norm(F@C - Q, axis=1); w = 1/np.sqrt(1 + (e/6)**2)
    return C
rng = np.random.default_rng(0)
for deg in (1, 2, 3):
    errs = []
    for rep in range(20):
        idx = rng.permutation(len(Pi)); a, b = idx[:len(idx)//2], idx[len(idx)//2:]
        C = fit(Pi[a], Qi[a], deg); e = np.linalg.norm(feats(Pi[b], deg)@C - Qi[b], axis=1); errs.append(np.median(e))
    C = fit(Pi, Qi, deg); e = np.linalg.norm(feats(Pi, deg)@C - Qi, axis=1)
    # error by x third
    xs = Pi[:,0]; print('deg', deg, 'holdout median', np.mean(errs).round(2), 'train median', np.median(e).round(2), 'by x-third', [np.median(e[(xs>=a)&(xs<b)]).round(1) if ((xs>=a)&(xs<b)).any() else None for a,b in ((0,640),(640,1280),(1280,1921))])
    json.dump({'deg': deg, 'C': C.tolist()}, open(f'warp_deg{deg}.json','w'))
