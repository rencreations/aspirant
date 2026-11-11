"""The splash art of the Animation room's panels (the picture a panel shows before the welcome).

One picture per character, from the official splash art in the source library (2560 by 1440):

  - the art is kept whole, except the strip on the left that carries the game's logo, which is cut
    off (a crop, never a retouch), so ten panels side by side do not repeat the logo;
  - it is saved as WebP at the source's own height (1440), so a 2560 wide screen shows it at most
    a little enlarged, and ten of them stay under 3 MB;
  - the point of the face is written into `apps/web/src/features/library/animation/splash.ts`
    (between the `splash:begin` and `splash:end` lines), and the page works out from it where to
    hold the picture in a narrow or a short frame, so the character stays in view.

Run:  C:/Users/muham/anaconda3/python.exe scripts/library/animation/splash.py
      ... splash.py --preview D:/ren/aspirant-work/splash-preview   (crops at four screen sizes)

The output is in the repository, `apps/web/public/img/library/animation/splash/<slug>.webp`. The
sources stay read only.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

OUT = common.PUBLIC / "img" / "library" / "animation" / "splash"
TS = common.REPO / "apps" / "web" / "src" / "features" / "library" / "animation" / "splash.ts"
QUALITY = 78
# The game's logo sits in the top left corner of eight of the ten (x 0.02 to 0.125 of the width).
LOGO_TRIM = 0.13

# slug: (source under media/, cut the logo strip, face centre as fractions of the source picture)
SOURCES: dict[str, tuple[str, bool, tuple[float, float]]] = {
    "selena": ("selena-and-obsidia/art/official/selena/selena-splash-art.png", False, (0.665, 0.25)),
    "obsidia": ("selena-and-obsidia/art/official/obsidia/obsidia-splash-art.png", False, (0.485, 0.15)),
    "guinevere": ("vexana-and-guinevere/art/official/guinevere-splash-art.jpg", True, (0.62, 0.35)),
    "vexana": ("vexana-and-guinevere/art/official/vexana-splash-art.jpg", True, (0.6, 0.43)),
    "lesley": ("lesley-and-change/art/official/lesley-splash-art.jpg", True, (0.585, 0.33)),
    "change": ("lesley-and-change/art/official/change-splash-art.jpg", True, (0.62, 0.32)),
    "ruby": ("ruby-and-angela/art/official/ruby-splash-art.jpg", True, (0.44, 0.31)),
    "angela": ("ruby-and-angela/art/official/angela-splash-art.jpg", True, (0.6, 0.27)),
    "layla": ("layla-and-fanny/art/official/layla-splash-art.jpg", True, (0.6, 0.47)),
    "fanny": ("layla-and-fanny/art/official/fanny-splash-art.jpg", True, (0.59, 0.34)),
}

ORDER = ["selena", "obsidia", "guinevere", "vexana", "lesley", "change", "ruby", "angela", "layla", "fanny"]


def build() -> dict[str, dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    table: dict[str, dict] = {}
    total = 0
    for slug in ORDER:
        rel, trim, (fx, fy) = SOURCES[slug]
        src = common.MEDIA / rel
        im = Image.open(src).convert("RGB")
        w, h = im.size
        left = round(w * LOGO_TRIM) if trim else 0
        if left:
            im = im.crop((left, 0, w, h))
        out = OUT / f"{slug}.webp"
        im.save(out, "WEBP", quality=QUALITY, method=6)
        size = out.stat().st_size
        total += size
        cw, ch = im.size
        face = ((fx * w - left) / cw, fy)
        table[slug] = {
            "w": cw,
            "h": ch,
            "face": [round(face[0], 4), round(face[1], 4)],
            "bytes": size,
        }
        print(f"{slug:10} {cw}x{ch}  {size / 1024:6.0f} KB  face {face[0]:.3f} {face[1]:.3f}")
    print(f"total {total / 1024 / 1024:.2f} MB")
    return table


def write_ts(table: dict[str, dict]) -> None:
    """Write the table between the two marker lines of splash.ts."""
    lines = ["// splash:begin (written by scripts/library/animation/splash.py, do not edit by hand)"]
    lines.append("const ART: Readonly<Record<CharacterSlug, Art>> = {")
    for slug in ORDER:
        t = table[slug]
        lines.append(
            f"  {slug}: {{ w: {t['w']}, h: {t['h']}, face: {{ x: {t['face'][0]}, y: {t['face'][1]} }}, bytes: {t['bytes']} }},"
        )
    lines.append("};")
    lines.append("// splash:end")
    text = TS.read_text(encoding="utf-8")
    block = re.compile(r"// splash:begin.*?// splash:end", re.S)
    if not block.search(text):
        raise SystemExit("splash.ts has no splash:begin / splash:end block")
    TS.write_text(block.sub(lambda _: "\n".join(lines), text), encoding="utf-8")


def object_position(face: tuple[float, float], aspect: float) -> tuple[float, float]:
    """The same maths as `framePoint` in splash.ts, for the preview."""
    tall = 390 / 844
    visible_w = min(1.0, tall / aspect)
    left = min(max(face[0] - visible_w / 2, 0.0), 1 - visible_w)
    x = left / (1 - visible_w) if visible_w < 1 else 0.5
    wide = 844 / 390
    visible_h = min(1.0, aspect / wide)
    top = min(max(face[1] - visible_h * 0.4, 0.0), 1 - visible_h)
    y = top / (1 - visible_h) if visible_h < 1 else 0.5
    return x, y


def preview(table: dict[str, dict], where: Path) -> None:
    """Crop each picture as `object-fit: cover` would at four screen sizes, with the face marked."""
    where.mkdir(parents=True, exist_ok=True)
    boxes = [(1440, 900), (390, 844), (844, 390), (820, 1180)]
    for slug in ORDER:
        t = table[slug]
        im = Image.open(OUT / f"{slug}.webp").convert("RGB")
        px, py = object_position((t["face"][0], t["face"][1]), t["w"] / t["h"])
        tiles = []
        for bw, bh in boxes:
            s = max(bw / t["w"], bh / t["h"])
            sw, sh = t["w"] * s, t["h"] * s
            ox, oy = (bw - sw) * px, (bh - sh) * py
            tile = im.resize((round(sw), round(sh))).crop((round(-ox), round(-oy), round(-ox) + bw, round(-oy) + bh))
            d = ImageDraw.Draw(tile)
            fx, fy = t["face"][0] * sw + ox, t["face"][1] * sh + oy
            d.ellipse((fx - 9, fy - 9, fx + 9, fy + 9), outline=(255, 255, 0), width=3)
            k = 360 / bh
            tiles.append(tile.resize((round(bw * k), 360)))
        sheet = Image.new("RGB", (sum(x.width for x in tiles) + 10 * len(tiles), 360), "white")
        x = 0
        for tile in tiles:
            sheet.paste(tile, (x, 0))
            x += tile.width + 10
        sheet.save(where / f"{slug}.jpg", quality=85)
    print(f"previews in {where}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", type=Path, help="write crops at four screen sizes to this folder")
    args = ap.parse_args()
    table = build()
    write_ts(table)
    (common.WORK / "splash.json").write_text(json.dumps(table, indent=2), encoding="utf-8")
    if args.preview:
        preview(table, args.preview)


if __name__ == "__main__":
    main()
