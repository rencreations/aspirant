"""Inventory of every picture under D:\\ren\\aspirant\\media for the Arts rooms.

Writes D:\\ren\\aspirant-work\\arts_rooms\\inventory.json: one record per picture file with its
place in the source tree (root, entity, category, sub folder), size, pixel size, content hash,
a 64 bit difference hash (for near duplicates) and a few cheap picture facts (letterbox bars,
alpha). Read only on the source. Run:

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/inventory.py

The records are the input of every later step (`build.py` of this folder), so nothing here
decides what is shipped.
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic", ".tif", ".tiff"}
OUT_DIR = common.WORK / "arts_rooms"


def place(rel: Path) -> dict:
    """Where a file sits in the source tree.

    `_all/<entity>/<category>/<file>`  -> root `_all`, entity, category
    `<pair folder>/art/<kind>/...`     -> root = pair folder, category = `art/<kind>`
    `_others/...`                      -> root `_others`
    """
    parts = rel.parts
    root = parts[0]
    if root == "_all" and len(parts) >= 4:
        return {"root": "_all", "entity": parts[1], "cat": parts[2], "sub": "/".join(parts[3:-1])}
    if root == "_all":
        return {"root": "_all", "entity": parts[1] if len(parts) > 2 else "", "cat": "", "sub": ""}
    return {"root": root, "entity": "", "cat": "/".join(parts[1:3]) if len(parts) > 2 else "", "sub": "/".join(parts[3:-1])}


def dhash(im: Image.Image) -> str:
    g = np.asarray(im.convert("L").resize((9, 8), Image.BILINEAR), dtype=np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return "".join("1" if b else "0" for b in bits)


def bars(im: Image.Image) -> dict:
    """Rows and columns at each edge that are (almost) one flat colour: letterbox bars."""
    g = np.asarray(im.convert("L"), dtype=np.int16)
    h, w = g.shape
    def run(lines):
        n = 0
        for ln in lines:
            if ln.max() - ln.min() <= 6 and ln.mean() < 24:
                n += 1
            else:
                break
        return n
    return {
        "top": run(g[i] for i in range(h // 3)),
        "bottom": run(g[h - 1 - i] for i in range(h // 3)),
        "left": run(g[:, i] for i in range(w // 3)),
        "right": run(g[:, w - 1 - i] for i in range(w // 3)),
    }


def one(args: tuple[str, str]) -> dict:
    root_s, rel_s = args
    path = Path(root_s) / rel_s
    rel = Path(rel_s)
    rec: dict = {"rel": rel_s.replace("\\", "/"), **place(rel), "bytes": path.stat().st_size}
    try:
        rec["sha1"] = common.sha1_file(path)
        with Image.open(path) as im:
            rec["fmt"] = im.format
            rec["w"], rec["h"] = im.size
            rec["frames"] = getattr(im, "n_frames", 1)
            rec["alpha"] = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
            im.seek(0)
            small = im.convert("RGBA" if rec["alpha"] else "RGB")
            if max(small.size) > 1200:
                s = 1200 / max(small.size)
                small = small.resize((max(1, round(small.width * s)), max(1, round(small.height * s))), Image.BILINEAR)
            rgb = small.convert("RGB")
            rec["dhash"] = dhash(rgb)
            b = bars(rgb)
            # scale bars back to source pixels
            k = im.size[0] / rgb.size[0]
            rec["bars"] = {key: int(round(v * k)) for key, v in b.items()}
    except Exception as e:  # noqa: BLE001
        rec["error"] = f"{type(e).__name__}: {e}"
    return rec


def main() -> None:
    media = common.MEDIA
    files: list[tuple[str, str]] = []
    for p in sorted(media.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMG_EXT:
            files.append((str(media), str(p.relative_to(media))))
    print(f"{len(files)} pictures under {media}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    recs: list[dict] = []
    with ProcessPoolExecutor(max_workers=8) as ex:
        for i, r in enumerate(ex.map(one, files, chunksize=8), 1):
            recs.append(r)
            if i % 200 == 0:
                print(f"  {i}/{len(files)}", flush=True)
    out = OUT_DIR / "inventory.json"
    out.write_text(json.dumps(recs, ensure_ascii=False, indent=0), encoding="utf-8")
    bad = [r for r in recs if "error" in r]
    print(f"wrote {out} ({len(recs)} records, {len(bad)} unreadable)")
    for r in bad[:20]:
        print("  unreadable:", r["rel"], r["error"])


if __name__ == "__main__":
    main()
