"""Others room pipeline (Video, Others): scan the media, make the posters and strips, write video-others.json.

Run with the anaconda Python from the repo root:

    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py scan     # every video found and where it went
    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py media    # encodes (only if missing), posters, strips, captions
    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py data     # only video-others.json
    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py all      # everything

The Others room shows every video in `D:\\ren\\aspirant\\media` except footage, the ten Films (their ids
are `FILM_IDS` in `features/library/video/links.ts`) and the raw in-game animation recordings in
`media/_others/in-game-animation` (the source of the Animation room). The scan walks the folder and puts
each file in exactly one bucket. A file that no bucket takes stops the script, so a new video is never
lost by accident.

Idempotent: a video, poster, strip or caption that is already in the mirror is kept. Nothing is written in
the source library. Scratch files go to D:\\ren\\aspirant-work\\films. Files that other rooms encode
(promo reels, emotes, gameplay clips, official edits, fan videos) are pointed at by their key, not copied.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402
import captions as ig  # noqa: E402
import reuse  # noqa: E402
from catalog import DRAMA, DRAMA_DIR, FILMS, IGNORED, PAIR_CHARS, ROWS  # noqa: E402
from chapters import FIXES, LABELS  # noqa: E402

WORK = common.WORK / "films"
TMP = WORK / "tmp"
POSTERS = WORK / "posters"
for d in (WORK, TMP, POSTERS):
    d.mkdir(parents=True, exist_ok=True)

MEDIA = common.MEDIA
PUBLIC = common.PUBLIC
SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi"}
LINKS_TS = common.REPO / "apps" / "web" / "src" / "features" / "library" / "video" / "links.ts"
IN_GAME = "_others/in-game-animation/"
# A Film whose source file was renamed after its id was made (the id keeps the old YouTube name).
RENAMED_FILMS = {
    "lesley-and-change/video/official/trailer/video.webm": "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
}
STRIP_FRAMES = 8
STRIP_LONG = 400


# -------------------------------------------------------------------------------------------------
# Sources and ids
# -------------------------------------------------------------------------------------------------


def resolve(rel: str) -> Path:
    """The real file of a catalog `src` (it may hold one `*`)."""
    if "*" in rel:
        found = sorted(MEDIA.glob(rel))
        if len(found) != 1:
            raise SystemExit(f"{rel}: expected one file, found {len(found)}")
        return found[0]
    p = MEDIA / rel
    if not p.exists():
        raise SystemExit(f"missing source: {p}")
    return p


def rel_of(path: Path) -> str:
    return path.relative_to(MEDIA).as_posix()


def film_id(path: Path) -> str:
    """`film-` + slugify of the path under media/ without the extension, `/` turned into `-`.

    The same rule gave the ids of the old Films room, so every link already in the site (the scene
    stills of the Arts room, the library search) still resolves. It is also unique across the library.
    """
    rel = rel_of(path.with_suffix(""))
    return "film-" + common.slugify(rel.replace("/", "-"))


def film_ids() -> list[str]:
    """The ten Films, read from the Films room's own list so the two rooms cannot disagree."""
    ids = re.findall(r'"(film-[a-z0-9-]+)"', LINKS_TS.read_text(encoding="utf-8"))
    if len(ids) != 10 or len(set(ids)) != 10:
        raise SystemExit(f"links.ts: expected ten film ids, found {len(ids)}")
    return ids


def shortcode_of(path: Path) -> str | None:
    """Instagram files are named 001_<media id>.mp4; the media id is the short code in base 64."""
    m = re.match(r"001_(\d+)$", path.stem)
    if not m:
        return None
    n, s = int(m.group(1)), ""
    while n > 0:
        n, r = divmod(n, 64)
        s = SHORTCODE_ALPHABET[r] + s
    return s


def post_date(path: Path) -> str | None:
    code = shortcode_of(path)
    if not code:
        return None
    e = ig.find(f"ig:{code}")
    if e and e.get("date"):
        return e["date"][:10]
    return None


