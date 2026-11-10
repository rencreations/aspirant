"""Films room pipeline (Video, Films): the ten official films at full quality, and video-films.json.

Run with the anaconda Python from the repo root (not with -I: it imports `common`):

    C:/Users/muham/anaconda3/python.exe scripts/library/video_films/build.py          # the mirror and the data
    C:/Users/muham/anaconda3/python.exe scripts/library/video_films/build.py data     # only the data file

The ten films, in the owner's order (10 Nov 2026), are `FILMS` below. Their ids are `FILM_IDS` in
`apps/web/src/features/library/video/links.ts` and must stay the same.

Each film is made once, at full quality, and never scaled down:

- A source that is already H.264 High in yuv420p with AAC sound (the three Ruby and Angela films) is
  only remuxed with `faststart`. Encoding it again would be a second lossy pass for nothing.
- Every other source (VP9 and AV1) is encoded to H.264 High, yuv420p, at its own width, height and
  frame rate, CRF 18 with the slow preset, a keyframe every two seconds (quick starts and seeks), and
  AAC at 192 kbit/s. CRF 18 was measured against the sources on 20 s cuts: VMAF 97.7 on a 2560x1080
  AV1 source and 99.1 on a 1080p VP9 one; CRF 17 cost 10 percent more bytes for 0.2 more. The
  whole films come out between 5.2 and 10.2 Mbit/s (The Pawn's Gambit, The Queen's Endgame and
  Re:Link are near 10).
- Two trailers carry black bars inside a 1080 frame (Day of Enders, 808 rows of picture, and Go For
  It! Aspirants!, 820). The bars are cut away: the page shows the films full bleed, and the bars
  would show as black bands. Cutting bars keeps every pixel of the picture.

Outputs go to the mirror under `video/films/<id>/`: `video.mp4`, `poster.webp` (the official
thumbnail beside the source, at its own size: they are 1280 wide and are never upscaled),
`thumb.webp` (480 wide), `backdrop.webp` (a small blurred copy of the poster, shown around a film
that fits inside a tall screen) and `en.vtt` when the source has English subtitles.

Idempotent: an output newer than its source and made with the same settings is kept. Scratch goes
to D:\\ren\\aspirant-work\\video_films. Nothing is written in the source library. One encode runs at
a time (x264 uses every core).
"""

from __future__ import annotations

import datetime
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import common  # noqa: E402

WORK = common.WORK / "video_films"
STATE = WORK / "state"
TMP = WORK / "tmp"
for d in (WORK, STATE, TMP):
    d.mkdir(parents=True, exist_ok=True)

MEDIA = common.MEDIA
LINKS_TS = common.REPO / "apps" / "web" / "src" / "features" / "library" / "video" / "links.ts"

CRF = 18
PRESET = "slow"
AUDIO_KBPS = 192
POSTER_Q = 88
THUMB_W = 480
BACKDROP = (320, 180)
# Bump when the encode settings change, so every film is made again.
SETTINGS = f"x264-{PRESET}-crf{CRF}-gop2s-aac{AUDIO_KBPS}-v1"

