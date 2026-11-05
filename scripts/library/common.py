"""Shared helpers for the library pipeline (see README.md in this folder).

Import with:  sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  then  from library import common
or, when a script sits in scripts/library/, simply:  import common
Run scripts with the anaconda Python:  C:/Users/muham/anaconda3/python.exe
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------------------------
# Paths. Everything heavy goes on D: (C: is nearly full).
# ---------------------------------------------------------------------------------------------

REPO = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get("ASPIRANT_SRC", r"D:\ren\aspirant"))
MIRROR = Path(os.environ.get("ASPIRANT_R2_MIRROR", r"D:\ren\aspirant-r2"))
WORK = Path(os.environ.get("ASPIRANT_WORK", r"D:\ren\aspirant-work"))
VERSION = "v1"
PREFIX = f"library/{VERSION}"
LIB_ROOT = MIRROR / PREFIX
DATA_DIR = REPO / "apps" / "web" / "public" / "data" / "library"
PUBLIC = REPO / "apps" / "web" / "public"
MEDIA = SRC / "media"
AUDIO = SRC / "audio"
STORY = SRC / "story"

WORK.mkdir(parents=True, exist_ok=True)
(WORK / "tmp").mkdir(parents=True, exist_ok=True)
# Scratch files (Python temp files, ffmpeg temp files) must never land on C:.
os.environ["TEMP"] = os.environ["TMP"] = os.environ["TMPDIR"] = str(WORK / "tmp")

SLUGS = ["arts", "films", "music", "voicelines", "fanart", "comic", "lore", "design", "animation", "others"]
CHAR_SLUGS = ["fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "obsidia", "selena"]
PAIRS = {
    "fanny-layla": ["fanny", "layla"],
    "ruby-angela": ["ruby", "angela"],
    "lesley-change": ["lesley", "change"],
    "guinevere-vexana": ["guinevere", "vexana"],
    "selena-obsidia": ["selena", "obsidia"],
}
# source folder (under media/) -> pair id
PAIR_FOLDERS = {
    "layla-and-fanny": "fanny-layla",
    "ruby-and-angela": "ruby-angela",
    "lesley-and-change": "lesley-change",
    "vexana-and-guinevere": "guinevere-vexana",
    "selena-and-obsidia": "selena-obsidia",
}


def pair_of_char(slug: str) -> str | None:
    for pid, members in PAIRS.items():
        if slug in members:
            return pid
    return None


# ---------------------------------------------------------------------------------------------
# Keys. A "key" is a path relative to library/v1/, with forward slashes. The site builds the
# address with libUrl(key). The same key is the path inside the local mirror (LIB_ROOT / key).
# ---------------------------------------------------------------------------------------------


def key_path(key: str) -> Path:
    """Local mirror path of a key. Creates the parent folder."""
    p = LIB_ROOT / key
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def fresh(out: Path, *inputs: Path) -> bool:
    """True when `out` exists, is not empty and is newer than every input (so a step can be skipped)."""
    if not out.exists() or out.stat().st_size == 0:
        return False
    t = out.stat().st_mtime
    return all(i.exists() and i.stat().st_mtime <= t for i in inputs)


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s or "item"


def sha1_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        while b := f.read(chunk):
            h.update(b)
    return h.hexdigest()


def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024
    return str(n)


# ---------------------------------------------------------------------------------------------
# Text rules (docs/design/canon-rules.md, scripts/qa/scan-text.mjs). All shipped text goes
# through clean_text(), and data files are scanned by `node scripts/qa/scan-text.mjs`.
# ---------------------------------------------------------------------------------------------

_EM = "\u2014"
_EN = "\u2013"


def clean_text(s: str | None) -> str:
    """Remove em and en dashes, normalise quotes and whitespace. Does NOT rewrite canon wording:
    a banned word in a source text must be handled by the caller (see check_text)."""
    if s is None:
        return ""
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(rf"\s*{_EM}\s*", ", ", s)
    s = re.sub(rf"(?<=\d){_EN}(?=\d)", " to ", s)
    s = re.sub(rf"\s*{_EN}\s*", ", ", s)
    s = s.replace("\u2018", "'").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
    s = s.replace("\u00a0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


_BANNED = [
    (re.compile("con" + "viction", re.I), 'write "aspirant power"'),
    (re.compile("Ter" + "enia|Ter" + "inia|Terr" + "enia", re.I), "spell Terrinia"),
    (re.compile("Sei" + "resk", re.I), "non-canon parody name, write 'live-action parody'"),
    (re.compile("Wind" + "storm Nest", re.I), "spell Storm Citadel"),
]


def check_text(s: str, where: str = "") -> list[str]:
    """Return a list of rule violations found in `s` (empty when clean)."""
    problems = []
    if _EM in s or _EN in s:
        problems.append(f"{where}: dash")
    for rx, msg in _BANNED:
        if rx.search(s):
            problems.append(f"{where}: {msg}")
    return problems


def check_json_text(obj: Any, where: str = "") -> list[str]:
    problems: list[str] = []
    if isinstance(obj, str):
        problems += check_text(obj, where)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            problems += check_json_text(v, f"{where}[{i}]")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            problems += check_json_text(v, f"{where}.{k}")
    return problems


def write_json(slug: str, obj: Any) -> Path:
    """Write apps/web/public/data/library/<slug>.json (compact, stable, UTF-8, LF). Fails on text rule violations."""
    problems = check_json_text(obj, slug)
    if problems:
        raise SystemExit("Text rule violations:\n" + "\n".join(problems[:40]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{slug}.json"
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    path.write_text(text + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {path.relative_to(REPO)} ({human(len(text.encode()))})")
    return path


# ---------------------------------------------------------------------------------------------
# Images. image_set() writes three WebP sizes into the mirror and returns the LibImage record.
# ---------------------------------------------------------------------------------------------


def _dominant(img) -> str:
    from PIL import Image  # local import keeps `import common` light

    small = img.convert("RGB").resize((24, 24), Image.BILINEAR)
    px = list(small.getdata())
    r = sum(p[0] for p in px) // len(px)
    g = sum(p[1] for p in px) // len(px)
    b = sum(p[2] for p in px) // len(px)
    return f"#{r:02x}{g:02x}{b:02x}"


def image_set(
    src: Path,
    key_base: str,
    *,
    full_max: int = 3840,
    preview: int = 1280,
    thumb: int = 480,
    q_full: int = 90,
    q_small: int = 80,
    force: bool = False,
) -> dict[str, Any]:
    """Make <key_base>/t.webp (thumb), p.webp (preview), f.webp (full) from `src`.

    Returns {"t": key, "p": key, "f": key, "w": full width, "h": full height, "c": "#rrggbb"}.
    Never upscales. Keeps alpha. Skips work when the outputs are fresh. HEIC files in the source
    library are really JPEG, so Pillow reads them as is. A GIF source uses its first frame.
    """
    from PIL import Image, ImageOps

    outs = {n: key_path(f"{key_base}/{n}.webp") for n in ("t", "p", "f")}
    meta = key_path(f"{key_base}/.meta.json")
    if not force and all(fresh(p, src) for p in outs.values()) and meta.exists():
        m = json.loads(meta.read_text(encoding="utf-8"))
    else:
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im)
            im.seek(0) if getattr(im, "is_animated", False) else None
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "A" in im.mode or im.info.get("transparency") else "RGB")
            m = {"w": 0, "h": 0, "c": _dominant(im)}
            for name, longest, q in (("f", full_max, q_full), ("p", preview, q_small), ("t", thumb, q_small)):
                w, h = im.size
                scale = min(1.0, longest / max(w, h))
                out = im if scale == 1.0 else im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
                out.save(outs[name], "WEBP", quality=q, method=5)
                if name == "f":
                    m["w"], m["h"] = out.size
        meta.write_text(json.dumps(m), encoding="utf-8")
    return {
        "t": f"{key_base}/t.webp",
        "p": f"{key_base}/p.webp",
        "f": f"{key_base}/f.webp",
        "w": m["w"],
        "h": m["h"],
        "c": m["c"],
    }


# ---------------------------------------------------------------------------------------------
# ffmpeg / ffprobe
# ---------------------------------------------------------------------------------------------


def ffprobe(path: Path) -> dict[str, Any]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    ).stdout
    j = json.loads(out or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
    a = next((s for s in j.get("streams", []) if s.get("codec_type") == "audio"), {})
    return {
        "w": int(v.get("width", 0) or 0),
        "h": int(v.get("height", 0) or 0),
        "fps": _fps(v.get("r_frame_rate", "0/1")),
        "dur": float(j.get("format", {}).get("duration", 0) or 0),
        "vcodec": v.get("codec_name"),
        "acodec": a.get("codec_name"),
        "has_audio": bool(a),
        "bytes": int(j.get("format", {}).get("size", 0) or 0),
    }


def _fps(r: str) -> float:
    try:
        n, d = r.split("/")
        return float(n) / float(d) if float(d) else 0.0
    except Exception:
        return 0.0


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    """Run a command, echo it briefly, raise on failure."""
    print("  $", " ".join(str(c) for c in cmd)[:200], flush=True)
    return subprocess.run([str(c) for c in cmd], check=True, **kw)


def srt_to_vtt(srt: str) -> str:
    """Convert SRT text to WebVTT, with the text rules applied."""
    text = clean_text(srt).lstrip("\ufeff")
    text = re.sub(r"(\d\d:\d\d:\d\d),(\d\d\d)", r"\1.\2", text)
    return "WEBVTT\n\n" + text + "\n"


if __name__ == "__main__":
    print("SRC", SRC, "exists" if SRC.exists() else "MISSING")
    print("MIRROR", MIRROR)
    print("WORK", WORK)
    print("DATA_DIR", DATA_DIR)
    sys.exit(0)