# -------------------------------------------------------------------------------------------------
# ffmpeg
# -------------------------------------------------------------------------------------------------


def probe(path: Path) -> dict[str, Any]:
    """ffprobe as UTF-8 (the tags of some files hold Japanese text, which the system code page cannot read)."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    ).stdout
    j = json.loads(out or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
    return {
        "w": int(v.get("width", 0) or 0),
        "h": int(v.get("height", 0) or 0),
        "dur": float(j.get("format", {}).get("duration", 0) or 0),
        "vcodec": v.get("codec_name"),
    }


def probe_dur(path: Path) -> float:
    return probe(path)["dur"]


def verify(path: Path, expect: float, tol: float = 0.8) -> bool:
    """The file exists, has video, and is as long as it should be (not truncated)."""
    if not path.exists() or path.stat().st_size < 1000:
        return False
    info = probe(path)
    return bool(info["vcodec"]) and abs(info["dur"] - expect) <= tol


def encode_cmd(spec: dict[str, Any], src: Path, out: Path, dur: float) -> list[str]:
    """H.264 High, yuv420p, faststart, AAC. The source's own size (never scaled): the sources are 1080p
    at most, or 2560x1080, which stays."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?"]
    if spec["mode"] == "copy":
        cmd += ["-c:v", "copy", "-c:a", "copy"]
    else:
        vf = []
        if spec["crop"]:
            vf.append(f"crop={spec['crop']}")
        vf.append("format=yuv420p")
        preset = "medium" if dur <= 600 else "fast"
        cmd += [
            "-vf", ",".join(vf),
            "-c:v", "libx264", "-preset", preset, "-crf", str(spec["crf"]),
            "-profile:v", "high", "-pix_fmt", "yuv420p", "-g", "72",
            "-c:a", "aac", "-b:a", "128k", "-ac", "2",
        ]
    cmd += ["-movflags", "+faststart", "-f", "mp4", str(out)]
    return cmd


# -------------------------------------------------------------------------------------------------
# Posters and strips
# -------------------------------------------------------------------------------------------------


def _frame(video: Path, t: float, out: Path, width: int | None = None, vf: str | None = None) -> bool:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1"]
    if vf:
        cmd += ["-vf", vf]
    elif width:
        cmd += ["-vf", f"scale={width}:-2"]
    cmd.append(str(out))
    subprocess.run(cmd, capture_output=True)
    return out.exists() and out.stat().st_size > 0


def _score(rgb) -> float:
    import numpy as np

    a = rgb.astype("float32")
    lum = a @ np.array([0.299, 0.587, 0.114], dtype="float32")
    mean = float(lum.mean())
    sharp = float(np.abs(np.diff(lum, axis=1)).mean() + np.abs(np.diff(lum, axis=0)).mean())
    rg = a[..., 0] - a[..., 1]
    yb = 0.5 * (a[..., 0] + a[..., 1]) - a[..., 2]
    colourful = float(np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean()))
    contrast = float(lum.std())
    pen = max(0.0, 55 - mean) * 0.6 + max(0.0, mean - 205) * 0.6
    return sharp * 2.0 + colourful * 0.25 + contrast * 0.3 - pen


def letterbox(frames: list) -> tuple[float, float, float, float]:
    """The part of the picture without black bars: rows and columns that are black in every frame are cut
    (only bars wider than 2 percent). Returns (left, top, right, bottom) as fractions."""
    import numpy as np

    stack = np.stack(frames)
    # A row or column is a bar when it is black in most frames. "Most" and not "all": a title card or a
    # credit frame fills the whole picture and must not hide the bars of the rest.
    row_black = (stack.max(axis=(2, 3)) < 20).mean(axis=0) >= 0.7
    col_black = (stack.max(axis=(1, 3)) < 20).mean(axis=0) >= 0.7
    h, w = row_black.size, col_black.size

    def edge(flags) -> tuple[int, int]:
        lo = 0
        while lo < len(flags) and flags[lo]:
            lo += 1
        hi = 0
        while hi < len(flags) - lo and flags[len(flags) - 1 - hi]:
            hi += 1
        return lo, hi

    top, bottom = edge(row_black)
    left, right = edge(col_black)
    return (
        left / w if left / w > 0.02 else 0.0,
        top / h if top / h > 0.02 else 0.0,
        1 - (right / w if right / w > 0.02 else 0.0),
        1 - (bottom / h if bottom / h > 0.02 else 0.0),
    )


