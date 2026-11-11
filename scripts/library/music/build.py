"""Music room: the seven tracks the owner chose (11 Nov 2026), in the owner's order, with their credits.

Run with the anaconda Python (needs ffmpeg on the PATH):

    C:/Users/muham/anaconda3/python.exe scripts/library/music/build.py

Sources (read only)
    media/layla-and-fanny/music/we-believe.m4a                 We Believe!, AAC 390 kbps
    media/selena-and-obsidia/video/music-collection/*.mp4      the official soundtrack film (14 min)
        The title cards of the film name each track, its composer, lyricist, vocalist and release
        month. The silences between the tracks (found with ffmpeg silencedetect and a loudness
        print every 10 ms) are the cut points.
    media/selena-and-obsidia/video/music-collection/*-cover.jpg  the two single covers

Writes
    <mirror>/library/v1/music/<key>.m4a       the stream of each track
    <mirror>/library/v1/music/original/...    the file as the studio made it, for the download link
    <mirror>/library/v1/music/covers/<id>/    cover pictures (t, p, f)
    <mirror>/library/v1/music/discs/<id>.webp the face of each disc of the room (discs.py), and the
                                              shape of each track's sound (`wave`, in the data)
    apps/web/public/data/library/music.json

A key that is in the mirror is never written again: the bucket caches every key for 30 days. A
track whose sound must change gets a new key (Chang'e & Lesley Music moved to `-v2` when the
Angela & Ruby piece was cut out of its end).

Which source wins for a track the film and the site both have: the film's own audio, cut at the
silence and copied without re-encoding (no generation loss). The old site files were identified
(cross correlation of spectrograms) as the same recordings, re-encoded at 128 kbps from a source
that is not in the library, so they are not used.
"""

from __future__ import annotations

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


def film_id(rel_path: str) -> str:
    """The Video rooms' id: `film-` plus the slug of the path under media/ without its extension."""
    stem = re.sub(r"\.[A-Za-z0-9]+$", "", rel_path)
    return "film-" + common.slugify(stem)


# The soundtrack video (in the Others room) and the We Believe! films.
F_COLLECTION = film_id(COLL_VIDEO.relative_to(common.MEDIA).as_posix())
F_TRAILER = film_id("layla-and-fanny/video/official/lore/trailer/trailer.webm")
F_VIDEO = film_id("layla-and-fanny/video/official/other/music-video/music.webm")
F_BTS = film_id("layla-and-fanny/video/official/other/music-bts/music-bts.webm")
F_TALK = film_id("layla-and-fanny/video/official/other/music-producer-talk/music-producer-talk.webm")
F_VA = film_id("layla-and-fanny/video/official/other/va-bts/video.mp4")

# The ten films of the Films room, as `FILM_IDS` in `features/library/video/links.ts` names them.
F_DAY_OF_ENDERS = "film-selena-and-obsidia-video-trailer-001-3994447231709070185"
F_SELENA = "film-selena-and-obsidia-video-selena-video"
F_OBSIDIA = "film-selena-and-obsidia-video-obsidia-001-3997406762701005025"
F_CONNECTION_LOST = "film-vexana-and-guinevere-video-connection-lost-final-video"
F_RELINK = "film-vexana-and-guinevere-video-relink-final-video2"
F_LESLEY_CHANGE = "film-lesley-and-change-video-official-trailer-o3ryhixwofw"
F_RUBY = "film-ruby-and-angela-video-ruby-ruby-final"
F_ANGELA = "film-ruby-and-angela-video-angela-angela-final"
F_RUBY_ANGELA = "film-ruby-and-angela-video-trailer-trailer-final"

# Cut points in the soundtrack film, in seconds: (start, end, pad before, pad after). They come
# from ffmpeg silencedetect (-45 dB, 0.4 s) and, where two pieces touch, from a loudness print every
# 10 ms. The 0.45 s rest near 333 s is inside Gray New World.
#  - Chang'e & Lesley fades out from 641.5 s to 644.49 s; Angela & Ruby starts hard at 644.57 s.
#    Neither side is padded there, so neither piece carries the other's edge.
#  - Angela & Ruby fades to nothing at 722.8 s; the We Believe! card starts at 723.8 s.
CUTS: dict[str, tuple[float, float, float, float]] = {
    "lullaby": (0.0, 189.12, 0.12, 0.12),
    "gray": (191.35, 366.21, 0.12, 0.12),
    "vexana": (368.22, 472.83, 0.12, 0.12),
    "guinevere": (473.99, 578.58, 0.12, 0.12),
    "change-lesley": (580.39, 644.49, 0.12, 0.0),
    "angela-ruby": (644.50, 722.80, 0.0, 0.0),
}

# Where each track starts in the soundtrack video, as the owner timed it (whole seconds). The Watch
# list opens the video there. Each is within two seconds of the cut above (checked below).
SOUNDTRACK_AT = {
    "gray": 191,  # 3:11
    "lullaby": 2,  # 0:02
    "vexana": 368,  # 6:08
    "guinevere": 474,  # 7:54
    "change-lesley": 580,  # 9:40
    "angela-ruby": 644,  # 10:44
}

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


