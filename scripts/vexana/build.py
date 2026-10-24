"""
Builds the files of Vexana's page.

Sources: D:/ren/aspirant/media/vexana-and-guinevere (art, videos, cut-outs, skill icons), the comic
         panels in D:/ren/aspirant/story/guinevere-vexana-comic and her theme in
         C:/Users/muham/Downloads/vexana.m4a.
Output:  apps/web/public/img/vexana/{hero,art,skill,comic}/*.webp
         apps/web/public/audio/music/vexana-theme.m4a
         apps/web/public/video/vexana/*.mp4 and a `-poster.webp` for each
         apps/web/src/features/character/vexana/media.generated.ts (sizes, lengths, comic pages)

Every output is H.264 (and AAC), so every browser plays it. Nothing is made twice: an output that
exists is kept (delete it to rebuild it, or pass `--force`).

Not built on purpose: video/trailer.webm. It is the same film as final_video.mp4 (same length to
the frame, 180.8 s), only in VP9, so `final.mp4` covers it. `video.mp4` and `video2.mp4` in the
source folder are the same two films as final_video*.mp4 and are not used either.

The skin showcase is a promo for two skins: Vexana and Guinevere. It is cut down to Vexana's parts
and framed square (900x900) so it fits a column of the page. Only the parts that show her skin
move are kept: the intro and the hero shot are full frames (a 900 wide window is cut around her),
and the "display" part is split-screen, where her half is the left one (the window stops short of
the divider). Left out: Guinevere's parts (13 to 27, 66 to 96) and every part that is play in the
game (the skills in play, spawn, recall, statues, kill notices, emotes, graffiti), which is game
mechanics and not her animation. The bottom of the picture (the caption bars of the display
part) is cropped off, and the loop fades through black at its seam.

Run: python -I scripts/vexana/build.py            everything
     python -I scripts/vexana/build.py --manifest-only   write media.generated.ts from the sources
                                                   (before the long encodes), then stop
     python -I scripts/vexana/build.py --only images,audio,final2,skin-showcase
     python -I scripts/vexana/build.py --only skills   the four skill clips of the Craft section
     python -I scripts/vexana/build.py --force    rebuild what exists
"""

import json
import re
import subprocess
import sys
from pathlib import Path

SRC = Path("D:/ren/aspirant/media/vexana-and-guinevere")
COMICS = Path("D:/ren/aspirant/story/guinevere-vexana-comic")
MUSIC_SRC = Path("C:/Users/muham/Downloads/vexana.m4a")

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public"
IMG = PUBLIC / "img/vexana"
VID = PUBLIC / "video/vexana"
GENERATED = ROOT / "apps/web/src/features/character/vexana/media.generated.ts"

# --- pictures ---------------------------------------------------------------------------------
HERO = {  # output name -> source (transparent cut-outs, kept at full size)
    "normal-front": SRC / "other/web/normal-front.png",
    "ender-front": SRC / "other/web/ender-front.png",
    "normal-side": SRC / "other/web/normal-side.png",
    "ender-side": SRC / "other/web/ender-side.png",
}
HERO_QUALITY = 92  # libwebp, with alpha
ART = ["both-splash-art", "fighting-moment", "fighting-stance", "guinevere-splash-art", "vexana-splash-art"]
ART_QUALITY, ART_W, ART_SM_W = 85, 2560, 960
COMIC_QUALITY, COMIC_MAX_W = 82, 1200
SKILLS = ["passive", "skill-1", "skill-2", "skill-3", "skill-3-cancel"]
CHIBI_SRC = Path("C:/Users/muham/Downloads/chibi.png")  # the sticker of the comic section (alpha)
CHIBI_QUALITY, CHIBI_W = 92, 1000
# The fan wall: fanart-1..7 in the order of the files (the names in the folder are Instagram exports).
FANART_DIR = SRC / "fanart/vexana"
FANART_SRC = [
    "igexport-DPV12RbDHy1.jpg",
    "igexport-DPV12RbDHy1-2.jpg",
    "igexport-DPV12RbDHy1-3.jpg",
    "igexport-DPV12RbDHy1-4.jpg",
    "igexport-DPV12RbDHy1-6.jpg",
    "igexport-DPV12RbDHy1-8.jpg",
    "igexport-DPi3XJ_iZBy (1).jpg",
]
FANART = [f"fanart-{i + 1}" for i in range(len(FANART_SRC))]
FANART_QUALITY, FANART_W, FANART_SM_W = 84, 1600, 640

