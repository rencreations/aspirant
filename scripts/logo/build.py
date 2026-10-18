"""
Vectorise the Aspirant logo (a bitmap PNG) into animatable SVG layers.

    python -I scripts/logo/build.py "D:/ren/aspirant/media/other/logo.png"

Writes:
  apps/web/src/components/logo/logo-data.generated.ts   paths and geometry
  apps/web/src/app/icon.svg                             favicon (the mascot)
  apps/web/src/app/apple-icon.png, opengraph-image.png  raster icons
  apps/web/public/icons/icon-192.png, icon-512.png      manifest icons

Layers (bottom to top): orange outline, black plate, mascot parts, letters, letter bevels.
The letters are also the "windows" of the page transition: the plate and outline never cover
them, so a page behind the logo shows through the letters.

Needs: numpy, scipy, Pillow, potracer (pip install potracer).
"""

import json
import sys
from pathlib import Path

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage as ndi

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "apps" / "web"
SCALE = 0.5  # tracing resolution relative to the source bitmap

im_full = Image.open(SRC).convert("RGBA")
im = im_full.resize((round(im_full.width * SCALE), round(im_full.height * SCALE)), Image.LANCZOS)
W, H = im.size
a = np.array(im).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]

opaque = al > 128
neutral = (abs(r - g) < 28) & (abs(g - b) < 28)
bright = (r + g + b) / 3
orange = opaque & (r > 170) & (g > 100) & (g < 215) & (b < 130) & (r - b > 90)
pink = opaque & (r > 170) & (g < 120) & (b > 80) & (r - g > 90)
light = opaque & neutral & (bright > 100)


def label(mask):
    lab, n = ndi.label(mask)
    objs = ndi.find_objects(lab)
    return lab, n, objs


def comps(mask, min_area):
    lab, n, objs = label(mask)
    out = []
    for i in range(1, n + 1):
        area = int((lab == i).sum())
        if area >= min_area:
            sl = objs[i - 1]
            out.append(
                {"id": i, "area": area, "x0": sl[1].start, "x1": sl[1].stop, "y0": sl[0].start, "y1": sl[0].stop}
            )
    return lab, out


# --- classify the light pixels --------------------------------------------------------------
light_lab, light_comps = comps(light, 300)
big = sorted([c for c in light_comps if c["area"] > 15000], key=lambda c: c["x0"])
assert len(big) == 12, f"expected 12 letters, found {len(big)}"

# The grey triangle under the mascot stays part of the plate (an accent), not a window.
accent_mask = np.zeros_like(light)
for c in light_comps:
    cx, cy = (c["x0"] + c["x1"]) / 2, (c["y0"] + c["y1"]) / 2
    if c["area"] < 5000 and abs(cx - W * 0.5) < W * 0.04 and cy < H * 0.7 and cy > H * 0.45:
        # a grey piece under the mascot, between the letters
        sub = light_lab == c["id"]
        if bright[sub].mean() < 140 and c["x1"] - c["x0"] < 100:
            accent_mask |= sub

letters_mask_all = light & ~accent_mask
# Smooth the fringe so edges trace cleanly.
letters_mask_all = ndi.binary_closing(letters_mask_all, structure=np.ones((3, 3)))
letters_mask_all = ndi.binary_opening(letters_mask_all, structure=np.ones((2, 2)))

# One mask per letter: each big white component plus the small grey bevels that touch or sit
# next to it.
big_lab = np.zeros(light.shape, dtype=int)
for k, c in enumerate(big, start=1):
    big_lab[light_lab == c["id"]] = k
# grow labels into the neighbouring grey pieces (nearest big component)
dist, idx = ndi.distance_transform_edt(big_lab == 0, return_indices=True)
nearest = big_lab[idx[0], idx[1]]
letter_lab = np.where(letters_mask_all & (dist < 14), nearest, 0)
letter_lab = np.where(big_lab > 0, big_lab, letter_lab)

# Bevels: the mid-grey pieces inside the letters.
bevel_mask = letters_mask_all & neutral & (bright <= 175) & (bright > 100)
bevel_mask = ndi.binary_opening(bevel_mask, structure=np.ones((4, 4)))
bev_lab, bev_n, _ = label(bevel_mask)
for i in range(1, bev_n + 1):
    if (bev_lab == i).sum() < 350:
        bevel_mask[bev_lab == i] = False

holes = letter_lab > 0

