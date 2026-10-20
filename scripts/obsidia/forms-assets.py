"""
Builds the two film clips and the two photos of Obsidia's "Two forms" section (About, Details).

  Ender form    the transformation in the Pawn's Gambit trailer (`trailer.webm`, 24 fps, 2560x1080):
                from just after the flash that opens it to the cut to Selena's mecha, so only Obsidia is in it.
                The subtitles sit at the top of the frame and are cropped off.
  Normal form   Obsidia's own trailer (`obsidia.webm`, 30 fps, 1920x1080) from her eye opening to
                the cut that follows the red lines. The subtitles sit at the bottom and are cropped.

Both are silent (the page's sound is the music and the voice lines) and 60 fps like the stage, so
the page keeps its pace while one plays beside it (the source frames are shown twice or more).

Output: apps/web/public/video/obsidia/forms/<id>.mp4, apps/web/public/img/obsidia/<id>.webp
Run:    python -I scripts/obsidia/forms-assets.py "D:/ren/aspirant/media/selena-and-obsidia"
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VIDEO_OUT = ROOT / "apps/web/public/video/obsidia/forms"
IMG_OUT = ROOT / "apps/web/public/img/obsidia"

# Times in seconds in the source. The cuts were found by scene detection: the trailer flashes
# white at 154.04 and cuts to Selena's mecha at 165.375, Obsidia's trailer cuts at 28.2 (her eye)
# and at 44.133 (after the red lines).
FORMS = {
    "form-ender": {
        "src": "trailer.webm",
        "start": 154.5,
        "end": 165.3,
        "crop": "crop=2560:990:0:90",  # the subtitles are in the top 90 pixels
        "poster": 164.2,
        # The thumbnail is 16:9: a centred cut of the wide frame, with the wings and the figure.
        "poster_crop": "crop=1760:990:400:90",
    },
    "form-normal": {
        "src": "obsidia.webm",
        "start": 28.2,
        "end": 44.1,
        "crop": "crop=1920:960:0:0",  # the subtitles are in the bottom 120 pixels
        "poster": 40.0,
        "poster_crop": "crop=1706:960:107:0",
    },
}


def run(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def main(media: Path) -> None:
    VIDEO_OUT.mkdir(parents=True, exist_ok=True)
    for fid, f in FORMS.items():
        src = media / f["src"]
        run([
            "-ss", str(f["start"]), "-to", str(f["end"]), "-i", str(src), "-an",
            "-vf", f"{f['crop']},fps=60,scale=1920:-2:flags=lanczos,setsar=1,format=yuv420p",
            "-c:v", "libx264", "-preset", "slower", "-tune", "animation", "-crf", "23",
            "-profile:v", "high", "-g", "120", "-movflags", "+faststart",
            str(VIDEO_OUT / f"{fid}.mp4"),
        ])
        run([
            "-ss", str(f["poster"]), "-i", str(src), "-frames:v", "1",
            "-vf", f"{f['poster_crop']},scale=1280:720:flags=lanczos",
            "-c:v", "libwebp", "-quality", "86", str(IMG_OUT / f"{fid}.webp"),
        ])
        size = (VIDEO_OUT / f"{fid}.mp4").stat().st_size / 1048576
        print(fid, f"{size:.1f} MB", flush=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
