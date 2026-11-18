"""The ten floating previews of the home page (the Psychoactive hold: a ring of film cards).

    C:/Users/muham/anaconda3/python.exe scripts/home/media/previews.py            build the ten clips and their posters
    C:/Users/muham/anaconda3/python.exe scripts/home/media/previews.py --sheet    also write the looking sheet

One clip for each of the ten official films (`FILM_IDS` in features/library/video/links.ts, data
`public/data/library/video-films.json`), cut from the library's own files in the local mirror (read only).

    apps/web/public/video/home/preview/<film-id>.mp4    4.0 s, 560x286, 24 fps, H.264 Main, no audio, faststart
    apps/web/public/video/home/preview/<film-id>.webp   the first frame of the clip (poster)

The card of the reference is 1.45 by 0.74 (1.96 to 1), so every clip is cropped to that shape. The crop keeps
the full height between 7 and 87 percent of the picture (CROP_Y0, CROP_H) and takes the middle in width, which
leaves out the burned in subtitles of the films (they sit below 88 percent, and a few lines of Re:Link and
Connection Lost at the very top). Each window of START was chosen by eye from frames every half second
(`sheet` in the notes): no subtitle, no title card, no black frame, one scene or a clean cut. Where the window
passes a cut that is the film's own cut.

The clip loops with no jump: the last 0.35 s dissolve into the head of the window (the same method as the
trailer strip). So the file is 4.0 s and the source window is 4.0 + XFADE.

Idempotent: the outputs are rebuilt the same way every run.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

import hcommon as h

CARD_W, CARD_H = 560, 286  # 1.958 to 1
CROP_Y0, CROP_H = 0.07, 0.80
CARD_RATIO = CARD_W / CARD_H
LENGTH = 4.0
XFADE = 0.35
CRF = 26

# film id -> start of the window in the film, in seconds. The index is the film's place in FILM_IDS.
STARTS: dict[str, float] = {
    "film-selena-and-obsidia-video-trailer-001-3994447231709070185": 56.2,  # Selena and Obsidia face to face, two shots
    "film-selena-and-obsidia-video-selena-video": 5.9,  # Selena runs along a rooftop, the silver dragon beside her
    "film-selena-and-obsidia-video-obsidia-001-3997406762701005025": 39.2,  # Obsidia draws a dark star in her hand
    "film-vexana-and-guinevere-video-connection-lost-final-video": 56.0,  # a selfie on the roof, then Fanny in profile
    "film-vexana-and-guinevere-video-relink-final-video2": 13.95,  # Vexana's light burst and the pink ring
    "film-lesley-and-change-video-official-trailer-o3ryhixwofw": 11.0,  # the girl in red light, then the white robot
    "film-ruby-and-angela-video-ruby-ruby-final": 5.0,  # Ruby, the hologram cube on her eye
    "film-ruby-and-angela-video-angela-angela-final": 27.0,  # a hand reaches, then the meadow under the dome
    "film-ruby-and-angela-video-trailer-trailer-final": 64.7,  # the meadow, an arm, two girls face to face
    "film-layla-and-fanny-video-official-lore-trailer-trailer": 28.8,  # Fanny with her blade in the white corridor
}


def film_items() -> list[dict]:
    films = {i["id"]: i for i in h.library_data("video-films")["items"]}
    order = list(STARTS)
    missing = [i for i in order if i not in films]
    if missing:
        raise SystemExit(f"films not in the data: {missing}")
    return [films[i] for i in order]


def crop_box(w: int, hgt: int) -> tuple[int, int, int, int]:
    """(width, height, x, y) of the 1.96 to 1 window inside a picture of w by hgt: the middle, 7 to 87 percent tall."""
    ch = round(hgt * CROP_H)
    cw = min(w, round(ch * CARD_RATIO))
    if cw == w:
        ch = round(w / CARD_RATIO)
    return cw, ch, (w - cw) // 2, round(hgt * CROP_Y0)


def encode(film: dict, start: float) -> tuple[str, str]:
    v = film["video"]
    src = h.MIRROR / v["src"]
    cw, ch, x0, y0 = crop_box(v["w"], v["h"])
    vf = f"crop={cw}:{ch}:{x0}:{y0},scale={CARD_W}:{CARD_H}:flags=lanczos,fps=24,setsar=1,format=yuv420p,setpts=PTS-STARTPTS"
    # main part without its head, then the head again as the tail: the dissolve closes the loop
    segs = [(start + XFADE, start + LENGTH + XFADE), (start, start + XFADE)]
    graph = ";".join(
        [f"[0:v]{vf}[a]", f"[1:v]{vf}[b]", f"[a][b]xfade=transition=fade:duration={XFADE}:offset={LENGTH - XFADE:.3f}[out]"]
    )
    out = h.ensure(h.VIDEO / "preview" / f"{film['id']}.mp4")
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
    Image.open(png).convert("RGB").save(poster, "WEBP", quality=78, method=6)
    return str(out), str(poster)


def sheet(films: list[dict]) -> None:
    """The ten clips: frames at 0, 1, 2, 3 and 3.9 s of each, one row a film."""
    work = h.WORK / "previews"
    tiles = []
    for film in films:
        row = []
        for t in (0.0, 1.0, 2.0, 3.0, 3.9):
            png = work / f"s-{film['id'][-12:]}-{t}.png"
            h.ffmpeg(["-ss", f"{t}", "-i", h.VIDEO / "preview" / f"{film['id']}.mp4", "-frames:v", "1", png])
            row.append(Image.open(png).convert("RGB"))
        tiles.append(row)
    s = Image.new("RGB", (5 * (CARD_W + 3), len(tiles) * (CARD_H + 3)), (12, 12, 12))
    for r, row in enumerate(tiles):
        for c, im in enumerate(row):
            s.paste(im, (c * (CARD_W + 3), r * (CARD_H + 3)))
    s.save(work / "previews-sheet.jpg", quality=86)


def main() -> None:
    films = film_items()
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