# --- videos -----------------------------------------------------------------------------------
# src       the file under SRC
# w         output width (height keeps the aspect); None keeps the size
# crf       x264 quality (lower is better); the budget for the whole folder is 500 MB
# preset    x264 preset
# audio     keep the sound (the films, the stream, the game scene and the 3D process: every picture that
#           plays by itself is muted by the page, and the site's player plays the sound)
# abr       audio bitrate (default 160k)
# poster    second of the output to take the poster from
# fps       cap the frame rate (None keeps it)
VIDEOS = {
    # The film (AV1 in the source, which Safari cannot always play). Full width and a 1920 wide size
    # for the player's quality menu.
    "final": dict(src="final_video.mp4", w=2560, crf=28, preset="slow", audio=True, poster=100, tune=None),
    "final-1080": dict(src="final_video.mp4", w=1920, crf=29, preset="slow", audio=True, poster=100, tune=None),
    # The second film: with its sound for the player. The cover section plays the same file muted by
    # itself, so there is one copy of it.
    "final2": dict(src="final_video2.mp4", w=2560, crf=26, preset="slow", audio=True, poster=8, tune=None),
    # Portrait, 60 fps.
    # Vexana only: the source cuts to Guinevere at 3.9 s and back with a wipe, so only 1.7 s to 3.85 s (where she is in
    # frame) is kept, cropped to 4:5 (the signature card) and played forward then backward so it loops.
    "splash-short": dict(src="video/short-splash-art-showcase.webm", w=864, crf=22, preset="slow", audio=False, poster=1.5, tune="animation", pingpong=dict(start=1.7, end=3.85, crop=(1080, 1350, 0, 200))),
    "skin-showcase": dict(src="video/skin-showcase.webm", w=None, crf=24, preset="slow", audio=False, poster=2.0, tune="animation", skin=True),
    # The skill clips of the Craft section, cut from the skin showcase (full frame, no Guinevere) at the
    # moment each skill is shown in play (the times were found with a frame every 0.25 s from 96 s to
    # 113 s). The bottom 280 px (the caption bar and the skill icon of the promo, the joystick) are
    # cropped off, and the clip is 1440x600. The recast of the third skill is not in the source, so it
    # shares the third clip.
    "skill-passive": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=1.6, tune="animation", clip=dict(start=107.0, end=109.3, crop=(1920, 800, 0, 0))),
    "skill-1": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=1.6, tune="animation", clip=dict(start=99.7, end=103.0, crop=(1920, 800, 0, 0))),
    "skill-2": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=1.4, tune="animation", clip=dict(start=103.0, end=106.4, crop=(1920, 800, 0, 0))),
    "skill-3": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=2.0, tune="animation", clip=dict(start=109.4, end=112.7, crop=(1920, 800, 0, 0))),
    # The comic film is voiced (Japanese): it keeps its sound, which the site's player plays.
    "comic-jp": dict(src="video/comic-jp.mp4", w=1080, crf=29, preset="slow", audio=True, abr="128k", poster=8, tune="animation"),
    # Her livestream: long, so 720p. It streams; nothing waits for it.
    "live-vexana": dict(src="video/live-vexana.webm", w=608, crop=(608, 1080, 656, 0), crf=33, preset="medium", audio=True, abr="96k", poster=20, tune="animation"),
    "heart-dance": dict(src="video/heart-short-dance.webm", w=None, crf=26, preset="slow", audio=False, poster=4, tune="animation"),
    "3d-process": dict(src="video/3d-process.webm", w=None, crf=24, preset="slow", audio=True, abr="128k", poster=8, tune="animation"),
    "interactive-drama": dict(src="video/interactive-drama.webm", w=None, crf=24, preset="slow", audio=True, abr="128k", poster=35, tune="animation"),
}