def existing_image_set(base: str) -> dict[str, Any] | None:
    """The poster set of a key base when the mirror already has it (made by an earlier run)."""
    meta = common.key_path(f"{base}/.meta.json")
    outs = [common.key_path(f"{base}/{n}.webp") for n in ("t", "p", "f")]
    if not meta.exists() or not all(p.exists() and p.stat().st_size > 0 for p in outs):
        return None
    m = json.loads(meta.read_text(encoding="utf-8"))
    return {"t": f"{base}/t.webp", "p": f"{base}/p.webp", "f": f"{base}/f.webp", "w": m["w"], "h": m["h"], "c": m["c"]}


def poster_base(fid: str) -> str:
    """The old Films room kept its posters at `films/<id>/poster`: those stay. New ones go under `video/others`."""
    old = f"films/{fid}/poster"
    return old if existing_image_set(old) else f"video/others/{fid}/poster"


def make_poster(fid: str, video: Path, dur: float, at: float | None) -> dict[str, Any]:
    """Pick a good frame (or use `at`), cut away any letterbox bars, write the three WebP sizes."""
    import numpy as np
    from PIL import Image

    base = poster_base(fid)
    kept = existing_image_set(base)
    if kept:
        return kept
    png = POSTERS / f"{fid}.png"
    meta = POSTERS / f"{fid}.json"
    if png.exists() and meta.exists() and common.fresh(common.key_path(f"{base}/t.webp"), png):
        return common.image_set(png, base, full_max=1920, q_full=84, q_small=80)

    times = [dur * (0.1 + 0.075 * i) for i in range(10)] if at is None else [at]
    frames: list[tuple[float, Any]] = []
    for i, t in enumerate(times):
        tmp = TMP / f"{fid}-c{i}.png"
        if _frame(video, min(t, max(dur - 0.5, 0)), tmp, 480):
            with Image.open(tmp) as im:
                frames.append((t, np.asarray(im.convert("RGB")).copy()))
            tmp.unlink(missing_ok=True)
    if not frames:
        raise SystemExit(f"{fid}: no frame could be read")
    best_t, best = max(frames, key=lambda f: _score(f[1])) if at is None else frames[0]
    box = letterbox([f for _, f in frames])

    full = TMP / f"{fid}-full.png"
    if not _frame(video, min(best_t, max(dur - 0.5, 0)), full):
        raise SystemExit(f"{fid}: could not read the poster frame")
    with Image.open(full) as im:
        im = im.convert("RGB")
        W, H = im.size
        crop = (round(box[0] * W), round(box[1] * H), round(box[2] * W), round(box[3] * H))
        if crop != (0, 0, W, H):
            im = im.crop(crop)
        im.save(png)
    full.unlink(missing_ok=True)
    meta.write_text(json.dumps({"t": round(best_t, 2), "box": box}), encoding="utf-8")
    return common.image_set(png, base, full_max=1920, q_full=84, q_small=80)


