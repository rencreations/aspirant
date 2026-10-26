"""
Builds the files of Guinevere's page.

Sources: D:/ren/aspirant/media/vexana-and-guinevere (art, videos, cut-outs, skill icons, fanart),
         her hero photo and her theme video in C:/Users/muham/Downloads (guinhero.png, guin.mov).
Output:  apps/web/public/img/guinevere/{hero,web,skill,fanart}/*.webp
         apps/web/public/audio/music/guinevere-theme.m4a
         apps/web/public/video/guinevere/*.mp4 and a `-poster.webp` for each
         apps/web/src/features/character/guinevere/media.generated.ts (sizes and lengths)

The films that are the same on both pages (the film, the second film, the comic, the 3D process and
the heart dance) are not built again: her page reads Vexana's files (`scripts/vexana/build.py`).

Every output is H.264 (and AAC), so every browser plays it. Nothing is made twice: an output that
exists is kept (delete it to rebuild it, or pass `--force`).

The skin showcase is a promo for two skins. It is cut down to Guinevere's parts and framed square
(900x900): her intro (12.9 s to 27 s), the display part where she is the RIGHT half of a split
screen (29 s to 65.8 s, the window stops short of the divider and above the caption bars), and her
title card (66 s to 71.4 s, before the flash). The skills in play (72 s to 89 s) are her four
skill clips, with the caption bar and the joystick cropped off.

Run: python -I scripts/guinevere/build.py            everything
     python -I scripts/guinevere/build.py --manifest-only   write media.generated.ts, then stop
     python -I scripts/guinevere/build.py --only images,audio,skills,splash-short
     python -I scripts/guinevere/build.py --force    rebuild what exists
"""

import json
import subprocess
import sys
from pathlib import Path

SRC = Path("D:/ren/aspirant/media/vexana-and-guinevere")
HERO_SRC = Path("C:/Users/muham/Downloads/guinhero.png")
THEME_SRC = Path("C:/Users/muham/Downloads/guin.mov")

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public"
IMG = PUBLIC / "img/guinevere"
VID = PUBLIC / "video/guinevere"
GENERATED = ROOT / "apps/web/src/features/character/guinevere/media.generated.ts"

# --- pictures ---------------------------------------------------------------------------------
HERO_QUALITY = 92
WEB = {  # output name -> source (transparent cut-outs of the story pair and the two drones)
    "left": SRC / "other/web/guinevere/left.png",
    "right": SRC / "other/web/guinevere/right.png",
    "drone-1": SRC / "other/web/guinevere/drone-1.png",
    "drone-2": SRC / "other/web/guinevere/drone-2.png",
}
WEB_QUALITY = 92
SKILLS = {  # output name -> source file name
    "passive": "passive",
    "skill-1": "skill1",
    "skill-2": "skill2",
    "skill-2-blink": "skill2-blink",
    "skill-3": "skill3",
}
FANART_DIR = SRC / "fanart/guinevere"
FANART_SRC = [
    "igexport-DPV12RbDHy1.jpg",
    "igexport-DPV12RbDHy1-2.jpg",
    "igexport-DPV12RbDHy1-3.jpg",
    "igexport-DPV12RbDHy1-5.jpg",
    "igexport-DPV12RbDHy1-7.jpg",
    "igexport-DPi3XJ_iZBy (1).jpg",
]
FANART = [f"fanart-{i + 1}" for i in range(len(FANART_SRC))]
FANART_QUALITY, FANART_W, FANART_SM_W = 84, 1600, 640

# --- videos -----------------------------------------------------------------------------------
# src       the file under SRC (or an absolute path)
# w         output width (height keeps the aspect); None keeps the size
# crf       x264 quality (lower is better)
# audio     keep the sound
# poster    second of the output to take the poster from
VIDEOS = {
    # Portrait, 60 fps. Guinevere only: the source cuts from Vexana to her at 4.25 s with a wipe and
    # back at 8 s with a flash, so 4.4 s to 7.5 s is kept, cropped to 4:5 (the signature card) and
    # played forward then backward so it loops.
    "splash-short": dict(src="video/short-splash-art-showcase.webm", w=864, crf=22, preset="slow", audio=False, poster=1.5, tune="animation", pingpong=dict(start=4.4, end=7.5, crop=(1080, 1350, 0, 120))),
    "skin-showcase": dict(src="video/skin-showcase.webm", w=None, crf=24, preset="slow", audio=False, poster=2.0, tune="animation", skin=True),
    # The skill clips, cut from the skin showcase at the moments her skills are shown in play (found
    # with a frame every 0.25 s from 74 s to 89 s). The bottom 280 px (caption bar and skill icon of the
    # promo, the joystick) are cropped off: 1440x600. The recast of the second skill is in its clip.
    "skill-passive": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=1.0, tune="animation", clip=dict(start=82.4, end=84.4, crop=(1920, 800, 0, 0))),
    "skill-1": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=0.9, tune="animation", clip=dict(start=76.3, end=78.2, crop=(1920, 800, 0, 0))),
    "skill-2": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=1.4, tune="animation", clip=dict(start=78.3, end=81.9, crop=(1920, 800, 0, 0))),
    "skill-3": dict(src="video/skin-showcase.webm", w=1440, crf=24, preset="slow", audio=False, poster=2.0, tune="animation", clip=dict(start=84.4, end=88.7, crop=(1920, 800, 0, 0))),
    # Her livestream: long, so 720p. The picture is a 608x1080 window at x 656 inside a black frame.
    "live-guin": dict(src="video/live-guin.webm", w=608, crop=(608, 1080, 656, 0), crf=33, preset="medium", audio=True, abr="96k", poster=20, tune="animation"),
    # The music video of her theme (a .mov): 1080p H.264 and the song's AAC.
    "music": dict(src=str(THEME_SRC), w=None, crf=21, preset="slow", audio=True, abr="160k", poster=2, tune=None),
}

