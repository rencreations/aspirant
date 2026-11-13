"""The pieces of the two official stages of the comic room: panels cut from the comics' own pages and
chibi stickers with a see-through ground.

    C:/Users/muham/anaconda3/python.exe scripts/library/comic/stage.py [--force]

Reads the original page files in D:\\ren\\aspirant\\story\\official\\ (never changes them) and the chibi
folders of D:\\ren\\aspirant\\media\\_all\\. Writes into the mirror, under comic/stage/v1/:

    panel/<name>/p.webp, f.webp      a panel (720 and 1280 wide at most, never enlarged)
    chibi/<name>.webp                a sticker, cut to its edges, with a white outline when asked

and scripts/library/comic/stage.meta.json, which comic/build.py puts in comic.json as `stage`.

The boxes are in the pixels of the original page (The Aspirant is 1000 wide, Guinevere and Vexana 2500
wide). A box was chosen by looking at the page with a ruler; the picture is the comic's own, so no
frame, bubble or word is added, and nothing of a page that gives more of the story away than the page
itself does. A chibi file is used only when its ground is really transparent (checked here: a file
with no transparent pixel is refused).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

HERE = Path(__file__).resolve().parent
META = HERE / "stage.meta.json"
OFFICIAL = common.STORY / "official"
CHIBI = common.MEDIA / "_all"
BASE = "comic/stage/v1"
FORCE = "--force" in sys.argv

# name -> (comic folder, page file, (left, top, right, bottom) in the page's pixels, note)
PANELS: dict[str, tuple[str, str, tuple[int, int, int, int], str]] = {
    # ---- The Aspirant (1000 wide) ----
    "as-first": ("the-aspirant-comic", "1.jpg", (0, 0, 1000, 820), "the first panel of the comic: the planet and the first lines"),
    "as-layla-sword": ("the-aspirant-comic", "12.jpg", (0, 120, 1000, 2100), "Layla with her blade"),
    "as-fanny-face": ("the-aspirant-comic", "25.jpg", (0, 80, 580, 1000), "Fanny, set"),
    "as-layla-burst": ("the-aspirant-comic", "32.jpg", (0, 1350, 1000, 2650), "Layla, a star of light"),
    "as-both": ("the-aspirant-comic", "42.jpg", (0, 1350, 1000, 3300), "the two of them at the end"),
    "as-duel": ("the-aspirant-comic", "26.jpg", (0, 850, 1000, 2850), "Fanny above, Layla below"),
    "as-layla-angry": ("the-aspirant-comic", "24.jpg", (0, 230, 1000, 1600), "Layla, furious"),
    # ---- Guinevere and Vexana (2500 wide) ----
    "gv-first": ("guinevere-vexana-comic", "1.jpg", (0, 2250, 2500, 3500), "the first page: fire and the first BANG"),
    "gv-vexana": ("guinevere-vexana-comic", "44.jpg", (500, 3150, 2150, 5550), "Vexana in her dark form"),
    "gv-boom": ("guinevere-vexana-comic", "10.jpg", (100, 2900, 2400, 5000), "Guinevere strikes"),
    "gv-close": ("guinevere-vexana-comic", "32.jpg", (500, 700, 2500, 2400), "the two close, Don't worry"),
    "gv-meadow": ("guinevere-vexana-comic", "31.jpg", (0, 1400, 2500, 3600), "the two in a meadow"),
    "gv-gold": ("guinevere-vexana-comic", "4.jpg", (60, 1180, 1420, 3300), "a long haired figure in golden light"),
    "gv-fall": ("guinevere-vexana-comic", "21.jpg", (0, 1900, 2500, 3300), "falling, upside down, in blue light"),
}

# name -> (folder, file, outline, longest side)
CHIBIS: dict[str, tuple[str, str, bool, int]] = {
    "fl-hearts": ("fanny", "smiling-together-with-layla-with-love.png", True, 760),
    "fl-oval": ("fanny", "smiling-with-layla.png", True, 760),
    "fl-camera": ("fanny", "smiling-at-camera-with-layla.png", True, 560),
    "gv-pair": ("vexana-black-hair", "46.png", False, 760),
    "gv-pair-outlined": ("vexana-black-hair", "46.png", True, 760),
    "gv-love": ("guinevere", "in-love.png", True, 520),
    "gv-vexana-head": ("vexana-black-hair", "30-2.png", True, 560),
    "gv-talking": ("guinevere", "talking.png", True, 560),
}


def dominant(im: Image.Image) -> str:
    small = im.convert("RGB").resize((24, 24), Image.LANCZOS)
    r, g, b = np.asarray(small, dtype=float).reshape(-1, 3).mean(axis=0)
    return f"#{int(r):02x}{int(g):02x}{int(b):02x}"


def panel(name: str) -> dict:
    folder, file, box, note = PANELS[name]
    src = OFFICIAL / folder / file
    out_p = common.key_path(f"{BASE}/panel/{name}/p.webp")
    out_f = common.key_path(f"{BASE}/panel/{name}/f.webp")
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        l, t, r, b = box
        if not (0 <= l < r <= w and 0 <= t < b <= h):
            raise SystemExit(f"{name}: the box {box} is outside {file} ({w} by {h})")
        crop = im.crop(box)
    cw, ch = crop.size
    sizes = {}
    for key, out, wide in (("p", out_p, 720), ("f", out_f, 1280)):
        if out.exists() and not FORCE:
            with Image.open(out) as o:
                sizes[key] = o.size
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        im2 = crop if cw <= wide else crop.resize((wide, round(ch * wide / cw)), Image.LANCZOS)
        im2.save(out, "WEBP", quality=84 if key == "f" else 82, method=6)
        sizes[key] = im2.size
    return {
        "p": f"{BASE}/panel/{name}/p.webp",
        "f": f"{BASE}/panel/{name}/f.webp",
        "w": cw,
        "h": ch,
        "c": dominant(crop),
        "note": note,
    }


def outline_of(im: Image.Image, grow: int) -> Image.Image:
    """The picture with a white edge `grow` pixels wide around its opaque part."""
    alpha = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    # Grow the shape by blurring and thresholding, so the edge is round.
    big = alpha.filter(ImageFilter.MaxFilter(3))
    for _ in range(max(1, grow // 2)):
        big = big.filter(ImageFilter.MaxFilter(5))
    big = big.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v > 110 else 0)
    ground = Image.new("RGBA", im.size, (255, 255, 255, 0))
    ground.putalpha(big)
    ground.paste((255, 255, 255, 255), mask=big)
    ground.alpha_composite(im)
    return ground


def chibi(name: str) -> dict:
    folder, file, outline, longest = CHIBIS[name]
    src = CHIBI / folder / "chibi" / file
    out = common.key_path(f"{BASE}/chibi/{name}.webp")
    with Image.open(src) as im:
        im = im.convert("RGBA")
        alpha = np.asarray(im.getchannel("A"))
        if (alpha < 250).mean() < 0.02:
            raise SystemExit(f"{name}: {file} has no transparent ground, so it is not used")
        box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if box is None:
            raise SystemExit(f"{name}: {file} is empty")
        pad = 4
        l, t, r, b = box
        im = im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))
    scale = min(1.0, longest / max(im.size))
    if scale < 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if outline:
        # The edge is about 1.1 percent of the long side, made at the final size.
        grow = max(4, round(max(im.size) * 0.011))
        padded = Image.new("RGBA", (im.width + grow * 4, im.height + grow * 4), (0, 0, 0, 0))
        padded.paste(im, (grow * 2, grow * 2))
        im = outline_of(padded, grow)
        box = im.getchannel("A").getbbox()
        if box:
            im = im.crop(box)
    if not out.exists() or FORCE:
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, "WEBP", quality=88, method=6, lossless=False)
    return {"src": f"{BASE}/chibi/{name}.webp", "w": im.width, "h": im.height}


def main() -> None:
    meta = {
        "panels": {name: panel(name) for name in PANELS},
        "chibi": {name: chibi(name) for name in CHIBIS},
    }
    META.write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in (common.LIB_ROOT / "comic" / "stage").rglob("*") if p.is_file())
    print(f"{len(PANELS)} panels, {len(CHIBIS)} chibi, {common.human(total)} in the mirror; wrote stage.meta.json")


if __name__ == "__main__":
    main()
