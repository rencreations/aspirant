"""
Builds the Selena stage videos in three sizes.

Source: C:/Users/muham/Videos/selena/*.mkv (3840x1728, 60 fps, recorded from the Live2D viewer).
Output: apps/web/public/video/selena/<tier>/*.mp4, a still, the trailer renditions and
        src/features/character/selena/timeline.generated.ts

Tiers (all H.264, so every browser plays them; the page picks one for the visitor's display):
  1080  1920x864    phones, tablets, small screens
  1440  2560x1152   full HD and QHD screens
  2160  3840x1728   the source size, for 4K and retina screens

Frame numbers are at 60 fps and were found with scripts/selena/analyze.py (grey 320x144 proxies
of the recordings, windowed mean squared error between frames).

  welcome  Frames 86 to 1034 of welcome.mkv. The recording opens on the game's hero-select UI; the
           animation starts with a hard cut between 85 and 86. At 1034 it has settled into the
           idle pose and the UI has not started to fade in (it does from about 1036). That frame
           matches idle frame 1470. The last 6 frames dissolve into idle frames 1465..1470 and 3
           idle frames follow (EXTRA), so the hand-over to the loop can start a few frames early.
  idle     The idle animation repeats every 486 frames (8.1 s). The loop is idle frames 1471..1956,
           the frames after the welcome cut. The last 20 frames dissolve into the 20 before the
           start, so the wrap is hidden (the debris in the background drifts and never repeats).
  pages    About, Skills, Gallery and Others are four more poses. Each recording is cut in three:
             in    36 frames before the action to the loop start, plus 3 frames (EXTRA)
             loop  one cycle of the page's own animation (486 frames for Skills and Gallery, 240
                   for About and Others), dissolved at the seam like the idle loop
             out   from the last frame that still matches the loop to about a second after the
                   idle resumes. `outPhase` is the loop frame it starts at.
           `startPhases` are the idle loop frames an `in` can start at (3, 162 frames apart).
           `endPhase` is the idle loop frame the `out` (or a short) hands back to.
  shorts   short-1 .. short-3 start in the idle pose, play, and end in it.

Run: python -I scripts/selena/build.py "C:/Users/muham/Videos/selena" "C:/Users/muham/Downloads/maxresdefault.jpg" "D:/ren/aspirant/media/selena-and-obsidia/selena.webm"
     Add --tier 1080 to build one tier, --timeline-only to write the TypeScript only.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

FPS = 60
LOOP_START = 1471  # idle frame the idle loop starts at
LOOP_FRAMES = 486
XFADE = 20  # frames dissolved at a loop seam
EXTRA = 3  # frames after a cut, skipped by the hand-over
WELCOME_START, WELCOME_END, WELCOME_BLEND = 86, 1034, 6

TIERS = {
    "1080": dict(w=1920, h=864, crf=28, preset="slow"),
    "1440": dict(w=2560, h=1152, crf=29, preset="medium"),
    "2160": dict(w=3840, h=1728, crf=31, preset="medium"),
}

# key -> (source, a0, L0, loop frames, out start, e, idle start phases, idle end phase, in dissolve ms, out dissolve ms)
# The phone clips (About, Others) were recorded with the pointer elsewhere, so their idle pose
# differs a little from the idle loop and they dissolve more slowly.
PAGES = {
    "about": ("phone-empty.mkv", 385, 604, 240, 1329, 1762, [160, 322, 484], 265, 420, 420),
    "skills": ("horizontal.mkv", 420, 753, 486, 1777, 2080, [122, 284, 446], 422, 140, 140),
    "gallery": ("vertical.mkv", 345, 894, 486, 1961, 2256, [124, 286, 448], 422, 140, 140),
    "others": ("phone-messages.mkv", 381, 664, 240, 1848, 2305, [20, 182, 344], 128, 420, 420),
}

# key -> (source, a0, e, idle start phases, idle end phase, dissolve ms)
SHORTS = {
    "short-1": ("short-1.mkv", 339, 776, [42, 204, 366], 345, 420),
    "short-2": ("short-2.mkv", 412, 962, [22, 184, 346], 134, 420),
    "short-3": ("short-3.mkv", 486, 982, [19, 181, 343], 424, 420),
}

AUDIO = ["-c:a", "aac", "-b:a", "112k", "-ar", "48000", "-ac", "2"]


def run(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(p.stderr)


class Tier:
    def __init__(self, name: str):
        self.name = name
        t = TIERS[name]
        self.w, self.h = t["w"], t["h"]
        self.scale = f"scale={self.w}:{self.h}:flags=lanczos,setsar=1,format=yuv420p"
        self.enc = [
            "-c:v", "libx264", "-preset", t["preset"], "-crf", str(t["crf"]), "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-g", "30", "-keyint_min", "10", "-sc_threshold", "0", "-bf", "3",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-movflags", "+faststart", "-r", str(FPS),
        ]

    def seg(self, inp: int, a: int, b: int, tag: str) -> str:
        """Frames [a, b) of input `inp`, scaled and retimed from zero."""
        return f"[{inp}:v]trim=start_frame={a}:end_frame={b},{self.scale},setpts=N/({FPS}*TB)[{tag}]"


def mean_volume(path: Path) -> float:
    p = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(path), "-vn", "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    m = re.search(r"mean_volume: (-?[\d.]+) dB", p.stderr)
    return float(m.group(1)) if m else -91.0


def has_audio(path: Path) -> bool:
    return mean_volume(path) > -70


def build_welcome(t: Tier, src: Path, out: Path) -> None:
    n = WELCOME_END + 1 - WELCOME_BLEND
    parts = [
        t.seg(0, WELCOME_START, n, "m"),
        t.seg(0, n, WELCOME_END + 1, "wt"),
        t.seg(1, LOOP_START - WELCOME_BLEND, LOOP_START, "it"),
        t.seg(1, LOOP_START, LOOP_START + EXTRA, "x"),
        f"[wt][it]blend=all_expr='A*(1-(N+1)/{WELCOME_BLEND})+B*((N+1)/{WELCOME_BLEND})'[b]",
        "[m][b][x]concat=n=3:v=1:a=0[v]",
    ]
    t0, t1 = WELCOME_START / FPS, (WELCOME_END + 1) / FPS
    audio = (
        f"[0:a]atrim=start={t0:.5f}:end={t1:.5f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,"
        f"afade=t=out:st={t1 - t0 - 0.06:.4f}:d=0.06,apad=pad_dur={EXTRA / FPS:.5f}[a]"
    )
    run([
        "-i", str(src / "welcome.mkv"), "-i", str(src / "idle.mkv"),
        "-filter_complex", ";".join([*parts, audio]),
        "-map", "[v]", "-map", "[a]", *t.enc, *AUDIO, str(out),
    ])


def build_loop(t: Tier, source: Path, start: int, frames: int, out: Path) -> None:
    """One cycle starting at `start`; the last XFADE frames dissolve into the XFADE before it."""
    end = start + frames
    parts = [
        t.seg(0, start, end - XFADE, "m"),
        t.seg(0, end - XFADE, end, "ta"),
        t.seg(0, start - XFADE, start, "tb"),
        f"[ta][tb]blend=all_expr='A*(1-(N+1)/{XFADE})+B*((N+1)/{XFADE})'[b]",
        "[m][b]concat=n=2:v=1:a=0[v]",
    ]
    run(["-i", str(source), "-filter_complex", ";".join(parts), "-map", "[v]", *t.enc, "-an", str(out)])


def build_cut(t: Tier, source: Path, a: int, b: int, out: Path, audio: bool, fade_out: float) -> None:
    """Frames [a, b) of a recording, with its sound when it has any."""
    t0, t1 = a / FPS, b / FPS
    parts = [t.seg(0, a, b, "v")]
    maps = ["-map", "[v]"]
    codec = [*t.enc]
    if audio:
        parts.append(
            f"[0:a]atrim=start={t0:.5f}:end={t1:.5f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d=0.02,afade=t=out:st={t1 - t0 - fade_out:.4f}:d={fade_out}[a]"
        )
        maps += ["-map", "[a]"]
        codec += AUDIO
    else:
        codec += ["-an"]
    run(["-i", str(source), "-filter_complex", ";".join(parts), *maps, *codec, str(out)])


def build_still(src: Path, out: Path, w: int, h: int) -> None:
    run([
        "-i", str(src / "idle.mkv"),
        "-vf", f"select=eq(n\\,{LOOP_START}),scale={w}:{h}:flags=lanczos,setsar=1",
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "86", str(out),
    ])


def build_poster(jpg: Path, out: Path) -> None:
    run(["-i", str(jpg), "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libwebp", "-quality", "86", str(out)])


TRAILER = {  # name -> (height, crf, max kbit/s)
    "1080": (1080, 29, 3600),
    "720": (720, 30, 1800),
    "480": (480, 31, 800),
}


def build_trailer(webm: Path, out_dir: Path) -> None:
    """The trailer in three sizes for the player's quality menu."""
    for name, (h, crf, kbps) in TRAILER.items():
        run([
            "-i", str(webm), "-vf", f"scale=-2:{h}:flags=lanczos,setsar=1,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-maxrate", f"{kbps}k",
            "-bufsize", f"{kbps * 2}k", "-profile:v", "high", "-g", "60", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "128k", str(out_dir / f"trailer-{name}.mp4"),
        ])


