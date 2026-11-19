"""More hero cards: eight more 4:5 pictures, so the hero's eighteen cards are all different (19 Nov 2026).

    C:/Users/muham/anaconda3/python.exe scripts/home/media/hero_cards.py          cut the cards, write the data
    C:/Users/muham/anaconda3/python.exe scripts/home/media/hero_cards.py --sheet  also write the looking sheet

The first ten cards (`cards.py`) are the ten single splash arts. The hero draws eighteen cards, so eight of them
used to repeat a picture. These eight are official stills of the collection's Game art room (`arts-game.json`,
`canon: "official"`), one for each of the first eight Aspirants, cut to 4:5 around the character from the 2560 wide
`f` picture. Never a picture made for this site, never fan art.

Writes   apps/web/public/img/home/cards/<slug>-b-45.webp   (640 x 800, WebP)
         apps/web/public/data/home/hero-cards.json         (read by picks.py, which puts them in picks.json)
Look at  D:/ren/aspirant-work/home/D/hero-cards-sheet.jpg

`CUTS` is the table to change: the still's id, and where the character is across the picture (`cx`) and down it
(`fy`, the face), as fractions of the whole still. The crop is the whole height of the still, 4:5.
Idempotent. Sources and the mirror are read only.
"""

from __future__ import annotations

import sys
from typing import Any

from PIL import Image

import hcommon as h

CARD_SIZE = (640, 800)  # 4:5. A card is about 250 px tall on a 1x screen: 2x is plenty, and 8 of these weigh little.
QUALITY = 80

# (slug of the character, still id, cx, fy)
CUTS: list[tuple[str, str, float, float]] = [
    ("fanny", "arts-game-fanny-stands-ready-241512", 0.46, 0.30),
    ("layla", "arts-game-layla-hand-on-her-hip-5b7715", 0.56, 0.30),
    ("ruby", "arts-game-ruby-grips-a-silver-weapon-2bd46c", 0.55, 0.30),
    ("angela", "arts-game-angela-looks-down-between-wings-328925", 0.55, 0.30),
    ("lesley", "arts-game-lesley-holds-her-long-rifle-4ab9ea", 0.50, 0.30),
    ("change", "arts-game-change-reads-a-target-screen-3b2b4f", 0.50, 0.30),
    ("guinevere", "arts-game-guinevere-with-a-drone-c1c3a5", 0.40, 0.30),
    ("vexana", "arts-game-vexana-opens-her-arms-bf89de", 0.50, 0.30),
]


def cut(slug: str, still: str, cx: float, fy: float) -> dict[str, Any]:
    game = {i["id"]: i for i in h.library_data("arts-game")["items"]}
    it = game[still]
    if it["canon"] != "official":
        raise SystemExit(f"{still}: not official art")
    img = Image.open(h.MIRROR / it["img"]["f"]).convert("RGB")
    w, hgt = img.size
    cw = round(hgt * 4 / 5)
    x0 = max(0, min(w - cw, round(cx * w - cw / 2)))
    card = img.crop((x0, 0, x0 + cw, hgt)).resize(CARD_SIZE, Image.LANCZOS)
    path = h.IMG / "cards" / f"{slug}-b-45.webp"
    h.ensure(path)
    card.save(path, "WEBP", quality=QUALITY, method=6)
    rec = {
        "id": f"{slug}-b", "chars": it["chars"], "repo": h.public_path(path), "w": CARD_SIZE[0], "h": CARD_SIZE[1],
        "bytes": path.stat().st_size, "focus": {"x": 0.5, "y": fy}, "alt": it["alt"],
        "source": f"{still}, 4:5 cut at x {cx} of the 2560 wide still (scripts/home/media/hero_cards.py)",
    }
    return rec


def main() -> None:
    cards = [cut(*c) for c in CUTS]
    h.write_json("hero-cards", {"v": 1, "note": "eight official Game art stills cut to 4:5, after the ten cards of cards.py", "cards": cards})
    total = sum(c["bytes"] for c in cards)
    print(f"{len(cards)} cards, {total / 1024:.0f} KB")
    if "--sheet" in sys.argv:
        tiles = [Image.open(h.PUBLIC / c["repo"].lstrip("/")).resize((240, 300)) for c in cards]
        sheet = Image.new("RGB", (4 * 244, 2 * 304), (20, 20, 20))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % 4) * 244, (i // 4) * 304))
        sheet.save(h.WORK / "hero-cards-sheet.jpg", quality=88)


if __name__ == "__main__":
    main()
