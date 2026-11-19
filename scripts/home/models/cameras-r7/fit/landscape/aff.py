import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import cv2, numpy as np, json
from scipy.optimize import least_squares
d = np.load('matches.npz'); P = d['P'].astype(np.float64); Q = d['Q'].astype(np.float64)
A0, m = cv2.estimateAffine2D(P.astype(np.float32), Q.astype(np.float32), method=cv2.RANSAC, ransacReprojThreshold=12, maxIters=50000, confidence=0.9999)
def err(A, P, Q): return np.linalg.norm(P @ A[:, :2].T + A[:, 2] - Q, axis=1)
e = err(A0, P, Q); inl = e < 14; print('inl', inl.sum(), 'rms', np.sqrt((e[inl]**2).mean()))
def res(x, P, Q): return (P @ x.reshape(2,3)[:, :2].T + x.reshape(2,3)[:, 2] - Q).ravel()
x = A0.ravel()
for _ in range(4):
    e = err(x.reshape(2,3), P, Q); inl = e < 10
    r = least_squares(res, x, args=(P[inl], Q[inl]), loss='soft_l1', f_scale=4); x = r.x
A = x.reshape(2,3); e = err(A, P, Q); inl = e < 10; print('refined inl', inl.sum(), 'rms', np.sqrt((e[inl]**2).mean()).round(2), A.round(4).tolist())
# homography from the same inliers
H, mh = cv2.findHomography(P[inl].astype(np.float32), Q[inl].astype(np.float32), 0)
ph = np.c_[P, np.ones(len(P))] @ H.T; ph = ph[:, :2]/ph[:, 2:]; eh = np.linalg.norm(ph - Q, axis=1); print('homog on inliers rms', np.sqrt((eh[inl]**2).mean()).round(2), 'inl<10', int((eh<10).sum()))
json.dump({'A': A.tolist(), 'H': H.tolist()}, open('aff.json', 'w'))
sky = cv2.imread('D:/ren/aspirant-work/home/SEL-camera-sky/w/skybox.png')
Ai = cv2.invertAffineTransform(A.astype(np.float32))
outs = []
for rec in ['f/r_0.0.png', 'f/r_20.0.png', 'f/r_36.0.png']:
    r = cv2.imread(rec); w = cv2.warpAffine(sky, Ai, (1920, 864), flags=cv2.INTER_LINEAR)
    outs.append(np.vstack([r, w, cv2.addWeighted(r, 0.5, w, 0.5, 0)]))
cv2.imwrite('warp_aff_a.png', cv2.resize(np.hstack(outs[:2]), None, fx=0.4, fy=0.4))
cv2.imwrite('warp_aff_1.png', cv2.resize(outs[0], None, fx=0.5, fy=0.5))
