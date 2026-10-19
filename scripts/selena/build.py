"""
Builds the Selena stage videos.

Source: C:/Users/muham/Videos/selena/*.mkv (3840x1728, 60 fps, recorded from the Live2D viewer).
Output: apps/web/public/video/selena/*.mp4, a still, and src/features/character/selena/timeline.generated.ts

What the cuts are (frame numbers at 60 fps, found with scripts/selena/analyze.py):

  welcome  The recording starts on the game's hero-select UI. The animation starts at frame 86
           (the hard cut is between 85 and 86). The animation settles into the idle pose at
           frame ~1034; the UI starts to fade back in right after, so frame 1034 is the last clean
           frame. It matches idle frame 1470 (mse 27, the noise floor between two cycles is ~14).
           The last 6 frames cross-fade into the idle frames 1465..1470 and 3 more idle frames
           (1471..1473) follow, so the hand-over to the loop can start a few frames early.
  loop     The idle animation repeats every 486 frames (8.1 s). The best seams are phase-equal
           frames of the idle recording. The loop starts at idle frame 1471, the frame that follows
           the welcome cut, so welcome -> loop is continuous. The last 20 frames cross-fade into
           the 20 frames before the start, so the wrap is hidden (the background debris drifts
           and never repeats exactly).
  clips    Each action clip starts in the idle pose and ends in it. They are trimmed to 36 frames
           before the action starts (a0) and to ~1 s after it ends (e). The idle phases (frames of
           the loop) where a clip can start are `startPhases` (they repeat every 162 frames,
           the sub-cycle). `endPhase` is the loop frame the idle resumes at.

Run: python -I scripts/selena/build.py "C:/Users/muham/Videos/selena" "C:/Users/muham/Downloads/maxresdefault.jpg" "D:/ren/aspirant/media/selena-and-obsidia/selena.webm"
"""

import json
import re
import subprocess
import sys
from pathlib import Path

FPS = 60
W, H = 1920, 864
LOOP_START = 1471  # idle frame the loop starts at
LOOP_FRAMES = 486  # one full animation cycle
XFADE = 20  # frames cross-faded at the loop seam
WELCOME_START = 86  # first frame of the animation
WELCOME_END = 1034  # last clean frame (no UI)
WELCOME_BLEND = 6
WELCOME_EXTRA = 3  # idle frames after the cut, skipped by the hand-over

# name -> (file, a0, e, start phases, end phase, dissolve in ms). Measured on the 320x144 grey proxy.
# The phone clips were recorded with the pointer elsewhere, so their idle pose differs a little from
# the loop (mse ~120 against ~30 for the others) and they dissolve more slowly.
CLIPS = {
    "horizontal": ("horizontal.mkv", 420, 2080, [122, 284, 446], 422, 140),
    "vertical": ("vertical.mkv", 345, 2256, [124, 286, 448], 422, 140),
    "phone-empty": ("phone-empty.mkv", 385, 1762, [160, 322, 484], 265, 420),
    "phone-messages": ("phone-messages.mkv", 381, 2305, [20, 182, 344], 128, 420),
}

ENC = [
    "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-g", "30", "-keyint_min", "10", "-sc_threshold", "0", "-bf", "3",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-movflags", "+faststart", "-r", str(FPS),
]
AUDIO = ["-c:a", "aac", "-b:a", "112k", "-ar", "48000", "-ac", "2"]

SCALE = f"scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p"


def run(args: list[str]) -> str:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(p.stderr)
    return p.stderr


def seg(inp: int, a: int, b: int, tag: str) -> str:
    """Frames [a, b) of input `inp`, scaled and retimed from zero."""
    return (
        f"[{inp}:v]trim=start_frame={a}:end_frame={b},{SCALE},"
        f"setpts=N/({FPS}*TB)[{tag}]"
    )


def mean_volume(path: Path) -> float:
    p = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(path), "-vn", "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    m = re.search(r"mean_volume: (-?[\d.]+) dB", p.stderr)
    return float(m.group(1)) if m else -91.0


def duration(path: Path) -> float:
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
    )
    return float(p.stdout.strip())


def build_welcome(src: Path, out: Path) -> None:
    w, idle = src / "welcome.mkv", src / "idle.mkv"
    n = WELCOME_END + 1 - WELCOME_BLEND
    parts = [
        seg(0, WELCOME_START, n, "m"),
        seg(0, n, WELCOME_END + 1, "wt"),
        seg(1, LOOP_START - WELCOME_BLEND, LOOP_START, "it"),
        seg(1, LOOP_START, LOOP_START + WELCOME_EXTRA, "x"),
        f"[wt][it]blend=all_expr='A*(1-(N+1)/{WELCOME_BLEND})+B*((N+1)/{WELCOME_BLEND})'[b]",
        "[m][b][x]concat=n=3:v=1:a=0[v]",
    ]
    t0 = WELCOME_START / FPS
    t1 = (WELCOME_END + 1) / FPS
    fade_out_at = t1 - t0 - 0.06
    audio = (
        f"[0:a]atrim=start={t0:.5f}:end={t1:.5f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:d=0.02,afade=t=out:st={fade_out_at:.4f}:d=0.06,"
        f"apad=pad_dur={WELCOME_EXTRA / FPS:.5f}[a]"
    )
    run([
        "-i", str(w), "-i", str(idle),
        "-filter_complex", ";".join([*parts, audio]),
        "-map", "[v]", "-map", "[a]", *ENC, *AUDIO, str(out),
    ])


