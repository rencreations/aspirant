"""
Builds the Obsidia stage videos in four sizes.

Source: C:/Users/muham/Videos/obsidia/*.mkv (3840x1728, 60 fps, recorded from the Live2D viewer).
Output: apps/web/public/video/obsidia/<tier>/*.mp4, a still, the trailer renditions and
        src/features/character/obsidia/timeline.generated.ts

Tiers (all H.264, so every browser plays them; the page picks one for the visitor's display):
  lite  1280x576   30 fps, for devices that decode in software
  1080  1920x864   phones, tablets, small screens
  1440  2560x1152  full HD and QHD screens
  2160  3840x1728  the source size, for 4K and retina screens

Frame numbers are at 60 fps and were found with scripts/obsidia/proxy.py (grey 320x144 proxies of
the recordings) by comparing windows of frames (mean squared error), then checked by eye.

  welcome  Frames 226 to 1176 of welcome.mkv. The recording opens on the game's hero-select UI;
           the animation starts with a hard cut between 225 and 226. At 1166 she has settled
           into the idle pose, and the UI starts to fade in at the left edge from about 1182. At
           1176 the picture matches idle frame 672. The last 6 frames dissolve into idle frames
           667..672 and 3 idle frames follow (EXTRA), so the hand-over to the loop can start a
           few frames early.
  idle     The idle animation repeats every 482 frames (8.03 s). The loop is idle frames
           673..1154, the frames after the welcome cut. The last 20 frames dissolve into the 20
           before the start, so the wrap is hidden (the debris in the background drifts and never
           repeats).
  pages    About (vertical.mkv), Skills (horizontal.mkv) and Gallery (zoom.mkv) are three more
           poses. Each recording is cut in three:
             in    36 frames before the action to the frame where she is in the page's pose
                   (`handFrame`), and 24 frames more
             loop  one cycle of the page's own animation (182 frames for About and Skills, 180 for
                   Gallery), dissolved at the seam like the idle loop
             out   from a few frames before the last frame that still matches the loop to the end
                   of the stretch where she is back in her idle pose. `startPhase` is the loop
                   frame it starts at.
           `startPhases` is the idle loop frame an `in` can start at. The idle animation does not
           repeat inside its cycle, so there is one (the wait for it is at most one loop).
  shorts   short-1 .. short-3 start in the idle pose, play, and end in it.

Run: python -I scripts/obsidia/build.py "C:/Users/muham/Videos/obsidia" "C:/Users/muham/Downloads/obthumb.jpg" "C:/Users/muham/Videos/obsidia.mkv"
     Add --tier 1080 to build one tier, --parts base,in to build some of the parts, and
     --timeline-only to write the TypeScript only.
"""

import json
import subprocess
import sys
from pathlib import Path

FPS = 60
LOOP_START = 673  # idle frame the idle loop starts at
LOOP_FRAMES = 482
XFADE = 20  # frames dissolved at a loop seam
EXTRA = 3  # frames after a cut, skipped by the hand-over
WELCOME_START, WELCOME_END, WELCOME_BLEND = 226, 1176, 6

# `loop` is the CRF of the idle loop and the page loops, which are on screen almost all the time
# and are looked at, so they get the most bits. `clip` is the CRF of everything that is on screen
# for a moment while it moves (the welcome, the entrances, the exits and the shorts). `level` is the
# H.264 level the size needs at 60 fps (it also keeps the encoder inside what a hardware decoder
# accepts).
TIERS = {
    # For devices that decode video in software, or slow ones: half the frame rate (the loops and
    # seams are measured in time, so they work at 30 fps) and a third of the pixels.
    # The quality is as high as the budget allows: x264 CRF 17 at 2560 wide and 20 at 3840 wide are
    # visually lossless on this art (the recordings are 75 Mbit/s H.264 themselves). `loop` is the
    # idle and page loops, which are on screen most of the time, `clip` the rest.
    "lite": dict(w=1280, h=576, loop=23, clip=25, level="3.1", preset="slow", fps=30),
    "1080": dict(w=1920, h=864, loop=19, clip=20, level="4.2", preset="slow"),
    "1440": dict(w=2560, h=1152, loop=17, clip=18, level="5.1", preset="slow"),
    "2160": dict(w=3840, h=1728, loop=20, clip=21, level="5.2", preset="slow"),
}

# What was measured in each recording.
#   file       the recording
#   head_end   the first frame of the action: before it she is in her idle pose, and the picture
#              matches the idle loop frame for frame (idle phase = (frame + c_head) mod 482)
#   c_head     see above
#   action_end the first frame where she is back in the idle pose (the tail of the recording)
#   c_tail     idle phase = (frame + c_tail) mod 482 in that tail
#   pose       pages: the frame where she is in the page's pose (the entrance is the page loop
#              from here on, frame for frame)
#   l0, p      pages: the page loop is frames l0 .. l0 + p of the recording (p is its period)
#   exit       pages: the frame the exit starts at, a few frames before it leaves the loop
CLIPS = {
    "about": dict(file="vertical.mkv", head_end=557, c_head=136, action_end=2213, c_tail=185,
                  pose=717, l0=1023, p=182, exit=2004),
    "skills": dict(file="horizontal.mkv", head_end=659, c_head=123, action_end=2308, c_tail=91,
                   pose=859, l0=1084, p=182, exit=2086),
    "gallery": dict(file="zoom.mkv", head_end=631, c_head=78, action_end=2287, c_tail=112,
                    pose=797, l0=830, p=180, exit=1953),
    "short-1": dict(file="short-1.mkv", head_end=529, c_head=156, action_end=1048, c_tail=390),
    "short-2": dict(file="short-2.mkv", head_end=697, c_head=373, action_end=1284, c_tail=153),
    "short-3": dict(file="short-3.mkv", head_end=520, c_head=436, action_end=982, c_tail=457),
}
SHORTS_AND_PAGES = {k: dict(v, e0=v["action_end"] + 16) for k, v in CLIPS.items()}

