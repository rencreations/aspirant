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
EXTRA = HERE / "extra"  # pictures the owner supplied (outside the media folder), kept with the scripts
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
    if im.mode == "RGBA":  # judge a cut-out by what is drawn, not by the empty background
        flat = Image.new("RGBA", im.size, (90, 90, 90, 255))
        flat.alpha_composite(im)
        im = flat
    small = im.convert("RGB").resize((24, 24), Image.BILINEAR)
    px = list(small.getdata())
    r = sum(p[0] for p in px) // len(px)
    g = sum(p[1] for p in px) // len(px)
    b = sum(p[2] for p in px) // len(px)
    return f"#{r:02x}{g:02x}{b:02x}"


def src_path(src: str) -> Path:
    """A source file: `extra/<name>` is a supplied picture, an absolute path is itself, anything else
    is relative to the media folder."""
    if src.startswith("extra/"):
        return EXTRA / src[len("extra/") :]
    p = Path(src)
    return p if p.is_absolute() else MEDIA / src


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
        raw = Image.open(src_path(spec["src"]))
        # A picture with real transparency keeps it (a cut-out has no background and no frame).
        has_alpha = raw.mode in ("RGBA", "LA", "PA") or (raw.mode == "P" and "transparency" in raw.info)
        if has_alpha:
            rgba = raw.convert("RGBA")
            has_alpha = rgba.getchannel("A").getextrema()[0] < 250
        im = raw.convert("RGBA") if has_alpha else raw.convert("RGB")
        if spec.get("crop"):
            x, y, w, h = spec["crop"]
            im = im.crop((x, y, x + w, y + h))
        return im
    if t == "frame":
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "f.png"
            _frame_png(src_path(spec["src"]), float(spec["t"]), spec.get("crop"), p)
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
            alpha = {"alpha": True} if im.mode == "RGBA" else {}
            return {"kind": "image", "src": rel, "w": im.width, "h": im.height, "color": _color(im), **alpha, **base}
    im = _open_still(spec)
    color = _color(im)
    w, h = _save_webp(im, out, STILL_W[size_key], STILL_Q)
    return {"kind": "image", "src": rel, "w": w, "h": h, "color": color, **({"alpha": True} if im.mode == "RGBA" else {}), **base}


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
    src = src_path(spec["src"])
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


def _part_size(part: dict) -> tuple[int, int]:
    if part.get("crop"):
        return int(part["crop"][2]), int(part["crop"][3])
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0",
         str(src_path(part["src"]))], capture_output=True, text=True, check=True).stdout.strip().split(",")
    return int(out[0]), int(out[1])


def make_sequence(spec: dict, cid: str, role: str, size_key: str) -> dict:
    """Two or more shots joined with short dissolves, ending in a dissolve back into the first, so the
    loop has no seam. Always muted. The record is the same as a clip's."""
    base = {"alt": spec.get("alt", ""), "credit": spec.get("credit", "")}
    x = float(spec.get("xfade", 0.4))
    parts = spec["parts"]
    key = _key(spec, size_key, "seq")
    rel = f"video/story/{cid}/{role}-{key}.mp4"
    poster_rel = f"img/story/{cid}/{role}-{key}-poster.webp"
    out, poster = PUBLIC / rel, PUBLIC / poster_rel
    p0 = parts[0]
    s0, e0 = float(p0["start"]), float(p0["end"])
    # main first part, the other parts whole, then the head of the first part again as the tail
    segs: list[tuple[dict, float, float]] = [(p0, s0 + x, e0)]
    segs += [(p, float(p["start"]), float(p["end"])) for p in parts[1:]]
    segs.append((p0, s0, s0 + x))
    lengths = [e - s for _p, s, e in segs]
    total = lengths[0]
    for ln in lengths[1:]:
        total += ln - x
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        w0, h0 = _part_size(p0)
        width = CLIP_W[size_key]
        height = max(2, round(width * h0 / w0 / 2) * 2)
        cmd = ["ffmpeg", "-v", "error", "-y"]
        for p, s, e in segs:
            cmd += ["-ss", f"{s:.3f}", "-t", f"{e - s:.3f}", "-i", str(src_path(p["src"]))]
        filt = []
        for i, (p, s, e) in enumerate(segs):
            chain = []
            if p.get("crop"):
                cx, cy, cw, ch_ = p["crop"]
                chain.append(f"crop={cw}:{ch_}:{cx}:{cy}")
            chain += [f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos", f"crop={width}:{height}",
                      "fps=24", "setsar=1", "format=yuv420p", "setpts=PTS-STARTPTS"]
            filt.append(f"[{i}:v]" + ",".join(chain) + f"[v{i}]")
        cur, cur_len = "v0", lengths[0]
        for i in range(1, len(segs)):
            filt.append(f"[{cur}][v{i}]xfade=transition=fade:duration={x:.3f}:offset={cur_len - x:.3f}[x{i}]")
            cur, cur_len = f"x{i}", cur_len + lengths[i] - x
        tmp = out.with_suffix(".part.mp4")
        cmd += ["-filter_complex", ";".join(filt), "-map", f"[{cur}]", "-c:v", "libx264", "-preset", "medium",
                "-crf", str(CLIP_CRF[size_key]), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-profile:v", "high",
                "-an", str(tmp)]
        subprocess.run(cmd, check=True)
        tmp.replace(out)
    if not poster.exists():
        pt = float(spec.get("poster", min(1.0, total / 2)))
        with tempfile.TemporaryDirectory() as tmpd:
            p = Path(tmpd) / "f.png"
            _frame_png(out, min(pt, max(total - 0.1, 0)), None, p)
            _save_webp(Image.open(p).convert("RGB"), poster, CLIP_W[size_key], STILL_Q)
    with Image.open(poster) as pim:
        w, h = pim.size
        color = _color(pim)
    return {"kind": "clip", "src": rel, "poster": poster_rel, "w": w, "h": h, "dur": round(total, 2),
            "bytes": out.stat().st_size, "sound": False, "color": color, **base}


def make_audio(spec: dict, cid: str, role: str) -> dict:
    """The sound of a stretch of a video (a spoken line), as a small mono AAC file."""
    key = _key(spec, "audio")
    rel = f"audio/story/{cid}/{role}-{key}.m4a"
    out = PUBLIC / rel
    start, end = float(spec["start"]), float(spec["end"])
    dur = end - start
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".part.m4a")
        af = f"afade=t=in:d=0.02,afade=t=out:st={max(dur - 0.05, 0):.3f}:d=0.05,loudnorm=I=-18:TP=-2:LRA=7"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(src_path(spec["src"])),
             "-vn", "-ac", "1", "-ar", "24000", "-af", af, "-c:a", "aac", "-b:a", "40k", str(tmp)],
            check=True,
        )
        tmp.replace(out)
    return {"slug": spec["speaker"], "n": 0, "src": rel, "dur": round(dur, 2)}


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
    if spec["type"] == "sequence":
        first = spec["parts"][0]
        return still_for_thumb({"type": "frame", "src": first["src"], "t": (float(first["start"]) + float(first["end"])) / 2, "crop": first.get("crop")})
    if spec["type"] == "clip":
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "f.png"
            at = float(spec["start"]) + float(spec.get("poster", (float(spec["end"]) - float(spec["start"])) / 2))
            _frame_png(src_path(spec["src"]), at, spec.get("crop"), p)
            return Image.open(p).convert("RGB")
    return _open_still(spec)
