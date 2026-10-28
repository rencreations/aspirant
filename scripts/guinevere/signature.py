"""
Traces Guinevere's signature (a fancy written capital G) from the picture the owner drew into a
filled vector shape, for the opening of her page (`opening/signature.tsx`). The picture is dark ink
on a pale ground. The outline is found at sub-pixel level, simplified a little and written as a
smooth path in a box 760 units wide. The pen strokes that uncover the letter while it is written
are not traced: they are listed in `opening/signature-paths.ts` as rough centre lines, in the box.
This script prints the box and, for the points of each pen stroke given below (in pixels of the
1414 x 2000 preview of the picture), the same points in box units.

Source: C:/Users/muham/Downloads/g.png
Output: apps/web/src/features/character/guinevere/opening/signature-glyph.generated.ts

Needs numpy, Pillow and scikit-image (the anaconda Python on this machine):
  C:/Users/muham/anaconda3/python.exe scripts/guinevere/signature.py
"""

from pathlib import Path

import numpy as np
from PIL import Image
from skimage import measure

SRC = Path("C:/Users/muham/Downloads/g.png")
OUT = (
    Path(__file__).resolve().parents[2]
    / "apps/web/src/features/character/guinevere/opening/signature-glyph.generated.ts"
)
BOX_W = 760
PREVIEW = 1.75  # the preview the owner and I looked at is 1414 px wide; the picture is 2480

# Pen strokes in writing order, as points in preview pixels.
STROKES = {
    "top": [
        (780, 598), (640, 612), (540, 668), (500, 750), (540, 828), (620, 852), (700, 856),
        (820, 830), (960, 770), (1060, 710), (1092, 660), (1050, 622), (960, 640), (840, 710),
        (720, 800), (640, 880), (606, 950), (630, 1010), (700, 1030), (790, 990), (870, 910),
        (948, 862),
    ],
    "stem": [
        (940, 868), (860, 960), (780, 1070), (700, 1170), (610, 1270), (520, 1345), (420, 1400),
        (330, 1380), (295, 1300), (330, 1215), (420, 1140), (530, 1095), (640, 1080), (696, 1110),
        (714, 1190), (680, 1275), (610, 1335), (540, 1352),
    ],
    "curl": [(484, 1190), (458, 1235), (462, 1290), (490, 1330), (520, 1338)],
}


def smooth_path(pts: np.ndarray, closed: bool) -> str:
    """A smooth path through points: quadratic curves between the midpoints."""
    n = len(pts)
    mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    f = lambda p: f"{p[0]:.1f} {p[1]:.1f}"
    if closed:
        start = mid(pts[-1], pts[0])
        parts = [f"M{f(start)}"]
        for i in range(n):
            m = mid(pts[i], pts[(i + 1) % n])
            parts.append(f"Q{f(pts[i])} {f(m)}")
        parts.append("Z")
        return "".join(parts)
    parts = [f"M{f(pts[0])}"]
    for i in range(1, n - 1):
        m = mid(pts[i], pts[i + 1])
        parts.append(f"Q{f(pts[i])} {f(m)}")
    parts.append(f"L{f(pts[-1])}")
    return "".join(parts)


def main() -> None:
    img = np.asarray(Image.open(SRC).convert("L"), dtype=np.float32) / 255.0
    ink = img < 0.5
    ys, xs = np.where(ink)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    scale = BOX_W / (x1 - x0)
    height = (y1 - y0) * scale
    pad = 6
    crop = img[max(0, y0 - pad): y1 + pad + 1, max(0, x0 - pad): x1 + pad + 1]
    ox, oy = max(0, x0 - pad), max(0, y0 - pad)
    level = float((img.min() + img.max()) / 2)
    d = []
    for c in measure.find_contours(crop, level):
        if len(c) < 12:
            continue
        c = measure.approximate_polygon(c, tolerance=0.9)
        pts = np.stack([(c[:, 1] + ox - x0) * scale, (c[:, 0] + oy - y0) * scale], axis=1)
        d.append(smooth_path(pts[:-1] if np.allclose(pts[0], pts[-1]) else pts, True))
    glyph = "".join(d)
    OUT.write_text(
        "/* Made by scripts/guinevere/signature.py from the owner's drawing. Do not edit. */\n"
        f"export const GLYPH_BOX = {{ w: {BOX_W}, h: {round(height)} }} as const;\n\n"
        f'export const GLYPH_D = "{glyph}";\n',
        encoding="utf8",
    )
    print("box", BOX_W, round(height), "path chars", len(glyph))
    for name, pts in STROKES.items():
        conv = [((x * PREVIEW - x0) * scale, (y * PREVIEW - y0) * scale) for x, y in pts]
        length = sum(np.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(conv, conv[1:]))
        print(name, "length", round(length))
        print(smooth_path(np.array(conv), False))


if __name__ == "__main__":
    main()