IN_LEAD = 36  # frames of idle pose before the action, in an entrance or a short
IN_TAIL = 24  # frames kept after the pose frame, so the dissolve into the loop has a picture to dissolve from
BLEND_MS = {"about": 560, "skills": 560, "gallery": 560, "short-1": 560, "short-2": 560, "short-3": 560}

TAIL_WINDOW = 60
SYNC_LEAD = 6
UI_LEAD = 6  # the panel comes back this many frames before the action ends
BACK_BLEND_MS = 560

PAGE_KEYS = ["about", "skills", "gallery"]
SHORT_KEYS = ["short-1", "short-2", "short-3"]

# Some recordings were made with the camera closer than the idle one (scripts/obsidia/align.py
# measures it). Scale of the clip that matches the idle picture, at its start and at its sync
# frame. The stage eases the idle picture by the inverse during the dissolve so the edges do not
# jump.
# key -> (at the start, at the end)
ALIGN = {
    "about": (1.0, 1.0),
    "skills": (1.0, 1.0),
    "gallery": (1.0, 1.0),
    "short-1": (1.0, 1.0),
    "short-2": (1.0, 1.0),
    "short-3": (1.006, 1.006),
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
    run(["-i", str(source), "-filter_complex", graph, "-map", label, *t.enc_loop, "-an", str(out)])


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
    "1080": (1080, 23, 5000),
    "720": (720, 24, 2800),
    "480": (480, 25, 1200),
}


def build_trailer(video: Path, out_dir: Path) -> None:
    """The trailer in three sizes for the player's quality menu. It plays beside the 60 fps
    stage, so it is 60 fps too (the source is 30: every frame is shown twice, which costs
    almost nothing, and the page is not drawn at half rate while it plays)."""
    for name, (h, crf, kbps) in TRAILER.items():
        run([
            "-i", str(video), "-vf", f"fps=60,scale=-2:{h}:flags=lanczos,setsar=1,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-maxrate", f"{kbps}k",
            "-bufsize", f"{kbps * 2}k", "-profile:v", "high", "-g", "60", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "128k", str(out_dir / f"trailer-{name}.mp4"),
        ])


def build_tier(name: str, src: Path, out_root: Path, parts: set[str]) -> None:
    t = Tier(name)
    out = out_root / name
    out.mkdir(parents=True, exist_ok=True)
    if "base" in parts:
        build_welcome(t, src, out / "welcome.mp4")
        build_loop(t, src / "idle.mkv", LOOP_START, LOOP_FRAMES, out / "idle.mp4")
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
    pages = {}
    for key in PAGE_KEYS:
        c = CLIPS[key]
        a0 = a0_of(key)
        pages[key] = {
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


def timeline(out_root: Path) -> str:
    pages, shorts = timeline_data()
    names = ["welcome.mp4", "idle.mp4"]
    for key in PAGE_KEYS:
        names += [f"{key}-in.mp4", f"{key}-loop.mp4", f"{key}-out.mp4"]
    names += [f"{key}.mp4" for key in SHORT_KEYS]
    sizes = {}
    for tier in TIERS:
        d = out_root / tier
        sizes[tier] = {n: (d / n).stat().st_size if (d / n).exists() else 0 for n in names}
    tiers = {k: {"width": v["w"], "fps": v.get("fps", FPS)} for k, v in TIERS.items()}
    return (
        "// Generated by scripts/obsidia/build.py. Do not edit.\n\n"
        'import type { Timeline } from "../stage/timeline";\n\n'
        "/** The sizes the videos exist in, smallest first. `width` is the video width in pixels. */\n"
        f"export const OBSIDIA_TIERS = {json.dumps(tiers, indent=2)} as const;\n"
        "export type ObsidiaTier = keyof typeof OBSIDIA_TIERS;\n\n"
        "/** Size in bytes of every file in every tier, for the loading bar. */\n"
        f"export const OBSIDIA_BYTES: Record<ObsidiaTier, Record<string, number>> = {json.dumps(sizes, indent=2)};\n\n"
        "export const OBSIDIA_TIMELINE = {\n"
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
    out_root = web / "public" / "video" / "obsidia"
    out_root.mkdir(parents=True, exist_ok=True)

    parts = {"base", "in", "loop", "out", "short"}
    if "--parts" in argv:
        parts = set(argv[argv.index("--parts") + 1].split(","))
    if "--timeline-only" not in flags:
        for name in [only] if only else list(TIERS):
            build_tier(name, src, out_root, parts)
        build_still(src, out_root / "still.webp", 2560, 1152)
        if len(args) > 1:
            build_poster(Path(args[1]), out_root / "trailer-poster.webp")
        if len(args) > 2:
            build_trailer(Path(args[2]), out_root)

    dest = web / "src" / "features" / "character" / "obsidia" / "timeline.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(timeline(out_root), encoding="utf-8")
    print("wrote", dest)


if __name__ == "__main__":
    main()
