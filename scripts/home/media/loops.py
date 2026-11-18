"""The character list of the home page (the Oryzo list): one loop for each Aspirant, in the owner's order.

    C:/Users/muham/anaconda3/python.exe scripts/home/media/loops.py            build the loops, the posters, print the seam checks
    C:/Users/muham/anaconda3/python.exe scripts/home/media/loops.py --sheet    also write the looking sheets

Order (the owner's): Obsidia, Fanny, Guinevere, Angela, Lesley, Layla, Ruby, Vexana, Chang'e.

One file serves both states of a frame. The FULL picture is the file; the list shows a 4:5 window of it (CSS or
texture crop with `crop`), and a press opens the same file whole, with the empty space around it. Every record
carries that window as fractions of the full picture:  crop {x, y, w, h}  (w * W / (h * H) is 0.8),  and the same
as  cx, cy (the centre) and zoom (1 / h: 1 is the full height).

    apps/web/public/video/home/loops/<slug>.mp4      full picture, H.264 High, 30 fps, no audio, faststart
    apps/web/public/img/home/loops/<slug>-45.webp    4:5 poster, the first frame of the window (640x800)
    apps/web/public/img/home/loops/<slug>-full.webp  full poster, the first frame (1280 wide)

Kinds
    idle       Obsidia: the site's own seamless idle loop (public/video/obsidia/1080/idle.mp4, 8.033 s, the loop
               points 2.30 to 10.33 of the in-game recording found by the loop finder, closure under one frame
               step), halved to 30 fps (every second frame: the loop stays exact). 1920x864 (the recording's ratio).
    pingpong   Angela, Lesley, Ruby, Vexana, Chang'e, Guinevere: the owner's `media/_all/webmedia/<name>.mov`, the
               official animated title banners (1920x1080, 30 fps, 2 to 5 s, a slow push, no loop: the first and
               last frames differ). Played forward then backward, with neither end frame repeated, so the loop is
               seamless by construction. The banner's title text sits in the lower fifth (and, for Lesley, at the
               lower right): the 4:5 window leaves it out; the full picture keeps it (it is the official banner).
    still      Fanny and Layla: the owner's `webmedia` has only a picture for them. No file is made here: the list
               state is img/home/cards/<slug>-45.webp (cards.py) and the full picture is the library's own art
               (arts/v2/splash/<id>/f.webp). The page gives a still a slow push by itself.

Size. The 4:5 window of the 1080p banners is 864 source pixels tall (Vexana's 720), and of Obsidia's picture 864,
so a frame about 720 CSS px tall (80vh at 900) is sharp up to a pixel ratio of 1.2 and acceptable at 1.5. The
files are 1.1 to 2.1 MB (the quality is set for each: CRF in LOOPS), 12 MB in all.

Idempotent: rebuilt the same every run. Sources are read only.
"""

from __future__ import annotations

import io
import subprocess
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

import hcommon as h

WEBMEDIA = h.MEDIA / "_all" / "webmedia"
OBSIDIA_LOOP = h.PUBLIC / "video" / "obsidia" / "1080" / "idle.mp4"
LOOP_DIR = h.VIDEO / "loops"
POSTER_DIR = h.IMG / "loops"

