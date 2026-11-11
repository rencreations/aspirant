"""The Design page of the official Arts (/collection/arts/design).

Reads curation/design.json (the decisions: which pictures, in which order, their titles, alts,
kinds, credits) and builds:

    mirror   D:\\ren\\aspirant-r2\\library\\v1\\arts\\v2\\design\\<id>\\{t,p,f}.webp   (common.image_set)
    data     apps/web/public/data/library/arts-design.json

Run with the anaconda Python, from anywhere:

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/design.py

Rules this script keeps:
- Every picture of the design folders of media/_all (catalog.groups(), room "design") must be an
  item or be listed under "dropped" in the curation file. A new one stops the run.
- The picture is the whole picture. The only cut is a fully transparent border ("crop":
  "transparent"), which is a plain border of the source and holds no art. The cut file is kept in
  D:\\ren\\aspirant-work\\arts_rooms\\design\\prep so a re-run does not encode it again.
- Never upscaled: the full size is the source size (up to 3840).
- A key that exists in the mirror is never changed. If the source or the cut changes, the run
  stops and says to bump "rev" of the item in the curation file (the new files get a new key).
- Idempotent: a second run writes nothing to the mirror and the same data file.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # common
sys.path.insert(0, str(HERE))  # catalog
import common  # noqa: E402
import catalog  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

ROOM = "design"
CURATION = HERE / "curation" / "design.json"
PREP = common.WORK / "arts_rooms" / "design" / "prep"
KEY_ROOT = "arts/v2/design"
WHAT = {"character", "weapon", "mecha", "droid", "other"}
MAX_TITLE_WORDS = 6
ALPHA_MIN = 8  # alpha at or below this counts as empty


def opaque_box(path: Path) -> tuple[int, int, int, int]:
    """Smallest box that holds every pixel with alpha above ALPHA_MIN (the whole picture when it has none)."""
    with Image.open(path) as im:
        w, h = im.size
        if "A" not in im.mode and "transparency" not in im.info:
            return (0, 0, w, h)
        a = np.asarray(im.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(a > ALPHA_MIN)
    if not len(xs):
        return (0, 0, w, h)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def prepare(src: Path, sha6: str) -> tuple[Path, tuple[int, int, int, int] | None]:
    """The file to encode and the box that was cut (None when nothing is cut)."""
    box = opaque_box(src)
    with Image.open(src) as im:
        full = (0, 0, im.width, im.height)
    if box == full:
        return src, None
    PREP.mkdir(parents=True, exist_ok=True)
    out = PREP / f"{sha6}-{box[0]}-{box[1]}-{box[2]}-{box[3]}.png"
    if not out.exists() or out.stat().st_size == 0:
        with Image.open(src) as im:
            im.convert("RGBA").crop(box).save(out, "PNG")
    return out, box


def build_one(args: tuple[str, str, str, str]) -> tuple[str, dict]:
    """Encode one picture (runs in a worker). Returns (id, LibImage record)."""
    item_id, src, key_base, sig = args
    sig_file = common.key_path(f"{key_base}/.prep")
    f_file = common.LIB_ROOT / key_base / "f.webp"
    if f_file.exists() and sig_file.exists() and sig_file.read_text(encoding="utf-8") != sig:
        raise SystemExit(f"{item_id}: the source or the cut changed and the key {key_base} already exists. Bump rev in the curation file.")
    img = common.image_set(Path(src), key_base, full_max=3840)
    sig_file.write_text(sig, encoding="utf-8")
    return item_id, img


def main() -> None:
    cur = json.loads(CURATION.read_text(encoding="utf-8"))
    all_groups = catalog.groups()
    groups = [g for g in all_groups if g.room == ROOM]
    by_prefix = {}
    for entry in cur["items"]:
        hits = [g for g in all_groups if g.sha1.startswith(entry["sha"])]
        if len(hits) != 1:
            raise SystemExit(f'{entry["slug"]}: sha prefix {entry["sha"]} matches {len(hits)} pictures')
        by_prefix[entry["sha"]] = hits[0]

    # Coverage: every design picture is an item or is dropped on purpose.
    listed = {g.sha1 for g in by_prefix.values()}
    dropped = [d["sha"] for d in cur.get("dropped", [])]
    missing = [g for g in groups if g.sha1 not in listed and not any(g.sha1.startswith(d) for d in dropped)]
    if missing:
        raise SystemExit("design pictures not in the curation file:\n" + "\n".join(f"  {g.sha1[:6]} {g.main['rel']}" for g in missing))

    problems: list[str] = []
    seen_slugs: set[str] = set()
    jobs: list[tuple[str, str, str, str]] = []
    plan: list[dict] = []
    cuts: list[str] = []
    for entry in cur["items"]:
        g = by_prefix[entry["sha"]]
        slug = entry["slug"]
        if slug in seen_slugs:
            problems.append(f"{slug}: duplicate slug")
        seen_slugs.add(slug)
        if entry["what"] not in WHAT:
            problems.append(f'{slug}: what {entry["what"]!r} is not one of {sorted(WHAT)}')
        if len(entry["title"].split()) > MAX_TITLE_WORDS:
            problems.append(f"{slug}: title has more than {MAX_TITLE_WORDS} words")
        if not entry["alt"].endswith("."):
            problems.append(f"{slug}: alt must be a sentence")
        if any(t != t.lower() for t in entry["tags"]):
            problems.append(f"{slug}: tags must be lower case")
        sha6 = g.sha1[:6]
        item_id = f"arts-{ROOM}-{slug}-{sha6}"
        rev = int(entry.get("rev", 1))
        key_base = f"{KEY_ROOT}/{item_id}" + (f"-r{rev}" if rev > 1 else "")
        if entry.get("crop") == "transparent":
            src, box = prepare(g.abs_path, sha6)
            if box:
                cuts.append(f"{sha6} {slug}: cut {g.w}x{g.h} to box {box} ({box[2] - box[0]}x{box[3] - box[1]})")
        else:
            src, box = g.abs_path, None
        sig = json.dumps({"sha1": g.sha1, "box": box})
        jobs.append((item_id, str(src), key_base, sig))
        plan.append({"entry": entry, "group": g, "id": item_id})
    if problems:
        raise SystemExit("\n".join(problems))

    before = _mirror_bytes()
    imgs: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=6) as ex:
        for item_id, img in ex.map(build_one, jobs):
            imgs[item_id] = img
    written = _mirror_bytes() - before

    items = []
    for p in plan:
        e, g = p["entry"], p["group"]
        item = {
            "id": p["id"],
            "title": e["title"],
            "collection": "arts",
            "room": ROOM,
            "chars": e.get("chars", g.chars),
            "pair": e.get("pair", g.pair),
            "canon": "official",
            "tags": e["tags"],
            "places": g.places,
            "alt": e["alt"],
            "img": imgs[p["id"]],
            "what": e["what"],
        }
        if e.get("credit"):
            item["credit"] = e["credit"]
        items.append(item)

    count = Counter(i["what"] for i in items)
    kinds = [{"id": k["id"], "name": k["name"], "count": count.get(k["id"], 0)} for k in cur["kinds"]]
    kinds = [k for k in kinds if k["count"]]
    common.write_json(f"arts-{ROOM}", {"v": 1, "slug": f"arts-{ROOM}", "room": ROOM, "kinds": kinds, "items": items})

    print(f"\n{len(items)} items, kinds: " + ", ".join(f'{k["name"]} {k["count"]}' for k in kinds))
    for c in cuts:
        print("  " + c)
    print("pictures (full size file):")
    for i in items:
        m = i["img"]
        small = " (small)" if max(m["w"], m["h"]) < 800 else ""
        print(f'  {i["id"]}  {m["w"]}x{m["h"]}{small}  {i["what"]}')
    print(f"bytes written to the mirror this run: {common.human(written)}; folder total {common.human(_mirror_bytes())}")
    left = [d["file"] for d in cur.get("dropped", [])]
    print("dropped:", left or "none")


def _mirror_bytes() -> int:
    root = common.LIB_ROOT / KEY_ROOT
    if not root.exists():
        return 0
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


if __name__ == "__main__":
    main()
