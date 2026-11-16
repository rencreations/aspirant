"""The muted loop on the first screen of the About page: how the series started.

The owner asked (16 Nov 2026) for the first screen's video to be the studio's own film about the
first Aspirant ideas, as "how it started". The whole film (160 s, with sound and with English
subtitles in the picture) is what the play control opens, from the collection. This script cuts the
short loop that plays by itself, muted, in the small preview and in the big window it grows into:
six stretches of the film in its own order, from the first drawing on the whiteboard to the
finished characters, about 20 seconds.

The window is 1920 by 810, so the film (1920 by 1080) is cropped to its middle band. That band
holds none of the film's subtitles (they sit in the lowest eighth) and not the game's mark (top
left). Every stretch below was looked at four frames a second for text: none shows. The cuts
between stretches are the film's own kind (it is a fast comedy), and the end dissolves into the
start so the loop has no seam.

    python scripts/about/start.py            # build both sizes and the poster
    python scripts/about/start.py sheet      # a contact sheet of the built loop, two frames a second

Outputs (committed): apps/web/public/video/about/start-1920.mp4, start-1280.mp4, start-poster.webp.
Their byte counts go into apps/web/src/features/about/media.ts. A file made again under the same
name needs a new name or the cache name bump in lib/media-store.ts.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(r"D:\ren\aspirant\media\layla-and-fanny\video\official\other\idea-bts\idea.webm")
OUT = ROOT / "apps" / "web" / "public" / "video" / "about"

# The window's shape, cut from the middle of the 1920 by 1080 picture.
CROP = "crop=1920:810:0:135"
FPS = 25
# Seconds of the dissolve that joins the end of the loop to its start.
FADE = 0.8

# (start, end) in seconds of the film, and what the stretch shows.
SHOTS = [
    (50.0, 57.2),  # the first drawing on the whiteboard, "NEW WORLD", the figure explained
    (128.25, 131.0),  # the mecha drawn on the board
    (135.0, 140.4),  # the concept sheets, pointed at and argued over
    (142.0, 143.4),  # the first animation
    (148.3, 150.2),  # the two characters in costume, in the fire light
    (152.0, 153.7),  # the two on the stage
]

SIZES = [
    ("start-1920.mp4", 1920, 810, "2600k"),
    ("start-1280.mp4", 1280, 540, "1500k"),
]


def graph(width: int, height: int) -> str:
    parts = []
    for i, (a, b) in enumerate(SHOTS):
        parts.append(
            f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,{CROP},fps={FPS},"
            f"scale={width}:{height}:flags=lanczos,setsar=1[s{i}]"
        )
    joined = "".join(f"[s{i}]" for i in range(len(SHOTS)))
    body = sum(b - a for a, b in SHOTS)
    parts.append(f"{joined}concat=n={len(SHOTS)}:v=1:a=0,split[a][b]")
    # The loop: the first FADE seconds are laid over the last ones, so the end shows the start.
    parts.append(f"[a]trim=start={FADE},setpts=PTS-STARTPTS[main]")
    parts.append(f"[b]trim=end={FADE},setpts=PTS-STARTPTS[head]")
    parts.append(
        f"[main][head]xfade=transition=fade:duration={FADE}:offset={body - 2 * FADE:.3f},format=yuv420p[v]"
    )
    return ";".join(parts)


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, width, height, rate in SIZES:
        target = OUT / name
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-i", str(SOURCE),
                "-filter_complex", graph(width, height), "-map", "[v]",
                "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", "25",
                "-maxrate", rate, "-bufsize", str(2 * int(rate[:-1])) + "k",
                "-g", "50", "-keyint_min", "25", "-movflags", "+faststart", "-an", str(target),
            ],
            check=True,
        )
        print(name, target.stat().st_size)
    poster = OUT / "start-poster.webp"
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-i", str(OUT / "start-1920.mp4"),
            "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", str(poster),
        ],
        check=True,
    )
    print(poster.name, poster.stat().st_size)


def sheet() -> None:
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT.parent / "start-sheet.jpg"
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-i", str(OUT / "start-1920.mp4"),
            "-vf", "fps=2,scale=384:-1,tile=8x6", "-frames:v", "1", str(target),
        ],
        check=True,
    )
    print(target)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "sheet":
        sheet()
    else:
        build()