def make_strip(fid: str, video: Path, dur: float, w: int, h: int) -> dict[str, Any]:
    """Eight frames across the video in one WebP, for the hover preview (the page steps through it with
    a CSS animation on `transform`, so nothing plays and no video is read). Letterbox bars are cut."""
    import numpy as np
    from PIL import Image

    key = f"video/others/{fid}/strip.webp"
    out = common.key_path(key)
    if out.exists() and out.stat().st_size > 0 and common.fresh(out, video):
        return {"src": key, "n": STRIP_FRAMES}
    scale = f"scale={STRIP_LONG}:-2" if w >= h else f"scale=-2:{STRIP_LONG}"
    shots = []
    for i in range(STRIP_FRAMES):
        t = max(0.0, min(dur * (0.05 + 0.9 * i / (STRIP_FRAMES - 1)), dur - 0.12))
        tmp = TMP / f"{fid}-s{i}.png"
        if not _frame(video, t, tmp, vf=scale):
            # A frame that cannot be read is replaced by the one before it, so the strip stays whole.
            if not shots:
                raise SystemExit(f"{fid}: no frame for the strip")
            shots.append(shots[-1].copy())
            continue
        with Image.open(tmp) as im:
            shots.append(im.convert("RGB").copy())
        tmp.unlink(missing_ok=True)
    # The poster's own box when there is one, so the strip and the poster have the same shape.
    saved = POSTERS / f"{fid}.json"
    box = tuple(json.loads(saved.read_text(encoding="utf-8"))["box"]) if saved.exists() else letterbox([np.asarray(s) for s in shots])
    W, H = shots[0].size
    crop = (round(box[0] * W), round(box[1] * H), round(box[2] * W), round(box[3] * H))
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    cw -= cw % 2
    ch -= ch % 2
    sheet = Image.new("RGB", (cw * STRIP_FRAMES, ch))
    for i, s in enumerate(shots):
        sheet.paste(s.crop((crop[0], crop[1], crop[0] + cw, crop[1] + ch)), (i * cw, 0))
    sheet.save(out, "WEBP", quality=58, method=5)
    return {"src": key, "n": STRIP_FRAMES}


# -------------------------------------------------------------------------------------------------
# Captions and chapters
# -------------------------------------------------------------------------------------------------

_PARODY = [
    (re.compile(r"Sei" + r"resk Academy(’s|'s)?", re.I), lambda m: "the academy" + (m.group(1) or "")),
    (re.compile(r"\bSHA" + r"BO(’s|'s)?"), lambda m: "the villain" + (m.group(1) or "")),
    (re.compile(r"\bMr Im" + r"ran\b"), lambda m: "the teacher"),
]


def make_vtt(spec: dict[str, Any], fid: str) -> str | None:
    if not spec.get("captions"):
        return None
    out = common.key_path(f"films/{fid}/en.vtt")
    if out.exists() and out.stat().st_size > 0:
        return f"films/{fid}/en.vtt"
    src = MEDIA / spec["captions"]
    text = src.read_text(encoding="utf-8-sig", errors="replace")
    if spec["canon"] == "non-canon":
        for rx, fn in _PARODY:
            text = rx.sub(fn, text)
        text = re.sub(r"(?m)^the academy", "The academy", text)
        text = re.sub(r"(?<=[.!?] )the academy", "The academy", text)
    vtt = common.srt_to_vtt(text)
    problems = common.check_text(vtt, fid)
    if problems:
        raise SystemExit("caption text rule: " + "; ".join(problems))
    out.write_text(vtt, encoding="utf-8", newline="\n")
    return f"films/{fid}/en.vtt"


def shorten(note: str, limit: int = 66) -> str:
    """A plain, short caption for a scene note: the label before a colon, or the first clause."""
    s = re.sub(r"\s+", " ", note.strip())
    s = re.sub(r"\([^)]*\)", "", s)
    s = s.replace("->", "to").replace("&", "and")
    label = None
    m = re.match(r"^([^:;]{4,48}):\s*(.+)$", s)
    if m and "'" not in m.group(1) and '"' not in m.group(1):
        label, rest = m.group(1).strip(), m.group(2).strip()
        first = re.split(r"[;]| then | ending | followed by |, ending", rest)[0].strip(" ,.")
        s = f"{label}, {first}" if len(label) + len(first) < limit - 2 else label
    else:
        s = re.split(r"[;]| then | ending | followed by |, ending", s)[0].strip(" ,.")
    if len(s) > limit:
        cut = s[:limit]
        for sep in (", ", " and ", " "):
            i = cut.rfind(sep)
            if i > 24:
                cut = cut[:i]
                break
        s = cut.rstrip(" ,.:-")
    s = s[:1].upper() + s[1:]
    return common.clean_text(s)