def kept(out: Path) -> bool:
    """A key already in the mirror stays as it is (the bucket caches it for 30 days)."""
    return out.exists() and out.stat().st_size > 0


def cut_copy(src: Path, out: Path, cut: tuple[float, float, float, float]) -> None:
    """Cut a piece out of an AAC file without re-encoding."""
    if kept(out):
        return
    t0, t1, pad0, pad1 = cut
    tmp = out.with_suffix(".tmp.m4a")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{max(0.0, t0 - pad0):.3f}", "-to", f"{t1 + pad1:.3f}",
         "-i", src, "-vn", "-map_metadata", "-1", "-c:a", "copy", "-movflags", "+faststart", tmp])
    tmp.replace(out)


def encode(src: Path, out: Path, bitrate: str) -> None:
    if kept(out):
        return
    tmp = out.with_suffix(".tmp.m4a")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-vn", "-map_metadata", "-1", "-c:a", "aac",
         "-b:a", bitrate, "-movflags", "+faststart", tmp])
    tmp.replace(out)


def copy(src: Path, out: Path) -> None:
    if kept(out):
        return
    shutil.copyfile(src, out)


def main() -> None:
    # 1. The soundtrack film's sound, copied out once (no re-encode).
    coll_m4a = WORK / "collection.m4a"
    if not common.fresh(coll_m4a, COLL_VIDEO):
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", COLL_VIDEO, "-vn", "-map_metadata", "-1", "-c:a", "copy",
             "-movflags", "+faststart", coll_m4a])

    for cut_id, at in SOUNDTRACK_AT.items():
        assert abs(CUTS[cut_id][0] - at) <= 2.0, f"{cut_id}: the owner's time {at} is far from the cut"

    # 2. Covers. The two single covers are official pictures from the film's folder.
    covers: dict[str, dict[str, Any]] = {}
    covers["lullaby"] = common.image_set(COLL_DIR / "obsidia-cover.jpg", "music/covers/lullaby-of-oblivion")
    covers["gray"] = common.image_set(COLL_DIR / "selena-cover.jpg", "music/covers/gray-new-world")

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
        films: list[dict[str, Any]], about: str, orig: str | None = None, quality: str = "",
        links: dict[str, str] | None = None, tags: list[str] | None = None,
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
        if links:
            item["links"] = links
        if orig:
            item["orig"] = orig
        # The disc of the room: its face and the shape of its sound.
        item.update(discs.disc_fields(slug_id, src_key))
        items.append(item)

    def soundtrack(cut_id: str) -> dict[str, Any]:
        return {"id": F_COLLECTION, "label": "Soundtrack video", "t": SOUNDTRACK_AT[cut_id]}

    # 3. The tracks cut from the soundtrack film (copied, not re-encoded).
    def cut_item(cut_id: str, slug_id: str, title: str, *, key: str | None = None, **kw: Any) -> None:
        src_key = key or f"music/{slug_id}.m4a"
        out = common.key_path(src_key)
        cut_copy(coll_m4a, out, CUTS[cut_id])
        add(slug_id, title, src_key=src_key, dur=duration(out), **kw)

    cut_quality = "Cut from the soundtrack film's own audio (about 69 kbps HE-AAC), copied without re-encoding."

    cut_item(
        "gray", "gray-new-world", "Gray New World",
        kind="song", ep="EP 05", chars=["selena", "obsidia"], pair="selena-obsidia",
        credits=[{"role": "Music", "name": "Nika Lenz"}, {"role": "Lyrics", "name": "Konomi Fujimura"},
                 {"role": "Vocals", "name": "Rino"}],
        released="10/2026", cover=cover_of("gray", "img/char/selena/splash-sm.webp"),
        films=[
            {"id": F_SELENA, "label": "Selena trailer"},
            {"id": F_DAY_OF_ENDERS, "label": "Day of Enders"},
            soundtrack("gray"),
        ],
        links={
            "spotify": "https://open.spotify.com/album/3RqpCLaKIsE0RprxgkQMvy",
            "apple": "https://music.apple.com/id/album/gray-new-world-single/6822303373",
            "youtube": "https://www.youtube.com/playlist?list=OLAK5uy_mZimUbXj63eiFE-h9d6836LUeHjw9VJX0",
            "more": "https://sndo.ffm.to/nbv6a32",
        },
        about="A song from the Selena and Obsidia release. On Spotify since October 2026.",
        quality=cut_quality, tags=["song", "gray new world", "selena", "obsidia"],
    )
    cut_item(
        "lullaby", "lullaby-of-oblivion", "Lullaby of Oblivion",
        kind="song", ep="EP 06", chars=["selena", "obsidia"], pair="selena-obsidia",
        credits=[{"role": "Music", "name": "Kosuke Mizukami"}, {"role": "Lyrics", "name": "Kosuke Mizukami"},
                 {"role": "Vocals", "name": "SAK"}],
        released="10/2026", cover=cover_of("lullaby", "img/char/obsidia/splash-sm.webp"),
        films=[
            {"id": F_OBSIDIA, "label": "Obsidia trailer"},
            {"id": F_DAY_OF_ENDERS, "label": "Day of Enders"},
            soundtrack("lullaby"),
        ],
        links={
            "spotify": "https://open.spotify.com/album/3k8oWwDgD1HjsQD7y4eI3x",
            "apple": "https://music.apple.com/id/album/lullaby-of-oblivion-single/6822281114",
            "youtube": "https://www.youtube.com/playlist?list=OLAK5uy_m_bzm35RhNtFq9nbbM3jcvFSbocSytUVE",
            "more": "https://sndo.ffm.to/y54mdda",
        },
        about="A song from the Selena and Obsidia release. On Spotify since October 2026.",
        quality=cut_quality, tags=["song", "lullaby of oblivion", "selena", "obsidia"],
    )
    cut_item(
        "vexana", "cross-credo-vexana", "Cross x Credo: Vexana version",
        kind="theme", ep="EP 04", chars=["vexana"], pair="guinevere-vexana",
        credits=[{"role": "Music and arrangement", "name": "Nika Lenz"}, {"role": "Lyrics", "name": "Konomi Fujimura"},
                 {"role": "Vocals", "name": "WaMi"}],
        released="10/2025", cover=site_cover("img/char/vexana/splash-sm.webp"),
        films=[
            {"id": F_CONNECTION_LOST, "label": "Connection Lost"},
            {"id": F_RELINK, "label": "Re:Link"},
            soundtrack("vexana"),
        ],
        about="Vexana's side of Cross x Credo. The song has a second version for Guinevere.",
        quality=cut_quality, tags=["theme", "cross credo", "vexana"],
    )
    cut_item(
        "guinevere", "cross-credo-guinevere", "Cross x Credo: Guinevere version",
        kind="theme", ep="EP 04", chars=["guinevere"], pair="guinevere-vexana",
        credits=[{"role": "Music and arrangement", "name": "Nika Lenz"}, {"role": "Lyrics", "name": "Konomi Fujimura"},
                 {"role": "Vocals", "name": "Eye"}],
        released="10/2025", cover=site_cover("img/char/guinevere/splash-sm.webp"),
        films=[
            {"id": F_CONNECTION_LOST, "label": "Connection Lost"},
            {"id": F_RELINK, "label": "Re:Link"},
            soundtrack("guinevere"),
        ],
        about="Guinevere's side of Cross x Credo. The song has a second version for Vexana.",
        quality=cut_quality, tags=["theme", "cross credo", "guinevere"],
    )
    cut_item(
        # The id stays (the Animation rooms play it by id); the sound moved to a new key when the
        # Angela & Ruby piece was cut out of its end.
        "change-lesley", "change-lesley-display", "Chang'e & Lesley Music", key="music/change-lesley-display-v2.m4a",
        kind="theme", ep="EP 03", chars=["lesley", "change"], pair="lesley-change",
        credits=[{"role": "Music", "name": "Steven Song"}], released="03/2024",
        cover=site_cover("img/char/lesley/splash-sm.webp"),
        films=[
            {"id": F_LESLEY_CHANGE, "label": "Chang'e & Lesley trailer"},
            soundtrack("change-lesley"),
        ],
        about="The music that plays on the skin display screen of Chang'e and Lesley.",
        quality=cut_quality, tags=["theme", "display music", "change", "lesley"],
    )
    cut_item(
        # The film's title card: EP 02, Angela & Ruby Display Background Music, composer Steven Song,
        # released 12/2022.
        "angela-ruby", "angela-ruby", "Angela & Ruby Music",
        kind="theme", ep="EP 02", chars=["angela", "ruby"], pair="ruby-angela",
        credits=[{"role": "Music", "name": "Steven Song"}], released="12/2022",
        cover=site_cover("img/char/angela/splash-sm.webp"),
        films=[
            {"id": F_RUBY_ANGELA, "label": "Ruby & Angela trailer"},
            {"id": F_RUBY, "label": "Ruby trailer"},
            {"id": F_ANGELA, "label": "Angela trailer"},
            soundtrack("angela-ruby"),
        ],
        about="The music that plays on the skin display screen of Angela and Ruby.",
        quality=cut_quality, tags=["theme", "display music", "angela", "ruby"],
    )

    # 4. We Believe!, the full song (EP 01), as it was.
    wb_out = common.key_path("music/we-believe.m4a")
    encode(WE_BELIEVE_SRC, wb_out, "192k")
    wb_orig = common.key_path("music/original/we-believe.m4a")
    copy(WE_BELIEVE_SRC, wb_orig)
    add(
        "we-believe", "We Believe!", kind="song", ep="EP 01", chars=["fanny", "layla"], pair="fanny-layla",
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

    ids = [i["id"] for i in items]
    assert len(set(ids)) == len(ids)
    totals = {"tracks": len(items), "seconds": round(sum(i["dur"] for i in items), 1)}
    common.write_json("music", {"v": 1, "slug": "music", "totals": totals, "items": items})

    for i in items:
        size = common.key_path(i["src"]).stat().st_size
        print(f"  {i['id']:30s} {i['dur']:7.2f}s  {common.human(size):>9s}  {i['src']}")


if __name__ == "__main__":
    main()