def build_tier(name: str, src: Path, out_root: Path, audio: dict[str, bool]) -> None:
    t = Tier(name)
    out = out_root / name
    out.mkdir(parents=True, exist_ok=True)
    build_welcome(t, src, out / "welcome.mp4")
    build_loop(t, src / "idle.mkv", LOOP_START, LOOP_FRAMES, out / "idle.mp4")
    for key, (file, a0, l0, p, o0, e, _s, _e, _bi, _bo) in PAGES.items():
        a = audio[file]
        build_cut(t, src / file, a0, l0 + EXTRA, out / f"{key}-in.mp4", a, 0.1)
        build_loop(t, src / file, l0, p, out / f"{key}-loop.mp4")
        build_cut(t, src / file, o0, e + 1, out / f"{key}-out.mp4", a, 0.12)
    for key, (file, a0, e, _s, _e, _b) in SHORTS.items():
        build_cut(t, src / file, a0, e + 1, out / f"{key}.mp4", audio[file], 0.12)
    print(name, "done", sum(f.stat().st_size for f in out.glob("*.mp4")) // 1048576, "MB", flush=True)


def seg_info(file: str, frames: int, audio: bool, **extra) -> dict:
    return {"file": file, "frames": frames, "audio": audio, **extra}


def timeline(audio: dict[str, bool], out_root: Path) -> str:
    pages = {}
    for key, (file, a0, l0, p, o0, e, starts, end_phase, b_in, b_out) in PAGES.items():
        a = audio[file]
        pages[key] = {
            "in": seg_info(f"{key}-in.mp4", l0 + EXTRA - a0, a, startPhases=starts, blendMs=b_in),
            "loop": seg_info(f"{key}-loop.mp4", p, False),
            "out": seg_info(
                f"{key}-out.mp4", e + 1 - o0, a, startPhase=(o0 - l0) % p, endPhase=end_phase, blendMs=b_out
            ),
        }
    shorts = {
        key: seg_info(f"{key}.mp4", e + 1 - a0, audio[file], startPhases=starts, endPhase=end_phase, blendMs=b)
        for key, (file, a0, e, starts, end_phase, b) in SHORTS.items()
    }
    names = ["welcome.mp4", "idle.mp4"]
    for key in PAGES:
        names += [f"{key}-in.mp4", f"{key}-loop.mp4", f"{key}-out.mp4"]
    names += [f"{key}.mp4" for key in SHORTS]
    sizes = {}
    for tier in TIERS:
        d = out_root / tier
        sizes[tier] = {n: (d / n).stat().st_size if (d / n).exists() else 0 for n in names}
    tiers = {k: {"width": v["w"]} for k, v in TIERS.items()}
    return (
        "// Generated by scripts/selena/build.py. Do not edit.\n\n"
        f"export const SELENA_FPS = {FPS};\n"
        f"export const SELENA_LOOP_FRAMES = {LOOP_FRAMES};\n"
        f"export const SELENA_EXTRA_FRAMES = {EXTRA};\n\n"
        "/** The sizes the videos exist in, smallest first. `width` is the video width in pixels. */\n"
        f"export const SELENA_TIERS = {json.dumps(tiers, indent=2)} as const;\n"
        "export type SelenaTier = keyof typeof SELENA_TIERS;\n\n"
        "/** Size in bytes of every file in every tier, for the loading bar. */\n"
        f"export const SELENA_BYTES: Record<SelenaTier, Record<string, number>> = {json.dumps(sizes, indent=2)};\n\n"
        "interface IdleStart {\n"
        "  file: string;\n"
        "  frames: number;\n"
        "  audio: boolean;\n"
        "  /** Idle loop frames this video can start at. They repeat every 162 frames. */\n"
        "  startPhases: readonly number[];\n"
        "  /** Length of the dissolve into the video, in ms. */\n"
        "  blendMs: number;\n"
        "}\n\n"
        "export interface ShortTiming extends IdleStart {\n"
        "  /** Idle loop frame the idle resumes at when the short ends. */\n"
        "  endPhase: number;\n"
        "}\n\n"
        "export interface PageTiming {\n"
        "  in: IdleStart;\n"
        "  loop: { file: string; frames: number; audio: boolean };\n"
        "  out: {\n"
        "    file: string;\n"
        "    frames: number;\n"
        "    audio: boolean;\n"
        "    /** Page loop frame the exit starts at. */\n"
        "    startPhase: number;\n"
        "    /** Idle loop frame the idle resumes at. */\n"
        "    endPhase: number;\n"
        "    blendMs: number;\n"
        "  };\n"
        "}\n\n"
        f"export const SELENA_PAGES = {json.dumps(pages, indent=2)} as const satisfies Record<string, PageTiming>;\n\n"
        f"export const SELENA_SHORTS = {json.dumps(shorts, indent=2)} as const satisfies Record<string, ShortTiming>;\n"
    )


def main() -> None:
    argv = sys.argv[1:]
    flags = {a for a in argv if a.startswith("--")}
    only = None
    if "--tier" in argv:
        only = argv[argv.index("--tier") + 1]
    args = [a for a in argv if not a.startswith("--") and a != only]
    src = Path(args[0])
    root = Path(__file__).resolve().parents[2]
    web = root / "apps" / "web"
    out_root = web / "public" / "video" / "selena"
    out_root.mkdir(parents=True, exist_ok=True)

    audio = {f: has_audio(src / f) for f in {p[0] for p in PAGES.values()} | {s[0] for s in SHORTS.values()}}
    if "--timeline-only" not in flags:
        for name in [only] if only else list(TIERS):
            build_tier(name, src, out_root, audio)
        build_still(src, out_root / "still.webp", 1920, 864)
        if len(args) > 1:
            build_poster(Path(args[1]), out_root / "trailer-poster.webp")
        if len(args) > 2:
            build_trailer(Path(args[2]), out_root)

    dest = web / "src" / "features" / "character" / "selena" / "timeline.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(timeline(audio, out_root), encoding="utf-8")
    print("wrote", dest)


if __name__ == "__main__":
    main()
