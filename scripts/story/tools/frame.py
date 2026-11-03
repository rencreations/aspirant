"""Extract one frame of a video to look at (or to check a crop).

    python scripts/story/tools/frame.py <video> <seconds> [--crop X Y W H] [--width 1280]

Prints the path of the PNG it wrote. `<video>` is relative to the media root.
"""

from __future__ import annotations

import argparse
import subprocess

from common import out_name, resolve


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("t", type=float)
    ap.add_argument("--crop", nargs=4, type=int, metavar=("X", "Y", "W", "H"))
    ap.add_argument("--width", type=int, default=1280)
    args = ap.parse_args()
    src = resolve(args.video)
    vf = []
    if args.crop:
        x, y, w, h = args.crop
        vf.append(f"crop={w}:{h}:{x}:{y}")
    vf.append(f"scale='min({args.width},iw)':-2")
    out = out_name(f"frame-{src.parent.name}-{src.stem}-{args.t:.2f}", "png")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", str(args.t), "-i", str(src), "-frames:v", "1",
         "-vf", ",".join(vf), str(out)],
        check=True,
    )
    print(out)


if __name__ == "__main__":
    main()
