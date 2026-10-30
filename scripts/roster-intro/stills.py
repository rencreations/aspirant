"""Make the cleaned stills of the roster intro (transparent WebP) from the reference recording.

    C:\\Users\\muham\\anaconda3\\python.exe -I scripts\\roster-intro\\stills.py [name ...]

Sources: the reference recording (REF, 1920x1080 at 60 fps). Frames are taken with ffmpeg at
the times in FRAMES. The game's interface (the top bar) is never inside a crop, or it is
removed by the mask of the shape. Some stills are keyed from the frame (beams, arcs, fire);
the speed lines and the energy slash are rebuilt in code (the frame has the lines on a red
field and the slash under characters, so they cannot be keyed cleanly).
Output: apps/web/public/img/roster-intro/<name>.webp
"""

import math
import os
import random
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage as ndi

REF = r"C:\Users\muham\Videos\transitions.mov"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "apps", "web", "public", "img", "roster-intro")
TMP = tempfile.mkdtemp(prefix="roster-intro-")

# name: (time in the reference, what it is)
FRAMES = {
    "beam-hold": 3.0,
    "beam-pink": 2.85,
    "beam-blue": 3.4,
    "beam-thin": 3.6,
    "ring-arcs": 3.7,
    "fire": 3.6,
}


def frame(t):
    p = os.path.join(TMP, f"f{t}.png")
    if not os.path.exists(p):
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", REF, "-frames:v", "1", p],
            check=True,
        )
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)


def save(name, rgba, maxside=2048):
    im = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")
    bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    if max(im.size) > maxside:
        k = maxside / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + ".webp")
    im.save(p, "WEBP", quality=92, alpha_quality=100, method=6)
    print(f"{name:12s} {im.size[0]}x{im.size[1]} {os.path.getsize(p) / 1024:6.0f} KB")


def biggest(mask):
    lab, n = ndi.label(mask)
    if n == 0:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def row_fill(mask):
    """A leaf is convex: fill every row between its first and last pixel."""
    out = np.zeros_like(mask)
    for y in range(mask.shape[0]):
        xs = np.flatnonzero(mask[y])
        if xs.size:
            out[y, xs[0] : xs[-1] + 1] = True
    return out


def soft(mask, px=1.2):
    a = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(px))
    return np.asarray(a).astype(np.float32)


def rgba(rgb, alpha):
    return np.dstack([rgb, alpha])


def keyed_beam(t, sel, region=None, close=3):
    f = frame(t)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    m = sel(r, g, b)
    if region is not None:
        x0, y0, x1, y1 = region
        z = np.zeros_like(m)
        z[y0:y1, x0:x1] = True
        m &= z
    m = ndi.binary_closing(m, iterations=close)
    m = biggest(m)
    m = row_fill(m)
    m = ndi.binary_opening(m, iterations=2)
    return rgba(f, soft(m))


def beam_hold():
    # dark maroon field behind it: the beam is everything brighter than the field
    return keyed_beam(3.0, lambda r, g, b: np.maximum(np.maximum(r, g), b) > 135, (0, 150, 1100, 1080))


