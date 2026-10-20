"""
Decodes the Obsidia recordings to small grey proxies (320x144, one uint8 per pixel) kept as .npy
files, so the analysis scripts can compare frames in seconds instead of decoding 4K video again.

Run: python -I scripts/obsidia/proxy.py "C:/Users/muham/Videos/obsidia" <out dir>
"""

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

W, H = 320, 144


def proxy(src: Path, dest: Path) -> None:
    if dest.exists():
        return
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"],
        capture_output=True,
    )
    a = np.frombuffer(p.stdout, dtype=np.uint8)
    n = len(a) // (W * H)
    np.save(dest, a[: n * W * H].reshape(n, H, W))
    print(src.name, n, flush=True)


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(src.glob("*.mkv"))
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda f: proxy(f, out / f"{f.stem}.npy"), files))


if __name__ == "__main__":
    main()
