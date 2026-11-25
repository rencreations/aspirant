"""Fitting aid: the camera of one recording frame from our render of the same moment.

    python -I fit/pnp.py RENDER.png POSITIONS.bin VIDEO.png VFOV [fixed]

RENDER is our picture through a guess of the camera, POSITIONS the world position under each of
its pixels (Float32 x y z w, rows from the top, made by window.stage.positions). SIFT features of
the render and of the recording's frame are matched; every match gives a 3D point (from
POSITIONS) and the pixel it lands on in the recording, and the camera that makes them agree is
solved (RANSAC on the pose, then the pose and the focal length together on the inliers). The
principal point stays in the middle of the frame and the pixels are square, as in the game.
With `fixed` the field of view is held at VFOV (the game's lens does not change; a free focal
length trades with the distance and makes a moving camera jitter).

Prints JSON: ok, the camera in three's convention (p, q as x y z w, vfov in degrees over the
frame), the number of inliers and their residual in pixels of a frame 960 wide.
"""

import json
import math
import sys

import cv2
import numpy as np
from PIL import Image
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as R


def main():
    render_path, pos_path, video_path, vfov = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
    fixed = len(sys.argv) > 5 and sys.argv[5] == "fixed"
    ours = Image.open(render_path).convert("RGBA")
    w, h = ours.size
    pos = np.fromfile(pos_path, dtype=np.float32).reshape(h, w, 4)
    video = Image.open(video_path).convert("RGB").resize((w, h), Image.LANCZOS)
    og = cv2.cvtColor(np.asarray(ours.convert("RGB")), cv2.COLOR_RGB2GRAY)
    vg = cv2.cvtColor(np.asarray(video), cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    og = clahe.apply(og)
    vg = clahe.apply(vg)
    mask = (np.asarray(ours)[..., 3] > 127) & (pos[..., 3] > 0.5)
    mask = cv2.erode(mask.astype(np.uint8), np.ones((3, 3), np.uint8))
    sift = cv2.SIFT_create(nfeatures=6000, contrastThreshold=0.02)
    ko, do = sift.detectAndCompute(og, mask)
    kv, dv = sift.detectAndCompute(vg, None)
    if do is None or dv is None or len(ko) < 8:
        print(json.dumps({"ok": False, "why": "few features"}))
        return
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    pairs = matcher.knnMatch(do, dv, k=2)
    obj, img = [], []
    for m in pairs:
        if len(m) < 2 or m[0].distance > 0.8 * m[1].distance:
            continue
        x, y = ko[m[0].queryIdx].pt
        xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < w and 0 <= yi < h) or pos[yi, xi, 3] < 0.5:
            continue
        obj.append(pos[yi, xi, :3])
        img.append(kv[m[0].trainIdx].pt)
    obj = np.array(obj, dtype=np.float64)
    img = np.array(img, dtype=np.float64)
    if len(obj) < 12:
        print(json.dumps({"ok": False, "why": f"{len(obj)} matches"}))
        return

    def Kof(fov):
        f = (h / 2) / math.tan(math.radians(fov) / 2)
        return np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])

    best = None
    for fov in (vfov,) if fixed else (vfov, vfov - 6, vfov + 6):
        ok, rvec, tvec, inl = cv2.solvePnPRansac(obj, img, Kof(fov), None, iterationsCount=4000,
                                                 reprojectionError=6.0 * w / 960, confidence=0.999,
                                                 flags=cv2.SOLVEPNP_EPNP)
        if ok and inl is not None and (best is None or len(inl) > len(best[3])):
            best = (fov, rvec, tvec, inl)
    if best is None:
        print(json.dumps({"ok": False, "why": "ransac", "matches": len(obj)}))
        return
    fov, rvec, tvec, inl = best
    inl = inl.ravel()
    O, I = obj[inl], img[inl]

    def resid(x):
        rv, tv, fv = x[:3], x[3:6], (vfov if fixed else x[6])
        p, _ = cv2.projectPoints(O, rv, tv, Kof(fv), None)
        return (p.reshape(-1, 2) - I).ravel()

    x0 = np.concatenate([rvec.ravel(), tvec.ravel(), [fov]])
    fit = least_squares(resid, x0, loss="soft_l1", f_scale=3.0 * w / 960)
    # keep the inliers of the refined camera and fit once more
    err = np.linalg.norm(resid(fit.x).reshape(-1, 2), axis=1)
    keep = err < 6.0 * w / 960
    O, I = O[keep], I[keep]
    fit = least_squares(resid, fit.x, loss="soft_l1", f_scale=3.0 * w / 960)
    rv, tv, fv = fit.x[:3], fit.x[3:6], (vfov if fixed else fit.x[6])
    err = np.linalg.norm(resid(fit.x).reshape(-1, 2), axis=1)
    Rcv = R.from_rotvec(rv).as_matrix()
    position = -Rcv.T @ tv
    # OpenCV camera (x right, y down, z ahead) to three's (x right, y up, looking down -z)
    q = R.from_matrix(Rcv.T @ np.diag([1, -1, -1.0])).as_quat()
    print(json.dumps({
        "ok": bool(len(O) >= 12),
        "p": [round(float(v), 5) for v in position],
        "q": [round(float(v), 6) for v in q],
        "vfov": round(float(fv), 3),
        "matches": int(len(obj)),
        "inliers": int(len(O)),
        "rms960": round(float(np.sqrt(np.mean(err**2))) * 960 / w, 2),
    }))


if __name__ == "__main__":
    main()
