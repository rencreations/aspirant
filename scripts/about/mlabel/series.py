"""Prepare the four series posters and transparent wordmarks for the About gallery."""
from pathlib import Path

from PIL import Image, ImageOps


OUT = Path(__file__).resolve().parents[3] / "apps/web/public/img/about/mlabel/series"
MEDIA = Path("D:/ren/aspirant/media")
DOWNLOADS = Path.home() / "Downloads"
SERIES = [
    ("aspirants", MEDIA / "_all/angela/poster/all-aspirants-2.jpg", MEDIA / "_others/web/logo/logo.png"),
    ("nexus-sea", DOWNLOADS / "ns.jpg", DOWNLOADS / "nsl.png"),
    ("kishin-densetsu", DOWNLOADS / "ks.png", DOWNLOADS / "kdl.png"),
    ("soul-vessels", DOWNLOADS / "sv.png", DOWNLOADS / "svl.png"),
]

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, poster, mark in SERIES:
        with Image.open(poster) as source:
            art = ImageOps.exif_transpose(source).convert("RGB")
            art.thumbnail((1600, 1000), Image.Resampling.LANCZOS)
            art.save(OUT / f"{slug}.webp", quality=88, method=6)
        with Image.open(mark) as source:
            logo = source.convert("RGBA")
            logo = logo.crop(logo.getchannel("A").getbbox())
            logo.thumbnail((650, 280), Image.Resampling.LANCZOS)
            logo.save(OUT / f"{slug}-logo.webp", quality=94, method=6)
