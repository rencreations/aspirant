"""The picture pool of the home wall (round three, M-pool, 20 Nov 2026).

    C:/Users/muham/anaconda3/python.exe scripts/home/media/pool_scan.py        measure the candidates once (about 2 min)
    C:/Users/muham/anaconda3/python.exe scripts/home/media/pool.py             choose, cut and write the pool
    C:/Users/muham/anaconda3/python.exe scripts/home/media/pool.py --sheet     also write the looking sheets

The owner: the list of pictures of the wall is too small, so pictures repeat too often, and no picture may stand near
a picture like it. The wall used to draw from 18 splash arts and 50 scene thumbnails. This pool is 160 different
OFFICIAL pictures of the Arts rooms (`canon: "official"`, never fan art, never a picture "Made for this site"):
all eighteen splash arts, then Game art and scene stills, picked by looking: the same number for each of the ten
Aspirants, the rest group art, near duplicates (the same shot, another crop or colour grade) removed by a look-alike
test on equalised gray thumbnails, and every picture carries a `group` key so the wall can keep look-alikes apart.

Writes   apps/web/public/img/home/wall/<id>.webp      640 wide WebP, native shape, no corner mark
         apps/web/public/data/home/wall.json          the pool (read by features/home/fx/image-field/pool.ts)
Look at  D:/ren/aspirant-work/home/M-pool/pool-sheet-N.jpg   (with --sheet)

What to change: `pool-curation.json` (a picture left out, with the reason; a picture forced in; a subject point), and
`PER_CHAR`, `GROUP_TARGET`, `CARD_W`, `MAX_KB`, `SEED` below. Idempotent: same input, same output. Sources and the
mirror are read only. The files are small and sit in the repo (`public/img/home/wall/`), not in the bucket.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from sklearn.cluster import AgglomerativeClustering

os.environ.setdefault("ASPIRANT_HOME_WORK", "D:/ren/aspirant-work/home/M-pool")  # before hcommon reads it

import hcommon as h  # noqa: E402
import pool_scan as scan  # noqa: E402

HERE = Path(__file__).resolve().parent
CURATION = HERE / "pool-curation.json"
OUT = h.IMG / "wall"

CARD_W = 640  # a card is 300 to 400 CSS px wide on a 1440 screen: sharp at 1x, a little soft at 2x
MAX_KB = 52  # the size the encoder aims under (quality steps down to MIN_Q)
START_Q, MIN_Q = 82, 64
PER_CHAR = 12  # single character pictures for each of the ten Aspirants (120)
GROUP_TARGET = 40  # pictures with two or more Aspirants (or none): 160 in all
MAX_SCENERY = 5  # of the group bucket, pictures with no character in them
MAX_SQUARE = 6  # pictures of a shape under 1.6 to 1 (a few other shapes, not many)
WIDE_AT = 1.9  # a frame wider than this is cut to 16:9 around its subject
FIRST = 24  # the first N of `order` are waited for by the wall's loading list (the rest is deferred)
DEAL_GAP = 7  # in `order`, two pictures closer than this never share a group or an Aspirant
SEED = 20261120

DUP_SD = 0.30  # look-alike distance under which two pictures are the same shot (one is dropped)
COLOUR_W = 4.0  # the colour thumbnail counts this much in the group distance (the same backdrop in another light)
GROUP_SD = 1.25  # average linkage distance under which pictures share a group key (the same scene, whoever stands in it)
ROOM_BONUS = {"splash": 1.2, "game": 0.55, "others": 0.2, "scene": 0.0, "design": -1.0}
MIN_LOOK = 0.9  # a picture closer than this (gray plus colour look) to one already chosen is the same shot: left out
DIVERSITY = 0.35  # weight of the quality prior against the distance to what is already chosen
CHARS = h.CHARS


# ----------------------------------------------------------------------------------------------
# Choosing
# ----------------------------------------------------------------------------------------------


def curation() -> dict[str, Any]:
    return json.loads(CURATION.read_text(encoding="utf-8")) if CURATION.exists() else {"exclude": {}, "include": [], "focus": {}}


def load_scan() -> tuple[list[dict[str, Any]], np.ndarray, np.ndarray, np.ndarray]:
    path = h.WORK / "pool-scan.json"
    if not path.exists():
        raise SystemExit("run pool_scan.py first")
    recs = json.loads(path.read_text(encoding="utf-8"))
    z = np.load(h.WORK / "pool-scan.npz")
    return recs, z["hashes"], z["smalls"], z["rgbs"]


def bucket_of(r: dict[str, Any]) -> str:
    return r["chars"][0] if len(r["chars"]) == 1 else "group"


def quality(r: dict[str, Any]) -> float:
    """A prior for the pick: where it comes from, colour, contrast, and a mid brightness (very dark frames read badly on the wall)."""
    bright = 1.0 - min(1.0, abs(r["dark"] - 0.48) / 0.40)
    return ROOM_BONUS[r["room"]] + 1.1 * min(0.5, r["sat"]) + 1.2 * min(0.3, r["spread"]) + 0.5 * bright


def usable(r: dict[str, Any], cur: dict[str, Any]) -> str | None:
    """None when the picture can be on the wall, else the reason it cannot."""
    if r["id"] in cur["exclude"]:
        return cur["exclude"][r["id"]]
    if r["room"] == "design" and r["id"] not in cur["include"]:
        return "design sheet"
    if r["room"] == "others" and r["id"] not in cur["include"]:
        return "sticker, panel or poster with words"
    if r["pw"] < CARD_W:
        return f"under {CARD_W} px wide"
    aspect = r["pw"] / r["ph"]
    if aspect < 1.0 or aspect > 2.45:
        return "shape"
    if r["dark"] < 0.09 or r["dark"] > 0.93:
        return "nearly black or white"
    if r["spread"] < 0.06:
        return "flat"
    return None


def choose(recs: list[dict[str, Any]], smalls: np.ndarray, rgbs: np.ndarray) -> tuple[list[int], list[str]]:
    cur = curation()
    ids = {r["id"]: i for i, r in enumerate(recs)}
    for key in list(cur["exclude"]) + list(cur["include"]):
        if key not in ids:
            raise SystemExit(f"curation names a picture that is not a candidate: {key}")
    ok = [i for i, r in enumerate(recs) if usable(r, cur) is None]

    # The look-alike matrix of what can be chosen. Tight pairs are the same shot: keep the better one.
    sub = smalls[ok]
    sd = np.abs(sub[:, None, :] - sub[None, :, :]).mean(-1)
    order = sorted(range(len(ok)), key=lambda k: -quality(recs[ok[k]]))
    kept: list[int] = []
    for k in order:
        r = recs[ok[k]]
        forced = r["id"] in cur["include"]
        clash = [j for j in kept if sd[k, j] < DUP_SD]
        if clash and not forced:
            continue
        kept.append(k)
    kept.sort()
    ok = [ok[k] for k in kept]
    sub = smalls[ok]
    sd = np.abs(sub[:, None, :] - sub[None, :, :]).mean(-1)
    col = rgbs[ok]
    sd = sd + COLOUR_W * np.abs(col[:, None, :] - col[None, :, :]).mean(-1)  # from here: gray look plus colour look

    # Group keys: average linkage. A group is "the same picture, more or less": the wall keeps its members apart.
    lab = AgglomerativeClustering(n_clusters=None, metric="precomputed", linkage="average", distance_threshold=GROUP_SD).fit(sd).labels_
    first_of: dict[int, int] = {}
    for k, c in enumerate(lab):
        first_of.setdefault(int(c), k)
    rank = {c: n for n, c in enumerate(sorted(first_of, key=lambda c: first_of[c]))}
    for k, i in enumerate(ok):
        recs[i]["group"] = f"g{rank[int(lab[k])]:03d}"
    pos = {i: k for k, i in enumerate(ok)}

    def hue_gap(a: dict[str, Any], b: dict[str, Any]) -> float:
        d = abs(a["hue"] - b["hue"]) % 360
        return min(d, 360 - d) / 180.0

    def dist(i: int, j: int) -> float:
        return float(sd[pos[i], pos[j]]) + 0.5 * hue_gap(recs[i], recs[j])

    quota = {c: PER_CHAR for c in CHARS}
    quota["group"] = GROUP_TARGET
    chosen: dict[str, list[int]] = {c: [] for c in quota}
    per_group: dict[str, int] = {}

    def add(i: int, force: bool = False) -> bool:
        b = bucket_of(recs[i])
        g = recs[i]["group"]
        if not force:
            if len(chosen[b]) >= quota[b] or per_group.get(g, 0) >= 2:
                return False
            if any(sd[pos[i], pos[j]] < MIN_LOOK for c in chosen.values() for j in c):
                return False
            if b == "group" and not recs[i]["chars"] and sum(1 for j in chosen["group"] if not recs[j]["chars"]) >= MAX_SCENERY:
                return False
            if recs[i]["pw"] / recs[i]["ph"] < 1.6 and sum(1 for c in chosen.values() for j in c if recs[j]["pw"] / recs[j]["ph"] < 1.6) >= MAX_SQUARE:
                return False
        chosen[b].append(i)
        per_group[g] = per_group.get(g, 0) + 1
        return True

    # The splash arts and the pictures the curation forces come first.
    for i in ok:
        if recs[i]["room"] == "splash" or recs[i]["id"] in cur["include"]:
            add(i, force=True)

    # Then, for each bucket, the farthest point from what it holds, with the quality prior (the pictures of one
    # Aspirant end up different in colour, shape and composition).
    for b in quota:
        pool = [i for i in ok if bucket_of(recs[i]) == b and i not in chosen[b]]
        while len(chosen[b]) < quota[b] and pool:
            def score(i: int) -> float:
                near = min((dist(i, j) for j in chosen[b]), default=1.0)
                return near + DIVERSITY * quality(recs[i])

            pool.sort(key=score, reverse=True)
            took = False
            for i in pool:
                if add(i):
                    pool.remove(i)
                    took = True
                    break
            if not took:
                break
    picked = [i for b in quota for i in chosen[b]]
    return picked, [f"{b}: {len(chosen[b])}" for b in quota]


# ----------------------------------------------------------------------------------------------
# The deal: one cyclic order in which look-alikes and one Aspirant never stand close
# ----------------------------------------------------------------------------------------------


def clashes(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """True when two pictures may not stand near each other. The same rule as `apart` in `pool.ts`."""
    if a["id"] == b["id"] or a["group"] == b["group"]:
        return True
    if a["character"] != "group" and a["character"] == b["character"]:
        return True
    return a["character"] == "group" and b["character"] == "group" and bool(a["chars"]) and a["chars"] == b["chars"]


def deal(items: list[dict[str, Any]]) -> list[int]:
    """Indices of `items` in one cyclic order. Within DEAL_GAP places no two share a group, a single Aspirant or the same
    pair of Aspirants; the colour and brightness of neighbours differ where they can. Seeded restarts, the cost of the best
    order wins. Matrices, so a restart costs a few milliseconds."""
    n = len(items)
    clash = np.array([[clashes(a, b) for b in items] for a in items], dtype=bool)
    hue = np.array([it["hue"] for it in items], dtype=np.float64)
    dark = np.array([it["dark"] for it in items], dtype=np.float64)
    hd = np.abs(hue[:, None] - hue[None, :]) % 360
    hd = np.minimum(hd, 360 - hd)
    rooms = np.array([it["room"] for it in items])
    base = (hd < 30).astype(np.float64) + 0.5 * (np.abs(dark[:, None] - dark[None, :]) < 0.08)
    same_room = (rooms[:, None] == rooms[None, :]).astype(np.float64) * 0.4

    best: tuple[float, list[int]] | None = None
    for attempt in range(600):
        rng = np.random.default_rng(SEED + attempt)
        left = np.ones(n, dtype=bool)
        seq: list[int] = [int(rng.integers(n))]
        left[seq[0]] = False
        stuck = False
        while len(seq) < n:
            blocked = clash[seq[-DEAL_GAP:]].any(axis=0)
            cands = np.nonzero(left & ~blocked)[0]
            if len(cands) == 0:
                stuck = True
                break
            cost = rng.random(len(cands)) * 0.3
            for k in range(1, min(4, len(seq)) + 1):
                prev = seq[-k]
                cost = cost + base[prev, cands] / k + (same_room[prev, cands] if k == 1 else 0.0)
            pick = int(cands[int(np.argmin(cost))])
            seq.append(pick)
            left[pick] = False
        if stuck or check_order(items, seq):
            continue
        cost = sum(float(base[seq[i], seq[(i + k) % n]]) / k for i in range(n) for k in (1, 2, 3))
        if best is None or cost < best[0]:
            best = (cost, seq)
    if best is None:
        raise SystemExit("no order found: relax DEAL_GAP")
    return best[1]


def check_order(items: list[dict[str, Any]], order: list[int], gap: int = DEAL_GAP) -> list[str]:
    """Problems of a cyclic order (the test in `pool.test.ts` does the same on the written file)."""
    n = len(order)
    bad = []
    for i in range(n):
        for k in range(1, gap + 1):
            a, b = items[order[i]], items[order[(i + k) % n]]
            if clashes(a, b):
                bad.append(f"{a['id']} / {b['id']} at {k}")
    return bad


# ----------------------------------------------------------------------------------------------
# Cutting
# ----------------------------------------------------------------------------------------------


def clean_windows() -> dict[str, dict[str, float]]:
    """The window of each splash art without the game's corner mark, from picks.json (the hero and the wall use the same)."""
    picks = h.read_json(h.DATA / "picks.json")
    return {p["id"]: p["clean"] for p in picks["wall"]["order"]}


