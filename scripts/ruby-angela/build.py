"""
Builds the pictures of Ruby's and Angela's pages (`features/character/duo/`).

Sources: D:/ren/aspirant/media/ruby-and-angela (splash art, the two character films)
         apps/web/public/img/char/{ruby,angela}/splash.webp (already on the site)
Output:  apps/web/public/img/ruby-angela/<who>/layer.webp   the second picture of the hero
         apps/web/public/img/ruby-angela/<who>/frame-NN.webp  stills from the character film
                                                                (the strip of the Film section)

The hero shows the splash art, and a second picture through a circle that follows the pointer:
  - Ruby: a blueprint of the art (its edges in cyan and gold on deep navy, with a fine grid).
  - Angela: a warmth map of the art (the light turned into a gradient from plum to pink, peach and
    pale cyan), which is how she reads the world: "I feel warmth, but the cooling system does not react."

The films are not encoded again: the site already holds them (`public/video/ruby-angela/`).

Needs numpy and Pillow (the anaconda Python on this machine) and ffmpeg:
  C:/Users/muham/anaconda3/python.exe scripts/ruby-angela/build.py
  ... --force   rebuild what exists
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("D:/ren/aspirant/media/ruby-and-angela")
ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public"
OUT = PUBLIC / "img/ruby-angela"

FORCE = "--force" in sys.argv

# Seconds into the character film. Chosen by eye from a contact sheet of each film.
FRAMES = {
    "ruby": [4, 16, 32, 48, 64, 84, 92, 108],
    "angela": [12, 28, 32, 36, 52, 56, 68, 80],
}


def grey(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def sobel(g: np.ndarray) -> np.ndarray:
    p = np.pad(g, 1, mode="edge")
    gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
    gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
    return np.hypot(gx, gy)


def blueprint(src: Path, out: Path) -> None:
    im = Image.open(src).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float32) / 255.0
    g = grey(rgb)
    e = sobel(g)
    e = np.clip((e - 0.10) / 0.55, 0, 1) ** 0.8
    h, w = g.shape
    navy = np.array([8, 14, 40], dtype=np.float32)
    cyan = np.array([96, 200, 255], dtype=np.float32)
    gold = np.array([242, 184, 59], dtype=np.float32)
    # Strong lines go gold, the rest cyan, so the scythe and the costume read as drawn in two inks.
    mix = np.clip((e - 0.55) / 0.35, 0, 1)[..., None]
    ink = cyan * (1 - mix) + gold * mix
    base = navy + (g[..., None] * 18.0)
    img = base * (1 - e[..., None]) + ink * e[..., None]
    # A fine drafting grid: a line every 48 px, a stronger one every 240 px.
    yy, xx = np.mgrid[0:h, 0:w]
    fine = ((xx % 48 == 0) | (yy % 48 == 0)).astype(np.float32) * 0.10
    major = ((xx % 240 == 0) | (yy % 240 == 0)).astype(np.float32) * 0.16
    grid = np.maximum(fine, major)[..., None]
    img = img * (1 - grid) + cyan * grid
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(out, "WEBP", quality=80, method=6)


def warmth(src: Path, out: Path) -> None:
    im = Image.open(src).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float32) / 255.0
    g = grey(rgb)
    # Stretch, so the map uses the whole gradient whatever the art.
    lo, hi = np.percentile(g, [2, 98])
    t = np.clip((g - lo) / max(hi - lo, 1e-3), 0, 1)
    stops = [
        (0.00, (42, 20, 34)),
        (0.30, (150, 30, 110)),
        (0.55, (226, 58, 146)),
        (0.78, (255, 178, 140)),
        (1.00, (207, 251, 255)),
    ]
    xs = np.array([s[0] for s in stops], dtype=np.float32)
    out_rgb = np.stack(
        [np.interp(t, xs, np.array([s[1][c] for s in stops], dtype=np.float32)) for c in range(3)],
        axis=-1,
    )
    Image.fromarray(out_rgb.astype(np.uint8)).save(out, "WEBP", quality=82, method=6)


def frame(src: Path, t: int, out: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(src),
            "-frames:v", "1", "-vf", "scale=1280:-2:flags=lanczos",
            "-c:v", "libwebp", "-quality", "76", str(out),
        ],
        check=True,
    )


def main() -> None:
    for who in ("ruby", "angela"):
        d = OUT / who
        d.mkdir(parents=True, exist_ok=True)
        splash = SRC / f"{who}-splash-art.jpg"
        layer = d / "layer.webp"
        if FORCE or not layer.exists():
            (blueprint if who == "ruby" else warmth)(splash, layer)
            print("wrote", layer.relative_to(ROOT))
        film = SRC / f"{who}.webm"
        for i, t in enumerate(FRAMES[who], start=1):
            f = d / f"frame-{i:02d}.webp"
            if FORCE or not f.exists():
                frame(film, t, f)
                print("wrote", f.relative_to(ROOT))


if __name__ == "__main__":
    main()
