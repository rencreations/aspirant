"""Fitting aid: for frames of a recording, the clip time whose render lays best on it (ECC), and
the camera correction (turn, field of view) at that time.

    python -I fit/ecc_search.py DIR VFOV VIDEO_TIME [VIDEO_TIME ...] [--near CLIP_TIME WINDOW]

DIR as fit/align.py has it (renders, index.json, video/ with meta.json). With --near only the
renders within WINDOW seconds of CLIP_TIME (+ the frame's offset from the first) are tried.
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecc import ecc, explain  # noqa: E402


def main():
    d = sys.argv[1]
    vfov = float(sys.argv[2])
    args = sys.argv[3:]
    near = None
    if "--near" in args:
        i = args.index("--near")
        near = (float(args[i + 1]), float(args[i + 2]))
        args = args[:i] + args[i + 3 :]
    vts = [float(a) for a in args]
    index = json.load(open(os.path.join(d, "index.json")))
    meta = json.load(open(os.path.join(d, "video", "meta.json")))
    for k, vt in enumerate(vts):
        n = int(round((vt - meta["from"]) * meta["fps"])) + 1
        vpath = os.path.join(d, "video", "%05d.png" % n)
        best = None
        for r in index:
            if near is not None:
                centre = near[0] + (vt - vts[0])
                if abs(r["t"] - centre) > near[1]:
                    continue
            try:
                cc, H, w = ecc(os.path.join(d, r["file"]), vpath, sizes=(240, 480))
            except Exception:
                continue
            if best is None or cc > best[0]:
                best = (cc, r["t"], H, w)
        cc, t, H, w = best
        (yaw, pitch, roll, fov), rms = explain(H, vfov, w)
        print(json.dumps({"video": vt, "clip": round(t, 4), "offset": round(vt - t, 4), "cc": round(float(cc), 4),
                          "turn": [round(float(yaw), 2), round(float(pitch), 2), round(float(roll), 2)],
                          "vfov": round(float(fov), 2), "rms": round(rms, 2)}), flush=True)


if __name__ == "__main__":
    main()
