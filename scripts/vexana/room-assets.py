"""
Makes the stickers on the room's buttons. Change pose and Back: her head and shoulders, cut from the
transparent side pictures that the hero uses (`apps/web/public/img/vexana/hero`). Action 1, 2 and 3:
a square of the idle picture (`apps/web/public/video/vexana-stage/still.webp`, 2560x1152) around what
each action plays: her face, her left hand and the Guardian's chest.

Run: python -I scripts/vexana/room-assets.py   (needs ffmpeg only)
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERO = ROOT / "apps/web/public/img/vexana/hero"
OUT = ROOT / "apps/web/public/img/vexana/room"

STAGE = ROOT / "apps/web/public/video/vexana-stage"

# output name -> (source path, crop "w:h:x:y" in source pixels, cut into a round medallion)
STICKERS = {
    "btn-pose.webp": (HERO / "normal-side.webp", "700:700:386:0", False),
    "btn-back.webp": (HERO / "ender-side.webp", "700:700:0:0", False),
    "btn-action-1.webp": (STAGE / "still.webp", "360:360:1010:160", True),
    "btn-action-2.webp": (STAGE / "still.webp", "360:360:1210:410", True),
    "btn-action-3.webp": (STAGE / "still.webp", "420:420:1217:91", True),
}

# The medallion: the picture inside a circle, with a thin white rim (alpha from the distance to the middle).
ROUND = (
    "format=rgba,geq="
    "r='if(gt(hypot(X-W/2,Y-H/2),W/2-9),255,r(X,Y))':"
    "g='if(gt(hypot(X-W/2,Y-H/2),W/2-9),255,g(X,Y))':"
    "b='if(gt(hypot(X-W/2,Y-H/2),W/2-9),255,b(X,Y))':"
    "a='255*lt(hypot(X-W/2,Y-H/2),W/2-2)'"
)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (src, crop, rnd) in STICKERS.items():
        out = OUT / name
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(src),
                "-vf", f"crop={crop},scale=420:420:flags=lanczos" + ("," + ROUND if rnd else ""),
                "-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p" if not rnd else "yuva420p",
                str(out),
            ],
            check=True,
        )
        print(out.relative_to(ROOT), out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