def beam_pink():
    # magenta body and the light pink rim, to the right of the tip
    def sel(r, g, b):
        mag = (r > 200) & (b > 170) & (g < 150)
        rim = (r > 235) & (g > 160) & (g < 225) & (b > 180) & (b < 240) & (r - g > 25)
        return mag | rim

    out = keyed_beam(2.85, sel, (880, 280, 1920, 1000), close=4)
    # the tip is surrounded by speed lines and panel pieces: keep only the wedge of the beam
    ys, xs = np.nonzero(out[..., 3] > 8)
    x0, y0 = xs.min(), ys.min()
    poly = [(x0 + 55, y0 + 243 - 0), (x0 + 1040, y0 - 80), (x0 + 1040, y0 + 700), (x0 + 55, y0 + 314)]
    m = Image.new("L", (out.shape[1], out.shape[0]), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    out[..., 3] = out[..., 3] * (np.asarray(m.filter(ImageFilter.GaussianBlur(1))) / 255.0)
    return out


def beam_blue():
    def sel(r, g, b):
        blue = (b > r + 30) & (b > 150)
        rim = (r > 215) & (g > 150) & (b > 180) & ((np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) > 30)
        return blue | rim

    return keyed_beam(3.4, sel, (0, 300, 1010, 820), close=3)


def beam_thin():
    f = frame(3.6)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    yellow = (r > 215) & (g > 185) & (b < 175)
    cyan = (g > 190) & (b > 190) & (r < 190)
    pink = (r > 240) & (g > 120) & (g < 200) & (b > 140) & (b < 225)
    m = yellow | cyan | pink
    z = np.zeros_like(m)
    # a band around the line from the left edge to the tip (about 975, 576)
    for x in range(0, 1000):
        yc = 550 + (576 - 550) * x / 975
        half = 6 + 40 * (1 - x / 975)
        z[int(yc - half) : int(yc + half) + 1, x] = True
    m &= z
    m = ndi.binary_closing(m, iterations=2)
    m = biggest(m)
    m = row_fill(m)
    return rgba(f, soft(m, 0.8))


def ring_arcs():
    f = frame(3.7)
    luma = 0.3 * f[..., 0] + 0.59 * f[..., 1] + 0.11 * f[..., 2]
    a = np.clip((95 - luma) / 55, 0, 1) * 255
    z = np.zeros(a.shape, bool)
    z[130:1080, 0:330] = True
    a = np.where(z, a, 0)
    m = biggest(ndi.binary_opening(a > 100, iterations=1))
    m = ndi.binary_dilation(m, iterations=3)
    a = np.where(m, a, 0)
    black = np.zeros(f.shape, np.float32)
    return rgba(black, a)


def fire(w=1024, h=768, seed=5):
    """Fire and embers, built in code: noise through a black, red, orange, yellow, white ramp,
    with cyan sparks. The frame has the fire on top of panel art, so it cannot be keyed."""
    rnd = np.random.default_rng(seed)
    field = np.zeros((h, w), np.float32)
    for sigma, amp in ((60, 1.0), (28, 0.8), (12, 0.5), (5, 0.3)):
        n = ndi.gaussian_filter(rnd.random((h, w)).astype(np.float32), sigma)
        n = (n - n.mean()) / (n.std() + 1e-6)
        field += amp * n
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w * 0.5, h * 0.62
    # an upright flame: wide at the bottom, narrow and licking at the top
    dx = (xx - cx) / (w * (0.16 + 0.24 * (yy / h)))
    dy = (yy - cy) / (h * 0.42)
    fall = np.exp(-(dx**2 + np.where(dy < 0, dy**2 * 0.9, dy**2 * 3.5)))
    inten = np.clip((field * 0.45 + 0.35) * fall * 2.0 + fall * 0.35, 0, 1.4)
    ramp = np.array([[0, 0, 0], [150, 10, 20], [255, 80, 20], [255, 190, 40], [255, 245, 190], [255, 255, 255]], np.float32)
    pos = np.clip(inten * 0.68, 0, 1.0) * (len(ramp) - 1)
    i0 = np.minimum(pos.astype(int), len(ramp) - 2)
    f = (pos - i0)[..., None]
    col = ramp[i0] * (1 - f) + ramp[i0 + 1] * f
    alpha = np.clip(inten * 1.6 - 0.12, 0, 1) * 255
    img = Image.fromarray(np.dstack([col, alpha]).astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(img)
    r = random.Random(seed)
    for _ in range(90):  # embers rising
        x = cx + r.gauss(0, w * 0.16)
        y = cy - abs(r.gauss(0, h * 0.28)) - h * 0.05
        s_ = r.uniform(1.5, 4.5)
        d.ellipse([x - s_, y - s_, x + s_, y + s_], fill=(255, r.randint(120, 230), 40, r.randint(160, 255)))
    for _ in range(26):  # cyan sparks
        x = cx + r.gauss(0, w * 0.2)
        y = cy + r.gauss(0, h * 0.2)
        ln = r.uniform(6, 22)
        a = r.uniform(0, math.tau)
        d.line([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)], fill=(130, 240, 255, 230), width=2)
    return np.asarray(img).astype(np.float32)


def speed_lines(size=2048, seed=7):
    """White and red hairlines radiating from the centre, built in code (SS = supersample)."""
    rnd = random.Random(seed)
    SS = 2
    W = size * SS
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = W / 2
    n = 240
    for i in range(n):
        ang = (i + rnd.uniform(-0.45, 0.45)) / n * 2 * math.pi
        r0 = W * rnd.uniform(0.04, 0.30)
        r1 = r0 + W * rnd.uniform(0.10, 0.34)
        r1 = min(r1, W * 0.5 - 2)
        w0 = W * rnd.uniform(0.0006, 0.0024)
        col = (255, 255, 255, rnd.randint(150, 255)) if rnd.random() < 0.7 else (255, 40, 70, rnd.randint(150, 255))
        ca, sa = math.cos(ang), math.sin(ang)
        # a thin spike: wide near the outside, a point toward the centre
        p0 = (c + ca * r0, c + sa * r0)
        p1 = (c + ca * r1 - sa * w0, c + sa * r1 + ca * w0)
        p2 = (c + ca * r1 + sa * w0, c + sa * r1 - ca * w0)
        d.polygon([p0, p1, p2], fill=col)
    im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def energy_slash(h=2048, seed=11):
    """A jagged red slash with a white-hot core and dark red cracks, upright, leaning like the page."""
    rnd = random.Random(seed)
    SS = 2
    H = h * SS
    W = int(H * 0.46)
    lean = 0.74  # horizontal run per vertical unit (about 36 degrees)
    run = H * lean
    W = int(run + H * 0.22)

    def centre(y):
        return W * 0.5 + (0.5 - y / H) * run

    ys = list(range(0, H + 1, max(1, H // 90)))
    jag = [rnd.uniform(-1, 1) for _ in ys]
    widths = [H * (0.012 + 0.010 * math.sin(i * 0.41) ** 2 + 0.006 * rnd.random()) for i in range(len(ys))]
    taper = [min(1.0, math.sin(math.pi * min(1.0, max(0.0, y / H))) * 4.0) for y in ys]

    def outline(scale, off=0.0):
        left, right = [], []
        for y, j, w, t in zip(ys, jag, widths, taper):
            cx = centre(y) + j * H * 0.006
            ww = w * scale * t + 1
            left.append((cx - ww * (1 + 0.5 * abs(j)) + off, y))
            right.append((cx + ww * (1 + 0.5 * abs(j)) + off, y))
        return left + right[::-1]

    def layer(poly, color, blur=0):
        L = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(L).polygon(poly, fill=color)
        if blur:
            L = L.filter(ImageFilter.GaussianBlur(blur))
        return L

    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base = Image.alpha_composite(base, layer(outline(5.0), (255, 20, 60, 120), H * 0.012))
    base = Image.alpha_composite(base, layer(outline(2.6), (200, 10, 40, 255), 0))
    base = Image.alpha_composite(base, layer(outline(1.7), (255, 50, 70, 255), 0))
    # dark cracks across the body
    cr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cr)
    for i in range(46):
        k = rnd.randrange(len(ys))
        y = ys[k]
        cx = centre(y) + rnd.uniform(-1, 1) * widths[k] * 1.3
        ang = math.radians(rnd.uniform(-70, 70)) + math.radians(-36)
        ln = H * rnd.uniform(0.012, 0.05)
        pts = [(cx, y)]
        for s in range(4):
            ang += rnd.uniform(-0.6, 0.6)
            pts.append((pts[-1][0] + math.sin(ang) * ln / 4, pts[-1][1] + math.cos(ang) * ln / 4))
        cd.line(pts, fill=(90, 0, 20, 230), width=max(2, int(H * 0.0012)))
    base = Image.alpha_composite(base, cr)
    base = Image.alpha_composite(base, layer(outline(0.8), (255, 235, 225, 255), H * 0.0008))
    base = Image.alpha_composite(base, layer(outline(0.35), (255, 255, 255, 255), H * 0.0006))
    # sparks at the edges
    sp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sp)
    for i in range(70):
        k = rnd.randrange(len(ys))
        y = ys[k]
        side = rnd.choice((-1, 1))
        x0 = centre(y) + side * widths[k] * 2.4
        ln = H * rnd.uniform(0.004, 0.02)
        a = math.radians(rnd.uniform(10, 80)) * side
        sd.line([(x0, y), (x0 + math.sin(a) * ln * side, y + math.cos(a) * ln)], fill=(255, 240, 230, 220), width=max(2, int(H * 0.0009)))
    base = Image.alpha_composite(base, sp)
    base = base.resize((W // SS, H // SS), Image.LANCZOS)
    return np.asarray(base).astype(np.float32)


MAKERS = {
    "beam-hold": beam_hold,
    "beam-pink": beam_pink,
    "beam-blue": beam_blue,
    "beam-thin": beam_thin,
    "ring-arcs": ring_arcs,
    "fire": fire,
    "speed-lines": speed_lines,
    "energy-slash": energy_slash,
}


def main():
    names = sys.argv[1:] or list(MAKERS)
    for n in names:
        save(n, MAKERS[n]())


if __name__ == "__main__":
    main()
