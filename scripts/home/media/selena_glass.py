"""Bake a soft colour plate for the copy beside the live cast."""
from pathlib import Path

from PIL import Image, ImageFilter

images = Path(__file__).resolve().parents[3] / "apps/web/public/img/home"
with Image.open(images / "selena-sky.webp") as sky:
    plate = sky.convert("RGB").resize((96, 48), Image.Resampling.LANCZOS)
    plate.filter(ImageFilter.GaussianBlur(8)).save(images / "selena-glass.webp", quality=82)
