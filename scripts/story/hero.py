"""
Builds the hero film of the /story page from the owner's preview clip.

Source: D:\\ren\\aspirant\\media\\selena-and-obsidia\\video\\character-preview\\001_4018546186318517193.mp4
(VP9, 1920 by 1080, 60 fps, 15 s, with sound).

The clip has black bars baked into the picture while some shots play (about 12 percent at the top and
the bottom). The hero must fill the display, so the bars are cropped away: during a stretch of bars the
picture is zoomed in about its middle until the bars are outside the frame. The stretches begin and end on
a cut of the film (found with `select='gt(scene,0.25)'` and by reading every frame for a black first and
last row), so the zoom never jumps in the middle of a shot, except at the end of the second stretch where
the bars close inside the shot: there the zoom eases back to 1 in a third of a second as they go.

The opening (0 to 3.62 s) is left out: its bars open and shrink inside the shots, and its first shot is a
grey collage with margins of its own, which is no picture to open a page on. The film opens on the first
full picture and ends on the red eye.

Output (committed): public/video/story/hero.mp4 (H.264, 1920 by 1080, 60 fps, no sound, faststart) and
public/video/story/hero-poster.webp (the first frame, for the page while the film loads and when it
cannot play).

Run with the anaconda Python (Pillow and NumPy): C:\\Users\\muham\\anaconda3\\python.exe -I scripts\\story\\hero.py
ffmpeg and ffprobe must be on the PATH.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"D:\ren\aspirant\media\selena-and-obsidia\video\character-preview\001_4018546186318517193.mp4"
)
OUT_DIR = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "video" / "story"
W, H, FPS = 1920, 1080, 60

# The part of the clip that is kept (seconds in the source): from a cut, to the end.
START, END = 3.62, 14.98
# The poster is a clean full picture from the middle of the film (seconds in the source).
POSTER_AT = 4.55

# Stretches with bars: (from, to, zoom). The zoom is a little more than the 12 to 13 percent bars need
# (1 / (1 - 2 * 0.125) = 1.333), because compression leaves faint rows next to a bar.
BAR_ZOOM = 1.36
# Where the picture is taken from inside the zoom: 0 is the middle, -1 the far left, 1 the far right.
RUNS = [
    (7.275, 9.65, 0.0),
    (11.19, 12.90, 0.0),
]
# The bars of the second stretch close inside the shot (12.2 to 13.25): hold the zoom, then ease out.
EASE = (12.90, 13.25)


def zoom_at(t: float) -> tuple[float, float]:
    """The zoom and the sideways position at a time of the source."""
    for a, b, x in RUNS:
        if a <= t < b:
            return BAR_ZOOM, x
    a, b = EASE
    if a <= t < b:
        q = (t - a) / (b - a)
        e = q * q * (3 - 2 * q)
        return BAR_ZOOM + (1.0 - BAR_ZOOM) * e, 0.0
    return 1.0, 0.0


def frame_box(zoom: float, x: float) -> tuple[float, float, float, float]:
    """The part of the source frame that fills the output (left, top, right, bottom)."""
    cw, ch = W / zoom, H / zoom
    room = (W - cw) / 2
    left = room + x * room
    top = (H - ch) / 2
    return left, top, left + cw, top + ch


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "hero.mp4"
    poster = OUT_DIR / "hero-poster.webp"

    decode = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-ss", str(START), "-to", str(END), "-i", str(SRC),
            "-an", "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
        ],
        stdout=subprocess.PIPE,
    )
    encode = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
            "-r", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high",
            "-pix_fmt", "yuv420p", "-g", "120", "-movflags", "+faststart", str(out),
        ],
        stdin=subprocess.PIPE,
    )
    assert decode.stdout is not None and encode.stdin is not None
    size = W * H * 3
    n = 0
    while True:
        raw = decode.stdout.read(size)
        if len(raw) < size:
            break
        t = START + n / FPS
        zoom, x = zoom_at(t)
        img = Image.frombuffer("RGB", (W, H), raw, "raw", "RGB", 0, 1)
        if zoom != 1.0:
            img = img.resize((W, H), Image.LANCZOS, box=frame_box(zoom, x))
        if n == round((POSTER_AT - START) * FPS):
            img.save(poster, "WEBP", quality=82, method=6)
        encode.stdin.write(np.asarray(img).tobytes())
        n += 1
    encode.stdin.close()
    decode.wait()
    code = encode.wait()
    print(f"{n} frames, {n / FPS:.2f} s, ffmpeg exit {code}")
    if out.exists():
        print(f"{out.name}: {out.stat().st_size / 1e6:.1f} MB; {poster.name}: {poster.stat().st_size / 1e3:.0f} KB")
    return code


if __name__ == "__main__":
    sys.exit(main())
