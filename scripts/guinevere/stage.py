"""
Builds the videos of Guinevere's interactive room (the bottom of her page) in three sizes.

Source: C:/Users/muham/Videos/guinevere/*.mkv (3840x1728, 60 fps, recorded from the game's hero
        showcase: welcome, idle, face, foot, stomach, zoom). The AAC audio is dropped.
Output: apps/web/public/video/guinevere-stage/<tier>/*.mp4, a still, and
        src/features/character/guinevere/room/timeline.generated.ts (the stage engine's timeline).

The room runs on the same engine as Vexana's room, Selena's and Obsidia's pages
(features/character/stage/), so this script follows scripts/vexana/stage.py: same kinds of clips,
same timeline. The differences: Guinevere has a real idle recording, and only three sizes are made
(the repository is already larger than GitHub advises, so the 4K size is left out: a 4K screen
gets the 2560 picture, which `pickTier` in stage/media.ts falls back to when no larger size exists).

Tiers (all H.264, so every browser plays them; the page picks one for the visitor's display):
  lite  1280x576   30 fps, for devices that decode in software
  1080  1920x864   phones, tablets, small screens
  1440  2560x1152  full HD, QHD and 4K screens (the largest size)

Frame numbers are at 60 fps and were found with scripts/guinevere/stage-proxy.py (grey 320x144
proxies of the recordings: frames were compared by mean squared error, then checked by eye).

  idle     idle.mkv (30 s) holds three cycles of the game's hero showcase idle: a breathing sway of
           her, the cloth, the drones and the camera. The cycle is 610 frames (10.17 s): the mean
           squared error between a frame and the frame 610 later is 3.6, against 1.6 between
           neighbouring frames and 26 or more at any other lag. The loop is idle.mkv frames 141 to
           750 (LOOP_START, LOOP_FRAMES): the last XFADE frames dissolve into the XFADE before the
           start (seam error 3.5). LOOP_START is the frame after the one the welcome ends on.
  welcome  Frames 69 to 1018 of welcome.mkv. The recording opens on the game's hero-select screen
           (another skin); the animation starts with a hard cut between 68 and 69 (1.1 s). By 1016
           she has settled, and at 1019 the game's top bar pops in (checked at full size), so the
           cut stops at 1018, which matches idle frame 140 (error 5.7). The last 6 frames dissolve
           into idle frames 135 to 140 and 3 idle frames follow (EXTRA).
  pages    Only one: the zoom pose ("Change pose", zoom.mkv). The engine knows three page names, so
           it is `gallery`; `about` and `skills` in the timeline are copies of it (the same files)
           and are never asked for. The recording is cut in three:
             in    36 frames before the action to the frame where she is in the pose (`pose`, 955:
                   from there on the picture repeats every 600 frames), and 24 frames more
             loop  one cycle of the pose's own animation (600 frames, 10 s), dissolved at the seam
             out   from a few frames before the loop ends (2452) to the end of the stretch where she
                   is back in her idle pose (2701)
  shorts   short-1 = face.mkv, short-2 = foot.mkv, short-3 = stomach.mkv. Each starts in the idle
           pose, plays, and ends in it.

Run: python -I scripts/guinevere/stage.py "C:/Users/muham/Videos/guinevere"
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
IDLE_SRC = "idle.mkv"
LOOP_START = 141  # frame of IDLE_SRC the idle loop starts at (the frame after the welcome's last)
LOOP_FRAMES = 610
XFADE = 20  # frames dissolved at a loop seam
EXTRA = 3  # frames after a cut, skipped by the hand-over
WELCOME_START, WELCOME_END, WELCOME_BLEND = 69, 1018, 6

# `loop` is the CRF of the idle and page loops, which are on screen most of the time and are
# looked at, so they get the most bits. `clip` is the CRF of everything that is on screen for a
# moment while it moves. The numbers are Vexana's, raised a little where the size budget asked for
# it (all three sizes together stay under about 300 MB).
TIERS = {
    "lite": dict(w=1280, h=576, loop=24, clip=27, level="3.1", preset="slow", fps=30),
    "1080": dict(w=1920, h=864, loop=21, clip=23, level="4.2", preset="slow"),
    "1440": dict(w=2560, h=1152, loop=18, clip=20, level="5.1", preset="slow"),
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
    "gallery": dict(file="zoom.mkv", head_end=616, c_head=552, action_end=2701, c_tail=588,
                    pose=955, l0=1100, p=600, exit=2448),
    "short-1": dict(file="face.mkv", head_end=447, c_head=153, action_end=865, c_tail=227),
    "short-2": dict(file="foot.mkv", head_end=430, c_head=456, action_end=975, c_tail=480),
    "short-3": dict(file="stomach.mkv", head_end=427, c_head=294, action_end=841, c_tail=370),
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

# The camera of every recording matches the idle one (measured: no shift of up to 3 px on the
# 320x144 proxies improves the match).
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
            # is busy, GUINEVERE_THREADS=12 keeps them inside it.
            *(["-threads", os.environ["GUINEVERE_THREADS"]] if os.environ.get("GUINEVERE_THREADS") else []),
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
    # The engine knows three pages. Guinevere has one pose; the others are the same files.
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
        "// Generated by scripts/guinevere/stage.py. Do not edit.\n\n"
        'import type { Timeline } from "../../stage/timeline";\n\n'
        "/*\n"
        " * Where she is in the picture, as fractions of the 3840x1728 frame (measured on idle frame\n"
        " * 141; she sways by about a percent):\n"
        " *   her middle line  x 0.50\n"
        " *   face             (0.503, 0.191)   short-1\n"
        " *   stomach          (0.497, 0.330)   short-3 (the belt, below the ribbon)\n"
        " *   feet             (0.501, 0.770)   short-2\n"
        " * The pose button is a plate at the left side of the screen: it needs no position.\n"
        " * The room has no 2160 size: `pickTier` falls back to 1440 on a 4K screen.\n"
        " */\n\n"
        "/** The sizes the videos exist in, smallest first. `width` is the video width in pixels. */\n"
        f"export const GUINEVERE_STAGE_TIERS = {json.dumps(tiers, indent=2)} as const;\n"
        "export type GuinevereStageTier = keyof typeof GUINEVERE_STAGE_TIERS;\n\n"
        "/** Size in bytes of every file in every tier, for the loading bar. */\n"
        f"export const GUINEVERE_STAGE_BYTES: Record<GuinevereStageTier, Record<string, number>> = {json.dumps(sizes, indent=2)};\n\n"
        "/**\n"
        " * The only page is the zoom pose (`gallery`, files gallery-in/loop/out.mp4). `about` and\n"
        " * `skills` are copies of it, the engine needs all three names, and are never asked for.\n"
        " * short-1 is face, short-2 is foot and short-3 is stomach.\n"
        " */\n"
        "export const GUINEVERE_STAGE_TIMELINE = {\n"
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
    src = Path(args[0]) if args else Path("C:/Users/muham/Videos/guinevere")
    root = Path(__file__).resolve().parents[2]
    web = root / "apps" / "web"
    out_root = web / "public" / "video" / "guinevere-stage"
    out_root.mkdir(parents=True, exist_ok=True)

    parts = {"base", "in", "loop", "out", "short"}
    if "--parts" in argv:
        parts = set(argv[argv.index("--parts") + 1].split(","))
    if "--timeline-only" not in flags:
        for name in [only] if only else list(TIERS):
            build_tier(name, src, out_root, parts)
        build_still(src, out_root / "still.webp", 2560, 1152)

    dest = web / "src" / "features" / "character" / "guinevere" / "room" / "timeline.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(timeline(out_root), encoding="utf-8")
    print("wrote", dest)


if __name__ == "__main__":
    main()
