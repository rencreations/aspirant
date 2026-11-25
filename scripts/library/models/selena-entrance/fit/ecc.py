"""Fitting aid: the homography that lays our render on the recording (OpenCV's ECC, masked by our
silhouette), and the camera turn and lens that explain it.

    python -I fit/ecc.py OURS.png VIDEO.png VFOV [--affine]

A pure turn of the camera (and a change of the field of view) moves the picture by a homography,
whatever the depth, so when the camera's position is right the homography gives the correction:
H = K_v R K_o^-1 with K the pinhole of a frame 2.2222 wide. Prints the correlation, the shift of
the frame's middle in pixels of 960, and the turn (yaw, pitch, roll, degrees, in the camera's own
axes: + yaw turns the view to the left, + pitch up, + roll counter-clockwise) and the vertical
field of view that make our render land on the recording.
"""

import json
import math
import sys

import cv2
import numpy as np
from PIL import Image
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as R


def gray(path, w):
    im = Image.open(path).convert("RGBA")
    h = round(w / (3840 / 1728))
    im = im.resize((w, h), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32)
    g = cv2.cvtColor(a[..., :3].astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    return g, a[..., 3] / 255.0


def ecc(ours_path, video_path, motion=cv2.MOTION_HOMOGRAPHY, sizes=(240, 480, 960), init=None):
    warp = np.eye(3, dtype=np.float32) if init is None else init.astype(np.float32)
    last = sizes[0]
    cc = None
    for w in sizes:
        s = w / last
        warp = np.diag([s, s, 1]).astype(np.float32) @ warp @ np.diag([1 / s, 1 / s, 1]).astype(np.float32)
        last = w
        og, oa = gray(ours_path, w)
        vg, _ = gray(video_path, w)
        mask = (oa > 0.5).astype(np.uint8)
        mask = cv2.erode(mask, np.ones((3, 3), np.uint8))
        crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        if motion != cv2.MOTION_HOMOGRAPHY:
            w23 = warp[:2].copy()
            cc, w23 = cv2.findTransformECC(vg, og, w23, motion, crit, mask, 5)
            warp = np.vstack([w23, [0, 0, 1]]).astype(np.float32)
        else:
            cc, warp = cv2.findTransformECC(vg, og, warp, motion, crit, mask, 5)
    # warp maps video pixels to ours: ours(warp x) = video(x). H maps ours to video.
    H = np.linalg.inv(warp.astype(np.float64))
    return cc, H / H[2, 2], last


def turn_homography(yaw, pitch, roll, vfov, fov2, w):
    """The homography (ours to the recording) of a camera turned by (yaw, pitch, roll) whose field
    of view becomes fov2."""
    h = w / (3840 / 1728)
    F = np.diag([1, -1, -1.0])
    Rd = R.from_euler("YXZ", [yaw, pitch, roll], degrees=True).as_matrix()
    return K(fov2, w, h) @ F @ Rd.T @ F @ np.linalg.inv(K(vfov, w, h))


def ecc_wide(ours_path, video_path, vfov, yaws=(-24, -16, -8, 0, 8, 16, 24), pitches=(-12, -6, 0, 6, 12),
             rolls=(0,), scales=(1.0,)):
    """ECC from many starting turns (a wide basin for a camera that is far off): each start is run
    briefly at 240 pixels, the best is refined at 240 and 480."""
    w0 = 240
    og, oa = gray(ours_path, w0)
    vg, _ = gray(video_path, w0)
    mask = cv2.erode((oa > 0.5).astype(np.uint8), np.ones((3, 3), np.uint8))
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 1e-5)
    best = None
    for y in yaws:
        for p in pitches:
            for r in rolls:
                for sc in scales:
                    fov2 = math.degrees(2 * math.atan(math.tan(math.radians(vfov) / 2) / sc))
                    H0 = turn_homography(y, p, r, vfov, fov2, w0)
                    warp = np.linalg.inv(H0).astype(np.float32)
                    warp /= warp[2, 2]
                    try:
                        cc, warp = cv2.findTransformECC(vg, og, warp, cv2.MOTION_HOMOGRAPHY, crit, mask, 5)
                    except cv2.error:
                        continue
                    if best is None or cc > best[0]:
                        best = (cc, warp)
    if best is None:
        raise RuntimeError("no start converged")
    return ecc(ours_path, video_path, sizes=(240, 480), init=best[1])


def K(vfov, w, h):
    f = (h / 2) / math.tan(math.radians(vfov) / 2)
    return np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])


def explain(H, vfov, w):
    h = w / (3840 / 1728)
    Ko = K(vfov, w, h)
    # image y goes down: flip to camera axes (x right, y up, looking down -z)
    F = np.diag([1, -1, -1.0])
    grid = np.array([[x, y, 1.0] for x in np.linspace(0, w, 9) for y in np.linspace(0, h, 5)]).T
    target = H @ grid
    target = target[:2] / target[2]

    def model(p):
        yaw, pitch, roll, fov = p
        # The new camera is the old one turned by Rd (in the old camera's axes). A ray seen at
        # direction d in the old camera is seen at Rd^-1 d in the new one.
        Rd = R.from_euler("YXZ", [yaw, pitch, roll], degrees=True).as_matrix()
        Kv = K(fov, w, h)
        M = Kv @ F @ Rd.T @ F @ np.linalg.inv(Ko)
        q = M @ grid
        return (q[:2] / q[2] - target).ravel()

    fit = least_squares(model, [0, 0, 0, vfov])
    rms = math.sqrt(np.mean(fit.fun**2))
    return fit.x, rms


def main():
    ours, video, vfov = sys.argv[1], sys.argv[2], float(sys.argv[3])
    motion = cv2.MOTION_AFFINE if "--affine" in sys.argv else cv2.MOTION_HOMOGRAPHY
    cc, H, w = ecc(ours, video, motion)
    (yaw, pitch, roll, fov), rms = explain(H, vfov, w)
    mid = H @ np.array([w / 2, w / 2 / (3840 / 1728), 1.0])
    mid = mid[:2] / mid[2] - np.array([w / 2, w / 2 / (3840 / 1728)])
    print(json.dumps({"cc": round(float(cc), 4), "shift960": [round(float(v) * 960 / w, 1) for v in mid],
                      "turn": [round(float(yaw), 3), round(float(pitch), 3), round(float(roll), 3)],
                      "vfov": round(float(fov), 3), "rms": round(rms, 2), "H": H.round(6).tolist()}))


if __name__ == "__main__":
    main()
