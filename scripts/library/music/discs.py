"""The faces of the discs of the Music room, and the shape of each track's sound.

Run by build.py (or alone, to look at the crops):

    C:/Users/muham/anaconda3/python.exe scripts/library/music/discs.py [--preview <out.jpg>]

Each track of the room is a disc. Its face is a square crop of an official picture, centred so
the faces sit clear of the hole in the middle of the disc. The browser draws the type on top (the
title and the ring of text along the rim), with the site's own fonts.

The shape of the sound (`wave`) is the loudness of the track in 240 equal steps, written as one
base 36 digit per step (0 is silence, z is the loudest moment of that track). The page draws it as
the line around the disc.

Writes
    <mirror>/library/v1/music/discs/<slug>.webp     the face of each disc (at most 1024 px)

Sources (read only), under media/
    the official splash art and the two single covers, listed in FACES below.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

# The side of a face, in pixels. The disc on a 1440 wide screen is about 540 px across, so a
# 1024 px face stays sharp at twice the pixel density.
SIZE = 1024
QUALITY = 80
WAVE_STEPS = 240
RANGE_DB = 14.0
DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"

# Track slug: (source under media/, crop centre x and y as fractions of the picture, side of the
# square as a fraction of the picture's height). The hole of the disc covers the middle 24 percent
# of its radius, so every crop keeps the faces above it or to one side.
FACES: dict[str, tuple[str, float, float, float]] = {
    "we-believe": ("layla-and-fanny/art/official/fighting-together-splash-art.jpg", 0.6, 0.5, 1.0),
    "change-lesley-display": ("lesley-and-change/art/official/lesley-splash-art.jpg", 0.55, 0.5, 1.0),
    "cross-credo-vexana": ("vexana-and-guinevere/art/official/vexana-splash-art.jpg", 0.48, 0.55, 0.8),
    "cross-credo-guinevere": ("vexana-and-guinevere/art/official/guinevere-splash-art.jpg", 0.5, 0.56, 0.88),
    "gray-new-world": ("selena-and-obsidia/video/music-collection/selena-cover.jpg", 0.58, 0.47, 0.72),
    "lullaby-of-oblivion": ("selena-and-obsidia/video/music-collection/obsidia-cover.jpg", 0.6, 0.47, 0.72),
    # Angela's splash art: she is named first in the track's title and her face sits above the hole.
    "angela-ruby": ("ruby-and-angela/art/official/angela-splash-art.jpg", 0.6, 0.42, 0.85),
}


def disc_key(slug: str) -> str:
    return f"music/discs/{slug}.webp"


def crop_box(w: int, h: int, cx: float, cy: float, side: float) -> tuple[int, int, int, int]:
    """The square in pixels, kept inside the picture."""
    s = round(min(w, h) * side) if side <= 1 else round(side)
    s = min(s, w, h)
    x0 = round(cx * w - s / 2)
    y0 = round(cy * h - s / 2)
    x0 = max(0, min(w - s, x0))
    y0 = max(0, min(h - s, y0))
    return x0, y0, x0 + s, y0 + s


def face_image(slug: str) -> Image.Image:
    src, cx, cy, side = FACES[slug]
    im = Image.open(common.MEDIA / src).convert("RGB")
    box = crop_box(im.width, im.height, cx, cy, side)
    face = im.crop(box)
    out = min(SIZE, face.width)
    if face.width != out:
        face = face.resize((out, out), Image.LANCZOS)
    return face


def make_face(slug: str) -> str:
    """Write the face of one disc into the mirror and return its library key.

    A face that is already in the mirror is never written again: its key is cached for 30 days, so
    a new crop of an existing face needs a new key (a new slug in FACES, for example `<slug>-2`).
    """
    key = disc_key(slug)
    out = common.key_path(key)
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp.webp")
        face_image(slug).save(tmp, "WEBP", quality=QUALITY, method=6)
        tmp.replace(out)
    return key


def wave_of(path: Path, steps: int = WAVE_STEPS) -> str:
    """The loudness of a sound file in `steps` equal parts, one base 36 digit each."""
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    pcm = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if pcm.size < steps:
        return "0" * steps
    parts = np.array_split(pcm, steps)
    rms = np.array([float(np.sqrt(np.mean(p * p))) if p.size else 0.0 for p in parts])
    # Loudness in decibels over the top 14 dB of the track: mastered songs move within a few
    # decibels, so a plain ratio would draw an almost even ring.
    db = 20 * np.log10(np.maximum(rms, 1e-5))
    top = float(np.percentile(db, 98))
    level = np.clip((db - (top - RANGE_DB)) / RANGE_DB, 0.0, 1.0) ** 1.4
    return "".join(DIGITS[int(round(v * (len(DIGITS) - 1)))] for v in level)


def disc_fields(slug: str, src_key: str) -> dict[str, Any]:
    """The fields the room reads for one track: `disc` (library key of the face) and `wave`."""
    return {"disc": make_face(slug), "wave": wave_of(common.key_path(src_key))}


def preview(out: Path) -> None:
    """All the faces with the disc drawn over them: the rim, the hole and the hub."""
    from PIL import ImageDraw

    tile = 360
    cols = 3
    rows = (len(FACES) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile, rows * (tile + 18)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, slug in enumerate(FACES):
        face = face_image(slug).resize((tile, tile), Image.LANCZOS)
        mask = Image.new("L", (tile, tile), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse((0, 0, tile - 1, tile - 1), fill=255)
        hub = tile * 0.24 / 2
        md.ellipse((tile / 2 - hub, tile / 2 - hub, tile / 2 + hub, tile / 2 + hub), fill=60)
        x = (i % cols) * tile
        y = (i // cols) * (tile + 18)
        sheet.paste(Image.composite(face, Image.new("RGB", face.size, (238, 240, 244)), mask), (x, y + 18))
        draw.text((x + 4, y + 3), slug, fill="black")
    sheet.save(out, quality=88)
    print(out)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--preview":
        preview(Path(sys.argv[2]))
    else:
        for s in FACES:
            print(s, make_face(s))
