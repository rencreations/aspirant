import math, numpy as np
from PIL import Image
from scipy import ndimage as ndi
ASPECT = 3840 / 1728
def rot(yaw, pitch, roll):
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz
_sky = None
def sky_img():
    global _sky
    if _sky is None:
        a = np.asarray(Image.open("w/skybox.png").convert("RGB").resize((887, 443), Image.LANCZOS), dtype=np.float32) / 255.0
        _sky = a
    return _sky
def render_sky(p, SW=480, SH=216):
    sky = sky_img()
    yaw, pitch, roll, lnf, shx, shy = p
    ys, xs = np.mgrid[0:SH, 0:SW]
    nx = ((xs + 0.5) / SW * 2 - 1).astype(np.float64).ravel(); ny = (1 - (ys + 0.5) / SH * 2).astype(np.float64).ravel()
    ty = math.tan(math.radians(49.54) / 2) * math.exp(lnf); tx = ty * ASPECT
    d = np.stack([(nx - shx) * tx, (ny - shy) * ty, -np.ones_like(nx)], 0); d /= np.linalg.norm(d, axis=0)
    w = rot(yaw, pitch, roll) @ d
    lon = np.arctan2(w[0], -w[2]); lat = np.arcsin(np.clip(w[1], -1, 1))
    u = (0.5 + lon / (2*math.pi)) * sky.shape[1] - 0.5; v = (0.5 - lat / math.pi) * sky.shape[0] - 0.5
    img = np.stack([ndi.map_coordinates(sky[..., c], [v, u], order=1, mode="nearest") for c in range(3)], -1)
    return img.reshape(SH, SW, 3)
