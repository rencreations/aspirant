"""
Measures how the camera of each recording differs from the idle recording at the places where
the stage hands over between them (a clip's idle head against the idle loop, and its idle tail
against the idle loop). The recordings were made one by one, and the camera in some of them sits a
little closer or farther than in the idle one. Even where the pose matches, that shows as a pop at
the hand-over, so the stage eases the scale of the clip to match for the moment of the dissolve.

For each pair it searches a zoom (about the middle of the picture) and a shift that make the clip
frame closest to the idle frame, on a 960x432 grey copy, and prints the transform that maps the
clip onto the idle picture. The numbers are kept in `ALIGN` in build.py.

Run: python -I scripts/obsidia/align.py "C:/Users/muham/Videos/obsidia"
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import LOOP_FRAMES, LOOP_START, SHORTS_AND_PAGES  # noqa: E402

W, H = 960, 432


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


def search(clip: np.ndarray, idle: np.ndarray, scales, shifts) -> tuple[float, float, float, float]:
    inner = (slice(24, -24), slice(24, -24))
    top = (1e18, 1.0, 0.0, 0.0)
    for s in scales:
        for tx in shifts:
            for ty in shifts:
                m = float(((warp(clip, s, tx, ty) - idle)[inner] ** 2).mean())
                if m < top[0]:
                    top = (m, float(s), float(tx), float(ty))
    return top


def best(clip: np.ndarray, idle: np.ndarray) -> tuple[float, float, float, float, float]:
    inner = (slice(24, -24), slice(24, -24))
    base = float(((clip - idle)[inner] ** 2).mean())
    m, s, tx, ty = search(clip, idle, np.arange(0.90, 1.101, 0.01), np.arange(-8, 8.1, 2.0))
    m, s, tx, ty = search(clip, idle, np.arange(s - 0.012, s + 0.0121, 0.002), np.arange(tx - 2, tx + 2.1, 1.0) if False else [tx - 1, tx, tx + 1])
    return (base, m, s, tx, ty)


def main() -> None:
    src = Path(sys.argv[1])
    for name, c in SHORTS_AND_PAGES.items():
        row = [name]
        for label, cn, phase in (
            ("head", c["head_end"] - 100, (c["head_end"] - 100 + c["c_head"]) % LOOP_FRAMES),
            ("tail", c["e0"] + 6, (c["e0"] + 6 + c["c_tail"]) % LOOP_FRAMES),
        ):
            clip = frame(src / c["file"], cn)
            idle = frame(src / "idle.mkv", LOOP_START + phase)
            base, m, s, tx, ty = best(clip, idle)
            row.append(f"{label}: mse {base:.0f} -> {m:.0f} scale {s:.4f} shift ({tx:+.0f},{ty:+.0f}) of 960")
        print(" | ".join(row), flush=True)


if __name__ == "__main__":
    main()
