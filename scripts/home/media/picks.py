"""The picks of the home page: every data file the page reads, resolved and measured, in one JSON.

    C:/Users/muham/anaconda3/python.exe scripts/home/media/picks.py            write public/data/home/picks.json
    C:/Users/muham/anaconda3/python.exe scripts/home/media/picks.py --sheet    also write the looking sheets

Run the other scripts of this folder first (cards, logo, previews, loops, voices): this one reads what they
wrote (sizes, durations) and fails when a file is missing. Nothing is typed by hand into the JSON; the library data
is the source and a pick is an id. Official pictures only in the hero, the wall and the spiral. Never edit the output.

Writes   apps/web/public/data/home/picks.json     (the shape is described in docs/design/home/media.md)

Library keys (`lib`) are paths under library/v1/ in the bucket (`libUrl(key)` makes the address). Repo paths
(`repo`) are paths under apps/web/public/ and start with a slash.

The corner mark. Eleven of the official 16:9 pictures carry the "MOBILE LEGENDS BANG BANG" mark in the top left
corner (the p and f variants too: it is in the art). `clean` is a 16:9 window, as fractions of the whole picture,
that leaves the mark out; cards, the wall and the spiral show `clean`, the preview window shows the whole picture.
"""

from __future__ import annotations

import random
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

import hcommon as h
import loops as L
import previews as P

SPLASH = h.library_data("arts-splash")
SPLASH_BY_ID = {i["id"]: i for i in SPLASH["items"]}
SINGLES = {slug: next(i["id"] for i in SPLASH["items"] if i["canon"] == "official" and i["chars"] == [slug] and i["id"].endswith(suffix))
           for slug, suffix in (("fanny", "a4bc10"), ("layla", "f5d919"), ("ruby", "753f93"), ("angela", "64810d"), ("lesley", "62d7fb"),
                                ("change", "1ca07f"), ("guinevere", "915d8d"), ("vexana", "6a1b9d"), ("selena", "0f1095"), ("obsidia", "20fc59"))}
DUOS_HERO = [
    "arts-splash-fanny-layla-fighting-together-b306c0", "arts-splash-fanny-layla-blue-sky-50c9d9",
    "arts-splash-guinevere-vexana-splash-20e865", "arts-splash-guinevere-vexana-fighting-moment-15320e",
    "arts-splash-guinevere-vexana-fighting-stance-fcfe98",
]
# The key art of Fanny and Layla carries the series' own title ("THE ASPIRANTS") at the top left, which would
# compete with the big logo of the hero: it is in the wall (where the section says the same words) and not in the hero.
KEY_ART = "arts-splash-fanny-layla-key-art-542b49"
PHOTO_FRAME = "arts-splash-aspirants-on-a-photo-frame-76edb2"  # all ten, 16:9 by its `frame`
FIST = "arts-splash-guinevere-raises-a-fist-9fa979"  # one Guinevere, 16:9 by its `frame`

# Pictures whose top left corner holds the game's mark (read off the pictures: corners.jpg in the notes).
MARKED = {i for i in SINGLES.values() if not i.endswith(("0f1095", "20fc59"))} | {
    "arts-splash-guinevere-vexana-splash-20e865", "arts-splash-guinevere-vexana-fighting-moment-15320e",
    "arts-splash-guinevere-vexana-fighting-stance-fcfe98",
}
# The mark and its line "BANG BANG" fill x 0.02 to 0.125 and y 0.035 to 0.108 of the picture (measured on f).
# A 16:9 window of 0.87 of the picture, flush right and top, starts at x 0.13: the mark is out, the head room stays.
CLEAN_SCALE = 0.87
MARK_RIGHT = 0.125


def pic_size(key: str) -> tuple[int, int]:
    with Image.open(h.MIRROR / key) as im:
        return im.size


def frac(x: float) -> float:
    return round(x, 4)