# The ten films, in the owner's order. `kind` is one of the room's kinds (see `types.ts`). Titles are
# the official titles on each film's thumbnail. `date` is known only where the source is an Instagram
# post: its id holds the time it was posted.
FILMS: list[dict[str, Any]] = [
    {
        "id": "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
        "dir": "selena-and-obsidia/video/trailer",
        "video": "001_3994447231709070185.mp4",
        "thumb": "thumbnail.jpg",
        "crop": "1920:808:0:136",
        "title": "Day of Enders",
        "kind": "cinematic-trailer",
        "chars": ["selena", "obsidia", "guinevere", "vexana", "layla", "fanny"],
        "pair": "selena-obsidia",
        "tags": ["trailer", "cinematic", "singularity", "new skins"],
        "desc": "The crisis in the Singularity is far from over. Obsidia, the mastermind behind the Enders, quietly reveals herself while the Aspirants fight with all their might, and Selena watches from a rooftop in her school uniform.",
    },
    {
        "id": "film-selena-and-obsidia-video-selena-video",
        "dir": "selena-and-obsidia/video/selena",
        "video": "video.mp4",
        "thumb": "thumbnail.jpg",
        "title": "The Pawn's Gambit",
        "kind": "character-trailer",
        "chars": ["selena", "obsidia"],
        "pair": "selena-obsidia",
        "tags": ["character trailer", "selena"],
        "desc": "Selena is a student at Selrick Academy who cannot stand early mornings, the sun in her eyes or taking orders. She says she is no one's doll.",
    },
    {
        "id": "film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
        "dir": "selena-and-obsidia/video/obsidia",
        "video": "001_3997406762701005025.mp4",
        "thumb": "thumbnail.jpg",
        "title": "The Queen's Endgame",
        "kind": "character-trailer",
        "chars": ["selena", "obsidia"],
        "pair": "selena-obsidia",
        "tags": ["character trailer", "obsidia", "ender"],
        "desc": "Obsidia calls herself the Will that ends civilizations. She says she does not destroy, she purges the parasites from the host, and a chained Selena appears before her.",
    },
    {
        "id": "film-vexana-and-guinevere-video-connection-lost-final-video",
        "dir": "vexana-and-guinevere/video/connection-lost",
        "video": "final_video.mp4",
        "thumb": "thumbnail.jpg",
        "title": "Connection Lost",
        "kind": "animation",
        "chars": ["guinevere", "vexana"],
        "pair": "guinevere-vexana",
        "tags": ["animation", "cinematic"],
        "desc": "Vexana, once Guinevere's most trusted partner, now fights beside the Enders. Guinevere refuses to believe that the partner she chose would betray humanity.",
    },
    {
        "id": "film-vexana-and-guinevere-video-relink-final-video2",
        "dir": "vexana-and-guinevere/video/relink",
        "video": "final_video2.mp4",
        "thumb": "thumbnail.jpg",
        "title": "Re:Link",
        "kind": "animation",
        "chars": ["guinevere", "vexana"],
        "pair": "guinevere-vexana",
        "tags": ["animation", "mother matrix"],
        "desc": "Vexana is ready to sacrifice herself to destroy the Mother Matrix, but she cannot watch Guinevere fall. She blocks an attack meant for Guinevere and gives herself away, and Guinevere then stands in front of her.",
    },
    {
        "id": "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
        "dir": "lesley-and-change/video/official/trailer",
        "video": "video.webm",
        "thumb": "thumbnail.jpg",
        "srt": "subtitles/NA.en.srt",
        "title": "Rekindled Light",
        "kind": "animated-trailer",
        "chars": ["lesley", "change"],
        "pair": "lesley-change",
        "tags": ["trailer", "cinematic"],
        "desc": "The sharpshooter Lesley captures a core component from the Enders, and the first ray of hope for a counterattack is lit. The film follows Lesley and Chang'e from a warm lab memory to the night the Enders attacked.",
    },
    {
        "id": "film-ruby-and-angela-video-ruby-ruby-final",
        "dir": "ruby-and-angela/video/ruby",
        "video": "ruby-final.mp4",
        "thumb": "maxresdefault (5).jpg",
        "srt": "english.srt",
        "title": "A Way Out",
        "kind": "animated-trailer",
        "chars": ["ruby", "angela"],
        "pair": "ruby-angela",
        "tags": ["trailer", "ruby", "oro", "mecha maiden"],
        "desc": "Ruby tells her own story: the heir of Planet Oro, the council that rules her life, and the android Angela she builds as a way out. The plan turns into a friendship she did not expect.",
    },
    {
        "id": "film-ruby-and-angela-video-angela-angela-final",
        "dir": "ruby-and-angela/video/angela",
        "video": "angela-final.mp4",
        "thumb": "thumbnail.jpg",
        "srt": "english.srt",
        "title": "A Friend",
        "kind": "animated-trailer",
        "chars": ["ruby", "angela"],
        "pair": "ruby-angela",
        "tags": ["trailer", "angela", "oro", "cyber cherubin"],
        "desc": "Angela tells it from her side: the lab where Ruby made her, the Gardens, the daily training, and the word hurt, which she does not yet understand.",
    },
    {
        "id": "film-ruby-and-angela-video-trailer-trailer-final",
        "dir": "ruby-and-angela/video/trailer",
        "video": "trailer-final.mp4",
        "thumb": "thumbnail.jpg",
        "srt": "english.srt",
        "title": "Awakening",
        "kind": "animated-trailer",
        "chars": ["ruby", "angela", "fanny", "layla"],
        "pair": "ruby-angela",
        "tags": ["trailer", "cinematic", "dawnbreak"],
        "desc": "On Planet Dawnbreak, androids from Planet Oro attack under Angela's lead. Ruby, who opposes the conquest, fights to awaken the android she once called her friend.",
    },
    {
        "id": "film-layla-and-fanny-video-official-lore-trailer-trailer",
        "dir": "layla-and-fanny/video/official/lore/trailer",
        "video": "trailer.webm",
        "thumb": "thumbnail-horizontal.jpg",
        "srt": "subtitle/en.en.srt",
        "crop": "1920:820:0:130",
        "title": "Go For It! Aspirants!",
        "kind": "cinematic-trailer",
        "chars": ["layla", "fanny"],
        "pair": "fanny-layla",
        "tags": ["trailer", "cinematic", "we believe", "song"],
        "desc": "The Aspirants cinematic trailer, set to the song We Believe!. Layla and Fanny meet at Selrick Academy, grow closer in training and ride out in Aspirant mecha suits to fight the Enders.",
    },
]

