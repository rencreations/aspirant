"""
Builds the videos of Vexana's interactive room (the bottom of her page) in four sizes.

Source: C:/Users/muham/Videos/vexana/*.mkv (3840x1728, 60 fps, recorded from the game's hero
        showcase: welcome, face, left-hand, big-thing, zoom). The AAC audio is dropped.
Output: apps/web/public/video/vexana-stage/<tier>/*.mp4, a still, and
        src/features/character/vexana/room/timeline.generated.ts (the stage engine's timeline).

The room runs on the same engine as Selena's and Obsidia's pages (features/character/stage/), so
this script follows scripts/obsidia/build.py: same tiers, same kinds of clips, same timeline.

Tiers (all H.264, so every browser plays them; the page picks one for the visitor's display):
  lite  1280x576   30 fps, for devices that decode in software
  1080  1920x864   phones, tablets, small screens
  1440  2560x1152  full HD and QHD screens
  2160  3840x1728  the source size, for 4K and retina screens

THERE IS NO idle.mkv. The owner's folder has no idle recording of Vexana, so the idle loop is
derived from the idle stretches inside the recordings (scripts/vexana/stage-proxy.py makes grey
320x144 proxies, then frames were compared by mean squared error and checked by eye):

  idle     The game's hero showcase idles with a 162 frame cycle (2.7 s): a sway of the camera and
           the cloth, with the Guardian breathing beside her. The mean squared error between a
           frame and the frame 162 later is about 23 in the cleanest place (against 400 and more
           at other lags). The idle stretch of zoom.mkv (frames 0 to 627, 10.5 s) is the longest
           contiguous one, so the loop is zoom.mkv frames 93 to 254 (LOOP_START, LOOP_FRAMES), the
           last XFADE frames dissolved into the XFADE before the start (as Obsidia's). LOOP_START
           is the frame after the one that the welcome ends on, so the welcome hands over to the
           loop at its very first frame (phase 0).
           The cycle is not perfectly closed: a slow drift (a small turn of the camera over tens
           of seconds) makes the end differ from the start a little (the dissolve hides it), and
           the recordings were made one after the other, so the idle of each starts and ends in a
           slightly different camera pose (phase averaged mean squared error 4 to 120 between
           stretches, the difference is a sway of a few percent, see `g-diff` in the notes). The
           stage dissolves over `blendMs` at every hand-over, which hides it.
           To use a real idle recording instead, run the analysis again against it (the phase
           offsets c_head and c_tail below are measured against the loop) and replace IDLE_SRC,
           LOOP_START and LOOP_FRAMES.
  welcome  Frames 203 to 1154 of welcome.mkv. The recording opens on the game's hero-select UI;
           the animation starts with a hard cut between 202 and 203 (3.4 s). By 1130 she and the
           Guardian have settled, and the UI starts to fade back in at the edges from about 1156,
           so the cut stops at 1154, which matches idle frame LOOP_START - 1 (mse 32). The last 6
           frames dissolve into idle frames and 3 idle frames follow (EXTRA).
  pages    Only one: the zoom pose ("Change pose", zoom.mkv). The engine knows three page names, so
           it is `gallery`; `about` and `skills` in the timeline are copies of it (the same files)
           and are never asked for. The recording is cut in three:
             in    36 frames before the action to the frame where she is in the pose (`pose`),
                   and 24 frames more
             loop  one cycle of the pose's own animation (160 frames), dissolved at the seam
             out   from a few frames before the last frame that still matches the loop to the end
                   of the stretch where she is back in her idle pose
  shorts   short-1 = face.mkv, short-2 = left-hand.mkv, short-3 = big-thing.mkv. Each starts in the
           idle pose, plays, and ends in it.

Run: python -I scripts/vexana/stage.py "C:/Users/muham/Videos/vexana"
     Add --tier 1080 to build one tier, --parts base,in to build some of the parts, --force to
     rebuild files that exist, and --timeline-only to write the TypeScript only.
     (Only ffmpeg is needed, no Python packages.)
"""

import json
import os
import subprocess
import sys
from pathlib import Path

FPS = 60
IDLE_SRC = "zoom.mkv"  # no idle.mkv exists: the idle loop is cut from the zoom recording's idle head
LOOP_START = 93  # frame of IDLE_SRC the idle loop starts at (the frame after the welcome's last)
LOOP_FRAMES = 162
XFADE = 20  # frames dissolved at a loop seam
EXTRA = 3  # frames after a cut, skipped by the hand-over
WELCOME_START, WELCOME_END, WELCOME_BLEND = 203, 1154, 6

