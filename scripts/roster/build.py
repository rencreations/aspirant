"""
Builds the hover animations of the roster wall (/character) from screen recordings of the game's
animated skin cards (Live2D: every strand of hair, the cloth and the light are really animated).

Source: one recording per character, named <slug>.mkv in a folder (1000x1500, 60 fps). The folder the
owner used is `C:/Users/muham/Videos/frame`. Any <slug>.mkv found is built, so a new character is
one file and one run.

What it does to each recording:
  - crops the logo at the top, the caption and the dark fade at the bottom, and the edge line
  - makes it loop without a jump: the last 0.8 s blend into the first 0.8 s
  - encodes H.264 without sound (the page's sound is the music), at 60 fps

Output: apps/web/public/video/roster/<slug>.mp4 and apps/web/src/features/character/roster/
        clips.generated.ts (the size of each file, and where the face is, for the loading bar and the
        placement).

Run: python -I scripts/roster/build.py "C:/Users/muham/Videos/frame"
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/video/roster"
TS = ROOT / "apps/web/src/features/character/roster/clips.generated.ts"

# The part of the 1000x1500 card that is the picture: x, y, width, height.
CROP = (12, 112, 976, 1050)
BLEND = 0.8
CRF = 20

# Where each recording sits in its splash art, measured by matching the recording against the art
# (scripts/roster/register.py, printed in the notes of docs/design/design-system.md): the middle of
# the cropped picture and its size, as fractions of the splash. "patch" plays the recording over just
# that part, feathered into the still picture. Selena's card is a re-posed version of her art (the
# head is turned), so it cannot be laid over the splash: "fill" plays it across the whole frame.
PLACE = {
    "obsidia": {"mode": "patch", "box": [0.4805, 0.1884, 0.1426, 0.2726]},
    "vexana": {"mode": "patch", "box": [0.5962, 0.4505, 0.1045, 0.1997]},
    "guinevere": {"mode": "patch", "box": [0.604, 0.3793, 0.1904, 0.3628]},
    "lesley": {"mode": "patch", "box": [0.5981, 0.3741, 0.1904, 0.3628]},
    "selena": {"mode": "fill", "face": [0.44, 0.32]},
}


def run(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]
    )
    return float(out.decode().strip())


def build(src: Path, dest: Path) -> None:
    d = duration(src)
    x, y, w, h = CROP
    crop = f"crop={w}:{h}:{x}:{y},fps=60,format=yuv420p"
    b = BLEND
    # B is the end, A the start; B fades into A, then the middle plays. The clip ends where B began,
    # so it joins itself.
    graph = (
        f"[0:v]{crop},split=3[s1][s2][s3];"
        f"[s1]trim=start={d - b:.3f}:end={d:.3f},setpts=PTS-STARTPTS[tail];"
        f"[s2]trim=start=0:end={b:.3f},setpts=PTS-STARTPTS[head];"
        f"[tail][head]xfade=transition=fade:duration={b:.3f}:offset=0[blend];"
        f"[s3]trim=start={b:.3f}:end={d - b:.3f},setpts=PTS-STARTPTS[mid];"
        f"[blend][mid]concat=n=2:v=1:a=0,format=yuv420p[v]"
    )
    run([
        "-i", str(src), "-filter_complex", graph, "-map", "[v]", "-an",
        "-c:v", "libx264", "-preset", "slower", "-tune", "animation", "-crf", str(CRF),
        "-profile:v", "high", "-g", "120", "-movflags", "+faststart", str(dest),
    ])


def main(folder: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    clips: dict[str, dict] = {}
    for src in sorted(folder.glob("*.mkv")):
        slug = src.stem
        if slug not in PLACE:
            print("skip", slug, "(no placement in PLACE)")
            continue
        dest = OUT / f"{slug}.mp4"
        build(src, dest)
        clips[slug] = {
            "bytes": dest.stat().st_size,
            "seconds": round(duration(dest), 2),
            **PLACE[slug],
        }
        print(slug, f"{dest.stat().st_size / 1048576:.1f} MB", clips[slug]["seconds"], "s", flush=True)
    body = json.dumps(clips, indent=2)
    TS.write_text(
        "/* Written by scripts/roster/build.py. Do not edit. */\n"
        "export interface RosterClip {\n"
        "  readonly bytes: number;\n"
        "  readonly seconds: number;\n"
        '  readonly mode: "patch" | "fill";\n'
        "  /** patch: the middle and size of the recording in the splash art, as fractions of it. */\n"
        "  readonly box?: readonly [number, number, number, number];\n"
        "  /** fill: the face in the recording, as fractions across and down. */\n"
        "  readonly face?: readonly [number, number];\n"
        "}\n\n"
        f"export const ROSTER_CLIPS: Readonly<Record<string, RosterClip>> = {body};\n"
        "\n/** The size of the cropped picture, width over height. */\n"
        f"export const CLIP_RATIO = {CROP[2] / CROP[3]:.5f};\n",
        encoding="utf8",
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]))
