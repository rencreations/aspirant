"""
Measures the in-game animation recordings of one character, so `stage.py` can cut them on matching
frames. It replaces the numbers that scripts/guinevere/stage.py has by hand (found with a proxy
and by eye): everything is found by comparing frames of grey 320x144 proxies by mean squared
error (MSE) and written to D:/ren/aspirant-work/animation/<slug>/analysis.json.

What is measured (all frame numbers are frames of the 60 fps recording):

  period    the idle loop's cycle P: the smallest lag at which idle.mkv repeats itself at about the
            floor of the neighbouring frames (the multiples of it repeat too). The idle video is
            `k` cycles (k * P >= MIN_LOOP, so a 2 s cycle does not loop every 2 s).
  welcome   `start` is the frame after the hard cut from the hero-select screen to the animation.
            `end` is the last frame before the game's top bar pops in (a one frame step in the top
            right strip while the rest of the picture is calm); the match of the last frames with
            idle.mkv gives `loop_start`: the idle frame the idle loop starts at (the frame after
            the one the welcome ends on).
  clips     for each recording that starts and ends in the idle pose (the body part clips and the
            pose change `zoom`): `c_head` and `c_tail`, the idle phase offsets (phase = (frame + c)
            mod P, phase 0 is idle.mkv frame loop_start), `head_end` (the first frame of the action)
            and `action_end` (the first frame of the idle pose at the end).
  pose      for `zoom`: the stretch where the picture repeats with a period `p` (the pose's own
            loop), found as the longest run of low MSE between frame f and frame f + p.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import proxy  # noqa: E402

XFADE = 20  # frames dissolved at a loop seam
IN_LEAD = 36  # frames of idle pose before the action, in an entrance or a short
MIN_LOOP = 300  # the idle loop and the pose loop are at least this many frames (5 s)
HEAD = 60  # frames at the start of a recording matched to find c_head
TAIL = 60  # frames at the end matched to find c_tail
POSE_MARGIN = 4  # frames after the start of the repeat that count as "in the pose"
EXIT_LEAD = 4  # the exit starts this many frames before the pose loop leaves its repeat


def flat(a: np.ndarray) -> np.ndarray:
    return a.reshape(len(a), -1).astype(np.float32)


def mse_matrix(a: np.ndarray, b: np.ndarray, centre: np.ndarray | None = None) -> np.ndarray:
    """MSE between every row of `a` (n x D) and every row of `b` (m x D), as n x m float32."""
    if centre is None:
        centre = b.mean(axis=0)
    a = a - centre
    b = b - centre
    out = np.empty((len(a), len(b)), dtype=np.float32)
    sb = (b * b).sum(1)
    for i in range(0, len(a), 512):
        x = a[i : i + 512]
        out[i : i + 512] = ((x * x).sum(1)[:, None] + sb[None, :] - 2 * (x @ b.T)) / a.shape[1]
    return np.maximum(out, 0)


def pool(a: np.ndarray, k: int) -> np.ndarray:
    n, h, w = a.shape
    return a.reshape(n, h // k, k, w // k, k).astype(np.float32).mean(axis=(2, 4)).reshape(n, -1)


def lag_curve(s: np.ndarray, lo: int, hi: int) -> np.ndarray:
    """Mean MSE between frame f and frame f + lag, for lag in [lo, hi), from pooled frames `s`."""
    g = s @ s.T
    sq = np.diag(g)
    d = (sq[:, None] + sq[None, :] - 2 * g) / s.shape[1]
    m = np.full(len(s), np.nan)
    for lag in range(lo, hi):
        m[lag] = np.diagonal(d, offset=lag).mean()
    return m


# ---------------------------------------------------------------------------------------------
# The idle cycle
# ---------------------------------------------------------------------------------------------


def find_period(idle: np.ndarray) -> dict:
    n = len(idle)
    hi = int(n * 0.6)
    m = lag_curve(pool(idle, 4), 30, hi)
    lags = [lag for lag in range(31, hi - 1) if m[lag] < m[lag - 1] and m[lag] <= m[lag + 1]]
    floor = min(m[lag] for lag in lags)
    thr = max(2.5 * floor, floor + 1.0)
    first = next(lag for lag in lags if m[lag] <= thr)
    # Refine on the full proxy: the pooled picture can hide fine motion.
    full = {}
    f = flat(idle)
    for lag in range(max(30, first - 2), first + 3):
        full[lag] = float(((f[: n - lag] - f[lag:]) ** 2).mean())
    p = min(full, key=full.get)
    return {
        "p": int(p),
        "mse_at_p": round(full[p], 3),
        "mse_neighbour": round(float(((f[:-1] - f[1:]) ** 2).mean()), 3),
        "multiples": {str(p * j): round(float(((f[: n - p * j] - f[p * j :]) ** 2).mean()), 3)
                      for j in (2, 3) if p * j < n - 60},
        "candidates": [(int(lag), round(float(m[lag]), 2)) for lag in lags if m[lag] <= thr][:8],
    }


# ---------------------------------------------------------------------------------------------
# The welcome
# ---------------------------------------------------------------------------------------------


def find_welcome(w: np.ndarray, idle: np.ndarray, p: int, loops: int) -> dict:
    n = len(w)
    ni = len(idle)
    wf = w.astype(np.float32)
    d2 = (wf[1:] - wf[:-1]) ** 2
    dif = d2.mean(axis=(1, 2))
    # The top bar pops in: a one frame step in the top right strip while the rest is calm.
    top_r = d2[:, :14, 150:].mean(axis=(1, 2))
    rest = d2[:, 14:, :].mean(axis=(1, 2))
    pops = [t + 1 for t in range(60, n - 1)
            if top_r[t] > 30 and rest[t] < top_r[t] / 3 and rest[t] < 40]
    end = pops[-1] - 1 if pops else n - 1
    # The hard cut from the hero-select screen to the animation: a one frame spike of the early
    # frames. The screen can change skin first (more spikes), so `cuts` lists them all and the
    # first is taken; a character whose first spike is not the cut has `start` set in
    # stage.CHARACTERS (checked by eye on the contact sheet).
    cuts = [t + 1 for t in range(1, min(n - 2, 700))
            if dif[t] > 3000 and dif[t] > 5 * max(dif[t - 1], dif[t + 1], 20)]
    start = cuts[0] if cuts else 0
    # Match the last frames to idle.mkv: cost[j] is the mean MSE of welcome frames end-2..end
    # against idle frames j-2..j (the earlier frames are still settling).
    win = 3
    d = mse_matrix(flat(w[end - win + 1 : end + 1]), flat(idle))
    cost = np.full(ni, np.inf, dtype=np.float32)
    cost[win - 1 :] = 0
    for i in range(win):
        cost[win - 1 :] += d[i, i : ni - win + 1 + i]
    cost /= win
    j = int(np.argmin(cost))
    err_end = float(d[win - 1, j])
    err_win = float(cost[j])
    blend = 6 if err_end <= 40 else int(min(24, 6 + (err_end - 40) / 8))
    return {
        "start": int(start),
        "cuts": [int(c) for c in cuts],
        "end": int(end),
        "ui_pops": [int(t) for t in pops[-6:]],
        "match_idle_frame": j,
        "err_end": round(err_end, 1),
        "err_window": round(err_win, 1),
        "blend": blend,
        "frames_after_cut": int(end + 1 - start),
    }


def choose_loop_start(idle: np.ndarray, p: int, k: int, first: int, blend: int) -> dict:
    """The idle frame the loop starts at: `first` plus whole cycles, with room for the seam
    dissolve before it and k cycles after it, and the quietest seam."""
    n = len(idle)
    f = idle.astype(np.float32)
    lo = max(XFADE, blend)
    for kk in range(k, 0, -1):
        length = kk * p
        cands = [first + m * p for m in range(-60, 60) if lo <= first + m * p <= n - length]
        if cands:
            break
    else:
        raise SystemExit(f"idle.mkv is too short: n={n}, p={p}, first={first}")
    seam = {c: float(((f[c - XFADE : c] - f[c + length - XFADE : c + length]) ** 2).mean())
            for c in cands}
    best = min(seam, key=seam.get)
    return {"loop_start": int(best), "loop_frames": int(length), "cycles": int(length // p),
            "seam_mse": round(seam[best], 2), "seam_all": {str(c): round(v, 2) for c, v in seam.items()}}


# ---------------------------------------------------------------------------------------------
# A clip that starts and ends in the idle pose
# ---------------------------------------------------------------------------------------------


def phase_offset(d: np.ndarray, frames: np.ndarray, p: int) -> tuple[int, float]:
    """The c that minimises the mean of d[f][(f + c) mod p] over `frames`, and that mean."""
    cost = np.array([d[frames, (frames + c) % p].mean() for c in range(p)])
    c = int(np.argmin(cost))
    return c, float(cost[c])


def spread_of_c(d: np.ndarray, frames: np.ndarray, p: int) -> dict:
    """Best c per frame over `frames`: how steady the match is (a near static idle is ambiguous)."""
    best = d[frames].argmin(axis=1)
    c = (best - frames) % p
    return {"median": int(np.median(c)), "min": int(c.min()), "max": int(c.max())}


BAD_MATCH = 100.0  # a head or tail whose best MSE against the idle loop is above this is "other idle"


def self_lag(z: np.ndarray, a: int, b: int, p: int) -> tuple[int, float]:
    """The lag near p at which frames a..b of `z` repeat themselves best (a cycle of the clip's own
    idle), and the mean MSE at that lag."""
    zf = z.astype(np.float32)
    best = (p, 1e18)
    for lag in range(p - 8, p + 9):
        if b + lag > len(z):
            continue
        e = float(((zf[a:b] - zf[a + lag : b + lag]) ** 2).mean())
        if e < best[1]:
            best = (lag, e)
    return best


def analyze_clip(z: np.ndarray, loop: np.ndarray, p: int) -> dict:
    n = len(z)
    d = mse_matrix(flat(z), flat(loop))  # n x p
    f = np.arange(n)
    hf = f[: min(HEAD, n)]
    c_head, e_h = phase_offset(d, hf, p)
    err_h = d[f, (f + c_head) % p]
    thr_h = max(12.0, 6 * float(np.median(err_h[: len(hf)])))
    over = np.flatnonzero(err_h[len(hf) // 2 :] > thr_h)
    head_end = int(over[0] + len(hf) // 2) if len(over) else n
    head_mode = "idle"
    zf = z.astype(np.float32)
    if e_h > BAD_MATCH:
        # Some recordings start in another state of the idle (the same pose, a little different:
        # camera and hair). It cannot be matched to idle.mkv, but it repeats itself: the action
        # starts where a frame stops matching the frame one cycle later.
        head_mode = "self"
        lag, _ = self_lag(z, 0, min(150, n // 3), p)
        e = np.array([float(((zf[i] - zf[i + lag]) ** 2).mean()) for i in range(0, n - lag)])
        thr = max(150.0, 8 * float(np.median(e[:100])))
        over = np.flatnonzero(e[20:] > thr)
        head_end = int(over[0] + 20 + lag - 3) if len(over) else n
    tf = f[n - TAIL :]
    c_tail, e_t = phase_offset(d, tf, p)
    err_t = d[f, (f + c_tail) % p]
    thr_t = max(12.0, 6 * float(np.median(err_t[n - TAIL :])))
    bad = np.flatnonzero(err_t > thr_t)
    action_end = int(bad[-1] + 1) if len(bad) else 0
    tail_mode = "idle"
    if e_t > BAD_MATCH:
        tail_mode = "self"
        lag, _ = self_lag(z, n - p - 69, n - p - 9, p)
        e = np.array([float(((zf[i] - zf[i - lag]) ** 2).mean()) for i in range(lag, n)])
        thr = max(150.0, 8 * float(np.median(e[-100:])))
        over = np.flatnonzero(e > thr)
        action_end = int(over[-1] + 1 + 3) if len(over) else 0
    return {
        "frames": int(n),
        "c_head": c_head,
        "head_err": round(e_h, 2),
        "head_mode": head_mode,
        "head_spread": spread_of_c(d, hf, p),
        "head_end": head_end,
        "c_tail": c_tail,
        "tail_err": round(e_t, 2),
        "tail_mode": tail_mode,
        "tail_spread": spread_of_c(d, tf, p),
        "action_end": action_end,
        "thr_head": round(thr_h, 1),
        "thr_tail": round(thr_t, 1),
    }


def strip_check(z: np.ndarray, loop: np.ndarray, p: int, c: int, a: int, b: int) -> dict:
    """The largest MSE of the top, bottom, left and right strips of frames a..b-1 against the idle
    loop at offset c. The game's panels would show up here (the idle recording has none)."""
    out = {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0}
    for t in range(a, b):
        diff = (z[t].astype(np.float32) - loop[(t + c) % p].astype(np.float32)) ** 2
        out["top"] = max(out["top"], float(diff[:18].mean()))
        out["bottom"] = max(out["bottom"], float(diff[-24:].mean()))
        out["left"] = max(out["left"], float(diff[:, :70].mean()))
        out["right"] = max(out["right"], float(diff[:, -70:].mean()))
    return {k: round(v, 1) for k, v in out.items()}