def chapters_for(manifest_dir: Path | None, fid: str) -> list[dict[str, Any]]:
    if not manifest_dir:
        return []
    path = manifest_dir / "manifest.json" if (manifest_dir / "manifest.json").exists() else manifest_dir / "footages" / "manifest.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    fps = float(data.get("fps") or 25)
    key = fid.removeprefix("film-")
    written = LABELS.get(key)
    if written is not None and len(written) != len(data["footages"]):
        raise SystemExit(f"{key}: {len(written)} captions for {len(data['footages'])} scenes")
    out = []
    for i, f in enumerate(data["footages"]):
        label = written[i] if written else FIXES.get((key, i)) or shorten(f["note"])
        label = common.clean_text(label)
        problems = common.check_text(label, key)
        if problems:
            raise SystemExit("; ".join(problems))
        out.append({"t": round(f["start_frame"] / fps, 2), "l": label})
    return out


# -------------------------------------------------------------------------------------------------
# The plan: every video of the room, with where it comes from
# -------------------------------------------------------------------------------------------------

_SHELF_OF = {k: i for i, (_, _, kinds) in enumerate(ROWS) for k in kinds}
_KIND_AT = {k: (i, j) for i, (_, _, kinds) in enumerate(ROWS) for j, k in enumerate(kinds)}


def plan() -> list[dict[str, Any]]:
    """Every video of the room: the catalog, the drama (one entry per episode set) and the files that
    other rooms already encode."""
    items: list[dict[str, Any]] = []
    for spec in FILMS:
        src = resolve(spec["src"])
        items.append(dict(spec, path=src, id=film_id(src), also=[], link=None, group=None, date=None, credit=None, key=None))
    for ep in DRAMA:
        src = MEDIA / DRAMA_DIR / f"{ep['code']}.webm"
        if not src.exists():
            raise SystemExit(f"missing drama source {src}")
        also = [film_id(MEDIA / DRAMA_DIR / f"{c}.webm") for c in ep["codes"][1:]]
        items.append(
            {
                "src": rel_of(src),
                "path": src,
                "id": film_id(src),
                "title": ep["title"],
                "kind": "drama",
                "pair": "guinevere-vexana",
                "chars": PAIR_CHARS["guinevere-vexana"],
                "desc": ep["summary"],
                "canon": "official",
                "mode": "local",
                "local": f"/video/vexana/drama/{ep['file']}.mp4",
                "crf": 20,
                "crop": None,
                "captions": None,
                "manifest": f"{DRAMA_DIR}/footages/{ep['code']}",
                "tags": ["interactive drama", f"chapter {ep['chapter']}"],
                "poster_t": None,
                "extra": {},
                "also": also,
                "link": {"href": "/character/vexana/", "label": "Play the drama on Vexana's page"},
                "group": ep["chapter"],
                "date": None,
                "credit": None,
                "key": None,
            }
        )
    for r in reuse.all_reused():
        src = MEDIA / r["src"][0]
        if not src.exists():
            raise SystemExit(f"missing source {src}")
        items.append(
            {
                "src": r["src"][0],
                "path": src,
                "id": film_id(src),
                "title": r["title"],
                "kind": r["kind"],
                "pair": r["pair"],
                "chars": r["chars"],
                "desc": r["desc"],
                "canon": r["canon"],
                "mode": "reuse",
                "local": None,
                "crf": 0,
                "crop": None,
                "captions": None,
                "manifest": None,
                "tags": r["tags"],
                "poster_t": None,
                "extra": {},
                "also": [film_id(MEDIA / s) for s in r["src"][1:] if (MEDIA / s).exists() and film_id(MEDIA / s) != film_id(src)],
                "link": None,
                "group": None,
                "date": r["date"],
                "credit": r["credit"],
                "key": r["key"],
                "aliases": r["src"][1:],
            }
        )
    ids = [s["id"] for s in items]
    if len(set(ids)) != len(ids):
        raise SystemExit("duplicate ids: " + ", ".join(sorted({i for i in ids if ids.count(i) > 1})))
    for s in items:
        if s["kind"] not in _SHELF_OF:
            raise SystemExit(f"{s['id']}: kind {s['kind']} has no shelf in catalog.ROWS")
    # Shelf by shelf, kind by kind. A newer post first inside the kinds that are a feed; the emote set
    # preview first; everything else in the order of the catalog.
    def order(s: dict[str, Any]) -> tuple:
        feed = ""
        if s["kind"] in ("reel", "gameplay", "edit", "fan"):
            feed = "".join(chr(255 - ord(c)) for c in (s["date"] or "0000-00-00"))
        elif s["kind"] == "emote":
            feed = "0" if s["id"].endswith("preview") else s["id"]
        return (*_KIND_AT[s["kind"]], feed)

    indexed = list(enumerate(items))
    indexed.sort(key=lambda p: (order(p[1]), p[0]))
    return [s for _, s in indexed]


