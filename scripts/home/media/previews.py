"""The ten floating previews of the home page (the Psychoactive hold: a ring of film cards).

    C:/Users/muham/anaconda3/python.exe scripts/home/media/previews.py            build the ten clips and their posters
    C:/Users/muham/anaconda3/python.exe scripts/home/media/previews.py --sheet    also write the looking sheet of the clips
    C:/Users/muham/anaconda3/python.exe scripts/home/media/previews.py --scan     the looking sheet of the SOURCE windows (full frame)

One clip for each of the ten official films (`FILM_IDS` in features/library/video/links.ts, data
`public/data/library/video-films.json`), cut from the library's own files in the local mirror (read only).

    apps/web/public/video/home/preview/v2/<film-id>.mp4    4.0 s, 1280 wide, the film's own shape, 24 fps, H.264 Main, no audio, faststart
    apps/web/public/video/home/preview/v2/<film-id>.webp   the first frame of the clip (poster, 640 wide)

Round two (19 Nov 2026): the first version (`preview/<id>.mp4`, 560 by 286, cropped to 1.96 to 1) was low quality and cropped
the pictures. These are the whole picture at the film's real shape (16 to 9 for two films, about 2.37 to 1 for the other eight),
1280 wide (720p for the 16 to 9 ones), and the card of the orbit takes each clip's own shape. New file names (`v2/`), so no
saved copy of the old files is ever served for them.

With the whole picture the burned in subtitles of the films are in the frame. Every window of START was therefore chosen
again by looking at the full frames (`--scan`): no subtitle, no title card, no black frame, one scene or a clean cut. Where
the window passes a cut that is the film's own cut. Awakening was moved from the meadow (it showed the same garden as A Friend)
to the burning city, so every preview is its own scene.

The clip loops with no jump: the last 0.35 s dissolve into the head of the window (the same method as the trailer loop).
So the file is 4.0 s and the source window is 4.0 + XFADE.

Idempotent: the outputs are rebuilt the same way every run.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

import hcommon as h

OUT_W = 1280
LENGTH = 4.0
XFADE = 0.35
CRF = 21
POSTER_W = 640
OUT_DIR = h.VIDEO / "preview" / "v2"

# film id -> start of the window in the film, in seconds. The index is the film's place in FILM_IDS.
STARTS: dict[str, float] = {
    "film-selena-and-obsidia-video-trailer-001-3994447231709070185": 82.5,  # the blue lightning fight, a pink figure answering
    "film-selena-and-obsidia-video-selena-video": 36.6,  # the blue butterfly in the dark, chains, the shadow with its claws
    "film-selena-and-obsidia-video-obsidia-001-3997406762701005025": 39.2,  # Obsidia draws a dark star in her hand
    "film-vexana-and-guinevere-video-connection-lost-final-video": 8.9,  # the purple cloak walking on the ruined road, a staff, the broken city
    "film-vexana-and-guinevere-video-relink-final-video2": 13.95,  # Vexana's light burst and the pink ring
    "film-lesley-and-change-video-official-trailer-o3ryhixwofw": 13.5,  # the white robot beside a framed photograph
    "film-ruby-and-angela-video-ruby-ruby-final": 5.0,  # Ruby, the hologram cube on her eye
    "film-ruby-and-angela-video-angela-angela-final": 27.0,  # a hand reaches, then the meadow under the dome
    "film-ruby-and-angela-video-trailer-trailer-final": 118.0,  # two Aspirants in the burning city, a red eye
    "film-layla-and-fanny-video-official-lore-trailer-trailer": 28.8,  # Fanny with her blade in the white corridor
}


def film_items() -> list[dict]:
    films = {i["id"]: i for i in h.library_data("video-films")["items"]}
    order = list(STARTS)
    missing = [i for i in order if i not in films]
    if missing:
        raise SystemExit(f"films not in the data: {missing}")
    return [films[i] for i in order]


def out_size(w: int, hgt: int) -> tuple[int, int]:
    """The clip's size for a picture of w by hgt: OUT_W wide, the height of the same shape, both even (H.264 4:2:0)."""
    oh = round(OUT_W * hgt / w)
    return OUT_W, oh - (oh % 2)