def clean_window(item: dict[str, Any]) -> dict[str, float]:
    """A 16:9 window (fractions of the whole picture) with no corner mark."""
    fr = item["frame"]
    if item["id"] in MARKED:
        s = CLEAN_SCALE
        return {"x": frac(1 - s), "y": 0.0, "w": s, "h": s}
    return {k: frac(fr[k]) for k in ("x", "y", "w", "h")}


def splash_pic(item_id: str) -> dict[str, Any]:
    it = SPLASH_BY_ID[item_id]
    if it["canon"] != "official":
        raise SystemExit(f"{item_id}: not official art")
    img = it["img"]
    pw, ph = pic_size(img["p"])
    rec = {
        "id": it["id"], "title": it["title"], "alt": it["alt"], "chars": it["chars"], "pair": it["pair"],
        "lib": {"t": img["t"], "p": img["p"], "f": img["f"]},
        "p": {"w": pw, "h": ph, "bytes": (h.MIRROR / img["p"]).stat().st_size},
        "f": {"w": img["w"], "h": img["h"], "bytes": (h.MIRROR / img["f"]).stat().st_size},
        "frame": {k: frac(it["frame"][k]) for k in ("x", "y", "w", "h")},
        "focus": it["focus"], "clean": clean_window(it), "marked": it["id"] in MARKED,
    }
    cw = rec["clean"]
    ratio = cw["w"] * pw / (cw["h"] * ph)
    if abs(ratio - 16 / 9) > 0.02:
        raise SystemExit(f"{item_id}: the clean window is {ratio:.3f}, not 16:9")
    return rec


# --- the hero -------------------------------------------------------------------------------------------------------


def hero() -> dict[str, Any]:
    singles = [splash_pic(SINGLES[s]) for s in ("fanny", "ruby", "lesley", "guinevere", "selena", "layla", "angela", "change", "vexana", "obsidia")]
    groups = [splash_pic(i) for i in DUOS_HERO] + [splash_pic(PHOTO_FRAME)]
    cards = []
    for slug in h.CHARS:
        path = h.IMG / "cards" / f"{slug}-45.webp"
        with Image.open(path) as im:
            w, hh = im.size
        art = SPLASH_BY_ID[SINGLES[slug]]
        cards.append({"id": slug, "chars": [slug], "repo": h.public_path(path), "w": w, "h": hh, "bytes": path.stat().st_size,
                      "focus": art["focus"], "alt": art["alt"],
                      "source": "cropped by the owner (4:5, the corner mark is out)" if slug not in ("obsidia", "selena")
                      else "cut by scripts/home/media/cards.py from the 2560 wide art, centred on the character"})
    # Eight more official stills cut by hero_cards.py, so the hero's eighteen cards are all different.
    more = h.read_json(h.DATA / "hero-cards.json")["cards"]
    for c in more:
        if not (h.PUBLIC / c["repo"].lstrip("/")).exists():
            raise SystemExit(f"{c['id']}: file missing, run hero_cards.py first")
    cards.extend(more)
    return {
        "note": "wide: 10 single and 6 group pictures, all official, 16:9 by `clean` (the shared `p` of the wall, no new file). "
                "portrait: ten 4:5 cards, one for each Aspirant, then eight more official stills cut to 4:5 (hero_cards.py), new files.",
        "wide": {"single": singles, "group": groups}, "portrait": cards,
    }


# --- the wall -------------------------------------------------------------------------------------------------------


def wall_order(ids: list[str]) -> list[str]:
    """A cyclic order of the 18 pictures: no two neighbours of the same pair, none of the same Aspirant, and the same
    for the pictures six and twelve places apart (the rows of three that start six places apart)."""
    def pair(i: str) -> str:
        return SPLASH_BY_ID[i]["pair"] or "all"

    def chars(i: str) -> set[str]:
        return set(SPLASH_BY_ID[i]["chars"])

    def ok(a: str, b: str) -> bool:
        if pair(a) == pair(b):
            return False
        if "all" in (pair(a), pair(b)):
            return True
        return not (chars(a) & chars(b))

    n = len(ids)
    rng = random.Random(1811)
    for _ in range(200000):
        order = ids[:]
        rng.shuffle(order)
        if all(ok(order[i], order[(i + 1) % n]) and ok(order[i], order[(i + 6) % n]) and ok(order[i], order[(i + 12) % n]) for i in range(n)):
            return order
    raise SystemExit("no wall order found")