# The skin showcase parts: (start, end, kind, window x). `full` cuts a SKIN_W wide window out of the
# 1920x1080 frame at x, `half` is the left half of a split-screen part (x is 0).
SKIN_W, SKIN_H = 900, 900
SKIN_FADE_IN, SKIN_FADE_OUT = 0.4, 0.6
SKIN_PARTS = [
    # (start, end, kind, window x, window y, window size): a square window, scaled to SKIN_W
    (0.0, 12.5, "full", 460, 40, 1000),  # her skin's intro (Guinevere's arm comes in at 12.9 s)
    (27.65, 29.0, "full", 364, 40, 1000),  # the hero shot, with the mech
    (29.0, 65.8, "half", 0, 0, 910),  # display animations (the caption bars start below 920 px)
]

FORCE = "--force" in sys.argv


def run(args: list[str], quiet: bool = False) -> None:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit(f"ffmpeg failed: {' '.join(args)}\n{p.stderr}")


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=codec_name,width,height,r_frame_rate:format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    j = json.loads(out)
    s = j["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return dict(codec=s["codec_name"], width=int(s["width"]), height=int(s["height"]),
                fps=float(num) / float(den or 1) if float(den or 1) else 0.0,
                duration=float(j["format"].get("duration", 0)))


def audio_codec(path: Path) -> str | None:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout.strip()
    return out or None


def keep(out: Path) -> bool:
    return out.exists() and out.stat().st_size > 0 and not FORCE


# --- images -----------------------------------------------------------------------------------
def webp(src: Path, out: Path, quality: int, vf: str | None = None) -> None:
    if keep(out):
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    args = ["-i", str(src)]
    if vf:
        args += ["-vf", vf]
    run([*args, "-frames:v", "1", "-c:v", "libwebp", "-quality", str(quality), "-compression_level", "6", str(out)])


def build_images() -> None:
    for name, src in HERO.items():
        webp(src, IMG / "hero" / f"{name}.webp", HERO_QUALITY)
    for name in ART:
        src = SRC / "art" / f"{name}.jpg"
        webp(src, IMG / "art" / f"{name}.webp", ART_QUALITY, f"scale={ART_W}:-2:flags=lanczos")
        webp(src, IMG / "art" / f"{name}-sm.webp", 82, f"scale={ART_SM_W}:-2:flags=lanczos")
    (IMG / "skill").mkdir(parents=True, exist_ok=True)
    for name in SKILLS:
        out = IMG / "skill" / f"{name}.webp"
        if not keep(out):
            out.write_bytes((SRC / "other/skill" / f"{name}.webp").read_bytes())
    for n in comic_pages():
        webp(COMICS / f"{n}.jpg", IMG / "comic" / f"{n:02d}.webp", COMIC_QUALITY,
             f"scale='min({COMIC_MAX_W},iw)':-2:flags=lanczos")


def build_chibi() -> None:
    """The sticker of the comic section: Vexana and Guinevere as chibis, with alpha."""
    webp(CHIBI_SRC, IMG / "comic-chibi.webp", CHIBI_QUALITY, f"scale={CHIBI_W}:-2:flags=lanczos")


def build_fanart() -> None:
    for name, file in zip(FANART, FANART_SRC):
        src = FANART_DIR / file
        webp(src, IMG / "fanart" / f"{name}.webp", FANART_QUALITY, f"scale='min({FANART_W},iw)':-2:flags=lanczos")
        webp(src, IMG / "fanart" / f"{name}-sm.webp", 80, f"scale={FANART_SM_W}:-2:flags=lanczos")


def comic_pages() -> list[int]:
    """The panels that exist, by their original numbers. 3, 23 and 40 were never supplied."""
    return sorted(int(p.stem) for p in COMICS.glob("*.jpg") if re.fullmatch(r"\d+", p.stem))


def build_audio() -> None:
    out = PUBLIC / "audio/music/vexana-theme.m4a"
    if keep(out):
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(MUSIC_SRC.read_bytes())


