"""
Builds the pictures of Obsidia's interface (public/img/obsidia/ui/*.webp) from images made with the
Codex image tool. The sources are not kept in the repository (about 800 KB each). To make them
again, ask for one image each, on a plain black background, and save them as <name>.png in one
folder:

  eclipse  A solar eclipse emblem, centred and symmetrical: a pure black disc with a thin molten
           gold corona ring, fine gold rays and tiny diamond sparks, a faint crimson glow at the rim.
  veins    A seamless tileable square texture of polished black obsidian glass with fine golden
           kintsugi veins and a few faint crimson cracks, very dark and low in contrast.
  corner   An ornate top-left corner ornament of black thorny vines with fine gold edging and a few
           small diamond jewels.

The Codex tool returns a PNG with an alpha channel whose edge carries a red fringe (it was keyed
out of a coloured ground). This script hardens the alpha (smoothstep), eats the fringe (a two pixel
erosion), and lets the colour of the object run into the edge before it scales the picture down.

Run: python -I scripts/obsidia/ui-assets.py <folder with the png files>
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# name -> (longest edge in pixels, quality)
SPRITES = {
    "eclipse": (512, 86),
    "corner": (640, 86),
}
TEXTURES = {"veins": (768, 72)}
# Pictures that come without an alpha channel (gold on a black ground): the brightness is the alpha.
LIGHT_ON_BLACK = {"corner"}


def clean(src: Path) -> Image.Image:
    raw = Image.open(src)
    if raw.mode != "RGBA" or src.stem in LIGHT_ON_BLACK:
        rgb = np.asarray(raw.convert("RGB"), dtype=np.float32)
        alpha = np.clip(rgb.max(axis=2) / 190.0, 0.0, 1.0) ** 0.85
        out = raw.convert("RGBA")
        out.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
        return out
    im = raw.convert("RGBA")
    a = np.asarray(im.getchannel("A"), dtype=np.float32) / 255.0
    t = np.clip((a - 0.25) / 0.55, 0.0, 1.0)
    t = t * t * (3 - 2 * t)
    alpha = Image.fromarray((t * 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MinFilter(3))
    # Colour: where the picture was thin, take the colour of the nearest solid pixel.
    rgb = im.convert("RGB")
    solid = np.asarray(alpha) > 200
    arr = np.asarray(rgb).copy()
    for _ in range(3):
        grown = np.asarray(Image.fromarray(arr).filter(ImageFilter.MaxFilter(3)))
        arr = np.where(solid[..., None], arr, grown)
        solid = solid | (np.asarray(Image.fromarray(solid.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0)
    out = Image.fromarray(arr).convert("RGBA")
    out.putalpha(alpha)
    return out


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def main() -> None:
    src = Path(sys.argv[1])
    root = Path(__file__).resolve().parents[2]
    out = root / "apps" / "web" / "public" / "img" / "obsidia" / "ui"
    out.mkdir(parents=True, exist_ok=True)
    for name, (edge, q) in SPRITES.items():
        f = src / f"{name}.png"
        if not f.exists():
            print("missing", f)
            continue
        im = trim(clean(f))
        # Scale with premultiplied colour, so the edge does not pick up the colour behind it.
        pm = im.convert("RGBa")
        pm.thumbnail((edge, edge), Image.LANCZOS)
        pm.convert("RGBA").save(out / f"{name}.webp", quality=q, method=6)
    for name, (edge, q) in TEXTURES.items():
        f = src / f"{name}.png"
        if not f.exists():
            print("missing", f)
            continue
        im = Image.open(f).convert("RGB")
        im.thumbnail((edge, edge), Image.LANCZOS)
        im.save(out / f"{name}.webp", quality=q, method=6)
    for f in sorted(out.glob("*.webp")):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