# ---------------------------------------------------------------------------------------------
# The pose loop inside the zoom recording
# ---------------------------------------------------------------------------------------------


def find_pose_loop(z: np.ndarray, a: int, b: int, p_idle: int, thr: float = 8.0) -> dict:
    """The longest stretch of [a, b) that repeats with some lag p: frames f and f + p match for
    every f of the stretch. Between lags that give nearly the longest stretch the one with the
    smallest error wins (the true period: 122 beats 120 and 121)."""
    s = pool(z[a:b], 2)
    m = len(s)
    g = s @ s.T
    sq = np.diag(g)
    d = (sq[:, None] + sq[None, :] - 2 * g) / s.shape[1]
    rows = []
    for lag in range(40, m - 60):
        dg = np.diagonal(d, offset=lag)
        dg = np.convolve(dg, np.ones(9) / 9, mode="same")
        low = np.concatenate(([False], dg < thr, [False]))
        edges = np.flatnonzero(low[1:] != low[:-1])
        starts, ends = edges[::2], edges[1::2]
        if not len(starts):
            continue
        i = int(np.argmax(ends - starts))
        run = int(ends[i] - starts[i])
        seg = dg[starts[i] : ends[i]]
        rows.append((run, lag, a + int(starts[i]), float(seg.mean())))
    if not rows:
        return {}
    top = max(r[0] for r in rows)
    near = [r for r in rows if r[0] >= 0.8 * top]
    best = min(near, key=lambda r: (r[3], r[1]))
    # A shorter lag that is a whole fraction of the best one and nearly as good is the real period
    # (a pose that repeats every 600 frames also matches 1200 frames later).
    for r in sorted(near, key=lambda r: r[1]):
        for j in (2, 3, 4):
            if abs(r[1] * j - best[1]) <= 2 and r[3] <= 1.6 * best[3] + 0.5:
                best = r
                break
        else:
            continue
        break
    run, lag, start, err = best
    return {
        "p": int(lag),
        "run": int(run),
        "f_start": int(start),
        "r_end": int(start + run - 1 + lag),
        "mean_err": round(err, 2),
        "near": [(int(r[1]), int(r[0]), round(r[3], 2)) for r in sorted(near, key=lambda r: r[3])[:6]],
        "p_is_idle_multiple": bool(lag % p_idle == 0 or abs(lag - p_idle) <= 2),
    }


