"""The Mobile Legends: Bang Bang logo for the home page's line "[logo] original anime inspired skin series".

    C:/Users/muham/anaconda3/python.exe scripts/home/media/logo.py [path to mlbb.png]

The owner's file is a raster (RGBA, 555x167, orange to yellow). It is saved as lossless WebP at its own size, with
nothing added: scaling a raster up adds no detail, so a crisp 2x needs a bigger or vector source from the owner.
Shown at 270 CSS px wide or less it is sharp at 2x; at the size of a line of text (about 1.1em tall) it is a
reduction and is sharp at any ratio.

Writes   apps/web/public/img/home/mlbb.webp
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

import hcommon as h

DEFAULT = Path(r"C:\Users\muham\Downloads\mlbb.png")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    im = Image.open(src).convert("RGBA")
    out = h.ensure(h.IMG / "mlbb.webp")
    im.save(out, "WEBP", lossless=True, quality=100, method=6, exact=True)
    back = Image.open(out).convert("RGBA")
    same = list(back.getdata()) == list(im.getdata())
    print(f"{src.name} {im.size[0]}x{im.size[1]} -> {out.relative_to(h.REPO)} {out.stat().st_size / 1024:.1f} KB, pixels identical: {same}")
    if not same:
        raise SystemExit("the lossless copy differs from the source")


if __name__ == "__main__":
    main()
