import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
from fixfit import *
import json
def mk(clip):
    d = np.load(f'mesh_{clip}_0.npz'); bn = [str(x) for x in d['bnames']]; bp = d['bpos']
    return lambda n: bp[bn.index(n)], d
Cg = np.array([0.0, 1.1053, 0.9545])
# pose
B, d = mk('city_interaction_R_loop'); v = d['verts']; grp = d['grp']; gn = list(d['gnames']); names = [str(n).split('entrance_')[1] for n in d['names']]
use = np.array([names[o] in ('body_01','body_02','body_03') for o in d['obj']])
def tip(side, fi):
    wr = B(f'Bip001 {side} Hand'); cand = [i for i,g in enumerate(gn) if g.startswith(f'Bip001 {side} Finger{fi}')]
    m = use & np.isin(grp, cand); vv = v[m]; return vv[np.argmax(np.linalg.norm(vv-wr, axis=1))]
Lp = [(B('Bone01_Eye_R_02'), (1065,337)), (B('Bone01_Eye_L_02'), (1162,367))] + [(tip('R',i), p) for i,p in zip(range(5), [(428,405),(362,270),(390,222),(454,207),(512,228)])]
P = np.array([a for a,b in Lp]); uv = np.array([b for a,b in Lp], float)
res = {}
for fv in np.arange(56, 64.1, 1):
    for shy in (-0.03, 0.0, 0.03):
        R, err = fit_rot(P, uv, Cg, fv, shy)
        res[(fv,shy)] = float(np.sqrt((err**2).mean()))
best = min(res, key=res.get); print('pose best', best, res[best], {k: round(v,1) for k,v in res.items() if k[1]==0.0})
fvp, shyp = best
R, err = fit_rot(P, uv, Cg, 60, 0.0); print('pose 60/0', err.round(1), Rot.from_matrix(R).as_rotvec())
json.dump({'pose': {'C': Cg.tolist(), 'R': R.tolist(), 'vfov': 60, 'shy': 0.0}}, open('fit_cur.json','w'))
# idle
B2, d2 = mk('city_idle')
Li = [(B2('Bone01_Eye_R_02'), (1198,347)), (B2('Bone01_Eye_L_02'), (1288,408)), (B2('Bip001 R Hand'), (990,308))]
P2 = np.array([a for a,b in Li]); uv2 = np.array([b for a,b in Li], float)
for fv in (56,58,60,62,64):
    R2, e2 = fit_rot(P2, uv2, Cg, fv); print('idle', fv, e2.round(1))
R2, e2 = fit_rot(P2, uv2, Cg, 60); print(Rot.from_matrix(R2).as_rotvec())
cur = json.load(open('fit_cur.json')); cur['idle'] = {'C': Cg.tolist(), 'R': R2.tolist(), 'vfov': 60, 'shy': 0.0}; json.dump(cur, open('fit_cur.json','w'))
