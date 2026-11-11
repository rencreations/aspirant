"""Contact sheets of the candidate pictures of the codex entries, for choosing which to show.

    C:/Users/muham/anaconda3/python.exe scripts/library/lore/codex/pictures_sheet.py <slice> <of>

Reads D:/ren/aspirant-work/lore_pics/candidates.json and proximity.json (made by
pictures_candidates.py), takes slice <slice> of <of> (counting from 1) of the entries in a fixed
order, and writes into D:/ren/aspirant-work/lore_pics/slice-<slice>/: sheet-NN.jpg (a few entries
each, a row of thumbnails per entry, every thumbnail labelled with its candidate id) and brief.txt
(for each entry: its name, kind, aliases, the chapter it first shows in, what the book says, and the
words of every candidate picture). Nothing here decides what is shipped.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pictures_candidates as pc  # noqa: E402

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

MIRROR = Path("D:/ren/aspirant-r2/library/v1")
PUBLIC = pc.REPO / "apps" / "web" / "public"
CAP = 10  # candidates shown for one entry
PER_SHEET = 3  # entries on a sheet
TW, TH = 230, 130


def path_of(it: dict) -> Path:
    return MIRROR / it["key"] / "t.webp" if it["src"] == "arts" else PUBLIC / it["path"]


def big_path(it: dict) -> Path:
    """The larger file of a candidate, for a closer look."""
    return MIRROR / it["key"] / "p.webp" if it["src"] == "arts" else PUBLIC / it["path"]


def font(size: int):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    k, n = int(sys.argv[1]), int(sys.argv[2])
    codex = json.loads((pc.DATA / "library" / "lore-codex.json").read_text(encoding="utf-8"))
    by = {e["slug"]: e for e in codex["entries"]}
    items = {i["id"]: i for i in pc.pool()}
    second = len(sys.argv) > 3 and sys.argv[3] == "second"
    if second:
        names = json.loads((pc.OUT / "candidates2.json").read_text(encoding="utf-8"))
        prox = {}
    else:
        names = json.loads((pc.OUT / "candidates.json").read_text(encoding="utf-8"))
        prox = json.loads((pc.OUT / "proximity.json").read_text(encoding="utf-8"))
    order = sorted(names, key=lambda s: (by[s]["tier"], s)) + sorted(prox, key=lambda s: (by[s]["tier"], s))
    mine = [s for i, s in enumerate(order) if i % n == k - 1]
    out = pc.OUT / (f"slice2-{k}" if second else f"slice-{k}")
    out.mkdir(parents=True, exist_ok=True)
    f_small, f_big = font(13), font(18)
    brief = []
    rows = []
    for slug in mine:
        e = by[slug]
        raw = names.get(slug) or prox.get(slug) or []
        # Story pictures first (curated against the text), then the arts pictures whose title names the entry.
        def rank(c):
            it = items[c["id"]]
            return (it["src"] != "story", c["hit"] not in it.get("title", "").lower(), c["id"])
        cands = sorted(raw, key=rank)[:CAP]
        kind = ("the chapters it appears in" if second else "name") if slug in names else "near a fact"
        brief.append(
            f"### {slug} | {e['name']} | {e['kind']}, {e['sub']} | aka: {', '.join(e['aka']) or 'none'} | first in chapter {e['first']} | candidates by {kind}\n"
            f"{e.get('summary') or e.get('short') or e.get('line')}\n"
            + "\n".join(f"- {c['id']} ({'story c' + str(items[c['id']]['chapter']) if items[c['id']]['src'] == 'story' else 'arts ' + items[c['id']]['room']}, matched '{c['hit']}', file {big_path(items[c['id']])}): {items[c['id']]['alt']}" for c in cands)
            + "\n"
        )
        rows.append((e, cands, items))
    for s in range(0, len(rows), PER_SHEET):
        chunk = rows[s : s + PER_SHEET]
        w = CAP * (TW + 6) + 6
        sheet = Image.new("RGB", (w, len(chunk) * (TH + 70) + 6), (245, 245, 248))
        d = ImageDraw.Draw(sheet)
        for r, (e, cands, items_) in enumerate(chunk):
            y = 6 + r * (TH + 70)
            d.text((8, y), f"{e['slug']}  |  {e['name']}  |  {e['kind']}: {e['sub']}  |  first in chapter {e['first']}", fill=(10, 10, 20), font=f_big)
            for c, cand in enumerate(cands):
                it = items_[cand["id"]]
                x = 6 + c * (TW + 6)
                try:
                    im = Image.open(path_of(it)).convert("RGB")
                    im.thumbnail((TW, TH))
                    sheet.paste(im, (x, y + 28))
                except Exception:  # noqa: BLE001
                    d.rectangle((x, y + 28, x + TW, y + 28 + TH), outline=(200, 0, 0))
                d.text((x, y + 28 + TH + 3), cand["id"][-30:], fill=(40, 40, 60), font=f_small)
        sheet.save(out / f"sheet-{s // PER_SHEET + 1:02d}.jpg", quality=84)
    (out / "brief.txt").write_text("\n".join(brief), encoding="utf-8")
    print(f"slice {k}/{n}: {len(mine)} entries, {(len(rows) + PER_SHEET - 1) // PER_SHEET} sheets in {out}")


if __name__ == "__main__":
    main()
