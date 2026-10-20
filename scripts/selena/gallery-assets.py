"""
Builds the media of Selena's Gallery page.

Art: the official pieces and the fan art, as webp (a full size for the viewer and a small one for
the grid). The HEIC photos from Instagram are converted (this needs `pip install pillow-heif`).
Videos: the two TikToks from HEVC to H.264, and the trailer "Day of Enders" from the 2560x1080 webm
to a 1920x810 mp4 (the collection keeps its 1280x540 one, which is the smaller size here).
Voice: line 9 has two parts, with a pause between them. The first is hers in her normal form and
the second in her mecha form, so the file is cut in two.

Output: apps/web/public/img/selena/gallery/<id>.webp and <id>-t.webp,
        apps/web/public/video/selena/gallery/<id>.mp4 and <id>.webp (poster),
        apps/web/public/video/selena/trailer-day-of-enders-810.mp4,
        apps/web/public/audio/voice/selena/09-a.m4a and 09-b.m4a,
        apps/web/src/features/character/selena/gallery/gallery-media.generated.ts

Run: python -I scripts/selena/gallery-assets.py "D:/ren/aspirant/media/selena-and-obsidia"
     Add --skip-video to leave the videos as they are (they take a few minutes).
"""

import json
import subprocess
import sys
from pathlib import Path

import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

# id -> source, relative to the media folder. The ids are used by gallery-data.ts.
OFFICIAL = {
    "official-day-of-enders": "official/selena/aspirant.jpg",
    "official-splash": "official/selena/selena-splash-art.png",
    "official-pawns-gambit": "official/selena/selena.jpg",
}

FAN = "fanart/selena/"
JLEN = FAN + "httpswww.instagram.comjlen_ismyname/"
FANART = {
    "fan-falguni_shikder": FAN + "httpswww.instagram.comfalguni_shikder.jpg",
    "fan-kitemo_chan": FAN + "httpswww.instagram.comkitemo_chan - selena.jpeg",
    "fan-lococo20220304": FAN + "httpswww.instagram.comlococo20220304.jpg",
    "fan-nryo_c": FAN + "httpswww.instagram.comnryo_c.jpg",
    "fan-ig-DcCCUwTTTo8": FAN + "httpswww.instagram.compDcCCUwTTTo8.heic",
    "fan-deniisuuu": FAN + "httpsx.comdeniisuuu.jpeg",
    # jlen_ismyname: four posts. Three are one picture, one is a carousel of seven (a drawing process).
    "jlen-Db_FVUklFvn": JLEN + "httpswww.instagram.compDb_FVUklFvn.heic",
    "jlen-DcGVlIWxBDd": JLEN + "httpswww.instagram.compDcGVlIWxBDd.heic",
    "jlen-DcogkTpmfu4": JLEN + "httpswww.instagram.compDcogkTpmfu4.heic",
}
CAROUSEL = JLEN + "httpswww.instagram.compDeZuC3imbns/"
# The frames of the carousel, in the order the files are numbered: the finished piece first, then
# the steps, then the version that was posted on X.
CAROUSEL_FRAMES = [
    "Mah gurlieees \U0001f970.heic",
    "Mah gurlieees \U0001f970 (1).heic",
    "Mah gurlieees \U0001f970 (2).heic",
    "Mah gurlieees \U0001f970 (3).heic",
    "Mah gurlieees \U0001f970 (4).heic",
    "Mah gurlieees \U0001f970 (5).heic",
    "HUjsMdJaMAAkHw-.jpeg",
]
for i, name in enumerate(CAROUSEL_FRAMES):
    FANART[f"jlen-DeZuC3imbns-{i + 1}"] = CAROUSEL + name

VIDEOS = {
    # id -> (source, width, fps, crf, second of the poster). The second one starts on a blank page.
    "tiktok-bomboclau": (FAN + "httpswww.tiktok.com@bomboclau_video7694259319201664277.mp4", 1080, 30, 24, 1),
    "tiktok-hashirama1697": (FAN + "httpswww.tiktok.com@hashirama1697video7681495176833027345.mp4", 1080, 60, 25, 8),
}

FULL_EDGE = 2560  # longest edge of the full size
THUMB_BOX = (720, 960)