def video_file(spec: dict[str, Any]) -> Path:
    """The file that plays: the site's own copy, another room's key, or this room's encode."""
    if spec["mode"] == "local":
        return PUBLIC / spec["local"].lstrip("/")
    if spec["mode"] == "reuse":
        return common.key_path(spec["key"])
    old = common.key_path(f"films/{spec['id']}/video.mp4")
    return old if old.exists() else common.key_path(f"video/others/{spec['id']}/video.mp4")


def video_key(spec: dict[str, Any]) -> str:
    if spec["mode"] == "local":
        return ""
    if spec["mode"] == "reuse":
        return spec["key"]
    return f"films/{spec['id']}/video.mp4" if common.key_path(f"films/{spec['id']}/video.mp4").exists() else f"video/others/{spec['id']}/video.mp4"


# -------------------------------------------------------------------------------------------------
# The scan: every video found, where it went, and what was left out
# -------------------------------------------------------------------------------------------------


def scan_sources() -> list[Path]:
    found: list[Path] = []
    for root, dirs, files in os.walk(MEDIA):
        base = Path(root)
        dirs[:] = [d for d in dirs if "footage" not in d.lower()]
        rel = base.relative_to(MEDIA).as_posix() + "/"
        if rel.startswith(IN_GAME):
            dirs[:] = []
            continue
        for f in files:
            if Path(f).suffix.lower() in VIDEO_EXT:
                found.append(base / f)
    return sorted(found)


def ignored_map() -> dict[str, str]:
    data = json.loads((common.REPO / "scripts" / "library" / "ignored.json").read_text(encoding="utf-8"))
    out = {k.removeprefix("media/"): v for k, v in data.items() if k.startswith("media/")}
    out.update(IGNORED)
    return out