def cut(r: dict[str, Any], clean: dict[str, dict[str, float]], cur: dict[str, Any]) -> tuple[Image.Image, dict[str, float]]:
    img = Image.open(h.MIRROR / r["p"]).convert("RGB")
    w, hgt = img.size
    win = clean.get(r["id"])
    if win:
        x0, y0 = round(win["x"] * w), round(win["y"] * hgt)
        x1, y1 = x0 + max(1, round(win["w"] * w)), y0 + max(1, round(win["h"] * hgt))
        img = img.crop((x0, y0, min(w, x1), min(hgt, y1)))
    # The subject point of the whole window. A frame wider than 1.9 to 1 (the films' wide frames) is cut to 16:9 around it:
    # the wall's cards are 16:9, so the sides would be lost there anyway, and the cut keeps the card's own pixels.
    rgb0 = np.asarray(img.resize((160, max(1, round(160 * img.height / img.width)))), dtype=np.float32)
    fx, fy = scan.subject_point(rgb0)
    over = cur.get("focus", {}).get(r["id"])
    if over:
        fx, fy = over["x"], over["y"]
    if img.width / img.height > WIDE_AT:
        full = img.width
        cw16 = round(img.height * 16 / 9)
        x0 = max(0, min(full - cw16, round(fx * full - cw16 / 2)))
        img = img.crop((x0, 0, x0 + cw16, img.height))
        fx = min(1.0, max(0.0, (fx * full - x0) / cw16))
    cw = min(CARD_W, img.width)
    ch = max(1, round(img.height * cw / img.width))
    card = img.resize((cw, ch), Image.LANCZOS)
    return card, {"x": round(fx, 3), "y": round(fy, 3)}


