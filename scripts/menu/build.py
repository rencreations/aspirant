"""
Builds the menu portraits.

Source: D:/ren/aspirant/media/others/menu, ten transparent PNGs named <page>-<side>.png (home,
experience, story, character, collection; left and right). They differ in size, crop and how big
the head is drawn.
Output: apps/web/public/img/menu/<page>-<side>.webp.

Every figure is scaled so the distance from the eye to the chin is the same (UNIT px on the
canvas, so heads, shoulders and the body below them all share one size; `SIZE` makes a few of
them a little smaller, around the eye) and placed on a fixed
canvas with the eye at the same height. Both eyes of a pair therefore sit on one horizontal line
when the two canvases are placed at the same top. "left" art faces right and stands on the left of
the menu, "right" art faces left and stands on the right, so the eye is placed near the inner edge
of its canvas and the hair and body go out toward the screen edge.

No cut shows. The canvas ends below the hips: the last stretch fades to transparent, the outer
edge fades too, and an edge of the source that is itself a cut (the top of the Character page's
left art) is faded where it lies. The sources are cut flat below the thighs, which the canvas
leaves out.

The eye and chin points are measured on the sources (zoomed face crops with a 25 px grid).

Run: python -I scripts/menu/build.py "D:/ren/aspirant/media/others/menu"
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

UNIT = 130  # eye-to-chin distance on the canvas, in px
ABOVE = 4.4  # units from the eye up to the top of the canvas (the tallest ears and hair)
BELOW = 7.5  # units from the eye down to the bottom of the canvas
OUTER = 6.8  # units from the eye to the outer side (screen edge side)
INNER = 3.2  # units from the eye to the inner side (menu side)
FADE_BOTTOM = 2.6  # the last units above the bottom of the canvas fade out
FADE_OUTER = 1.6  # the last units before the outer edge fade out
FADE_CUT = 0.5  # a cut of the source itself fades over this many units

CANVAS_W = round((OUTER + INNER) * UNIT)
CANVAS_H = round((ABOVE + BELOW) * UNIT)
EYE_Y = round(ABOVE * UNIT)
EYE_X = {"left": round(OUTER * UNIT), "right": round(INNER * UNIT)}

# page, side -> (source file, eye x, eye y, chin y) measured on the source.
PORTRAITS = {
    ("home", "left"): ("home-left.png", 1268, 1078, 1286),
    ("home", "right"): ("home-right.png", 701, 1074, 1393),
    ("experience", "left"): ("experience-left.png", 1395, 1071, 1298),
    ("experience", "right"): ("experience-right.png", 839, 1015, 1235),
    ("story", "left"): ("story-left.png", 1340, 1100, 1311),
    ("story", "right"): ("story-right.png", 955, 1143, 1333),
    ("character", "left"): ("character-left.png", 613, 314, 441),
    ("character", "right"): ("character-right.png", 966, 1133, 1317),
    ("collection", "left"): ("collection-left.png", 1456, 1078, 1290),
    ("collection", "right"): ("collection-right.png", 816, 1009, 1250),
}


# Figures drawn bigger than the others are drawn smaller, around the eye, so the eye line stays.
SIZE = {
    ("experience", "left"): 0.93,
    ("story", "right"): 0.78,
    ("character", "right"): 0.93,
}


def smooth(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def scale(im: Image.Image, k: float) -> Image.Image:
    """Resize with the colour weighted by the alpha, so a soft edge has no halo."""
    size = (round(im.width * k), round(im.height * k))
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def source_cuts(im: Image.Image) -> dict[str, bool]:
    """Which edges of the source picture have art on them (the art was cut there)."""
    a = np.asarray(im)[:, :, 3]
    return {
        "top": bool((a[0] > 20).sum() > 4),
        "bottom": bool((a[-1] > 20).sum() > 4),
        "left": bool((a[:, 0] > 20).sum() > 4),
        "right": bool((a[:, -1] > 20).sum() > 4),
    }


def build_one(src: Path, side: str, ex: int, ey: int, cy: int, size: float = 1.0) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    cuts = source_cuts(im)
    k = UNIT * size / (cy - ey)
    scaled = scale(im, k)
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ox = round(EYE_X[side] - ex * k)
    oy = round(EYE_Y - ey * k)
    sx, sy = max(-ox, 0), max(-oy, 0)
    part = scaled.crop((sx, sy, min(scaled.width, sx + CANVAS_W), min(scaled.height, sy + CANVAS_H)))
    canvas.alpha_composite(part, (max(ox, 0), max(oy, 0)))

    a = np.asarray(canvas).copy()
    h, w = a.shape[:2]
    ys = np.arange(h, dtype=np.float32)[:, None]
    xs = np.arange(w, dtype=np.float32)[None, :]
    mask = np.ones((h, w), dtype=np.float32)
    # The bottom of the canvas: the body fades out, there is no edge.
    mask *= smooth((h - ys) / (FADE_BOTTOM * UNIT))
    # The outer edge: hair and body fade toward the screen edge.
    outer = xs if side == "left" else (w - 1 - xs)
    mask *= smooth(outer / (FADE_OUTER * UNIT))
    # The inner edge fades over a short stretch too (a lock of hair or a tip of armour).
    inner = (w - 1 - xs) if side == "left" else xs
    mask *= smooth(inner / (0.6 * UNIT))
    # The top of the canvas, in case art reaches it.
    mask *= smooth(ys / (0.5 * UNIT))
    # A cut of the source itself, where it lies on the canvas.
    if cuts["top"]:
        mask *= smooth((ys - oy) / (FADE_CUT * UNIT))
    if cuts["bottom"]:
        mask *= smooth((oy + scaled.height - ys) / (FADE_CUT * UNIT))
    if cuts["left"]:
        mask *= smooth((xs - ox) / (FADE_CUT * UNIT))
    if cuts["right"]:
        mask *= smooth((ox + scaled.width - xs) / (FADE_CUT * UNIT))
    a[:, :, 3] = (a[:, :, 3] * mask).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


def build(src_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for (page, side), (file, ex, ey, cy) in PORTRAITS.items():
        out = build_one(src_dir / file, side, ex, ey, cy, SIZE.get((page, side), 1.0))
        target = out_dir / f"{page}-{side}.webp"
        out.save(target, "WEBP", quality=82, method=6)
        print(f"{page:11} {side:5} {out.width}x{out.height} {target.stat().st_size // 1024} KB")
    print(f"eye line {EYE_Y / CANVAS_H:.4f} of the canvas height, canvas {CANVAS_W}x{CANVAS_H}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    build(Path(sys.argv[1]), root / "apps" / "web" / "public" / "img" / "menu")
