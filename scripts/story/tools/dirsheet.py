"""A contact sheet of every image in a folder (and its sub-folders), with the file names.

    python scripts/story/tools/dirsheet.py <folder> [--cols 4] [--cell 360] [--max 40] [--page 1]

Prints the sheet path(s). Use it to look over art folders (places, characters, official art)
without opening each file. Page through big folders with --page.
"""

from __future__ import annotations

import argparse

from PIL import Image, ImageDraw

from common import MEDIA, out_name, resolve

EXT = {".png", ".jpg", ".jpeg", ".webp"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--cell", type=int, default=360)
    ap.add_argument("--max", type=int, default=40)
    ap.add_argument("--page", type=int, default=1)
    args = ap.parse_args()
    root = resolve(args.folder)
    files = sorted(p for p in root.rglob("*") if p.suffix.lower() in EXT)
    start = (args.page - 1) * args.max
    files = files[start : start + args.max]
    if not files:
        raise SystemExit("no images")
    cell = args.cell
    label_h = 30
    cols = min(args.cols, len(files))
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + label_h)), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(files):
        try:
            im = Image.open(p)
            size = im.size
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (60, 60, 60, 255))
            bg.alpha_composite(im)
            im = bg.convert("RGB")
            im.thumbnail((cell - 6, cell - 6))
        except Exception as exc:  # noqa: BLE001
            draw.text(((i % cols) * cell + 4, (i // cols) * (cell + label_h) + 4), f"ERR {p.name} {exc}", fill=(255, 90, 90))
            continue
        x, y = (i % cols) * cell, (i // cols) * (cell + label_h)
        sheet.paste(im, (x + 3, y + label_h))
        try:
            rel = p.relative_to(MEDIA).as_posix()
        except ValueError:
            rel = p.as_posix()
        draw.text((x + 4, y + 2), f"{i + start + 1}. {p.name[:44]}", fill=(255, 220, 120))
        draw.text((x + 4, y + 15), f"{size[0]}x{size[1]}", fill=(170, 170, 170))
    out = out_name(f"dir-{root.name}-p{args.page}", "jpg")
    sheet.save(out, quality=80)
    print(f"{out}  ({len(files)} images on this page)")


if __name__ == "__main__":
    main()
