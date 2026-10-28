"""
Makes the hero loop of Guinevere's page from the uncut recording of her animation. The recording is
two turns of the same movement, and the two turns are not exact copies (the small stars and the
red spheres drift on their own), so a hard cut shows a jump. The loop is one turn, from START to
END, and the last FADE frames are dissolved into the FADE frames that came before START. The frame
after the last one is then the frame that follows the one the dissolve ends on: the loop closes
with no jump. The search for START and END was done on frame distances (the best matching pair of
turns, 80 frames apart); the character matches almost exactly, only the small sparkles differ.

Source: C:/Users/muham/Downloads/guin-loop.mov (1920 x 1080, 30 fps)
Output: apps/web/public/video/guinevere/hero-loop-1080.mp4, hero-loop-720.mp4 and
        hero-loop-poster.webp (the first frame of the loop)

Needs ffmpeg on the path and numpy and Pillow (the anaconda Python on this machine):
  C:/Users/muham/anaconda3/python.exe scripts/guinevere/hero-loop.py
"""

import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("C:/Users/muham/Downloads/guin-loop.mov")
OUT = Path(__file__).resolve().parents[2] / "apps/web/public/video/guinevere"
W, H, FPS = 1920, 1080, 30
START, END, FADE = 40, 120, 14


def read_frames(first: int, last: int) -> np.ndarray:
    """Frames first..last-1 as uint8 RGB."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(SRC),
        "-vf", f"select='between(n,{first},{last - 1})'", "-vsync", "0",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ]
    raw = subprocess.run(cmd, check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W, 3)


def encode(frames: np.ndarray, out: Path, height: int, crf: int) -> None:
    scale = ["-vf", f"scale=-2:{height}:flags=lanczos"] if height != H else []
    cmd = [
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", *scale,
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-g", str(FPS), "-movflags", "+faststart", str(out),
    ]
    subprocess.run(cmd, check=True, input=frames.tobytes())


def main() -> None:
    clip = read_frames(START - FADE, END).astype(np.float32)
    before = clip[:FADE]
    turn = clip[FADE:].copy()
    n = len(turn)
    for t in range(FADE):
        w = (t + 1) / FADE
        w = w * w * (3 - 2 * w)
        turn[n - FADE + t] = turn[n - FADE + t] * (1 - w) + before[t] * w
    turn = np.clip(turn + 0.5, 0, 255).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    encode(turn, OUT / "hero-loop-1080.mp4", 1080, 20)
    encode(turn, OUT / "hero-loop-720.mp4", 720, 22)
    Image.fromarray(turn[0]).save(OUT / "hero-loop-poster.webp", quality=84, method=6)
    print("frames", n, "seconds", n / FPS)


if __name__ == "__main__":
    main()
