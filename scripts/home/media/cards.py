"""The 4:5 hero cards: one picture for each of the ten Aspirants.

    C:/Users/muham/anaconda3/python.exe scripts/home/media/cards.py

Eight come from the owner's folder `media/_all/splash-art/cropped` (4:5, cut so that the game's corner mark is
out and the character is centred). The folder has no Obsidia and no Selena, so those two are cut here from
`normal/<slug>-splash-art.png` (2560x1440, no corner mark) with the same rule: a window of the full height,
1152x1440 (4:5), centred on the character. All ten are written at CARD_SIZE as WebP.

Writes   apps/web/public/img/home/cards/<slug>-45.webp
Look at  D:/ren/aspirant-work/home/D/cards-sheet.jpg  (the ten cards side by side)

Idempotent: the files are rewritten the same every run. The sources are read only.
"""

from __future__ import annotations

from PIL import Image

import hcommon as h

CARD_SIZE = (960, 1200)  # 4:5. The sources are 1152x1440 (Vexana 973x1216): never enlarged, the card is a 0.83x copy.
QUALITY = 82

SPLASH = h.MEDIA / "_all" / "splash-art"
# Centre of the character, as a fraction of the 2560 wide picture, read off the picture itself (a grid drawn on
# it, `view_two.py` in the notes). Obsidia stands left of centre with her hair to the right; Selena's face is at
# 0.66 and her body spans 0.36 to 0.85, so the window sits a little left of her face.
CUT_CENTRE = {"obsidia": 0.495, "selena": 0.615}


def cut_from_normal(slug: str) -> Image.Image:
    im = Image.open(SPLASH / "normal" / f"{slug}-splash-art.png").convert("RGB")
    w, hgt = im.size
    cw = round(hgt * 4 / 5)
    x0 = round(CUT_CENTRE[slug] * w - cw / 2)
    x0 = max(0, min(w - cw, x0))
    return im.crop((x0, 0, x0 + cw, hgt))


def main() -> None:
    out_dir = h.IMG / "cards"
    out_dir.mkdir(parents=True, exist_ok=True)
    tiles = []
    total = 0
    for slug in h.CHARS:
        if slug in CUT_CENTRE:
            im = cut_from_normal(slug)
            origin = "cut from normal/"
        else:
            im = Image.open(SPLASH / "cropped" / f"{slug}-splash-art.jpg").convert("RGB")
            origin = "cropped/"
        if abs(im.width / im.height - 0.8) > 0.003:
            raise SystemExit(f"{slug}: not 4:5 ({im.size})")
        card = im.resize(CARD_SIZE, Image.LANCZOS)
        path = out_dir / f"{slug}-45.webp"
        card.save(path, "WEBP", quality=QUALITY, method=6)
        total += path.stat().st_size
        print(f"{slug:10} {origin:17} source {im.size[0]}x{im.size[1]} -> {CARD_SIZE[0]}x{CARD_SIZE[1]}  {path.stat().st_size / 1024:6.1f} KB")
        tiles.append(card.resize((240, 300), Image.LANCZOS))
    print(f"total {total / 1024:.0f} KB")
    sheet = Image.new("RGB", (5 * 244, 2 * 304), (20, 20, 20))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 5) * 244, (i // 5) * 304))
    sheet.save(h.WORK / "cards-sheet.jpg", quality=88)


if __name__ == "__main__":
    main()
