"""The Others page of the official Arts (/collection/arts/others).

Reads curation/others.json (the decisions made by looking at every picture) and builds:

    mirror   D:\\ren\\aspirant-r2\\library\\v1\\arts\\v2\\others\\<id>\\{t,p,f}.webp   (common.image_set)
    data     apps/web/public/data/library/arts-others.json

Run with the anaconda Python, from anywhere:

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/others.py

What goes here: the art, chibi and poster folders of media/_all (catalog room "others"), what the Splash
helper moved here (curation/splash.json "moved" and "moved_old_items"), the old Arts pictures that are
not splash art (lore cards, trailer cards) and the pictures of an art or poster folder that were made by
an image generator, which are labelled and never official. The pictures of a splash-art folder that Splash
art keeps (official ones, and the generated ones labelled Made for this site) are not here.

What the script checks, and stops on:
- every candidate picture is an item or is listed under "dropped" (none is left out by accident): the
  groups of the others room, the "moved" and "moved_old_items" of the Splash curation;
- no item is also a picture of Splash art (curation/splash.json "keep"): one home per picture;
- a picture is generated when its PNG carries an image generator content credential (a caBX chunk) or when the
  Splash helper marked it generated. Generated pictures must be kind "site" (canon fan, credit Made for
  this site, tag made for this site) and no other picture may be generated;
- titles of 6 words at most, an alt that is a sentence, 2 to 5 lower case tags that include the kind tag;
- a credit that names a post must name a post of captions.json, and an official one for official art;
- the written WebP files carry no metadata (no EXIF, XMP, tool name or content credential);
- every source file of the old Arts room (scripts/library/arts/official.py) is accounted for in Splash,
  Design or here (it prints the ones that are not).

The picture is the whole picture. The only cut is a fully transparent border (crop "transparent"). The
cut file is kept in D:\\ren\\aspirant-work\\arts_rooms\\others\\prep so a re-run does not encode it again.
A key that exists in the mirror is never changed: if a source or a cut changes, the run stops and says to
bump "rev" of the item. Idempotent: a second run writes nothing to the mirror and the same data file.
"""

from __future__ import annotations

import importlib.util
import json
import math
import re
import struct
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # common, captions
sys.path.insert(0, str(HERE))  # catalog
import captions  # noqa: E402
import catalog  # noqa: E402
import common  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

