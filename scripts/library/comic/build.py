"""Comic room: the two official webtoons (with their transcripts) and the fan comics.

    C:/Users/muham/anaconda3/python.exe scripts/library/comic/build.py [--only official|fan] [--force]

Writes pages to the mirror at comic/<comic dir>/<NN>/ and apps/web/public/data/library/comic.json.

Pages are kept at their full width (never upscaled): f.webp is the whole page at the source width,
p.webp is 1000 wide (the same file as f when the page is not wider), t.webp is 480 wide. A very
tall page (the Guinevere and Vexana strips) is also cut into slices at the plainest horizontal
rows, as s01f/s01p, s02f/s02p ..., so the reader loads and decodes them piece by piece. The slice
heights add up exactly to the page height at both sizes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from multiprocessing import Pool
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import captions  # noqa: E402
import fans  # noqa: E402
import transcript  # noqa: E402

OFFICIAL_DIR = common.STORY / "official"
FAN_ROOTS = [
    common.MEDIA / "layla-and-fanny" / "art" / "comic",
    common.MEDIA / "ruby-and-angela" / "art" / "comic",
]
LOG_DIR = common.WORK / "comic"
LOG_DIR.mkdir(parents=True, exist_ok=True)

PREVIEW_W = 1000
THUMB_W = 480
MAX_DIM = 16000

OFFICIAL = [
    dict(
        id="comic-the-aspirant", dir="the-aspirant", folder="the-aspirant-comic",
        title="The Aspirant",
        chars=["layla", "fanny"], pair="fanny-layla", tags=["webtoon", "story", "selrick academy", "enders"],
        description="The official webtoon of how Layla and Fanny, rivals at Selrick Academy, first fight side by side against the Enders of Terrinia.",
        note="The text beside the pages is a transcript, lightly cleaned. Lines marked Scene describe the picture. The transcript covers pages 1 to 42.",
        f_w=None, q_f=84, q_p=82, slice=False, widen={38: 42},
        cover_crop=(0, 1150, 1000, 2483),
    ),
    dict(
        id="comic-guinevere-vexana", dir="guinevere-vexana", folder="guinevere-vexana-comic",
        title="Guinevere and Vexana",
        chars=["guinevere", "vexana"], pair="guinevere-vexana", tags=["webtoon", "story", "enders", "will of the planet"],
        description="The official webtoon about Guinevere and Vexana. Vexana is pulled into an Ender portal, holds on to her memories of Guinevere, and is shown a future by the Will of the Planet.",
        note="Pages 3, 23 and 40 are missing in the source, so the numbering of the original is kept and a notice marks each gap. The transcript covers pages 2 to 45.",
        f_w=None, q_f=85, q_p=82, slice=True, widen={},
        cover_crop=(0, 1063, 2500, 4396),
    ),
]


# ---------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------


def _cuts(std, H: int, min_h=900, target=2200, max_h=3400, min_tail=700, thr=3.0) -> list[int]:
    """Row numbers where a tall page is cut: plain rows (near uniform colour) near the target height,
    or the plainest row there is. Always even, so no chroma pair is split."""
    import numpy as np

    cuts = [0]
    y0 = 0
    while H - y0 > max_h:
        lo = y0 + min_h
        hi = min(y0 + max_h, H - min_tail)
        if hi <= lo:
            break
        seg = std[lo:hi]
        plain = seg < thr
        best = None
        i = 0
        n = len(seg)
        while i < n:
            if plain[i]:
                j = i
                while j < n and plain[j]:
                    j += 1
                if j - i >= 4:
                    mid = lo + (i + j) // 2
                    score = abs(mid - (y0 + target)) - (j - i) * 4
                    if best is None or score < best[0]:
                        best = (score, mid)
                i = j
            else:
                i += 1
        if best is None:
            idx = int(np.argmin(seg + 0.004 * np.abs(np.arange(lo, hi) - (y0 + target))))
            y = lo + idx
        else:
            y = best[1]
        y -= y % 2
        cuts.append(y)
        y0 = y
    cuts.append(H)
    return cuts


def process_page(job: dict) -> dict:
    """Write the sizes of one page into the mirror. Returns the page record (keys, size, slices)."""
    import numpy as np
    from PIL import Image, ImageOps

    src = Path(job["src"])
    base = job["base"]
    meta_path = common.key_path(f"{base}/.meta.json")
    t_out = common.key_path(f"{base}/t.webp")
    p_out = common.key_path(f"{base}/p.webp")
    f_out = common.key_path(f"{base}/f.webp")
    if not job["force"] and meta_path.exists() and meta_path.stat().st_mtime >= src.stat().st_mtime:
        rec = json.loads(meta_path.read_text(encoding="utf-8"))
        if len(rec.get("s", [])) == 1:
            for s in rec.pop("s"):
                for k in (s["f"], s["p"]):
                    (common.LIB_ROOT / k).unlink(missing_ok=True)
            meta_path.write_text(json.dumps(rec), encoding="utf-8")
        files = [f_out, t_out] + ([p_out] if rec["p"] != rec["f"] else [])
        for s in rec.get("s", []):
            files += [common.LIB_ROOT / s["f"], common.LIB_ROOT / s["p"]]
        if all(p.exists() and p.stat().st_size > 0 for p in files):
            return rec

    with Image.open(src) as im0:
        im = ImageOps.exif_transpose(im0).convert("RGB")
    w, h = im.size
    fw = min(w, job["f_w"] or w)
    if fw != w:
        im = im.resize((fw, round(h * fw / w)), Image.LANCZOS)
        w, h = im.size
    assert max(w, h) <= MAX_DIM, (src, w, h)
    q_f, q_p = job["q_f"], job["q_p"]

    im.save(f_out, "WEBP", quality=q_f, method=4)
    if w > PREVIEW_W:
        pw, ph = PREVIEW_W, round(h * PREVIEW_W / w)
        pim = im.resize((pw, ph), Image.LANCZOS)
        pim.save(p_out, "WEBP", quality=q_p, method=4)
        p_key = f"{base}/p.webp"
    else:
        pw, ph, pim, p_key = w, h, im, f"{base}/f.webp"
    tw = min(THUMB_W, w)
    th = round(h * tw / w)
    (im.resize((tw, th), Image.LANCZOS) if tw != w else im).save(t_out, "WEBP", quality=78, method=4)

    small = im.resize((24, 24), Image.BILINEAR)
    px = list(small.getdata())
    colour = "#{:02x}{:02x}{:02x}".format(
        sum(p[0] for p in px) // len(px), sum(p[1] for p in px) // len(px), sum(p[2] for p in px) // len(px)
    )

    rec: dict = {
        "n": job["n"], "w": w, "h": h, "t": f"{base}/t.webp", "p": p_key, "f": f"{base}/f.webp", "c": colour,
    }

    if job["slice"] and h > 3000:
        gray = np.asarray(im.convert("L"), dtype=np.uint8)[:, ::4].astype(np.float32)
        std = gray.std(axis=1)
        cuts = _cuts(std, h)
        scale = ph / h
        pcuts = [0] + [round(c * scale) for c in cuts[1:-1]] + [ph]
        slices = []
        for i in range(len(cuts) - 1):
            y0, y1 = cuts[i], cuts[i + 1]
            py0, py1 = pcuts[i], pcuts[i + 1]
            fk = f"{base}/s{i + 1:02d}f.webp"
            pk = f"{base}/s{i + 1:02d}p.webp"
            im.crop((0, y0, w, y1)).save(common.key_path(fk), "WEBP", quality=q_f, method=4)
            pim.crop((0, py0, pw, py1)).save(common.key_path(pk), "WEBP", quality=q_p, method=4)
            slices.append({"f": fk, "p": pk, "h": y1 - y0, "ph": py1 - py0})
        assert sum(s["h"] for s in slices) == h and sum(s["ph"] for s in slices) == ph
        rec["s"] = slices
    if len(rec.get("s", [])) == 1:  # short enough to stay one picture
        for s in rec.pop("s"):
            for k in (s["f"], s["p"]):
                (common.LIB_ROOT / k).unlink(missing_ok=True)

    meta_path.write_text(json.dumps(rec), encoding="utf-8")
    return rec


def run_pages(jobs: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    t0 = time.time()
    with Pool(8) as pool:
        for k, rec in enumerate(pool.imap_unordered(process_page, jobs), 1):
            out[f"{rec['t'].rsplit('/', 1)[0]}"] = rec
            print(f"  [{k}/{len(jobs)}] {rec['t'].rsplit('/', 1)[0]} {rec['w']}x{rec['h']}"
                  f"{' slices=' + str(len(rec['s'])) if 's' in rec else ''} ({time.time() - t0:.0f}s)", flush=True)
    return out


# ---------------------------------------------------------------------------------------------
# Official comics
# ---------------------------------------------------------------------------------------------


def official_jobs(spec: dict, force: bool) -> tuple[list[dict], list[int]]:
    folder = OFFICIAL_DIR / spec["folder"]
    nums = sorted(int(p.stem) for p in folder.glob("*.jpg"))
    top = max(nums)
    missing = [n for n in range(1, top + 1) if n not in nums]
    jobs = [
        dict(src=str(folder / f"{n}.jpg"), base=f"comic/{spec['dir']}/{n:02d}", n=n, f_w=spec["f_w"],
             q_f=spec["q_f"], q_p=spec["q_p"], slice=spec["slice"], force=force)
        for n in nums
    ]
    return jobs, missing


def make_cover(spec: dict) -> dict:
    from PIL import Image

    folder = OFFICIAL_DIR / spec["folder"]
    src = folder / "1.jpg"
    tmp = common.WORK / "comic" / f"cover-{spec['dir']}.png"
    if not tmp.exists() or tmp.stat().st_mtime < src.stat().st_mtime:
        with Image.open(src) as im:
            im.convert("RGB").crop(spec["cover_crop"]).save(tmp)
    return common.image_set(tmp, f"comic/{spec['dir']}/cover", full_max=1600, preview=900, thumb=480, q_full=88)


def official_item(spec: dict, force: bool) -> dict:
    jobs, missing = official_jobs(spec, force)
    print(f"{spec['id']}: {len(jobs)} pages, missing {missing}", flush=True)
    recs = run_pages(jobs)
    blocks = transcript.parse(OFFICIAL_DIR / spec["folder"] / "comic.md", spec["widen"])
    pages = []
    for job in sorted(jobs, key=lambda j: j["n"]):
        rec = dict(recs[job["base"]])
        n = rec["n"]
        tx = [i for i, b in enumerate(blocks) if b["from"] <= n <= b["to"]]
        if tx:
            rec["x"] = tx
        pages.append(rec)
    cover = make_cover(spec)
    tblocks = []
    for b in blocks:
        lines = []
        for ln in b["lines"]:
            d = {"k": ln["k"], "t": ln["t"]}
            if ln.get("who"):
                d["who"] = ln["who"]
            lines.append(d)
        tblocks.append({"from": b["from"], "to": b["to"], "lines": lines})
    return {
        "id": spec["id"], "title": spec["title"], "collection": "comic", "chars": spec["chars"], "pair": spec["pair"],
        "canon": "official", "tags": spec["tags"], "kind": "official", "description": spec["description"],
        "note": spec["note"], "cover": cover, "total": max(p["n"] for p in pages), "missing": missing,
        "pages": pages, "transcript": tblocks,
    }


# ---------------------------------------------------------------------------------------------
# Fan comics
# ---------------------------------------------------------------------------------------------


def _num(p: Path) -> int:
    return int(p.stem.split("_")[0])


def fan_sources(code: str) -> list[Path]:
    """The pages of one post, in page order. The Layla folder wins when a post is in both folders."""
    for root in FAN_ROOTS:
        d = root / f"instagram_p_{code}"
        if d.is_dir():
            return sorted(d.glob("*.jpg"), key=_num)
    raise SystemExit(f"no folder for {code}")


def fan_duplicates() -> dict[str, list[str]]:
    """Posts that are in both folders: the Ruby and Angela copies are dropped (same bytes)."""
    dups: dict[str, list[str]] = {}
    a, b = FAN_ROOTS
    for d in sorted(b.glob("instagram_p_*")):
        twin = a / d.name
        if not twin.is_dir():
            continue
        ha = sorted(hashlib.md5(p.read_bytes()).hexdigest() for p in twin.glob("*.jpg"))
        hb = sorted(hashlib.md5(p.read_bytes()).hexdigest() for p in d.glob("*.jpg"))
        if ha == hb:
            dups[d.name] = [str(p) for p in sorted(d.glob("*.jpg"))]
        else:
            print(f"  WARNING: {d.name} differs between the two folders", flush=True)
    return dups


def fan_items(force: bool) -> tuple[list[dict], dict[str, str]]:
    jobs: list[dict] = []
    by_code: dict[str, list[Path]] = {}
    for f in fans.FAN:
        srcs = fan_sources(f["code"])
        by_code[f["code"]] = srcs
        for i, s in enumerate(srcs, 1):
            jobs.append(dict(src=str(s), base=f"comic/fan-{common.slugify(f['code'])}/{i:02d}", n=i, f_w=None,
                             q_f=88, q_p=84, slice=False, force=force))
    print(f"fan comics: {len(fans.FAN)} posts, {len(jobs)} pages", flush=True)
    recs = run_pages(jobs)
    items = []
    for f in fans.FAN:
        code = f["code"]
        slug = common.slugify(code)
        entry = captions.find(f"instagram_p_{code}")
        if entry is None:
            raise SystemExit(f"no caption entry for {code}")
        credit = captions.credit(entry)
        ov = f.get("credit_override")
        if ov:
            credit = {**credit, **ov}
        pages = [dict(recs[f"comic/fan-{slug}/{i:02d}"]) for i in range(1, len(by_code[code]) + 1)]
        items.append({
            "id": f"comic-fan-{slug}", "title": f["title"], "collection": "comic", "chars": f["chars"],
            "pair": f["pair"], "canon": "fan", "tags": ["fan comic"] + f["tags"], "credit": credit, "kind": "fan",
            "description": f["desc"], "cover": {k: pages[0][k] for k in ("t", "p", "f", "w", "h", "c")},
            "total": len(pages), "missing": [], "pages": pages, "_date": credit.get("date", ""),
        })
    items.sort(key=lambda it: (it["_date"], it["id"]))
    for it in items:
        del it["_date"]
    return items, {}


# ---------------------------------------------------------------------------------------------


def merge_ignored(extra: dict[str, str]) -> None:
    path = common.REPO / "scripts" / "library" / "ignored.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    data.update(extra)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["official", "fan"])
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    cache = LOG_DIR / "items.json"
    prev = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    items: dict[str, list[dict]] = {"official": prev.get("official", []), "fan": prev.get("fan", [])}
    if args.only in (None, "official"):
        items["official"] = [official_item(s, args.force) for s in OFFICIAL]
    if args.only in (None, "fan"):
        items["fan"], _ = fan_items(args.force)
    cache.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")

    all_items = items["official"] + items["fan"]
    common.write_json("comic", {"v": 1, "slug": "comic", "items": all_items})

    ignored = {}
    for code, why in fans.EXCLUDED.items():
        for root in FAN_ROOTS:
            d = root / f"instagram_p_{code}"
            if d.is_dir():
                ignored[str(d.relative_to(common.SRC)).replace("\\", "/")] = why
    for d in sorted(FAN_ROOTS[1].glob("instagram_p_*")):
        if (FAN_ROOTS[0] / d.name).is_dir():
            ignored[str(d.relative_to(common.SRC)).replace("\\", "/")] = (
                "Same pictures as the copy in layla-and-fanny/art/comic (byte identical). Shown once."
            )
    ignored["media/layla-and-fanny/art/comic/official-aspirant-comic"] = (
        "Byte identical copy of story/official/the-aspirant-comic, which the Comic room ships.")
    ignored["media/vexana-and-guinevere/art/comic"] = (
        "Byte identical copy of story/official/guinevere-vexana-comic, which the Comic room ships.")
    merge_ignored(ignored)

    total = sum(p.stat().st_size for p in (common.LIB_ROOT / "comic").rglob("*") if p.is_file())
    print(f"comics: {len(all_items)} ({len(items['official'])} official, {len(items['fan'])} fan), "
          f"pages: {sum(len(i['pages']) for i in all_items)}, mirror comic/: {common.human(total)}")


if __name__ == "__main__":
    main()
