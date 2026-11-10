"""Music room: the songs, the page themes and the long listens, with their credits.

Run with the anaconda Python (needs ffmpeg on the PATH):

    C:/Users/muham/anaconda3/python.exe scripts/library/music/build.py

Sources (read only)
    media/layla-and-fanny/music/we-believe.m4a                 We Believe, AAC 390 kbps
    media/selena-and-obsidia/video/music-collection/*.mp4      the official soundtrack film (14 min)
        The title cards of the film name each track, its composer, lyricist, vocalist and release
        month. The silences between the tracks (found with ffmpeg silencedetect) are the cut points.
    media/selena-and-obsidia/video/music-collection/*-cover.jpg  the two single covers
    audio/obsidia/long/obsidia-aspirant.mp3, obsidia-solo.mp3

Writes
    <mirror>/library/v1/music/<id>.m4a        the stream of each track
    <mirror>/library/v1/music/original/...    the file as the studio made it, for the download link
    <mirror>/library/v1/music/covers/<id>/    cover pictures (t, p, f)
    <mirror>/library/v1/music/discs/<id>.webp the face of each disc of the room (discs.py), and the
                                              shape of each track's sound (`wave`, in the data)
    apps/web/public/data/library/music.json

Which source wins for a track the film and the site both have: the film's own audio, cut at the
silence and copied without re-encoding (no generation loss). The old site files were identified
(cross correlation of spectrograms) as the same recordings, re-encoded at 128 kbps from a source
that is not in the library, so they are not used.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import discs  # noqa: E402

WORK = common.WORK / "music"
WORK.mkdir(parents=True, exist_ok=True)

COLL_DIR = common.MEDIA / "selena-and-obsidia" / "video" / "music-collection"
COLL_VIDEO = next(COLL_DIR.glob("*.mp4"))
WE_BELIEVE_SRC = common.MEDIA / "layla-and-fanny" / "music" / "we-believe.m4a"
MP3_DIR = common.AUDIO / "obsidia" / "long"


def film_id(rel_path: str) -> str:
    """The Films room's id: `film-` plus the slug of the path under media/ without its extension."""
    stem = re.sub(r"\.[A-Za-z0-9]+$", "", rel_path)
    return "film-" + common.slugify(stem)


F_COLLECTION = film_id(COLL_VIDEO.relative_to(common.MEDIA).as_posix())
F_TRAILER = film_id("layla-and-fanny/video/official/lore/trailer/trailer.webm")
F_VIDEO = film_id("layla-and-fanny/video/official/other/music-video/music.webm")
F_BTS = film_id("layla-and-fanny/video/official/other/music-bts/music-bts.webm")
F_TALK = film_id("layla-and-fanny/video/official/other/music-producer-talk/music-producer-talk.webm")
F_VA = film_id("layla-and-fanny/video/official/other/va-bts/video.mp4")

# Cut points in the soundtrack film, in seconds. They come from ffmpeg silencedetect (-45 dB,
# 0.4 s): the silence before each title card. Start = end of the silence before the track,
# end = start of the silence after it. The 0.45 s rest near 333 s is inside Gray New World.
CUTS = {
    "lullaby": (0.0, 189.12),
    "gray": (191.35, 366.21),
    "vexana": (368.22, 472.83),
    "guinevere": (473.99, 578.58),
    "change-lesley": (580.39, 722.05),
    "we-believe": (723.80, 846.10),
}
PAD = 0.12  # a little into the silence on each side, so nothing is clipped

SITE = "site:"  # a cover that is a picture of the site itself (public/img/...)


def run(cmd: list[str]) -> None:
    subprocess.run([str(c) for c in cmd], check=True, capture_output=True)


def duration(path: Path) -> float:
    last: Exception | None = None
    for _ in range(4):
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                capture_output=True, encoding="utf-8", errors="replace", check=True, timeout=120,
            ).stdout
            value = round(float(out.strip()), 2)
            if value > 0:
                return value
        except (subprocess.SubprocessError, ValueError) as e:  # noqa: PERF203
            last = e
    raise SystemExit(f"no duration for {path}: {last}")


