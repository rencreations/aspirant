"""Bakes the doll's maps: the painted face is taken out of them, and the three maps are made small.

    C:\\Users\\muham\\anaconda3\\python.exe -I scripts\\home\\models\\doll\\bake.py DUMP.json FACE.json OUT_DIR

DUMP.json is the source mesh as a soup of triangles (build.cjs --dump), FACE.json the chosen
triangles (curation/face-tris.json: {"face": [...], "relief": [...]}), OUT_DIR gets:

    base.png       2048 square, the face area painted with plain skin
    normal.png     1024 square, the face area flat (128, 128, 255)
    orm.png        1024 square, R 255 (no baked occlusion), G roughness, B metalness, the face
                   area set to the skin's own values
    face-mask.png  the mask at 4096, for the notes and the check pictures (not shipped)
    bake.json      the numbers

The face of the doll is paint on a chart soup atlas: the eyes, brows, lashes and the mouth are in the
base picture and their relief is in the normal map. The page draws a face of its own (SDF shapes in the
doll's material), so the old one has to be gone: the area of the face triangles in the picture is
filled with skin, flat and with the skin's own gloss. Nothing outside those triangles is touched.

Two details matter and were checked on the pictures:

* The mask is grown into free texels only (never into another triangle's area), by `GROW` pixels, so
  the gutter round each face chart, which holds the old paint spread outward, cannot bleed back into
  the face through the filtering. Growing is measured against the area of every other triangle.
* The skin colour inside the face is not one flat colour: it is the soft shading of the original
  skin (the cheeks), kept by a normalised blur of the skin pixels only, so the paint's dark strokes
  leave no trace in it.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None

SRC = Path(
    r"D:\ren\aspirant\3d\obsidia\Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking"
)
PREFIX = "Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking"
SIZE = 4096
GROW = 6
BASE_OUT = 2048
SMALL_OUT = 1024
SKIN_BLUR = 70.0
# The shading of the skin may differ from its mean by this much (of 255) inside the face.
SKIN_RANGE = 9.0


def raster(uv, tris, size=SIZE):
    """The area of the triangles in the picture (y down), without anti-aliasing."""
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    for t in tris:
        pts = [(float(u) * size, (1.0 - float(v)) * size) for u, v in uv[t]]
        d.polygon(pts, fill=255)
    return np.asarray(im) > 0


def open_map(suffix, mode):
    name = PREFIX + suffix + ".png"
    return Image.open(SRC / name).convert(mode)


def main():
    dump_path, face_path, out = sys.argv[1:4]
    colour_path = sys.argv[4] if len(sys.argv) > 4 else None
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    d = json.load(open(dump_path))
    uv = np.array(d["uv"]).reshape(-1, 3, 2)
    face = json.load(open(face_path))
    chosen = sorted(set(face["face"]) | set(face["relief"]))
    others = sorted(set(range(len(uv))) - set(chosen))

    mask = raster(uv, chosen)
    other = raster(uv, others)
    overlap = mask & other
    print("face area", int(mask.sum()), "px;", "shared with other triangles", int(overlap.sum()), "px")
    # Texels that belong to both a face triangle and another one (seam pixels): they stay as the
    # other triangle wants them (the face's edge uses the same texel: it is skin or hair there).
    free = ~other
    grown = ndimage.binary_dilation(mask, iterations=GROW) & free
    grown |= mask & ~other
    # The face's own texels that another triangle shares are not repainted.
    paint = grown
    Image.fromarray((paint * 255).astype(np.uint8)).save(out / "face-mask.png")

    # Which texels are skin is read from the base file (its colours separate skin from the white of
    # the eye and from the pink of the hair cleanly); the colours that are kept come from the
    # picture the FBX carries itself when it is given (the brighter, warmer one the artist saw).
    judge = np.asarray(open_map("", "RGB")).astype(np.float32)
    base = judge if colour_path is None else np.asarray(Image.open(colour_path).convert("RGB")).astype(np.float32)
    r, g, b = judge[..., 0], judge[..., 1], judge[..., 2]
    skin = mask & (g > 172) & (g < 202) & (r > 184) & (r < 210) & (b > 168) & (r >= b) & (np.abs(r - g) < 28)
    print("skin texels in the face", int(skin.sum()), "of", int(mask.sum()))
    w = skin.astype(np.float32)
    num = np.stack([ndimage.gaussian_filter(base[..., c] * w, SKIN_BLUR) for c in range(3)], -1)
    den = ndimage.gaussian_filter(w, SKIN_BLUR)[..., None]
    mean = base[skin].mean(0)
    smooth = np.where(den > 1e-3, num / np.maximum(den, 1e-6), mean)
    # Where the blur found no skin at all, take the mean skin colour. The eye's white and the glow of
    # the skin round it would show as pale patches when the eyes close, so the shading is held
    # close to the mean.
    smooth = mean + np.clip(smooth - mean, -SKIN_RANGE, SKIN_RANGE)
    painted = np.where(paint[..., None], smooth, base)
    Image.fromarray(np.clip(painted, 0, 255).astype(np.uint8)).resize(
        (BASE_OUT, BASE_OUT), Image.LANCZOS
    ).save(out / "base.png")

    normal = np.asarray(open_map("_normal", "RGB")).copy()
    normal[paint] = (128, 128, 255)
    Image.fromarray(normal).resize((SMALL_OUT, SMALL_OUT), Image.LANCZOS).save(out / "normal.png")

    rough = np.asarray(open_map("_roughness", "L")).copy()
    metal = np.asarray(open_map("_metallic", "L")).copy()
    skin_rough = int(np.median(rough[skin]))
    skin_metal = int(np.median(metal[skin]))
    rough[paint] = skin_rough
    metal[paint] = skin_metal
    r_small = np.asarray(Image.fromarray(rough).resize((SMALL_OUT, SMALL_OUT), Image.LANCZOS))
    m_small = np.asarray(Image.fromarray(metal).resize((SMALL_OUT, SMALL_OUT), Image.LANCZOS))
    orm = np.stack([np.full_like(r_small, 255), r_small, m_small], -1)
    Image.fromarray(orm).save(out / "orm.png")

    facts = {
        "faceTriangles": len(face["face"]),
        "reliefTriangles": len(face["relief"]),
        "faceAreaPx": int(mask.sum()),
        "paintedPx": int(paint.sum()),
        "paintedShare": float(paint.mean()),
        "growPx": GROW,
        "seamPx": int(overlap.sum()),
        "skinTexels": int(skin.sum()),
        "colourFrom": "the FBX's own picture" if colour_path else "the base file",
        "meanSkin": [float(x) for x in mean],
        "skinRoughness": skin_rough,
        "skinMetalness": skin_metal,
    }
    json.dump(facts, open(out / "bake.json", "w"), indent=2)
    print(json.dumps(facts, indent=2))


if __name__ == "__main__":
    main()
