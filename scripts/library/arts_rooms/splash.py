"""Splash art, the first sub-page of Official arts (/collection/arts).

Reads curation/splash.json (the decisions made by looking at every picture), makes the three WebP
sizes of each kept picture in the mirror (arts/v2/splash/<id>/t|p|f.webp, the WHOLE picture, never
cropped) and writes apps/web/public/data/library/arts-splash.json.

Two groups (head field "groups"): "official" (skin splash arts, art of a pair, a group or a post) and
"site" (pictures of a splash-art folder that an image generator made: canon fan, the credit Made for
this site, never official). The official ones come first, the site ones after, each group by pair.

Run:  C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/splash.py

What it checks, and stops on:
- every different picture the catalog puts in the splash room is in "keep" or "moved" (none is left out
  by accident), and every "moved" source file still has the hash that was looked at;
- the window of every kept picture is 16:9 (frame x, y, w, h are fractions of the whole picture) and
  at least min_window_width px wide, so nothing is upscaled to fill a section; the focus point sits in
  the middle 80 percent of the window (the part the page shows at rest);
- a "site" picture is generated (its PNG carries an image generator content credential), an "official" one is not,
  and a site line says in one sentence that the picture is not official art;
- the release date of each pair matches the official post in media/_captions/captions.json;
- the written WebP files carry no metadata (no XMP, no design tool name, no content credential).

It also writes contact sheets to D:\\ren\\aspirant-work\\arts_rooms\\sheets\\splash\\: the 16:9 windows
with the middle 80 percent drawn in green (final_windows_N.jpg) and the narrow 9:16 window around each
focus point (final_focus_N.jpg).
Run it again at any time: pictures that are fresh are skipped and the data file is rewritten the same.
"""

from __future__ import annotations

import json
import math
import re
import struct
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import captions  # noqa: E402
import catalog  # noqa: E402
import common  # noqa: E402

ROOM = "splash"
SLUG = f"arts-{ROOM}"
BASE = "arts/v2/splash"
CUR = Path(__file__).resolve().parent / "curation" / f"{ROOM}.json"
SHEETS = common.WORK / "arts_rooms" / "sheets" / ROOM
RATIO = 16 / 9
PORTRAIT = 9 / 16

NAMES = {
    "fanny": "Fanny", "layla": "Layla", "ruby": "Ruby", "angela": "Angela", "lesley": "Lesley",
    "change": "Chang'e", "guinevere": "Guinevere", "vexana": "Vexana", "obsidia": "Obsidia", "selena": "Selena",
}
RELEASE_SOURCE = "Skin release date, official Mobile Legends: Bang Bang Instagram post"
OFFICIAL = "official"
SITE = "site"
GROUPS = [{"id": OFFICIAL, "name": "Official splash art"}, {"id": SITE, "name": "Made for this site"}]
SITE_KIND = "Made for this site"
SITE_CREDIT = {
    "by": "Made for this site",
    "platform": None,
    "url": None,
    "note": "Generated for this site. Not official art.",
}
NOT_OFFICIAL = "not official art"  # every site line says this, in one plain sentence
INNER = 0.10  # the page shows the middle 80 percent of the frame at rest (docs/design/arts-reference.md, 2.4)


def png_chunks(data: bytes) -> list[str]:
    out: list[str] = []
    pos = 8
    while pos + 8 <= len(data):
        (ln,) = struct.unpack(">I", data[pos:pos + 4])
        typ = data[pos + 4:pos + 8].decode("latin1")
        out.append(typ)
        pos += 12 + ln
        if typ == "IEND":
            break
    return out


def has_credential(path: Path) -> bool:
    """True when the file carries a content credential (C2PA: the caBX chunk of a PNG)."""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "caBX" in png_chunks(data)
    return bool(re.search(rb"c2pa", data[:262144]))


def load() -> dict:
    return json.loads(CUR.read_text(encoding="utf-8"))


def check_complete(groups: list[catalog.Group], cur: dict) -> None:
    """Every different picture of the splash room has a decision, and every decision names a real picture."""
    have = {g.sha1 for g in groups}
    kept = [k["sha1"] for k in cur["keep"]]
    moved = [m["sha1"] for m in cur["moved"]]
    problems: list[str] = []
    if len(set(kept + moved)) != len(kept + moved):
        problems.append("a picture is listed twice")
    for sha in sorted(have - set(kept) - set(moved)):
        g = next(g for g in groups if g.sha1 == sha)
        problems.append(f"no decision for {g.main['rel']} ({sha[:6]})")
    for sha in sorted((set(kept) | set(moved)) - have):
        problems.append(f"{sha[:6]} is not a picture of the splash room")
    for m in cur["moved_old_items"]:
        p = common.MEDIA / m["src"]
        if not p.exists() or common.sha1_file(p) != m["sha1"]:
            problems.append(f"old item {m['old_id']}: {m['src']} is missing or changed")
    if problems:
        raise SystemExit("curation/splash.json does not match the sources:\n  " + "\n  ".join(problems))


