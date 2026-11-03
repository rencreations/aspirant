"""Preview a crop of an image exactly as the build would cut it.

    python scripts/story/tools/crop.py <image> X Y W H [--width 1000]

Prints the path of the JPEG it wrote (the crop box is in source pixels).
"""

from __future__ import annotations

import argparse

from PIL import Image

from common import out_name, resolve


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("x", type=int)
    ap.add_argument("y", type=int)
    ap.add_argument("w", type=int)
    ap.add_argument("h", type=int)
    ap.add_argument("--width", type=int, default=1000)
    args = ap.parse_args()
    src = resolve(args.image)
    im = Image.open(src).convert("RGB")
    if args.x < 0 or args.y < 0 or args.x + args.w > im.width or args.y + args.h > im.height:
        raise SystemExit(f"crop outside the image ({im.width}x{im.height})")
    part = im.crop((args.x, args.y, args.x + args.w, args.y + args.h))
    if part.width > args.width:
        part = part.resize((args.width, round(part.height * args.width / part.width)))
    out = out_name(f"crop-{src.parent.name}-{src.stem}-{args.x}-{args.y}-{args.w}-{args.h}", "jpg")
    part.save(out, quality=86)
    print(out)


if __name__ == "__main__":
    main()
