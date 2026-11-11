"""Comic room of the official Arts: the art made for the two comics, without the words.

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/comic.py build
    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/comic.py match

`build` (the default) reads `curation/comic.json` and writes
  * the pictures into the mirror, `arts/v2/comic/<id>/{t,p,f}.webp` (`common.image_set`), and
  * `apps/web/public/data/library/arts-comic.json`.
It is rerunnable: a picture whose three files are fresh is not encoded again, and a cut that exists in
the scratch folder is not cut again (a cut that is rewritten would get a new time stamp and be encoded
again, so a key never changes for no reason).

`match` finds every picture of the comic folders inside the lettered book pages (`media/.../art/comic`) by a
sliding comparison. It prints the page and the row where each picture sits and writes
`D:/ren/aspirant-work/arts_rooms/comic/match.json`. The page and panel numbers in the curation file come from it
(a file name is only a hint: `layla/28-1.png` is really on page 38).

What is shipped, and why (the full account is in `curation/comic.json`):
  * the 116 different pictures of the comic folders of `_all` (deduped by content hash in `catalog.py`), minus the
    ones that carry lettering, a watermark or are too small to read,
  * a few panels cut from the lettered pages where no picture without lettering existed: a panel is cut out by its
    white gutters (the corners that were paper stay transparent) or a whole page is taken when it has no lettering.

Titles and slugs. `slug` in the curation file is stored, not derived: it is part of the id and so of the key of the
pictures in the bucket. Change a slug only on purpose (the old folder then shows as an orphan, `--prune` deletes it
from the mirror when nothing was uploaded yet).

Sizes. The Comic room is about tall strips, so `t` and `p` are sized by WIDTH, not by long side: `t` is 480 px wide
and `p` is at most 1280 px wide, so a 1:4 strip is not a thumbnail 100 px wide. `f` is the full size, with the long side
at most 3840, or 5000 for a picture taller than 3840. Nothing is upscaled.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog  # noqa: E402  (also puts scripts/library on the path)
import common  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

ROOM = "comic"
CURATION = Path(__file__).resolve().parent / "curation" / "comic.json"
WORK = common.WORK / "arts_rooms" / "comic"
CUTS = WORK / "cuts"
MIRROR_DIR = common.LIB_ROOT / "arts" / "v2" / ROOM

COMICS = [
    {"id": "the-aspirant", "name": "The Aspirant", "pair": "fanny-layla",
     "pages": common.MEDIA / "layla-and-fanny" / "art" / "comic" / "official-aspirant-comic"},
    {"id": "guinevere-vexana", "name": "Guinevere and Vexana", "pair": "guinevere-vexana",
     "pages": common.MEDIA / "vexana-and-guinevere" / "art" / "comic"},
]
COMIC = {c["id"]: c for c in COMICS}

THUMB_W = 480
PREVIEW_W = 1280
FULL_LONG = 3840
FULL_LONG_TALL = 5000  # a picture taller than FULL_LONG keeps its long side up to this
WORKERS = 8


# ---------------------------------------------------------------------------------------------
# Shapes and sizes
# ---------------------------------------------------------------------------------------------


def shape_of(w: int, h: int) -> str:
    """tall: height over width at least 1.5. wide: width over height at least 1.5. Otherwise square."""
    if h / w >= 1.5:
        return "tall"
    if w / h >= 1.5:
        return "wide"
    return "square"


def sizes_for(w: int, h: int) -> dict:
    """Arguments for `common.image_set` so that t and p are sized by width and f keeps a long strip sharp.

    image_set sizes by the long side, so for a portrait picture the long side is its width times h over w."""
    if w >= h:
        thumb, preview = THUMB_W, PREVIEW_W
    else:
        thumb, preview = round(THUMB_W * h / w), round(PREVIEW_W * h / w)
    return {"thumb": thumb, "preview": preview, "full_max": FULL_LONG_TALL if h > FULL_LONG else FULL_LONG}


def opaque_color(path: Path, fallback: str) -> str:
    """Mean color of the pixels that are drawn (image_set's own color counts the transparent corners too)."""
    with Image.open(path) as im:
        a = np.asarray(im.convert("RGBA"), dtype=np.float32)
    w = a[..., 3] / 255.0
    if w.sum() < 1:
        return fallback
    rgb = (a[..., :3] * w[..., None]).sum(axis=(0, 1)) / w.sum()
    r, g, b = (int(round(v)) for v in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def alpha_share(path: Path) -> float:
    with Image.open(path) as im:
        if "A" not in im.mode:
            return 0.0
        a = np.asarray(im.getchannel("A"))
    return float((a < 250).mean())


# ---------------------------------------------------------------------------------------------
# Cuts from the lettered pages
# ---------------------------------------------------------------------------------------------


def _background(a: np.ndarray):
    """The white paper: white pixels that sit in a big white area or touch the page edge."""
    from scipy import ndimage as ndi

    white = a.min(axis=2) >= 248
    lab, n = ndi.label(white)
    areas = ndi.sum(white, lab, range(1, n + 1))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    bg = np.zeros_like(white)
    for i, ar in enumerate(areas, start=1):
        if ar >= 20000 or (i in edge and ar >= 300):
            bg |= lab == i
    return bg


def cut_component(page: Path, rect: list[int]) -> Image.Image:
    """One panel of a white page: the connected non-paper area whose box is `rect` (within 3 px).
    Holes in the panel are filled (white inside the art), the paper corners are transparent."""
    from scipy import ndimage as ndi

    a = np.asarray(Image.open(page).convert("RGB"))
    fg = ndi.binary_opening(~_background(a), structure=np.ones((5, 5)))
    lab, _ = ndi.label(fg, structure=np.ones((3, 3)))
    x0, y0, x1, y1 = rect
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        ys, xs = sl
        if abs(ys.start - y0) <= 3 and abs(ys.stop - y1) <= 3 and abs(xs.start - x0) <= 3 and abs(xs.stop - x1) <= 3:
            filled = ndi.binary_fill_holes(lab[sl] == i)
            alpha = (ndi.binary_erosion(filled, iterations=1) * 255).astype(np.uint8)
            return Image.fromarray(np.dstack([a[sl], alpha]), "RGBA")
    raise SystemExit(f"no panel with the box {rect} on {page.name}")


def make_cut(spec: dict) -> tuple[Path, str]:
    """Write the cut as a PNG in the scratch folder (once) and return it with the sha1 of its pixels."""
    comic = COMIC[spec["comic"]]
    page = comic["pages"] / f"{spec['page']}.jpg"
    CUTS.mkdir(parents=True, exist_ok=True)
    x0, y0, x1, y1 = spec["rect"]
    out = CUTS / f"{spec['comic']}-p{spec['page']:02d}-{spec['mode']}-{x0}-{y0}-{x1}-{y1}.png"
    if spec["mode"] == "component":
        if not out.exists():
            cut_component(page, spec["rect"]).save(out)
    elif spec["mode"] == "page":
        if not out.exists():
            with Image.open(page) as im:
                im.convert("RGB").crop((x0, y0, x1, y1)).save(out)
    else:
        raise SystemExit(f"unknown cut mode {spec['mode']!r}")
    with Image.open(out) as im:
        arr = np.asarray(im.convert("RGBA"))
    sha = hashlib.sha1(arr.tobytes() + str(arr.shape).encode()).hexdigest()
    return out, sha


# ---------------------------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------------------------


def encode(job: dict) -> dict:
    """Worker: the three sizes of one picture. Returns the LibImage record."""
    src = Path(job["src"])
    img = common.image_set(src, job["key_base"], **sizes_for(job["w"], job["h"]))
    img["c"] = opaque_color(common.key_path(img["t"]), img["c"])
    return img


def load_curation() -> dict:
    cur = json.loads(CURATION.read_text(encoding="utf-8"))
    for k in ("items", "drop", "cuts"):
        if k not in cur:
            raise SystemExit(f"{CURATION.name} has no {k}")
    return cur


def make_id(slug: str, sha: str) -> str:
    return f"arts-{ROOM}-{slug}-{sha[:6]}"


def check_specs(specs: list[dict]) -> None:
    """Titles are six words at most and an alt is one sentence. Checked before anything is encoded."""
    bad = []
    for s in specs:
        if len(s["title"].split()) > 6:
            bad.append(f"title over 6 words: {s['slug']}: {s['title']}")
        if not s["alt"].endswith(".") or ". " in s["alt"]:
            bad.append(f"alt is not one sentence: {s['slug']}")
        if s["comic"] not in COMIC:
            bad.append(f"unknown comic: {s['slug']}")
    if bad:
        raise SystemExit("\n".join(bad))


def check_order(specs: list[dict]) -> None:
    """On one page the pictures that have a panel number must be in the same order by row (y) as by panel number."""
    by: dict[tuple, list[dict]] = {}
    for s in specs:
        if s.get("panel"):
            by.setdefault((s["comic"], s["page"]), []).append(s)
    bad = []
    for key, rs in by.items():
        if [r["slug"] for r in sorted(rs, key=lambda r: r["y"])] != [r["slug"] for r in sorted(rs, key=lambda r: r["panel"])]:
            bad.append(f"panel numbers and rows disagree on {key}: {[(r['panel'], r['y']) for r in rs]}")
    if bad:
        raise SystemExit("\n".join(bad))


def build(prune: bool = False) -> None:
    cur = load_curation()
    groups = {g.sha1[:10]: g for g in catalog.groups() if g.room == ROOM}
    unknown = [k for k in list(cur["items"]) + list(cur["drop"]) if k not in groups]
    missing = [k for k in groups if k not in cur["items"] and k not in cur["drop"]]
    if unknown or missing:
        raise SystemExit(f"curation and catalog differ. Not in the catalog: {unknown}. Not decided: {missing}")

    check_specs(list(cur["items"].values()) + list(cur["cuts"]))
    check_order(list(cur["items"].values()) + list(cur["cuts"]))
    problems = common.check_json_text(cur, "curation/comic.json")
    if problems:
        raise SystemExit("Text rule violations in the curation file:\n" + "\n".join(problems[:40]))
    before = _dir_bytes(MIRROR_DIR)
    jobs: list[dict] = []
    metas: list[dict] = []

    for sha10, spec in cur["items"].items():
        g = groups[sha10]
        item_id = make_id(spec["slug"], g.sha1)
        jobs.append({"src": str(g.abs_path), "key_base": f"arts/v2/{ROOM}/{item_id}", "w": g.w, "h": g.h})
        metas.append({"id": item_id, "spec": spec, "w": g.w, "h": g.h, "places": list(g.places),
                      "alpha": alpha_share(g.abs_path), "cut": False})
    for spec in cur["cuts"]:
        path, sha = make_cut(spec)
        with Image.open(path) as im:
            w, h = im.size
        item_id = make_id(spec["slug"], sha)
        jobs.append({"src": str(path), "key_base": f"arts/v2/{ROOM}/{item_id}", "w": w, "h": h})
        metas.append({"id": item_id, "spec": spec, "w": w, "h": h, "places": [],
                      "alpha": alpha_share(path), "cut": True})

    with ProcessPoolExecutor(WORKERS) as ex:
        imgs = list(ex.map(encode, jobs, chunksize=1))

    items = []
    for meta, img in zip(metas, imgs):
        s = meta["spec"]
        comic = COMIC[s["comic"]]
        it = {
            "id": meta["id"],
            "title": common.clean_text(s["title"]),
            "collection": "arts",
            "room": ROOM,
            "chars": s["chars"],
            "pair": comic["pair"],
            "canon": "official",
            "tags": s["tags"],
            "places": meta["places"],
            "alt": common.clean_text(s["alt"]),
            "img": img,
            "comic": s["comic"],
            "page": s.get("page"),
            "panel": s.get("panel"),
            "shape": shape_of(meta["w"], meta["h"]),
            "ratio": round(meta["w"] / meta["h"], 3),
            "alpha": meta["alpha"] > 0.005,
        }
        if meta["cut"]:
            if s["mode"] == "page":
                it["note"] = f"This is all of page {s['page']} of {comic['name']}. The page has no lettering."
            else:
                it["note"] = f"This panel was cut from page {s['page']} of {comic['name']}. The art has no lettering."
        items.append(it)

    # Reading order: comic, page, then the row of the picture on its page (curation "y"), then the title.
    order = {c["id"]: i for i, c in enumerate(COMICS)}
    ypos = {m["id"]: m["spec"].get("y", 0) for m in metas}
    items.sort(key=lambda it: (order[it["comic"]], it["page"] is None, it["page"] or 0, ypos[it["id"]], it["title"]))

    counts = {c["id"]: sum(1 for it in items if it["comic"] == c["id"]) for c in COMICS}
    shapes = {s: sum(1 for it in items if it["shape"] == s) for s in ("tall", "square", "wide")}
    data = {
        "v": 1,
        "slug": f"arts-{ROOM}",
        "room": ROOM,
        "comics": [{"id": c["id"], "name": c["name"], "count": counts[c["id"]]} for c in COMICS],
        "shapes": shapes,
        "sizes": {
            "t": f"{THUMB_W} px wide",
            "p": f"{PREVIEW_W} px wide at most",
            "f": f"full size, long side at most {FULL_LONG}, or {FULL_LONG_TALL} when the picture is taller than {FULL_LONG}",
        },
        "items": items,
    }
    common.write_json(f"arts-{ROOM}", data)

    keep = {it["id"] for it in items}
    orphans = sorted(p for p in MIRROR_DIR.iterdir() if p.is_dir() and p.name not in keep) if MIRROR_DIR.exists() else []
    for p in orphans:
        if prune:
            shutil.rmtree(p)
        print(f"{'pruned' if prune else 'orphan (use --prune to delete)'}: {p.name}")

    after = _dir_bytes(MIRROR_DIR)
    print(f"items: {len(items)}  by comic: {counts}")
    print(f"by shape: {shapes}")
    by = {}
    for it in items:
        by[(it["comic"], it["shape"])] = by.get((it["comic"], it["shape"]), 0) + 1
    print("by comic and shape:", {f"{c}/{s}": n for (c, s), n in sorted(by.items())})
    print(f"cut from pages: {sum(1 for it in items if 'note' in it)}  cropped: 0  dropped: {len(cur['drop'])}")
    for k, d in cur["drop"].items():
        print(f"  dropped {k} {d['src']}: {d['reason']}")
    print(f"transparent shapes: {sum(1 for it in items if it['alpha'])}")
    print(f"mirror {MIRROR_DIR}: {common.human(after)} (added this run: {common.human(after - before)})")


def _dir_bytes(d: Path) -> int:
    if not d.exists():
        return 0
    return sum(p.stat().st_size for p in d.rglob("*") if p.is_file() and p.name != ".meta.json")


# ---------------------------------------------------------------------------------------------
# Match: where does each picture sit in the lettered pages?
# ---------------------------------------------------------------------------------------------

MATCH_SCALE = 8


def _small(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        return np.asarray(im.resize((max(1, w // MATCH_SCALE), max(1, h // MATCH_SCALE)), Image.BOX), dtype=np.float32)


def _small_panel(path: Path):
    with Image.open(path) as im:
        im = im.convert("RGBA")
        w, h = im.size
        a = np.asarray(im.resize((max(1, w // MATCH_SCALE), max(1, h // MATCH_SCALE)), Image.BOX), dtype=np.float32)
    return a[..., :3], (a[..., 3] > 240).astype(np.float32)


def _best(page: np.ndarray, q: np.ndarray, mask: np.ndarray):
    """Where the picture sits in the page: the lowest mean squared difference over the drawn pixels (by FFT),
    and the share of those pixels within a small tolerance there (lettering and bubbles lower it)."""
    from scipy.signal import fftconvolve

    hp, wp, _ = page.shape
    hq, wq, _ = q.shape
    if hq > hp or wq > wp or mask.sum() < 20:
        return None
    n = mask.sum()
    t1 = fftconvolve((page ** 2).sum(axis=2), mask[::-1, ::-1], mode="valid")
    t2 = sum(fftconvolve(page[..., c], (mask * q[..., c])[::-1, ::-1], mode="valid") for c in range(3))
    t3 = (mask * (q ** 2).sum(axis=2)).sum()
    ssd = (t1 - 2 * t2 + t3) / (n * 3)
    y, x = (int(v) for v in np.unravel_index(int(ssd.argmin()), ssd.shape))
    d = np.abs(page[y:y + hq, x:x + wq] - q).max(axis=2)
    frac = float(((d < 18) * mask).sum() / n)
    return float(ssd[y, x]), frac, y * MATCH_SCALE, x * MATCH_SCALE


def match() -> None:
    pages = {}
    for c in COMICS:
        for p in sorted(c["pages"].glob("*.jpg"), key=lambda p: int(p.stem)):
            pages[(c["id"], int(p.stem))] = _small(p)
    out = {}
    for g in (g for g in catalog.groups() if g.room == ROOM):
        q, mask = _small_panel(g.abs_path)
        want = "guinevere-vexana" if g.w >= 1500 else "the-aspirant"  # the two books have different page widths
        res = []
        for (cid, pg), page in pages.items():
            if cid != want:
                continue
            r = _best(page, q, mask)
            if r:
                res.append((r[0], r[1], cid, pg, r[2], r[3]))
        res.sort()
        out[g.sha1] = res[:3]
        top = res[0] if res else None
        print(g.sha1[:6], Path(g.main["rel"]).name[:32], top and (round(top[1], 2), top[2], top[3], top[4]))
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "match.json").write_text(json.dumps(out), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("what", nargs="?", default="build", choices=["build", "match"])
    ap.add_argument("--prune", action="store_true",
                    help="build: delete mirror folders of this room that no item uses any more (not yet uploaded)")
    args = ap.parse_args()
    if args.what == "build":
        build(prune=args.prune)
    else:
        match()


if __name__ == "__main__":
    main()