def window_px(g: catalog.Group, frame: dict) -> tuple[float, float]:
    return frame["w"] * g.w, frame["h"] * g.h


def check_frame(g: catalog.Group, k: dict, min_w: int) -> None:
    f = k["frame"]
    if not (0 <= f["x"] and 0 <= f["y"] and f["x"] + f["w"] <= 1 + 1e-9 and f["y"] + f["h"] <= 1 + 1e-9):
        raise SystemExit(f"{k['slug']}: frame is outside the picture")
    w, h = window_px(g, f)
    if abs(w / h - RATIO) > 0.004:
        raise SystemExit(f"{k['slug']}: the window is {w:.0f}x{h:.0f}, not 16:9")
    if w < min_w:
        raise SystemExit(f"{k['slug']}: the window is {w:.0f} px wide, under {min_w}: move it to others")
    fo = k["focus"]
    if not (f["x"] + INNER * f["w"] <= fo["x"] <= f["x"] + (1 - INNER) * f["w"]
            and f["y"] + INNER * f["h"] <= fo["y"] <= f["y"] + (1 - INNER) * f["h"]):
        raise SystemExit(f"{k['slug']}: the focus point is outside the middle 80 percent of the window")


def check_group(g: catalog.Group, k: dict, moved_generated: set[str]) -> None:
    """A site picture is generated, an official one is not, and a site line says it is not official art."""
    group = k.get("group", OFFICIAL)
    generated = has_credential(g.abs_path) or g.sha1 in moved_generated
    if group not in (OFFICIAL, SITE):
        raise SystemExit(f"{k['slug']}: group {group!r} is not official or site")
    if group == SITE:
        if not generated:
            raise SystemExit(f"{k['slug']}: a site picture must be generated, and this file carries no content credential")
        if k["eyebrow"] != SITE_KIND or k["kind"] != SITE_KIND:
            raise SystemExit(f"{k['slug']}: a site picture has the eyebrow and the kind {SITE_KIND!r}")
        if NOT_OFFICIAL not in k["line"]:
            raise SystemExit(f"{k['slug']}: a site line must say {NOT_OFFICIAL!r}")
        if "made for this site" not in k["tags"]:
            raise SystemExit(f"{k['slug']}: a site picture has the tag 'made for this site'")
    elif generated:
        raise SystemExit(f"{k['slug']}: an official picture must not be generated, but this file carries a content credential")


def item_id(k: dict) -> str:
    return f"arts-{ROOM}-{k['slug']}-{k['sha1'][:6]}"


def make_img(job: tuple[str, str]) -> tuple[str, dict]:
    """Worker: the three WebP sizes of one whole picture (never upscaled, 3840 px at most)."""
    src, base = job
    return base, common.image_set(Path(src), base)


def release_facts(cur: dict) -> dict[str, dict]:
    """Date and url of each pair's release post, checked against the captions index."""
    out: dict[str, dict] = {}
    for pair, r in cur["release"].items():
        e = captions.find(f"ig:{r['post']}")
        if not e:
            raise SystemExit(f"{pair}: post {r['post']} is not in captions.json")
        if (e.get("date") or "")[:10] != r["date"]:
            raise SystemExit(f"{pair}: post {r['post']} is dated {e.get('date')}, not {r['date']}")
        if not re.search(r"available", e.get("caption") or "", re.I):
            raise SystemExit(f"{pair}: post {r['post']} does not say the skins are available")
        out[pair] = {"date": r["date"], "url": e["url"]}
    return out


def post_facts(k: dict) -> dict:
    """Facts of an official picture that is the art of an official post (key "post": "ig:<code>")."""
    e = captions.find(k["post"])
    if not e or not captions.is_official_post(e):
        raise SystemExit(f"{k['slug']}: post {k['post']} is not an official post of captions.json")
    return {"kind": k["kind"], "date": (e.get("date") or "")[:10] or None, "artist": None, "platform": "Instagram",
            "source": common.clean_text(k["post_note"]), "sourceUrl": e["url"]}