def encode(card: Image.Image, path: Path) -> int:
    h.ensure(path)
    q = START_Q
    while True:
        card.save(path, "WEBP", quality=q, method=6)
        size = path.stat().st_size
        if size <= MAX_KB * 1024 or q <= MIN_Q:
            return size
        q -= 3


def shape_of(w: int, hgt: int) -> str:
    a = w / hgt
    return "wide" if a >= 1.85 else ("16:9" if a >= 1.6 else "square")


def main() -> None:
    recs, _hashes, smalls, rgbs = load_scan()
    cur = curation()
    picked, summary = choose(recs, smalls, rgbs)
    clean = clean_windows()
    items: list[dict[str, Any]] = []
    old = {p.name for p in OUT.glob("*.webp")} if OUT.exists() else set()
    for i in sorted(picked, key=lambda i: recs[i]["id"]):
        r = recs[i]
        card, focus = cut(r, clean, cur)
        path = OUT / f"{r['id']}.webp"
        size = encode(card, path)
        old.discard(path.name)
        rgb = np.asarray(card.resize((160, max(1, round(160 * card.height / card.width)))), dtype=np.float32)
        lum = float((0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]).mean() / 255.0)
        hue, _ = scan.hue_of(rgb)
        items.append(
            {
                "id": r["id"],
                "file": h.public_path(path),
                "w": card.width,
                "h": card.height,
                "bytes": size,
                "character": bucket_of(r),
                "chars": r["chars"],
                "pair": r["pair"],
                "hue": round(hue),
                "dark": round(lum, 3),
                "group": r["group"],
                "room": r["room"],
                "shape": shape_of(card.width, card.height),
                "focus": focus,
                "title": r["title"],
                "alt": r["alt"],
                "lib": {"p": r["p"], "f": r["f"], "w": r["fw"], "h": r["fh"]},
            }
        )
    for name in sorted(old):  # a picture that left the pool leaves the folder
        (OUT / name).unlink()
        print("removed", name)
    order = deal(items)
    problems = check_order(items, order)
    if problems:
        raise SystemExit("order broken:\n" + "\n".join(problems[:10]))
    counts = {c: sum(1 for it in items if it["character"] == c) for c in [*CHARS, "group"]}
    total = sum(it["bytes"] for it in items)
    first_bytes = sum(items[i]["bytes"] for i in order[:FIRST])
    data = {
        "v": 1,
        "note": "The wall's picture pool: official Arts pictures only, cut by scripts/home/media/pool.py. `dark` is the mean luminance (0 black, 1 white). `order` is one cyclic order in which no two pictures within `gap` places share a group or a single Aspirant. The first `first` of it are waited for, the rest is deferred.",
        "cardW": CARD_W,
        "gap": DEAL_GAP,
        "first": FIRST,
        "count": len(items),
        "bytes": total,
        "firstBytes": first_bytes,
        "counts": counts,
        "order": [items[i]["id"] for i in order],
        "items": items,
    }
    h.write_json("wall", data)
    print(f"{len(items)} pictures, {total / 1024 / 1024:.2f} MB, first {FIRST}: {first_bytes / 1024:.0f} KB")
    print("per bucket:", counts)
    print("groups:", len({it["group"] for it in items}), "| shapes:", {s: sum(1 for it in items if it["shape"] == s) for s in ("16:9", "wide", "square")})
    print("rooms:", {r: sum(1 for it in items if it["room"] == r) for r in ("splash", "game", "scene", "others")})
    if "--sheet" in sys.argv:
        sheets(items, order)


def sheets(items: list[dict[str, Any]], order: list[int]) -> None:
    from PIL import ImageDraw

    tw, th, cols, per = 240, 135, 8, 40
    seq = [items[i] for i in order]
    for n in range(0, len(seq), per):
        part = seq[n : n + per]
        rows = (len(part) + cols - 1) // cols
        s = Image.new("RGB", (cols * (tw + 4), rows * (th + 14)), (16, 16, 16))
        d = ImageDraw.Draw(s)
        for k, it in enumerate(part):
            im = Image.open(h.PUBLIC / it["file"].lstrip("/")).convert("RGB")
            im.thumbnail((tw, th))
            x, y = (k % cols) * (tw + 4), (k // cols) * (th + 14)
            s.paste(im, (x, y + 12))
            d.text((x + 1, y), f"{n + k} {it['character']} {it['group']} {it['hue']}", fill=(255, 255, 0))
        s.save(h.WORK / f"pool-sheet-{n // per}.jpg", quality=84)
    print("sheets written to", h.WORK)


if __name__ == "__main__":
    main()
