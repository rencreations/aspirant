"""Shared helpers for the story media tools (run with the anaconda Python, Pillow, ffmpeg on PATH).

Paths given to the tools are relative to the media root (default D:/ren/aspirant/media, override
with ASPIRANT_MEDIA) or absolute. Previews are written under a scratch folder (default
<temp>/aspirant-story-tools, override with STORY_SCRATCH) and the tool prints the file it wrote,
so it can be opened and looked at.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

MEDIA = Path(os.environ.get("ASPIRANT_MEDIA", "D:/ren/aspirant/media"))
SCRATCH = Path(os.environ.get("STORY_SCRATCH", Path(tempfile.gettempdir()) / "aspirant-story-tools"))
SCRATCH.mkdir(parents=True, exist_ok=True)


def resolve(path: str) -> Path:
    """A path relative to the media root, or an absolute one. Exits with a message when missing."""
    p = Path(path)
    if not p.is_absolute():
        p = MEDIA / path
    if not p.exists():
        sys.exit(f"not found: {p}")
    return p


def probe(path: Path) -> dict:
    """Width, height, duration, fps of an image or video (ffprobe)."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name:format=duration",
            "-of", "json", str(path),
        ],
        capture_output=True, text=True, check=False,
    ).stdout
    data = json.loads(out or "{}")
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    rate = stream.get("r_frame_rate", "0/1")
    num, _, den = rate.partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    return {
        "width": stream.get("width"),
        "height": stream.get("height"),
        "fps": round(fps, 3),
        "duration": float(fmt["duration"]) if fmt.get("duration") else None,
        "codec": stream.get("codec_name"),
    }


def out_name(stem: str, ext: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in stem)
    return SCRATCH / f"{safe}.{ext}"