def encode(film: dict, start: float) -> tuple[str, str]:
    v = film["video"]
    src = h.MIRROR / v["src"]
    ow, oh = out_size(v["w"], v["h"])
    vf = f"scale={ow}:{oh}:flags=lanczos,fps=24,setsar=1,format=yuv420p,setpts=PTS-STARTPTS"
    # main part without its head, then the head again as the tail: the dissolve closes the loop
    segs = [(start + XFADE, start + LENGTH + XFADE), (start, start + XFADE)]
    graph = ";".join(
        [f"[0:v]{vf}[a]", f"[1:v]{vf}[b]", f"[a][b]xfade=transition=fade:duration={XFADE}:offset={LENGTH - XFADE:.3f}[out]"]
    )
    out = h.ensure(OUT_DIR / f"{film['id']}.mp4")
    tmp = out.with_suffix(".part.mp4")
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y"]
    for s, e in segs:
        cmd += ["-ss", f"{s:.3f}", "-t", f"{e - s:.3f}", "-i", str(src)]
    cmd += ["-filter_complex", graph, "-map", "[out]", "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-profile:v", "main",
            "-pix_fmt", "yuv420p", "-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-movflags", "+faststart", "-an", str(tmp)]
    subprocess.run(cmd, check=True)
    tmp.replace(out)
    png = h.WORK / "previews" / f"{film['id']}.png"
    png.parent.mkdir(parents=True, exist_ok=True)
    h.ffmpeg(["-i", out, "-frames:v", "1", png])
    poster = out.with_suffix(".webp")
    with Image.open(png) as im:
        rgb = im.convert("RGB")
        ph = round(POSTER_W * rgb.height / rgb.width)
        rgb.resize((POSTER_W, ph), Image.LANCZOS).save(poster, "WEBP", quality=78, method=6)
    return str(out), str(poster)


def sheet(films: list[dict]) -> None:
    """The ten clips: frames at 0, 1, 2, 3 and 3.9 s of each, one row a film, each at its own shape."""
    work = h.WORK / "previews"
    work.mkdir(parents=True, exist_ok=True)
    tile_w = 400
    rows = []
    for film in films:
        row = []
        for t in (0.0, 1.0, 2.0, 3.0, 3.9):
            png = work / f"s-{film['id'][-12:]}-{t}.png"
            h.ffmpeg(["-ss", f"{t}", "-i", OUT_DIR / f"{film['id']}.mp4", "-frames:v", "1", png])
            im = Image.open(png).convert("RGB")
            row.append(im.resize((tile_w, round(tile_w * im.height / im.width)), Image.LANCZOS))
        rows.append(row)
    row_h = max(im.height for row in rows for im in row) + 3
    s = Image.new("RGB", (5 * (tile_w + 3), len(rows) * row_h), (12, 12, 12))
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            s.paste(im, (c * (tile_w + 3), r * row_h))
    s.save(work / "previews-sheet.jpg", quality=86)


def scan(films: list[dict]) -> None:
    """The source windows at full frame: six frames across each window, one row a film. Look for subtitles in them."""
    work = h.WORK / "previews"
    work.mkdir(parents=True, exist_ok=True)
    tile_w = 400
    rows = []
    for film in films:
        v = film["video"]
        start = STARTS[film["id"]]
        row = []
        for k in range(6):
            t = start + k * (LENGTH + XFADE) / 5.2
            png = work / f"w-{film['id'][-12:]}-{k}.png"
            h.ffmpeg(["-ss", f"{t:.2f}", "-i", h.MIRROR / v["src"], "-frames:v", "1", png])
            im = Image.open(png).convert("RGB")
            row.append(im.resize((tile_w, round(tile_w * im.height / im.width)), Image.LANCZOS))
        rows.append(row)
    row_h = max(im.height for row in rows for im in row) + 3
    s = Image.new("RGB", (6 * (tile_w + 3), len(rows) * row_h), (12, 12, 12))
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            s.paste(im, (c * (tile_w + 3), r * row_h))
    s.save(work / "windows-sheet.jpg", quality=86)


def main() -> None:
    films = film_items()
    if "--scan" in sys.argv:
        scan(films)
        return
    total = 0
    for film in films:
        start = STARTS[film["id"]]
        mp4, webp = encode(film, start)
        size = Path(mp4).stat().st_size
        total += size
        print(f"{film['title']:24} start {start:6.2f}  {size / 1024:6.0f} KB")
    print(f"total {total / 1e6:.2f} MB for {len(films)} clips")
    if "--sheet" in sys.argv:
        sheet(films)


if __name__ == "__main__":
    main()
