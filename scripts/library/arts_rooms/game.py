"""Arts, Official, Game: the pictures of the game (in-game animation frames and game screens).

Reads the decisions in curation/game.json (one record per kept picture, keyed by the full sha1 of the
source file, and one per dropped picture with the reason), the catalog of different pictures in
media/_all (`catalog.groups()`, room "game"), and writes:

    D:\\ren\\aspirant-r2\\library\\v1\\arts\\v2\\game\\<slug>-<sha1 first 6>[-c<crop>]\\{t,p,f}.webp
    apps/web/public/data/library/arts-game.json

Run:  C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/game.py

Rules it keeps (see the README of this folder and docs/superpowers/specs/2026-11-11-arts-redesign.md):

- Every picture of the catalog must be kept or dropped in the curation file, and every curated sha1 must
  exist in the catalog. A new or unknown picture stops the run, so nothing is shipped or lost unseen.
- img is the whole picture. The only cuts are the ones named in the curation file (a burned in file name
  band, a black bar, a transparent margin). A cut is part of the media key (`-cb112` is "bottom 112 px"),
  so a changed cut is a new key and no existing key ever changes content.
- A facet counts a picture when the facet id is in its `places` or in its `chars`. That is the rule the
  filter of the page must use too.
- Idempotent: the scratch sources and the three sizes are skipped when fresh.
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import catalog  # noqa: E402

ROOM = "game"
SLUG = "arts-game"
CURATION = Path(__file__).resolve().parent / "curation" / "game.json"
SCRATCH = common.WORK / "arts_rooms" / "game" / "src"
MEDIA_PREFIX = "arts/v2/game"
WORKERS = 8
SIZE_FLOOR = 480  # px on the long side: below it a picture is dropped (nothing is upscaled)

CHAR_ORDER = ["fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "obsidia", "selena"]


def crop_suffix(crop: dict | None) -> str:
    if not crop:
        return ""
    return "-c" + "".join(f"{k[0]}{crop[k]}" for k in ("top", "bottom", "left", "right") if crop.get(k))


def key_name(sha1: str, rec: dict) -> str:
    return f"{rec['slug']}-{sha1[:6]}{crop_suffix(rec.get('crop'))}"


def prepare(src: Path, dst: Path, crop: dict | None) -> Path:
    """Write the scratch source: the cut applied, and an opaque alpha channel removed. Skipped when fresh."""
    import numpy as np
    from PIL import Image

    if common.fresh(dst, src):
        return dst
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im.load()
        w, h = im.size
        c = crop or {}
        box = (c.get("left", 0), c.get("top", 0), w - c.get("right", 0), h - c.get("bottom", 0))
        if box != (0, 0, w, h):
            im = im.crop(box)
        if im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info:
            rgba = im.convert("RGBA")
            if int(np.asarray(rgba)[..., 3].min()) == 255:
                im = rgba.convert("RGB")
            else:
                im = rgba
        elif im.mode != "RGB":
            im = im.convert("RGB")
        tmp = dst.with_suffix(".tmp.png")
        im.save(tmp, "PNG", compress_level=1)
    tmp.replace(dst)
    return dst


def build_one(args: tuple[str, str, str, dict | None]) -> tuple[str, dict]:
    sha1, src_s, name, crop = args
    dst = prepare(Path(src_s), SCRATCH / f"{name}.png", crop)
    img = common.image_set(dst, f"{MEDIA_PREFIX}/{name}")
    return sha1, img


def pair_of(chars: list[str]) -> str | None:
    pairs = {catalog.PAIR_OF_CHAR[c] for c in chars}
    return pairs.pop() if len(pairs) == 1 else None


def interleave(items: list[dict]) -> list[dict]:
    """Round robin over the main Aspirant (or folder) of each item, so a row is never one character for long.
    Inside a group the pictures keep the order of their source files (the order of the animation)."""
    groups: dict[str, list[dict]] = {}
    for it in items:
        main = it["chars"][0] if it["chars"] else it["places"][0]
        groups.setdefault(main, []).append(it)
    for g in groups.values():
        g.sort(key=lambda it: it["_src"])
    names = sorted(groups, key=lambda n: (-len(groups[n]), n))
    out: list[dict] = []
    for r in range(max(len(g) for g in groups.values())):
        for n in names:
            if r < len(groups[n]):
                out.append(groups[n][r])
    return out


def codex_names() -> set[str]:
    p = common.DATA_DIR / "lore-codex.json"
    if not p.exists():
        return set()
    d = json.loads(p.read_text(encoding="utf-8"))
    out: set[str] = set()
    for e in d["entries"]:
        for n in [e["name"], *e.get("aka", [])]:
            out.add(n.lower().removeprefix("the "))
    return out


def main() -> None:
    cur = json.loads(CURATION.read_text(encoding="utf-8"))
    kept: dict[str, dict] = cur["kept"]
    dropped: dict[str, dict] = cur["dropped"]

    groups = {g.sha1: g for g in catalog.groups() if g.room == ROOM}
    unknown = sorted(set(groups) - set(kept) - set(dropped))
    missing = sorted((set(kept) | set(dropped)) - set(groups))
    if unknown or missing:
        for s in unknown:
            print("NOT DECIDED:", s[:10], groups[s].main["rel"])
        for s in missing:
            print("NOT IN CATALOG:", s[:10])
        raise SystemExit("the curation file and the catalog disagree")
    prefixes = [s[:6] for s in kept]
    if len(set(prefixes)) != len(prefixes):
        raise SystemExit("two kept pictures share the first 6 characters of their sha1")
    for s, rec in kept.items():
        g = groups[s]
        if max(g.w, g.h) < SIZE_FLOOR:
            raise SystemExit(f"{rec['slug']} is under the size floor ({g.w}x{g.h}): drop it in the curation file")
    for s in kept:
        if kept[s]["src"] != groups[s].main["rel"]:
            raise SystemExit(f"the best source file of {kept[s]['slug']} changed: {groups[s].main['rel']}")

    todo = [(s, str(groups[s].abs_path), key_name(s, rec), rec.get("crop")) for s, rec in kept.items()]
    if "--limit" in sys.argv:
        # a trial: build the first N pictures (and the cut ones) and stop, the data file is not written
        n = int(sys.argv[sys.argv.index("--limit") + 1])
        trial = [t for t in todo if t[3]][:n] + todo[:n]
        for t in trial:
            print(" ", build_one(t)[1]["f"])
        return
    imgs: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=WORKERS) as ex:
        for i, (sha1, img) in enumerate(ex.map(build_one, todo, chunksize=2), 1):
            imgs[sha1] = img
            if i % 40 == 0:
                print(f"  {i}/{len(todo)}", flush=True)

    credit_by = cur["credit"]["by"]
    items: list[dict] = []
    for s, rec in kept.items():
        g = groups[s]
        chars = [c for c in CHAR_ORDER if c in rec["chars"]]
        if len(chars) != len(rec["chars"]):
            raise SystemExit(f"unknown character in {rec['slug']}: {rec['chars']}")
        item = {
            "id": f"arts-{ROOM}-{rec['slug']}-{s[:6]}",
            "title": rec["title"],
            "collection": "arts",
            "room": ROOM,
            "chars": chars,
            "pair": pair_of(chars),
            "canon": "official",
            "tags": rec["tags"],
            "places": g.places,
            "alt": rec["alt"],
            "img": imgs[s],
            "credit": {"by": credit_by, "platform": None, "url": None, "note": cur["credit"][rec["kind"]]},
            "_src": rec["src"],
        }
        items.append(item)
    items = interleave(items)
    for it in items:
        del it["_src"]

    # facets: places and chars, as ids
    counts: dict[str, int] = {}
    for it in items:
        for fid in dict.fromkeys([*it["places"], *it["chars"]]):
            counts[fid] = counts.get(fid, 0) + 1
    names = catalog.ENTITY_NAMES
    bad = [fid for fid in counts if fid not in names]
    if bad:
        raise SystemExit(f"no canon name for {bad}: add them to catalog.ENTITY_NAMES (shared file) or tell the main session")
    facets = [{"id": fid, "name": names[fid], "count": n} for fid, n in counts.items()]
    facets.sort(key=lambda f: (-f["count"], f["name"]))

    known = codex_names()
    for f in facets:
        n = f["name"].lower().removeprefix("the ")
        if known and n not in known and n.rstrip("s") not in known and n + "s" not in known:
            print(f"  note: facet name {f['name']!r} is not a codex name or alias")

    common.write_json(SLUG, {"v": 1, "slug": SLUG, "room": ROOM, "facets": facets, "items": items})

    # report
    total = 0
    for it in items:
        for k in ("t", "p", "f"):
            total += common.key_path(it["img"][k]).stat().st_size
    print(f"\n{len(items)} pictures shipped, {len(dropped)} dropped, mirror bytes {total} ({common.human(total)})")
    print("facets:", ", ".join(f"{f['name']} {f['count']}" for f in facets))
    print("cut pictures:", sum(1 for r in kept.values() if r.get("crop")))
    for s, d in dropped.items():
        print("dropped:", d["sources"], "-", d["reason"])


if __name__ == "__main__":
    main()