# `loop` is the CRF of the idle and page loops, which are on screen most of the time and are
# looked at, so they get the most bits. `clip` is the CRF of everything that is on screen for a
# moment while it moves. The numbers are Obsidia's, checked against the size budget (see the
# report of the build: all four sizes together stay under about 650 MB).
TIERS = {
    "lite": dict(w=1280, h=576, loop=23, clip=25, level="3.1", preset="slow", fps=30),
    "1080": dict(w=1920, h=864, loop=19, clip=20, level="4.2", preset="slow"),
    "1440": dict(w=2560, h=1152, loop=17, clip=18, level="5.1", preset="slow"),
    "2160": dict(w=3840, h=1728, loop=20, clip=21, level="5.2", preset="slow"),
}

# What was measured in each recording (frames of the 60 fps recording).
#   file       the recording
#   head_end   the first frame of the action: before it she is in her idle pose
#   c_head     idle phase = (frame + c_head) mod LOOP_FRAMES in the head (phase 0 is IDLE_SRC
#              frame LOOP_START)
#   action_end the first frame where she is back in the idle pose (the tail of the recording)
#   c_tail     idle phase = (frame + c_tail) mod LOOP_FRAMES in that tail
#   pose       pages: the frame where she is in the page's pose (from here on the recording is the
#              page loop, frame for frame)
#   l0, p      pages: the page loop is frames l0 .. l0 + p of the recording (p is its period)
#   exit       pages: the frame the exit starts at, a few frames before it leaves the loop
CLIPS = {
    "gallery": dict(file="zoom.mkv", head_end=628, c_head=69, action_end=2115, c_tail=151,
                    pose=756, l0=1073, p=160, exit=1860),
    "short-1": dict(file="face.mkv", head_end=371, c_head=111, action_end=784, c_tail=18),
    "short-2": dict(file="left-hand.mkv", head_end=413, c_head=20, action_end=926, c_tail=34),
    "short-3": dict(file="big-thing.mkv", head_end=354, c_head=21, action_end=810, c_tail=154),
}
SHORTS_AND_PAGES = {k: dict(v, e0=v["action_end"] + 16) for k, v in CLIPS.items()}

IN_LEAD = 36  # frames of idle pose before the action, in an entrance or a short
IN_TAIL = 24  # frames kept after the pose frame, so the dissolve into the loop has a picture to dissolve from
BLEND_MS = {"gallery": 560, "short-1": 560, "short-2": 560, "short-3": 560}

TAIL_WINDOW = 60
SYNC_LEAD = 6
UI_LEAD = 6  # the panel comes back this many frames before the action ends
BACK_BLEND_MS = 560

PAGE_KEYS = ["gallery"]  # the only pose; the timeline repeats it as about and skills
ALL_PAGES = ["about", "skills", "gallery"]
SHORT_KEYS = ["short-1", "short-2", "short-3"]

# The camera of every recording matches the idle one (measured: scale 1.000, no shift, on 320x144
# proxies, with scale searched from 0.94 to 1.06 and shifts of 3 px).
ALIGN = {k: (1.0, 1.0) for k in CLIPS}

NAMES = {
    "welcome": "welcome.mp4",
    "idle": "idle.mp4",
}


def a0_of(key: str) -> int:
    """First frame of the entrance (or of the short) in its recording."""
    return CLIPS[key]["head_end"] - IN_LEAD


def start_phase(key: str) -> int:
    """The idle loop frame that matches the first frame of the entrance."""
    c = CLIPS[key]
    return (a0_of(key) + c["c_head"]) % LOOP_FRAMES


def tail_phase(key: str) -> int:
    """The idle loop frame that matches the first frame of the tail window."""
    c = SHORTS_AND_PAGES[key]
    return (c["e0"] + c["c_tail"]) % LOOP_FRAMES


def pose_frame(key: str) -> int:
    """The frame of the entrance clip (counted from its first frame) where she is in the pose."""
    return CLIPS[key]["pose"] - a0_of(key)


def tail_end(key: str) -> int:
    """The last frame (exclusive) of an exit or a short in its recording."""
    return SHORTS_AND_PAGES[key]["e0"] + TAIL_WINDOW