# The skin showcase parts: (start, end, kind, window x, window y, window size): a square window,
# scaled to SKIN_W.
SKIN_W, SKIN_H = 900, 900
SKIN_FADE_IN, SKIN_FADE_OUT = 0.4, 0.6
SKIN_PARTS = [
    (12.9, 27.0, "full", 460, 40, 1000),  # her intro (her arm comes in at 12.9 s)
    (29.0, 65.8, "half", 1010, 0, 910),  # display animations: she is the right half
    (66.0, 71.4, "full", 440, 0, 900),  # her title card, before the flash (the title text is below 920 px)
]

FORCE = "--force" in sys.argv


def run(args: list[str]) -> None:
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


def source(spec: dict) -> Path:
    p = Path(spec["src"])
    return p if p.is_absolute() else SRC / p


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
    webp(HERO_SRC, IMG / "hero/front.webp", HERO_QUALITY)
    for name, src in WEB.items():
        webp(src, IMG / "web" / f"{name}.webp", WEB_QUALITY)
    (IMG / "skill").mkdir(parents=True, exist_ok=True)
    for name, file in SKILLS.items():
        out = IMG / "skill" / f"{name}.webp"
        if not keep(out):
            out.write_bytes((SRC / "other/skill/guinevere" / f"{file}.webp").read_bytes())


def build_fanart() -> None:
    for name, file in zip(FANART, FANART_SRC):
        src = FANART_DIR / file
        webp(src, IMG / "fanart" / f"{name}.webp", FANART_QUALITY, f"scale='min({FANART_W},iw)':-2:flags=lanczos")
        webp(src, IMG / "fanart" / f"{name}-sm.webp", 80, f"scale={FANART_SM_W}:-2:flags=lanczos")


def build_audio() -> None:
    """Her theme: the sound of the music video, as an AAC file the site plays."""
    out = PUBLIC / "audio/music/guinevere-theme.m4a"
    if keep(out):
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    run(["-i", str(THEME_SRC), "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)])


# --- video ------------------------------------------------------------------------------------
def out_size(name: str) -> tuple[int, int]:
    spec = VIDEOS[name]
    if spec.get("skin"):
        return SKIN_W, SKIN_H
    for key in ("clip", "pingpong"):
        if spec.get(key):
            cw, ch, _, _ = spec[key]["crop"]
            return spec["w"], round(ch * spec["w"] / cw / 2) * 2
    if spec.get("crop"):
        return spec["crop"][0], spec["crop"][1]
    p = probe(source(spec))
    w = min(spec["w"] or p["width"], p["width"])
    return w - w % 2, round(p["height"] * w / p["width"] / 2) * 2


def out_duration(name: str) -> float:
    spec = VIDEOS[name]
    if spec.get("skin"):
        return round(sum(e - s for s, e, _, _, _, _ in SKIN_PARTS), 3)
    if spec.get("clip"):
        return round(spec["clip"]["end"] - spec["clip"]["start"], 3)
    if spec.get("pingpong"):
        return round((spec["pingpong"]["end"] - spec["pingpong"]["start"]) * 2, 3)
    return probe(source(spec))["duration"]


def encode(name: str) -> None:
    spec = VIDEOS[name]
    out = VID / f"{name}.mp4"
    if keep(out):
        return
    VID.mkdir(parents=True, exist_ok=True)
    src = source(spec)
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
        graph = (
            ";".join(chains) + ";" + "".join(tags) + f"concat=n={len(SKIN_PARTS)}:v=1:a=0,"
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
            cw, ch, cx, cy = spec["crop"]
            vf.append(f"crop={cw}:{ch}:{cx}:{cy}")
        elif spec["w"] and w < probe(src)["width"]:
            vf.append(f"scale={w}:-2:flags=lanczos")
        args = ["-i", str(src), "-dn"]
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
    p = probe(video)
    t = min(spec["poster"], max(0.0, p["duration"] - 1))
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
        "/* Written by scripts/guinevere/build.py. Do not edit by hand. */",
        'import type { ImageInfo, OwnVideoName, VideoInfo } from "./media";',
        "",
        "export const OWN_VIDEOS: Record<OwnVideoName, VideoInfo> = {",
    ]
    for name in VIDEOS:
        out = VID / f"{name}.mp4"
        built = out.exists()
        w, h = (probe(out)["width"], probe(out)["height"]) if built else out_size(name)
        dur = probe(out)["duration"] if built else out_duration(name)
        size = out.stat().st_size if built else 0
        lines.append(
            f'  "{name}": {{ file: "/video/guinevere/{name}.mp4", poster: "/video/guinevere/{name}-poster.webp", '
            f"bytes: {size}, duration: {dur:.2f}, width: {w}, height: {h} }},"
        )
    lines += ["};", "", "export const IMAGES: Record<string, ImageInfo> = {"]
    groups = (
        ("hero", ["front"]),
        ("web", list(WEB)),
        ("fanart", [*FANART, *[f"{a}-sm" for a in FANART]]),
    )
    for sub, names in groups:
        for name in names:
            info = image_size(IMG / sub / f"{name}.webp")
            if info:
                lines.append(f'  "{sub}/{name}": {{ width: {info["width"]}, height: {info["height"]}, bytes: {info["bytes"]} }},')
    lines += ["};", ""]
    GENERATED.parent.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text("\n".join(lines), encoding="utf8", newline="\n")
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
    total = sum(f.stat().st_size for d in (IMG, VID, PUBLIC / "audio/music/guinevere-theme.m4a") for f in
                ([d] if d.is_file() else d.rglob("*")) if f.is_file())
    print(f"total {total / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
