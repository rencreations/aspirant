"""Make the two landscape comic selections from the supplied pictures."""
import argparse
from pathlib import Path

from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument("aspirants", type=Path)
parser.add_argument("vexana_guinevere", type=Path)
sources = parser.parse_args()
output = Path(__file__).resolve().parents[3] / "apps/web/public/img/home"
for name, source in vars(sources).items():
    with Image.open(source) as image:
        card = ImageOps.exif_transpose(image).convert("RGB")
        card.thumbnail((800, 450), Image.Resampling.LANCZOS)
        card.save(output / f"comic-{name.replace('_', '-')}.webp", quality=88, method=6)
