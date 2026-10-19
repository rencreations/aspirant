"""
Measures how the camera of each recording differs from the idle recording at the places where
the stage hands over between them (a clip's first frame against the idle loop, and a clip's tail
against the idle loop). The recordings were made one by one, and the camera in some of them sits a
fraction of a percent closer or farther than in the idle one. Even where the pose matches, that
shows as a pop at the hand-over, so the stage eases the clip's scale to match for the moment of
the dissolve.

For each pair it searches a zoom (about the middle of the picture) and a shift that make the clip
frame closest to the idle frame, on a 960x432 grey copy, and prints the transform that maps the
clip onto the idle picture. The numbers are kept in `ALIGN` in build.py.

Run: python -I scripts/selena/align.py "C:/Users/muham/Videos/selena"
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 960, 432
LOOP_START = 1471

# name -> (file, a0, idle phase of the first frame, tail frame, idle phase of the tail frame)
# The tail frame is 6 frames into the window that matches the idle loop (see OUT_TAIL in build.py).
PAIRS = {
    "about": ("phone-empty.mkv", 385, 160, 1684, 187),
    "skills": ("horizontal.mkv", 420, 122, 2185, 203),
    "gallery": ("vertical.mkv", 345, 124, 2403, 83),
    "short-1": ("short-1.mkv", 339, 42, 776, 345),
    "short-2": ("short-2.mkv", 412, 22, 851, 183),
    "short-3": ("short-3.mkv", 486, 19, 955, 397),
}


def frame(path: Path, n: int) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"select=eq(n\\,{n}),scale={W}:{H}:flags=area,format=gray",
         "-frames:v", "1", "-f", "rawvideo", "-"],
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(H, W).astype(np.float32)


def warp(img: np.ndarray, s: float, tx: float, ty: float) -> np.ndarray:
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2, H / 2
    return ndi.map_coordinates(img, [cy + (ys - cy) / s - ty, cx + (xs - cx) / s - tx], order=1, mode="nearest")


def best(clip: np.ndarray, idle: np.ndarray) -> tuple[float, float, float, float, float]:
    inner = (slice(24, -24), slice(24, -24))
    base = float(((clip - idle)[inner] ** 2).mean())
    top = (1e18, 1.0, 0.0, 0.0)
    for s in np.arange(0.98, 1.0201, 0.0025):
        for tx in np.arange(-4, 4.1, 1.0):
            for ty in np.arange(-4, 4.1, 1.0):
                m = float(((warp(clip, s, tx, ty) - idle)[inner] ** 2).mean())
                if m < top[0]:
                    top = (m, float(s), float(tx), float(ty))
    return (base, *top)


def main() -> None:
    src = Path(sys.argv[1])
    for name, (file, a0, p0, tail, p1) in PAIRS.items():
        idle_path = src / "idle.mkv"
        row = [name]
        for label, cn, ip in (("start", a0, p0), ("end", tail, p1)):
            c = frame(src / file, cn)
            i = frame(idle_path, LOOP_START + ip)
            base, m, s, tx, ty = best(c, i)
            row.append(f"{label}: mse {base:.0f} -> {m:.0f} scale {s:.4f} shift ({tx:+.0f},{ty:+.0f}) of 960")
        print(" | ".join(row), flush=True)


if __name__ == "__main__":
    main()