def wall() -> dict[str, Any]:
    official = [i["id"] for i in SPLASH["items"] if i["canon"] == "official"]
    if len(official) != 18:
        raise SystemExit(f"expected 18 official pictures, found {len(official)}")
    # a stable base order (the room's own), then the search
    order = wall_order(official)
    return {
        "note": "the 18 official pictures of the Splash art room in one cyclic order. Neighbours (and the pictures 6 and 12 places "
                "apart, for three rows that start 6 places apart) never share a pair or an Aspirant. Cards show `clean`; the "
                "two pictures that are not 16:9 are cut by `frame`/`clean` (no file is made).",
        "order": [splash_pic(i) for i in order],
    }


def spiral() -> list[dict[str, Any]]:
    return [splash_pic(SINGLES[s]) for s in h.CHARS]


# --- the fan art ----------------------------------------------------------------------------------------------------


def fanart() -> dict[str, Any]:
    data = h.library_data("arts-fanart")
    sel = [i for i in data["items"] if i.get("kind") == "image" and len(i.get("chars", [])) >= 3 and (i.get("credit") or {}).get("by")]
    if len(sel) != 15:
        print(f"WARNING: {len(sel)} credited group pictures, the brief says 15")
    items = []
    for it in sel:
        c = it["credit"]
        img = it["img"]
        sizes = {k: (h.MIRROR / img[k]).stat().st_size for k in ("t", "p", "f")}
        items.append({
            "id": it["id"], "title": it["title"], "alt": f"Fan art: {it['title']}", "chars": it["chars"],
            "canon": it["canon"], "badge": "Fan work",
            "credit": {"by": c["by"], "platform": c.get("platform"), "url": c.get("url"), "date": c.get("date")},
            "artistLink": c["by"], "creditLine": f"{c['by']}" + (f" on {c['platform']}" if c.get("platform") else ""),
            "lib": {"t": img["t"], "p": img["p"], "f": img["f"]}, "w": img["w"], "h": img["h"], "color": img["c"], "bytes": sizes,
            "report": {"item": it["id"], "title": it["title"]},
        })
    return {
        "note": "Fan work, shown with its credit. Where a picture is shown as content use CanonBadge (canon \"fan\" prints \"Fan work\") "
                "and CreditLine (features/library/shell/credit.tsx: `<by> on <platform>` and a \"View the original\" link from "
                "credit.url). On hover over a floating picture show the badge and the credit line. The section carries one small "
                "ReportLink (features/legal/takedown/report-link.tsx, \"Copyright or takedown\") for the section and one in the "
                "preview of a picture (item = {id, title}). `artistLink` is the text of the credit's link, which is the artist's "
                "own name as the post gives it. Two group pictures with no named artist (fanart-4f2cc3ba, fanart-e5d39833) are left out.",
        "items": items,
    }


# --- music, comics, archive, logos ----------------------------------------------------------------------------------


def music() -> list[dict[str, Any]]:
    out = []
    for it in h.library_data("music")["items"]:
        disc = h.MIRROR / it["disc"]
        with Image.open(disc) as im:
            dw, dh = im.size
        cover = it["cover"]
        jacket = None
        if "p" in cover:
            jacket = {"lib": {"t": cover["t"], "p": cover["p"]}, "bytes": (h.MIRROR / cover["p"]).stat().st_size}
        out.append({
            "id": it["id"], "title": it["title"], "ep": it["ep"], "released": it["released"], "chars": it["chars"], "credits": it["credits"],
            "audio": {"lib": it["src"], "d": it["dur"], "bytes": (h.MIRROR / it["src"]).stat().st_size},
            "disc": {"lib": it["disc"], "w": dw, "h": dh, "bytes": disc.stat().st_size},
            "jacket": jacket, "site": cover.get("site"), "color": cover.get("c"),
        })
    return out