def build_loop(src: Path, out: Path) -> None:
    idle = src / "idle.mkv"
    end = LOOP_START + LOOP_FRAMES
    parts = [
        seg(0, LOOP_START, end - XFADE, "m"),
        seg(0, end - XFADE, end, "ta"),
        seg(0, LOOP_START - XFADE, LOOP_START, "tb"),
        f"[ta][tb]blend=all_expr='A*(1-(N+1)/{XFADE})+B*((N+1)/{XFADE})'[b]",
        "[m][b]concat=n=2:v=1:a=0[v]",
    ]
    run(["-i", str(idle), "-filter_complex", ";".join(parts), "-map", "[v]", *ENC, "-an", str(out)])


def build_clip(src: Path, name: str, out: Path, encode: bool = True) -> dict:
    file, a0, e, starts, end_phase, blend_ms = CLIPS[name]
    path = src / file
    has_audio = mean_volume(path) > -70
    t0, t1 = a0 / FPS, (e + 1) / FPS
    parts = [seg(0, a0, e + 1, "v")]
    maps = ["-map", "[v]"]
    codec = [*ENC]
    if has_audio:
        parts.append(
            f"[0:a]atrim=start={t0:.5f}:end={t1:.5f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d=0.02,afade=t=out:st={t1 - t0 - 0.12:.4f}:d=0.12[a]"
        )
        maps += ["-map", "[a]"]
        codec += AUDIO
    else:
        codec += ["-an"]
    if encode:
        run(["-i", str(path), "-filter_complex", ";".join(parts), *maps, *codec, str(out)])
    return {
        "file": out.name,
        "frames": e + 1 - a0,
        "startPhases": starts,
        "endPhase": end_phase,
        "audio": has_audio,
        "blendMs": blend_ms,
    }


def build_still(src: Path, out: Path) -> None:
    run([
        "-i", str(src / "idle.mkv"),
        "-vf", f"select=eq(n\\,{LOOP_START}),{SCALE.replace(',format=yuv420p', '')}",
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "86", str(out),
    ])


def build_poster(jpg: Path, out: Path) -> None:
    run(["-i", str(jpg), "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libwebp", "-quality", "86", str(out)])


def build_trailer(webm: Path, out: Path) -> None:
    """The trailer, 720p H.264 so it plays everywhere."""
    run([
        "-i", str(webm),
        "-vf", "scale=1280:720:flags=lanczos,setsar=1,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-maxrate", "1800k", "-bufsize", "3600k", "-profile:v", "high", "-g", "60",
        "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", str(out),
    ])


def main() -> None:
    src = Path([a for a in sys.argv[1:] if not a.startswith("--")][0])
    root = Path(__file__).resolve().parents[2]
    web = root / "apps" / "web"
    out = web / "public" / "video" / "selena"
    out.mkdir(parents=True, exist_ok=True)

    timeline_only = "--timeline-only" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not timeline_only:
        build_welcome(src, out / "welcome.mp4")
        print("welcome", round(duration(out / "welcome.mp4"), 3), "s", (out / "welcome.mp4").stat().st_size // 1024, "KB")
        build_loop(src, out / "loop.mp4")
        print("loop", round(duration(out / "loop.mp4"), 3), "s", (out / "loop.mp4").stat().st_size // 1024, "KB")
        build_still(src, out / "still.webp")
        if len(args) > 1:
            build_poster(Path(args[1]), out / "trailer-poster.webp")

    if len(args) > 2 and not timeline_only:
        build_trailer(Path(args[2]), out / "trailer.mp4")
        print("trailer", round(duration(out / "trailer.mp4"), 3), "s", (out / "trailer.mp4").stat().st_size // 1024, "KB")

    clips = {}
    for name in CLIPS:
        clips[name] = build_clip(src, name, out / f"{name}.mp4", encode=not timeline_only)
        print(name, round(duration(out / f"{name}.mp4"), 3), "s", (out / f"{name}.mp4").stat().st_size // 1024, "KB")

    ts = (
        "// Generated by scripts/selena/build.py. Do not edit.\n\n"
        f"export const SELENA_FPS = {FPS};\n"
        f"export const SELENA_LOOP_FRAMES = {LOOP_FRAMES};\n"
        f"export const SELENA_WELCOME_EXTRA_FRAMES = {WELCOME_EXTRA};\n\n"
        "export interface SelenaClipTiming {\n"
        "  file: string;\n"
        "  frames: number;\n"
        "  /** Loop frames the clip can start at. They repeat every 162 frames. */\n"
        "  startPhases: readonly number[];\n"
        "  /** Loop frame the idle resumes at when the clip ends. */\n"
        "  endPhase: number;\n"
        "  audio: boolean;\n"
        "  /** Length of the dissolve into and out of the clip, in ms. */\n"
        "  blendMs: number;\n"
        "}\n\n"
        f"export const SELENA_CLIPS = {json.dumps(clips, indent=2)} as const satisfies Record<string, SelenaClipTiming>;\n"
    )
    dest = web / "src" / "features" / "character" / "selena" / "timeline.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(ts, encoding="utf-8")
    print("wrote", dest)


if __name__ == "__main__":
    main()