def run(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(p.stderr)


FORCE = "--force" in sys.argv


def keep(out: Path) -> bool:
    """True when the file exists and is wanted as it is."""
    return out.exists() and out.stat().st_size > 0 and not FORCE


class Tier:
    def __init__(self, name: str):
        self.name = name
        t = TIERS[name]
        self.w, self.h = t["w"], t["h"]
        self.fps = t.get("fps", FPS)
        self.scale = f"scale={self.w}:{self.h}:flags=lanczos,setsar=1,format=yuv420p"
        self.enc = self.encoder(t["clip"])
        self.enc_loop = self.encoder(t["loop"])

    def encoder(self, crf: int) -> list[str]:
        t = TIERS[self.name]
        return [
            "-c:v", "libx264", "-preset", t["preset"], "-tune", "animation", "-crf", str(crf),
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", t["level"],
            "-g", str(self.fps), "-keyint_min", "10", "-sc_threshold", "0", "-bf", "3",
            "-x264-params", "aq-mode=3:deblock=-1,-1",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-movflags", "+faststart", "-r", str(self.fps),
            # The 4K encodes need a lot of memory (frame threads each hold frames): when the machine
            # is busy, VEXANA_THREADS=12 keeps them inside it.
            *(["-threads", os.environ["VEXANA_THREADS"]] if os.environ.get("VEXANA_THREADS") else []),
        ]

    def graph(self, graph: str) -> tuple[str, str]:
        """The filter graph ending in [v], with the frame rate of the tier applied: a tier at
        30 fps keeps every other frame of the 60 fps timeline, so its frame count is exactly half."""
        if self.fps == FPS:
            return graph, "[v]"
        return f"{graph};[v]fps={self.fps}:round=near[w]", "[w]"

    def seg(self, inp: int, a: int, b: int, tag: str) -> str:
        """Frames [a, b) of input `inp`, scaled and retimed from zero."""
        return f"[{inp}:v]trim=start_frame={a}:end_frame={b},{self.scale},setpts=N/({FPS}*TB)[{tag}]"


def build_welcome(t: Tier, src: Path, out: Path) -> None:
    if keep(out):
        return
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
        "-i", str(src / "welcome.mkv"), "-i", str(src / IDLE_SRC),
        "-filter_complex", graph,
        "-map", label, *t.enc, "-an", str(out),
    ])


def build_loop(t: Tier, source: Path, start: int, frames: int, out: Path) -> None:
    """One cycle starting at `start`; the last XFADE frames dissolve into the XFADE before it."""
    if keep(out):
        return
    end = start + frames
    parts = [
        t.seg(0, start, end - XFADE, "m"),
        t.seg(0, end - XFADE, end, "ta"),
        t.seg(0, start - XFADE, start, "tb"),
        f"[ta][tb]blend=all_expr='A*(1-(N+1)/{XFADE})+B*((N+1)/{XFADE})'[b]",
        "[m][b]concat=n=2:v=1:a=0[v]",
    ]
    graph, label = t.graph(";".join(parts))
    run(["-i", str(source), "-filter_complex", graph, "-map", label, *t.enc_loop, "-an", str(out)])


def build_cut(t: Tier, source: Path, a: int, b: int, out: Path) -> None:
    """Frames [a, b) of a recording. The videos are silent: the sound comes from the site."""
    if keep(out):
        return
    graph, label = t.graph(t.seg(0, a, b, "v"))
    run(["-i", str(source), "-filter_complex", graph, "-map", label, *t.enc, "-an", str(out)])


def build_still(src: Path, out: Path, w: int, h: int) -> None:
    if keep(out):
        return
    run([
        "-i", str(src / IDLE_SRC),
        "-vf", f"select=eq(n\\,{LOOP_START}),scale={w}:{h}:flags=lanczos,setsar=1",
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "86", str(out),
    ])


