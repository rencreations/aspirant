import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import numpy as np, json, cv2
exec(open('warpfit.py').read().split("rng = np.random")[0])
A = json.load(open('aff.json'))['A']; A = np.array(A)
gx, gy = np.meshgrid(np.linspace(0, 1920, 13), np.linspace(0, 864, 7)); G = np.stack([gx.ravel(), gy.ravel()], 1); GQ = G @ A[:, :2].T + A[:, 2]
def fit2(P, Q, deg, mu, ridge):
    F = feats(P, deg); Fg = feats(G, deg); w = np.ones(len(P))
    pen = np.diag([0,0,0] + [ridge]*(F.shape[1]-3)) if F.shape[1] > 3 else np.zeros((3,3))
    for _ in range(6):
        M = (F*w[:,None]).T @ F + mu*Fg.T @ Fg + pen*len(P)
        C = np.linalg.solve(M, (F*w[:,None]).T @ Q + mu*Fg.T @ GQ)
        e = np.linalg.norm(F@C - Q, axis=1); w = 1/np.sqrt(1 + (e/6)**2)
    return C
rng = np.random.default_rng(0)
for mu, ridge in ((0.02, 0.0), (0.1, 0.0), (0.3, 0.0), (0.1, 0.05), (0.3, 0.05)):
    errs = []
    for rep in range(15):
        idx = rng.permutation(len(Pi)); a, b = idx[:len(idx)//2], idx[len(idx)//2:]
        C = fit2(Pi[a], Qi[a], 3, mu, ridge); errs.append(np.median(np.linalg.norm(feats(Pi[b], 3)@C - Qi[b], axis=1)))
    C = fit2(Pi, Qi, 3, mu, ridge); dev = np.linalg.norm(feats(G, 3)@C - GQ, axis=1)
    print('mu', mu, 'ridge', ridge, 'holdout', np.mean(errs).round(2), 'max dev from affine over frame', dev.max().round(0), 'mean', dev.mean().round(0))
    json.dump({'C': C.tolist()}, open(f'warp3_{mu}_{ridge}.json','w'))
