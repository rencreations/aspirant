"""A contact sheet of a video: N frames at even intervals, each labelled with its time.

    python scripts/story/tools/sheet.py <video> [--n 12] [--start 0] [--end 8] [--cols 4]

Prints the path of the JPEG it wrote. Use it to choose a moment, then `frame.py` to see it large.
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

from common import out_name, probe, resolve

CELL_W = 400


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--n", type=int, default=12)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--cols", type=int, default=4)
    args = ap.parse_args()
    src = resolve(args.video)
    info = probe(src)
    end = args.end if args.end is not None else (info["duration"] or 1.0)
    span = max(end - args.start, 0.1)
    times = [args.start + span * (i + 0.5) / args.n for i in range(args.n)]
    cells: list[tuple[float, Image.Image]] = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, t in enumerate(times):
            p = Path(tmp) / f"{i}.png"
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(src), "-frames:v", "1",
                 "-vf", f"scale={CELL_W}:-2", str(p)],
                check=False,
            )
            if p.exists():
                cells.append((t, Image.open(p).convert("RGB")))
    if not cells:
        raise SystemExit("no frames")
    cw, ch = cells[0][1].size
    cols = min(args.cols, len(cells))
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (ch + 18)), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)
    for i, (t, im) in enumerate(cells):
        x, y = (i % cols) * cw, (i // cols) * (ch + 18)
        sheet.paste(im, (x, y + 18))
        draw.text((x + 4, y + 3), f"{t:.2f}s", fill=(255, 220, 120))
    out = out_name(f"sheet-{src.parent.name}-{src.stem}-{args.start:.1f}-{end:.1f}", "jpg")
    sheet.save(out, quality=82)
    print(f"{out}  ({info['width']}x{info['height']}, {info['duration']:.2f}s, {info['fps']} fps)")


if __name__ == "__main__":
    main()