def build_item(g: catalog.Group, k: dict, img: dict, rel: dict[str, dict], order: int) -> dict:
    chars = k["chars"]
    site = k.get("group", OFFICIAL) == SITE
    if k.get("tags"):
        tags = list(k["tags"])
    else:
        tags = [("pair art" if k["kind"] == "Pair art" else "splash art"), "the aspirants"]
        tags += [NAMES[c].lower() for c in chars]
        if k.get("skin"):
            tags.append(k["skin"].lower())
    if site:
        facts = {"kind": SITE_KIND, "date": None, "artist": None, "platform": None, "source": None, "sourceUrl": None}
    elif k.get("post"):
        facts = post_facts(k)
    elif k["kind"] == "Skin splash art":
        r = rel[k["pair"]]
        facts = {"kind": k["kind"], "date": r["date"], "artist": None, "platform": None,
                 "source": RELEASE_SOURCE, "sourceUrl": r["url"]}
    else:
        facts = {"kind": k["kind"], "date": None, "artist": None, "platform": None, "source": None, "sourceUrl": None}
    item = {
        "id": item_id(k),
        "title": k["title"],
        "collection": "arts",
        "room": ROOM,
        "chars": chars,
        "pair": k["pair"],
        "canon": "fan" if site else "official",
        "tags": tags,
        "places": g.places,
        "alt": k["alt"],
        "img": img,
        "eyebrow": k["eyebrow"],
        "line": k["line"],
        "order": order,
        "group": SITE if site else OFFICIAL,
        "frame": k["frame"],
        "focus": k["focus"],
        "facts": facts,
    }
    if site:
        item["credit"] = dict(SITE_CREDIT)
    return item


# ----------------------------------------------------------------------------------------------
# Contact sheets (to look at the result) and the metadata check
# ----------------------------------------------------------------------------------------------


def _label(draw, xy, text, font) -> None:
    draw.text(xy, text, fill=(255, 255, 255), font=font)