ROOM = "others"
SLUG = f"arts-{ROOM}"
KEY_ROOT = "arts/v2/others"
CURATION = HERE / "curation" / "others.json"
SPLASH = HERE / "curation" / "splash.json"
DESIGN = HERE / "curation" / "design.json"
OLD_ARTS = HERE.parent / "arts" / "official.py"
PREP = common.WORK / "arts_rooms" / "others" / "prep"
SHEETS = common.WORK / "arts_rooms" / "sheets" / ROOM
MAX_TITLE_WORDS = 6
ALPHA_MIN = 8  # alpha at or below this counts as empty
GENERATED_CREDIT = {
    "by": "Made for this site",
    "platform": None,
    "url": None,
    "note": "Generated for this site. Not official art.",
}
ROSTER = ["fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "obsidia", "selena"]


# ----------------------------------------------------------------------------------------------
# Facts about a source file
# ----------------------------------------------------------------------------------------------


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
    """True when the file carries a content credential (C2PA, the caBX chunk of a PNG)."""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "caBX" in png_chunks(data)
    return bool(re.search(rb"c2pa", data[:262144]))


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
    img = common.image_set(Path(src), key_base)
    sig_file.write_text(sig, encoding="utf-8")
    return item_id, img


# ----------------------------------------------------------------------------------------------
# Resolving the curation against the sources
# ----------------------------------------------------------------------------------------------


class Pic:
    """One picture of the curation, resolved to a file."""

    def __init__(self, sha1: str, path: Path, w: int, h: int, places: list[str], members: list[str]):
        self.sha1, self.path, self.w, self.h, self.places, self.members = sha1, path, w, h, places, members


def resolve(entry: dict, groups: list[catalog.Group]) -> Pic:
    prefix = entry["sha"]
    if entry.get("src"):
        path = common.MEDIA / entry["src"]
        if not path.exists():
            raise SystemExit(f'{entry["slug"]}: {entry["src"]} is missing')
        sha1 = common.sha1_file(path)
        if not sha1.startswith(prefix):
            raise SystemExit(f'{entry["slug"]}: {entry["src"]} has the hash {sha1[:6]}, not {prefix}: the file changed')
        with Image.open(path) as im:
            w, h = im.size
        return Pic(sha1, path, w, h, [], [entry["src"]])
    hits = [g for g in groups if g.sha1.startswith(prefix)]
    if len(hits) != 1:
        raise SystemExit(f'{entry["slug"]}: sha prefix {prefix} matches {len(hits)} pictures')
    g = hits[0]
    return Pic(g.sha1, g.abs_path, g.w, g.h, list(g.places), [m["rel"] for m in g.members])


def candidates(groups: list[catalog.Group], splash: dict) -> dict[str, str]:
    """sha1 -> where it comes from, for every picture that must be an item or be dropped."""
    out: dict[str, str] = {}
    for g in groups:
        if g.room == ROOM:
            out[g.sha1] = f"{g.main['rel']} (others room)"
    for m in splash["moved"]:
        if m.get("to") == ROOM:
            out[m["sha1"]] = f"{m['name']} (moved by Splash)"
    for m in splash["moved_old_items"]:
        if m.get("to") == ROOM:
            out[m["sha1"]] = f"{m['src']} (old Arts, moved by Splash)"
    return out


def check_coverage(cands: dict[str, str], cur: dict) -> None:
    decided = [e["sha"] for e in cur["items"]] + [d["sha"] for d in cur["dropped"]]
    problems: list[str] = []
    for a in decided:
        if sum(1 for b in decided if b == a) > 1:
            problems.append(f"{a} is listed twice")
    for sha, where in sorted(cands.items(), key=lambda kv: kv[1]):
        n = sum(1 for d in decided if sha.startswith(d))
        if n == 0:
            problems.append(f"no decision for {sha[:6]} {where}")
        elif n > 1:
            problems.append(f"{sha[:6]} {where} has {n} decisions")
    if problems:
        raise SystemExit("curation/others.json does not match the sources:\n  " + "\n  ".join(dict.fromkeys(problems)))


def check_old_arts(items_sha: set[str], dropped_sha: set[str], splash: dict, design: dict, groups: list[catalog.Group]) -> list[str]:
    """Every source file of the old Arts room is shown by Splash, by Design or here (or dropped here on purpose)."""
    spec = importlib.util.spec_from_file_location("old_arts_official", OLD_ARTS)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # defines ART, does not run main
    splash_sha = {k["sha1"] for k in splash["keep"]}
    design_sha = [d["sha"] for d in design["items"]] + [d["sha"] for d in design.get("dropped", [])]
    lines: list[str] = []
    for a in mod.ART:
        p = common.MEDIA / a["src"]
        sha = common.sha1_file(p)
        if any(sha.startswith(x) for x in items_sha):
            where = "others"
        elif any(sha.startswith(x) for x in dropped_sha):
            where = "dropped here"
        elif sha in splash_sha:
            where = "splash"
        elif any(sha.startswith(x) for x in design_sha):
            where = "design"
        else:
            # a picture of _all with the same content may be in another room under another path
            where = "UNACCOUNTED"
        lines.append(f"  {where:13s} {a['src']}")
    return lines


# ----------------------------------------------------------------------------------------------
# Item building
# ----------------------------------------------------------------------------------------------


def make_credit(spec: dict | None) -> dict | None:
    if not spec:
        return None
    e = captions.find(spec["post"])
    if not e:
        raise SystemExit(f"credit: post {spec['post']} is not in captions.json")
    if not captions.is_official_post(e):
        raise SystemExit(f"credit: post {spec['post']} is not an official account post")
    cr = captions.credit(e)
    if spec.get("note"):
        cr["note"] = common.clean_text(spec["note"])
    return cr


def pair_of(chars: list[str]) -> str | None:
    pairs = {catalog.PAIR_OF_CHAR[c] for c in chars}
    return pairs.pop() if len(pairs) == 1 else None


def validate(entry: dict, kinds: dict[str, str], kind_tags: dict[str, str], pic: Pic, splash_generated: set[str]) -> list[str]:
    s = entry["slug"]
    p: list[str] = []
    if entry["kind"] not in kinds:
        p.append(f'{s}: kind {entry["kind"]!r} is not one of {sorted(kinds)}')
    if len(entry["title"].split()) > MAX_TITLE_WORDS:
        p.append(f"{s}: title has more than {MAX_TITLE_WORDS} words")
    if not entry["alt"].endswith("."):
        p.append(f"{s}: alt must be a sentence")
    tags = entry["tags"]
    if not 2 <= len(tags) <= 5:
        p.append(f"{s}: 2 to 5 tags, got {len(tags)}")
    if any(t != t.lower() for t in tags):
        p.append(f"{s}: tags must be lower case")
    if kind_tags.get(entry["kind"]) not in tags:
        p.append(f'{s}: tags must include the kind tag {kind_tags.get(entry["kind"])!r}')
    bad = [c for c in entry["chars"] if c not in common.CHAR_SLUGS]
    if bad:
        p.append(f"{s}: unknown characters {bad}")
    generated = has_credential(pic.path) or pic.sha1 in splash_generated
    if generated and entry["kind"] != "site":
        p.append(f"{s}: the file is generated, so its kind must be site")
    if entry["kind"] == "site" and not generated:
        p.append(f"{s}: kind site is for generated pictures, and this file is not generated")
    if entry["kind"] == "site" and entry.get("credit"):
        p.append(f"{s}: a site picture gets the fixed Made for this site credit, no credit in the curation")
    return p


# ----------------------------------------------------------------------------------------------
# Checks on the output and a contact sheet to look at it
# ----------------------------------------------------------------------------------------------


def webp_chunks(data: bytes) -> list[str]:
    names, pos = [], 12
    while pos + 8 <= len(data):
        ln = int.from_bytes(data[pos + 4:pos + 8], "little")
        names.append(data[pos:pos + 4].decode("latin1"))
        pos += 8 + ln + (ln & 1)
    return names


def check_no_metadata(items: list[dict]) -> None:
    bad = []
    for it in items:
        for n in ("t", "p", "f"):
            data = common.key_path(it["img"][n]).read_bytes()
            if {"EXIF", "XMP "} & set(webp_chunks(data)) or re.search(rb"Canva|c2pa|OpenAI|ChatGPT|Photoshop", data):
                bad.append(it["img"][n])
    if bad:
        raise SystemExit("metadata found in: " + ", ".join(bad))


def folder_bytes() -> int:
    root = common.LIB_ROOT / KEY_ROOT
    if not root.exists():
        return 0
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


def sheets(items: list[dict]) -> list[Path]:
    """Labelled contact sheets (4 by 6) of the written pictures, to look at the result."""
    from PIL import ImageDraw, ImageFont

    SHEETS.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except Exception:
        font = ImageFont.load_default()
    cols, rows, tw, th, lh = 4, 6, 360, 300, 34
    per = cols * rows
    outs: list[Path] = []
    for s in range(math.ceil(len(items) / per)):
        chunk = items[s * per:(s + 1) * per]
        sheet = Image.new("RGB", (cols * tw, rows * (th + lh)), (30, 30, 30))
        d = ImageDraw.Draw(sheet)
        for i, it in enumerate(chunk):
            x0, y0 = (i % cols) * tw, (i // cols) * (th + lh)
            im = Image.open(common.key_path(it["img"]["p"])).convert("RGBA")
            cell = Image.new("RGB", (tw - 6, th - 6), (110, 110, 110))
            im.thumbnail((tw - 6, th - 6), Image.LANCZOS)
            cell.paste(im, ((tw - 6 - im.width) // 2, (th - 6 - im.height) // 2), im)
            sheet.paste(cell, (x0 + 3, y0 + 3))
            m = it["img"]
            d.text((x0 + 4, y0 + th), f"{s * per + i + 1} {it['kind']} {m['w']}x{m['h']}", fill=(255, 255, 255), font=font)
            d.text((x0 + 4, y0 + th + 16), it["title"][:50], fill=(255, 255, 255), font=font)
        p = SHEETS / f"final_{s + 1}.jpg"
        sheet.save(p, quality=86)
        outs.append(p)
    return outs


# ----------------------------------------------------------------------------------------------


def main() -> None:
    cur = json.loads(CURATION.read_text(encoding="utf-8"))
    splash = json.loads(SPLASH.read_text(encoding="utf-8"))
    design = json.loads(DESIGN.read_text(encoding="utf-8"))
    groups = catalog.groups()
    kinds = {k["id"]: k["name"] for k in cur["kinds"]}
    kind_tags = cur["kind_tags"]
    splash_generated = {m["sha1"] for m in splash["moved"] + splash["moved_old_items"] if m.get("generated")}

    cands = candidates(groups, splash)
    check_coverage(cands, cur)
    # One home per picture: a picture that Splash art keeps is not an item here.
    in_splash = {k["sha1"] for k in splash["keep"]}
    twice = [e["slug"] for e in cur["items"] if any(s.startswith(e["sha"]) for s in in_splash)]
    if twice:
        raise SystemExit("in Splash art as well, so not an item here: " + ", ".join(twice))
    # A dropped file that moved or changed is reported, so the reason is never about another picture.
    for d in cur["dropped"]:
        hits = [g for g in groups if g.sha1.startswith(d["sha"])]
        old = [m for m in splash["moved_old_items"] if m["sha1"].startswith(d["sha"])]
        if not hits and not old:
            raise SystemExit(f'dropped {d["sha"]} ({d["file"]}) matches no source picture')

    problems: list[str] = []
    seen_slugs: set[str] = set()
    plan: list[dict] = []
    jobs: list[tuple[str, str, str, str]] = []
    cuts: list[str] = []
    for e in cur["items"]:
        pic = resolve(e, groups)
        s = e["slug"]
        if s in seen_slugs:
            problems.append(f"{s}: duplicate slug")
        seen_slugs.add(s)
        problems += validate(e, kinds, kind_tags, pic, splash_generated)
        sha6 = pic.sha1[:6]
        item_id = f"arts-{ROOM}-{s}-{sha6}"
        rev = int(e.get("rev", 1))
        key_base = f"{KEY_ROOT}/{item_id}" + (f"-r{rev}" if rev > 1 else "")
        if e.get("crop") == "transparent":
            src, box = prepare(pic.path, sha6)
            if box:
                cuts.append(f"{sha6} {s}: cut {pic.w}x{pic.h} to box {box} ({box[2] - box[0]}x{box[3] - box[1]})")
        elif e.get("crop"):
            problems.append(f'{s}: crop {e["crop"]!r} is not known (only "transparent")')
            continue
        else:
            src, box = pic.path, None
        sig = json.dumps({"sha1": pic.sha1, "box": box})
        jobs.append((item_id, str(src), key_base, sig))
        plan.append({"e": e, "pic": pic, "id": item_id})
    if problems:
        raise SystemExit("\n".join(problems))

    before = folder_bytes()
    imgs: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=6) as ex:
        for item_id, img in ex.map(build_one, jobs):
            imgs[item_id] = img
    written = folder_bytes() - before

    items: list[dict] = []
    for p in plan:
        e, pic = p["e"], p["pic"]
        site = e["kind"] == "site"
        item = {
            "id": p["id"],
            "title": e["title"],
            "collection": "arts",
            "room": ROOM,
            "chars": e["chars"],
            "pair": pair_of(e["chars"]),
            "canon": "fan" if site else "official",
            "tags": e["tags"],
            "places": pic.places,
            "alt": e["alt"],
            "img": imgs[p["id"]],
            "kind": e["kind"],
        }
        credit = dict(GENERATED_CREDIT) if site else make_credit(e.get("credit"))
        if credit:
            item["credit"] = credit
        items.append(item)
    check_no_metadata(items)

    count = Counter(i["kind"] for i in items)
    order = {k["id"]: n for n, k in enumerate(cur["kinds"])}
    kind_head = [{"id": k, "name": kinds[k], "count": c} for k, c in sorted(count.items(), key=lambda kv: (-kv[1], order[kv[0]]))]
    chars = Counter(c for i in items for c in i["chars"])
    char_head = [{"slug": c, "count": n} for c, n in sorted(chars.items(), key=lambda kv: (-kv[1], ROSTER.index(kv[0])))]
    common.write_json(SLUG, {"v": 1, "slug": SLUG, "room": ROOM, "kinds": kind_head, "characters": char_head, "items": items})
    sheet_files = sheets(items)

    # Report
    print(f"\n{len(items)} items, by kind: " + ", ".join(f"{k['name']} {k['count']}" for k in kind_head))
    print("characters: " + ", ".join(f"{c['slug']} {c['count']}" for c in char_head))
    gen = [(p["e"], p["pic"]) for p in plan if p["e"]["kind"] == "site"]
    print(f"generated (kind site, canon fan, credit Made for this site): {len(gen)}")
    for e, pic in gen:
        print(f"  {pic.sha1[:6]} {e['slug']}  <- {pic.members[0]}")
    print(f"cut (fully transparent border): {len(cuts)}")
    for c in cuts:
        print("  " + c)
    small = [i for i in items if max(i["img"]["w"], i["img"]["h"]) < 400]
    print(f"small pictures kept, shown at their own size (under 400 px): {len(small)}")
    print(f"dropped: {len(cur['dropped'])}")
    for d in cur["dropped"]:
        print(f"  {d['sha']} {d['file']}")
    print("old Arts room, where each source file went:")
    print("\n".join(check_old_arts({e["sha"] for e in cur["items"]}, {d["sha"] for d in cur["dropped"]}, splash, design, groups)))
    print(f"bytes written to the mirror this run: {common.human(written)}; folder total {common.human(folder_bytes())}")
    print("sheets:", ", ".join(str(p) for p in sheet_files))


if __name__ == "__main__":
    main()
