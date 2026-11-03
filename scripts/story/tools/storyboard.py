"""A storyboard sheet of a built chapter: the hero and every insert next to the text it follows.

    python scripts/story/tools/storyboard.py c05 [c06 ...]

Reads apps/web/public/data/story/cNN.json and the built media, writes one JPEG per chapter to the
tools' preview folder and prints its path. For checking that each picture fits the text.
"""

from __future__ import annotations

import json
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from common import out_name

PUBLIC = Path(__file__).resolve().parents[3] / "apps" / "web" / "public"
W_TEXT = 640
W_PIC = 520
PAD = 12


def font(size: int):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


F = font(15)
FB = font(16)
FS = font(13)


def pic(rec: dict) -> Image.Image:
    rel = rec["poster"] if rec["kind"] == "clip" else rec["src"]
    im = Image.open(PUBLIC / rel).convert("RGB")
    im.thumbnail((W_PIC, 360))
    return im


def one(cid: str) -> Path:
    ch = json.loads((PUBLIC / "data" / "story" / f"{cid}.json").read_text(encoding="utf-8"))
    rows: list[tuple[str, list[tuple[Image.Image, str]]]] = []
    rows.append((f"HERO  {ch['title']}  [{ch.get('dateline') or ''}]  score={ch.get('score')}", [(pic(ch["hero"]), ("CLIP " if ch["hero"]["kind"] == "clip" else "") + ch["hero"]["alt"])]))
    last = ""
    for b in ch["blocks"]:
        if b["t"] == "p":
            last = "".join(s["t"] for s in b["segs"])
            lastn = b["i"]
        elif b["t"] == "insert":
            media = b.get("media")
            lst = media if isinstance(media, list) else ([media] if media else [])
            items = [(pic(m), ("CLIP " if m["kind"] == "clip" else "") + m["alt"]) for m in lst]
            head = f"after p{lastn} [{b['kind']}] {b.get('label') or b.get('character') or ''}  caption: {b.get('caption') or '-'}"
            rows.append((head + "\n" + last, items))
    lines_cache = []
    total_h = PAD
    for head, items in rows:
        wrapped = []
        for part in head.split("\n"):
            wrapped += textwrap.wrap(part, 68) or [""]
        th = len(wrapped) * 19 + 8
        ph = max([im.height + 36 for im, _ in items] or [0])
        h = max(th, ph) + PAD
        lines_cache.append((wrapped, items, h))
        total_h += h
    sheet = Image.new("RGB", (W_TEXT + (3 * (W_PIC + PAD)), total_h), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    y = PAD
    for wrapped, items, h in lines_cache:
        for i, line in enumerate(wrapped):
            d.text((PAD, y + i * 19), line, fill=(20, 20, 20), font=FB if i == 0 else F)
        x = W_TEXT
        for im, alt in items:
            sheet.paste(im, (x, y))
            for k, line in enumerate(textwrap.wrap(alt, 70)[:2]):
                d.text((x, y + im.height + 2 + k * 15), line, fill=(60, 60, 160), font=FS)
            x += W_PIC + PAD
        d.line((0, y + h - PAD // 2, sheet.width, y + h - PAD // 2), fill=(200, 200, 200))
        y += h
    out = out_name(f"storyboard-{cid}", "jpg")
    sheet.save(out, quality=80)
    return out


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print(one(arg))