def classify(specs: list[dict[str, Any]]) -> list[tuple[str, str, str]]:
    """(source path under media/, bucket, detail) for every video. Raises on a video that no bucket takes."""
    films = set(film_ids())
    ignored = ignored_map()
    by_src: dict[str, dict[str, Any]] = {}
    for s in specs:
        by_src[rel_of(s["path"])] = s
    alias_of: dict[str, dict[str, Any]] = {}
    for s in specs:
        if s["mode"] == "reuse":
            for a in s.get("aliases", []):
                alias_of[a] = s
    drama_by_code = {s["src"].rsplit("/", 1)[1].removesuffix(".webm"): s for s in specs if s["kind"] == "drama"}
    drama_alias: dict[str, dict[str, Any]] = {}
    for ep in DRAMA:
        for c in ep["codes"][1:]:
            drama_alias[f"{DRAMA_DIR}/{c}.webm"] = drama_by_code[ep["code"]]
    table: list[tuple[str, str, str]] = []
    seen_films: set[str] = set()
    problems: list[str] = []
    for p in scan_sources():
        rel = rel_of(p)
        fid = RENAMED_FILMS.get(rel, film_id(p))
        if fid in films:
            seen_films.add(fid)
            table.append((rel, "Films room", fid))
        elif rel in by_src:
            s = by_src[rel]
            table.append((rel, f"Others: {s['kind']}", s["id"]))
        elif rel in drama_alias:
            table.append((rel, "Others: drama alias", f"same film as {drama_alias[rel]['id']}"))
        elif rel in alias_of:
            table.append((rel, "Others: alias", f"same file as {alias_of[rel]['id']}"))
        elif rel in ignored:
            table.append((rel, "left out", ignored[rel]))
        else:
            problems.append(rel)
    missing = films - seen_films
    if missing:
        problems.append("Films not found in media: " + ", ".join(sorted(missing)))
    if problems:
        raise SystemExit("videos that no bucket takes:\n  " + "\n  ".join(problems))
    return table


def print_scan(table: list[tuple[str, str, str]]) -> None:
    lines = []
    for rel, bucket, detail in table:
        lines.append(f"{bucket:26} {rel}   {detail if bucket in ('left out',) else ''}".rstrip())
    counts: dict[str, int] = {}
    for _, bucket, _ in table:
        key = bucket if bucket.startswith(("Films", "left")) or "alias" in bucket else "Others (one entry each)"
        counts[key] = counts.get(key, 0) + 1
    text = "\n".join(lines) + "\n\n" + "\n".join(f"{k}: {v}" for k, v in sorted(counts.items())) + f"\nvideos found: {len(table)}\n"
    (WORK / "others-scan.txt").write_text(text, encoding="utf-8")
    print(text)


# -------------------------------------------------------------------------------------------------
# One video
# -------------------------------------------------------------------------------------------------


def media_for(spec: dict[str, Any]) -> dict[str, Any]:
    """Make the video (only when it is missing from the mirror), the poster, the strip and the captions."""
    fid = spec["id"]
    t0 = time.time()
    result: dict[str, Any] = {"id": fid, "log": ""}
    file = video_file(spec)
    if spec["mode"] == "local":
        if not file.exists():
            raise SystemExit(f"{fid}: site file missing {file}")
        info = probe(file)
        src_dur = probe_dur(spec["path"])
        if abs(info["dur"] - src_dur) > 1.1:
            raise SystemExit(f"{fid}: site file is {info['dur']:.1f}s, source {src_dur:.1f}s")
        result["log"] = "local"
    elif spec["mode"] == "reuse":
        if not file.exists() or file.stat().st_size < 1000:
            raise SystemExit(f"{fid}: the room that owns {spec['key']} has not made it")
        result["log"] = "reused"
    else:
        src_dur = probe_dur(spec["path"])
        if verify(file, src_dur):
            result["log"] = "kept"
        else:
            out = common.key_path(f"video/others/{fid}/video.mp4")
            tmp = TMP / f"{fid}.part.mp4"
            tmp.unlink(missing_ok=True)
            print(f"[{fid}] {spec['mode']} {src_dur:.0f}s ...", flush=True)
            subprocess.run(encode_cmd(spec, spec["path"], tmp, src_dur), check=True)
            if not verify(tmp, src_dur):
                raise SystemExit(f"{fid}: encode is truncated or empty")
            os.replace(tmp, out)
            file = out
            result["log"] = f"{spec['mode']} {time.time() - t0:.0f}s (new)"
    info = probe(file)
    result["w"], result["h"], result["dur"] = info["w"], info["h"], round(info["dur"], 2)
    result["bytes"] = file.stat().st_size
    result["poster"] = make_poster(fid, file, info["dur"], spec["poster_t"])
    result["strip"] = make_strip(fid, file, info["dur"], info["w"], info["h"])
    result["captions"] = make_vtt(spec, fid)
    print(f"[{fid}] {result['log']} {common.human(result['bytes'])}", flush=True)
    return result


