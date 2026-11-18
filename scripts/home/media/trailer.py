"""The trailer strip of the home page (the Psychoactive hero): a short loop of the Selena and Obsidia trailer.

    C:/Users/muham/anaconda3/python.exe scripts/home/media/trailer.py            build the loop
    C:/Users/muham/anaconda3/python.exe scripts/home/media/trailer.py --sheets   also write the looking sheets

Source (read only): media/selena-and-obsidia/video/trailer/001_3994447231709070185.mp4, VP9, 1920x1080 with black
bars (the picture is 1920x808, `crop=1920:808:0:136`), 24 fps, 180.8 s, with burned in English subtitles at the
foot (y 0.90 to 0.97 of the picture) and, from about 120 s, a song line at the very top.

What it makes
    The WHOLE picture (1920x808, ratio 2.376) is kept, never pre-cropped to the 3.7:1 strip: the page crops with CSS
    (object-fit: cover) so that the same file plays small in the strip and large after the expand.
    A loop of SEGMENTS joined by short dissolves, ending in a dissolve back into the first segment, so the seam of
    the loop is a continuous picture (the method of scripts/story/media.py `make_sequence`). Muted, H.264 High,
    24 fps, faststart.

        apps/web/public/video/home/strip-1280.mp4   1280x538  (the size every display below 2560 px wide takes)
        apps/web/public/video/home/strip-1920.mp4   1920x808  (written only when it is under STRIP_1920_MAX bytes)
        apps/web/public/img/home/strip-poster.webp  the first frame, 1280 wide

How the segments were chosen (all looked at, see media.md): the subtitle bands were scanned (a bright, static pixel
test in the bands, then frames every half second of every candidate), and only stretches with no subtitle in either
band were kept. 44.6 to 46.9 is the calm shot of the horned Ender queen in the purple hall (it ends on a cut at 46.96).
90.0 to 97.45 is the fight: no subtitle, hard cuts of the trailer itself at 91.17 and 95.42.

Look at the result: D:/ren/aspirant-work/home/D/trailer/loop-sheet.jpg and seam-sheet.jpg (with --sheets).
Idempotent: the outputs are rebuilt the same every run (the encoder is deterministic for the same input).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

import hcommon as h

SRC = h.MEDIA / "selena-and-obsidia" / "video" / "trailer" / "001_3994447231709070185.mp4"
CROP = "crop=1920:808:0:136"  # the picture, without the black bars
SEGMENTS = [(44.6, 46.9), (90.0, 97.45)]  # (start, end) seconds of the source
XFADE = 0.4
SIZES = {"1280": (1280, 538, 27), "1920": (1920, 808, 28)}  # name: (width, height, crf)
STRIP_1920_MAX = 4_000_000  # the owner's limit for the large copy


def filter_graph(width: int, height: int) -> tuple[str, float, list[float]]:
    """Inputs 0..n: first segment minus its head, the others whole, then the head of the first again as the tail."""
    s0, e0 = SEGMENTS[0]
    segs = [(s0 + XFADE, e0)] + SEGMENTS[1:] + [(s0, s0 + XFADE)]
    lengths = [e - s for s, e in segs]
    parts = []
    for i in range(len(segs)):
        parts.append(f"[{i}:v]{CROP},scale={width}:{height}:flags=lanczos,fps=24,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v{i}]")
    cur, cur_len = "v0", lengths[0]
    for i in range(1, len(segs)):
        parts.append(f"[{cur}][v{i}]xfade=transition=fade:duration={XFADE:.3f}:offset={cur_len - XFADE:.3f}[x{i}]")
        cur, cur_len = f"x{i}", cur_len + lengths[i] - XFADE
    parts.append(f"[{cur}]null[out]")
    return ";".join(parts), cur_len, [s for s, _e in segs]


def encode(name: str) -> tuple[Path, float]:
    width, height, crf = SIZES[name]
    graph, total, starts = filter_graph(width, height)
    s0, e0 = SEGMENTS[0]
    segs = [(s0 + XFADE, e0)] + SEGMENTS[1:] + [(s0, s0 + XFADE)]
    out = h.ensure(h.VIDEO / f"strip-{name}.mp4")
    tmp = out.with_suffix(".part.mp4")
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y"]
    for s, e in segs:
        cmd += ["-ss", f"{s:.3f}", "-t", f"{e - s:.3f}", "-i", str(SRC)]
    cmd += ["-filter_complex", graph, "-map", "[out]", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-profile:v", "high",
            "-pix_fmt", "yuv420p", "-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-movflags", "+faststart", "-an", str(tmp)]
    subprocess.run(cmd, check=True)
    tmp.replace(out)
    return out, total


def poster(video: Path) -> Path:
    out = h.ensure(h.IMG / "strip-poster.webp")
    png = h.WORK / "trailer" / "poster.png"
    png.parent.mkdir(parents=True, exist_ok=True)
    h.ffmpeg(["-i", video, "-frames:v", "1", "-vf", "scale=1280:-2:flags=lanczos", png])
    Image.open(png).convert("RGB").save(out, "WEBP", quality=82, method=6)
    return out


def sheets(video: Path, total: float) -> None:
    """A row of frames over the loop, and the seam: the last frames and the first frames, side by side."""
    work = h.WORK / "trailer"
    work.mkdir(parents=True, exist_ok=True)
    n = 20
    times = [i * (total - 0.05) / (n - 1) for i in range(n)]
    tiles = []
    for t in times:
        png = work / f"t{t:.2f}.png"
        h.ffmpeg(["-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-vf", "scale=384:-2", png])
        tiles.append((t, Image.open(png).convert("RGB")))
    cols = 5
    w, hh = tiles[0][1].size
    sheet = Image.new("RGB", (cols * (w + 4), ((n + cols - 1) // cols) * (hh + 4)), (15, 15, 15))
    for i, (_t, im) in enumerate(tiles):
        sheet.paste(im, ((i % cols) * (w + 4), (i // cols) * (hh + 4)))
    sheet.save(work / "loop-sheet.jpg", quality=86)
    seam = [total - 0.13, total - 0.08, total - 0.04, 0.0, 0.04, 0.08]
    ims = []
    for k, t in enumerate(seam):
        png = work / f"s{k}.png"
        h.ffmpeg(["-ss", f"{max(t, 0):.3f}", "-i", video, "-frames:v", "1", "-vf", "scale=480:-2", png])
        ims.append(Image.open(png).convert("RGB"))
    w, hh = ims[0].size
    s2 = Image.new("RGB", (3 * (w + 4), 2 * (hh + 4)), (15, 15, 15))
    for i, im in enumerate(ims):
        s2.paste(im, ((i % 3) * (w + 4), (i // 3) * (hh + 4)))
    s2.save(work / "seam-sheet.jpg", quality=88)


def main() -> None:
    out1280, total = encode("1280")
    print(f"strip-1280.mp4 {total:.2f} s  {out1280.stat().st_size / 1e6:.2f} MB")
    out1920, _ = encode("1920")
    size = out1920.stat().st_size
    if size > STRIP_1920_MAX:
        out1920.unlink()
        print(f"strip-1920.mp4 would be {size / 1e6:.2f} MB, over {STRIP_1920_MAX / 1e6:.0f} MB: not kept")
    else:
        print(f"strip-1920.mp4 {size / 1e6:.2f} MB")
    p = poster(out1280)
    print(f"{p.relative_to(h.REPO)} {p.stat().st_size / 1024:.0f} KB")
    if "--sheets" in sys.argv:
        sheets(out1280, total)


if __name__ == "__main__":
    main()
