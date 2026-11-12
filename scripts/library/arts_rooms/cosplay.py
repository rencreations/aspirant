"""Data for the Cosplay room and the Fanart room of Arts (11 Nov 2026).

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/cosplay.py

Writes two files in apps/web/public/data/library/:

* arts-cosplay.json: the ten Aspirants (even those with no photo) and the cosplay photos.
* arts-fanart.json: fanart.json without its cosplay items, with `collection` set to "arts" and
  two head fields (`artists`, `characters`).

The decisions are in curation/cosplay.json (which photos, whom they show, their titles and alt text).
Credits come from media/_captions/captions.json, the same posts the earlier Fanart pipeline used.

The photos keep the keys they already have in the mirror (`fanart/cosplay-*`). Nothing is copied or
re-encoded for them, so a run writes no picture. A photo listed in curation without `img_base` is new:
it is written once under arts/v2/cosplay/ with common.image_set.

Run it again after any run of scripts/library/fanart/build.py (it rewrites fanart.json, the source of
the fanart part). When fanart.json is deleted, arts-fanart.json is the source and this script only
rebuilds arts-cosplay.json.
"""

from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

HERE = Path(__file__).resolve().parent
CURATION = HERE / "curation" / "cosplay.json"
OLD_FANART = common.DATA_DIR / "fanart.json"
CAPTIONS = common.MEDIA / "_captions" / "captions.json"
COSPLAY_DIR = common.MEDIA / "layla-and-fanny" / "art" / "cosplay"
# The 12 Nov 2026 intake (intake.py): finished items, added after the ones above.
INTAKE = HERE / "curation" / "intake-items.json"

# The order of the Cosplay roster: the five pairs, as on the site. (common.CHAR_SLUGS puts Obsidia
# before Selena, which is not the order wanted here.)
ROSTER = [
    ("fanny", "Fanny"), ("layla", "Layla"), ("ruby", "Ruby"), ("angela", "Angela"),
    ("lesley", "Lesley"), ("change", "Chang'e"), ("guinevere", "Guinevere"), ("vexana", "Vexana"),
    ("selena", "Selena"), ("obsidia", "Obsidia"),
]
ORDER = [s for s, _ in ROSTER]
ORDINAL = {1: "first", 2: "second", 3: "third"}
REVEAL_WORDS = {"first": 1, "second": 2, "third": 3}
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def fail(msg: str) -> None:
    raise SystemExit("cosplay.py: " + msg)


def order_chars(chars: list[str]) -> list[str]:
    return sorted(chars, key=ORDER.index)


# ---------------------------------------------------------------------------------------------
# Credits from the captions index
# ---------------------------------------------------------------------------------------------


def load_posts() -> dict[str, dict[str, Any]]:
    data = json.loads(CAPTIONS.read_text(encoding="utf-8"))
    return {e["key"]: e for e in data["entries"]}


def cosplayer_name(caption: str) -> str:
    """The name after `Cosplayer :` in the caption, with the full width brackets made plain."""
    m = re.search(r"Cosplayer\s*:\s*(.+)", caption)
    if not m:
        fail("no cosplayer named in a caption: " + caption[:80])
    name = m.group(1).split("\n")[0]
    name = re.sub(r"\s*\uff08\s*", " (", name)
    name = re.sub(r"\s*\uff09\s*", ") ", name)
    return re.sub(r"\s+", " ", name).strip()


def reveal_of(caption: str) -> int:
    m = re.search(r"\b(first|second|third) reveal", caption)
    if not m:
        fail("no reveal number in a caption: " + caption[:80])
    return REVEAL_WORDS[m.group(1)]


def credit_for(post: dict[str, Any], reveal: int) -> dict[str, Any]:
    return {
        "by": cosplayer_name(post["caption"]),
        "platform": "Instagram",
        "url": post["url"],
        "date": post["date"][:10],
        "note": f"Posted by the official Mobile Legends: Bang Bang account as the {ORDINAL[reveal]} reveal of its The Aspirants cosplay photos.",
    }


# ---------------------------------------------------------------------------------------------
# Pictures
# ---------------------------------------------------------------------------------------------


def mirror_has(key: str) -> bool:
    return (common.LIB_ROOT / key).is_file()


def img_from_mirror(base: str, size: dict[str, Any]) -> dict[str, Any]:
    """The LibImage of a picture that is already in the mirror (what image_set returned when it was made).

    The size and color are kept in curation: `.meta.json` is not synced to R2, so a mirror rebuilt
    by `r2.py restore` does not have it."""
    img = {"t": f"{base}/t.webp", "p": f"{base}/p.webp", "f": f"{base}/f.webp", "w": size["w"], "h": size["h"], "c": size["c"]}
    for k in ("t", "p", "f"):
        if not mirror_has(img[k]):
            fail(f"{img[k]} is not in the mirror")
    from PIL import Image

    with Image.open(common.LIB_ROOT / img["f"]) as im:
        if im.size != (img["w"], img["h"]):
            fail(f"{img['f']} is {im.size}, curation says {(img['w'], img['h'])}")
    return img