def cut_copy(src: Path, out: Path, t0: float, t1: float) -> None:
    """Cut [t0, t1] out of an AAC file without re-encoding."""
    if common.fresh(out, src):
        return
    tmp = out.with_suffix(".tmp.m4a")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{max(0.0, t0 - PAD):.3f}", "-to", f"{t1 + PAD:.3f}",
         "-i", src, "-vn", "-map_metadata", "-1", "-c:a", "copy", "-movflags", "+faststart", tmp])
    tmp.replace(out)


def encode(src: Path, out: Path, bitrate: str) -> None:
    if common.fresh(out, src):
        return
    tmp = out.with_suffix(".tmp.m4a")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-vn", "-map_metadata", "-1", "-c:a", "aac",
         "-b:a", bitrate, "-movflags", "+faststart", tmp])
    tmp.replace(out)


def copy(src: Path, out: Path) -> None:
    if out.exists() and out.stat().st_size == src.stat().st_size and out.stat().st_mtime >= src.stat().st_mtime:
        return
    shutil.copyfile(src, out)


def main() -> None:
    # 1. The soundtrack film's sound, copied out once (no re-encode).
    coll_m4a = WORK / "collection.m4a"
    if not common.fresh(coll_m4a, COLL_VIDEO):
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", COLL_VIDEO, "-vn", "-map_metadata", "-1", "-c:a", "copy",
             "-movflags", "+faststart", coll_m4a])
    coll_dur = duration(coll_m4a)

    # 2. Covers. The two single covers are official pictures from the film's folder.
    covers: dict[str, dict[str, Any]] = {}
    covers["lullaby"] = common.image_set(COLL_DIR / "obsidia-cover.jpg", "music/covers/lullaby-of-oblivion")
    covers["gray"] = common.image_set(COLL_DIR / "selena-cover.jpg", "music/covers/gray-new-world")
    # The film's own poster stands for the whole soundtrack.
    covers["soundtrack"] = common.image_set(COLL_DIR / "thumbnail.jpg", "music/covers/soundtrack")

    def site_cover(path: str) -> dict[str, Any]:
        return {"site": path}

    def cover_of(key: str, fallback: str) -> dict[str, Any]:
        if key in covers:
            c = covers[key]
            return {"t": c["t"], "p": c["p"], "f": c["f"], "c": c["c"]}
        return site_cover(fallback)

    items: list[dict[str, Any]] = []

    def add(
        slug_id: str, title: str, *, kind: str, ep: str | None, chars: list[str], pair: str | None,
        credits: list[dict[str, str]], released: str | None, src_key: str, dur: float, cover: dict[str, Any],
        films: list[dict[str, str]], about: str, orig: str | None = None, quality: str = "",
        chapters: list[dict[str, Any]] | None = None, tags: list[str] | None = None,
    ) -> None:
        item: dict[str, Any] = {
            "id": f"music-{slug_id}",
            "title": title,
            "collection": "music",
            "chars": chars,
            "pair": pair,
            "canon": "official",
            "tags": tags or [],
            "kind": kind,
            "ep": ep,
            "credits": credits,
            "released": released,
            "src": src_key,
            "dur": dur,
            "cover": cover,
            "films": films,
            "about": about,
            "quality": quality,
        }
        if orig:
            item["orig"] = orig
        if chapters:
            item["chapters"] = chapters
        # The disc of the room: its face and the shape of its sound.
        item.update(discs.disc_fields(slug_id, src_key))
        items.append(item)

    # 3. We Believe, the full song (EP 01).
    wb_out = common.key_path("music/we-believe.m4a")
    encode(WE_BELIEVE_SRC, wb_out, "192k")
    wb_orig = common.key_path("music/original/we-believe.m4a")
    copy(WE_BELIEVE_SRC, wb_orig)
    add(
        "we-believe", "We Believe", kind="song", ep="EP 01", chars=["fanny", "layla"], pair="fanny-layla",
        credits=[{"role": "Music", "name": "Yasuharu Takanashi"}, {"role": "Lyrics", "name": "Funta7"},
                 {"role": "Vocals", "name": "Yoshino Nanjo"}],
        released="01/2022", src_key="music/we-believe.m4a", dur=duration(WE_BELIEVE_SRC),
        cover=site_cover("img/pair/fanny-layla/fanny-and-layla.webp"),
        films=[
            {"id": F_TRAILER, "label": "The Aspirants trailer"},
            {"id": F_VIDEO, "label": "Music video"},
            {"id": F_BTS, "label": "Behind the scenes of the song"},
            {"id": F_TALK, "label": "The music producer talks"},
            {"id": F_VA, "label": "Voice actor behind the scenes"},
        ],
        about="The theme song of The Aspirants and of Fanny and Layla's skins. Yoshino Nanjo is Layla's voice actor and also sings it.",
        orig="music/original/we-believe.m4a", quality="Streams at 192 kbps AAC. The download is the original 390 kbps file.",
        tags=["song", "theme song", "we believe"],
    )

    # 4. The tracks cut from the soundtrack film (copied, not re-encoded).
    def cut_item(cut_id: str, slug_id: str, title: str, **kw: Any) -> None:
        t0, t1 = CUTS[cut_id]
        out = common.key_path(f"music/{slug_id}.m4a")
        cut_copy(coll_m4a, out, t0, t1)
        add(slug_id, title, src_key=f"music/{slug_id}.m4a", dur=duration(out), **kw)

    film_coll = {"id": F_COLLECTION, "label": "The Aspirants soundtrack film", "t": 0}

    cut_item(
        "change-lesley", "change-lesley-display", "Chang'e and Lesley, display background music",
        kind="theme", ep="EP 03", chars=["lesley", "change"], pair="lesley-change",
        credits=[{"role": "Music", "name": "Steven Song"}], released="03/2024",
        cover=site_cover("img/char/lesley/splash-sm.webp"),
        films=[{**film_coll, "t": CUTS["change-lesley"][0]}],
        about="The music that plays on the skin display screen of Chang'e and Lesley.",
        quality="Cut from the soundtrack film's own audio (about 69 kbps HE-AAC), copied without re-encoding.",
        tags=["theme", "display music"],
    )
    cut_item(
        "vexana", "cross-credo-vexana", "CROSS\u00d7CREDO: Vexana Version",
        kind="theme", ep="EP 04", chars=["vexana"], pair="guinevere-vexana",
        credits=[{"role": "Music and arrangement", "name": "Nika Lenz"}, {"role": "Lyrics", "name": "Konomi Fujimura"},
                 {"role": "Vocals", "name": "WaMi"}],
        released="10/2025", cover=site_cover("img/char/vexana/splash-sm.webp"),
        films=[{**film_coll, "t": CUTS["vexana"][0]}],
        about="Vexana's side of CROSS\u00d7CREDO. The song has a second version for Guinevere.",
        quality="Cut from the soundtrack film's own audio (about 69 kbps HE-AAC), copied without re-encoding.",
        tags=["theme", "cross credo", "vexana"],
    )
    cut_item(
        "guinevere", "cross-credo-guinevere", "CROSS\u00d7CREDO: Guinevere Version",
        kind="theme", ep="EP 04", chars=["guinevere"], pair="guinevere-vexana",
        credits=[{"role": "Music and arrangement", "name": "Nika Lenz"}, {"role": "Lyrics", "name": "Konomi Fujimura"},
                 {"role": "Vocals", "name": "Eye"}],
        released="10/2025", cover=site_cover("img/char/guinevere/splash-sm.webp"),
        films=[{**film_coll, "t": CUTS["guinevere"][0]}],
        about="Guinevere's side of CROSS\u00d7CREDO. The song has a second version for Vexana.",
        quality="Cut from the soundtrack film's own audio (about 69 kbps HE-AAC), copied without re-encoding.",
        tags=["theme", "cross credo", "guinevere"],
    )
    cut_item(
        "gray", "gray-new-world", "Gray New World",
        kind="song", ep="EP 05", chars=["selena", "obsidia"], pair="selena-obsidia",
        credits=[{"role": "Music", "name": "Nika Lenz"}, {"role": "Lyrics", "name": "Konomi Fujimura"},
                 {"role": "Vocals", "name": "Rino"}],
        released="10/2026", cover=cover_of("gray", "img/char/selena/splash-sm.webp"),
        films=[{**film_coll, "t": CUTS["gray"][0]}],
        about="A song from the Selena and Obsidia release. On Spotify since October 2026.",
        quality="Cut from the soundtrack film's own audio (about 69 kbps HE-AAC), copied without re-encoding.",
        tags=["song", "gray new world", "selena", "obsidia"],
    )
    cut_item(
        "lullaby", "lullaby-of-oblivion", "Lullaby of Oblivion",
        kind="song", ep="EP 06", chars=["selena", "obsidia"], pair="selena-obsidia",
        credits=[{"role": "Music", "name": "Kosuke Mizukami"}, {"role": "Lyrics", "name": "Kosuke Mizukami"},
                 {"role": "Vocals", "name": "SAK"}],
        released="10/2026", cover=cover_of("lullaby", "img/char/obsidia/splash-sm.webp"),
        films=[{**film_coll, "t": CUTS["lullaby"][0]}],
        about="A song from the Selena and Obsidia release. On Spotify since October 2026.",
        quality="Cut from the soundtrack film's own audio (about 69 kbps HE-AAC), copied without re-encoding.",
        tags=["song", "lullaby of oblivion", "selena", "obsidia"],
    )

    # 5. Obsidia's two pieces (mp3 in the library, so they are converted to AAC for streaming).
    mp3s = [
        ("obsidia-aspirant", "Obsidia: Aspirant", MP3_DIR / "obsidia-aspirant.mp3"),
        ("obsidia-solo", "Obsidia: Solo", MP3_DIR / "obsidia-solo.mp3"),
    ]
    for slug_id, title, src in mp3s:
        out = common.key_path(f"music/{slug_id}.m4a")
        encode(src, out, "192k")
        orig = common.key_path(f"music/original/{slug_id}.mp3")
        copy(src, orig)
        add(
            slug_id, title, kind="piece", ep=None, chars=["obsidia"], pair="selena-obsidia", credits=[],
            released=None, src_key=f"music/{slug_id}.m4a", dur=duration(out),
            cover=site_cover("img/char/obsidia/splash-sm.webp"), films=[],
            about="One of two Obsidia pieces in the library. The sources do not name the piece or who made it.",
            orig=f"music/original/{slug_id}.mp3", quality="Streams at 192 kbps AAC. The download is the original MP3.",
            tags=["piece", "obsidia"],
        )

    # 6. The whole soundtrack film as one long listen, with a chapter for each track.
    full_out = common.key_path("music/soundtrack-full.m4a")
    if not common.fresh(full_out, coll_m4a):
        shutil.copyfile(coll_m4a, full_out)
    chapters = [
        {"t": CUTS["lullaby"][0], "title": "Lullaby of Oblivion"},
        {"t": CUTS["gray"][0], "title": "Gray New World"},
        {"t": CUTS["vexana"][0], "title": "CROSS\u00d7CREDO: Vexana Version"},
        {"t": CUTS["guinevere"][0], "title": "CROSS\u00d7CREDO: Guinevere Version"},
        {"t": CUTS["change-lesley"][0], "title": "Chang'e and Lesley, display background music"},
        {"t": CUTS["we-believe"][0], "title": "We Believe (short cut)"},
    ]
    add(
        "soundtrack-full", "The Aspirants soundtrack, in full", kind="compilation", ep=None,
        chars=[], pair=None, credits=[], released="10/2026", src_key="music/soundtrack-full.m4a", dur=coll_dur,
        cover=cover_of("soundtrack", "img/char/obsidia/splash-sm.webp"),
        films=[film_coll],
        about="The sound of the official soundtrack film, from the newest track to the oldest: six tracks in 14 minutes. Press a chapter to jump to it.",
        quality="The film's own audio (about 69 kbps HE-AAC), copied without re-encoding.",
        chapters=chapters, tags=["compilation", "soundtrack", "long"],
    )

    ids = [i["id"] for i in items]
    assert len(set(ids)) == len(ids)
    totals = {"tracks": len(items), "seconds": round(sum(i["dur"] for i in items), 1)}
    common.write_json("music", {"v": 1, "slug": "music", "totals": totals, "items": items})

    total_bytes = sum(p.stat().st_size for p in (common.LIB_ROOT / "music").rglob("*") if p.is_file())
    print(f"music items {len(items)}: {totals}; mirror music/ {common.human(total_bytes)}")
    for i in items:
        print(f"  {i['id']:36s} {i['dur']:7.2f}s  {i['src']}")


if __name__ == "__main__":
    main()
