"""
Checks the encoded files of one character against the timeline they were written with, and makes
contact sheets (first and last frame of every clip) for a look by eye.

It decodes the 1080 files to grey 320x144 proxies (the same as the analysis) and prints:
  - frames of every file against the timeline
  - frame exactness: the first frame of every file against the source frame it was cut from (and
    its neighbours), so a seek that is a frame out shows up
  - idle: MSE of the last frame against the first (the loop seam), next to the MSE of neighbours
  - welcome: the last frame against the idle frame it hands over to
  - every hand-over of the engine: entrance or short frame 0 against idle[startPhase], the frame
    the dissolve back starts on against idle[syncPhase], gallery-in[handFrame] against
    gallery-loop[phase], gallery-out[0] against gallery-loop[startPhase]
Contact sheets: D:/ren/aspirant-work/animation/<slug>/sheet-1.png and sheet-2.png.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import proxy  # noqa: E402

W, H = proxy.W, proxy.H


def decode(path: Path) -> np.ndarray:
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={W}:{H}:flags=area,format=gray",
         "-f", "rawvideo", "-"],
        capture_output=True,
    )
    a = np.frombuffer(p.stdout, dtype=np.uint8)
    n = len(a) // (W * H)
    return a[: n * W * H].reshape(n, H, W).astype(np.float32)


def mse(a: np.ndarray, b: np.ndarray) -> float:
    return float(((a - b) ** 2).mean())


def run(slug: str, plan, tiers: list[str]) -> None:
    tl = plan.timeline()
    root = common.LIB_ROOT / "animation" / slug / "1080"
    names = plan.files()
    P = {n: decode(root / n) for n in names}
    loop_n = tl["loopFrames"]
    bad: list[str] = []

    def flag(ok: bool, text: str) -> None:
        print(("  ok    " if ok else "  CHECK ") + text)
        if not ok:
            bad.append(text)

    # -- frame counts ------------------------------------------------------------------------
    page = tl["pages"]["gallery"]
    want = {
        "welcome.mp4": plan.w_end + 1 - plan.w_start - 0 + analyze_extra(),
        "idle.mp4": loop_n,
        "gallery-in.mp4": page["in"]["frames"],
        "gallery-loop.mp4": page["loop"]["frames"],
        "gallery-out.mp4": page["out"]["frames"],
    }
    for i in range(3):
        s = tl["shorts"][f"short-{i + 1}"]
        want[s["file"]] = s["frames"]
    print(f"[{slug}] frames")
    for n in names:
        flag(len(P[n]) == want[n], f"{n}: {len(P[n])} frames, timeline says {want[n]}")
    for t in tiers:
        if t == "1080":
            continue
        for n in names:
            q = subprocess.run(
                ["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0",
                 "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0",
                 str(common.LIB_ROOT / "animation" / slug / t / n)],
                capture_output=True, text=True,
            )
            flag(q.stdout.strip() == str(len(P[n])), f"{t}/{n}: {q.stdout.strip()} frames")

    # -- frame exactness against the source --------------------------------------------------
    print(f"[{slug}] frame exactness (mse to the source frame, and to its neighbours)")
    srcs = {
        "welcome.mp4": ("welcome", plan.w_start),
        "idle.mp4": ("idle", plan.ls),
        "gallery-in.mp4": ("zoom", plan.a0("zoom")),
        "gallery-loop.mp4": ("zoom", plan.clips["zoom"]["cut"]["l0"]),
        "gallery-out.mp4": ("zoom", plan.clips["zoom"]["cut"]["exit"]),
    }
    for i, clip in enumerate(plan.unique_shorts()):
        srcs[f"short-{i + 1}.mp4"] = (clip, plan.a0(clip))
    for n, (rec, first) in srcs.items():
        S = proxy.load(slug, rec).astype(np.float32)
        for k, label in ((0, "first"), (len(P[n]) // 2, "mid")):
            errs = {d: mse(P[n][k], S[first + k + d]) for d in range(-2, 3) if 0 <= first + k + d < len(S)}
            best = min(errs, key=errs.get)
            flag(best == 0 or errs[0] <= errs[best] + 0.3,
                 f"{n} {label}: mse {errs[0]:.2f}, best offset {best} ({errs[best]:.2f})")

    # -- the loop seam -----------------------------------------------------------------------
    idle = P["idle.mp4"]
    nb = float(np.mean([mse(idle[i], idle[i + 1]) for i in range(0, len(idle) - 1, 7)]))
    print(f"[{slug}] idle loop: last->first mse {mse(idle[-1], idle[0]):.2f} (neighbours {nb:.2f})")
    gl = P["gallery-loop.mp4"]
    nb2 = float(np.mean([mse(gl[i], gl[i + 1]) for i in range(0, len(gl) - 1, 7)]))
    print(f"[{slug}] pose loop: last->first mse {mse(gl[-1], gl[0]):.2f} (neighbours {nb2:.2f})")
    wl = P["welcome.mp4"]
    print(f"[{slug}] welcome: last frame vs idle[{analyze_extra() - 1}] mse {mse(wl[-1], idle[analyze_extra() - 1]):.2f}; "
          f"vs previous frame {mse(wl[-1], wl[-2]):.2f}; frame {plan.w_blend + analyze_extra()} from the end vs idle "
          f"{mse(wl[-(plan.w_blend + analyze_extra())], idle[0]):.2f}")

    # -- the engine's hand-overs -------------------------------------------------------------
    print(f"[{slug}] hand-overs (mse between the two pictures that dissolve)")

    def at(phase: int) -> np.ndarray:
        return idle[phase % loop_n]

    pin = page["in"]
    for ph in pin["startPhases"]:
        v = mse(P["gallery-in.mp4"][0], at(ph))
        flag(v < 30, f"gallery-in[0] vs idle[{ph}]: {v:.1f}")
    for i in range(3):
        s = tl["shorts"][f"short-{i + 1}"]
        if i and s["file"] == tl["shorts"][f"short-{i}"]["file"]:
            continue
        v = min(mse(P[s["file"]][0], at(ph)) for ph in s["startPhases"])
        flag(v < 30, f"short-{i + 1}[0] vs idle[{s['startPhases']}]: {v:.1f}")
        b = s["back"]
        v = mse(P[s["file"]][b["syncFrame"]], at(b["syncPhase"]))
        flag(v < 40, f"short-{i + 1}[{b['syncFrame']}] vs idle[{b['syncPhase']}]: {v:.1f}")
    v = mse(P["gallery-in.mp4"][pin["handFrame"]], gl[(pin["handFrame"] + pin["loopOffset"]) % len(gl)])
    flag(v < 30, f"gallery-in[{pin['handFrame']}] vs gallery-loop[{(pin['handFrame'] + pin['loopOffset']) % len(gl)}]: {v:.1f}")
    out = page["out"]
    v = mse(P["gallery-out.mp4"][0], gl[out["startPhase"]])
    flag(v < 30, f"gallery-out[0] vs gallery-loop[{out['startPhase']}]: {v:.1f}")
    v = mse(P["gallery-out.mp4"][out["syncFrame"]], at(out["syncPhase"]))
    flag(v < 40, f"gallery-out[{out['syncFrame']}] vs idle[{out['syncPhase']}]: {v:.1f}")

    sheets(slug, root, names, P)
    print(f"[{slug}] {len(bad)} checks to look at")


def analyze_extra() -> int:
    import stage  # noqa: PLC0415

    return stage.EXTRA


def sheets(slug: str, root: Path, names: list[str], P: dict) -> None:
    from PIL import Image, ImageDraw  # noqa: PLC0415

    work = proxy.WORK / slug / "sheet"
    work.mkdir(parents=True, exist_ok=True)
    cw, ch = 560, 252
    groups = [names[:5], names[5:]]
    for gi, group in enumerate(groups):
        if not group:
            continue
        sheet = Image.new("RGB", (cw * 2, (ch + 16) * len(group)), (20, 20, 24))
        d = ImageDraw.Draw(sheet)
        for row, n in enumerate(group):
            last = len(P[n]) - 1
            sel = f"select='eq(n,0)+eq(n,{last})'"
            for f in work.glob("t_*.png"):
                f.unlink()
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", str(root / n), "-vf", f"{sel},scale={cw}:{ch}",
                 "-vsync", "0", str(work / "t_%d.png")],
                capture_output=True,
            )
            for col in range(2):
                f = work / f"t_{col + 1}.png"
                if f.exists():
                    sheet.paste(Image.open(f).convert("RGB"), (col * cw, row * (ch + 16) + 16))
            d.text((4, row * (ch + 16) + 2), f"{n}  first / last (frame {last})", fill=(230, 230, 230))
        sheet.save(proxy.WORK / slug / f"sheet-{gi + 1}.png")
    print(f"[{slug}] contact sheets: {proxy.WORK / slug}/sheet-1.png and sheet-2.png")
