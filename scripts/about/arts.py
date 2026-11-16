"""Two pictures of the About page that the site did not hold yet.

1. The key art of the first phase, for its art wall. The other pictures of the walls are official
   art the site already carries (public/img/char, public/img/pair); this one is copied from the
   source folder as WebP.
2. TheMLabel's mark, set into the description of the first screen (the owner's file). The mark is
   made for a dark ground: its letters are bright silver and vanish on the page's light paper. So
   the letters are redrawn in ink, keeping the metal's own shading from edge to face, and the
   orange M is left exactly as it is.

    python scripts/about/arts.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "web" / "public" / "img" / "about"

KEY_ART = Path(r"D:\ren\aspirant\media\layla-and-fanny\art\official\969a9185060671723ac4bb4ebdb1d5df.jpg")
LOGO = Path(r"C:\Users\muham\Downloads\image (15) (1).png")

# The ink of the letters: from their dark edge to their bright face.
INK_EDGE = (28, 31, 40)
INK_FACE = (92, 98, 112)
LOGO_WIDTH = 720


def key_art() -> None:
    picture = Image.open(KEY_ART).convert("RGB")
    target = OUT / "arts" / "the-aspirants-key-art.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    picture.save(target, "WEBP", quality=88, method=6)
    print(target, picture.size, target.stat().st_size)


def logo() -> None:
    mark = Image.open(LOGO).convert("RGBA")
    mark = mark.crop(mark.getbbox())
    px = np.asarray(mark).astype(np.float32)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    high = np.maximum(np.maximum(r, g), b)
    low = np.minimum(np.minimum(r, g), b)
    colourless = np.where(high > 0, (high - low) / np.maximum(high, 1), 0) < 0.22
    light = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    t = np.clip((light - 0.45) / 0.55, 0, 1)[..., None]
    ink = np.array(INK_EDGE, np.float32) + (np.array(INK_FACE, np.float32) - np.array(INK_EDGE, np.float32)) * t
    px[..., :3] = np.where(colourless[..., None], ink, px[..., :3])
    out = Image.fromarray(px.astype(np.uint8), "RGBA")
    out = out.resize((LOGO_WIDTH, round(out.height * LOGO_WIDTH / out.width)), Image.LANCZOS)
    target = OUT / "themlabel.webp"
    out.save(target, "WEBP", quality=92, method=6)
    print(target, out.size, target.stat().st_size)


if __name__ == "__main__":
    key_art()
    logo()