def run(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(p.stderr)


def convert_image(src: Path, out_dir: Path, name: str) -> dict:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    full = im.copy()
    if max(full.size) > FULL_EDGE:
        full.thumbnail((FULL_EDGE, FULL_EDGE), Image.LANCZOS)
    full_path = out_dir / f"{name}.webp"
    full.save(full_path, quality=88, method=6)
    thumb = im.copy()
    thumb.thumbnail(THUMB_BOX, Image.LANCZOS)
    thumb_path = out_dir / f"{name}-t.webp"
    thumb.save(thumb_path, quality=80, method=6)
    return {
        "w": full.width,
        "h": full.height,
        "bytes": full_path.stat().st_size,
        "tw": thumb.width,
        "th": thumb.height,
        "tbytes": thumb_path.stat().st_size,
    }


def probe(path: Path) -> dict:
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    d = json.loads(p.stdout)
    return {"w": d["streams"][0]["width"], "h": d["streams"][0]["height"], "seconds": round(float(d["format"]["duration"]), 2)}


def convert_video(src: Path, out_dir: Path, name: str, width: int, fps: int, crf: int, poster_at: int) -> dict:
    out = out_dir / f"{name}.mp4"
    run([
        "-i", str(src), "-vf", f"scale={width}:-2:flags=lanczos,fps={fps},format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-profile:v", "high", "-g", str(fps * 2),
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(out),
    ])
    poster = out_dir / f"{name}.webp"
    run(["-ss", str(poster_at), "-i", str(out), "-frames:v", "1", "-vf", "scale=720:-2:flags=lanczos",
         "-c:v", "libwebp", "-quality", "82", str(poster)])
    info = probe(out)
    info["bytes"] = out.stat().st_size
    info["posterBytes"] = poster.stat().st_size
    return info


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    media = Path(args[0])
    skip_video = "--skip-video" in sys.argv
    root = Path(__file__).resolve().parents[2]
    web = root / "apps" / "web"
    img_dir = web / "public" / "img" / "selena" / "gallery"
    vid_dir = web / "public" / "video" / "selena" / "gallery"
    img_dir.mkdir(parents=True, exist_ok=True)
    vid_dir.mkdir(parents=True, exist_ok=True)

    images: dict[str, dict] = {}
    for name, rel in {**OFFICIAL, **FANART}.items():
        images[name] = convert_image(media / rel, img_dir, name)
        print(name, images[name]["w"], "x", images[name]["h"], images[name]["bytes"] // 1024, "KB")

    videos: dict[str, dict] = {}
    trailer: dict = {}
    if not skip_video:
        for name, (rel, width, fps, crf, poster_at) in VIDEOS.items():
            videos[name] = convert_video(media / rel, vid_dir, name, width, fps, crf, poster_at)
            print(name, videos[name])
        t = web / "public" / "video" / "selena" / "trailer-day-of-enders-810.mp4"
        run([
            "-i", str(media / "trailer.webm"), "-vf", "scale=1920:810:flags=lanczos,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-profile:v", "high", "-g", "48",
            "-c:a", "aac", "-b:a", "80k", "-movflags", "+faststart", str(t),
        ])
        trailer = probe(t)
        trailer["bytes"] = t.stat().st_size
        print("trailer", trailer)
    else:
        for name in VIDEOS:
            p = vid_dir / f"{name}.mp4"
            if p.exists():
                info = probe(p)
                info["bytes"] = p.stat().st_size
                info["posterBytes"] = (vid_dir / f"{name}.webp").stat().st_size
                videos[name] = info
        t = web / "public" / "video" / "selena" / "trailer-day-of-enders-810.mp4"
        if t.exists():
            trailer = probe(t)
            trailer["bytes"] = t.stat().st_size

    # Voice line 9: the first part (normal form) and the second (mecha form).
    voice = web / "public" / "audio" / "voice" / "selena"
    run(["-i", str(voice / "09.m4a"), "-t", "3.65", "-af", "afade=t=out:st=3.5:d=0.15",
         "-c:a", "aac", "-b:a", "32k", "-ac", "1", "-ar", "24000", str(voice / "09-a.m4a")])
    run(["-ss", "5.52", "-i", str(voice / "09.m4a"), "-af", "afade=t=in:d=0.06",
         "-c:a", "aac", "-b:a", "32k", "-ac", "1", "-ar", "24000", str(voice / "09-b.m4a")])

    dest = web / "src" / "features" / "character" / "selena" / "gallery"
    dest.mkdir(parents=True, exist_ok=True)
    body = (
        "// Generated by scripts/selena/gallery-assets.py. Do not edit.\n\n"
        "export interface GalleryImageMeta {\n"
        "  /** The full size, in pixels. */\n  w: number;\n  h: number;\n  bytes: number;\n"
        "  /** The small size for the grid. */\n  tw: number;\n  th: number;\n  tbytes: number;\n}\n\n"
        "export interface GalleryVideoMeta {\n  w: number;\n  h: number;\n  seconds: number;\n  bytes: number;\n  posterBytes: number;\n}\n\n"
        f"export const GALLERY_IMAGES = {json.dumps(images, indent=2)} as const satisfies Record<string, GalleryImageMeta>;\n\n"
        f"export const GALLERY_VIDEOS = {json.dumps(videos, indent=2)} as const satisfies Record<string, GalleryVideoMeta>;\n\n"
        f"export const GALLERY_TRAILER = {json.dumps(trailer, indent=2)} as const;\n"
    )
    (dest / "gallery-media.generated.ts").write_text(body, encoding="utf-8")
    print("wrote gallery-media.generated.ts")


if __name__ == "__main__":
    main()