def new_image(src: Path, slug: str) -> dict[str, Any]:
    """A photo that is not in R2 yet: one new key under arts/v2/cosplay/."""
    return common.image_set(src, f"arts/v2/cosplay/{slug}", full_max=3840, q_full=88, q_small=80)


# ---------------------------------------------------------------------------------------------
# Cosplay
# ---------------------------------------------------------------------------------------------


def build_cosplay(cur: dict[str, Any], old: dict[str, Any] | None) -> dict[str, Any]:
    posts = load_posts()

    # Every photo of the source folder has an entry, either shown or left out with a reason.
    on_disk = {f.relative_to(common.MEDIA).as_posix() for f in COSPLAY_DIR.rglob("*") if f.is_file() and f.suffix.lower() in IMG_EXT}
    listed = {p["src"] for p in cur["photos"]}
    left = {x["src"] for x in cur["left_out"]}
    if on_disk - listed - left:
        fail("photos with no entry in curation: " + ", ".join(sorted(on_disk - listed - left)))
    if listed - on_disk:
        fail("curation lists photos that are not on disk: " + ", ".join(sorted(listed - on_disk)))

    old_by_src: dict[str, dict[str, Any]] = {}
    if old:
        for it in old["items"]:
            if it["kind"] == "cosplay":
                old_by_src[it["src"][0]] = it

    items: list[dict[str, Any]] = []
    moved: list[tuple[str, str]] = []
    for p in cur["photos"]:
        src = common.MEDIA / p["src"]
        m = re.search(r"instagram_p_(.+?) \((\d+)\)\.\w+$", p["src"])
        if not m:
            fail("cannot read the post and number from " + p["src"])
        code, n = m.group(1), int(m.group(2))
        post = posts.get(f"ig:{code}")
        if post is None:
            fail(f"post ig:{code} is not in the captions index: the photo cannot be credited")
        reveal = reveal_of(post["caption"])
        chars = order_chars(p["chars"])
        sha = common.sha1_file(src)

        names = " and ".join(dict(ROSTER)[c] for c in chars)
        slug = "-".join(chars) if len(chars) == 1 else "-and-".join(chars)
        iid = f"arts-cosplay-{slug}-photo-{n}-{sha[:6]}"
        if len(p["title"].split()) > 6:
            fail("title is longer than 6 words: " + p["title"])
        if p["title"].split(",")[0] != names:
            fail(f"title does not start with {names}: {p['title']}")

        if "img_base" in p:
            img = img_from_mirror(p["img_base"], p["img_size"])
        else:
            img = new_image(src, f"{slug}-photo-{n}-{sha[:6]}")

        # The earlier Fanart data holds the same photo: its picture and credit must be the ones used here.
        credit = credit_for(post, reveal)
        prev = old_by_src.get(p["src"])
        if prev is not None:
            if prev["img"] != img:
                fail(f"picture of {p['src']} differs from fanart.json")
            for k in ("by", "platform", "url", "date"):
                if prev["credit"].get(k) != credit[k]:
                    fail(f"credit {k} of {p['src']} differs from fanart.json: {prev['credit'].get(k)!r} and {credit[k]!r}")
            moved.append((prev["id"], iid))

        pair = common.pair_of_char(chars[0]) if len({common.pair_of_char(c) for c in chars}) == 1 else None
        items.append({
            "id": iid,
            "title": p["title"],
            "collection": "arts",
            "room": "cosplay",
            "chars": chars,
            "pair": pair,
            "canon": "fan",
            "tags": ["cosplay", "photo", "duo" if len(chars) > 1 else "solo"],
            "places": chars,
            "alt": p["alt"],
            "img": img,
            "credit": credit,
            "date": credit["date"],
            "reveal": reveal,
            "photo": n,
        })

    if old:
        missing = [s for s in old_by_src if s not in listed]
        if missing:
            fail("cosplay items of fanart.json that curation does not list: " + ", ".join(missing))

    items.sort(key=lambda i: (i["date"], i["photo"]))
    ids = [i["id"] for i in items]
    if len(ids) != len(set(ids)):
        fail("duplicate ids")

    characters = cosplay_characters(items)
    return {"v": 1, "slug": "arts-cosplay", "room": "cosplay", "characters": characters, "items": items, "_moved": moved}


