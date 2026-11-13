"""Build the library-wide data: public/data/library/index.json (counts for the shelf) and
search.json (one line per searchable item, for the search sheet).

    python scripts/library/build_index.py

Run it after the collection pipelines. It reads whatever collection files exist, so it is safe to run
at any time. It finds the items of a collection file generically: any list of objects that have an
`id` and a `title` or `name`, at most three levels deep.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

TEXT_FIELDS = ("jp", "en", "caption", "summary", "description", "line", "text")
MAX_K = 220


def walk_items(node: Any, depth: int = 0) -> Iterator[dict[str, Any]]:
    if depth > 3:
        return
    if isinstance(node, list):
        for v in node:
            if isinstance(v, dict) and "id" in v and ("title" in v or "name" in v):
                yield v
                # nested items (a group that holds items)
                for sub in v.values():
                    if isinstance(sub, list) and sub and isinstance(sub[0], dict):
                        yield from walk_items(sub, depth + 1)
            elif isinstance(v, (dict, list)):
                yield from walk_items(v, depth + 1)
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("img", "video", "audio", "credit", "slides", "pages", "blocks", "scenes", "chapters",
                     "facets", "kinds", "characters", "comics", "pairs", "artists", "facts"):
                continue
            if isinstance(v, (list, dict)):
                yield from walk_items(v, depth + 1)


def thumb_key(item: dict[str, Any]) -> str | None:
    for field in ("img", "cover", "image", "thumb"):
        v = item.get(field)
        if isinstance(v, dict):
            for k in ("t", "thumb", "p"):
                if isinstance(v.get(k), str):
                    return v[k]
        if isinstance(v, str) and "/" in v:
            return v
    slides = item.get("slides")
    if isinstance(slides, list) and slides and isinstance(slides[0], dict):
        img = slides[0].get("img")
        if isinstance(img, dict) and isinstance(img.get("t"), str):
            return img["t"]
    return None


def keywords(item: dict[str, Any]) -> str:
    parts: list[str] = []
    for f in ("kind", "group", "category"):
        if isinstance(item.get(f), str):
            parts.append(item[f])
    if isinstance(item.get("tags"), list):
        parts += [t for t in item["tags"] if isinstance(t, str)]
    if isinstance(item.get("credit"), dict):
        by = item["credit"].get("by")
        if isinstance(by, str):
            parts.append(by)
    for f in TEXT_FIELDS:
        if isinstance(item.get(f), str):
            parts.append(item[f])
    text = " ".join(p.strip() for p in parts if p)
    return text[:MAX_K].lower()


# Arts has one data file per room. Official is the first six, Fanart and Cosplay are rooms of their own.
OFFICIAL_ROOMS = ["splash", "scene", "comic", "game", "design", "others"]
ARTS_ROOMS = OFFICIAL_ROOMS + ["fanart", "cosplay"]


def main() -> None:
    counts: dict[str, int] = {}
    entries: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    # Video has two data files, one per room (Films and Others), and Arts one per room. Every other
    # collection has one.
    files = {
        "video": ["video-films", "video-others"],
        "arts": [f"arts-{r}" for r in ARTS_ROOMS],
    }
    rooms: dict[str, int] = {}
    for slug in common.SLUGS:
        datas: list[tuple[str, Any]] = []
        for name in files.get(slug, [slug]):
            path = common.DATA_DIR / f"{name}.json"
            if path.exists():
                datas.append((name, json.loads(path.read_text(encoding="utf-8"))))
        if not datas:
            continue
        n = 0
        for name, data in datas:
            room_n = 0
            # An Arts file lists its pictures in `items`; its other lists are filters, not pictures. The
            # same goes for Design, whose file also lists the campaigns (not items to search for).
            source = data.get("items", []) if slug in ("arts", "design") else data
            for item in walk_items(source):
                iid = str(item["id"])
                title = str(item.get("title") or item.get("name") or "")
                if not title or (slug, iid) in seen:
                    continue
                seen.add((slug, iid))
                n += 1
                room_n += 1
                e: dict[str, Any] = {
                    "id": iid,
                    "c": slug,
                    "t": common.clean_text(title),
                    "w": [c for c in item.get("chars", []) if isinstance(c, str)] if isinstance(item.get("chars"), list) else [],
                    "k": common.clean_text(keywords(item)),
                }
                if slug == "arts":
                    # The room says where the picture opens (`/collection/arts/<room>?i=<id>`).
                    e["r"] = name.removeprefix("arts-")
                if slug in ("design", "comic") and isinstance(item.get("slug"), str):
                    # A post of Design and a comic have their own address, `/collection/<room>/<slug>/`.
                    e["s"] = item["slug"]
                t = thumb_key(item)
                if t:
                    e["i"] = t
                entries.append(e)
            if slug in files:
                # A collection with more than one room: count each room, as `video/films`.
                rooms[f"{slug}/{name.removeprefix(slug + '-')}"] = room_n
        counts[slug] = n
    if any(k.startswith("arts/") for k in rooms):
        rooms["arts/official"] = sum(rooms.get(f"arts/{r}", 0) for r in OFFICIAL_ROOMS)

    index = {"v": 1, "counts": {s: counts.get(s, 0) for s in common.SLUGS}, "total": sum(counts.values())}
    if rooms:
        index["rooms"] = rooms
    common.write_json("index", index)
    common.write_json("search", entries)
    print("counts:", index["counts"], "| search entries:", len(entries))
    print("rooms:", rooms)


if __name__ == "__main__":
    main()
