"""The kite of the home page: Tetra's chibi picture trimmed to a clean sail, plus the bows of its tail.

    C:\\Users\\muham\\anaconda3\\python.exe -I scripts\\home\\kite\\build.py [--source PNG] [--out DIR]

Reads D:\\ren\\aspirant\\media\\_all\\angela\\chibi\\tetra.png (read only, RGBA 1667 by 938, the
figure fills 610 by 839 of it) and writes into apps/web/public/img/home/:

    kite.webp        the sail: the figure trimmed, padded and WebP with alpha, colour bled out
                     under the transparent ground so mipmaps and filtering leave no dark rim
    kite.json        size, aspect and the anchor points of the string, the bridle and the tail,
                     in normalised picture coordinates (u from the left, v from the top)
    kite-bows.webp   a strip of three small ribbon bows for the tail (drawn here, 96 by 72 each)

Never edit the outputs by hand: change this script and run it. README.md has the numbers.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

REPO = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE = Path(r"D:\ren\aspirant\media\_all\angela\chibi\tetra.png")
DEFAULT_OUT = REPO / "apps" / "web" / "public" / "img" / "home"

# The opaque box of the source, measured (x 528..1137, y 45..883). The build checks it still holds.
EXPECT_BOX = (528, 45, 1138, 884)
# Room kept round the figure, in pixels of the output: the sail is a plane and the edge of the
# picture must be clear ground, or the wave of the vertex shader shows a straight cut.
PAD = 10
WEBP_QUALITY = 88
# How far the colour of the edge is spread into the transparent ground, in pixels.
BLEED = 24

# Where the page ties things, in the normalised picture (u from the left, v from the top). The
# figure is a flat picture, so these are places on the sail, chosen by looking at it:
#   top       the crown between the ears, where the spine of the kite would start
#   cross     a horizontal spar across the shoulders, hand tip to hand tip
#   bridleTop the upper bridle point, on the hair above the face
#   bridleLow the lower bridle point, low on the belly (the string is tied to the bridle's knot)
#   tail      the feet: the ribbon tail starts at the bottom tip
ANCHORS = {
    "top": (0.5, 0.0),
    "bridleTop": (0.5, 0.30),
    "knot": (0.5, 0.52),
    "bridleLow": (0.5, 0.72),
    "tail": (0.5, 1.0),
    "handLeft": (0.0, 0.80),
    "handRight": (1.0, 0.80),
}


def bleed(rgba: np.ndarray, distance: int) -> np.ndarray:
    """Copy the colour of the nearest opaque pixel into every pixel within `distance` of it."""
    alpha = rgba[..., 3]
    solid = alpha > 200
    # The nearest solid pixel for every pixel: indices of that pixel.
    dist, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    out = rgba.copy()
    near = (~solid) & (dist <= distance)
    out[near, :3] = rgba[iy[near], ix[near], :3]
    # Beyond the bleed the colour is the edge's mean, so a far texel is never black.
    far = (~solid) & (dist > distance)
    out[far, :3] = rgba[solid][:, :3].mean(axis=0).astype(np.uint8)
    return out


def sail(source: Path) -> tuple[Image.Image, dict]:
    im = Image.open(source).convert("RGBA")
    a = np.asarray(im)
    ys, xs = np.where(a[..., 3] > 0)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    if box != EXPECT_BOX:
        sys.exit(f"the source changed: opaque box {box}, expected {EXPECT_BOX}")
    cropped = a[box[1] : box[3], box[0] : box[2]]
    h, w = cropped.shape[:2]
    padded = np.zeros((h + 2 * PAD, w + 2 * PAD, 4), np.uint8)
    padded[PAD : PAD + h, PAD : PAD + w] = cropped
    padded = bleed(padded, BLEED)
    out = Image.fromarray(padded, "RGBA")
    facts = {
        "file": "kite.webp",
        "width": out.width,
        "height": out.height,
        "aspect": round(out.width / out.height, 5),
        "figure": {"x": PAD, "y": PAD, "width": w, "height": h},
        "sourceBox": list(box),
    }
    return out, facts


def bow(colour: tuple[int, int, int], size=(96, 72)) -> Image.Image:
    """A small ribbon bow, drawn at 4 times the size and brought down: two loops and a knot."""
    k = 4
    w, h = size[0] * k, size[1] * k
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = w // 2, h // 2
    dark = tuple(int(c * 0.62) for c in colour)
    light = tuple(min(255, int(c + (255 - c) * 0.45)) for c in colour)
    ink = (31, 39, 53, 255)
    for sign in (-1, 1):
        # A loop is a rounded wedge from the knot out to the side, with a tail beyond it.
        pts = [
            (cx, cy),
            (cx + sign * w * 0.20, cy - h * 0.40),
            (cx + sign * w * 0.46, cy - h * 0.34),
            (cx + sign * w * 0.48, cy + h * 0.34),
            (cx + sign * w * 0.20, cy + h * 0.40),
        ]
        d.polygon(pts, fill=ink)
        inner = [(cx + (x - cx) * 0.86 + sign * 0, cy + (y - cy) * 0.82) for x, y in pts]
        d.polygon(inner, fill=colour + (255,))
        # The fold: a darker half and a light edge.
        d.polygon([inner[0], inner[1], inner[2], (inner[2][0], cy)], fill=light + (255,))
        d.polygon([inner[0], (inner[3][0], cy), inner[3], inner[4]], fill=dark + (255,))
    r = int(h * 0.17)
    d.ellipse((cx - r - 5, cy - r - 5, cx + r + 5, cy + r + 5), fill=ink)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=colour + (255,))
    d.ellipse((cx - r * 0.5, cy - r * 0.7, cx + r * 0.2, cy - r * 0.1), fill=light + (255,))
    return im.filter(ImageFilter.GaussianBlur(0.6)).resize(size, Image.LANCZOS)


def bows() -> tuple[Image.Image, dict]:
    colours = {"pink": (255, 79, 163), "lilac": (190, 170, 240), "cyan": (35, 208, 216)}
    w, h = 96, 72
    strip = Image.new("RGBA", (w * len(colours), h), (0, 0, 0, 0))
    cells = {}
    for i, (name, rgb) in enumerate(colours.items()):
        strip.alpha_composite(bow(rgb, (w, h)), (i * w, 0))
        cells[name] = {"x": i * w, "y": 0, "width": w, "height": h}
    return strip, {"file": "kite-bows.webp", "width": w * len(colours), "height": h, "cells": cells}


def save(im: Image.Image, path: Path, quality: int = WEBP_QUALITY) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    # exact keeps the colour under transparent pixels: that is the bleed.
    im.save(path, "WEBP", quality=quality, alpha_quality=100, method=6, exact=True)
    return path.stat().st_size


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    kite, facts = sail(args.source)
    facts["bytes"] = save(kite, args.out / "kite.webp")
    facts["anchors"] = {k: {"u": u, "v": v} for k, (u, v) in ANCHORS.items()}
    strip, bow_facts = bows()
    bow_facts["bytes"] = save(strip, args.out / "kite-bows.webp", 90)
    facts["bows"] = bow_facts
    (args.out / "kite.json").write_text(json.dumps(facts, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(facts, indent=2))


if __name__ == "__main__":
    main()
