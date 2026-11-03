"""Cut a tall comic strip into readable slices, each named with its pixel range.

    python scripts/story/tools/strip.py <image> [--slice 1300] [--overlap 100] [--width 1000]

Prints the source size and one line per slice: the y range in SOURCE pixels and the path of the
preview. Panel crops in a visual script use source pixels: [x, y, w, h].
"""

from __future__ import annotations

import argparse

from PIL import Image

from common import out_name, resolve


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--slice", type=int, default=1300, help="slice height in source pixels")
    ap.add_argument("--overlap", type=int, default=100)
    ap.add_argument("--width", type=int, default=1000, help="preview width")
    args = ap.parse_args()
    src = resolve(args.image)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    print(f"{src.name}: {w}x{h}")
    y = 0
    n = 0
    while y < h:
        y2 = min(y + args.slice, h)
        part = im.crop((0, y, w, y2))
        if w > args.width:
            part = part.resize((args.width, round(part.height * args.width / w)))
        out = out_name(f"strip-{src.parent.name}-{src.stem}-y{y}-{y2}", "jpg")
        part.save(out, quality=84)
        print(f"y {y}-{y2}  {out}")
        n += 1
        if y2 >= h:
            break
        y = y2 - args.overlap
    print(f"{n} slices")


if __name__ == "__main__":
    main()
