"""Shot detection and still selection for the scene stills (numpy and Pillow only; ffmpeg decodes).

Flow for one film:
  1. `detect_crop`: find black bars once for the whole film (max luma over sampled frames).
  2. `analyse`: decode every frame at about 320 px on the long side (bars cropped) through a pipe.
     For every frame keep a tiny luma picture (80 px) and a colour histogram, to find cuts. For
     every 8th frame per second keep the heavy features (sharpness, brightness, dHash, colour
     layout, a 32x18 thumbnail) to pick the stills.
  3. `segment`: hard cuts are one frame spikes in the frame difference that stand clear of their
     neighbours (so fast action and flashes are not cuts); dissolves, fades and slow pans are
     found by drift from the first frame of the shot.
  4. `choose`: the sharpest clean frame in the middle third of every shot, then near duplicates
     are dropped by an 8x8 dHash (kept when the colour layout differs).
"""

from __future__ import annotations

import io
import re
import subprocess
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

ALGO = 4  # bump when the detection or selection changes (it is part of the cache key)

# --- tunables -----------------------------------------------------------------------------------
LONG_SIDE = 320
SAMPLE_PER_SEC = 8
CUT_ABS = 12.0  # mean abs luma change (0..255) a cut must reach
CUT_RATIO = 2.2  # and stand this far above the neighbouring frame differences
CUT_HIST = 0.07  # and the colour histogram must move this much (or the change is huge)
CUT_HUGE = 42.0
DRIFT_ABS = 46.0  # change from the first frame of a shot that starts a new shot
DRIFT_HIST = 0.22
DRIFT_MIN_S = 1.5  # a drift split never comes sooner than this after the shot began
MIN_SHOT_S = 0.40
HASH_DUP = 6  # dHash hamming distance under which two stills are near duplicates
LAYOUT_KEEP = 20.0  # unless the colour layout differs by more than this (mean abs, 0..255)
BAR_LUMA = 30


@dataclass
class Geometry:
    w: int
    h: int
    fps: float
    dur: float
    crop: tuple[int, int, int, int]  # cw, ch, x, y
    aw: int  # analysis width
    ah: int


@dataclass
class Features:
    n: int
    lum: np.ndarray  # (n, ah/4, aw/4) float32
    hist: np.ndarray  # (n, 36) float32, each channel sums to 1
    samples: list[int] = field(default_factory=list)  # frame numbers with heavy features
    sharp: dict[int, float] = field(default_factory=dict)
    mean: dict[int, float] = field(default_factory=dict)
    std: dict[int, float] = field(default_factory=dict)
    dhash: dict[int, int] = field(default_factory=dict)
    layout: dict[int, np.ndarray] = field(default_factory=dict)
    thumb: dict[int, np.ndarray] = field(default_factory=dict)  # 18x32 uint8 gray


def probe(path) -> dict:
    """Size, frame rate and length of a film (common.ffprobe reads the output with the system code
    page, which fails on a Japanese file name, so this reads it as UTF-8)."""
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate,duration:format=duration", "-of", "json", str(path)],
        capture_output=True, timeout=120, encoding="utf-8", errors="replace",
    )
    j = __import__("json").loads(r.stdout or "{}")
    v = (j.get("streams") or [{}])[0]
    num, _, den = str(v.get("r_frame_rate", "0/1")).partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    dur = float((j.get("format") or {}).get("duration") or v.get("duration") or 0)
    return {"w": int(v.get("width", 0)), "h": int(v.get("height", 0)), "fps": fps, "dur": dur}


def _even(n: float) -> int:
    return int(n) // 2 * 2


def _run_bytes(cmd: list[str], timeout: int = 600) -> bytes:
    return subprocess.run(cmd, capture_output=True, timeout=timeout).stdout


def detect_crop(path, w: int, h: int, dur: float) -> tuple[int, int, int, int]:
    """Black bars of the whole film as (cw, ch, x, y), found from the max luma over many frames."""
    sw = 480
    sh = max(2, round(h * sw / w))
    acc_rows = np.zeros(sh, dtype=np.float32)
    acc_cols = np.zeros(sw, dtype=np.float32)
    got = 0
    for i in range(14):
        t = max(0.0, dur * (i + 0.5) / 14)
        raw = _run_bytes(
            ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1", "-vf",
             f"scale={sw}:{sh}:flags=area,format=gray", "-f", "rawvideo", "-"]
        )
        if len(raw) != sw * sh:
            continue
        g = np.frombuffer(raw, dtype=np.uint8).reshape(sh, sw)
        acc_rows = np.maximum(acc_rows, g.max(axis=1))
        acc_cols = np.maximum(acc_cols, g.max(axis=0))
        got += 1
    if not got:
        return (w, h, 0, 0)

    def edge(v: np.ndarray) -> tuple[int, int]:
        n = len(v)
        a = 0
        while a < n // 3 and v[a] < BAR_LUMA:
            a += 1
        b = 0
        while b < n // 3 and v[n - 1 - b] < BAR_LUMA:
            b += 1
        return a, b

    top, bottom = edge(acc_rows)
    left, right = edge(acc_cols)
    kx, ky = w / sw, h / sh
    # Round the bars down (never cut into the picture) and the result to even numbers.
    x0 = _even(left * kx) if left >= 2 else 0
    x1 = _even(right * kx) if right >= 2 else 0
    y0 = _even(top * ky) if top >= 2 else 0
    y1 = _even(bottom * ky) if bottom >= 2 else 0
    cw, ch = w - x0 - x1, h - y0 - y1
    return (cw, ch, x0, y0)


