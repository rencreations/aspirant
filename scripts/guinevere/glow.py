"""
Makes the second picture of Guinevere's hero: the same photo in the colours of the first light of
day. The page shows it through a circle that follows the cursor (and wanders by itself), so a
visitor "pulls the dawn" over her. The hair that is lavender and blue at the tips turns gold and
amber, the whites warm up, the reds deepen, and a soft bloom is added to the brightest parts.
The alpha channel is kept as it is, so the cut-out lines up with the original exactly.

Source: C:/Users/muham/Downloads/guinhero.png
Output: apps/web/public/img/guinevere/hero/glow.webp

Needs numpy and Pillow (the anaconda Python on this machine):
  C:/Users/muham/anaconda3/python.exe scripts/guinevere/glow.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path("C:/Users/muham/Downloads/guinhero.png")
OUT = Path(__file__).resolve().parents[2] / "apps/web/public/img/guinevere/hero/glow.webp"


def rgb_to_hsv(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r)
    gm = nz & (mx == g) & ~rm
    bm = nz & ~rm & ~gm
    h[rm] = ((g[rm] - b[rm]) / d[rm]) % 6
    h[gm] = (b[gm] - r[gm]) / d[gm] + 2
    h[bm] = (r[bm] - g[bm]) / d[bm] + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    return np.stack([h, s, mx], axis=-1)


def hsv_to_rgb(hsv: np.ndarray) -> np.ndarray:
    h, s, v = hsv[..., 0] % 360.0, hsv[..., 1], hsv[..., 2]
    c = v * s
    x = c * (1 - np.abs((h / 60.0) % 2 - 1))
    m = v - c
    z = np.zeros_like(h)
    seg = (h // 60).astype(int) % 6
    r = np.choose(seg, [c, x, z, z, x, c])
    g = np.choose(seg, [x, c, c, x, z, z])
    b = np.choose(seg, [z, z, x, c, c, x])
    return np.stack([r + m, g + m, b + m], axis=-1)


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    arr = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3]
    hsv = rgb_to_hsv(rgb)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Blue, violet and magenta (the hair tips) turn to gold and amber, stronger the more saturated.
    cool = ((h >= 195) & (h <= 345) & (s > 0.12)).astype(np.float32)
    t = np.clip((h - 195) / 150.0, 0, 1)  # 0 blue .. 1 magenta
    gold = 52.0 - 22.0 * t  # blue becomes yellow-gold, magenta becomes amber
    h2 = np.where(cool > 0, gold, h)
    s2 = np.where(cool > 0, np.clip(s * 1.25 + 0.15, 0, 1), s)
    # Salmon pink moves towards peach gold.
    pink = ((h < 25) | (h > 345)) & (s > 0.2) & (s < 0.7)
    h2 = np.where(pink, np.where(h > 345, h - 360, h) * 0.3 + 26, h2)
    s2 = np.where(pink, np.clip(s * 1.3 + 0.08, 0, 1), s2)
    v2 = np.clip(v * 1.0, 0, 1)
    out = hsv_to_rgb(np.stack([h2, s2, v2], axis=-1))

    # A warm cast and a soft bloom on the brightest parts.
    out = out * np.array([1.04, 1.0, 0.9], dtype=np.float32)
    out = np.clip(out, 0, 1)
    bright = np.clip((out.max(axis=-1) - 0.9) / 0.1, 0, 1)[..., None] * out
    bloom = Image.fromarray((bright * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))
    out = np.clip(out + np.asarray(bloom).astype(np.float32) / 255.0 * 0.25, 0, 1)

    res = np.dstack([out, alpha])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((res * 255).astype(np.uint8), "RGBA").save(OUT, "WEBP", quality=92, method=6)
    print(OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
