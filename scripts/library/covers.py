"""The ten shelf covers: 1024 x 1024 WebP sleeves, one per collection (/collection, the shelf).

    C:/Users/muham/anaconda3/python.exe scripts/library/covers.py [slug ...] [--force]

Each cover is made from official art only (splash art, official film frames, the official webtoons,
official places and entities, official promotional posts, the in-game recordings, the 3D model
textures). It is a designed sleeve: a strong crop in the top 62 %, the room colour as a flat field,
thin grid lines, crop marks. The bottom third is left EMPTY on purpose: the browser draws the number
and the name there, in Big Shoulders Display, after the fonts load (features/library/shelf/layout.ts,
COVER_TEXT). Keep TITLE_RECT below in step with that file.

The Video cover opens in two on the shelf (a gatefold). Building `video` also builds its two inside
pictures, covers/video-films.webp and covers/video-others.webp, in the same style; their field
colours are read from features/library/shelf/video-halves.ts. Every frame comes from an official
film or video (never fan work, edits or gameplay).

Output: the mirror, key covers/<slug>.webp (common.key_path), quality 88.
"""

from __future__ import annotations

import io
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps  # noqa: E402

import common  # noqa: E402

S = 1024
ART_H = 640  # the art lives above this line
# x0, y0, x1, y1 of the area the browser writes the number and the name in. Nothing but the flat
# field and the faint grid may be here. Same numbers as COVER_TEXT in features/library/shelf/layout.ts.
TITLE_RECT = (56, 672, 968, 968)

MEDIA = common.MEDIA
WORK = common.WORK / "covers"
WORK.mkdir(parents=True, exist_ok=True)
REGISTRY = common.REPO / "apps" / "web" / "src" / "features" / "library" / "registry.ts"

INK = (11, 11, 14)
WHITE = (255, 255, 255)


# ---------------------------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------------------------


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def lin(c: int) -> float:
    v = c / 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def luminance(rgb: tuple[int, int, int]) -> float:
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])


def ink_for(colour: tuple[int, int, int]) -> tuple[int, int, int]:
    """Text colour on the field. Same rule as textOn() in layout.ts."""
    return INK if luminance(colour) > 0.30 else WHITE


def registry() -> dict[str, tuple[int, int, int]]:
    text = REGISTRY.read_text(encoding="utf-8")
    pairs = re.findall(r'slug: "(\w+)",.*?colour: "(#[0-9a-fA-F]{6})"', text, re.S)
    return {slug: hex_rgb(col) for slug, col in pairs}


def load(path: Path | str) -> Image.Image:
    im = Image.open(path)
    im.seek(0)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def cover_crop(im: Image.Image, w: int, h: int, fx: float = 0.5, fy: float = 0.5, zoom: float = 1.0) -> Image.Image:
    """Scale to cover w x h (times zoom) and crop around the focus point (fractions of the scaled picture)."""
    scale = max(w / im.width, h / im.height) * zoom
    sw, sh = max(w, round(im.width * scale)), max(h, round(im.height * scale))
    im = im.resize((sw, sh), Image.LANCZOS)
    x0 = min(max(round(fx * sw - w / 2), 0), sw - w)
    y0 = min(max(round(fy * sh - h / 2), 0), sh - h)
    return im.crop((x0, y0, x0 + w, y0 + h))