# --- video ------------------------------------------------------------------------------------
def out_size(name: str) -> tuple[int, int]:
    """The size an output has (or will have), from its source."""
    spec = VIDEOS[name]
    if spec.get("skin"):
        return SKIN_W, SKIN_H
    if spec.get("clip"):
        cw, ch, _, _ = spec["clip"]["crop"]
        return spec["w"], round(ch * spec["w"] / cw / 2) * 2
    if spec.get("pingpong"):
        cw, ch, _, _ = spec["pingpong"]["crop"]
        return spec["w"], round(ch * spec["w"] / cw / 2) * 2
    if spec.get("crop"):
        return spec["crop"][0], spec["crop"][1]
    p = probe(SRC / spec["src"])
    w = spec["w"] or p["width"]
    w = min(w, p["width"])
    return w - w % 2, round(p["height"] * w / p["width"] / 2) * 2


def out_duration(name: str) -> float:
    spec = VIDEOS[name]
    if spec.get("skin"):
        return round(sum(e - s for s, e, _, _, _, _ in SKIN_PARTS), 3)
    if spec.get("clip"):
        return round(spec["clip"]["end"] - spec["clip"]["start"], 3)
    if spec.get("pingpong"):
        return round((spec["pingpong"]["end"] - spec["pingpong"]["start"]) * 2, 3)
    return probe(SRC / spec["src"])["duration"]


def encode(name: str) -> None:
    spec = VIDEOS[name]
    out = VID / f"{name}.mp4"
    if keep(out):
        return
    VID.mkdir(parents=True, exist_ok=True)
    src = SRC / spec["src"]
    tmp = out.with_suffix(".tmp.mp4")
    x264 = ["-c:v", "libx264", "-preset", spec["preset"], "-crf", str(spec["crf"]), "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-movflags", "+faststart"]
    if spec.get("tune"):
        x264 += ["-tune", spec["tune"]]
    if spec.get("skin"):
        chains, tags = [], []
        for i, (s, e, kind, x, y, cw) in enumerate(SKIN_PARTS):
            chains.append(
                f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,fps=30,"
                f"crop={cw}:{cw}:{x}:{y},scale={SKIN_W}:{SKIN_H}:flags=lanczos[v{i}]"
            )
            tags.append(f"[v{i}]")
        total = sum(e - s for s, e, _, _, _, _ in SKIN_PARTS)
        # The loop passes through black at its seam: out at the end, in at the start.
        graph = (
            ";".join(chains)
            + ";"
            + "".join(tags)
            + f"concat=n={len(SKIN_PARTS)}:v=1:a=0,"
            + f"fade=t=in:st=0:d={SKIN_FADE_IN},fade=t=out:st={total - SKIN_FADE_OUT:.3f}:d={SKIN_FADE_OUT}[v]"
        )
        run(["-i", str(src), "-filter_complex", graph, "-map", "[v]", *x264, "-an", str(tmp)])
    elif spec.get("clip"):
        c = spec["clip"]
        cw, ch, cx, cy = c["crop"]
        w, h = out_size(name)
        vf = f"crop={cw}:{ch}:{cx}:{cy},scale={w}:{h}:flags=lanczos,fps=30"
        run(["-i", str(src), "-ss", f"{c['start']}", "-t", f"{c['end'] - c['start']:.3f}", "-vf", vf, *x264, "-an", str(tmp)])
    elif spec.get("pingpong"):
        pp = spec["pingpong"]
        cw, ch, cx, cy = pp["crop"]
        w, h = out_size(name)
        graph = (
            f"[0:v]trim=start={pp['start']}:end={pp['end']},setpts=PTS-STARTPTS,crop={cw}:{ch}:{cx}:{cy},"
            f"scale={w}:{h}:flags=lanczos,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]"
        )
        run(["-i", str(src), "-filter_complex", graph, "-map", "[v]", *x264, "-an", str(tmp)])
    else:
        w, _ = out_size(name)
        vf = []
        if spec.get("crop"):
            # (width, height, x, y) of the picture inside the frame (the stream is a portrait picture
            # with black bars on both sides in a 16:9 frame)
            cw, ch, cx, cy = spec["crop"]
            vf.append(f"crop={cw}:{ch}:{cx}:{cy}")
        elif spec["w"] and w < probe(src)["width"]:
            vf.append(f"scale={w}:-2:flags=lanczos")
        args = ["-i", str(src)]
        if vf:
            args += ["-vf", ",".join(vf)]
        args += x264
        if spec["audio"] and audio_codec(src):
            args += ["-c:a", "aac", "-b:a", spec.get("abr", "160k")]
        else:
            args += ["-an"]
        run([*args, str(tmp)])
    tmp.replace(out)
    print(f"{name}.mp4  {out.stat().st_size / 1e6:.1f} MB", flush=True)


