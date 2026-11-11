"""The Scene page of the official Arts (/collection/arts/scene).

Reads the pictures of the scene room from catalog.groups() (room "scene": the stills of the
official films) and the three caption files made by looking at every picture:

    curation/scene-1.json  scene-2.json  scene-3.json  scene-4.json   keep, title, alt, tags, crop, why

and builds:

    mirror   D:\\ren\\aspirant-r2\\library\\v1\\arts\\v2\\scene\\<id>\\{t,p,f}.webp   (common.image_set)
    data     apps/web/public/data/library/arts-scene.json

Run with the anaconda Python, from anywhere:

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/scene.py

Rules this script keeps:
- A picture with keep=false is dropped. A picture that no caption file lists is dropped too and is
  printed (a slice may be missing or short). A caption for a picture that does not exist is printed.
- The picture is the whole picture. The only cut is the "crop" of its caption (a fraction box {x, y,
  w, h}) which takes away a letterbox or pillarbox bar or a burned in time tag. The cut is made with
  Pillow into a lossless PNG in D:\\ren\\aspirant-work\\arts_rooms\\scene\\prep, then encoded.
- Never upscaled: the full size is the source size (up to 3840).
- A key that exists in the mirror is never changed. If the cut of a picture changes after it was
  built, the run stops and says to bump its entry in REV below (the new files get a new key).
- Idempotent: a second run writes nothing to the mirror and writes the same data file.
- The id of a picture is arts-scene-<slug of its title>-<first 6 of its sha1>. The slug is frozen in
  curation/scene.json the first time the picture is built, so a later edit of a title never moves
  its key or its link.

The filter ("facets" in the data file): every entity folder that holds at least 3 kept pictures,
most pictures first. A picture counts in every folder it was found in. NAMES fixes the spelling of
a name against the lore codex (apps/web/public/data/library/lore-codex.json).
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # common
sys.path.insert(0, str(HERE))  # catalog
import common  # noqa: E402
import catalog  # noqa: E402

from PIL import Image  # noqa: E402

ROOM = "scene"
SLICES = (1, 2, 3, 4)  # slice 4: two film frames that sat in a splash-art folder
CUR_DIR = HERE / "curation"
CUR_META = CUR_DIR / "scene.json"  # frozen slugs and notes
KEY_ROOT = "arts/v2/scene"
WORK = common.WORK / "arts_rooms" / "scene"
PREP = WORK / "prep"
SIGS = WORK / "sigs"
WORKERS = 8
MIN_FACET = 3  # a folder needs this many kept pictures to be a filter
MAX_TITLE_WORDS = 6

# The default order of the data file. "mixed" is a fixed pseudo random order of the sha1 (adding or
# dropping a picture moves no other one) so a row of the flow shows different scenes. "source" is the
# order of the source folders (the stills of one film side by side).
ORDER = "mixed"

# Entity folders that are not a thing to filter by. "others" is the folder of leftovers.
NO_FACET = {"others"}

# Names of the filter as the lore codex spells them. catalog.ENTITY_NAMES is the base; only what
# differs from the codex is listed here (the codex has "the Gardens", "the Singularity" and
# "Oro's soldiers").
NAMES = {
    "the-garden": "The Gardens",
    "singularity": "The Singularity",
    "oro-soldier": "Oro's Soldiers",
}

# Bump the number of a picture (first 6 of its sha1) to get a new key when its cut changed after
# it was built. {} until then.
REV: dict[str, int] = {}


# --------------------------------------------------------------------------------------------
# Decisions
# --------------------------------------------------------------------------------------------


def load_captions() -> tuple[dict[str, dict], list[str]]:
    """sha1 -> caption entry, over the three slices. Returns (entries, problems)."""
    entries: dict[str, dict] = {}
    notes: list[str] = []
    for n in SLICES:
        path = CUR_DIR / f"scene-{n}.json"
        if not path.exists():
            notes.append(f"scene-{n}.json is missing: its pictures are treated as keep=false")
            continue
        for it in json.loads(path.read_text(encoding="utf-8"))["items"]:
            if it["sha1"] in entries:
                notes.append(f"{it['sha1'][:6]} is in two slices (scene-{n}.json is ignored for it)")
                continue
            entries[it["sha1"]] = it
    return entries, notes


def load_meta() -> dict:
    if CUR_META.exists():
        return json.loads(CUR_META.read_text(encoding="utf-8"))
    return {
        "notes": [
            "Decisions of scene.py. The captions are in scene-1.json, scene-2.json and scene-3.json.",
            "slugs: the slug of each built picture, frozen the first time it is built so that a later edit of a title never moves its id or its key in the mirror.",
            "The filter takes every entity folder with 3 or more kept pictures, except 'others' (the folder of leftovers). The default order of the items is a fixed pseudo random order of the sha1.",
        ],
        "slugs": {},
    }


def save_meta(meta: dict) -> None:
    """One slug per line, sorted by sha1, so a diff shows what was added."""
    slugs = meta["slugs"]
    notes = ",\n".join("  " + json.dumps(n, ensure_ascii=False) for n in meta["notes"])
    body = ",\n".join(f"  {json.dumps(k)}: {json.dumps(slugs[k], ensure_ascii=False)}" for k in sorted(slugs))
    text = '{\n "notes": [\n' + notes + '\n ],\n "slugs": {\n' + body + "\n }\n}\n"
    json.loads(text)  # must stay valid
    old = CUR_META.read_text(encoding="utf-8") if CUR_META.exists() else ""
    if old != text:
        CUR_META.write_text(text, encoding="utf-8", newline="\n")


def crop_box(crop: dict | None, w: int, h: int) -> tuple[int, int, int, int] | None:
    """Pixel box of a fraction crop, or None when it is the whole picture."""
    if not crop:
        return None
    x0 = max(0, round(crop["x"] * w))
    y0 = max(0, round(crop["y"] * h))
    x1 = min(w, round((crop["x"] + crop["w"]) * w))
    y1 = min(h, round((crop["y"] + crop["h"]) * h))
    if x1 - x0 < 16 or y1 - y0 < 16:
        raise SystemExit(f"crop {crop} of a {w}x{h} picture is empty")
    box = (x0, y0, x1, y1)
    return None if box == (0, 0, w, h) else box


def prepare(src: Path, sha6: str, box: tuple[int, int, int, int]) -> Path:
    """Cut the box from the source into a lossless PNG (kept, so a re-run does not cut again)."""
    PREP.mkdir(parents=True, exist_ok=True)
    out = PREP / f"{sha6}-{box[0]}-{box[1]}-{box[2]}-{box[3]}.png"
    if not out.exists() or out.stat().st_size == 0:
        tmp = out.with_suffix(".tmp.png")
        with Image.open(src) as im:
            im.crop(box).save(tmp, "PNG")
        tmp.replace(out)
    return out


# --------------------------------------------------------------------------------------------
# The work (one picture, in a worker)
# --------------------------------------------------------------------------------------------


def build_one(job: tuple[str, str, str, str]) -> tuple[str, dict | None, str]:
    """Encode one picture. Returns (id, LibImage record or None, error text)."""
    item_id, src, key_base, sig = job
    try:
        SIGS.mkdir(parents=True, exist_ok=True)
        sig_file = SIGS / f"{item_id}.sig"
        f_file = common.LIB_ROOT / key_base / "f.webp"
        if f_file.exists() and sig_file.exists() and sig_file.read_text(encoding="utf-8") != sig:
            return item_id, None, f"the cut changed and {key_base} already exists: bump REV for it"
        img = common.image_set(Path(src), key_base, full_max=3840)
        sig_file.write_text(sig, encoding="utf-8")
        return item_id, img, ""
    except Exception as e:  # noqa: BLE001 - reported with the picture's id
        return item_id, None, f"{type(e).__name__}: {e}"


def mirror_bytes() -> int:
    root = common.LIB_ROOT / KEY_ROOT
    if not root.exists():
        return 0
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


# --------------------------------------------------------------------------------------------
# Names of the filter
# --------------------------------------------------------------------------------------------


def facet_name(place: str) -> str:
    if place in NAMES:
        return NAMES[place]
    if place in catalog.ENTITY_NAMES:
        return catalog.ENTITY_NAMES[place]
    return " ".join(w.capitalize() for w in place.split("-"))


def _norm(s: str) -> str:
    s = s.lower().replace("'s", "").replace("\u2019s", "")
    s = re.sub(r"^the ", "", s)
    return re.sub(r"[^a-z0-9 ]+", " ", s).strip()


def codex_check(names: list[str]) -> list[str]:
    """Names with no entry of the lore codex of the same name (plural or the article may differ).
    Many are folder names that are not a codex entry (a part of an attack, a form), so this is
    information, not an error."""
    path = common.DATA_DIR / "lore-codex.json"
    if not path.exists():
        return ["lore-codex.json is missing: names were not checked"]
    entries = json.loads(path.read_text(encoding="utf-8"))["entries"]
    known = set()
    for e in entries:
        for n in [e["name"], *(e.get("aka") or [])]:
            k = _norm(n)
            known.add(k)
            known.add(k.rstrip("s"))
    return [n for n in names if _norm(n) not in known and _norm(n).rstrip("s") not in known]


# --------------------------------------------------------------------------------------------


def main() -> None:
    t0 = time.time()
    captions, notes = load_captions()
    # A caption names its picture, so a film frame that the catalog put in another room (a splash-art
    # folder) is built here too when a caption file lists it (slice 4).
    groups = [g for g in catalog.groups() if g.room == ROOM or g.sha1 in captions]
    by_sha = {g.sha1: g for g in groups}
    meta = load_meta()

    extra = [s for s in captions if s not in by_sha]
    pulled = [g for g in groups if g.room != ROOM]
    kept: list[tuple[catalog.Group, dict]] = []
    dropped: list[tuple[catalog.Group, str]] = []
    for g in groups:
        c = captions.get(g.sha1)
        if c is None:
            dropped.append((g, "not in any caption file"))
        elif not c["keep"]:
            dropped.append((g, c.get("why") or "keep is false"))
        else:
            kept.append((g, c))

    problems: list[str] = []
    jobs: list[tuple[str, str, str, str]] = []
    plan: list[dict] = []
    cuts: list[str] = []
    seen_ids: set[str] = set()
    for g, c in kept:
        sha6 = g.sha1[:6]
        title = common.clean_text(c["title"])
        alt = common.clean_text(c["alt"])
        tags = [common.clean_text(t) for t in c["tags"]]
        if not title or len(title.split()) > MAX_TITLE_WORDS:
            problems.append(f"{sha6}: title {title!r} is empty or has more than {MAX_TITLE_WORDS} words")
        if not alt.endswith("."):
            problems.append(f"{sha6}: alt must be one sentence ending with a period")
        if any(t != t.lower() or not t for t in tags):
            problems.append(f"{sha6}: tags must be lower case words")
        slug = meta["slugs"].get(g.sha1) or common.slugify(title)
        item_id = f"arts-{ROOM}-{slug}-{sha6}"
        if item_id in seen_ids:
            problems.append(f"{item_id}: duplicate id")
        seen_ids.add(item_id)
        meta["slugs"].setdefault(g.sha1, slug)
        box = crop_box(c.get("crop"), g.w, g.h)
        if box:
            src = prepare(g.abs_path, sha6, box)
            cuts.append(f"{sha6} {slug}: {g.w}x{g.h} cut to {box[2] - box[0]}x{box[3] - box[1]} ({c.get('why', '')[:90]})")
        else:
            src = g.abs_path
        rev = REV.get(sha6, 1)
        key_base = f"{KEY_ROOT}/{item_id}" + (f"-r{rev}" if rev > 1 else "")
        sig = json.dumps({"sha1": g.sha1, "box": box})
        jobs.append((item_id, str(src), key_base, sig))
        plan.append({"g": g, "c": c, "id": item_id, "title": title, "alt": alt, "tags": tags})
    if problems:
        raise SystemExit("\n".join(problems))
    save_meta(meta)

    before = mirror_bytes()
    imgs: dict[str, dict] = {}
    failed: list[str] = []
    done = 0
    with ProcessPoolExecutor(max_workers=WORKERS) as ex:
        for item_id, img, err in ex.map(build_one, jobs, chunksize=4):
            done += 1
            if img is None:
                failed.append(f"{item_id}: {err}")
            else:
                imgs[item_id] = img
            if done % 100 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)} pictures, {time.time() - t0:.0f} s", flush=True)
    written = mirror_bytes() - before
    if failed:
        print("FAILED, the data file is not written:")
        for f in failed:
            print("  " + f)
        raise SystemExit(1)

    if ORDER == "mixed":
        plan.sort(key=lambda p: hashlib.sha1(("scene-order:" + p["g"].sha1).encode()).hexdigest())
    elif ORDER != "source":
        raise SystemExit(f"ORDER {ORDER!r} is not mixed or source")

    items = []
    for p in plan:
        g = p["g"]
        items.append(
            {
                "id": p["id"],
                "title": p["title"],
                "collection": "arts",
                "room": ROOM,
                "chars": g.chars,
                "pair": g.pair,
                "canon": "official",
                "tags": p["tags"],
                "places": g.places,
                "alt": p["alt"],
                "img": imgs[p["id"]],
            }
        )

    counts: Counter = Counter()
    for it in items:
        for pl in it["places"]:
            counts[pl] += 1
    facets = [
        {"id": pl, "name": facet_name(pl), "count": n}
        for pl, n in counts.items()
        if n >= MIN_FACET and pl not in NO_FACET
    ]
    facets.sort(key=lambda f: (-f["count"], f["name"]))

    common.write_json(f"arts-{ROOM}", {"v": 1, "slug": f"arts-{ROOM}", "room": ROOM, "facets": facets, "items": items})

    # ---- checks and report -------------------------------------------------------------------
    missing_files = []
    for it in items:
        for k in ("t", "p", "f"):
            fp = common.LIB_ROOT / it["img"][k]
            if not fp.exists() or fp.stat().st_size == 0:
                missing_files.append(it["img"][k])
    wanted = {Path(jobs[i][2]).name for i in range(len(jobs))}
    root = common.LIB_ROOT / KEY_ROOT
    orphans = sorted(p.name for p in root.iterdir() if p.is_dir() and p.name not in wanted) if root.exists() else []

    print(f"\nkept {len(items)}, dropped {len(dropped)} of {len(groups)} pictures of the scene room")
    for g in pulled:
        print(f"  taken from the {g.room} room by a caption: {g.sha1[:6]} {g.main['rel']}")
    for note in notes:
        print("  note:", note)
    if extra:
        print(f"  {len(extra)} captions name a picture that is not in the scene room: " + ", ".join(s[:6] for s in extra))
    print(f"cropped {len(cuts)}:")
    for c in cuts:
        print("  " + c)
    print("dropped:")
    for g, why in dropped:
        print(f"  {g.sha1[:6]} {g.w}x{g.h} {why[:110]}")
    print(f"\nfilter: {len(facets)} folders with {MIN_FACET} or more kept pictures (top 15):")
    for f in facets[:15]:
        print(f"  {f['count']:4d}  {f['name']}  ({f['id']})")
    print("  rest: " + ", ".join(f"{f['name']} {f['count']}" for f in facets[15:]))
    small = [it for it in items if max(it["img"]["w"], it["img"]["h"]) < 1000]
    print(f"smaller than 1000 px on the long side: {len(small)}")
    print("facet names with no lore codex entry of that name (information):", codex_check([f["name"] for f in facets]))
    print("missing files:", missing_files or "none")
    print("folders in the mirror that no item uses:", orphans or "none")
    print(f"bytes written to the mirror this run: {common.human(written)}; folder total {common.human(mirror_bytes())}")
    print(f"time {time.time() - t0:.1f} s")
    if missing_files:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
