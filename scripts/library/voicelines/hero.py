"""The film behind the title of the Voicelines room, made from the owner's recording.

    C:/Users/muham/anaconda3/python.exe scripts/library/voicelines/hero.py [--force]

Source: C:\\Users\\muham\\Videos\\Timeline 1.mov (H.264, 1920 by 1080, 30 fps, 28.6 s, with sound). It is a behind
the scenes cut of a voice recording session, and it has English subtitles and a name card burned into the
picture in ONE stretch of it.

What it does
  * Cuts that stretch out and keeps the whole 16:9 frame (no crop). A scan of the film at ten frames a
    second (the lower centre for white letters, the lower right for the blue name card) puts the card at 4.8
    to 9.0 s and the subtitle at 5.4 to 8.6 s and 9.1 to 11.5 s, and nothing anywhere else. The cut takes
    4.6 to 11.9 s, which leaves the first 4.6 s and the last 16.7 s (21.3 s of film that has no text in it).
  * Has no sound (the hero never plays sound).
  * Makes the loop seamless: the first second is only used to dissolve the end of the film into its start, as
    `scripts/library/design/hero.py` does, so the film starts over without a cut.
  * Writes two sizes, picked by the page from the visitor's display only (width), and the first frame of the
    loop as a still (the page shows it while the film loads and when it cannot play).

Writes to the mirror (library/v1/voicelines/hero/v1/): loop-1920.mp4, loop-1280.mp4, poster.webp, and
hero.json beside this file (build.py puts it in voicelines.json as `hero`).

A file that is in the bucket is cached for 30 days, so a key is never written twice: change HERO_VERSION to
make new ones. Without --force the script stops if a key already exists.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

SRC = Path(r"C:\Users\muham\Videos\Timeline 1.mov")
HERO_VERSION = "v1"
BASE = f"voicelines/hero/{HERO_VERSION}"
HERE = Path(__file__).resolve().parent

# The parts of the source that are kept, in seconds: before the subtitle and the card, and after them.
KEEP = ((0.0, 4.6), (11.9, 28.608))
# The seconds of the dissolve from the end of the loop back to its start.
FADE = 1.0
# The loop begins here, so that the first frame is a real frame, not the start of the dissolve.
LOOP_FROM = FADE

# name, width, height, crf, maxrate (kbit/s).
SIZES = [
    ("loop-1920.mp4", 1920, 1080, 27, 2500),
    ("loop-1280.mp4", 1280, 720, 27, 1500),
]


def kept_seconds() -> float:
    return sum(b - a for a, b in KEEP)


def encode(name: str, w: int, h: int, crf: int, maxrate: int, force: bool) -> Path:
    out = common.key_path(f"{BASE}/{name}")
    if out.exists() and not force:
        raise SystemExit(f"{out} exists and may be in the bucket already. Change HERO_VERSION, or pass --force.")
    out.parent.mkdir(parents=True, exist_ok=True)
    total = kept_seconds()
    body = total - LOOP_FROM  # length of the loop
    (a0, a1), (b0, b1) = KEEP
    # [j] is the two kept parts one after the other. [main] is [j] from LOOP_FROM to the end and [head] its first
    # FADE seconds. The end of main dissolves into head, and head ends exactly where main begins: no seam.
    graph = (
        f"[0:v]split=2[s1][s2];"
        f"[s1]trim=start={a0}:end={a1},setpts=PTS-STARTPTS[a];"
        f"[s2]trim=start={b0}:end={b1},setpts=PTS-STARTPTS[b];"
        f"[a][b]concat=n=2:v=1:a=0[j0];"
        f"[j0]scale={w}:{h}:flags=lanczos,setsar=1,split[x][y];"
        f"[x]trim=start={LOOP_FROM},setpts=PTS-STARTPTS[main];"
        f"[y]trim=end={FADE},setpts=PTS-STARTPTS[head];"
        f"[main][head]xfade=transition=fade:duration={FADE}:offset={body - FADE:.3f},format=yuv420p[v]"
    )
    tmp = out.with_name(out.stem + ".part.mp4")
    common.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(SRC), "-filter_complex", graph, "-map", "[v]", "-an",
        "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", str(crf),
        "-maxrate", f"{maxrate}k", "-bufsize", f"{maxrate * 2}k", "-g", "60", "-keyint_min", "30",
        "-movflags", "+faststart", str(tmp),
    ])
    tmp.replace(out)
    return out


def main() -> None:
    force = "--force" in sys.argv
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    films = []
    for name, w, h, crf, maxrate in SIZES:
        out = encode(name, w, h, crf, maxrate, force)
        meta = common.ffprobe(out)
        films.append({
            "src": f"{BASE}/{name}", "w": meta["w"], "h": meta["h"], "dur": round(meta["dur"], 2),
            "bytes": out.stat().st_size,
        })
        print(f"{name}: {meta['w']}x{meta['h']}, {meta['dur']:.2f} s, {common.human(out.stat().st_size)}")

    # The still: the first frame of the loop at full size.
    big = common.key_path(f"{BASE}/{SIZES[0][0]}")
    still = common.WORK / "voicelines" / "hero-first.png"
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
    (HERE / "hero.json").write_text(
        json.dumps(meta, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    print("wrote hero.json; now run build.py")


if __name__ == "__main__":
    main()