def sheets(groups: dict[str, catalog.Group], keep: list[dict]) -> list[Path]:
    """Contact sheets to look at the result: the 16:9 windows (the middle 80 percent in green) and the 9:16 focus windows."""
    from PIL import Image, ImageDraw, ImageFont

    SHEETS.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    outs: list[Path] = []

    def make(kind: str, tw: int, th: int, cols: int, rows: int, name: str) -> None:
        per = cols * rows
        label_h = 22
        for page in range(math.ceil(len(keep) / per)):
            chunk = keep[page * per:(page + 1) * per]
            nrows = math.ceil(len(chunk) / cols)
            sheet = Image.new("RGB", (cols * tw, nrows * (th + label_h)), (28, 28, 28))
            d = ImageDraw.Draw(sheet)
            for i, k in enumerate(chunk):
                g = groups[k["sha1"]]
                im = Image.open(g.abs_path).convert("RGB")
                f, fo = k["frame"], k["focus"]
                x0, y0 = round(f["x"] * g.w), round(f["y"] * g.h)
                ww, hh = round(f["w"] * g.w), round(f["h"] * g.h)
                win = im.crop((x0, y0, x0 + ww, y0 + hh))
                fx = fy = 0.0
                if kind == "focus":
                    pw = round(hh * PORTRAIT)
                    cx = round((fo["x"] - f["x"]) / f["w"] * ww)
                    left = min(max(cx - pw // 2, 0), ww - pw)
                    win = win.crop((left, 0, left + pw, hh))
                    fx, fy = (cx - left) / pw, (fo["y"] - f["y"]) / f["h"]
                win.thumbnail((tw - 8, th - 8), Image.LANCZOS)
                ox, oy = (i % cols) * tw + (tw - win.width) // 2, (i // cols) * (th + label_h) + (th - win.height) // 2
                sheet.paste(win, (ox, oy))
                if kind == "focus":
                    px, py = ox + fx * win.width, oy + fy * win.height
                    d.ellipse((px - 5, py - 5, px + 5, py + 5), outline=(0, 255, 0), width=2)
                else:
                    d.rectangle((ox + INNER * win.width, oy + INNER * win.height,
                                 ox + (1 - INNER) * win.width, oy + (1 - INNER) * win.height), outline=(0, 255, 0), width=1)
                n = page * per + i + 1
                _label(d, ((i % cols) * tw + 4, (i // cols) * (th + label_h) + th + 2),
                       f"{n} {k.get('group', OFFICIAL)[:4]} {k['slug']} {g.w}x{g.h}", font)
            out = SHEETS / f"{name}_{page + 1}.jpg"
            sheet.save(out, quality=88)
            outs.append(out)

    make("window", 640, 360, 3, 4, "final_windows")
    make("focus", 300, 540, 7, 2, "final_focus")
    return outs


def webp_chunks(data: bytes) -> list[str]:
    """The chunk names of a WebP file (VP8, VP8X, EXIF, XMP and so on)."""
    names, pos = [], 12
    while pos + 8 <= len(data):
        names.append(data[pos:pos + 4].decode("latin1"))
        pos += 8 + int.from_bytes(data[pos + 4:pos + 8], "little") + (int.from_bytes(data[pos + 4:pos + 8], "little") & 1)
    return names


def check_no_metadata(items: list[dict]) -> None:
    """The WebP files must carry nothing from the source (EXIF, XMP, a tool name, a content credential)."""
    bad = []
    for it in items:
        for n in ("t", "p", "f"):
            data = common.key_path(it["img"][n]).read_bytes()
            if {"EXIF", "XMP "} & set(webp_chunks(data)) or re.search(rb"Canva|c2pa|OpenAI|ChatGPT|Photoshop", data):
                bad.append(it["img"][n])
    if bad:
        raise SystemExit("metadata found in: " + ", ".join(bad))


# ----------------------------------------------------------------------------------------------


def main() -> None:
    cur = load()
    groups_all = [g for g in catalog.groups() if g.room == ROOM]
    check_complete(groups_all, cur)
    by_sha = {g.sha1: g for g in groups_all}
    keep = cur["keep"]
    moved_generated = {m["sha1"] for m in cur["moved"] if m.get("generated")}
    for k in keep:
        check_frame(by_sha[k["sha1"]], k, cur["min_window_width"])
        check_group(by_sha[k["sha1"]], k, moved_generated)
    rel = release_facts(cur)

    pairs = {p["id"]: p for p in cur["pairs"]}
    pair_order = [p["id"] for p in cur["pairs"]]
    group_order = [g["id"] for g in GROUPS]

    # Order: the official group, then the site group. In each, by pair (a picture with no pair last), the
    # single character pictures first (in the order of the pair), then the pictures of two or more.
    # Python sorts are stable, so pictures that tie keep the order of the curation file.
    def sort_key(k: dict) -> tuple:
        group = group_order.index(k.get("group", OFFICIAL))
        pidx = pair_order.index(k["pair"]) if k["pair"] else len(pair_order)
        single = len(k["chars"]) == 1 and k["kind"] != "Pair art"
        cidx = pairs[k["pair"]]["chars"].index(k["chars"][0]) if single and k["pair"] else 0
        return (group, pidx, 0 if single else 1, cidx)

    keep = sorted(keep, key=sort_key)

    before = sum(p.stat().st_size for p in (common.LIB_ROOT / BASE).rglob("*") if p.is_file()) if (common.LIB_ROOT / BASE).exists() else 0
    jobs = [(str(by_sha[k["sha1"]].abs_path), f"{BASE}/{item_id(k)}") for k in keep]
    with ProcessPoolExecutor(max_workers=min(8, len(jobs))) as pool:
        imgs = dict(pool.map(make_img, jobs))

    items = [build_item(by_sha[k["sha1"]], k, imgs[f"{BASE}/{item_id(k)}"], rel, n + 1) for n, k in enumerate(keep)]
    check_no_metadata(items)
    counts = {g["id"]: sum(1 for it in items if it["group"] == g["id"]) for g in GROUPS}
    common.write_json(SLUG, {
        "v": 1, "slug": SLUG, "room": ROOM,
        "pairs": [{"id": p["id"], "name": p["name"]} for p in cur["pairs"]],
        "groups": [{"id": g["id"], "name": g["name"], "count": counts[g["id"]]} for g in GROUPS],
        "items": items,
    })
    sheet_files = sheets(by_sha, keep)

    # Report
    after = sum(p.stat().st_size for p in (common.LIB_ROOT / BASE).rglob("*") if p.is_file())
    print(f"kept {len(items)}: " + ", ".join(f"{g['name']} {counts[g['id']]}" for g in GROUPS))
    for it, k in zip(items, keep):
        fr = k["frame"]
        g = by_sha[k["sha1"]]
        win = f"{round(fr['w'] * g.w)}x{round(fr['h'] * g.h)}"
        print(f"  {it['order']:2d} {it['group']:8s} {k['sha1'][:6]} {g.w}x{g.h} window {win} at ({fr['x']}, {fr['y']})  {it['id']}")
        if k.get("crop_why"):
            print(f"       crop: {k['crop_why']}")
    moved = cur["moved"]
    print(f"moved out of Splash: {len(moved)} (to others {sum(1 for m in moved if m.get('to') == 'others')}, "
          f"to scene {sum(1 for m in moved if m.get('to') == 'scene')}), plus {len(cur['moved_old_items'])} old Arts items outside _all")
    for m in moved:
        print(f"  {m['sha1'][:6]} {m['name']} -> {m['to']}{' (done)' if m.get('done') else ''}")
    print(f"mirror bytes under {BASE}/: {common.human(after)}; written this run {common.human(after - before)}")
    print("sheets: " + ", ".join(str(p) for p in sheet_files))


if __name__ == "__main__":
    main()