# --- mascot ---------------------------------------------------------------------------------
pink_lab, pink_comps = comps(pink, 1500)
pink_comps.sort(key=lambda c: -c["area"])
disc = max(pink_comps, key=lambda c: c["area"] if (c["x1"] - c["x0"]) < 200 and abs(((c["x0"] + c["x1"]) / 2) - W / 2) < 200 else 0)
disc_mask = pink_lab == disc["id"]
cx, cy = (disc["x0"] + disc["x1"]) / 2, (disc["y0"] + disc["y1"]) / 2
rest = [c for c in pink_comps if c["id"] != disc["id"]]
ring_comp = max(rest, key=lambda c: c["area"])
ring_all = pink_lab == ring_comp["id"]
pods = [c for c in rest if c["id"] != ring_comp["id"] and c["area"] > 1200]
pods.sort(key=lambda c: c["x0"])
pod_masks = [pink_lab == c["id"] for c in pods[:2]]

yy, xx = np.mgrid[0:H, 0:W]
d = np.hypot(xx - cx, yy - cy)
disc_r = max(disc["x1"] - disc["x0"], disc["y1"] - disc["y0"]) / 2
ring_vals = d[ring_all]
# the ring hugs the disc; the antennae stick out beyond it
ring_out = float(np.percentile(ring_vals, 55)) + 6
ring_mask = ring_all & (d <= ring_out)
ant = ring_all & (d > ring_out)
ant = ndi.binary_opening(ant, structure=np.ones((3, 3)))
ant_l = ant & (xx < cx)
ant_r = ant & (xx >= cx)

# --- plate ----------------------------------------------------------------------------------
orange_closed = ndi.binary_closing(orange, structure=np.ones((3, 3)))
plate_mask = opaque & ~orange_closed & ~holes
# fill any pinholes between plate and outline with plate; outline sits underneath it
outline_mask = opaque & ~holes

accent_trace = accent_mask

# --- tracing --------------------------------------------------------------------------------


def fmt(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def trace(mask, turdsize=12, alphamax=1.0, opttol=0.4):
    bm = potrace.Bitmap(~mask.astype(bool))  # potracer traces the False pixels
    plist = bm.trace(
        turdsize=turdsize,
        turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=alphamax,
        opticurve=True,
        opttolerance=opttol,
    )
    parts = []
    for curve in plist:
        sp = curve.start_point
        parts.append(f"M{fmt(sp.x)} {fmt(sp.y)}")
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f"L{fmt(seg.c.x)} {fmt(seg.c.y)}L{fmt(seg.end_point.x)} {fmt(seg.end_point.y)}")
            else:
                parts.append(
                    f"C{fmt(seg.c1.x)} {fmt(seg.c1.y)} {fmt(seg.c2.x)} {fmt(seg.c2.y)} {fmt(seg.end_point.x)} {fmt(seg.end_point.y)}"
                )
        parts.append("Z")
    return "".join(parts)


def bbox_of(mask):
    ys, xs = np.where(mask)
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


print("tracing outline, plate ...")
outline_d = trace(outline_mask, turdsize=40)
silhouette_d = trace(ndi.binary_fill_holes(opaque), turdsize=200)
plate_d = trace(plate_mask, turdsize=10)
print("tracing letters ...")
letters = []
for k in range(1, 13):
    m = letter_lab == k
    x0, y0, x1, y1 = bbox_of(m)
    letters.append(
        {
            "i": k - 1,
            "d": trace(m, turdsize=8),
            "cx": round((x0 + x1) / 2, 1),
            "cy": round((y0 + y1) / 2, 1),
            "box": [x0, y0, x1, y1],
        }
    )
print("tracing bevels, mascot ...")
bevel_d = trace(bevel_mask, turdsize=30)
mascot = {
    "disc": trace(disc_mask, turdsize=6),
    "ring": trace(ring_mask, turdsize=6),
    "pods": [trace(m, turdsize=6) for m in pod_masks],
    "antL": trace(ant_l, turdsize=6),
    "antR": trace(ant_r, turdsize=6),
    "accent": trace(accent_trace, turdsize=6),
}
ant_l_box = bbox_of(ant_l)
ant_r_box = bbox_of(ant_r)

# Antenna pivots: the end nearest the ring centre.
def pivot(mask):
    ys, xs = np.where(mask)
    dd = np.hypot(xs - cx, ys - cy)
    j = int(np.argmin(dd))
    return [int(xs[j]), int(ys[j])]