def run_media(specs: list[dict[str, Any]], only: list[str] | None = None) -> dict[str, dict[str, Any]]:
    todo = [s for s in specs if not only or any(o in s["id"] for o in only)]
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {ex.submit(media_for, s): s["id"] for s in todo}
        for fut, fid in futures.items():
            results[fid] = fut.result()
    return results


# -------------------------------------------------------------------------------------------------
# Data file
# -------------------------------------------------------------------------------------------------


def build_data(specs: list[dict[str, Any]], made: dict[str, dict[str, Any]]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    total_bytes = 0
    for spec in specs:
        fid = spec["id"]
        src = spec["path"]
        file = video_file(spec)
        if not file.exists():
            raise SystemExit(f"{fid}: video not made yet ({file})")
        m = made.get(fid) or media_for(spec)
        poster = m["poster"]
        video: dict[str, Any] = {
            "src": video_key(spec),
            "poster": poster["p"],
            "w": m["w"],
            "h": m["h"],
            "dur": m["dur"],
        }
        if m["captions"]:
            video["captions"] = m["captions"]
        if spec["mode"] == "local":
            video["local"] = spec["local"]
        size = m["bytes"]
        total_bytes += size
        item: dict[str, Any] = {
            "id": fid,
            "title": common.clean_text(spec["title"]),
            "collection": "video",
            "chars": spec["chars"],
            "pair": spec["pair"],
            "canon": spec["canon"],
            "tags": list(dict.fromkeys([*spec["tags"], spec["kind"]])),
            "kind": spec["kind"],
            "desc": common.clean_text(spec["desc"]),
            "video": video,
            "thumb": poster["t"],
            "c": poster["c"],
            "ar": round(poster["w"] / poster["h"], 4),
            "strip": m["strip"],
            "bytes": size,
            "chapters": chapters_for(MEDIA / spec["manifest"] if spec["manifest"] else None, fid),
        }
        date = spec["date"] or post_date(src)
        if date:
            item["date"] = str(date)[:10]
        if spec["also"]:
            item["also"] = spec["also"]
        if spec["link"]:
            item["link"] = spec["link"]
        if spec["group"]:
            item["group"] = spec["group"]
        if spec["credit"]:
            item["credit"] = spec["credit"]
        elif spec["canon"] == "non-canon" and spec["kind"] == "parody":
            item["credit"] = {
                "by": "Mobile Legends: Bang Bang",
                "platform": None,
                "url": None,
                "note": "An official parody made outside the story.",
            }
        items.append(item)
    return {"v": 1, "slug": "video", "room": "others", "items": items, "bytes": total_bytes}


def merge_ignored() -> None:
    path = common.REPO / "scripts" / "library" / "ignored.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for rel, reason in IGNORED.items():
        data[f"media/{rel}"] = reason
    path.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # some file names hold full width characters
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    only = sys.argv[2:] or None
    specs = plan()
    table = classify(specs)
    if cmd in ("scan", "all"):
        print_scan(table)
    made: dict[str, dict[str, Any]] = {}
    if cmd in ("media", "all"):
        made = run_media(specs, only)
        (WORK / "media-log.json").write_text(json.dumps(made, indent=1, default=str), encoding="utf-8")
    if cmd in ("data", "all"):
        data = build_data(specs, made)
        common.write_json("video-others", data)
        merge_ignored()
        new = sum(1 for r in made.values() if "(new)" in r.get("log", ""))
        kinds: dict[str, int] = {}
        for it in data["items"]:
            kinds[it["kind"]] = kinds.get(it["kind"], 0) + 1
        print(f"video-others: {len(data['items'])} items, {new} new encodes, shipped bytes {common.human(data['bytes'])}")
        print(", ".join(f"{k} {v}" for k, v in kinds.items()))
    if cmd == "list":
        for s in specs:
            print(s["id"], s["mode"], s["kind"])


if __name__ == "__main__":
    main()
