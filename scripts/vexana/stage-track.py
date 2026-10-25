"""Tracks the touch points of Vexana's room through the idle loop.

The idle animation sways the camera, so a dot placed once would slide off the Guardian's chest, her
hand or her hair. This follows a patch of the picture around each point from frame to frame (phase
correlation) and writes where the point is at every second frame of the loop. The room reads it at
the idle video's time, so each dot stays on its spot.

The loop is seamless (its last frames dissolve into its first), so the point ends where it began.
Whatever the tracking has drifted by is taken out in a straight ramp, then the path is smoothed.

Run: python -I scripts/vexana/stage-track.py   (with a Python that has numpy: Python 3.13 here)
Reads the idle loop frames from the zoom recording (the loop's source, see stage.py) and writes
apps/web/src/features/character/vexana/room/hotspots.generated.ts.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

W, H = 960, 432  # tracking size (a quarter of the source)
PATCH = 96
STEP = 2  # frames between stored samples (162 frames of the loop make 81 samples)
LOOP_START, LOOP_FRAMES = 93, 162  # keep in step with stage.py
SRC = Path("C:/Users/muham/Videos/vexana/zoom.mkv")

# id -> (x, y) as a fraction of the picture, on the first frame of the loop
#   left-hand  her left hand (the viewer's right), the gold gauntlet at her hip (left-hand.mkv)
#   big-thing  the Guardian's chest core (big-thing.mkv)
#   face       beside her face, on the hair on the left (face.mkv): not on the face itself
#   pose       the middle of the empty picture on the left, for the "Change pose" button (zoom.mkv)
POINTS = {
    "left-hand": (0.535, 0.500),
    "big-thing": (0.575, 0.260),
    "face": (0.447, 0.285),
    "pose": (0.140, 0.500),
}


def frames():
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(SRC), "-vf",
         "select=between(n\\,%d\\,%d),scale=%d:%d:flags=area,format=gray"
         % (LOOP_START, LOOP_START + LOOP_FRAMES - 1, W, H),
         "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        capture_output=True,
    )
    a = np.frombuffer(p.stdout, dtype=np.uint8)
    n = len(a) // (W * H)
    return a[: n * W * H].reshape(n, H, W).astype(np.float32)


def crop(img: np.ndarray, cx: float, cy: float) -> np.ndarray:
    x0 = min(max(int(round(cx)) - PATCH // 2, 0), W - PATCH)
    y0 = min(max(int(round(cy)) - PATCH // 2, 0), H - PATCH)
    return img[y0 : y0 + PATCH, x0 : x0 + PATCH]


def shift_of(a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
    """How far the content of `b` has moved from `a`: (dx, dy) in pixels, to a tenth of a pixel."""
    fa, fb = np.fft.fft2(a), np.fft.fft2(b)
    r = np.conj(fa) * fb
    r /= np.abs(r) + 1e-9
    c = np.fft.ifft2(r).real
    iy, ix = np.unravel_index(int(np.argmax(c)), c.shape)

    def sub(m1: float, m0: float, p1: float) -> float:
        d = m1 - 2 * m0 + p1
        return 0.0 if abs(d) < 1e-12 else 0.5 * (m1 - p1) / d

    n = PATCH
    dx = ix + sub(c[iy, (ix - 1) % n], c[iy, ix], c[iy, (ix + 1) % n])
    dy = iy + sub(c[(iy - 1) % n, ix], c[iy, ix], c[(iy + 1) % n, ix])
    if dx > n / 2:
        dx -= n
    if dy > n / 2:
        dy -= n
    return float(dx), float(dy)


def self_test() -> None:
    rng = np.random.default_rng(1)
    base = rng.random((PATCH + 8, PATCH + 8)).astype(np.float32)
    win = np.outer(np.hanning(PATCH), np.hanning(PATCH)).astype(np.float32)
    a = base[4 : 4 + PATCH, 4 : 4 + PATCH]
    b = base[2 : 2 + PATCH, 7 : 7 + PATCH]  # content moved 3 px left, 2 px down
    dx, dy = shift_of((a - a.mean()) * win, (b - b.mean()) * win)
    assert abs(dx + 3) < 0.3 and abs(dy - 2) < 0.3, (dx, dy)


def main() -> None:
    self_test()
    imgs = frames()
    n = len(imgs)
    print("frames", n)
    win = np.outer(np.hanning(PATCH), np.hanning(PATCH)).astype(np.float32)
    pos = {k: [(x * W, y * H)] for k, (x, y) in POINTS.items()}
    for i in range(1, n):
        for k in POINTS:
            cx, cy = pos[k][-1]
            a = crop(imgs[i - 1], cx, cy)
            b = crop(imgs[i], cx, cy)
            dx, dy = shift_of((a - a.mean()) * win, (b - b.mean()) * win)
            pos[k].append((cx + dx, cy + dy))
    out = {}
    for k, pts in pos.items():
        a = np.array(pts, dtype=np.float64)
        closure = a[-1] - a[0]
        a = a - np.linspace(0, 1, n)[:, None] * closure[None, :]
        # smooth (a circular moving average, the loop is seamless)
        ker = np.ones(5) / 5
        pad = np.concatenate([a[-2:], a, a[:2]])
        a = np.stack([np.convolve(pad[:, j], ker, mode="valid") for j in range(2)], axis=1)
        print(k, "closure drift px", np.round(closure, 1), "range x", round(float(np.ptp(a[:, 0])), 1), "y", round(float(np.ptp(a[:, 1])), 1))
        norm = np.stack([a[:, 0] / W, a[:, 1] / H], axis=1)
        out[k] = [[round(float(x), 4), round(float(y), 4)] for x, y in norm[::STEP]]

    dest = Path(__file__).resolve().parents[2] / "apps/web/src/features/character/vexana/room/hotspots.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(out)
    ids = " | ".join(f'"{k}"' for k in POINTS)
    dest.write_text(
        "// Generated by scripts/vexana/stage-track.py. Do not edit.\n\n"
        f"/** Frames between two stored positions. */\nexport const HOTSPOT_STEP = {STEP};\n\n"
        "/**\n * Where each touch point is (a fraction of the picture) every `HOTSPOT_STEP` frames of the idle loop.\n"
        " * left-hand opens short-2, big-thing short-3, face short-1, and pose is the middle of the empty\n"
        " * picture on the left, for the Change pose button (the zoom pose).\n */\n"
        f"export const HOTSPOT_PATHS: Record<{ids}, ReadonlyArray<readonly [number, number]>> = {body};\n",
        encoding="utf-8",
    )
    print("wrote", dest)


if __name__ == "__main__":
    main()
