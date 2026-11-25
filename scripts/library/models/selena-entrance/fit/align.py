"""Fitting aid: which clip time each frame of a recording shows (the camera being known).

    python -I fit/align.py DIR [--every N] [--rate R]

DIR holds renders of a clip (index.json, one PNG a time, made by fit/renders.mjs) and the
recording's frames (DIR/video, meta.json). For each recording frame the score of each render is
the mean colour difference of the two pictures (blurred) over the pixels the render covers plus
the same over the pixels the recording's own silhouette covers where the render does not
(the recording's silhouette is unknown, so the second term uses the difference against the
recording's median over the stretch, which is the ground where the camera stands still). The
best clip time per frame is printed, and the offset video time - clip time that fits them best.
"""

import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def load(path, blur=1.5):
    im = Image.open(path).convert("RGBA")
    rgb = np.asarray(im.convert("RGB").filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32)
    alpha = np.asarray(im, dtype=np.float32)[..., 3] / 255.0
    return rgb, alpha


def main():
    d = sys.argv[1]
    every = 1
    rate = 1.0
    if "--every" in sys.argv:
        every = int(sys.argv[sys.argv.index("--every") + 1])
    if "--rate" in sys.argv:
        rate = float(sys.argv[sys.argv.index("--rate") + 1])
    index = json.load(open(os.path.join(d, "index.json")))
    meta = json.load(open(os.path.join(d, "video", "meta.json")))
    renders = [load(os.path.join(d, r["file"])) for r in index]
    times = np.array([r["t"] for r in index])
    vfiles = sorted(glob.glob(os.path.join(d, "video", "*.png")))[::every]
    video = [load(f)[0] for f in vfiles]
    vtimes = np.array([meta["from"] + (i * every) / meta["fps"] for i in range(len(vfiles))])
    median = np.median(np.stack(video), axis=0)
    rows = []
    for vi, v in enumerate(video):
        moving = (np.abs(v - median).mean(axis=2) > 18).astype(np.float32)
        scores = []
        for rgb, a in renders:
            inside = a > 0.5
            diff = np.abs(v - rgb).mean(axis=2)
            s1 = diff[inside].mean() if inside.any() else 255
            # where the recording differs from its median and the render is empty: a miss
            miss = (moving * (1 - a)).sum() / max(1.0, moving.sum())
            scores.append(s1 + 60 * miss)
        scores = np.array(scores)
        best = int(np.argmin(scores))
        rows.append((vtimes[vi], times[best], scores[best], np.sort(scores)[:3]))
    offsets = np.array([vt - ct * rate for vt, ct, _, _ in rows])
    for vt, ct, s, top in rows:
        print(f"video {vt:7.3f} -> clip {ct:6.3f}  score {s:6.2f}  offset {vt - ct * rate:7.3f}")
    print("median offset", float(np.median(offsets)), "spread (iqr)", float(np.subtract(*np.percentile(offsets, [75, 25]))))


if __name__ == "__main__":
    main()
