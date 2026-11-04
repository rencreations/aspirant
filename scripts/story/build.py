#!/usr/bin/env python3
"""Build the story data and media of the site from the novel and the visual scripts.

    python build.py                 # everything
    python build.py --only c05,c06  # only these chapters (the index is still written for all)
    python build.py --jobs 4        # clips encoded in parallel (default 3)

Reads   story/main.md (ASPIRANT_STORY), scripts/story/visuals/cNN.json, the originals (ASPIRANT_MEDIA)
Writes  apps/web/public/img/story/**, apps/web/public/video/story/**,
        apps/web/public/data/story/{index,end,c00..c48}.json

Stops on any validation error (see visuals.py). Run with the anaconda Python, ffmpeg on the PATH.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import media
import storytext
import visuals

HERE = Path(__file__).resolve().parent
PUBLIC = media.PUBLIC
OUT = PUBLIC / "data" / "story"

ACTS = [
    ("I", "The Record", 0, 9),
    ("II", "The Free Land", 10, 30),
    ("III", "Vexana: Absent", 31, 34),
    ("IV", "Connection Lost", 35, 38),
    ("V", "The Black Hole", 39, 40),
    ("VI", "The Storm Citadel", 41, 48),
]
WPM = 235
CAST_SLUGS = {
    "Layla": "layla", "Fanny": "fanny", "Ruby": "ruby", "Angela": "angela", "Lesley": "lesley",
    "Chang'e": "change", "Guinevere": "guinevere", "Vexana": "vexana", "Selena": "selena", "Obsidia": "obsidia",
}
CONTRACTIONS = {"em", "cause", "til", "tis", "twas", "round", "n"}


def act_of(number: int) -> str:
    for roman, _title, lo, hi in ACTS:
        if lo <= number <= hi:
            return roman
    raise ValueError(number)


def slug_of(number: int) -> str:
    return "prologue" if number == 0 else f"chapter-{number:02d}"


# ---------------------------------------------------------------------------- text


def smart(s: str) -> str:
    """Straight quotes to typographic ones. `*` marks are transparent for the decision."""
    out: list[str] = []
    prev = ""  # previous visible character
    n = len(s)
    for i, ch in enumerate(s):
        if ch == '"':
            opening = prev == "" or prev in " \t([{“‘"
            out.append("“" if opening else "”")
        elif ch == "'":
            nxt = s[i + 1] if i + 1 < n else ""
            word = re.match(r"[A-Za-z]+", s[i + 1 : i + 8].replace("*", ""))
            leading = prev == "" or prev in " \t([{“‘"
            if leading and word and word.group(0).lower() in CONTRACTIONS:
                out.append("’")
            elif leading and nxt.isalpha():
                out.append("‘")
            else:
                out.append("’")
        else:
            out.append(ch)
        if ch != "*":
            prev = out[-1] if ch in "\"'" else ch
    return "".join(out)


def segments(text: str) -> list[dict]:
    """Inline markdown (`*italic*`) to segments: {"t": text} or {"t": text, "em": 1}."""
    text = smart(text)
    parts = re.split(r"(\*[^*]+\*)", text)
    out: list[dict] = []
    for part in parts:
        if not part:
            continue
        if part.startswith("*") and part.endswith("*") and len(part) > 2:
            out.append({"t": part[1:-1], "em": 1})
        else:
            out.append({"t": part})
    return out


def plain(text: str) -> str:
    return smart(text).replace("*", "")


# ---------------------------------------------------------------------------- media


class Plan:
    """Collects media work, runs the slow parts in parallel and hands back records."""

    def __init__(self, jobs: int) -> None:
        self.pool = ThreadPoolExecutor(max_workers=jobs)
        self.futures: list = []

    def still(self, spec, cid, role, size_key):
        f = self.pool.submit(media.make_still, spec, cid, role, size_key)
        self.futures.append(f)
        return f

    def clip(self, spec, cid, role, size_key):
        make = media.make_sequence if spec["type"] == "sequence" else media.make_clip
        f = self.pool.submit(make, spec, cid, role, size_key)
        self.futures.append(f)
        return f

    def audio(self, spec, cid, role):
        f = self.pool.submit(media.make_audio, spec, cid, role)
        self.futures.append(f)
        return f

    def one(self, spec, cid, role, still_key, clip_key):
        if spec["type"] in ("clip", "sequence"):
            return self.clip(spec, cid, role, clip_key)
        return self.still(spec, cid, role, still_key)


def voice_record(v: storytext.Voice, durations: dict) -> dict:
    rel = f"audio/voice/{v.slug}/{v.n:02d}.m4a"
    if not (PUBLIC / rel).exists():
        raise SystemExit(f"voice file missing on the site: {rel} (from {v.file})")
    return {"slug": v.slug, "n": v.n, "src": rel, "dur": durations.get(v.slug, {}).get(v.n)}


def load_durations() -> dict:
    out: dict = {}
    for d in (PUBLIC / "audio" / "voice").iterdir():
        idx = d / "index.json"
        if idx.exists():
            out[d.name] = {row["n"]: row["durationSec"] for row in json.loads(idx.read_text(encoding="utf-8"))}
    return out


def build_chapter(ch: storytext.Chapter, vis: dict, plan: Plan, durations: dict) -> dict:
    cid = ch.id
    hero_spec = vis["hero"]
    hero_f = plan.one(hero_spec, cid, "hero", "hero", "hero")
    inserts = []
    for n, ins in enumerate(vis.get("inserts", [])):
        kind = ins["kind"]
        item: dict = {"t": "insert", "kind": kind, "after": ins["after"]}
        for k in ("caption", "label", "character", "title"):
            if ins.get(k):
                item[k] = plain(ins[k]) if k in ("caption", "label", "title") else ins[k]
        if ins.get("overlay"):
            ov = ins["overlay"]
            item["overlay"] = {k: plain(ov[k]) for k in ("kicker", "title") if ov.get(k)}
        media_f = None
        if kind == "voice":
            item["_voice"] = plan.audio(ins, cid, f"v{n}")
            if ins.get("line"):
                item["caption"] = plain(ins["line"])
        elif kind == "panels":
            ms = ins["media"] if isinstance(ins["media"], list) else [ins["media"]]
            key = "panel1" if len(ms) == 1 else "panel"
            media_f = [plan.still(m, cid, f"p{n}-{j}", key) for j, m in enumerate(ms)]
        elif kind == "clip":
            media_f = plan.clip(ins["media"], cid, f"i{n}", "clip")
        elif kind in ("plate", "place"):
            media_f = plan.still(ins["media"], cid, f"i{n}", kind)
        elif kind == "portrait" and ins.get("media"):
            media_f = plan.one(ins["media"], cid, f"i{n}", "portrait", "clip")
        elif kind == "film":
            item["public"] = ins["public"]
            item["poster"] = ins.get("poster") or re.sub(r"\.mp4$", ".jpg", ins["public"])
            _w, height, seconds = visuals.video_info(str(PUBLIC / ins["public"]))
            item["height"] = height
            item["duration"] = round(seconds)
        inserts.append((item, media_f))
    thumb_spec = vis.get("thumb") or hero_spec
    return {"ch": ch, "vis": vis, "hero": hero_f, "inserts": inserts, "thumb_spec": thumb_spec}


def resolve(f):
    if isinstance(f, list):
        return [x.result() for x in f]
    return f.result() if f is not None else None


def mood_of(vis: dict, ch: storytext.Chapter) -> str | None:
    """The preview line, without the time and place line when it only repeats it."""
    if not vis.get("mood"):
        return None
    mood = plain(vis["mood"]).strip()
    dateline = plain(ch.dateline).strip() if ch.dateline else ""
    if dateline and mood.startswith(dateline):
        mood = mood[len(dateline) :].lstrip(" .,:;") or mood
        mood = mood[:1].upper() + mood[1:]
    return mood


def assemble_chapter(job: dict, durations: dict) -> tuple[dict, dict]:
    ch: storytext.Chapter = job["ch"]
    vis = job["vis"]
    hero = resolve(job["hero"])
    by_after: dict[int, list] = {}
    for item, mf in job["inserts"]:
        rec = resolve(mf)
        if rec is not None:
            item["media"] = rec
        if "_voice" in item:
            item["voice"] = item.pop("_voice").result()
        by_after.setdefault(item.pop("after"), []).append(item)
    blocks: list[dict] = []
    for b in ch.blocks:
        if b.kind == "break":
            blocks.append({"t": "break"})
            continue
        p = b.para
        assert p is not None
        blk: dict = {"t": "p", "i": p.i, "segs": segments(p.text)}
        if p.voice:
            blk["voice"] = voice_record(p.voice, durations)
        blocks.append(blk)
        blocks.extend(by_after.get(p.i, []))
    data = {
        "id": ch.id,
        "number": ch.number,
        "slug": slug_of(ch.number),
        "title": plain(ch.title),
        "dateline": plain(ch.dateline) if ch.dateline else None,
        "mood": mood_of(vis, ch),
        "words": ch.words,
        "score": vis.get("score"),
        "hero": hero,
        "heroFocus": vis.get("heroFocus", "50% 50%"),
        "blocks": blocks,
    }
    # Thumbnails for the landing and the contents.
    thumb_im = media.still_for_thumb(job["thumb_spec"])
    thumb, sealed = media.make_thumb(thumb_im, ch.id, job["thumb_spec"], bool(vis.get("spoiler")))
    first: list[dict] = []

    def ref(rec: dict) -> dict:
        r = {"kind": rec["kind"], "src": rec["src"]}
        if rec["kind"] == "clip":
            r["poster"] = rec["poster"]
            r["bytes"] = rec["bytes"]
        return r

    first.append(ref(hero))
    shown = 0
    for blk in blocks:
        if blk["t"] == "insert" and shown < 2 and isinstance(blk.get("media"), dict):
            first.append(ref(blk["media"]))
            shown += 1
    entry = {
        "id": ch.id,
        "slug": slug_of(ch.number),
        "number": ch.number,
        "title": data["title"],
        "dateline": data["dateline"],
        "mood": data["mood"],
        "words": ch.words,
        "minutes": max(1, round(ch.words / WPM)),
        "paragraphs": len(ch.paragraphs),
        "act": act_of(ch.number),
        "thumb": thumb,
        "sealed": sealed if vis.get("spoiler") else None,
        "color": hero["color"],
        "score": vis.get("score"),
        "first": first,
    }
    return data, entry


def prune(entries: list[dict]) -> None:
    """Remove media of the story folders that no chapter refers to any more (a script changed)."""
    keep: set[str] = set()

    def add(rec: dict) -> None:
        keep.add(rec["src"])
        if rec.get("poster"):
            keep.add(rec["poster"])

    for e in entries:
        keep.add(e["thumb"])
        if e.get("sealed"):
            keep.add(e["sealed"])
        data = json.loads((OUT / f"{e['id']}.json").read_text(encoding="utf-8"))
        add(data["hero"])
        for blk in data["blocks"]:
            if blk["t"] == "insert" and blk.get("voice"):
                keep.add(blk["voice"]["src"])
            media_ = blk.get("media") if blk["t"] == "insert" else None
            if media_:
                for m in media_ if isinstance(media_, list) else [media_]:
                    add(m)
    removed = 0
    for folder in (PUBLIC / "img" / "story", PUBLIC / "video" / "story", PUBLIC / "audio" / "story"):
        for f in folder.rglob("*"):
            if f.is_file() and f.parent != folder:  # files directly in video/story belong to hero.py
                rel = f.relative_to(PUBLIC).as_posix()
                if rel not in keep:
                    f.unlink()
                    removed += 1
    print(f"pruned {removed} unused media files")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--allow-missing", action="store_true", help="skip chapters that have no visual script yet")
    args = ap.parse_args()
    only = {s for s in args.only.split(",") if s}

    book = storytext.parse()
    chapters = storytext.by_id(book)
    durations = load_durations()

    scripts: dict[str, dict] = {}
    bad = 0
    for ch in book.chapters:
        f = visuals.VISUALS / f"{ch.id}.json"
        if not f.exists():
            if args.allow_missing:
                continue
            print(f"{ch.id}: no visual script")
            bad += 1
            continue
        errors, warnings, _ = visuals.validate_chapter(f, chapters)
        for e in errors:
            print(f"{ch.id}: ERROR {e}")
            bad += 1
        scripts[ch.id] = json.loads(f.read_text(encoding="utf-8"))
    if bad:
        print(f"{bad} problems, nothing built")
        return 1

    plan = Plan(args.jobs)
    jobs: dict[str, dict] = {}
    for ch in book.chapters:
        if ch.id not in scripts or (only and ch.id not in only):
            continue
        jobs[ch.id] = build_chapter(ch, scripts[ch.id], plan, durations)

    OUT.mkdir(parents=True, exist_ok=True)
    entries: dict[str, dict] = {}
    for cid, job in jobs.items():
        data, entry = assemble_chapter(job, durations)
        (OUT / f"{cid}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        entries[cid] = entry
        print(f"{cid}: {data['title']}  ({len(data['blocks'])} blocks)")

    # The index lists every chapter; chapters not rebuilt keep their old entry.
    old_index: dict[str, dict] = {}
    idx_path = OUT / "index.json"
    if idx_path.exists():
        old_index = {e["id"]: e for e in json.loads(idx_path.read_text(encoding="utf-8"))["chapters"]}
    ordered = []
    for ch in book.chapters:
        e = entries.get(ch.id) or old_index.get(ch.id)
        if e:
            ordered.append(e)
    words = sum(c.words for c in book.chapters)
    counts = {"images": 0, "clips": 0, "voices": 0}
    for f in sorted(OUT.glob("c[0-9][0-9].json")):
        for blk in json.loads(f.read_text(encoding="utf-8"))["blocks"]:
            if blk.get("voice"):
                counts["voices"] += 1
            if blk["t"] == "insert" and blk.get("media"):
                for m in blk["media"] if isinstance(blk["media"], list) else [blk["media"]]:
                    counts["clips" if m["kind"] == "clip" else "images"] += 1
        counts["images" if json.loads(f.read_text(encoding="utf-8"))["hero"]["kind"] == "image" else "clips"] += 1
    index = {
        "title": "Aspirant",
        "acts": [{"roman": r, "title": t, "from": lo, "to": hi} for r, t, lo, hi in ACTS],
        "chapters": ordered,
        "stats": {
            "chapters": len([c for c in book.chapters if c.number > 0]),
            "words": words,
            "minutes": round(words / WPM),
            **counts,
        },
    }
    idx_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    cast = []
    also = []
    for t in book.characters:
        m = re.match(r'^([^,]+), "([^"]+)"\.\s*(.*)$', t)
        if m and m.group(1) in CAST_SLUGS:
            cast.append({"slug": CAST_SLUGS[m.group(1)], "name": m.group(1), "aka": m.group(2), "text": segments(m.group(3))})
        else:
            also.append(segments(t))
    timeline = []
    for t in book.timeline:
        m = re.match(r"^([^:]+): (.*)$", t)
        timeline.append({"when": plain(m.group(1)), "text": segments(m.group(2))} if m else {"when": "", "text": segments(t)})
    end = {"cast": cast, "also": also, "timeline": timeline}
    (OUT / "end.json").write_text(json.dumps(end, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"index: {len(ordered)} chapters, {words} words")
    if not only:
        prune(ordered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