def cosplay_characters(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = collections.Counter(c for i in items for c in i["chars"])
    characters = [{"slug": s, "name": n, "pair": common.pair_of_char(s), "count": counts.get(s, 0)} for s, n in ROSTER]
    if sum(c["count"] for c in characters) != sum(len(i["chars"]) for i in items):
        fail("character counts do not add up")
    return characters


# ---------------------------------------------------------------------------------------------
# Fanart
# ---------------------------------------------------------------------------------------------


def build_fanart(old: dict[str, Any]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    moved: list[str] = []
    for it in old["items"]:
        if it["kind"] == "cosplay":
            moved.append(it["id"])
            continue
        it = dict(it)
        it["collection"] = "arts"  # the only field changed, in place
        items.append(it)
    ids = [i["id"] for i in items]
    if len(ids) != len(set(ids)):
        fail("duplicate fanart ids")

    # Every picture and film of the fanart items is in the mirror.
    for it in items:
        keys = [it["img"][k] for k in ("t", "p", "f")]
        if "video" in it:
            keys += [it["video"]["src"], it["video"]["poster"]]
        for k in keys:
            if not mirror_has(k):
                fail(f"{it['id']}: {k} is not in the mirror")

    artists, characters = fanart_head(items)
    return {"v": 1, "slug": "arts-fanart", "room": "fanart", "artists": artists, "characters": characters, "items": items, "_moved": moved}


def fanart_head(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    # By artist. `key` is the item's own `artist` (lower case handle), `name` is how the credit spells it.
    by_artist: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    unknown = 0
    for it in items:
        if it["artist"]:
            by_artist[it["artist"]].append(it)
        else:
            unknown += 1
    artists = []
    for key, group in by_artist.items():
        spelled = collections.Counter(g["credit"].get("by") for g in group if g["credit"].get("by"))
        name = spelled.most_common(1)[0][0] if spelled else key
        artists.append({"name": name, "count": len(group), "key": key})
    artists.sort(key=lambda a: (-a["count"], a["name"].lower()))
    # Pieces with no single credited artist (group posts, official reels, unnamed work) close the list.
    if unknown:
        artists.append({"name": "Unknown", "count": unknown, "key": None})

    counts = collections.Counter(c for it in items for c in it["chars"])
    characters = [{"slug": s, "count": counts[s]} for s in sorted(counts, key=lambda s: (-counts[s], ORDER.index(s)))]
    return artists, characters


def merge_intake(cos: dict[str, Any], fan: dict[str, Any]) -> tuple[int, int]:
    """Add the items of intake.py: cosplay photos after the others, and the fan art pictures and clips (the clips
    of cosplayers too: the Cosplay room holds photos, the video row of Fanart holds clips)."""
    if not INTAKE.exists():
        return 0, 0
    data = json.loads(INTAKE.read_text(encoding="utf-8"))
    have = {i["id"] for i in cos["items"]} | {i["id"] for i in fan["items"]}
    new_ids = [i["id"] for i in data["cosplay"] + data["fanart"]]
    if have & set(new_ids) or len(new_ids) != len(set(new_ids)):
        fail("an intake id is already used")
    for it in data["cosplay"] + data["fanart"]:
        keys = [it["img"][k] for k in ("t", "p", "f")]
        if "video" in it:
            keys.append(it["video"]["src"])
        for k in keys:
            if not mirror_has(k):
                fail(f"{it['id']}: {k} is not in the mirror")
    cos["items"] = cos["items"] + data["cosplay"]
    cos["characters"] = cosplay_characters(cos["items"])
    fan["items"] = fan["items"] + data["fanart"]
    fan["artists"], fan["characters"] = fanart_head(fan["items"])
    return len(data["cosplay"]), len(data["fanart"])


# ---------------------------------------------------------------------------------------------


def mirror_bytes(folder: str) -> int:
    root = common.LIB_ROOT / folder
    return sum(f.stat().st_size for f in root.rglob("*") if f.is_file()) if root.exists() else 0


def main() -> None:
    cur = json.loads(CURATION.read_text(encoding="utf-8"))
    old = json.loads(OLD_FANART.read_text(encoding="utf-8")) if OLD_FANART.exists() else None
    before = mirror_bytes("arts/v2/cosplay")

    cos = build_cosplay(cur, old)
    moved_pairs = cos.pop("_moved")
    fan = None
    if old is not None:
        fan = build_fanart(old)
        gone = fan.pop("_moved")
        if sorted(gone) != sorted(a for a, _ in moved_pairs):
            fail("the cosplay items taken out of fanart.json are not the ones moved to cosplay")
        added = merge_intake(cos, fan)
        print("intake:", added[0], "cosplay photos,", added[1], "fan art pictures and clips")
    common.write_json("arts-cosplay", cos)

    print("cosplay items:", len(cos["items"]))
    for c in cos["characters"]:
        print(f"  {c['name']:<10} {c['count']}")
    if moved_pairs:
        print("old id to new id:")
        for a, b in moved_pairs:
            print(f"  {a} -> {b}")

    if old is None:
        print("fanart.json is gone: arts-fanart.json is now the source and is left as it is")
    else:
        assert fan is not None
        common.write_json("arts-fanart", fan)
        kinds = collections.Counter(i["kind"] for i in fan["items"])
        print("fanart items:", len(fan["items"]), dict(kinds), "moved to cosplay:", len(gone))
        print("artists:", len(fan["artists"]), "; unknown:", next((a["count"] for a in fan["artists"] if a["key"] is None), 0))
        print("characters:", {c["slug"]: c["count"] for c in fan["characters"]})

    print("mirror bytes written under arts/v2/cosplay:", common.human(mirror_bytes("arts/v2/cosplay") - before))


if __name__ == "__main__":
    main()
