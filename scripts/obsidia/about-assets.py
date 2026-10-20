"""
Builds the images of Obsidia's About drawer.

Stills: frames taken from the official videos at the moments the story tells (see STILLS).
Profile: her round profile picture, ob.jpg (a square picture, given as the second argument).

Run: python -I scripts/obsidia/about-assets.py "D:/ren/aspirant/media/selena-and-obsidia" "C:/Users/muham/Downloads/ob.jpg"
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image

# name -> (video, seconds, width)
STILLS = {
    "awakening": ("obsidia", 1, 1280),
    "planet": ("obsidia", 9, 1280),
    "storm-citadel": ("trailer", 16, 1440),
    "fleet": ("obsidia", 18, 1280),
    "boots": ("obsidia", 27, 1280),
    "citadel-hall": ("trailer", 46, 1440),
    "queen": ("obsidia", 42, 1280),
    "purge-city": ("obsidia", 21, 1280),
    "eye": ("obsidia", 30, 1280),
    "lightning": ("obsidia", 33, 1280),
    "weapon": ("obsidia", 36, 1280),
    "chains": ("obsidia", 57, 1280),
    "question": ("obsidia", 69, 1280),
    "two-faces": ("trailer", 52, 1440),
    "ender-form": ("trailer", 164, 1440),
}


def main() -> None:
    videos = Path(sys.argv[1])
    root = Path(__file__).resolve().parents[2]
    out = root / "apps" / "web" / "public" / "img" / "obsidia"
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
        # Shown as a circle, so it is a square picture with the face in the middle.
        picture = Image.open(Path(sys.argv[2])).convert("RGB")
        picture.save(out / "profile.webp", quality=92, method=6)
    for f in sorted(out.glob("*.webp")):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