def duotone(im: Image.Image, dark: tuple[int, int, int], light: tuple[int, int, int], gamma: float = 1.0) -> Image.Image:
    g = np.asarray(ImageOps.autocontrast(im.convert("L"), cutoff=1), dtype=np.float32) / 255.0
    g = g**gamma
    d = np.array(dark, dtype=np.float32)
    l = np.array(light, dtype=np.float32)
    out = d[None, None, :] + (l - d)[None, None, :] * g[:, :, None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB")


def overlay() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    lay = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return lay, ImageDraw.Draw(lay)


def composite(base: Image.Image, lay: Image.Image) -> Image.Image:
    return Image.alpha_composite(base.convert("RGBA"), lay).convert("RGB")


def shadow_of(card: Image.Image, blur: int = 18, alpha: int = 90, offset: tuple[int, int] = (10, 14)) -> tuple[Image.Image, tuple[int, int]]:
    """A soft shadow for a card (RGBA with its own alpha)."""
    pad = blur * 3
    a = Image.new("L", (card.width + pad * 2, card.height + pad * 2), 0)
    mask = card.split()[-1] if card.mode == "RGBA" else Image.new("L", card.size, 255)
    a.paste(mask, (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: v * alpha // 255)
    sh = Image.new("RGBA", a.size, (0, 0, 0, 0))
    sh.putalpha(a)
    return sh, (offset[0] - pad, offset[1] - pad)


def blend(base: Image.Image, img: Image.Image, x: int, y: int) -> None:
    """alpha_composite that allows a position partly outside the base."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(img, (x, y))
    base.alpha_composite(layer)


def paste_card(base: Image.Image, card: Image.Image, centre: tuple[float, float], angle: float = 0.0, shadow: bool = True) -> None:
    """Paste an RGB card rotated about its centre with a soft drop shadow."""
    c = card.convert("RGBA")
    if angle:
        c = c.rotate(angle, resample=Image.BICUBIC, expand=True)
    x, y = round(centre[0] - c.width / 2), round(centre[1] - c.height / 2)
    if shadow:
        sh, off = shadow_of(c)
        blend(base, sh, x + off[0], y + off[1])
    blend(base, c, x, y)


def frame_grid(base: Image.Image, ink: tuple[int, int, int], step: int = 128, alpha: int = 34) -> Image.Image:
    """Thin grid lines over the whole sleeve and small plus marks where they cross (in the field only)."""
    lay, d = overlay()
    col = (*ink, alpha)
    for x in range(step, S, step):
        d.line([(x, 0), (x, S)], fill=col, width=2)
    for y in range(step, S, step):
        d.line([(0, y), (S, y)], fill=col, width=2)
    mark = (*ink, min(255, alpha * 3))
    for x in range(step, S, step):
        for y in range(step, S, step):
            if y > ART_H:
                d.line([(x - 8, y), (x + 8, y)], fill=mark, width=2)
                d.line([(x, y - 8), (x, y + 8)], fill=mark, width=2)
    return composite(base, lay)


def crop_marks(base: Image.Image, box: tuple[int, int, int, int], colour: tuple[int, int, int], out: int = 26, inset: int = 14, alpha: int = 230) -> Image.Image:
    """Corner crop marks around a box (print registration)."""
    lay, d = overlay()
    x0, y0, x1, y1 = box
    col = (*colour, alpha)
    for cx, cy, sx, sy in ((x0, y0, -1, -1), (x1, y0, 1, -1), (x0, y1, -1, 1), (x1, y1, 1, 1)):
        d.line([(cx + sx * inset, cy), (cx + sx * (inset + out), cy)], fill=col, width=3)
        d.line([(cx, cy + sy * inset), (cx, cy + sy * (inset + out))], fill=col, width=3)
    return composite(base, lay)


def base_sleeve(colour: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", (S, S), colour)


def envelope(path: Path, bins: int, seconds: float | None = None) -> np.ndarray:
    """Loudness envelope (0..1) of an audio file, from the real samples."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000"]
    if seconds:
        cmd += ["-t", str(seconds)]
    cmd += ["-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    n = len(x) // bins
    env = np.sqrt((x[: n * bins].reshape(bins, n) ** 2).mean(axis=1))
    env = env / max(env.max(), 1e-6)
    return env**0.7


def frame_at(video: Path, t: float, name: str, width: int = 1600) -> Image.Image:
    out = WORK / f"{name}.png"
    if not out.exists():
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1", "-vf", f"scale={width}:-1", str(out)],
            check=True,
        )
    return load(out)


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=index)


# ---------------------------------------------------------------------------------------------
# The ten covers. Each takes the room colour and returns a 1024 x 1024 RGB picture.
# ---------------------------------------------------------------------------------------------


def cover_arts(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    art = load(MEDIA / "layla-and-fanny/art/official/fighting-together-splash-art.jpg")
    # Both aspirants, mid action. A wide crop that keeps the two faces and the blades.
    win = cover_crop(art, S, ART_H, fx=0.5, fy=0.42, zoom=1.0)
    base.paste(win, (0, 0))
    base = frame_grid(base, ink)
    lay, d = overlay()
    d.rectangle([28, 28, S - 29, ART_H - 29], outline=(255, 255, 255, 215), width=3)
    base = composite(base, lay)
    base = crop_marks(base, (28, 28, S - 29, ART_H - 29), WHITE, inset=0, out=34)
    return base


# ---------------------------------------------------------------------------------------------
# Video: a clapperboard that opens. The shelf splits this cover in two (a gatefold, see
# features/library/shelf/engine.ts): the inside of the front panel is Films, the inside of the
# back panel is Others. The two inside pictures are covers/video-films.webp and
# covers/video-others.webp; their names, lines and colours are in shelf/video-halves.ts.
# ---------------------------------------------------------------------------------------------

HALVES = common.REPO / "apps" / "web" / "src" / "features" / "library" / "shelf" / "video-halves.ts"


def halves() -> dict[str, tuple[int, int, int]]:
    """Field colours of the two halves, read from video-halves.ts (room -> colour)."""
    text = HALVES.read_text(encoding="utf-8")
    pairs = re.findall(r'room: "(\w+)",.*?colour: "(#[0-9a-fA-F]{6})"', text, re.S)
    return {room: hex_rgb(col) for room, col in pairs}


def shade(colour: tuple[int, int, int], k: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, round(c * k))) for c in colour)  # type: ignore[return-value]


