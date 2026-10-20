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
  pages    About, Skills and Gallery are three more poses. Each recording is cut in three:
             in    36 frames before the action to the loop start, plus 3 frames (EXTRA)
             loop  one cycle of the page's own animation (486 frames for Skills and Gallery, 240
                   for About), dissolved at the seam like the idle loop
             out   from the last frame that still matches the loop to about a second after the
                   idle resumes. `outPhase` is the loop frame it starts at.
           `startPhases` are the idle loop frames an `in` can start at (3, 162 frames apart).
           `endPhase` is the idle loop frame the `out` (or a short) hands back to.
  shorts   short-1 .. short-3 start in the idle pose, play, and end in it.

Run: python -I scripts/selena/build.py "C:/Users/muham/Videos/selena" "C:/Users/muham/Downloads/maxresdefault.jpg" "D:/ren/aspirant/media/selena-and-obsidia/selena.webm"
     Add --tier 1080 to build one tier, --timeline-only to write the TypeScript only.
"""

import json
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
    # For devices that decode video in software, or slow ones: half the frame rate (the loops and
    # seams are measured in time, so they work at 30 fps) and a third of the pixels.
    "lite": dict(w=1280, h=576, crf=26, preset="slow", fps=30),
    "1080": dict(w=1920, h=864, crf=28, preset="slow"),
    "1440": dict(w=2560, h=1152, crf=29, preset="medium"),
}

# key -> (source, a0, L0, loop frames, out start, idle start phases, dissolve into the page in ms)
PAGES = {
    "about": ("phone-empty.mkv", 385, 604, 240, 1329, [160, 322, 484], 560),
    "skills": ("horizontal.mkv", 420, 753, 486, 1777, [122, 284, 446], 480),
    "gallery": ("vertical.mkv", 345, 894, 486, 1961, [124, 286, 448], 480),
}

# Where an entrance hands over to the page loop. It is the frame of the `in` clip (counted from its
# first frame) at which she is in the page's pose and the content can show: found with
# scripts/selena/analyze.py by matching the clip against the loop. From that frame on the clip
# is the loop itself, frame for frame (the loop's phase is (a0 + frame - l0) mod loop frames), so
# the stage can start the loop at the matching phase, at once, instead of playing on to the loop's
# own first frame (which was seconds later: 0.5 s for About, 1.7 s for Skills, 5.3 s for Gallery).
POSE = {"about": 198, "skills": 238, "gallery": 240}
IN_TAIL = 24  # frames kept after that frame, so the dissolve into the loop has a picture to dissolve from

# key -> (source, a0, idle start phases, dissolve into the short in ms)
SHORTS = {
    "short-1": ("short-1.mkv", 339, [42, 204, 366], 560),
    "short-2": ("short-2.mkv", 412, [22, 184, 346], 480),
    "short-3": ("short-3.mkv", 486, [19, 181, 343], 560),
}

# Where each exit and short gives the stage back to the idle loop. After the action there is a
# stretch of the recording where she is back in her idle pose. In a window of TAIL_WINDOW frames
# starting at `e0` that stretch matches the idle loop frame for frame, starting at idle phase
# `phi` (found by matching windows of frames against the loop, so both pictures move together).
# The dissolve starts SYNC_LEAD frames into the window, with the idle loop at the matching phase,
# and runs while both play. The clip is cut to end with the window.
# key -> (frame where the action ends in the source, e0, phi)
TAILS = {
    "about": (1654, 1678, 181),
    "skills": (1975, 2179, 197),
    "gallery": (2151, 2397, 77),
    "short-1": (746, 770, 339),
    "short-2": (821, 845, 177),
    "short-3": (871, 949, 391),
}
TAIL_WINDOW = 60
SYNC_LEAD = 6
UI_LEAD = 6  # the panel comes back this many frames before the action ends
BACK_BLEND_MS = 560

# Some recordings were made with the camera a fraction of a percent closer than the idle one
# (scripts/selena/align.py measures it). Scale of the clip that matches the idle picture, at its
# first frame and at its sync frame. The stage eases the idle picture by the inverse during the
# dissolve so the edges do not jump.
# key -> (at the start, at the end)
ALIGN = {
    "about": (0.995, 0.995),
    "skills": (1.0, 1.0),
    "gallery": (1.0, 1.0),
    "short-1": (0.995, 1.0),
    "short-2": (1.0, 0.9975),
    "short-3": (0.9975, 1.0),
}


def run(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(p.stderr)


class Tier:
    def __init__(self, name: str):
        self.name = name
        t = TIERS[name]
        self.w, self.h = t["w"], t["h"]
        self.fps = t.get("fps", FPS)
        self.scale = f"scale={self.w}:{self.h}:flags=lanczos,setsar=1,format=yuv420p"
        self.enc = [
            "-c:v", "libx264", "-preset", t["preset"], "-crf", str(t["crf"]), "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-g", str(self.fps), "-keyint_min", "10", "-sc_threshold", "0", "-bf", "3",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-movflags", "+faststart", "-r", str(self.fps),
        ]

    def graph(self, graph: str) -> tuple[str, str]:
        """The filter graph ending in [v], with the frame rate of the tier applied: a tier at
        30 fps keeps every other frame of the 60 fps timeline, so its frame count is exactly half
        (an encoder asked for -r 30 alone pads the end and the loop would be a few frames long)."""
        if self.fps == FPS:
            return graph, "[v]"
        return f"{graph};[v]fps={self.fps}:round=near[w]", "[w]"

    def seg(self, inp: int, a: int, b: int, tag: str) -> str:
        """Frames [a, b) of input `inp`, scaled and retimed from zero."""
        return f"[{inp}:v]trim=start_frame={a}:end_frame={b},{self.scale},setpts=N/({FPS}*TB)[{tag}]"


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
    graph, label = t.graph(";".join(parts))
    run([
        "-i", str(src / "welcome.mkv"), "-i", str(src / "idle.mkv"),
        "-filter_complex", graph,
        "-map", label, *t.enc, "-an", str(out),
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
    graph, label = t.graph(";".join(parts))
    run(["-i", str(source), "-filter_complex", graph, "-map", label, *t.enc, "-an", str(out)])


def build_cut(t: Tier, source: Path, a: int, b: int, out: Path) -> None:
    """Frames [a, b) of a recording. The videos are silent: the sound comes from the site."""
    graph, label = t.graph(t.seg(0, a, b, "v"))
    run(["-i", str(source), "-filter_complex", graph, "-map", label, *t.enc, "-an", str(out)])


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


def tail_end(key: str) -> int:
    """The last frame (exclusive) of an exit or a short in its recording."""
    return TAILS[key][1] + TAIL_WINDOW


def build_tier(name: str, src: Path, out_root: Path, parts: set[str]) -> None:
    t = Tier(name)
    out = out_root / name
    out.mkdir(parents=True, exist_ok=True)
    if "base" in parts:
        build_welcome(t, src, out / "welcome.mp4")
        build_loop(t, src / "idle.mkv", LOOP_START, LOOP_FRAMES, out / "idle.mp4")
    for key, (file, a0, l0, p, o0, _s, _b) in PAGES.items():
        if "in" in parts:
            build_cut(t, src / file, a0, a0 + POSE[key] + IN_TAIL, out / f"{key}-in.mp4")
        if "loop" in parts:
            build_loop(t, src / file, l0, p, out / f"{key}-loop.mp4")
        if "out" in parts:
            build_cut(t, src / file, o0, tail_end(key), out / f"{key}-out.mp4")
    if "short" in parts:
        for key, (file, a0, _s, _b) in SHORTS.items():
            build_cut(t, src / file, a0, tail_end(key), out / f"{key}.mp4")
    print(name, "done", sum(f.stat().st_size for f in out.glob("*.mp4")) // 1048576, "MB", flush=True)


def seg_info(file: str, frames: int, **extra) -> dict:
    return {"file": file, "frames": frames, **extra}


def back_timing(key: str, start: int) -> dict:
    """How a clip hands the stage back to the idle loop. `start` is its first frame in the recording."""
    action_end, e0, phi = TAILS[key]
    return {
        "syncFrame": e0 + SYNC_LEAD - start,
        "syncPhase": (phi + SYNC_LEAD) % LOOP_FRAMES,
        "uiFrame": max(0, action_end - UI_LEAD - start),
        "blendMs": BACK_BLEND_MS,
        "align": ALIGN[key][1],
    }


def timeline(out_root: Path) -> str:
    pages = {}
    for key, (_file, a0, l0, p, o0, starts, b_in) in PAGES.items():
        pages[key] = {
            "in": seg_info(
                f"{key}-in.mp4",
                POSE[key] + IN_TAIL,
                startPhases=starts,
                blendMs=b_in,
                align=ALIGN[key][0],
                handFrame=POSE[key],
                loopOffset=(a0 - l0) % p,
            ),
            "loop": seg_info(f"{key}-loop.mp4", p),
            "out": seg_info(
                f"{key}-out.mp4",
                tail_end(key) - o0,
                startPhase=(o0 - l0) % p,
                **back_timing(key, o0),
            ),
        }
    shorts = {
        key: seg_info(
            f"{key}.mp4",
            tail_end(key) - a0,
            startPhases=starts,
            blendMs=b_in,
            align=ALIGN[key][0],
            back=back_timing(key, a0),
        )
        for key, (_file, a0, starts, b_in) in SHORTS.items()
    }
    names = ["welcome.mp4", "idle.mp4"]
    for key in PAGES:
        names += [f"{key}-in.mp4", f"{key}-loop.mp4", f"{key}-out.mp4"]
    names += [f"{key}.mp4" for key in SHORTS]
    sizes = {}
    for tier in TIERS:
        d = out_root / tier
        sizes[tier] = {n: (d / n).stat().st_size if (d / n).exists() else 0 for n in names}
    tiers = {k: {"width": v["w"], "fps": v.get("fps", FPS)} for k, v in TIERS.items()}
    return (
        "// Generated by scripts/selena/build.py. Do not edit.\n\n"
        'import type { Timeline } from "../stage/timeline";\n\n'
        "/** The sizes the videos exist in, smallest first. `width` is the video width in pixels. */\n"
        f"export const SELENA_TIERS = {json.dumps(tiers, indent=2)} as const;\n"
        "export type SelenaTier = keyof typeof SELENA_TIERS;\n\n"
        "/** Size in bytes of every file in every tier, for the loading bar. */\n"
        f"export const SELENA_BYTES: Record<SelenaTier, Record<string, number>> = {json.dumps(sizes, indent=2)};\n\n"
        "export const SELENA_TIMELINE = {\n"
        f"  fps: {FPS},\n"
        f"  loopFrames: {LOOP_FRAMES},\n"
        f"  extraFrames: {EXTRA},\n"
        f"  pages: {json.dumps(pages, indent=2)},\n"
        f"  shorts: {json.dumps(shorts, indent=2)},\n"
        "} as const satisfies Timeline;\n"
    )


def main() -> None:
    argv = sys.argv[1:]
    flags = {a for a in argv if a.startswith("--")}
    only = None
    if "--tier" in argv:
        only = argv[argv.index("--tier") + 1]
    skip = {only} if only else set()
    if "--parts" in argv:
        skip.add(argv[argv.index("--parts") + 1])
    args = [a for a in argv if not a.startswith("--") and a not in skip]
    src = Path(args[0])
    root = Path(__file__).resolve().parents[2]
    web = root / "apps" / "web"
    out_root = web / "public" / "video" / "selena"
    out_root.mkdir(parents=True, exist_ok=True)

    parts = {"base", "in", "loop", "out", "short"}
    if "--parts" in argv:
        parts = set(argv[argv.index("--parts") + 1].split(","))
    if "--timeline-only" not in flags:
        for name in [only] if only else list(TIERS):
            build_tier(name, src, out_root, parts)
        build_still(src, out_root / "still.webp", 1920, 864)
        if len(args) > 1:
            build_poster(Path(args[1]), out_root / "trailer-poster.webp")
        if len(args) > 2:
            build_trailer(Path(args[2]), out_root)

    dest = web / "src" / "features" / "character" / "selena" / "timeline.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(timeline(out_root), encoding="utf-8")
    print("wrote", dest)


if __name__ == "__main__":
    main()