def comics() -> list[dict[str, Any]]:
    data = h.library_data("comic")
    stage = data["stage"]
    spec = [("comic-the-aspirant", "The Aspirants", ("as-", "fl-")), ("comic-guinevere-vexana", "Vexana & Guinevere", ("gv-",))]
    out = []
    for cid, owner_title, prefixes in spec:
        c = next(i for i in data["items"] if i["id"] == cid)
        cov = c["cover"]
        out.append({
            "id": cid, "title": owner_title, "dataTitle": c["title"], "slug": c["slug"], "route": f"/collection/comic/{c['slug']}/",
            "pages": c["total"], "canon": c["canon"],
            "cover": {"lib": {"t": cov["t"], "p": cov["p"], "f": cov["f"]}, "w": cov["w"], "h": cov["h"], "color": cov["c"],
                      "bytes": (h.MIRROR / cov["p"]).stat().st_size},
            "panels": [{"id": k, "lib": v["p"], "w": v["w"], "h": v["h"], "color": v["c"], "at": v["at"], "note": v["note"],
                        "bytes": (h.MIRROR / v["p"]).stat().st_size} for k, v in stage["panels"].items() if k.startswith(prefixes)],
            "chibi": [{"id": k, "lib": v["src"], "w": v["w"], "h": v["h"], "bytes": (h.MIRROR / v["src"]).stat().st_size}
                      for k, v in stage["chibi"].items() if k.startswith(prefixes)],
        })
    return out


def own_routes() -> set[str]:
    base = h.REPO / "apps" / "web" / "src" / "app" / "collection"
    own = {p.name for p in base.iterdir() if p.is_dir() and not p.name.startswith("[")}
    page = (base / "[slug]" / "page.tsx").read_text(encoding="utf-8")
    return own | {"music", "models", "others"} if "COLLECTION_SLUGS" in page else own


def archive() -> list[dict[str, Any]]:
    import re

    src = (h.REPO / "apps" / "web" / "src" / "features" / "library" / "registry.ts").read_text(encoding="utf-8")
    counts = h.library_data("index")["counts"]
    rooms = []
    routes = own_routes()
    for m in re.finditer(r"\{\s*slug: \"(\w+)\",\s*index: \"(\d+)\",\s*name: \"([^\"]+)\",\s*tagline: \"([^\"]+)\",\s*line: \"([^\"]+)\",\s*colour: \"(#\w+)\",\s*ink: \"(#\w+)\",\s*cover: \"([^\"]+)\"", src):
        slug, index, name, tagline, line, colour, ink, cover = m.groups()
        if slug not in routes:
            raise SystemExit(f"/collection/{slug} has no route")
        cpath = h.MIRROR / cover
        with Image.open(cpath) as im:
            cw, ch = im.size
        rooms.append({"slug": slug, "index": index, "name": name, "tagline": tagline, "line": line, "colour": colour, "ink": ink,
                      "route": f"/collection/{slug}", "count": counts[slug], "cover": {"lib": cover, "w": cw, "h": ch, "bytes": cpath.stat().st_size}})
    if len(rooms) != 10:
        raise SystemExit(f"read {len(rooms)} rooms from registry.ts, expected 10")
    return rooms


def logos() -> dict[str, Any]:
    def rec(path: Path) -> dict[str, Any]:
        with Image.open(path) as im:
            w, hh = im.size
        return {"repo": h.public_path(path), "w": w, "h": hh, "bytes": path.stat().st_size}

    return {
        "mlbb": {**rec(h.IMG / "mlbb.webp"), "note": "the owner's raster, 555 by 167, lossless. Show it at 270 CSS px wide or less (sharp at 2x); a crisp "
                                                       "larger size needs a bigger or vector source"},
        "themlabel": {**rec(h.PUBLIC / "img" / "about" / "themlabel.webp"), "note": "grey letters, for the light page (the existing file of /about)"},
        "themlabelDark": {**rec(h.PUBLIC / "img" / "about" / "mlabel" / "logo.webp"), "note": "light letters, for dark grounds (the existing file of /about)"},
    }