# Instagram media ids hold the time of the post: the top bits are milliseconds since this epoch.
IG_EPOCH_MS = 1314220021721


def check_ids() -> None:
    """The ids here must be the ids the site links to, in the same order."""
    text = LINKS_TS.read_text(encoding="utf-8")
    block = text.split("FILM_IDS = [", 1)[1].split("]", 1)[0]
    ids = re.findall(r'"([^"]+)"', block)
    mine = [f["id"] for f in FILMS]
    if ids != mine:
        raise SystemExit(f"FILM_IDS in links.ts and FILMS here differ:\n  site: {ids}\n  here: {mine}")


def key_of(film: dict[str, Any], name: str) -> str:
    return f"video/films/{film['id']}/{name}"


def src_of(film: dict[str, Any], name: str) -> Path:
    p = MEDIA / film["dir"] / name
    if not p.exists():
        raise SystemExit(f"missing source: {p}")
    return p


def posted(film: dict[str, Any]) -> str | None:
    """ISO date of an Instagram post, from the id in the file name."""
    m = re.match(r"^\d+_(\d{17,20})\.", film["video"])
    if not m:
        return None
    ms = (int(m.group(1)) >> 23) + IG_EPOCH_MS
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.UTC).date().isoformat()


def probe(path: Path) -> dict[str, Any]:
    out = common.run(
        [
            "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", path,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    ).stdout
    j = json.loads(out or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
    a = next((s for s in j.get("streams", []) if s.get("codec_type") == "audio"), {})
    return {
        "w": int(v.get("width") or 0),
        "h": int(v.get("height") or 0),
        "rate": v.get("r_frame_rate") or "0/1",
        "vcodec": v.get("codec_name"),
        "profile": v.get("profile"),
        "pix": v.get("pix_fmt"),
        "acodec": a.get("codec_name"),
        "dur": float(j.get("format", {}).get("duration") or 0),
        "bytes": int(j.get("format", {}).get("size") or 0),
    }


def rate_float(rate: str) -> float:
    n, d = (rate.split("/") + ["1"])[:2]
    return float(n) / float(d) if float(d) else 0.0


def plan_of(src: dict[str, Any], film: dict[str, Any]) -> str:
    """`copy` when the source already is the one version (H.264 High, yuv420p, AAC, no bars)."""
    if (
        src["vcodec"] == "h264"
        and src["profile"] == "High"
        and src["pix"] == "yuv420p"
        and src["acodec"] == "aac"
        and not film.get("crop")
    ):
        return "copy"
    return "encode"


def state_path(film: dict[str, Any]) -> Path:
    return STATE / f"{film['id']}.json"


def video_fresh(film: dict[str, Any], source: Path, out: Path, plan: str) -> bool:
    if not common.fresh(out, source):
        return False
    try:
        s = json.loads(state_path(film).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return s.get("settings") == (SETTINGS if plan == "encode" else "copy") and s.get("bytes") == out.stat().st_size


def make_video(film: dict[str, Any]) -> dict[str, Any]:
    source = src_of(film, film["video"])
    src = probe(source)
    plan = plan_of(src, film)
    out = common.key_path(key_of(film, "video.mp4"))
    if video_fresh(film, source, out, plan):
        print(f"  video kept ({common.human(out.stat().st_size)})", flush=True)
    else:
        tmp = TMP / f"{film['id']}.mp4"
        tmp.unlink(missing_ok=True)
        started = time.time()
        if plan == "copy":
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", source,
                "-map", "0:v:0", "-map", "0:a:0", "-c", "copy",
                "-map_metadata", "-1", "-movflags", "+faststart", tmp,
            ]
        else:
            fps = rate_float(src["rate"])
            gop = max(1, round(fps * 2))
            vf = [f"crop={film['crop']}"] if film.get("crop") else []
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-stats", "-y", "-i", source,
                "-map", "0:v:0", "-map", "0:a:0",
                *(["-vf", ",".join(vf)] if vf else []),
                "-fps_mode", "cfr", "-r", src["rate"],
                "-c:v", "libx264", "-preset", PRESET, "-crf", str(CRF),
                "-profile:v", "high", "-pix_fmt", "yuv420p",
                "-g", str(gop), "-keyint_min", str(max(1, round(fps))),
                "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-ac", "2", "-ar", "48000",
                "-map_metadata", "-1", "-movflags", "+faststart", tmp,
            ]
        common.run(cmd)
        tmp.replace(out)
        state_path(film).write_text(
            json.dumps(
                {
                    "settings": SETTINGS if plan == "encode" else "copy",
                    "bytes": out.stat().st_size,
                    "seconds": round(time.time() - started, 1),
                }
            ),
            encoding="utf-8",
        )
        print(f"  video {plan} done in {time.time() - started:.0f} s ({common.human(out.stat().st_size)})", flush=True)
    made = probe(out)
    if abs(made["dur"] - src["dur"]) > 0.5:
        raise SystemExit(f"{film['id']}: duration {made['dur']:.2f} s, source {src['dur']:.2f} s")
    if made["vcodec"] != "h264" or made["pix"] != "yuv420p" or made["acodec"] != "aac":
        raise SystemExit(f"{film['id']}: not the one version: {made}")
    expect_w, expect_h = (
        (int(film["crop"].split(":")[0]), int(film["crop"].split(":")[1])) if film.get("crop") else (src["w"], src["h"])
    )
    if (made["w"], made["h"]) != (expect_w, expect_h):
        raise SystemExit(f"{film['id']}: size {made['w']}x{made['h']}, expected {expect_w}x{expect_h}")
    return {"plan": plan, "w": made["w"], "h": made["h"], "dur": round(made["dur"], 2), "fps": round(rate_float(made["rate"]), 3), "bytes": out.stat().st_size}


def make_pictures(film: dict[str, Any]) -> str:
    """poster.webp, thumb.webp and backdrop.webp from the official thumbnail. Returns the average colour."""
    from PIL import Image, ImageFilter, ImageOps

    source = src_of(film, film["thumb"])
    poster = common.key_path(key_of(film, "poster.webp"))
    thumb = common.key_path(key_of(film, "thumb.webp"))
    backdrop = common.key_path(key_of(film, "backdrop.webp"))
    colour_file = STATE / f"{film['id']}.colour"
    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        colour = common._dominant(im)
        if not all(common.fresh(p, source) for p in (poster, thumb, backdrop)):
            im.save(poster, "WEBP", quality=POSTER_Q, method=6)
            w, h = im.size
            small = im.resize((THUMB_W, round(h * THUMB_W / w)), Image.LANCZOS)
            small.save(thumb, "WEBP", quality=80, method=6)
            tiny = ImageOps.fit(im, BACKDROP, Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
            tiny.save(backdrop, "WEBP", quality=70, method=6)
            print(f"  pictures made ({im.size[0]}x{im.size[1]})", flush=True)
    colour_file.write_text(colour, encoding="utf-8")
    return colour


def make_captions(film: dict[str, Any]) -> str | None:
    if not film.get("srt"):
        return None
    source = src_of(film, film["srt"])
    out = common.key_path(key_of(film, "en.vtt"))
    vtt = common.srt_to_vtt(source.read_text(encoding="utf-8-sig"))
    problems = common.check_text(vtt, f"{film['id']} en.vtt")
    if problems:
        raise SystemExit("\n".join(problems))
    if not out.exists() or out.read_text(encoding="utf-8") != vtt:
        out.write_text(vtt, encoding="utf-8", newline="\n")
        print("  captions written", flush=True)
    return key_of(film, "en.vtt")


def build(only_data: bool = False) -> None:
    check_ids()
    items: list[dict[str, Any]] = []
    total = 0
    report: list[str] = []
    for n, film in enumerate(FILMS, 1):
        print(f"[{n:02d}/10] {film['title']}", flush=True)
        if only_data:
            out = common.key_path(key_of(film, "video.mp4"))
            if not out.exists():
                raise SystemExit(f"{film['id']}: no video yet, run without `data` first")
            made = probe(out)
            v = {"plan": "", "w": made["w"], "h": made["h"], "dur": round(made["dur"], 2), "fps": round(rate_float(made["rate"]), 3), "bytes": out.stat().st_size}
            colour_file = STATE / f"{film['id']}.colour"
            colour = colour_file.read_text(encoding="utf-8") if colour_file.exists() else make_pictures(film)
            captions = key_of(film, "en.vtt") if film.get("srt") else None
        else:
            v = make_video(film)
            colour = make_pictures(film)
            captions = make_captions(film)
        total += v["bytes"]
        kbps = v["bytes"] * 8 / max(v["dur"], 0.1) / 1000
        report.append(
            f"{n:02d} {film['title'][:22]:22} {v['w']}x{v['h']} {v['fps']:g} fps {v['dur']:7.2f} s"
            f" {common.human(v['bytes']):>9} {kbps:6.0f} kbit/s {v['plan']}"
        )
        video: dict[str, Any] = {
            "src": key_of(film, "video.mp4"),
            "poster": key_of(film, "poster.webp"),
            "w": v["w"],
            "h": v["h"],
            "dur": v["dur"],
        }
        if captions:
            video["captions"] = captions
        item: dict[str, Any] = {
            "id": film["id"],
            "title": common.clean_text(film["title"]),
            "collection": "video",
            "chars": film["chars"],
            "pair": film["pair"],
            "canon": "official",
            "tags": film["tags"],
            "kind": film["kind"],
        }
        date = posted(film)
        if date:
            item["year"] = int(date[:4])
            item["date"] = date
        item.update(
            {
                "desc": common.clean_text(film["desc"]),
                "video": video,
                "thumb": key_of(film, "thumb.webp"),
                "backdrop": key_of(film, "backdrop.webp"),
                "c": colour,
                "fps": v["fps"],
                "bytes": v["bytes"],
            }
        )
        items.append(item)
    common.write_json("video-films", {"v": 1, "slug": "video", "room": "films", "bytes": total, "items": items})
    print("\n".join(report))
    print(f"total {common.human(total)} in the mirror under video/films/")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what not in ("all", "data"):
        raise SystemExit("usage: build.py [all|data]")
    build(only_data=what == "data")
