"""
Makes the two stickers on the room's buttons (Change pose and Back): her head and shoulders, cut
from the transparent side pictures that the hero uses (`apps/web/public/img/vexana/hero`).

Run: python -I scripts/vexana/room-assets.py   (needs ffmpeg only)
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERO = ROOT / "apps/web/public/img/vexana/hero"
OUT = ROOT / "apps/web/public/img/vexana/room"

# output name -> (source, crop "w:h:x:y" in source pixels)
STICKERS = {
    "btn-pose.webp": ("normal-side.webp", "700:700:386:0"),
    "btn-back.webp": ("ender-side.webp", "700:700:0:0"),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (src, crop) in STICKERS.items():
        out = OUT / name
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(HERO / src),
                "-vf", f"crop={crop},scale=420:420:flags=lanczos",
                "-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p",
                str(out),
            ],
            check=True,
        )
        print(out.relative_to(ROOT), out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