# --- the trailer, the previews, the loops ----------------------------------------------------------------------------


def clock(seconds: float) -> str:
    total = round(seconds)
    return f"{total // 60:02d}:{total % 60:02d}"


# The strip plays the whole trailer, streamed from the library's own file (round two, 19 Nov 2026). It rests on a chosen
# moment: the wide shot of Selena on the ledge with the silver dragon (the cut is at 11.67 s). The film's own opening is a
# dark hall with a subtitle for four seconds, which is a poor first frame. The loop goes from the end back to this moment.
TRAILER_START = 11.7
# The seconds of the film the loading bar waits for (buffered from TRAILER_START). The rest streams while it plays.
TRAILER_WARM_SECONDS = 6


def trailer() -> dict[str, Any]:
    film_id = P.film_items()[0]["id"]
    film = next(i for i in h.library_data("video-films")["items"] if i["id"] == film_id)
    v = film["video"]
    repo_copy = h.PUBLIC / "video" / "selena-obsidia" / "trailer.mp4"
    return {
        "note": "The strip and its window play the library's whole film (`film.lib.video`, H.264 faststart, range requests) in a streamed "
                "<video> that buffers seconds ahead: never held whole. The picture is 1920x808 (2.376 to 1) and the window takes that shape, "
                "no crop. It rests at `start` and loops there. The loading bar waits for `warm.seconds` of it.",
        "film": {
            "id": film_id, "title": film["title"], "date": film["date"], "href": f"/collection/video/films?i={film_id}",
            "lib": {"video": v["src"], "poster": v["poster"], "thumb": film["thumb"]}, "w": v["w"], "h": v["h"],
            "aspect": round(v["w"] / v["h"], 4), "dur": v["dur"], "durLabel": clock(v["dur"]), "fps": film.get("fps"),
            "bytes": film["bytes"], "start": TRAILER_START,
            "warm": {"seconds": TRAILER_WARM_SECONDS, "bytes": round(film["bytes"] * TRAILER_WARM_SECONDS / v["dur"])},
            "smallerCopy": {"repo": "/video/selena-obsidia/trailer.mp4", "w": 1280, "h": 540, "bytes": repo_copy.stat().st_size,
                            "vtt": "/video/selena-obsidia/trailer.vtt", "note": "the repo's own 23 MB stream of the same film"},
            "note": "\"Play Films\": open the library's film in the site's player (PlayerOverlay). The strip's own element streams the same file.",
        },
    }


def previews() -> list[dict[str, Any]]:
    out = []
    for n, film in enumerate(P.film_items()):
        mp4 = P.OUT_DIR / f"{film['id']}.mp4"
        webp = mp4.with_suffix(".webp")
        info = h.probe(mp4)
        out.append({
            "n": n, "id": film["id"], "title": film["title"], "chars": film["chars"], "pair": film["pair"], "date": film.get("date"),
            "href": f"/collection/video/films?i={film['id']}", "start": P.STARTS[film["id"]],
            "video": {"repo": h.public_path(mp4), "w": info["w"], "h": info["h"], "aspect": round(info["w"] / info["h"], 4), "dur": round(info["dur"], 2), "fps": round(info["fps"]), "bytes": mp4.stat().st_size},
            "poster": {"repo": h.public_path(webp), "bytes": webp.stat().st_size}, "color": film["c"],
        })
    return out