def choose_pose_cut(z: np.ndarray, pose: dict) -> dict:
    """Where the pose loop is cut from the recording: l0 with room for the dissolve before it,
    the loop of `cycles` periods, the exit and the pose frame."""
    p = pose["p"]
    f_start, r_end = pose["f_start"], pose["r_end"]
    zf = z.astype(np.float32)
    span = r_end - f_start + 1  # frames that repeat (each matches the one p earlier or later)
    cycles = 1
    for k in range(max(1, -(-MIN_LOOP // p)), 0, -1):
        if XFADE + 4 + k * p <= span:
            cycles = k
            break
    length = cycles * p
    lo = f_start + XFADE + POSE_MARGIN
    hi = r_end + 1 - length
    if hi < lo:
        lo = hi = f_start + XFADE
    seam = {}
    for c in range(lo, hi + 1):
        seam[c] = float(((zf[c - XFADE : c] - zf[c + length - XFADE : c + length]) ** 2).mean())
    l0 = min(seam, key=lambda c: (round(seam[c], 1), c))
    return {
        "pose": f_start + POSE_MARGIN,
        "l0": int(l0),
        "loop_frames": int(length),
        "cycles": int(cycles),
        "exit": int(r_end - EXIT_LEAD),
        "seam_mse": round(seam[l0], 2),
    }


# ---------------------------------------------------------------------------------------------
# One character
# ---------------------------------------------------------------------------------------------


def analyze(slug: str, shorts: list[str], overrides: dict | None = None) -> dict:
    overrides = overrides or {}
    idle = proxy.load(slug, "idle")
    per = find_period(idle)
    p = per["p"]
    k = max(1, -(-MIN_LOOP // p))
    out: dict = {"slug": slug, "idle_frames": int(len(idle)), "period": per}
    wel = find_welcome(proxy.load(slug, "welcome"), idle, p, k)
    wel.update(overrides.get("welcome", {}))
    ls = choose_loop_start(idle, p, k, wel["match_idle_frame"] + 1, wel["blend"])
    ls.update(overrides.get("idle", {}))
    out["welcome"] = wel
    out["idle"] = ls
    loop = idle[ls["loop_start"] : ls["loop_start"] + p]
    out["clips"] = {}
    for name in ["zoom", *dict.fromkeys(shorts)]:
        z = proxy.load(slug, name)
        c = analyze_clip(z, loop, p)
        c["strips_head"] = strip_check(z, loop, p, c["c_head"], 0, max(1, c["head_end"] - 10))
        c["strips_tail"] = strip_check(z, loop, p, c["c_tail"], min(len(z) - 1, c["action_end"] + 10), len(z))
        if name == "zoom":
            pose = find_pose_loop(z, c["head_end"] + 30, c["action_end"] - 30, p)
            c["pose_loop"] = pose
            if pose:
                c["cut"] = choose_pose_cut(z, pose)
        c.update(overrides.get(name, {}))
        out["clips"][name] = c
    return out


def save(slug: str, data: dict) -> Path:
    path = proxy.WORK / slug / "analysis.json"
    path.write_text(json.dumps(data, indent=1), encoding="utf-8")
    return path


def main() -> None:
    from stage import CHARACTERS  # noqa: PLC0415

    for slug in sys.argv[1:]:
        ch = CHARACTERS[slug]
        data = analyze(slug, ch["shorts"], ch.get("overrides"))
        print(json.dumps(data, indent=1))
        save(slug, data)


if __name__ == "__main__":
    main()
