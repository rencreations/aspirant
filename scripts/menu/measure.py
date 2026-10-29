"""
Measuring helper for the menu art (see build.py).

build.py needs, for each source picture, the eye (x, y) and the chin (y) in the pixels of the
source. This crops a part of a source picture, puts it on a grey background and draws a grid
whose lines carry the pixel numbers of the SOURCE, so the numbers can be read off the picture.

Run (from the repository root, with the anaconda Python that has Pillow):
    python scripts/menu/measure.py "D:/ren/aspirant/media/others/menu" home-left 1000 900 1500 1500 out.png
        arguments: source folder, name without .png, x0 y0 x1 y1 of the crop, output file,
        then optionally the grid step in px (default 25) and the zoom (default 1.3).

How it was done: first a crop of the head (about 460 x 570 px around the face) for each picture,
then read the middle of the iris and the lowest point of the chin. Eye to chin is about 130 to
320 px depending on how big the head is drawn. Put the numbers in `PORTRAITS` in build.py, run
build.py, and check the pairs side by side with a line on the eye height.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw


def grid(src: Path, box: tuple[int, int, int, int], out: Path, step: int = 25, zoom: float = 1.3) -> None:
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, (170, 170, 180, 255))
    bg.alpha_composite(im)
    x0, y0, x1, y1 = box
    crop = bg.crop(box).convert("RGB")
    crop = crop.resize((round(crop.width * zoom), round(crop.height * zoom)), Image.LANCZOS)
    draw = ImageDraw.Draw(crop)
    gx = (x0 // step + 1) * step
    while gx < x1:
        x = (gx - x0) * zoom
        draw.line([(x, 0), (x, crop.height)], fill=(255, 0, 0) if gx % 100 == 0 else (255, 160, 160))
        if gx % 50 == 0:
            draw.text((x + 2, 2), str(gx), fill=(255, 255, 0))
        gx += step
    gy = (y0 // step + 1) * step
    while gy < y1:
        y = (gy - y0) * zoom
        draw.line([(0, y), (crop.width, y)], fill=(0, 0, 255) if gy % 100 == 0 else (160, 160, 255))
        if gy % 50 == 0:
            draw.text((2, y + 2), str(gy), fill=(255, 255, 0))
        gy += step
    crop.save(out)


if __name__ == "__main__":
    folder, name = Path(sys.argv[1]), sys.argv[2]
    box = tuple(int(v) for v in sys.argv[3:7])
    grid(
        folder / f"{name}.png",
        box,  # type: ignore[arg-type]
        Path(sys.argv[7]),
        int(sys.argv[8]) if len(sys.argv) > 8 else 25,
        float(sys.argv[9]) if len(sys.argv) > 9 else 1.3,
    )
