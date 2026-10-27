"""
Makes the stickers on the buttons of Guinevere's room. Change pose and Back: her head and
shoulders, cut from the transparent side pictures of the story pair (`apps/web/public/img/
guinevere/web`): the happy one for the pose, the quiet one for Back. Action 1, 2 and 3: a round
medallion cut from the idle picture (`apps/web/public/video/guinevere-stage/still.webp`, 2560x1152)
around what each action plays: her face, her feet and her middle.

Run: python -I scripts/guinevere/room-assets.py   (needs ffmpeg only)
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "apps/web/public/img/guinevere/web"
OUT = ROOT / "apps/web/public/img/guinevere/room"
STAGE = ROOT / "apps/web/public/video/guinevere-stage"

# output name -> (source path, crop "w:h:x:y" in source pixels, cut into a round medallion)
STICKERS = {
    "btn-pose.webp": (WEB / "right.webp", "700:700:30:0", False),
    "btn-back.webp": (WEB / "left.webp", "700:700:386:0", False),
    "btn-action-1.webp": (STAGE / "still.webp", "360:360:1081:65", True),
    "btn-action-2.webp": (STAGE / "still.webp", "400:400:1067:700", True),
    "btn-action-3.webp": (STAGE / "still.webp", "380:380:1071:235", True),
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
                "-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p",
                str(out),
            ],
            check=True,
        )
        print(out.relative_to(ROOT), out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