# slug, kind, source, crop window in source pixels (x, y, w, h), CRF.
# The windows were drawn on full frames and looked at (crops.jpg in the notes). The title text of the banners is
# below the window (Lesley's, at the lower right, is right of it).
LOOPS: list[dict[str, Any]] = [
    {"slug": "obsidia", "name": "Obsidia", "kind": "idle", "src": OBSIDIA_LOOP, "crop": (690, 0, 691, 864), "crf": 32},
    {"slug": "fanny", "name": "Fanny", "kind": "still", "art": "arts-splash-fanny-a4bc10", "crop": (904, 0, 1152, 1440)},
    {"slug": "guinevere", "name": "Guinevere", "kind": "pingpong", "src": WEBMEDIA / "guin.mov", "crop": (837, 0, 691, 864), "crf": 31},
    {"slug": "angela", "name": "Angela", "kind": "pingpong", "src": WEBMEDIA / "angela.mov", "crop": (783, 0, 691, 864), "crf": 28},
    {"slug": "lesley", "name": "Lesley", "kind": "pingpong", "src": WEBMEDIA / "lesley.mov", "crop": (620, 0, 672, 840), "crf": 28},
    {"slug": "layla", "name": "Layla", "kind": "still", "art": "arts-splash-layla-f5d919", "crop": (984, 0, 1152, 1440)},
    {"slug": "ruby", "name": "Ruby", "kind": "pingpong", "src": WEBMEDIA / "ruby.mov", "crop": (501, 0, 691, 864), "crf": 28},
    {"slug": "vexana", "name": "Vexana", "kind": "pingpong", "src": WEBMEDIA / "vexana.mov", "crop": (876, 60, 576, 720), "crf": 28},
    {"slug": "change", "name": "Chang'e", "kind": "pingpong", "src": WEBMEDIA / "change.mov", "crop": (806, 0, 691, 864), "crf": 28},
]
# The full picture of the stills is the art of the library: 2560 by 1440 (the crop is in those pixels).
STILL_FULL = (2560, 1440)


def window(spec: dict[str, Any], full: tuple[int, int]) -> dict[str, float]:
    """The 4:5 window as fractions of the full picture, with centre and zoom."""
    x, y, w, hh = spec["crop"]
    fw, fh = full
    if abs(w / hh - 0.8) > 0.003:
        raise SystemExit(f"{spec['slug']}: the window {w}x{hh} is not 4:5")
    return {"x": round(x / fw, 4), "y": round(y / fh, 4), "w": round(w / fw, 4), "h": round(hh / fh, 4),
            "cx": round((x + w / 2) / fw, 4), "cy": round((y + hh / 2) / fh, 4), "zoom": round(fh / hh, 3)}


def frames_count(path: Path) -> int:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(path)],
        capture_output=True, encoding="utf-8", check=True,
    ).stdout
    return int(out.strip())


def encode(spec: dict[str, Any]) -> Path:
    src: Path = spec["src"]
    out = h.ensure(LOOP_DIR / f"{spec['slug']}.mp4")
    tmp = out.with_suffix(".part.mp4")
    common = ["-an", "-c:v", "libx264", "-preset", "slow", "-crf", str(spec["crf"]), "-profile:v", "high", "-pix_fmt", "yuv420p",
              "-movflags", "+faststart"]
    if spec["kind"] == "idle":
        # every second frame of the 60 fps loop: the loop stays exact
        cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y", "-i", str(src), "-vf", "fps=30,setsar=1", *common, str(tmp)]
    else:
        n = frames_count(src)
        # forward f0..f(n-1), then back f(n-2)..f1 (neither end frame twice), so the loop turns round with no hold
        fc = (f"[0:v]split[a][b];[b]reverse,trim=start_frame=1:end_frame={n - 1},setpts=PTS-STARTPTS[r];"
              f"[a][r]concat=n=2:v=1:a=0,setsar=1,fps=30[o]")
        cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y", "-i", str(src), "-filter_complex", fc, "-map", "[o]", *common, str(tmp)]
    subprocess.run(cmd, check=True)
    tmp.replace(out)
    return out


def first_frame(video: Path) -> Image.Image:
    png = h.WORK / "loops" / f"{video.stem}-f0.png"
    png.parent.mkdir(parents=True, exist_ok=True)
    h.ffmpeg(["-i", video, "-frames:v", "1", png])
    return Image.open(png).convert("RGB")


