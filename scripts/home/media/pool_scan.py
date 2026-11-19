"""Scan of the candidates of the wall's picture pool (round three, M-pool). Read by `pool.py`.

    C:/Users/muham/anaconda3/python.exe scripts/home/media/pool_scan.py

Every OFFICIAL picture of the Arts rooms that can be a wall card (splash art, game art, scene stills, the posters of
Others and the design sheets) is opened from the mirror (the 1280 wide `p`) and measured once: a small gray version
for the look-alike test, the mean luminance, the dominant hue, the subject point and a few cheap flags (a dark frame,
a flat frame, burned-in text near an edge). The numbers are cached in `WORK/pool-scan.npz` and `pool-scan.json`;
`pool.py` reads them. Never fan art, never "Made for this site" (`canon` is checked, not the folder).
Idempotent. Sources and the mirror are read only.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

import numpy as np
from PIL import Image

os.environ.setdefault("ASPIRANT_HOME_WORK", "D:/ren/aspirant-work/home/M-pool")  # before hcommon reads it

import hcommon as h  # noqa: E402

ROOMS = ["splash", "game", "scene", "others", "design"]
SMALL = (32, 18)  # the look-alike thumbnail: 32 by 18 gray, equalised
COLOUR = (16, 9)  # and a colour one, for pictures of the same scene in another light
HASH_W, HASH_H = 17, 16  # dHash: 16 by 16 = 256 bits of the horizontal gradient


def official(room: str) -> list[dict[str, Any]]:
    out = []
    for it in h.library_data(f"arts-{room}")["items"]:
        if it.get("canon") != "official":
            continue
        # The splash room also holds pictures made for this site (canon "fan"): the line above drops them.
        out.append(it)
    return out


def gray_of(img: Image.Image, size: tuple[int, int]) -> np.ndarray:
    return np.asarray(img.convert("L").resize(size, Image.BILINEAR), dtype=np.float32)


def dhash(img: Image.Image) -> np.ndarray:
    """256 bits. Gradient hash of the equalised gray picture, so a colour grade or a gamma shift does not change it."""
    g = np.asarray(img.convert("L").resize((HASH_W, HASH_H), Image.BILINEAR), dtype=np.float32)
    return (g[:, 1:] > g[:, :-1]).reshape(-1)


def equalise(a: np.ndarray) -> np.ndarray:
    a = a - a.mean()
    s = a.std()
    return a / s if s > 1e-3 else a


def hue_of(rgb: np.ndarray) -> tuple[float, float]:
    """Dominant hue 0..360 (saturation weighted circular mean) and its strength 0..1."""
    r, g, b = rgb[..., 0] / 255.0, rgb[..., 1] / 255.0, rgb[..., 2] / 255.0
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    d = mx - mn
    s = np.where(mx > 1e-4, d / np.maximum(mx, 1e-4), 0.0)
    hh = np.zeros_like(mx)
    m = d > 1e-4
    rm = m & (mx == r)
    gm = m & (mx == g) & ~rm
    bm = m & ~rm & ~gm
    hh[rm] = ((g - b)[rm] / d[rm]) % 6
    hh[gm] = ((b - r)[gm] / d[gm]) + 2
    hh[bm] = ((r - g)[bm] / d[bm]) + 4
    ang = hh * (np.pi / 3)
    w = s * mx * (mx > 0.12)
    sx, sy = (w * np.cos(ang)).sum(), (w * np.sin(ang)).sum()
    tot = w.sum() + 1e-6
    deg = (np.degrees(np.arctan2(sy, sx)) + 360) % 360
    return float(deg), float(np.hypot(sx, sy) / tot)


def subject_point(rgb: np.ndarray) -> tuple[float, float]:
    """A cheap subject point: where the detail and the colour are, as fractions of the picture. The wall centres a crop on it."""
    g = rgb.mean(axis=2)
    gx = np.abs(np.diff(g, axis=1))[:-1]
    gy = np.abs(np.diff(g, axis=0))[:, :-1]
    e = gx + gy
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = (mx - mn)[:-1, :-1]
    w = e + 0.5 * sat
    hgt, wid = w.shape
    # Detail near the edges is usually text or a frame: a soft centre weight keeps the point in the picture.
    yy, xx = np.mgrid[0:hgt, 0:wid]
    cw = np.exp(-(((xx / wid - 0.5) / 0.38) ** 2 + ((yy / hgt - 0.5) / 0.45) ** 2))
    w = w * cw
    tot = w.sum() + 1e-6
    return float((w * xx).sum() / tot / wid), float((w * yy).sum() / tot / hgt)


def edge_text_score(img: Image.Image) -> float:
    """Burned-in text sits in a thin bright band at the foot: the share of strong horizontal detail in the last 12 percent."""
    g = np.asarray(img.convert("L").resize((320, 180), Image.BILINEAR), dtype=np.float32)
    band = g[int(180 * 0.86) :]
    e = np.abs(np.diff(band, axis=1)).mean()
    whole = np.abs(np.diff(g, axis=1)).mean() + 1e-3
    return float(e / whole)


def scan() -> None:
    recs: list[dict[str, Any]] = []
    hashes: list[np.ndarray] = []
    smalls: list[np.ndarray] = []
    rgbs: list[np.ndarray] = []
    for room in ROOMS:
        for it in official(room):
            path = h.MIRROR / it["img"]["p"]
            if not path.exists():
                print("missing", path)
                continue
            img = Image.open(path).convert("RGB")
            w, hgt = img.size
            mid = img.resize((160, max(1, round(160 * hgt / w))), Image.BILINEAR)
            rgb = np.asarray(mid, dtype=np.float32)
            lum = float((0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]).mean() / 255.0)
            hue, hs = hue_of(rgb)
            fx, fy = subject_point(rgb)
            sat = float((rgb.max(axis=2) - rgb.min(axis=2)).mean() / 255.0)
            spread = float(np.asarray(img.convert("L").resize((64, 36))).std() / 255.0)
            recs.append(
                {
                    "id": it["id"],
                    "room": room,
                    "title": it["title"],
                    "alt": it["alt"],
                    "chars": it["chars"],
                    "pair": it.get("pair"),
                    "p": it["img"]["p"],
                    "f": it["img"]["f"],
                    "pw": w,
                    "ph": hgt,
                    "fw": it["img"]["w"],
                    "fh": it["img"]["h"],
                    "dark": round(lum, 4),
                    "hue": round(hue, 1),
                    "hueStrength": round(hs, 3),
                    "sat": round(sat, 4),
                    "spread": round(spread, 4),
                    "fx": round(fx, 3),
                    "fy": round(fy, 3),
                    "text": round(edge_text_score(img), 3),
                    "tags": it.get("tags", []),
                    "kind": it.get("kind") or it.get("what") or "",
                }
            )
            hashes.append(dhash(img))
            smalls.append(equalise(gray_of(img, SMALL)).reshape(-1))
            rgbs.append((np.asarray(img.resize(COLOUR, Image.BILINEAR), dtype=np.float32) / 255.0).reshape(-1))
            if len(recs) % 100 == 0:
                print(len(recs), "scanned", file=sys.stderr)
    np.savez_compressed(h.WORK / "pool-scan.npz", hashes=np.array(hashes), smalls=np.array(smalls), rgbs=np.array(rgbs))
    (h.WORK / "pool-scan.json").write_text(json.dumps(recs, ensure_ascii=False), encoding="utf-8")
    print(f"{len(recs)} candidates scanned")


if __name__ == "__main__":
    scan()
