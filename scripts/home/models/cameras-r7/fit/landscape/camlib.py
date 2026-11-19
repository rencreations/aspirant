import json, math, numpy as np
from PIL import Image, ImageDraw, ImageFont
W, H = 1920, 864
ASPECT = 3840/1728
bones_all = json.load(open('D:/ren/aspirant-work/home/SEL-camera-sky/w/bones.json'))

def bone(clip, name, i=0):
    return np.array(bones_all[clip]['bones'][name][i])

def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def project(P, C, R, vfov, shy=0.0, w=W, h=H, cx=None):
    """glTF camera: looks -z. R rotates camera->world. returns (u,v,depth)."""
    P = np.atleast_2d(P)
    pc = (P - C) @ R   # R^T (P-C) as row vectors
    f = (h/2)/math.tan(math.radians(vfov)/2)
    cx_ = w/2 if cx is None else cx
    cy_ = h/2 + shy*h
    u = cx_ + f*pc[:,0]/(-pc[:,2])
    v = cy_ - f*pc[:,1]/(-pc[:,2])
    return np.stack([u, v, -pc[:,2]], 1)

def game_cam(clip):
    d = json.load(open('D:/aspirant/apps/web/public/models/home/cameras-r7.json'))
    k = d['clips'][clip]['keys'][:9]
    return np.array(k[:3]), qmat(k[3:7]), k[7], k[8]