def loops() -> list[dict[str, Any]]:
    out = []
    for n, spec in enumerate(L.LOOPS):
        slug = spec["slug"]
        rec: dict[str, Any] = {"n": n, "slug": slug, "name": spec["name"], "kind": spec["kind"]}
        if spec["kind"] == "still":
            art = SPLASH_BY_ID[spec["art"]]
            card = h.IMG / "cards" / f"{slug}-45.webp"
            rec.update({
                "full": {"w": L.STILL_FULL[0], "h": L.STILL_FULL[1], "lib": art["img"]["f"], "bytes": (h.MIRROR / art["img"]["f"]).stat().st_size,
                         "note": "the library's own art; the page gives a still a slow push"},
                "window": L.window(spec, L.STILL_FULL),
                "poster45": {"repo": h.public_path(card), "w": 960, "h": 1200, "bytes": card.stat().st_size},
                "video": None, "alt": art["alt"],
            })
        else:
            video = h.VIDEO / "loops" / f"{slug}.mp4"
            info = h.probe(video)
            p45, pfull = h.IMG / "loops" / f"{L.poster_stem(spec)}.webp", h.IMG / "loops" / f"{slug}-full.webp"
            rec.update({
                "video": {"repo": h.public_path(video), "w": info["w"], "h": info["h"], "dur": round(info["dur"], 3), "fps": round(info["fps"]),
                          "bytes": video.stat().st_size, "loop": "seamless: ping-pong" if spec["kind"] == "pingpong" else "seamless: the site's idle loop"},
                "window": L.window(spec, (info["w"], info["h"])),
                "poster45": {"repo": h.public_path(p45), "w": 640, "h": 800, "bytes": p45.stat().st_size},
                "posterFull": {"repo": h.public_path(pfull), "bytes": pfull.stat().st_size},
            })
        out.append(rec)
    return out


# --- the loading plan -----------------------------------------------------------------------------------------------


def total(*sizes: int) -> int:
    return sum(sizes)


def loading(parts: dict[str, Any]) -> dict[str, Any]:
    """What to wait for and what to defer, by the sizes of the files (the design's section 6)."""
    wall_p = sum(p["p"]["bytes"] for p in parts["wall"]["order"])
    cards = sum(c["bytes"] for c in parts["hero"]["portrait"])
    warm = parts["trailer"]["film"]["warm"]
    waited = {
        "hero portrait cards (10)": cards,
        "wall and hero wide pictures, p (18, shared by the hero, the wall and the spiral)": wall_p,
        f"the trailer's first {warm['seconds']} s (streamed, buffered before the page opens)": warm["bytes"],
        "logos (MLBB, TheMLabel)": parts["logos"]["mlbb"]["bytes"] + parts["logos"]["themlabel"]["bytes"],
    }
    music_b = sum(m["disc"]["bytes"] + (m["jacket"]["bytes"] if m["jacket"] else 0) for m in parts["music"])
    deferred = {
        "preview clips (10) and posters": sum(p["video"]["bytes"] + p["poster"]["bytes"] for p in parts["previews"]),
        "character loops (4 videos) and posters": sum(l["video"]["bytes"] + l["poster45"]["bytes"] + l["posterFull"]["bytes"] for l in parts["loops"] if l["video"]),
        "stills of the list (the library's f, 5: Fanny, Guinevere, Layla, Ruby, Vexana)": sum(l["full"]["bytes"] for l in parts["loops"] if l["kind"] == "still"),
        "voice lines (80 clips)": sum((h.MIRROR / r["key"]).stat().st_size for c in parts["voices"]["characters"] for r in c["lines"].values()),
        "music discs and jackets (7)": music_b,
        "comic panels, stickers and covers (2 comics)": sum(c["cover"]["bytes"] + sum(p["bytes"] for p in c["panels"]) + sum(p["bytes"] for p in c["chibi"]) for c in parts["comics"]),
        "fan art, thumbnails t (15)": sum(f["bytes"]["t"] for f in parts["fanart"]["items"]),
        "archive covers (10)": sum(r["cover"]["bytes"] for r in parts["archive"]),
        "full size pictures for the preview window f (18, on hover or press)": sum(p["f"]["bytes"] for p in parts["wall"]["order"]),
    }
    on_demand = {
        "music audio (7 tracks, streamed on pick)": sum(m["audio"]["bytes"] for m in parts["music"]),
        "fan art p (15, on hover) and f (on press)": sum(f["bytes"]["p"] + f["bytes"]["f"] for f in parts["fanart"]["items"]),
        "the whole trailer (streamed while it plays, never held whole; also the film of Play Films)": parts["trailer"]["film"]["bytes"],
    }
    return {
        "note": "bytes of the files; `waited` is what the loading bar waits for before the page opens, `deferred` loads in the background after "
                "it, by section order, `onDemand` is streamed or fetched on a press. The 3D models and the code chunks are not here.",
        "waited": waited, "waitedBytes": sum(waited.values()), "deferred": deferred, "deferredBytes": sum(deferred.values()),
        "onDemand": on_demand,
    }