def posters(spec: dict[str, Any], video: Path) -> tuple[Path, Path]:
    im = first_frame(video)
    x, y, w, hh = spec["crop"]
    win = im.crop((x, y, x + w, y + hh)).resize((640, 800), Image.LANCZOS)
    p45 = h.ensure(POSTER_DIR / f"{spec['slug']}-45.webp")
    win.save(p45, "WEBP", quality=80, method=6)
    full = im.resize((1280, round(1280 * im.height / im.width)), Image.LANCZOS)
    pfull = h.ensure(POSTER_DIR / f"{spec['slug']}-full.webp")
    full.save(pfull, "WEBP", quality=80, method=6)
    return p45, pfull


def gray_frames(video: Path, w: int = 192, hh: int = 108) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"scale={w}:{hh},format=gray", "-f", "rawvideo", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, hh * w).astype(np.float32)


def seam(video: Path) -> dict[str, float]:
    """How the loop closes: the step from the last frame to the first, against the median step between frames."""
    a = gray_frames(video)
    rm = lambda p, q: float(np.sqrt(((p - q) ** 2).mean()))  # noqa: E731
    steps = [rm(a[i], a[i + 1]) for i in range(len(a) - 1)]
    median = float(np.median(steps))
    closing = rm(a[-1], a[0])
    return {"frames": len(a), "closing_step": round(closing, 2), "median_step": round(median, 2), "ratio": round(closing / max(median, 1e-6), 2),
            "max_step": round(max(steps), 2)}


def sheets(done: list[tuple[dict[str, Any], Path]]) -> None:
    """For each loop: its 4:5 window at five moments, and the seam (the last two frames, then the first two)."""
    work = h.WORK / "loops"
    rows = []
    for spec, video in done:
        info = h.probe(video)
        n = frames_count(video)
        fps = 30
        x, y, w, hh = spec["crop"]
        picks = [0, n // 4, n // 2, 3 * n // 4]
        seam_ids = [n - 2, n - 1, 0, 1]
        tiles = []
        for idx in picks + seam_ids:
            png = work / f"{spec['slug']}-{idx}.png"
            h.ffmpeg(["-i", video, "-vf", f"select=eq(n\\,{idx}),crop={w}:{hh}:{x}:{y},scale=240:300", "-frames:v", "1", "-vsync", "0", png])
            tiles.append(Image.open(png).convert("RGB"))
        rows.append((spec["name"], info["dur"], tiles))
    s = Image.new("RGB", (8 * 244 + 20, len(rows) * 304), (14, 14, 14))
    for r, (_n, _d, tiles) in enumerate(rows):
        for c, t in enumerate(tiles):
            s.paste(t, (c * 244 + (20 if c >= 4 else 0), r * 304))
    s.save(work / "loops-sheet.jpg", quality=86)


def main() -> None:
    LOOP_DIR.mkdir(parents=True, exist_ok=True)
    POSTER_DIR.mkdir(parents=True, exist_ok=True)
    done = []
    total = 0
    for spec in LOOPS:
        if spec["kind"] == "still":
            w = window(spec, STILL_FULL)
            print(f"{spec['name']:10} still   window x {w['x']} w {w['w']} (card file img/home/cards/{spec['slug']}-45.webp)")
            continue
        video = encode(spec)
        first = h.probe(video)
        size = video.stat().st_size
        total += size
        full = (first["w"], first["h"])
        w = window(spec, full)
        posters(spec, video)
        sm = seam(video)
        print(f"{spec['name']:10} {spec['kind']:8} {full[0]}x{full[1]} {first['dur']:5.2f} s {size / 1e6:5.2f} MB  window x {w['x']} y {w['y']} w {w['w']} h {w['h']}  "
              f"seam: closing {sm['closing_step']} vs median {sm['median_step']} (x{sm['ratio']}), biggest step {sm['max_step']}")
        done.append((spec, video))
    print(f"total {total / 1e6:.2f} MB")
    if "--sheet" in sys.argv:
        sheets(done)


if __name__ == "__main__":
    main()