def poster(name: str) -> None:
    spec = VIDEOS[name]
    out = VID / f"{name}-poster.webp"
    video = VID / f"{name}.mp4"
    if keep(out) or not video.exists():
        return
    dur = probe(video)["duration"]
    t = min(spec["poster"], max(0.0, dur - 1))
    p = probe(video)
    vf = "scale=1600:-2:flags=lanczos" if p["width"] >= p["height"] and p["width"] > 1600 else (
        "scale=-2:1280:flags=lanczos" if p["height"] > p["width"] and p["height"] > 1280 else "null")
    run(["-ss", f"{t}", "-i", str(video), "-frames:v", "1", "-vf", vf, "-c:v", "libwebp", "-quality", "84", str(out)])


# --- the TypeScript ---------------------------------------------------------------------------
def image_size(path: Path) -> dict | None:
    if not path.exists():
        return None
    p = probe(path)
    return dict(width=p["width"], height=p["height"], bytes=path.stat().st_size)


def write_generated() -> None:
    lines = [
        "/* Written by scripts/vexana/build.py. Do not edit by hand. */",
        'import type { ImageInfo, VideoInfo, VideoName } from "./media";',
        "",
        "export const VIDEOS: Record<VideoName, VideoInfo> = {",
    ]
    for name in VIDEOS:
        out = VID / f"{name}.mp4"
        built = out.exists()
        w, h = (probe(out)["width"], probe(out)["height"]) if built else out_size(name)
        dur = probe(out)["duration"] if built else out_duration(name)
        size = out.stat().st_size if built else 0
        lines.append(
            f'  "{name}": {{ file: "/video/vexana/{name}.mp4", poster: "/video/vexana/{name}-poster.webp", '
            f"bytes: {size}, duration: {dur:.2f}, width: {w}, height: {h} }},"
        )
    lines += ["};", "", "/** The comic panels that exist, by their original numbers (3, 23 and 40 were never supplied). */"]
    lines.append(f"export const COMIC_PAGES: readonly number[] = {json.dumps(comic_pages())};")
    lines += ["", "export const IMAGES: Record<string, ImageInfo> = {"]
    for sub, names in (
        ("hero", HERO),
        ("art", [*ART, *[f"{a}-sm" for a in ART]]),
        ("fanart", [*FANART, *[f"{a}-sm" for a in FANART]]),
    ):
        for name in names:
            info = image_size(IMG / sub / f"{name}.webp")
            if info:
                lines.append(f'  "{sub}/{name}": {{ width: {info["width"]}, height: {info["height"]}, bytes: {info["bytes"]} }},')
    first = comic_pages()[0]
    info = image_size(IMG / "comic" / f"{first:02d}.webp")
    if info:
        lines.append(f'  "comic/{first:02d}": {{ width: {info["width"]}, height: {info["height"]}, bytes: {info["bytes"]} }},')
    lines += ["};", ""]
    GENERATED.parent.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text("\n".join(lines), encoding="utf8", newline="\n")
    # The repo's format check wants the file the way Prettier writes it.
    subprocess.run(["npx", "prettier", "--write", str(GENERATED)], cwd=ROOT / "apps/web",
                   shell=sys.platform == "win32", capture_output=True)


def main() -> None:
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    want = lambda k: only is None or k in only  # noqa: E731

    write_generated()
    if "--manifest-only" in sys.argv:
        return
    if want("images"):
        build_images()
    if want("chibi"):
        build_chibi()
    if want("fanart"):
        build_fanart()
    if want("audio"):
        build_audio()
    for name in VIDEOS:
        if want(name) or (only and "videos" in only) or (only and "skills" in only and VIDEOS[name].get("clip")):
            encode(name)
            poster(name)
            write_generated()
    write_generated()
    total = sum(f.stat().st_size for d in (IMG, VID, PUBLIC / "audio/music/vexana-theme.m4a") for f in
                ([d] if d.is_file() else d.rglob("*")) if f.is_file())
    print(f"total {total / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