def analysis_size(cw: int, ch: int) -> tuple[int, int]:
    if cw >= ch:
        aw = LONG_SIDE
        ah = max(4, round(LONG_SIDE * ch / cw / 4) * 4)
    else:
        ah = LONG_SIDE
        aw = max(4, round(LONG_SIDE * cw / ch / 4) * 4)
    return aw, ah


def _laplacian_var(g: np.ndarray) -> float:
    lap = -4.0 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


def dhash(gray_u8: np.ndarray) -> int:
    im = Image.fromarray(gray_u8).resize((9, 8), Image.BOX)
    a = np.asarray(im, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int.from_bytes(np.packbits(bits).tobytes(), "big")


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def thumb18(rgb_or_gray: np.ndarray) -> np.ndarray:
    im = Image.fromarray(rgb_or_gray)
    if im.mode != "L":
        im = im.convert("L")
    return np.asarray(im.resize((32, 18), Image.BOX), dtype=np.uint8)


def analyse(path, geo: Geometry) -> Features:
    cw, ch, x, y = geo.crop
    aw, ah = geo.aw, geo.ah
    vf = f"crop={cw}:{ch}:{x}:{y},scale={aw}:{ah}:flags=area"
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-an", "-sn", "-vf", vf, "-fps_mode", "passthrough",
           "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    stride = max(1, round(geo.fps / SAMPLE_PER_SEC))
    frame_bytes = aw * ah * 3
    est = int(geo.dur * geo.fps) + 64
    lums: list[np.ndarray] = []
    hists: list[np.ndarray] = []
    feats = Features(0, np.zeros(0), np.zeros(0))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=frame_bytes * 8)
    coef = np.array([0.299, 0.587, 0.114], dtype=np.float32)
    i = 0
    assert proc.stdout is not None
    while True:
        buf = proc.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            break
        s = np.frombuffer(buf, dtype=np.uint8).reshape(ah, aw, 3)
        sm = s.reshape(ah // 4, 4, aw // 4, 4, 3).mean(axis=(1, 3))  # (ah/4, aw/4, 3)
        lum = (sm @ coef).astype(np.float32)
        lums.append(lum)
        # 12 bin histogram per channel, normalised.
        q = (sm.astype(np.uint8) // 22).reshape(-1, 3)  # 0..11
        hv = np.concatenate([np.bincount(q[:, c], minlength=12) for c in range(3)]).astype(np.float32)
        hists.append(hv / q.shape[0])
        if i % stride == 0:
            g = (s.astype(np.float32) @ coef)
            gu8 = np.clip(g, 0, 255).astype(np.uint8)
            feats.samples.append(i)
            feats.sharp[i] = _laplacian_var(g)
            feats.mean[i] = float(g.mean())
            feats.std[i] = float(g.std())
            feats.dhash[i] = dhash(gu8)
            feats.layout[i] = np.asarray(Image.fromarray(s).resize((4, 4), Image.BOX), dtype=np.float32).reshape(-1)
            feats.thumb[i] = thumb18(s)
        i += 1
    proc.stdout.close()
    proc.wait()
    feats.n = i
    feats.lum = np.stack(lums) if lums else np.zeros((0, ah // 4, aw // 4), np.float32)
    feats.hist = np.stack(hists) if hists else np.zeros((0, 36), np.float32)
    del est
    return feats


def frame_diffs(f: Features) -> tuple[np.ndarray, np.ndarray]:
    """d_pix[i], d_hist[i]: change between frame i-1 and frame i (0 for i = 0)."""
    n = f.n
    dp = np.zeros(n, dtype=np.float32)
    dh = np.zeros(n, dtype=np.float32)
    if n > 1:
        dp[1:] = np.abs(f.lum[1:] - f.lum[:-1]).mean(axis=(1, 2))
        dh[1:] = 0.5 * np.abs(f.hist[1:] - f.hist[:-1]).sum(axis=1) / 3.0
    return dp, dh


def find_cuts(dp: np.ndarray, dh: np.ndarray, *, cut_abs=CUT_ABS, ratio=CUT_RATIO, hist=CUT_HIST) -> list[int]:
    """Frame numbers i where a new shot starts (the cut lies between i-1 and i)."""
    n = len(dp)
    cuts: list[int] = []
    for i in range(1, n):
        v = dp[i]
        if v < cut_abs:
            continue
        lo = max(1, i - 4)
        nb = 0.0
        if i > lo:
            nb = max(nb, float(dp[lo:i].max()))
        if i + 1 < n:
            nb = max(nb, float(dp[i + 1 : min(n, i + 4)].max()))
        if v < ratio * nb:
            continue
        if dh[i] < hist and v < CUT_HUGE:
            continue
        cuts.append(i)
    # Cuts closer than 3 frames are one event: keep the strongest.
    out: list[int] = []
    for c in cuts:
        if out and c - out[-1] < 3:
            if dp[c] > dp[out[-1]]:
                out[-1] = c
            continue
        out.append(c)
    return out


def segment(f: Features, fps: float) -> list[tuple[int, int, str]]:
    """Shots as (first frame, end frame exclusive, how it started) from cuts and drift."""
    dp, dh = frame_diffs(f)
    cuts = find_cuts(dp, dh)
    bounds = [0] + cuts + [f.n]
    segs: list[tuple[int, int, str]] = []
    for k in range(len(bounds) - 1):
        a, b = bounds[k], bounds[k + 1]
        how = "start" if k == 0 else "cut"
        if b - a <= 0:
            continue
        # Drift: split a long shot when it has moved far from its first frames.
        ref = a + min(2, b - a - 1)
        start = a
        j = ref + 1
        while j < b:
            d = float(np.abs(f.lum[j] - f.lum[ref]).mean())
            if d >= DRIFT_ABS and (j - start) / fps >= DRIFT_MIN_S:
                dhist = float(0.5 * np.abs(f.hist[j] - f.hist[ref]).sum() / 3.0)
                if dhist >= DRIFT_HIST:
                    segs.append((start, j, how))
                    start, how = j, "drift"
                    ref = min(b - 1, j + 2)
                    j = ref
            j += 1
        segs.append((start, b, how))
    return segs


def _clean_candidate(f: Features, i: int) -> bool:
    m, s = f.mean[i], f.std[i]
    if m < 14 and s < 12:  # black
        return False
    if m > 238 and s < 14:  # white
        return False
    if s < 3:  # a flat colour
        return False
    return True


def choose(f: Features, fps: float, segs: list[tuple[int, int, str]]) -> list[dict]:
    """One still per shot, near duplicates dropped. Returns dicts in time order."""
    picks: list[dict] = []
    ss = sorted(f.samples)
    arr = np.array(ss)
    dp, _ = frame_diffs(f)
    for (a, b, how) in segs:
        if (b - a) / fps < MIN_SHOT_S:
            continue
        third = (b - a) / 3.0
        lo, hi = a + third, b - third
        cand = [i for i in ss[np.searchsorted(arr, a) : np.searchsorted(arr, b)] if lo <= i < hi]
        if not cand:
            mid = (a + b) // 2
            cand = [min(ss, key=lambda i: abs(i - mid))] if a <= mid < b else []
        good = [i for i in cand if _clean_candidate(f, i)]
        if not good:
            wide = [i for i in ss[np.searchsorted(arr, a) : np.searchsorted(arr, b)] if _clean_candidate(f, i)]
            good = wide
        if not good:
            continue
        # Calm frames first: a frame with a big change right next to it is a blend or a smear.
        def score(i: int) -> float:
            near = float(dp[max(1, i - 2) : min(f.n, i + 3)].mean()) if f.n > 2 else 0.0
            dim = min(1.0, max(0.3, f.mean[i] / 30.0))
            return f.sharp[i] * dim / (1.0 + 0.15 * near)

        best = max(good, key=score)
        picks.append({"frame": best, "seg": (a, b), "how": how, "sharp": f.sharp[best]})
    # Near duplicates (inside this film only).
    kept: list[dict] = []
    for p in picks:
        h = f.dhash[p["frame"]]
        lay = f.layout[p["frame"]]
        dup = False
        for k in kept:
            if hamming(h, f.dhash[k["frame"]]) < HASH_DUP:
                if float(np.abs(lay - f.layout[k["frame"]]).mean()) <= LAYOUT_KEEP:
                    dup = True
                    break
        if not dup:
            kept.append(p)
    return kept


# --- scdet cross check --------------------------------------------------------------------------
def scdet_times(path, geo: Geometry, threshold: float = 10.0) -> list[float]:
    cw, ch, x, y = geo.crop
    vf = f"crop={cw}:{ch}:{x}:{y},scale={geo.aw}:{geo.ah},scdet=threshold={threshold}:sc_pass=0"
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-an", "-vf", vf, "-f", "null", "-"],
                       capture_output=True, text=True, timeout=900)
    return [float(m.group(1)) for m in re.finditer(r"lavfi\.scd\.time:\s*([0-9.]+)", r.stderr)]