eye_mask = opaque & neutral & (bright <= 100) & (d < disc_r * 0.9)
ex0, ey0, ex1, ey1 = bbox_of(eye_mask)
mascot_geo = {
    "eyes": [ex0 - 6, ey0 - 6, ex1 + 6, ey1 + 6],
    "cx": round(cx, 1),
    "cy": round(cy, 1),
    "r": round(float(disc_r), 1),
    "antLPivot": pivot(ant_l),
    "antRPivot": pivot(ant_r),
}

# --- zoom origin: the widest point inside the windows ---------------------------------------
dist_in = ndi.distance_transform_edt(holes)
j = np.unravel_index(int(np.argmax(dist_in)), dist_in.shape)
zoom = {"x": int(j[1]), "y": int(j[0]), "r": round(float(dist_in[j]), 1)}

# union of every window, for the transition mask
holes_d = trace(holes, turdsize=8)

data = {
    "viewBox": [0, 0, W, H],
    "outline": outline_d,
    "silhouette": silhouette_d,
    "plate": plate_d,
    "holes": holes_d,
    "bevel": bevel_d,
    "letters": [{k: v for k, v in L.items()} for L in letters],
    "mascot": mascot,
    "mascotGeo": mascot_geo,
    "zoom": zoom,
}

out_ts = WEB / "src" / "components" / "logo" / "logo-data.generated.ts"
out_ts.parent.mkdir(parents=True, exist_ok=True)
body = json.dumps(data, separators=(",", ":"))
out_ts.write_text(
    "/* Generated by scripts/logo/build.py from the Aspirant logo bitmap. Do not edit. */\n"
    f"export const LOGO = {body} as const;\n",
    encoding="utf-8",
    newline="\n",
)
print("wrote", out_ts, round(len(body) / 1024), "KB")

# --- favicon (the mascot head on a plate) ----------------------------------------------------
pad = 26
mx0 = int(min(ring_all.nonzero()[1].min(), ant_l.nonzero()[1].min()) - pad)
mx1 = int(max(ring_all.nonzero()[1].max(), ant_r.nonzero()[1].max()) + pad)
my0 = int(ring_all.nonzero()[0].min() - pad)
my1 = int(max(m.nonzero()[0].max() for m in pod_masks) + pad)
side = max(mx1 - mx0, my1 - my0)
vx = (mx0 + mx1) / 2 - side / 2
vy = (my0 + my1) / 2 - side / 2
icon = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(vx)} {fmt(vy)} {fmt(side)} {fmt(side)}">
<rect x="{fmt(vx)}" y="{fmt(vy)}" width="{fmt(side)}" height="{fmt(side)}" rx="{fmt(side * 0.22)}" fill="#0b0b0e"/>
<path fill="#ff2e90" fill-rule="evenodd" d="{mascot['disc']}"/>
<path fill="#ff2e90" fill-rule="evenodd" d="{mascot['ring']}"/>
<path fill="#ff2e90" fill-rule="evenodd" d="{mascot['antL']}"/>
<path fill="#ff2e90" fill-rule="evenodd" d="{mascot['antR']}"/>
{''.join(f'<path fill="#ff2e90" fill-rule="evenodd" d="{p}"/>' for p in mascot['pods'])}
</svg>
"""
(WEB / "src" / "app" / "icon.svg").write_text(icon, encoding="utf-8", newline="\n")

# --- raster icons from the original bitmap --------------------------------------------------
sx, sy_ = 1 / SCALE, 1 / SCALE
crop = im_full.crop((int(vx * sx), max(0, int(vy * sy_)), int((vx + side) * sx), int((vy + side) * sy_)))


def icon_png(size, path):
    bg = Image.new("RGBA", (size, size), (11, 11, 14, 255))
    c = crop.copy()
    c.thumbnail((int(size * 0.86), int(size * 0.86)), Image.LANCZOS)
    bg.paste(c, ((size - c.width) // 2, (size - c.height) // 2), c)
    path.parent.mkdir(parents=True, exist_ok=True)
    bg.convert("RGB").save(path, optimize=True)


icon_png(180, WEB / "src" / "app" / "apple-icon.png")
icon_png(192, WEB / "public" / "icons" / "icon-192.png")
icon_png(512, WEB / "public" / "icons" / "icon-512.png")

# --- share image: the logo on the light page colour ----------------------------------------
og = Image.new("RGB", (1200, 630), (238, 242, 246))
lg = im_full.copy()
lg.thumbnail((1000, 400), Image.LANCZOS)
og.paste(lg, ((1200 - lg.width) // 2, (630 - lg.height) // 2), lg)
og.save(WEB / "src" / "app" / "opengraph-image.png", optimize=True)
print("icons written")
