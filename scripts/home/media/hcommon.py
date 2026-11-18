"""Shared paths and helpers of the home page media scripts (see README.md in this folder).

Run the scripts with the anaconda Python WITHOUT -I (they import this file and `common` of the library):

    C:/Users/muham/anaconda3/python.exe scripts/home/media/<script>.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "scripts" / "library"))
import common  # noqa: E402  (the library pipeline's paths, the text rules)

PUBLIC = REPO / "apps" / "web" / "public"
IMG = PUBLIC / "img" / "home"
VIDEO = PUBLIC / "video" / "home"
DATA = PUBLIC / "data" / "home"
LIBDATA = PUBLIC / "data" / "library"
SRC = common.SRC  # D:\ren\aspirant, read only
MEDIA = SRC / "media"
MIRROR = common.LIB_ROOT  # D:\ren\aspirant-r2\library\v1, read only here
WORK = Path(os.environ.get("ASPIRANT_HOME_WORK", r"D:\ren\aspirant-work\home\D"))
WORK.mkdir(parents=True, exist_ok=True)

CHARS = ["fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "obsidia", "selena"]


def ensure(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def library_data(name: str) -> Any:
    return read_json(LIBDATA / f"{name}.json")


def write_json(name: str, obj: Any) -> Path:
    """Write apps/web/public/data/home/<name>.json: compact, stable, UTF-8, LF. Fails on the text rules."""
    problems = common.check_json_text(obj, name)
    if problems:
        raise SystemExit("Text rule violations:\n" + "\n".join(problems[:40]))
    path = ensure(DATA / f"{name}.json")
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {path.relative_to(REPO)} ({common.human(len(text.encode()))})")
    return path


def size_of(path: Path) -> int:
    return path.stat().st_size


def public_path(path: Path) -> str:
    """A file under apps/web/public as the page asks for it (`/img/home/x.webp`)."""
    return "/" + path.relative_to(PUBLIC).as_posix()


def ffmpeg(args: list[str | Path], quiet: bool = True) -> None:
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-v", "error" if quiet else "info", "-y", *[str(a) for a in args]]
    subprocess.run(cmd, check=True)


def probe(path: Path) -> dict[str, Any]:
    return common.ffprobe(path)
