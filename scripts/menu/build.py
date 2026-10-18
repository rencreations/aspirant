"""
Builds the menu portraits.

Source: D:/ren/aspirant/media/others/menu (ten transparent PNG busts, uneven size and crop).
Output: apps/web/public/img/menu/<slug>.webp, one per menu item side.

Every portrait is scaled so the distance from the eye to the chin is the same, then placed on a
fixed canvas with the eye at the same height. That keeps all ten figures the same size and puts
both eyes of a pair on one horizontal line. "left" art faces right and sits left of the title;
"right" art faces left and sits right of it, so the eye is placed near the inner edge.

The eye and chin points are measured on the sources (zoomed face crops with a 20 px grid).
`vexana-left.png` is Selena (checked against her splash art), so it is saved as selena.

Run: python -I scripts/menu/build.py "D:/ren/aspirant/media/others/menu"
"""

import sys
from pathlib import Path

from PIL import Image

CANVAS_W, CANVAS_H = 720, 980
EYE_TO_CHIN = 120  # target eye-to-chin distance on the canvas, in px
EYE_Y = 372  # eye height on the canvas
EYE_X = {"left": 520, "right": 200}  # near the inner edge, where the face looks

# slug -> (source file, side, eye x, eye y, chin y) measured on the source.
PORTRAITS = {
    "fanny": ("fanny-left.png", "left", 901, 430, 564),
    "layla": ("layla-right.png", "right", 272, 476, 642),
    "angela": ("angela-left.png", "left", 792, 374, 522),
    "ruby": ("ruby-right.png", "right", 376, 421, 612),
    "change": ("change-left.png", "left", 913, 547, 668),
    "lesley": ("lesley-right.png", "right", 220, 407, 578),
    "guinevere": ("guinevere-left.png", "left", 1129, 335, 456),
    "vexana": ("vexana-right.png", "right", 353, 386, 515),
    "selena": ("vexana-left.png", "left", 1162, 274, 422),
    "obsidia": ("obsidia-right.png", "right", 453, 307, 378),
}


def build(src_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for slug, (file, side, ex, ey, cy) in PORTRAITS.items():
        im = Image.open(src_dir / file).convert("RGBA")
        k = EYE_TO_CHIN / (cy - ey)
        scaled = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        ox = round(EYE_X[side] - ex * k)
        oy = round(EYE_Y - ey * k)
        # Clip the part of the art that falls outside the canvas, then place the rest.
        sx, sy = max(-ox, 0), max(-oy, 0)
        part = scaled.crop((sx, sy, min(scaled.width, sx + CANVAS_W), min(scaled.height, sy + CANVAS_H)))
        canvas.alpha_composite(part, (max(ox, 0), max(oy, 0)))
        target = out_dir / f"{slug}.webp"
        canvas.save(target, "WEBP", quality=80, method=6)
        print(f"{slug:10} k={k:.2f} {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    build(Path(sys.argv[1]), root / "apps" / "web" / "public" / "img" / "menu")
