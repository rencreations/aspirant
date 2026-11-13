"""The film behind the title of the Design room, made from the owner's recording.

    C:/Users/muham/anaconda3/python.exe scripts/library/design/hero.py [--force]

Source: C:\\Users\\muham\\Videos\\design.mov (H.264, 1920 by 1080, 25 fps, 77.9 s, with sound). It is the design
team's own behind the scenes cut, with English subtitles burned into the picture and the game's logo in the
top left corner.

What it does
  * Crops the picture to x 0..1920, y 90..900 (1920 by 810). The subtitles are one line each. A scan of 312
    frames (four a second, rows 820 to 1080, white letters with a dark outline) puts them at y 970 and below
    on every shot except the split screen at 49 to 55 s, where they start at y 915. The cut at 900 leaves 15
    pixels. The logo sits at x 20..232, y 18..85; it would be half cut by the page (the film fills the
    screen, so the sides are cropped on most displays) and would lie under the menu button, so the top is
    cropped past it.
  * Has no sound (the hero never plays sound).
  * Makes the loop seamless: the last second is dissolved into the first, as scripts/story/hero.py does, so
    the film starts over without a cut. The loop is the source from LOOP_FROM to the end, 76.9 s.
  * Writes two sizes, picked by the page from the visitor's display only (width and pixel ratio), and the
    first frame as a still (the page shows it while the film loads and when it cannot play).

Writes to the mirror (library/v1/design/hero/v1/): loop-1920.mp4, loop-1280.mp4, poster.webp, and
hero.meta.json beside this file (design/build.py puts it in design.json as `hero`).

A file that is in the bucket is cached for 30 days, so a key is never written twice: change HERO_VERSION to
make new ones. Without --force the script stops if a key already exists.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

SRC = Path(r"C:\Users\muham\Videos\design.mov")
HERO_VERSION = "v1"
BASE = f"design/hero/{HERO_VERSION}"
HERE = Path(__file__).resolve().parent

# The part of the picture that is kept (left, top, width, height of the 1920 by 1080 source).
CROP = (0, 90, 1920, 810)
# The seconds of the dissolve from the end of the loop back to its start.
FADE = 1.0
# The loop begins here, so that the first frame is a real frame, not the start of the dissolve.
LOOP_FROM = FADE

# name, width, height, crf, maxrate (kbit/s). The small one keeps the shape: 1280 by 540.
SIZES = [
    ("loop-1920.mp4", 1920, 810, 27, 2500),
    ("loop-1280.mp4", 1280, 540, 27, 1500),
]


def probe(path: Path) -> dict:
    return common.ffprobe(path)


def encode(name: str, w: int, h: int, crf: int, maxrate: int, dur: float, force: bool) -> Path:
    out = common.key_path(f"{BASE}/{name}")
    if out.exists() and not force:
        raise SystemExit(f"{out} exists and may be in the bucket already. Change HERO_VERSION, or pass --force.")
    out.parent.mkdir(parents=True, exist_ok=True)
    cx, cy, cw, ch = CROP
    body = dur - LOOP_FROM  # length of the loop
    # [main] is the source from LOOP_FROM to the end; [head] is the first FADE seconds. The end of main
    # dissolves into head, and head ends exactly where main begins, so the loop has no seam.
    graph = (
        f"[0:v]crop={cw}:{ch}:{cx}:{cy},scale={w}:{h}:flags=lanczos,setsar=1,split[a][b];"
        f"[a]trim=start={LOOP_FROM},setpts=PTS-STARTPTS[main];"
        f"[b]trim=end={FADE},setpts=PTS-STARTPTS[head];"
        f"[main][head]xfade=transition=fade:duration={FADE}:offset={body - FADE:.3f},format=yuv420p[v]"
    )
    tmp = out.with_name(out.stem + ".part.mp4")
    common.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(SRC), "-filter_complex", graph, "-map", "[v]", "-an",
        "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", str(crf),
        "-maxrate", f"{maxrate}k", "-bufsize", f"{maxrate * 2}k", "-g", "50", "-keyint_min", "25",
        "-movflags", "+faststart", str(tmp),
    ])
    tmp.replace(out)
    return out


def main() -> None:
    force = "--force" in sys.argv
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    info = probe(SRC)
    dur = info["dur"]
    films = []
    for name, w, h, crf, maxrate in SIZES:
        out = encode(name, w, h, crf, maxrate, dur, force)
        meta = probe(out)
        films.append({
            "src": f"{BASE}/{name}", "w": meta["w"], "h": meta["h"], "dur": round(meta["dur"], 2),
            "bytes": out.stat().st_size,
        })
        print(f"{name}: {meta['w']}x{meta['h']}, {meta['dur']:.2f} s, {common.human(out.stat().st_size)}")

    # The still: the first frame of the loop at full size.
    big = common.key_path(f"{BASE}/{SIZES[0][0]}")
    still = common.WORK / "design" / "hero-first.png"
    still.parent.mkdir(parents=True, exist_ok=True)
    common.run(["ffmpeg", "-y", "-v", "error", "-i", str(big), "-frames:v", "1", str(still)])
    poster = common.key_path(f"{BASE}/poster.webp")
    with Image.open(still) as im:
        im = im.convert("RGB")
        im.save(poster, "WEBP", quality=80, method=6)
        px = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        colour = "#{:02x}{:02x}{:02x}".format(*px)
        pw, ph = im.size
    print(f"poster.webp: {pw}x{ph}, {common.human(poster.stat().st_size)}, {colour}")

    meta = {"poster": f"{BASE}/poster.webp", "pw": pw, "ph": ph, "c": colour, "films": films}
    (HERE / "hero.meta.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print("wrote hero.meta.json; now run design/build.py")


if __name__ == "__main__":
    main()
