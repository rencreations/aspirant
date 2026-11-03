"""Turn visual-script media into site files (WebP stills, H.264 clips, posters, thumbnails).

Used by `build.py`. Every output name carries a hash of what it was made from (source, crop,
time, size, settings), so a changed script makes a new file and an unchanged one is skipped.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent.parent / "apps" / "web" / "public"
MEDIA = Path(os.environ.get("ASPIRANT_MEDIA", "D:/ren/aspirant/media"))
VERSION = "v1"  # bump to make every file again

# Sizes (pixels wide) and quality per role.
STILL_W = {"hero": 1920, "plate": 1600, "place": 1600, "panel": 1000, "panel1": 1280, "portrait": 1100}
STILL_Q = 78
CLIP_W = {"hero": 1600, "clip": 1280}
CLIP_CRF = {"hero": 27, "clip": 28}
THUMB_W = 640


@dataclass
class Made:
    """What a media spec became: URLs relative to `public/` plus facts the page needs."""

    record: dict


def _key(*parts) -> str:
    raw = json.dumps([VERSION, *parts], sort_keys=True, default=str)
    return hashlib.sha1(raw.encode()).hexdigest()[:8]


def _color(im: Image.Image) -> str:
    small = im.convert("RGB").resize((24, 24), Image.BILINEAR)
    px = list(small.getdata())
    r = sum(p[0] for p in px) // len(px)
    g = sum(p[1] for p in px) // len(px)
    b = sum(p[2] for p in px) // len(px)
    return f"#{r:02x}{g:02x}{b:02x}"


def _frame_png(video: Path, t: float, crop: list[int] | None, out: Path) -> None:
    vf = f"crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]}" if crop else "null"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", "-vf", vf, str(out)],
        check=True,
    )


def _open_still(spec: dict) -> Image.Image:
    """Source image of a spec: an image file (cropped) or a video frame (cropped)."""
    t = spec["type"]
    if t == "image":
        im = Image.open(MEDIA / spec["src"]).convert("RGB")
        if spec.get("crop"):
            x, y, w, h = spec["crop"]
            im = im.crop((x, y, x + w, y + h))
        return im
    if t == "frame":
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "f.png"
            _frame_png(MEDIA / spec["src"], float(spec["t"]), spec.get("crop"), p)
            return Image.open(p).convert("RGB")
    raise ValueError(f"not a still: {t}")


def _save_webp(im: Image.Image, out: Path, max_w: int, quality: int) -> tuple[int, int]:
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=quality, method=6)
    return im.size


def make_still(spec: dict, cid: str, role: str, size_key: str) -> dict:
    """A still (image, frame or site file) for a role. Returns the record the page uses."""
    base = {"alt": spec.get("alt", ""), "credit": spec.get("credit", "")}
    if spec["type"] == "site":
        with Image.open(PUBLIC / spec["src"]) as im:
            w, h = im.size
            color = _color(im.convert("RGBA").convert("RGB"))
        return {"kind": "image", "src": spec["src"], "w": w, "h": h, "color": color, **base}
    key = _key(spec, size_key)
    rel = f"img/story/{cid}/{role}-{key}.webp"
    out = PUBLIC / rel
    if out.exists():
        with Image.open(out) as im:
            return {"kind": "image", "src": rel, "w": im.width, "h": im.height, "color": _color(im), **base}
    im = _open_still(spec)
    color = _color(im)
    w, h = _save_webp(im, out, STILL_W[size_key], STILL_Q)
    return {"kind": "image", "src": rel, "w": w, "h": h, "color": color, **base}


def make_clip(spec: dict, cid: str, role: str, size_key: str) -> dict:
    """A short muted (or with sound) clip, its poster and facts. Returns the record."""
    base = {"alt": spec.get("alt", ""), "credit": spec.get("credit", "")}
    sound = bool(spec.get("sound"))
    key = _key(spec, size_key, sound)
    rel = f"video/story/{cid}/{role}-{key}.mp4"
    poster_rel = f"img/story/{cid}/{role}-{key}-poster.webp"
    out = PUBLIC / rel
    poster = PUBLIC / poster_rel
    start, end = float(spec["start"]), float(spec["end"])
    dur = end - start
    src = MEDIA / spec["src"]
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        crop = spec.get("crop")
        vf = []
        if crop:
            vf.append(f"crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]}")
        vf.append(f"scale='min({CLIP_W[size_key]},iw)':-2:flags=lanczos")
        vf.append("fps=24")
        tmp = out.with_suffix(".part.mp4")
        cmd = [
            "ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(src),
            "-vf", ",".join(vf), "-c:v", "libx264", "-preset", "medium", "-crf", str(CLIP_CRF[size_key]),
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-profile:v", "high",
        ]
        if sound:
            cmd += ["-c:a", "aac", "-b:a", "64k", "-ac", "2", "-ar", "44100"]
        else:
            cmd += ["-an"]
        cmd += [str(tmp)]
        subprocess.run(cmd, check=True)
        tmp.replace(out)
    if not poster.exists():
        pt = float(spec.get("poster", dur / 2))
        with tempfile.TemporaryDirectory() as tmpd:
            p = Path(tmpd) / "f.png"
            _frame_png(out, min(pt, max(dur - 0.1, 0)), None, p)
            im = Image.open(p).convert("RGB")
            _save_webp(im, poster, CLIP_W[size_key], STILL_Q)
    with Image.open(poster) as pim:
        w, h = pim.size
        color = _color(pim)
    return {
        "kind": "clip", "src": rel, "poster": poster_rel, "w": w, "h": h, "dur": round(dur, 2),
        "bytes": out.stat().st_size, "sound": sound, "color": color, **base,
    }


def make_thumb(source_im: Image.Image, cid: str, tag: str, sealed_too: bool) -> tuple[str, str]:
    """A 640 wide card picture and its sealed (blurred, dark) twin. Returns both URLs."""
    key = _key(tag, "thumb")
    rel = f"img/story/{cid}/thumb-{key}.webp"
    sealed = f"img/story/{cid}/thumb-{key}-sealed.webp"
    if not (PUBLIC / rel).exists():
        im = source_im.convert("RGB")
        target_h = round(THUMB_W * 9 / 16)
        # cover crop to 16:9
        scale = max(THUMB_W / im.width, target_h / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        left, top = (im.width - THUMB_W) // 2, (im.height - target_h) // 2
        im = im.crop((left, top, left + THUMB_W, top + target_h))
        _save_webp(im, PUBLIC / rel, THUMB_W, 74)
        if sealed_too:
            small = im.resize((96, round(96 * 9 / 16)), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
            small = small.resize((THUMB_W, target_h), Image.BICUBIC)
            dark = Image.eval(small, lambda v: int(v * 0.55))
            _save_webp(dark, PUBLIC / sealed, THUMB_W, 60)
    return rel, sealed


def still_for_thumb(spec: dict) -> Image.Image:
    if spec["type"] == "site":
        return Image.open(PUBLIC / spec["src"]).convert("RGB")
    if spec["type"] == "clip":
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "f.png"
            at = float(spec["start"]) + float(spec.get("poster", (float(spec["end"]) - float(spec["start"])) / 2))
            _frame_png(MEDIA / spec["src"], at, spec.get("crop"), p)
            return Image.open(p).convert("RGB")
    return _open_still(spec)
