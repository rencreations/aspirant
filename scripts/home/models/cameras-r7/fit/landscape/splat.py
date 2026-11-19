import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import numpy as np, math
from PIL import Image
from camlib import W, H
KEEP = ('body_01','body_02','body_03','head','hair_01','hair_02','eye','abyssal_devil_01','abyssal_devil_02')
COL = {'body_01':(40,40,70),'body_02':(60,60,60),'body_03':(80,80,120),'head':(240,180,160),'hair_01':(255,230,60),'hair_02':(255,160,120),'eye':(255,0,0),'abyssal_devil_01':(160,60,200),'abyssal_devil_02':(120,60,160)}
def load(clip, t=0):
    d = np.load(f'D:/ren/aspirant-work/home/CAM-landscape/mesh_{clip}_{t}.npz')
    names = [str(n).split('entrance_')[1] for n in d['names']]
    keep = np.array([names[o] in KEEP for o in d['obj']])
    col = np.array([COL.get(names[o], (255,255,255)) for o in d['obj']], dtype=np.uint8)
    return d['verts'][keep], col[keep], d
def render(v, col, C, R, vfov, shy=0.0, w=W, h=H, size=2, cxo=0.0):
    f = (h/2)/math.tan(math.radians(vfov)/2); cx = w/2 + cxo; cy = h/2 + shy*h
    pc = (v - C) @ R; z = -pc[:,2]; ok = z > 0.05
    u = cx + f*pc[:,0]/z; vv = cy - f*pc[:,1]/z
    img = np.zeros((h, w, 4), np.uint8); zb = np.full((h, w), 1e9)
    order = np.argsort(-z)
    for dx in range(-size//2, size//2+1):
        for dy in range(-size//2, size//2+1):
            ui = np.round(u).astype(int) + dx; vi = np.round(vv).astype(int) + dy
            m = ok & (ui>=0) & (ui<w) & (vi>=0) & (vi<h)
            idx = order[m[order]]
            img[vi[idx], ui[idx], :3] = col[idx]; img[vi[idx], ui[idx], 3] = 255
    return img
def overlay(rec, img, a=0.5):
    r = np.asarray(Image.open(rec).convert('RGB')).astype(float)
    m = (img[...,3:4] > 0)
    out = r.copy(); out = np.where(m, r*(1-a) + img[...,:3]*a, r)
    # edge hint: outline of splat in white
    return Image.fromarray(out.astype(np.uint8))
