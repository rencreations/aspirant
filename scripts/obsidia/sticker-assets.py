"""
Builds the pictures on Obsidia's buttons: a chibi sticker of her for each page button (About,
Skills, Gallery) and her chain weapon for the Back button, like Selena's pictures and her
Silverbolt. The stickers are the generated images the owner made (transparent PNGs, 1254x1254).

Output: apps/web/public/img/obsidia/btn/{about,skills,gallery,weapon}.webp (420x420)

Run: python -I scripts/obsidia/sticker-assets.py "C:/Users/muham/Downloads"
obs-1.png is About, obs-2.png Skills, obs-3.png Gallery, and the weapon is the generated image
that ends in -4.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/img/obsidia/btn"
NAMES = {1: "about", 2: "skills", 3: "gallery", 4: "weapon"}
SIZE = 420


def sources(folder: Path) -> dict[int, Path]:
    """The three stickers are obs-1.png, obs-2.png and obs-3.png. The weapon on Back has no file
    of that name: it is the newest generated image whose name ends in -4."""
    found = {n: folder / f"obs-{n}.png" for n in (1, 2, 3)}
    weapons = sorted(folder.glob("ChatGPT Image*-4.png"), key=lambda p: p.stat().st_mtime)
    if weapons:
        found[4] = weapons[-1]
    return {n: f for n, f in found.items() if f.exists()}


def main(folder: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for n, src in sorted(sources(folder).items()):
        im = Image.open(src).convert("RGBA")
        # Trim the empty border, then fit a square with a little air round the sticker.
        box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if box:
            im = im.crop(box)
        side = max(im.size)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        sq = sq.resize((SIZE, SIZE), Image.LANCZOS)
        dest = OUT / f"{NAMES[n]}.webp"
        sq.save(dest, "WEBP", quality=80, method=6)
        print(NAMES[n], src.name, dest.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