# --- the looking sheet ----------------------------------------------------------------------------------------------


def clean_sheet(parts: dict[str, Any]) -> None:
    """Each 16:9 card as the page shows it (`clean`), with the corner enlarged, to see that the mark is out."""
    tiles = []
    seen = set()
    for rec in parts["hero"]["wide"]["single"] + parts["hero"]["wide"]["group"] + parts["wall"]["order"]:
        if rec["id"] in seen:
            continue
        seen.add(rec["id"])
        im = Image.open(h.MIRROR / rec["lib"]["p"]).convert("RGB")
        c = rec["clean"]
        box = (round(c["x"] * im.width), round(c["y"] * im.height), round((c["x"] + c["w"]) * im.width), round((c["y"] + c["h"]) * im.height))
        t = im.crop(box).resize((384, 216), Image.LANCZOS)
        ImageDraw.Draw(t).text((4, 4), rec["id"][12:34] + (" *" if rec["marked"] else ""), fill=(255, 255, 0))
        tiles.append(t)
    cols = 5
    s = Image.new("RGB", (cols * 388, ((len(tiles) + cols - 1) // cols) * 220), (14, 14, 14))
    for i, t in enumerate(tiles):
        s.paste(t, ((i % cols) * 388, (i // cols) * 220))
    s.save(h.WORK / "clean-sheet.jpg", quality=86)


def main() -> None:
    parts: dict[str, Any] = {}
    parts["hero"] = hero()
    parts["wall"] = wall()
    parts["spiral"] = spiral()
    parts["fanart"] = fanart()
    parts["music"] = music()
    parts["comics"] = comics()
    parts["archive"] = archive()
    parts["logos"] = logos()
    parts["trailer"] = trailer()
    parts["previews"] = previews()
    parts["loops"] = loops()
    voices = h.read_json(h.DATA / "voices.json")
    parts["voices"] = voices
    obj = {
        "v": 1, "libraryVersion": h.common.VERSION,
        "hero": parts["hero"], "wall": parts["wall"], "spiral": parts["spiral"], "fanart": parts["fanart"], "music": parts["music"],
        "comics": parts["comics"], "archive": parts["archive"], "logos": parts["logos"], "trailer": parts["trailer"],
        "previews": parts["previews"], "loops": parts["loops"], "voices": {"file": "/data/home/voices.json", "count": 80},
    }
    obj["loading"] = loading(parts)
    h.write_json("picks", obj)
    ld = obj["loading"]
    print(f"waited {ld['waitedBytes'] / 1e6:.2f} MB, deferred {ld['deferredBytes'] / 1e6:.2f} MB")
    for k, v in ld["waited"].items():
        print(f"  waited   {v / 1e6:6.2f} MB  {k}")
    for k, v in ld["deferred"].items():
        print(f"  deferred {v / 1e6:6.2f} MB  {k}")
    for k, v in ld["onDemand"].items():
        print(f"  on demand {v / 1e6:6.2f} MB  {k}")
    order = [f"{p['chars'][0] if len(p['chars']) == 1 else p['pair'] or 'all'}" for p in obj["wall"]["order"]]
    print("wall order:", " ".join(order))
    if "--sheet" in sys.argv:
        clean_sheet(parts)


if __name__ == "__main__":
    main()
