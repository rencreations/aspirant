"""Validate the visual scripts (`scripts/story/visuals/cNN.json`) against the text and the files.

    python scripts/story/visuals.py                 # every script, plus the whole-book checks
    python scripts/story/visuals.py c05 c06         # only these chapters

Errors stop the build. Warnings are for the curator to read and either fix or accept.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image

import storytext

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "tools"))
from shots import cuts as shot_cuts  # noqa: E402
VISUALS = HERE / "visuals"
MEDIA = Path(__import__("os").environ.get("ASPIRANT_MEDIA", "D:/ren/aspirant/media"))
WEB_PUBLIC = HERE.parent.parent / "apps" / "web" / "public"

KINDS = {"plate", "clip", "panels", "place", "portrait", "film", "voice"}
STILL_TYPES = {"image", "frame", "site"}
SCORES = {
    "we-believe", "guinevere-theme", "vexana-theme", "silverbolt-raiko",
    "obsidia-theme", "obsidia-aspirant", "obsidia-solo",
}
SLUGS = {"fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "obsidia", "selena"}
FORBIDDEN = ("fanart", "cosplay", "fanmade", "_edits", "_gameplay", "in-game-animation", "live-action", "_backup")
MAX_CLIP_SECONDS = 8.5
MAX_SEQUENCE_SECONDS = 30.0
MIN_PART_SECONDS = 1.2
CUT_MARGIN = 0.1
# The chapters of the Layla and Fanny arc, and every chapter of Acts III to VI (18 to 87), where the owner wants real text between pictures.
STRICT_SPACING = {"c00", "c01", "c02", "c03", "c04", "c05", "c08"} | {f"c{n:02d}" for n in range(18, 88)}
MIN_WORDS_BETWEEN = 45
EXTRA = HERE / "extra"


def media_src(src: str) -> Path:
    """`extra/<name>` is a picture the owner supplied (kept in scripts/story/extra), an absolute path is
    itself, anything else is relative to the media folder."""
    if src.startswith("extra/"):
        return EXTRA / src[len("extra/") :]
    p = Path(src)
    return p if p.is_absolute() else MEDIA / src


def inside_a_shot(src: str, start: float, end: float) -> list[float]:
    """Cuts of the film that fall inside [start, end] (with a margin), so the stretch is not one shot."""
    try:
        found = shot_cuts(str(media_src(src)), 0.2)
    except SystemExit:
        return []
    return [c for c in found if start - CUT_MARGIN < c < end + CUT_MARGIN]
CAPTION_MAX = 90


@lru_cache(maxsize=None)
def image_size(path: str) -> tuple[int, int]:
    with Image.open(path) as im:
        return im.size


@lru_cache(maxsize=None)
def video_info(path: str) -> tuple[int, int, float]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height:format=duration", "-of", "json", path],
        capture_output=True, text=True, check=False,
    ).stdout
    data = json.loads(out or "{}")
    st = (data.get("streams") or [{}])[0]
    return int(st.get("width") or 0), int(st.get("height") or 0), float((data.get("format") or {}).get("duration") or 0)


def norm(words: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", words.lower().replace("’", "'").replace("'", "")).strip()


def strings_of(obj) -> list[str]:
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, dict):
        return [s for v in obj.values() for s in strings_of(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in strings_of(v)]
    return []


def source_key(m: dict) -> str | None:
    t = m.get("type")
    if t == "image":
        return f"{m['src']}|{m.get('crop')}"
    if t in ("frame", "clip"):
        at = m.get("t") if t == "frame" else m.get("start", 0)
        return f"{m['src']}|{int((at or 0) // 3)}"
    return None


cut_notes: list[str] = []


def check_sequence(m: dict, where: str, errors: list[str], clip_s: list[float]) -> None:
    """A sequence: two or more shots joined with dissolves, looping without a seam."""
    parts = m.get("parts")
    if not isinstance(parts, list) or not (1 <= len(parts) <= 6):
        errors.append(f"{where}: sequence needs 1 to 6 parts")
        return
    x = float(m.get("xfade", 0.4))
    if not (0.15 <= x <= 1.0):
        errors.append(f"{where}: xfade must be between 0.15 and 1.0")
    total = 0.0
    for j, part in enumerate(parts):
        w = f"{where} part {j}"
        src = part.get("src")
        low = str(src).lower()
        for bad in FORBIDDEN:
            if bad in low:
                errors.append(f"{w}: source not allowed ({bad}): {src}")
        p = media_src(str(src))
        if not src or not p.exists():
            errors.append(f"{w}: file not found: {src!r}")
            continue
        vw, vh, dur = video_info(str(p))
        s, e = part.get("start"), part.get("end")
        if not isinstance(s, (int, float)) or not isinstance(e, (int, float)) or not (0 <= s < e <= dur + 0.05):
            errors.append(f"{w}: start/end {s!r}/{e!r} outside the video (0 to {dur:.2f})")
            continue
        if e - s < max(MIN_PART_SECONDS, 3 * x):
            errors.append(f"{w}: part is {e - s:.2f}s, it needs at least {max(MIN_PART_SECONDS, 3 * x):.2f}s")
        crop = part.get("crop")
        if crop is not None:
            if not (isinstance(crop, list) and len(crop) == 4 and all(isinstance(v, int) for v in crop)):
                errors.append(f"{w}: crop must be [x, y, w, h] integers")
            else:
                cx, cy, cw, ch_ = crop
                if cx < 0 or cy < 0 or cw < 16 or ch_ < 16 or cx + cw > vw or cy + ch_ > vh:
                    errors.append(f"{w}: crop {crop} outside the source ({vw}x{vh})")
        if part.get("spanCuts"):
            # The part keeps the film's own cuts on purpose; its first and last frame must still be inside a shot.
            for edge, label in ((s, "start"), (e, "end")):
                near = inside_a_shot(str(src), edge, edge)
                if near:
                    errors.append(f"{w}: the {label} ({edge:.2f}s) is within {CUT_MARGIN}s of a cut at {near[0]:.2f}s; move it into the shot")
        else:
            inner = inside_a_shot(str(src), s, e)
            if inner:
                errors.append(f"{w}: a cut at {inner[0]:.2f}s lies inside {s:.2f} to {e:.2f}: the next shot would show; end the part before the cut (with {CUT_MARGIN}s to spare), or set \"spanCuts\": true on the part if the film's own cuts are meant to play")
        total += (e - s)
    total -= x * (len(parts))  # the dissolves between the parts and back into the first
    clip_s.append(max(total, 0))
    if total < 3.0:
        errors.append(f"{where}: the sequence is {total:.1f}s long, the minimum is 3s")
    if total > MAX_SEQUENCE_SECONDS:
        errors.append(f"{where}: the sequence is {total:.1f}s long, the limit is {MAX_SEQUENCE_SECONDS}s")
    if len(parts) < 2:
        cut_notes.append(f"{where}: a sequence of one shot only (the owner wants two or more shots)")
    if not str(m.get("alt", "")).strip():
        errors.append(f"{where}: alt text is required")


def check_media(m, where: str, errors: list[str], *, allow: set[str], clip_s: list[float]) -> None:
    if not isinstance(m, dict):
        errors.append(f"{where}: media must be an object")
        return
    t = m.get("type")
    if t not in {"image", "frame", "clip", "site", "sequence"}:
        errors.append(f"{where}: bad media type {t!r}")
        return
    if t not in allow:
        errors.append(f"{where}: media type {t} not allowed here (allowed: {sorted(allow)})")
    if not str(m.get("alt", "")).strip():
        errors.append(f"{where}: alt text is required")
    if t == "sequence":
        check_sequence(m, where, errors, clip_s)
        return
    src = m.get("src")
    if not isinstance(src, str) or not src:
        errors.append(f"{where}: src is required")
        return
    if t == "site":
        if not (WEB_PUBLIC / src).exists():
            errors.append(f"{where}: site file not found: apps/web/public/{src}")
        return
    low = src.lower()
    for bad in FORBIDDEN:
        if bad in low:
            errors.append(f"{where}: source not allowed ({bad}): {src}")
    p = media_src(src)
    if not p.exists():
        errors.append(f"{where}: file not found: {src}")
        return
    crop = m.get("crop")
    if t == "image":
        w, h = image_size(str(p))
        size = (w, h)
    else:
        vw, vh, dur = video_info(str(p))
        size = (vw, vh)
        if t == "frame":
            tt = m.get("t")
            if not isinstance(tt, (int, float)) or not (0 <= tt <= dur):
                errors.append(f"{where}: frame t={tt!r} outside the video (0 to {dur:.2f})")
        if t == "clip":
            s, e = m.get("start"), m.get("end")
            if not isinstance(s, (int, float)) or not isinstance(e, (int, float)) or not (0 <= s < e <= dur + 0.05):
                errors.append(f"{where}: clip start/end {s!r}/{e!r} outside the video (0 to {dur:.2f})")
            else:
                clip_s.append(e - s)
                if e - s > MAX_CLIP_SECONDS:
                    errors.append(f"{where}: clip is {e - s:.1f}s, the limit is {MAX_CLIP_SECONDS}s")
                else:
                    inner = inside_a_shot(src, s, e)
                    if inner:
                        cut_notes.append(f"{where}: a cut at {inner[0]:.2f}s lies inside this clip ({s:.2f} to {e:.2f}); the next shot may show")
            if "poster" in m and isinstance(s, (int, float)) and isinstance(e, (int, float)):
                if not (0 <= m["poster"] <= e - s):
                    errors.append(f"{where}: poster time must be inside the clip (0 to {e - s:.1f})")
    if crop is not None:
        if not (isinstance(crop, list) and len(crop) == 4 and all(isinstance(v, int) for v in crop)):
            errors.append(f"{where}: crop must be [x, y, w, h] integers")
        else:
            x, y, w, h = crop
            if x < 0 or y < 0 or w < 16 or h < 16 or x + w > size[0] or y + h > size[1]:
                errors.append(f"{where}: crop {crop} outside the source ({size[0]}x{size[1]})")


def validate_chapter(path: Path, chapters: dict[str, storytext.Chapter]) -> tuple[list[str], list[str], list[str]]:
    """Returns (errors, warnings, source keys used)."""
    errors: list[str] = []
    warnings: list[str] = []
    keys: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return [f"{path.name}: cannot read JSON: {exc}"], [], []
    cid = data.get("chapter")
    if cid != path.stem:
        errors.append(f"chapter field {cid!r} does not match the file name {path.stem}")
    ch = chapters.get(path.stem)
    if not ch:
        return errors + [f"no such chapter {path.stem}"], warnings, keys
    paras = ch.paragraphs
    for s in strings_of(data):
        if "\u2014" in s or "\u2013" in s:
            errors.append(f"dash in text: {s[:60]!r}")
    clip_s: list[float] = []
    if "hero" not in data:
        errors.append("hero is required")
    else:
        check_media(data["hero"], "hero", errors, allow={"image", "frame", "clip", "sequence", "site"}, clip_s=clip_s)
        if isinstance(data["hero"], dict) and (k := source_key(data["hero"])):
            keys.append(k)
    if data.get("thumb"):
        check_media(data["thumb"], "thumb", errors, allow={"image", "frame", "site"}, clip_s=clip_s)
    if data.get("score") not in (None, *SCORES):
        errors.append(f"unknown score {data.get('score')!r}")
    if "mood" in data and len(str(data["mood"])) > 120:
        errors.append("mood is longer than 120 characters")
    inserts = data.get("inserts", [])
    if not isinstance(inserts, list):
        return errors + ["inserts must be a list"], warnings, keys
    last_after = None
    last_kind = None
    clip_count = 0
    kinds: set[str] = set()
    for n, ins in enumerate(inserts):
        where = f"insert {n}"
        kind = ins.get("kind")
        if kind not in KINDS:
            errors.append(f"{where}: bad kind {kind!r}")
            continue
        kinds.add(kind)
        after = ins.get("after")
        if not isinstance(after, int) or not (0 <= after < len(paras)):
            errors.append(f"{where}: after={after!r} outside 0..{len(paras) - 1}")
            continue
        anchor = ins.get("anchor", "")
        if len(anchor.split()) < 3:
            errors.append(f"{where}: anchor needs at least 3 words")
        else:
            want = norm(storytext.anchor_of(paras[after].text, len(anchor.split())))
            if norm(anchor) != want:
                errors.append(f"{where}: anchor {anchor!r} does not match paragraph {after}: {storytext.anchor_of(paras[after].text, len(anchor.split()))!r}")
        if last_after is not None and after < last_after:
            errors.append(f"{where}: inserts must be in text order (after {after} follows {last_after})")
        if last_after is not None and after - last_after < 3 and after >= last_after:
            warnings.append(f"{where}: only {after - last_after} paragraphs after the previous insert (want 3 or more)")
        if after < 2:
            warnings.append(f"{where}: placed after paragraph {after}; the first insert should come after paragraph 2 or later")
        if kind == "clip" and last_kind == "clip":
            warnings.append(f"{where}: two clips in a row")
        last_after, last_kind = after, kind
        if len(ins.get("caption", "")) > CAPTION_MAX:
            errors.append(f"{where}: caption longer than {CAPTION_MAX} characters")
        media = ins.get("media")
        if kind == "voice":
            if ins.get("speaker") not in SLUGS:
                errors.append(f"{where}: voice needs speaker in {sorted(SLUGS)}")
            src = ins.get("src", "")
            low = str(src).lower()
            for bad in FORBIDDEN:
                if bad in low:
                    errors.append(f"{where}: source not allowed ({bad}): {src}")
            p = media_src(str(src))
            if not src or not p.exists():
                errors.append(f"{where}: voice file not found: {src!r}")
            else:
                _w, _h, dur = video_info(str(p))
                s0, e0 = ins.get("start"), ins.get("end")
                if not isinstance(s0, (int, float)) or not isinstance(e0, (int, float)) or not (0 <= s0 < e0 <= dur + 0.05):
                    errors.append(f"{where}: voice start/end {s0!r}/{e0!r} outside the file (0 to {dur:.2f})")
                elif e0 - s0 > 15:
                    errors.append(f"{where}: voice is {e0 - s0:.1f}s, the limit is 15s")
            continue
        if ins.get("overlay") is not None:
            ov = ins["overlay"]
            if kind != "clip" or not isinstance(ov, dict) or not str(ov.get("title", "")).strip():
                errors.append(f"{where}: overlay is only for clips and needs a title")
        if kind == "film":
            pub = ins.get("public")
            if not pub or not (WEB_PUBLIC / pub).exists():
                errors.append(f"{where}: film needs an existing public file, got {pub!r}")
            if not ins.get("title"):
                errors.append(f"{where}: film needs a title")
            continue
        if kind == "portrait":
            if ins.get("character") not in SLUGS:
                errors.append(f"{where}: portrait needs character in {sorted(SLUGS)}")
            if media is not None:
                check_media(media, f"{where} media", errors, allow=STILL_TYPES | {"clip", "sequence"}, clip_s=clip_s)
            continue
        if media is None:
            errors.append(f"{where}: media is required")
            continue
        if kind == "panels":
            items = media if isinstance(media, list) else [media]
            if not (1 <= len(items) <= 3):
                errors.append(f"{where}: panels takes 1 to 3 images")
            for j, it in enumerate(items):
                check_media(it, f"{where} panel {j}", errors, allow={"image"}, clip_s=clip_s)
                if isinstance(it, dict) and (k := source_key(it)):
                    keys.append(k)
            continue
        if isinstance(media, list):
            errors.append(f"{where}: {kind} takes one media object")
            continue
        if kind == "clip":
            clip_count += 1
            check_media(media, where, errors, allow={"clip", "sequence"}, clip_s=clip_s)
        else:
            check_media(media, where, errors, allow=STILL_TYPES, clip_s=clip_s)
        if kind == "place" and not ins.get("label"):
            errors.append(f"{where}: place needs a label")
        if isinstance(media, dict) and (k := source_key(media)):
            keys.append(k)
    warnings.extend(cut_notes)
    cut_notes.clear()
    # Text between the pictures: the owner wants real text between visuals (two or three sentences).
    visual_after = sorted(
        {ins["after"] for ins in inserts if isinstance(ins.get("after"), int) and ins.get("kind") != "voice"}
    )
    words = [len(re.findall(r"[A-Za-z0-9']+", p.text)) for p in paras]
    problems: list[str] = []
    prev = -1
    for a in visual_after:
        between = sum(words[prev + 1 : a + 1])
        if between < MIN_WORDS_BETWEEN:
            where_ = "the title card" if prev < 0 else f"the picture after paragraph {prev}"
            problems.append(f"only {between} words of text between {where_} and the picture after paragraph {a} (want {MIN_WORDS_BETWEEN} or more)")
        prev = a
    if visual_after:
        tail = sum(words[visual_after[-1] + 1 :])
        if tail < MIN_WORDS_BETWEEN:
            problems.append(f"only {tail} words of text after the last picture (want {MIN_WORDS_BETWEEN} or more before the next-chapter button)")
    if path.stem in STRICT_SPACING:
        errors.extend(problems)
    else:
        warnings.extend(problems)
    if clip_count > 2:
        warnings.append(f"{clip_count} clip inserts (limit 2)")
    if sum(clip_s) > 40:
        warnings.append(f"{sum(clip_s):.0f} seconds of clips in this chapter (about 6 MB is the limit; 40 s is a lot)")
    if ch.words > 600 and len(kinds) < 3:
        warnings.append(f"only {len(kinds)} kind(s) of insert in a {ch.words}-word chapter (want 3 or more)")
    if len(inserts) < 4:
        warnings.append(f"only {len(inserts)} inserts (aim for 5 to 9)")
    if len(inserts) > 10:
        warnings.append(f"{len(inserts)} inserts (aim for 5 to 9)")
    return errors, warnings, keys


def main(argv: list[str]) -> int:
    book = storytext.parse()
    chapters = storytext.by_id(book)
    files = sorted(VISUALS.glob("c*.json"))
    if argv:
        files = [VISUALS / f"{a}.json" for a in argv]
    bad = 0
    all_keys: dict[str, list[str]] = {}
    for f in files:
        if not f.exists():
            print(f"{f.stem}: MISSING")
            bad += 1
            continue
        errors, warnings, keys = validate_chapter(f, chapters)
        for k in keys:
            all_keys.setdefault(k, []).append(f.stem)
        status = "ok" if not errors else "ERRORS"
        print(f"{f.stem}: {status}  ({len(errors)} errors, {len(warnings)} warnings)")
        for e in errors:
            print(f"  ERROR   {e}")
            bad += 1
        for w in warnings:
            print(f"  warning {w}")
    if not argv:
        missing = [cid for cid in chapters if not (VISUALS / f"{cid}.json").exists()]
        for cid in missing:
            print(f"{cid}: MISSING")
        bad += len(missing)
    # Reuse across chapters: one source at most twice in the book.
    reused = {k: v for k, v in all_keys.items() if len(v) > 2}
    for k, v in reused.items():
        print(f"  reuse   {k.split('|')[0]} ({k.split('|')[1]}) used {len(v)} times: {', '.join(v)}")
    print(f"{len(files)} scripts checked, {bad} errors")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