def sprockets(d: ImageDraw.ImageDraw, x0: int, x1: int, y0: int, y1: int, colour, pitch: int = 64) -> None:
    """Sprocket holes along the top and the bottom of a strip that runs from y0 to y1."""
    hole_w, hole_h = 34, 22
    for x in range(x0, x1, pitch):
        for yy in (y0 + 13, y1 - 13 - hole_h):
            d.rounded_rectangle([x, yy, x + hole_w, yy + hole_h], radius=6, fill=colour)


def clapper_stick(colour: tuple[int, int, int], w: int, h: int) -> Image.Image:
    """The striped stick of a clapperboard (RGBA), white and ink diagonals, with its hinge pin."""
    stick = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(stick)
    d.rectangle([0, 0, w, h], fill=(*INK, 255))
    band = 92
    for i in range(-2, w // band + 3):
        x = i * band
        d.polygon([(x, h), (x + band // 2, h), (x + band // 2 + h, 0), (x + h, 0)], fill=(*WHITE, 255))
    # The hinge pin at the left end.
    r = h // 2 - 9
    d.ellipse([12, h // 2 - r, 12 + r * 2, h // 2 + r], fill=(*colour, 255), outline=(*INK, 255), width=4)
    return stick


# The film inside: one frame of the Ruby film (Ruby at the console). The front shows its edge.
FILMS_FRAME = ("ruby-and-angela/video/ruby/ruby-final.mp4", 28.8)


def trim_bars(im: Image.Image, level: int = 14) -> Image.Image:
    """Drop the black letterbox rows a film frame may carry at its top and bottom."""
    g = np.asarray(im.convert("L"), dtype=np.float32)
    rows = np.where(g.mean(axis=1) > level)[0]
    if len(rows) == 0:
        return im
    return im.crop((0, int(rows[0]), im.width, int(rows[-1]) + 1))


def cover_video(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour).convert("RGBA")
    frame = trim_bars(frame_at(MEDIA / "layla-and-fanny/video/official/lore/trailer/trailer.webm", 11.2, "film-layla"))
    inside = trim_bars(frame_at(MEDIA / FILMS_FRAME[0], FILMS_FRAME[1], "film-ruby-console"))
    # The slate: an ink board holding one frame, sprockets along its edges, and the next frame
    # running off the right edge (there is more inside).
    sx0, sy0, sx1, sy1 = 40, 172, S, 612
    lay, d = overlay()
    d.rectangle([sx0, sy0, sx1, sy1], fill=(*INK, 255))
    base.alpha_composite(lay)
    fw, fh = 760, 344
    fy = (sy0 + sy1) // 2 - fh // 2
    base.paste(cover_crop(frame, fw, fh, fx=0.5, fy=0.5), (sx0 + 28, fy))
    nx = sx0 + 28 + fw + 28
    base.paste(cover_crop(inside, 420, fh, fx=0.62, fy=0.45), (nx, fy))
    lay, d = overlay()
    sprockets(d, sx0 + 18, S, sy0, sy1, (*colour, 255))
    base.alpha_composite(lay)
    # The stick, open a little on its hinge at the left: the cover is something that opens.
    sw, sh_ = S - 80, 66
    pad = 160
    holder = Image.new("RGBA", (S, sh_ + pad * 2), (0, 0, 0, 0))
    holder.alpha_composite(clapper_stick(colour, sw, sh_), (40, pad))
    pin = (40 + 12 + sh_ // 2 - 9, pad + sh_ // 2)
    holder = holder.rotate(3.6, resample=Image.BICUBIC, center=pin)
    top = sy0 - 12 - sh_ - pad
    shadow, off = shadow_of(holder, blur=10, alpha=90, offset=(4, 10))
    blend(base, shadow, off[0], top + off[1])
    blend(base, holder, 0, top)
    return frame_grid(base.convert("RGB"), ink)


def cover_video_films(colour):
    """Inside of the front panel: one film, wide, on a strip. The Films room is one film at a time."""
    ink = ink_for(colour)
    base = base_sleeve(colour)
    frame = trim_bars(frame_at(MEDIA / FILMS_FRAME[0], FILMS_FRAME[1], "film-ruby-console"))
    sy0, sy1 = 64, 612
    lay, d = overlay()
    d.rectangle([0, sy0, S, sy1], fill=(4, 6, 14, 255))
    base = composite(base, lay)
    fw, fh = 944, 404
    fy = (sy0 + sy1) // 2 - fh // 2
    base.paste(cover_crop(frame, fw, fh, fx=0.55, fy=0.4), (40, fy))
    lay, d = overlay()
    sprockets(d, -8, S, sy0, sy1, (*colour, 255))
    base = composite(base, lay)
    base = frame_grid(base, ink, alpha=26)
    return crop_marks(base, (40, fy, S - 40, fy + fh), WHITE, inset=10, out=26, alpha=210)


# Official videos that are not one of the ten films, at a moment that reads well small.
OTHERS_FRAMES = [
    ("selena-and-obsidia/video/skin-showcase/001_3999520529387107465.mp4", 10.6, 0.5),
    ("vexana-and-guinevere/video/skin-showcase/skin-showcase.webm", 41.8, 0.5),
    ("layla-and-fanny/video/official/other/music-video/music.webm", 27.1, 0.5),
    ("lesley-and-change/video/official/teaser/001_3307542160288522496.mp4", 15.1, 0.5),
    ("ruby-and-angela/video/skin-showcase/skin-final.mp4", 15.7, 0.45),
    ("layla-and-fanny/video/official/other/short-animation/short-animation-final.mp4", 61.1, 0.5),
    ("lesley-and-change/video/official/skin-showcase/final.mp4", 10.9, 0.5),
    ("ruby-and-angela/video/revamp/revamp-final.mp4", 26.2, 0.3),
    ("selena-and-obsidia/video/music-collection/001_4013351897154849593.mp4", 213.9, 0.62),
]


def cover_video_others(colour):
    """Inside of the back panel: a contact sheet of many official videos. Others is for browsing."""
    ink = ink_for(colour)
    base = base_sleeve(colour)
    cols, rows = 3, 3
    x0, y0, x1, y1 = 40, 40, S - 40, 612
    gut = 14
    cw = (x1 - x0 - gut * (cols - 1)) // cols
    ch = (y1 - y0 - gut * (rows - 1)) // rows
    lay, d = overlay()
    for i, (rel, t, fx) in enumerate(OTHERS_FRAMES[: cols * rows]):
        im = frame_at(MEDIA / rel, t, f"others-{i}", width=960)
        cx = x0 + (i % cols) * (cw + gut)
        cy = y0 + (i // cols) * (ch + gut)
        base.paste(cover_crop(im, cw, ch, fx=fx, fy=0.5), (cx, cy))
        d.rectangle([cx, cy, cx + cw - 1, cy + ch - 1], outline=(255, 255, 255, 120), width=2)
    base = composite(base, lay)
    base = frame_grid(base, ink, alpha=26)
    return crop_marks(base, (x0, y0, x1, y1), WHITE, inset=10, out=26, alpha=210)


def cover_music(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    env = envelope(common.PUBLIC / "audio/music/we-believe.m4a", 92)
    lay, d = overlay()
    cx, cy = S // 2, 330
    for r in range(70, 360, 34):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 46), width=2)
    pitch, bw = 10.6, 6
    n = len(env)
    x0 = (S - n * pitch) / 2
    for i, e in enumerate(env):
        h = 14 + e * 250
        x = x0 + i * pitch
        d.rounded_rectangle([x, cy - h, x + bw, cy + h], radius=3, fill=(255, 255, 255, 245))
    # Playhead
    px = x0 + n * pitch * 0.38
    d.line([(px, 40), (px, ART_H - 40)], fill=(11, 11, 14, 230), width=3)
    d.polygon([(px - 9, 40), (px + 9, 40), (px, 56)], fill=(11, 11, 14, 230))
    base = composite(base, lay)
    base = frame_grid(base, ink)
    return crop_marks(base, (28, 28, S - 29, ART_H - 29), WHITE, inset=0, out=30, alpha=200)


def cover_voicelines(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    voice = common.SRC / "audio/layla/03_校則、なにそれ.flac"
    env = envelope(voice, 96)
    lay, d = overlay()
    jp = "YuGothB.ttc"
    f = font(f"C:/Windows/Fonts/{jp}", 214)
    d.text((52, 22), "校則、", font=f, fill=(255, 255, 255, 255))
    d.text((52, 236), "なにそれ", font=f, fill=(255, 255, 255, 255))
    # The real line as a waveform, mirrored, under the type.
    pitch, bw = 10.0, 5
    cy = 586
    x0 = (S - len(env) * pitch) / 2
    for i, e in enumerate(env):
        h = 3 + e * 38
        x = x0 + i * pitch
        d.rounded_rectangle([x, cy - h, x + bw, cy + h], radius=2, fill=(11, 11, 14, 235))
    base = composite(base, lay)
    return frame_grid(base, ink)


def cover_fanart(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour).convert("RGBA")
    art = load(MEDIA / "ruby-and-angela/art/official/angela-splash-art.jpg")
    pw, ph = 700, 470
    print_ = cover_crop(art, pw, ph, fx=0.55, fy=0.42, zoom=1.0)
    card = Image.new("RGB", (pw + 36, ph + 36 + 44), (255, 255, 255))
    card.paste(print_, (18, 18))
    # Construction lines behind the print: a loose frame and a diagonal.
    lay, d = overlay()
    col = (*INK, 120)
    d.rectangle([92, 60, 932, 600], outline=col, width=2)
    d.line([(92, 600), (932, 60)], fill=col, width=2)
    d.ellipse([452, 285, 572, 405], outline=col, width=2)
    base.alpha_composite(lay)
    paste_card(base, card, (S / 2 + 6, 322), angle=-4.0)
    out = base.convert("RGB")
    out = crop_marks(out, (68, 40, S - 69, ART_H - 22), INK, inset=0, out=30)
    return frame_grid(out, ink)


def cover_comic(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    pages = common.SRC / "story/official/guinevere-vexana-comic"
    a = load(pages / "12.jpg")
    b = load(pages / "1.jpg")
    c = load(pages / "25.jpg")
    lay, d = overlay()
    panels = [
        ((40, 40, 604, 612), a, (0.5, 0.42)),
        ((628, 40, 984, 316), b, (0.5, 0.78)),
        ((628, 340, 984, 612), c, (0.5, 0.5)),
    ]
    for (x0, y0, x1, y1), im, (fx, fy) in panels:
        pw, ph = x1 - x0, y1 - y0
        base.paste(cover_crop(im, pw, ph, fx=fx, fy=fy, zoom=1.0), (x0, y0))
    for (x0, y0, x1, y1), _, _ in panels:
        d.rectangle([x0 - 1, y0 - 1, x1, y1], outline=(11, 11, 14, 255), width=6)
    base = composite(base, lay)
    return frame_grid(base, ink)


def cover_lore(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    art = load(MEDIA / "_others/character/the-enders.png")
    win = cover_crop(art, S, ART_H, fx=0.5, fy=0.5, zoom=1.18)
    # The entity sheet is black figures on white: invert it so they glow on a deep green ground.
    win = duotone(ImageOps.invert(win), (7, 38, 22), (200, 255, 224), gamma=0.8)
    base.paste(win, (0, 0))
    lay, d = overlay()
    # Atlas marks: a ring, cross hairs and edge ticks.
    cx, cy = S // 2, ART_H // 2
    for r in (120, 250):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 120), width=2)
    d.line([(cx - 300, cy), (cx + 300, cy)], fill=(255, 255, 255, 90), width=2)
    d.line([(cx, 40), (cx, ART_H - 40)], fill=(255, 255, 255, 90), width=2)
    for x in range(0, S, 32):
        h = 18 if x % 128 == 0 else 8
        d.line([(x, ART_H - 1), (x, ART_H - 1 - h)], fill=(255, 255, 255, 200), width=2)
        d.line([(x, 0), (x, h)], fill=(255, 255, 255, 200), width=2)
    base = composite(base, lay)
    return frame_grid(base, ink)


def cover_design(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour).convert("RGBA")
    # Halftone dots in a darker tone behind the posters.
    lay, d = overlay()
    dark = (max(0, colour[0] - 70), max(0, colour[1] - 50), max(0, colour[2] - 50))
    for y in range(24, ART_H + 30, 36):
        for x in range(24 + (18 if (y // 36) % 2 else 0), S, 36):
            r = 7 - 6 * (y / (ART_H + 30))
            d.ellipse([x - r, y - r, x + r, y + r], fill=(*dark, 255))
    base.alpha_composite(lay)
    promo = MEDIA / "_others/promotional"

    def first_image(code: str) -> Image.Image:
        folder = promo / f"instagram_p_{code}"
        jpgs = sorted(folder.glob("0*.jpg")) or sorted(folder.glob("thumbnail.jpg"))
        return load(jpgs[0])

    p1 = first_image("DdIZTBHj4UA")  # 1080 x 1350
    p2 = first_image("C_C_5YwBrad")  # 1080 x 1080
    p3 = first_image("DdOFQNEEkbd")  # a reel poster, 1080 x 1920

    def card(im: Image.Image, w: int) -> Image.Image:
        h = round(w * im.height / im.width)
        c = im.resize((w, h), Image.LANCZOS)
        out = Image.new("RGB", (w + 12, h + 12), (255, 255, 255))
        out.paste(c, (6, 6))
        return out

    paste_card(base, card(p3, 236), (800, 336), angle=5.0)
    paste_card(base, card(p1, 392), (326, 334), angle=-6.0)
    paste_card(base, card(p2, 340), (640, 360), angle=2.5)
    out = base.convert("RGB")
    return frame_grid(out, ink)


def cover_animation(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    frame = frame_at(common.MEDIA / "_others/in-game-animation/layla/idle.mkv", 1.5, "anim-layla", width=3000)
    win = cover_crop(frame, S, ART_H - 40, fx=0.47, fy=0.5, zoom=1.0)
    base.paste(win, (0, 0))
    lay, d = overlay()
    # A timeline under the picture: frame ticks and a playhead.
    ty = ART_H - 40
    d.rectangle([0, ty, S, ART_H + 28], fill=(11, 11, 14, 255))
    for i, x in enumerate(range(8, S, 16)):
        h = 20 if i % 8 == 0 else 9
        d.line([(x, ty + 4), (x, ty + 4 + h)], fill=(255, 255, 255, 230), width=2)
    ph = 612
    d.line([(ph, 0), (ph, ART_H + 28)], fill=(*colour, 255), width=3)
    d.polygon([(ph - 10, ty + 2), (ph + 10, ty + 2), (ph, ty + 22)], fill=(*colour, 255))
    base = composite(base, lay)
    return frame_grid(base, ink)


def cover_others(colour):
    ink = ink_for(colour)
    base = base_sleeve(colour)
    uv = load(MEDIA / "layla-and-fanny/3d/fanny/fanny_skin09_high_body_d.png")
    uv = duotone(uv.resize((ART_H, ART_H), Image.LANCZOS), (22, 28, 40), (236, 240, 248), gamma=1.1)
    base.paste(uv, (S - ART_H - 40, 0))
    eyes = load(MEDIA / "layla-and-fanny/3d/fanny/jiqirenbiaoqing_skin09_d.png").resize((330, 330), Image.LANCZOS)
    base.paste(eyes, (40, 40))
    lay, d = overlay()
    d.rectangle([40, 40, 369, 369], outline=(255, 255, 255, 220), width=3)
    # A wire cube, isometric, for the 3D models.
    cx, cy, a = 205, 500, 90
    pts = {
        "t": (cx, cy - a),
        "tr": (cx + a * 0.87, cy - a * 0.5),
        "br": (cx + a * 0.87, cy + a * 0.5),
        "b": (cx, cy + a),
        "bl": (cx - a * 0.87, cy + a * 0.5),
        "tl": (cx - a * 0.87, cy - a * 0.5),
        "c": (cx, cy),
    }
    for p, q in (("t", "tr"), ("tr", "br"), ("br", "b"), ("b", "bl"), ("bl", "tl"), ("tl", "t"), ("c", "t"), ("c", "bl"), ("c", "br")):
        d.line([pts[p], pts[q]], fill=(255, 255, 255, 235), width=3)
    base = composite(base, lay)
    base = frame_grid(base, ink)
    return crop_marks(base, (40, 40, S - 41, ART_H - 22), WHITE, inset=0, out=26, alpha=190)


BUILDERS = {
    "arts": cover_arts,
    "video": cover_video,
    "music": cover_music,
    "voicelines": cover_voicelines,
    "fanart": cover_fanart,
    "comic": cover_comic,
    "lore": cover_lore,
    "design": cover_design,
    "animation": cover_animation,
    "others": cover_others,
}


# The two halves of the Video cover: made with it, keyed covers/video-<room>.webp.
HALF_BUILDERS = {
    "video-films": ("films", cover_video_films),
    "video-others": ("others", cover_video_others),
}


def main(argv: list[str]) -> int:
    force = "--force" in argv
    wanted = [a for a in argv if not a.startswith("--")] or common.SLUGS
    if "video" in wanted:
        wanted += [h for h in HALF_BUILDERS if h not in wanted]
    colours = registry()
    missing = [s for s in common.SLUGS if s not in colours]
    if missing:
        raise SystemExit(f"registry.ts has no colour for {missing}")
    half_colours = halves()
    total = 0
    for slug in wanted:
        out = common.key_path(f"covers/{slug}.webp")
        if not force and common.fresh(out, Path(__file__), REGISTRY, HALVES):
            print(f"  {slug}: fresh")
            total += out.stat().st_size
            continue
        if slug in HALF_BUILDERS:
            room, build = HALF_BUILDERS[slug]
            im = build(half_colours[room])
        else:
            im = BUILDERS[slug](colours[slug])
        assert im.size == (S, S), (slug, im.size)
        im.save(out, "WEBP", quality=88, method=6)
        im.save(WORK / f"{slug}.png")
        total += out.stat().st_size
        print(f"  {slug}: {common.human(out.stat().st_size)}")
    print("covers:", len(wanted), "bytes", common.human(total))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
