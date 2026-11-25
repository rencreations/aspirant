"""Fitting aid: camera anchors of a clip from its recording.

    python -I fit/solve.py JOB.json

JOB: { "clip": id, "video": name, "offset": video time - clip time (a guess), "window": seconds,
       "times": [video times], "fit": FIT.json (the current fit of the clip, as in
       cameras/fits.json), "out": DIR, "minCc": 0.7, "maxRms": 3 }

For each video time the clip is rendered through the current fit at every 1/24 s within
`window` of (time - offset), each render is laid on the recording's frame by ECC (fit/ecc.py),
and the best one gives the clip time and the turn and field of view that the camera lacks
there (the position is kept). Printed: per time the clip time, the correlation and the anchor
{ t, local: { turn }, vfov } relative to the game's own camera at that time, ready for
cameras/fits.json. Frames whose fit is poor (correlation below minCc or residual above maxRms
pixels) are listed but marked.
"""

import json
import os
import subprocess
import sys

import numpy as np
from scipy.spatial.transform import Rotation as R

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ecc import ecc, ecc_wide, explain  # noqa: E402

WORK = "D:\\ren\\aspirant-work\\models-room\\entrance"


def game_at(cam, t):
    keys = np.array(cam["keys"]).reshape(-1, 7)
    x = min(max(t * 30, 0), len(keys) - 1)
    i = int(np.floor(x))
    j = min(len(keys) - 1, i + 1)
    f = x - i
    p = keys[i, :3] + (keys[j, :3] - keys[i, :3]) * f
    qa, qb = keys[i, 3:7], keys[j, 3:7]
    if qa @ qb < 0:
        qb = -qb
    from scipy.spatial.transform import Slerp

    q = Slerp([0, 1], R.from_quat([qa, qb]))(f)
    return p, q


def main():
    job = json.load(open(sys.argv[1]))
    fit = json.load(open(job["fit"])) if isinstance(job["fit"], str) else job["fit"]
    out = job["out"]
    os.makedirs(out, exist_ok=True)
    window = job.get("window", 0.3)
    times = job["times"]
    cts = set()
    for vt in times:
        centre = vt - job["offset"]
        for k in range(-int(window * 24), int(window * 24) + 1):
            t = round(centre + k / 24, 4)
            if 0 <= t <= job.get("duration", 99):
                cts.add(t)
    spec = {
        "clip": job["clip"],
        "fit": fit,
        "times": sorted(cts),
        "out": out,
        "video": {"name": job["video"], "from": min(times) - 0.05, "to": max(times) + 0.1, "fps": 60},
    }
    spec_path = os.path.join(out, "spec.json")
    json.dump(spec, open(spec_path, "w"))
    if not job.get("reuse"):
        subprocess.run(
            ["node", os.path.join(HERE, "renders.mjs"), spec_path],
            check=True,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))),
        )
    index = json.load(open(os.path.join(out, "index.json")))
    meta = json.load(open(os.path.join(out, "video", "meta.json")))
    game = json.load(open(os.path.join(WORK, "work", "cameras.game.json")))["clips"][job["clip"]]
    anchors = []
    for vt in times:
        n = int(round((vt - meta["from"]) * meta["fps"])) + 1
        vpath = os.path.join(out, "video", "%05d.png" % n)
        best = None
        for r in index:
            if abs(r["t"] - (vt - job["offset"])) > window + 1e-6:
                continue
            try:
                if job.get("wide"):
                    cc, H, w = ecc_wide(os.path.join(out, r["file"]), vpath, r["cam"]["vfov"])
                else:
                    cc, H, w = ecc(os.path.join(out, r["file"]), vpath, sizes=(240, 480))
            except Exception:
                continue
            if best is None or cc > best[0]:
                best = (cc, r, H, w)
        if best is None:
            print(json.dumps({"video": vt, "failed": True}), flush=True)
            continue
        cc, r, H, w = best
        cam = r["cam"]
        (yaw, pitch, roll, fov), rms = explain(H, cam["vfov"], w)
        absolute = R.from_quat(cam["q"]) * R.from_euler("YXZ", [yaw, pitch, roll], degrees=True)
        gp, gq = game_at(game, r["t"])
        local = gq.inv() * absolute
        move = gq.inv().apply(np.array(cam["p"]) - gp)
        good = cc >= job.get("minCc", 0.7) and rms <= job.get("maxRms", 3)
        anchor = {"t": round(r["t"], 4), "local": {"turn": [round(v, 6) for v in local.as_rotvec()]}, "vfov": round(float(fov), 3)}
        if np.linalg.norm(move) > 1e-4:
            anchor["local"]["move"] = [round(float(v), 5) for v in move]
        print(json.dumps({"video": vt, "clip": round(r["t"], 4), "offset": round(vt - r["t"], 4), "cc": round(float(cc), 3),
                          "rms": round(rms, 2), "fix": [round(float(yaw), 2), round(float(pitch), 2), round(float(roll), 2), round(float(fov), 2)],
                          "good": bool(good), "anchor": anchor}), flush=True)
        if good:
            anchors.append(anchor)
    json.dump(anchors, open(os.path.join(out, "anchors.json"), "w"))


if __name__ == "__main__":
    main()
