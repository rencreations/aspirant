"""
Builds the stage videos of one character of the Animation room, for the six aspirants that have no
stage of their own: Layla, Fanny, Ruby, Angela, Lesley and Chang'e (slug `change`).

Source: D:/ren/aspirant/media/_others/in-game-animation/<slug>/*.mkv (3840x1728, 60 fps, the game's
        hero showcase: welcome, idle, zoom and the body part clips). The AAC audio is dropped.
Output: the library mirror, key `animation/<slug>/<tier>/<name>.mp4` (tiers 1080 and 1440), a still
        `animation/<slug>/still.webp`, a poster set `animation/<slug>/poster/{t,p,f}.webp`, and the
        stage engine's timeline in
        apps/web/src/features/library/animation/stage-data/<slug>.generated.ts.

It is scripts/guinevere/stage.py made general. That script has frame numbers measured by hand;
`analyze.py` measures the same things on grey 320x144 proxies (and reproduces Guinevere's numbers to
within a few frames). Read analyze.py for what is found. Here:

  idle     `cycles` cycles of the idle recording from `loop_start`, the last XFADE frames dissolved
           into the XFADE before the start. A cycle of 2 s would loop every 2 s, so the loop is made
           of enough cycles to be at least 5 s, and every start phase is listed once per cycle.
  welcome  the animation after the hard cut from the hero-select screen, up to the frame before the
           game's top bar pops in; the last `blend` frames dissolve into the idle frames before
           `loop_start` and EXTRA idle frames follow.
  gallery  the pose change (zoom.mkv): `in` is IN_LEAD frames before the action to IN_TAIL frames
           after she is in the pose, `loop` is one or more cycles of the pose's own animation,
           `out` runs from a few frames before the repeat ends to a stretch after she is back in her
           idle pose. `about` and `skills` in the timeline are the same files, as in Guinevere's.
  shorts   the body part clips; each starts in the idle pose, plays and ends in it.

Run:  C:/Users/muham/anaconda3/python.exe scripts/library/animation/stage.py <slug> [options]
  --analyze        measure again (otherwise the saved analysis.json is used)
  --force          encode files that exist
  --timeline-only  write only the TypeScript
  --tiers 1080     build one tier
  --no-verify      skip the checks of the encoded files
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import analyze  # noqa: E402
import proxy  # noqa: E402

FPS = 60
XFADE = analyze.XFADE
IN_LEAD = analyze.IN_LEAD
IN_TAIL = 24  # frames kept after the pose frame, so the dissolve into the loop has a picture
EXTRA = 3  # idle frames after the welcome, skipped by the hand-over
MAX_WAIT = 24  # most frames the visitor waits for the idle loop to reach a frame
TAIL_WINDOW = 60
SYNC_LEAD = 6
UI_LEAD = 6
TAIL_GAP = 16  # frames after the action ends before the hand-over frame
BLEND_MS = 560
BACK_BLEND_MS = 560
ALL_PAGES = ["about", "skills", "gallery"]

# The H.264 settings of Guinevere's room. `loop` is the CRF of the loops (on screen most of the
# time), `clip` of everything that plays for a moment.
TIERS = {
    "1080": dict(w=1920, h=864, loop=21, clip=23, level="4.2"),
    "1440": dict(w=2560, h=1152, loop=18, clip=20, level="5.1"),
}

# short-1, short-2, short-3 -> the body part recording (the Animation room's buttons, see index.py).
# Chang'e has two body part clips: her third short is the same file as the second.
CHARACTERS: dict[str, dict] = {
    "layla": dict(name="Layla", shorts=["face", "foot", "hand"]),
    "fanny": dict(name="Fanny", shorts=["blade", "face", "stomach"]),
    "ruby": dict(name="Ruby", shorts=["face", "hand", "scythe"]),
    # Angela's welcome has a skin carousel on the hero-select screen before the animation, and
    # the first cut found is not the one to the animation (checked by eye: frame 121).
    "angela": dict(name="Angela", shorts=["chest", "tetra", "hand"], overrides={"welcome": {"start": 121}}),
    "lesley": dict(name="Lesley", shorts=["head", "gun", "foot"]),
    "change": dict(name="Chang'e", shorts=["body", "moon", "moon"]),
}


# ---------------------------------------------------------------------------------------------
# The plan: every frame number of every file
# ---------------------------------------------------------------------------------------------


class Plan:
    """What is cut from where, and the timeline numbers that follow from it."""

    def __init__(self, slug: str, a: dict):
        self.slug = slug
        self.a = a
        self.p = a["period"]["p"]
        idle = a["idle"]
        self.ls = idle["loop_start"]
        self.loop = idle["loop_frames"]
        self.cycles = idle["cycles"]
        w = a["welcome"]
        self.w_start, self.w_end, self.w_blend = w["start"], w["end"], w["blend"]
        self.clips = a["clips"]
        self.short_names = CHARACTERS[slug]["shorts"]

    # idle phase of the first frame of a clip (phase = (frame + c) mod p, phase 0 is loop_start)
    def a0(self, clip: str) -> int:
        return max(0, self.clips[clip]["head_end"] - IN_LEAD)

    def start_phases(self, clip: str) -> list[int]:
        base = (self.a0(clip) + self.clips[clip]["c_head"]) % self.p
        return [base + j * self.p for j in range(self.cycles)]

    def e0(self, clip: str) -> int:
        return self.clips[clip]["action_end"] + TAIL_GAP

    def tail_end(self, clip: str) -> int:
        return self.e0(clip) + TAIL_WINDOW

    def tail_phase(self, clip: str) -> int:
        return (self.e0(clip) + self.clips[clip]["c_tail"]) % self.p

    def back(self, clip: str, start: int) -> dict:
        c = self.clips[clip]
        return {
            "syncFrame": self.e0(clip) + SYNC_LEAD - start,
            "syncPhase": (self.tail_phase(clip) + SYNC_LEAD) % self.p,
            "uiFrame": max(0, c["action_end"] - UI_LEAD - start),
            "blendMs": BACK_BLEND_MS,
            "align": 1.0,
        }

    # -- files -------------------------------------------------------------------------------

    def files(self) -> list[str]:
        names = ["welcome.mp4", "idle.mp4", "gallery-in.mp4", "gallery-loop.mp4", "gallery-out.mp4"]
        names += [f"short-{i + 1}.mp4" for i in range(len(self.unique_shorts()))]
        return names

    def unique_shorts(self) -> list[str]:
        return list(dict.fromkeys(self.short_names))

    def short_file(self, i: int) -> str:
        """The file of short-(i+1): a repeated clip points at the file of its first copy."""
        return f"short-{self.unique_shorts().index(self.short_names[i]) + 1}.mp4"

    # -- timeline ----------------------------------------------------------------------------

    def page(self) -> dict:
        z = self.clips["zoom"]
        cut = z["cut"]
        a0 = self.a0("zoom")
        pose_frame = cut["pose"] - a0
        loop_n = cut["loop_frames"]
        out_frames = self.tail_end("zoom") - cut["exit"]
        return {
            "in": {
                "file": "gallery-in.mp4",
                "frames": pose_frame + IN_TAIL,
                "startPhases": self.start_phases("zoom"),
                "maxWait": MAX_WAIT,
                "blendMs": BLEND_MS,
                "align": 1.0,
                "handFrame": pose_frame,
                "loopOffset": (a0 - cut["l0"]) % loop_n,
            },
            "loop": {"file": "gallery-loop.mp4", "frames": loop_n},
            "out": {
                "file": "gallery-out.mp4",
                "frames": out_frames,
                "startPhase": (cut["exit"] - cut["l0"]) % loop_n,
                "maxWait": MAX_WAIT,
                **self.back("zoom", cut["exit"]),
            },
        }

    def short(self, i: int) -> dict:
        clip = self.short_names[i]
        a0 = self.a0(clip)
        return {
            "file": self.short_file(i),
            "frames": self.tail_end(clip) - a0,
            "startPhases": self.start_phases(clip),
            "maxWait": MAX_WAIT,
            "blendMs": BLEND_MS,
            "align": 1.0,
            "back": self.back(clip, a0),
        }

    def timeline(self) -> dict:
        page = self.page()
        return {
            "fps": FPS,
            "loopFrames": self.loop,
            "extraFrames": EXTRA,
            "pages": {name: page for name in ALL_PAGES},
            "shorts": {f"short-{i + 1}": self.short(i) for i in range(3)},
        }

    def check(self) -> list[str]:
        """Things that would break a cut."""
        bad = []
        for name, c in self.clips.items():
            n = c["frames"]
            if c["head_end"] < 12:
                bad.append(f"{name}: the action starts at {c['head_end']}, with no idle before it")
            if c["action_end"] <= c["head_end"]:
                bad.append(f"{name}: no idle pose at the end (action_end {c['action_end']})")
            if self.tail_end(name) > n:
                bad.append(f"{name}: tail ends at {self.tail_end(name)}, past the {n} frames")
            if c["head_mode"] == "self" or c["tail_mode"] == "self":
                bad.append(
                    f"{name}: starts in {c['head_mode']} mode (mse {c['head_err']}), ends in {c['tail_mode']} mode "
                    f"(mse {c['tail_err']}): another state of the idle, the dissolve shows a small difference"
                )
        z = self.clips["zoom"]
        if "cut" not in z:
            bad.append("zoom: no pose loop found")
        return bad


# ---------------------------------------------------------------------------------------------
# ffmpeg
# ---------------------------------------------------------------------------------------------


class Graph:
    """A filter graph over several seeked inputs and several tiers. Every input is decoded once and
    split to everything that uses it (one decode of the 4K source feeds both sizes)."""

    def __init__(self, tiers: list[str]):
        self.tiers = tiers
        self.uses: dict[int, list[str]] = {}
        self.parts: list[str] = []

    def take(self, i: int) -> str:
        labels = self.uses.setdefault(i, [])
        labels.append(f"u{i}_{len(labels)}")
        return f"[{labels[-1]}]"

    def seg(self, i: int, a: int, b: int, tag: str, tier: str) -> None:
        t = TIERS[tier]
        self.parts.append(
            f"{self.take(i)}trim=start_frame={a}:end_frame={b},"
            f"scale={t['w']}:{t['h']}:flags=lanczos,setsar=1,format=yuv420p,"
            f"setpts=N/({FPS}*TB)[{tag}_{tier}]"
        )

    def text(self) -> str:
        heads = []
        for i, labels in self.uses.items():
            if len(labels) == 1:
                heads.append(f"[{i}:v]null[{labels[0]}]")
            else:
                heads.append(f"[{i}:v]split={len(labels)}" + "".join(f"[{x}]" for x in labels))
        return ";".join(heads + self.parts)


def blend(n: int) -> str:
    return f"blend=all_expr='A*(1-(N+1)/{n})+B*((N+1)/{n})'"


class Job:
    """One output file in every tier: seeked inputs (path, first frame) and a graph builder."""

    def __init__(self, name: str, loop: bool):
        self.name = name
        self.loop = loop  # the loops get the lower CRF
        self.inputs: list[tuple[Path, int]] = []
        self.graph_of = None

    def build(self, tiers: list[str], root: Path, force: bool) -> None:
        todo = [t for t in tiers if force or not fresh(root / t / self.name)]
        if not todo:
            return
        g = Graph(todo)
        for t in todo:
            self.graph_of(g, t)
        cmd = ["ffmpeg", "-v", "error", "-y", "-nostats"]
        for path, first in self.inputs:
            if first > 0:
                cmd += ["-ss", f"{(first - 0.5) / FPS:.6f}"]
            cmd += ["-i", str(path)]
        cmd += ["-filter_complex", g.text()]
        parts = {}
        for t in todo:
            cfg = TIERS[t]
            crf = cfg["loop"] if self.loop else cfg["clip"]
            out = root / t / (self.name + ".part")
            out.parent.mkdir(parents=True, exist_ok=True)
            parts[t] = out
            cmd += [
                "-map", f"[v_{t}]", "-an",
                "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", str(crf),
                "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", cfg["level"],
                "-g", str(FPS), "-keyint_min", "10", "-sc_threshold", "0", "-bf", "3",
                "-x264-params", "aq-mode=3:deblock=-1,-1",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                "-movflags", "+faststart", "-r", str(FPS), "-f", "mp4", str(out),
            ]
        p = subprocess.run(cmd, capture_output=True, text=True)
        if p.returncode:
            for out in parts.values():
                out.unlink(missing_ok=True)
            raise SystemExit(f"{self.name}: {p.stderr[-2000:]}")
        for t, out in parts.items():
            os.replace(out, root / t / self.name)


def fresh(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 0


def jobs_of(plan: Plan) -> list[Job]:
    src = proxy.SRC / plan.slug
    ls, loop, wb = plan.ls, plan.loop, plan.w_blend
    jobs: list[Job] = []

    # idle: frames [ls, ls + loop) with the last XFADE dissolved into the XFADE before the start.
    # The input starts XFADE before ls: tb = [0, X), m = [X, loop), ta = [loop, loop + X).
    def loop_job(name: str, path: Path, start: int, frames: int) -> Job:
        j = Job(name, loop=True)
        j.inputs = [(path, start - XFADE)]

        def graph(g: Graph, t: str) -> None:
            g.seg(0, XFADE, frames, "m", t)
            g.seg(0, frames, frames + XFADE, "ta", t)
            g.seg(0, 0, XFADE, "tb", t)
            g.parts.append(f"[ta_{t}][tb_{t}]{blend(XFADE)}[b_{t}]")
            g.parts.append(f"[m_{t}][b_{t}]concat=n=2:v=1:a=0[v_{t}]")

        j.graph_of = graph
        return j

    def cut_job(name: str, path: Path, a: int, b: int) -> Job:
        j = Job(name, loop=False)
        j.inputs = [(path, a)]

        def graph(g: Graph, t: str) -> None:
            g.seg(0, 0, b - a, "c", t)
            g.parts.append(f"[c_{t}]null[v_{t}]")

        j.graph_of = graph
        return j

    # welcome: the animation, its last `wb` frames dissolved into the idle frames before ls, then
    # EXTRA idle frames.
    w = Job("welcome.mp4", loop=False)
    n_plain = plan.w_end + 1 - wb - plan.w_start
    w.inputs = [(src / "welcome.mkv", plan.w_start), (src / "idle.mkv", ls - wb)]

    def welcome_graph(g: Graph, t: str) -> None:
        g.seg(0, 0, n_plain, "m", t)
        g.seg(0, n_plain, n_plain + wb, "wt", t)
        g.seg(1, 0, wb, "it", t)
        g.seg(1, wb, wb + EXTRA, "x", t)
        g.parts.append(f"[wt_{t}][it_{t}]{blend(wb)}[b_{t}]")
        g.parts.append(f"[m_{t}][b_{t}][x_{t}]concat=n=3:v=1:a=0[v_{t}]")

    w.graph_of = welcome_graph
    jobs.append(w)
    jobs.append(loop_job("idle.mp4", src / "idle.mkv", ls, loop))

    z = plan.clips["zoom"]
    cut = z["cut"]
    a0 = plan.a0("zoom")
    jobs.append(cut_job("gallery-in.mp4", src / "zoom.mkv", a0, cut["pose"] + IN_TAIL))
    jobs.append(loop_job("gallery-loop.mp4", src / "zoom.mkv", cut["l0"], cut["loop_frames"]))
    jobs.append(cut_job("gallery-out.mp4", src / "zoom.mkv", cut["exit"], plan.tail_end("zoom")))
    for i, clip in enumerate(plan.unique_shorts()):
        jobs.append(cut_job(f"short-{i + 1}.mp4", src / f"{clip}.mkv", plan.a0(clip), plan.tail_end(clip)))
    return jobs


# ---------------------------------------------------------------------------------------------
# The still and the poster
# ---------------------------------------------------------------------------------------------


def make_still(plan: Plan, force: bool) -> dict:
    out = common.key_path(f"animation/{plan.slug}/still.webp")
    png = common.WORK / "animation" / plan.slug / "still.png"
    png.parent.mkdir(parents=True, exist_ok=True)
    if force or not fresh(out) or not fresh(png):
        ss = f"{(plan.ls - 0.5) / FPS:.6f}"
        p = subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", ss, "-i", str(proxy.SRC / plan.slug / "idle.mkv"),
             "-frames:v", "1", str(png)],
            capture_output=True, text=True,
        )
        if p.returncode:
            raise SystemExit(p.stderr)
        from PIL import Image  # noqa: PLC0415

        with Image.open(png) as im:
            im.convert("RGB").resize((2560, 1152), Image.LANCZOS).save(out, "WEBP", quality=86, method=5)
    return common.image_set(png, f"animation/{plan.slug}/poster", full_max=2560, force=force)


# ---------------------------------------------------------------------------------------------
# The timeline file
# ---------------------------------------------------------------------------------------------


def sizes(slug: str, plan: Plan, tiers: list[str]) -> dict:
    out = {}
    for t in tiers:
        d = common.LIB_ROOT / "animation" / slug / t
        out[t] = {n: (d / n).stat().st_size if (d / n).exists() else 0 for n in plan.files()}
    return out


def write_timeline(slug: str, plan: Plan, tiers: list[str]) -> Path:
    key = slug.upper()
    name = CHARACTERS[slug]["name"]
    tl = plan.timeline()
    tier_info = {t: {"width": TIERS[t]["w"], "fps": FPS} for t in tiers}
    note = ""
    if len(plan.unique_shorts()) < 3:
        note = (
            f" * {name} has {len(plan.unique_shorts())} body part clips: short-3 plays the file of "
            f"{plan.short_file(2)}\n * (the same file as short-{plan.unique_shorts().index(plan.short_names[2]) + 1}), "
            "so no third file exists.\n"
        )
    text = (
        "// Generated by scripts/library/animation/stage.py. Do not edit.\n\n"
        'import type { Timeline } from "@/features/character/stage/timeline";\n\n'
        "/*\n"
        f" * {name}'s stage for the Animation room. The videos are in the library mirror under\n"
        f" * `animation/{slug}/<size>/<file>`. The only pose is the zoom pose (`gallery`); `about` and\n"
        " * `skills` are the same files and are never asked for. short-1 to short-3 are\n"
        f" * {', '.join(plan.short_names)}.\n"
        f"{note}"
        f" * The idle loop is {plan.cycles} cycle(s) of {plan.p} frames.\n"
        " */\n\n"
        "/** The sizes the videos exist in, smallest first. `width` is the video width in pixels. */\n"
        f"export const {key}_STAGE_TIERS = {json.dumps(tier_info, indent=2)} as const;\n\n"
        "/** Size in bytes of every file in every size, for the loading bar. */\n"
        f"export const {key}_STAGE_BYTES: Record<string, Record<string, number>> = "
        f"{json.dumps(sizes(slug, plan, tiers), indent=2)};\n\n"
        f"export const {key}_STAGE_TIMELINE = {json.dumps(tl, indent=2)} as const satisfies Timeline;\n"
    )
    dest = common.REPO / "apps" / "web" / "src" / "features" / "library" / "animation" / "stage-data" / f"{slug}.generated.ts"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8", newline="\n")
    prettier = common.REPO / "node_modules" / ".bin" / "prettier.CMD"
    subprocess.run([str(prettier), "--write", str(dest)], capture_output=True, text=True, cwd=common.REPO / "apps" / "web")
    return dest


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------


def load_analysis(slug: str, redo: bool) -> dict:
    path = proxy.WORK / slug / "analysis.json"
    if redo or not path.exists():
        data = analyze.analyze(slug, CHARACTERS[slug]["shorts"], CHARACTERS[slug].get("overrides"))
        analyze.save(slug, data)
        return data
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", choices=list(CHARACTERS))
    ap.add_argument("--analyze", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--timeline-only", action="store_true")
    ap.add_argument("--no-verify", action="store_true")
    ap.add_argument("--tiers", default=",".join(TIERS))
    args = ap.parse_args()
    slug = args.slug
    tiers = args.tiers.split(",")

    plan = Plan(slug, load_analysis(slug, args.analyze))
    problems = plan.check()
    for msg in problems:
        print("WARNING", msg, flush=True)
    root = common.LIB_ROOT / "animation" / slug
    if not args.timeline_only:
        for job in jobs_of(plan):
            job.build(tiers, root, args.force)
            print("built", job.name, flush=True)
        poster = make_still(plan, args.force)
        print("still", poster["w"], poster["h"], flush=True)
    dest = write_timeline(slug, plan, tiers)
    total = sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
    print("wrote", dest, "| mirror bytes", total, common.human(total), flush=True)
    if not args.no_verify and not args.timeline_only:
        import verify  # noqa: PLC0415

        verify.run(slug, plan, tiers)


if __name__ == "__main__":
    main()
