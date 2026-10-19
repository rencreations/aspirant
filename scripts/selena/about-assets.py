"""
Builds the images of Selena's About drawers.

Stills: frames taken from the official videos at the moments the story tells (see STILLS).
Profile: the two halves of the concept sheet (normal form on the left, mecha form on the right).

Run: python -I scripts/selena/about-assets.py "D:/ren/aspirant/media/selena-and-obsidia" "C:/Users/muham/Downloads/9ftpjc.webp"
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image

# name -> (video, seconds, width)
STILLS = {
    "plates": ("selena", 21, 1280),
    "blueprint": ("selena", 15, 1280),
    "smile": ("selena", 57, 1280),
    "roof-storm": ("trailer", 12, 1440),
    "obsidia-watching": ("selena", 39, 1280),
    "recall": ("selena", 30, 1280),
    "graduation": ("selena", 51, 1280),
    "rift-roof": ("trailer", 14, 1440),
    "bell-tower": ("selena", 45, 1280),
    "lightning-leap": ("skin-showcase", 52, 1280),
    "citadel-walk": ("trailer", 36, 1440),
    "obsidia-hall": ("trailer", 44, 1440),
    "chains-break": ("trailer", 72, 1440),
    "ender-form": ("skin-showcase", 9, 1280),
    "two-faces": ("trailer", 52, 1440),
}


def main() -> None:
    videos = Path(sys.argv[1])
    root = Path(__file__).resolve().parents[2]
    out = root / "apps" / "web" / "public" / "img" / "selena"
    out.mkdir(parents=True, exist_ok=True)
    for name, (video, t, w) in STILLS.items():
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(videos / f"{video}.webm"),
                "-frames:v", "1", "-vf", f"scale={w}:-2:flags=lanczos",
                "-c:v", "libwebp", "-quality", "80", str(out / f"{name}.webp"),
            ],
            check=True,
        )
    if len(sys.argv) > 2:
        sheet = Image.open(sys.argv[2]).convert("RGB")
        half = sheet.width // 2
        sheet.crop((0, 0, half, sheet.height)).save(out / "profile-normal.webp", quality=90, method=6)
        sheet.crop((half, 0, sheet.width, sheet.height)).save(out / "profile-mecha.webp", quality=90, method=6)
    for f in sorted(out.glob("*.webp")):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