def build_tier(name: str, src: Path, out_root: Path, parts: set[str]) -> None:
    t = Tier(name)
    out = out_root / name
    out.mkdir(parents=True, exist_ok=True)
    if "base" in parts:
        build_welcome(t, src, out / "welcome.mp4")
        build_loop(t, src / IDLE_SRC, LOOP_START, LOOP_FRAMES, out / "idle.mp4")
    for key in PAGE_KEYS:
        c = CLIPS[key]
        a0 = a0_of(key)
        if "in" in parts:
            build_cut(t, src / c["file"], a0, a0 + pose_frame(key) + IN_TAIL, out / f"{key}-in.mp4")
        if "loop" in parts:
            build_loop(t, src / c["file"], c["l0"], c["p"], out / f"{key}-loop.mp4")
        if "out" in parts:
            build_cut(t, src / c["file"], c["exit"], tail_end(key), out / f"{key}-out.mp4")
    if "short" in parts:
        for key in SHORT_KEYS:
            build_cut(t, src / CLIPS[key]["file"], a0_of(key), tail_end(key), out / f"{key}.mp4")
    print(name, "done", sum(f.stat().st_size for f in out.glob("*.mp4")) // 1048576, "MB", flush=True)


def seg_info(file: str, frames: int, **extra) -> dict:
    return {"file": file, "frames": frames, **extra}


def back_timing(key: str, start: int) -> dict:
    """How a clip hands the stage back to the idle loop. `start` is its first frame in the recording."""
    e0 = SHORTS_AND_PAGES[key]["e0"]
    return {
        "syncFrame": e0 + SYNC_LEAD - start,
        "syncPhase": (tail_phase(key) + SYNC_LEAD) % LOOP_FRAMES,
        "uiFrame": max(0, CLIPS[key]["action_end"] - UI_LEAD - start),
        "blendMs": BACK_BLEND_MS,
        "align": ALIGN[key][1],
    }


def timeline_data() -> tuple[dict, dict]:
    """The page and short timings: what the stage needs to cut from one video to another."""
    one = {}
    for key in PAGE_KEYS:
        c = CLIPS[key]
        a0 = a0_of(key)
        one[key] = {
            "in": seg_info(
                f"{key}-in.mp4",
                pose_frame(key) + IN_TAIL,
                startPhases=[start_phase(key)],
                blendMs=BLEND_MS[key],
                align=ALIGN[key][0],
                handFrame=pose_frame(key),
                loopOffset=(a0 - c["l0"]) % c["p"],
            ),
            "loop": seg_info(f"{key}-loop.mp4", c["p"]),
            "out": seg_info(
                f"{key}-out.mp4",
                tail_end(key) - c["exit"],
                startPhase=(c["exit"] - c["l0"]) % c["p"],
                **back_timing(key, c["exit"]),
            ),
        }
    # The engine knows three pages. Vexana has one pose; the others are the same files.
    pages = {name: one["gallery"] for name in ALL_PAGES}
    shorts = {
        key: seg_info(
            f"{key}.mp4",
            tail_end(key) - a0_of(key),
            startPhases=[start_phase(key)],
            blendMs=BLEND_MS[key],
            align=ALIGN[key][0],
            back=back_timing(key, a0_of(key)),
        )
        for key in SHORT_KEYS
    }
    return pages, shorts


def file_names() -> list[str]:
    names = ["welcome.mp4", "idle.mp4"]
    for key in PAGE_KEYS:
        names += [f"{key}-in.mp4", f"{key}-loop.mp4", f"{key}-out.mp4"]
    names += [f"{key}.mp4" for key in SHORT_KEYS]
    return names


def timeline(out_root: Path) -> str:
    pages, shorts = timeline_data()
    names = file_names()
    sizes = {}
    for tier in TIERS:
        d = out_root / tier
        sizes[tier] = {n: (d / n).stat().st_size if (d / n).exists() else 0 for n in names}
    tiers = {k: {"width": v["w"], "fps": v.get("fps", FPS)} for k, v in TIERS.items()}
    return (
        "// Generated by scripts/vexana/stage.py. Do not edit.\n\n"
        'import type { Timeline } from "../../stage/timeline";\n\n'
        "/** The sizes the videos exist in, smallest first. `width` is the video width in pixels. */\n"
        f"export const VEXANA_STAGE_TIERS = {json.dumps(tiers, indent=2)} as const;\n"
        "export type VexanaStageTier = keyof typeof VEXANA_STAGE_TIERS;\n\n"
        "/** Size in bytes of every file in every tier, for the loading bar. */\n"
        f"export const VEXANA_STAGE_BYTES: Record<VexanaStageTier, Record<string, number>> = {json.dumps(sizes, indent=2)};\n\n"
        "/**\n"
        " * The only page is the zoom pose (`gallery`, files gallery-in/loop/out.mp4). `about` and\n"
        " * `skills` are copies of it, the engine needs all three names, and are never asked for.\n"
        " * short-1 is face, short-2 is left-hand and short-3 is big-thing.\n"
        " */\n"
        "export const VEXANA_STAGE_TIMELINE = {\n"
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
    src = Path(args[0]) if args else Path("C:/Users/muham/Videos/vexana")
    root = Path(__file__).resolve().parents[2]
    web = root / "apps" / "web"
    out_root = web / "public" / "video" / "vexana-stage"
    out_root.mkdir(parents=True, exist_ok=True)

    parts = {"base", "in", "loop", "out", "short"}
    if "--parts" in argv:
        parts = set(argv[argv.index("--parts") + 1].split(","))
    if "--timeline-only" not in flags:
        for name in [only] if only else list(TIERS):
            build_tier(name, src, out_root, parts)
        build_still(src, out_root / "still.webp", 2560, 1152)

    dest = web / "src" / "features" / "character" / "vexana" / "room" / "timeline.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(timeline(out_root), encoding="utf-8")
    print("wrote", dest)


if __name__ == "__main__":
    main()
