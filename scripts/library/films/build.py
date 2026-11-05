"""Films room pipeline: encode the films, make posters and captions, write films.json.

Run with the anaconda Python from the repo root:

    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py all      # everything
    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py media    # encodes, posters, captions
    C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py data     # only films.json

Idempotent: a film whose output is already in the mirror and has the right length is skipped.
At most three encodes run at once. Scratch files go to D:\\ren\\aspirant-work\\films.
Nothing is written in the source library.
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
FEATURED_SRC = "selena-and-obsidia/video/trailer/001_3994447231709070185.mp4"


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
    """`film-` + slugify of the path under media/ without the extension, `/` turned into `-`."""
    rel = rel_of(path.with_suffix(""))
    return "film-" + common.slugify(rel.replace("/", "-"))


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
# Posters
# -------------------------------------------------------------------------------------------------


def _frame(video: Path, t: float, out: Path, width: int | None = None) -> bool:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1"]
    if width:
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


def make_poster(fid: str, video: Path, dur: float, at: float | None) -> dict[str, Any]:
    """Pick a good frame (or use `at`), cut away any letterbox bars, write the three WebP sizes."""
    import numpy as np
    from PIL import Image

    base = f"films/{fid}/poster"
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

    # Letterbox or pillarbox bars: rows and columns that are black in every candidate frame.
    stack = np.stack([f for _, f in frames])
    row_black = stack.max(axis=(0, 2, 3)) < 20
    col_black = stack.max(axis=(0, 1, 3)) < 20
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
    box = (
        left / w if left / w > 0.02 else 0.0,
        top / h if top / h > 0.02 else 0.0,
        1 - (right / w if right / w > 0.02 else 0.0),
        1 - (bottom / h if bottom / h > 0.02 else 0.0),
    )

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


# -------------------------------------------------------------------------------------------------
# Captions and chapters
# -------------------------------------------------------------------------------------------------

_PARODY = [
    (re.compile(r"Sei" + r"resk Academy(’s|'s)?", re.I), lambda m: "the academy" + (m.group(1) or "")),
    (re.compile(r"\bSHA" + r"BO(’s|'s)?"), lambda m: "the villain" + (m.group(1) or "")),
    (re.compile(r"\bMr Im" + r"ran\b"), lambda m: "the teacher"),
]


def make_vtt(spec: dict[str, Any], fid: str) -> str | None:
    if not spec["captions"]:
        return None
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
    out = common.key_path(f"films/{fid}/en.vtt")
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
# One film
# -------------------------------------------------------------------------------------------------


def plan() -> list[dict[str, Any]]:
    """Every film with its resolved source and id (the catalog films, then the drama)."""
    items: list[dict[str, Any]] = []
    for spec in FILMS:
        src = resolve(spec["src"])
        spec = dict(spec, path=src, id=film_id(src), also=[], link=None, group=None)
        items.append(spec)
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
            }
        )
    ids = [s["id"] for s in items]
    if len(set(ids)) != len(ids):
        raise SystemExit("duplicate film ids")
    return items


def media_for(spec: dict[str, Any]) -> dict[str, Any]:
    """Make the video (when it is not the site's own), the poster and the captions of one film."""
    fid, src = spec["id"], spec["path"]
    t0 = time.time()
    src_dur = probe_dur(src)
    result: dict[str, Any] = {"id": fid, "log": ""}
    if spec["mode"] == "local":
        local_path = PUBLIC / spec["local"].lstrip("/")
        if not local_path.exists():
            raise SystemExit(f"{fid}: site file missing {local_path}")
        video_file = local_path
        info = probe(local_path)
        if abs(info["dur"] - src_dur) > 1.1:
            raise SystemExit(f"{fid}: site file is {info['dur']:.1f}s, source {src_dur:.1f}s")
        result["log"] = "local"
    else:
        out = common.key_path(f"films/{fid}/video.mp4")
        video_file = out
        if verify(out, src_dur):
            result["log"] = "kept"
        else:
            tmp = TMP / f"{fid}.part.mp4"
            tmp.unlink(missing_ok=True)
            cmd = encode_cmd(spec, src, tmp, src_dur)
            print(f"[{fid}] {spec['mode']} {src_dur:.0f}s ...", flush=True)
            subprocess.run(cmd, check=True)
            if not verify(tmp, src_dur):
                raise SystemExit(f"{fid}: encode is truncated or empty")
            os.replace(tmp, out)
            result["log"] = f"{spec['mode']} {time.time() - t0:.0f}s"
    info = probe(video_file)
    result["w"], result["h"], result["dur"] = info["w"], info["h"], round(info["dur"], 2)
    result["bytes"] = video_file.stat().st_size
    result["poster"] = make_poster(fid, video_file, info["dur"], spec["poster_t"])
    result["captions"] = make_vtt(spec, fid)
    print(f"[{fid}] done {result['log']} {common.human(result['bytes'])}", flush=True)
    return result


def run_media(specs: list[dict[str, Any]], only: list[str] | None = None) -> dict[str, dict[str, Any]]:
    todo = [s for s in specs if not only or any(o in s["id"] for o in only)]
    # Long ones first, so the last jobs are the short ones.
    todo.sort(key=lambda s: -s["path"].stat().st_size if s["mode"] != "local" else 0)
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {ex.submit(media_for, s): s["id"] for s in todo}
        for fut, fid in futures.items():
            results[fid] = fut.result()
    return results


# -------------------------------------------------------------------------------------------------
# Data file
# -------------------------------------------------------------------------------------------------

_KIND_ORDER = {k: i for i, (_, _, kinds) in enumerate(ROWS) for k in kinds}


def build_data(specs: list[dict[str, Any]]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    total_bytes = 0
    for n, spec in enumerate(specs):
        fid = spec["id"]
        src = spec["path"]
        if spec["mode"] == "local":
            video_file = PUBLIC / spec["local"].lstrip("/")
        else:
            video_file = common.key_path(f"films/{fid}/video.mp4")
        if not video_file.exists():
            raise SystemExit(f"{fid}: video not made yet ({video_file})")
        info = probe(video_file)
        poster = make_poster(fid, video_file, info["dur"], spec["poster_t"])
        vtt = make_vtt(spec, fid)
        video: dict[str, Any] = {
            "src": "" if spec["mode"] == "local" else f"films/{fid}/video.mp4",
            "poster": poster["p"],
            "w": info["w"],
            "h": info["h"],
            "dur": round(info["dur"], 2),
        }
        if vtt:
            video["captions"] = vtt
        if spec["mode"] == "local":
            video["local"] = spec["local"]
        size = video_file.stat().st_size
        total_bytes += size
        item: dict[str, Any] = {
            "id": fid,
            "title": common.clean_text(spec["title"]),
            "collection": "films",
            "chars": spec["chars"],
            "pair": spec["pair"],
            "canon": spec["canon"],
            "tags": spec["tags"] + [spec["kind"]],
            "kind": spec["kind"],
            "desc": common.clean_text(spec["desc"]),
            "video": video,
            "thumb": poster["t"],
            "c": poster["c"],
            "bytes": size,
            "chapters": chapters_for(MEDIA / spec["manifest"] if spec["manifest"] else None, fid),
        }
        date = post_date(src)
        if date:
            item["date"] = date
        if spec["also"]:
            item["also"] = spec["also"]
        if spec["link"]:
            item["link"] = spec["link"]
        if spec["group"]:
            item["group"] = spec["group"]
        if spec["canon"] == "non-canon":
            item["credit"] = {
                "by": "Mobile Legends: Bang Bang",
                "platform": None,
                "url": None,
                "note": "An official parody made outside the story.",
            }
        item["_n"] = n
        items.append(item)

    items.sort(key=lambda it: (_KIND_ORDER.get(it["kind"], 99), it["_n"]))
    for it in items:
        del it["_n"]
    featured = next(it["id"] for it in items if it["id"] == film_id(MEDIA / FEATURED_SRC))
    return {"v": 1, "slug": "films", "featured": featured, "items": items, "bytes": total_bytes}


def merge_ignored() -> None:
    path = common.REPO / "scripts" / "library" / "ignored.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for rel, reason in IGNORED.items():
        data[f"media/{rel}"] = reason
    path.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    only = sys.argv[2:] or None
    specs = plan()
    if cmd in ("media", "all"):
        res = run_media(specs, only)
        (WORK / "media-log.json").write_text(json.dumps(res, indent=1, default=str), encoding="utf-8")
    if cmd in ("data", "all"):
        data = build_data(specs)
        common.write_json("films", data)
        merge_ignored()
        n = len(data["items"])
        enc = sum(1 for s in specs if s["mode"] != "local")
        print(f"films: {n} items, {enc} files in the mirror, shipped bytes {common.human(data['bytes'])}")
    if cmd == "list":
        for s in specs:
            print(s["id"], s["mode"], s["kind"])


if __name__ == "__main__":
    main()
