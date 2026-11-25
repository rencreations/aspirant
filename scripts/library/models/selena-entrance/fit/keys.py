"""Fitting aid: a clip's camera keys (cameras/fits.json) from solved frames (fit/pnp.mjs).

    python -I fit/keys.py JOB.json

JOB: { "clip": id, "results": [result.json, ...], "fits": cameras/fits.json,
       "start": { "until": seconds, "camera": clip id of a static fit } (optional: the clip holds
                 that camera from 0 to `until`),
       "end": { "from": seconds, "camera": clip id } (optional: held from `from` to the end),
       "duration": seconds, "sigma": 0.06, "step": 0.1, "vfov": 60,
       "video": name, "offset": video time - clip time, "minInliers": 25, "maxRms": 4,
       "gaps": [[from, to], ...] (optional: stretches no frame could be solved in, such as a
               white flash; there the camera is the game's own path carried by the offset from
               it that the solved frames on either side have, blended across) }

The solved cameras are smoothed in time (a Gaussian of `sigma` seconds over position and turn,
the turn as a rotation vector from the middle of the clip's turns), sampled every `step` and
written as `keys` with the holds at the ends (a key only where solved frames are near; between
sparse frames the keys are the frames themselves); the start and end cameras are pinned, so an in
clip leaves its rest camera and lands on its loop's camera exactly. The entry is written into
fits.json under the clip's id (the rest of the file is kept).
"""

import json
import os
import sys

import numpy as np
from scipy.spatial.transform import Rotation as R


def main():
    job = json.load(open(sys.argv[1]))
    fits = json.load(open(job["fits"]))
    rows = {}
    for path in job["results"]:
        for r in json.load(open(path)):
            if not r.get("ok"):
                continue
            if r["inliers"] < job.get("minInliers", 25) or r["rms960"] > job.get("maxRms", 4):
                continue
            t = round(r["t"], 4)
            if t not in rows or r["inliers"] > rows[t]["inliers"]:
                rows[t] = r
    duration = job["duration"]
    pins = []  # (t, p, q) held exactly
    holds = []
    start = job.get("start")
    end = job.get("end")
    if start:
        cam = fits["clips"][start["camera"]]["static"]
        holds.append({"from": 0, "to": start["until"], "p": cam["p"], "q": cam["q"], "vfov": job.get("vfov", 60)})
        pins.append((start["until"], np.array(cam["p"]), R.from_quat(cam["q"])))
        rows = {t: r for t, r in rows.items() if t > start["until"] + 1e-6}
    if end:
        cam = fits["clips"][end["camera"]]["static"]
        holds.append({"from": end["from"], "to": duration, "p": cam["p"], "q": cam["q"], "vfov": job.get("vfov", 60)})
        pins.append((end["from"], np.array(cam["p"]), R.from_quat(cam["q"])))
        rows = {t: r for t, r in rows.items() if t < end["from"] - 1e-6}
    # Gaps: the game's path, carried by the offset of the solved frames on either side.
    if job.get("gaps"):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from solve import WORK, game_at

        game = json.load(open(os.path.join(WORK, "work", "cameras.game.json")))["clips"][job["clip"]]
        known = sorted(rows)
        for a, b in job["gaps"]:
            ta = max(t for t in known if t <= a + 1e-6)
            tb = min(t for t in known if t >= b - 1e-6)
            offs = []
            for t in (ta, tb):
                gp, gq = game_at(game, t)
                offs.append((gq.inv().apply(np.array(rows[t]["p"]) - gp), gq.inv() * R.from_quat(rows[t]["q"])))
            for t in np.arange(ta + 0.05, tb - 0.025, 0.05):
                f = (t - ta) / (tb - ta)
                f = f * f * (3 - 2 * f)
                move = offs[0][0] * (1 - f) + offs[1][0] * f
                turn = R.from_rotvec(offs[0][1].as_rotvec() * (1 - f) + offs[1][1].as_rotvec() * f)
                gp, gq = game_at(game, t)
                rows[round(float(t), 4)] = {"t": float(t), "p": (gp + gq.apply(move)).tolist(),
                                            "q": (gq * turn).as_quat().tolist(), "inliers": 0, "rms960": 0, "gap": True}
    ts = np.array(sorted(rows))
    P = np.array([rows[t]["p"] for t in ts])
    Q = R.from_quat([rows[t]["q"] for t in ts])
    allq = R.concatenate([Q] + [p[2] for p in pins]) if pins else Q
    ref = allq.mean()
    rv = (ref.inv() * Q).as_rotvec()
    lo = start["until"] if start else 0.0
    hi = end["from"] if end else duration
    sigma = job.get("sigma", 0.06)
    grid = np.arange(lo, hi + 1e-9, job.get("step", 0.1))
    if grid[-1] < hi - 1e-6:
        grid = np.append(grid, hi)
    keys = []
    for g in grid:
        pin = [p for p in pins if abs(p[0] - g) < 1e-6]
        if pin:
            _, pp, pq = pin[0]
            keys.append({"t": round(float(g), 4), "p": [round(float(v), 5) for v in pp],
                         "r": [round(float(v), 6) for v in (ref.inv() * pq).as_rotvec()]})
            continue
        if np.min(np.abs(ts - g)) > job.get("step", 0.1) / 2:
            continue
        w = np.exp(-0.5 * ((ts - g) / sigma) ** 2)
        w /= w.sum()
        keys.append({"t": round(float(g), 4), "p": [round(float(v), 5) for v in w @ P],
                     "r": [round(float(v), 6) for v in w @ rv]})
    # Sparse frames (none near a grid point) are keys of their own.
    for t in ts:
        if t <= lo or t >= hi or any(abs(k["t"] - t) < job.get("step", 0.1) / 2 for k in keys):
            continue
        w = np.exp(-0.5 * ((ts - t) / sigma) ** 2)
        w /= w.sum()
        keys.append({"t": round(float(t), 4), "p": [round(float(v), 5) for v in w @ P],
                     "r": [round(float(v), 6) for v in w @ rv]})
    keys.sort(key=lambda k: k["t"])
    entry = {
        "video": job.get("video"),
        "offset": job.get("offset"),
        "vfov": job.get("vfov", 60),
        "holds": holds,
        "ref": [round(float(v), 6) for v in ref.as_quat()],
        "keys": keys,
        "solved": len(ts),
    }
    fits["clips"][job["clip"]] = entry
    with open(job["fits"], "w") as handle:
        json.dump(fits, handle, indent=1)
    print(job["clip"], "solved frames", len(ts), "keys", len(keys), "holds", len(holds))


if __name__ == "__main__":
    main()
