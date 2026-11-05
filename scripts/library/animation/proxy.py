"""
Decodes the in-game animation recordings of one character to small grey proxies (320x144, one
uint8 per pixel) kept as .npy files, so the analysis can compare frames in seconds instead of
decoding 4K video again. `stage.py` imports `load()` from here.

Source: D:/ren/aspirant/media/_others/in-game-animation/<slug>/*.mkv (3840x1728, 60 fps).
Cache:  D:/ren/aspirant-work/animation/<slug>/proxy/<name>.npy  (frames x 144 x 320, uint8)

Run: C:/Users/muham/anaconda3/python.exe scripts/library/animation/proxy.py <slug> [<slug> ...]
"""

from __future__ import annotations

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

W, H = 320, 144
SRC = Path(r"D:\ren\aspirant\media\_others\in-game-animation")
WORK = Path(r"D:\ren\aspirant-work\animation")


def proxy_path(slug: str, name: str) -> Path:
    return WORK / slug / "proxy" / f"{name}.npy"


def make(slug: str, name: str) -> Path:
    """Decode one recording to its proxy array (skipped when it exists)."""
    dest = proxy_path(slug, name)
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = SRC / slug / f"{name}.mkv"
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"scale={W}:{H}:flags=area,format=gray",
         "-f", "rawvideo", "-"],
        capture_output=True,
    )
    if p.returncode:
        raise SystemExit(p.stderr.decode(errors="replace"))
    a = np.frombuffer(p.stdout, dtype=np.uint8)
    n = len(a) // (W * H)
    np.save(dest, a[: n * W * H].reshape(n, H, W))
    print(slug, name, n, flush=True)
    return dest


def load(slug: str, name: str) -> np.ndarray:
    """The proxy array of a recording, made first when it does not exist."""
    return np.load(make(slug, name))


def names(slug: str) -> list[str]:
    return sorted(f.stem for f in (SRC / slug).glob("*.mkv"))


def main() -> None:
    jobs = [(s, n) for s in sys.argv[1:] for n in names(s)]
    with ThreadPoolExecutor(2) as ex:
        list(ex.map(lambda j: make(*j), jobs))


if __name__ == "__main__":
    main()
