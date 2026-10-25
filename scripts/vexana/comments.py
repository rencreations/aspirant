"""
Finds the viewer comments that fly across the top of the picture of Vexana's livestream replay.

Source: D:/ren/aspirant/media/vexana-and-guinevere/video/live-vexana.webm (1920x1080, 22:47). The
picture is a 608x1080 window at x 656 with pure black bars either side. The comments are plain
white text (with emoji) that enters at the right edge of the picture, crosses it to the left and
leaves, in the top part of the picture. The subtitles of her speech are at the bottom and are not
comments.

Steps (each writes into the work directory, default `<scratch>/comments`):
  scan    decode the top band at SCAN_FPS and write the number of pure white pixels per frame
  tracks  find the text blobs of each frame, link them into tracks that move left, and write
          tracks.json: first frame in the picture (t), the lane (y), the width and the speed
  crops   write one PNG crop per track at the moment its text is fully inside, for reading
  emit    write stream/comments.generated.ts from tracks.json and comments.transcript.json
The text of each comment was read by eye from the crops (the emoji are drawn as images, so no OCR
reads them) and is kept in comments.transcript.json next to this file (the comments are burned into the video's
pixels, so the page does not draw them again: the chat lists them at their times); `emit` joins the two into
apps/web/src/features/character/vexana/stream/comments.generated.ts.

Needs ffmpeg on the path and a Python with numpy and Pillow (the anaconda one on this machine):
  C:/Users/muham/anaconda3/python.exe scripts/vexana/comments.py scan tracks crops emit
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SRC = Path("D:/ren/aspirant/media/vexana-and-guinevere/video/live-vexana.webm")
PIC_X, PIC_W = 656, 608  # the picture inside the 1920x1080 frame
BAND_Y = int(__import__("os").environ.get("BAND_Y", "0"))  # top of the scanned band in the picture
BAND_H = int(__import__("os").environ.get("BAND_H", "440"))  # the comments fly in the top of the picture
SCAN_FPS = 10
WHITE = 250  # a comment pixel is pure white
WORK = Path(sys.argv[0]).resolve().parent / ("_comments" if BAND_Y == 0 else f"_comments_{BAND_Y}")


def frames(fps: int = SCAN_FPS, start: float = 0.0, length: float | None = None):
    """Yield (time, band) with band a (BAND_H, PIC_W, 3) uint8 array."""
    cmd = ["ffmpeg", "-loglevel", "error", "-ss", str(start)]
    if length:
        cmd += ["-t", str(length)]
    cmd += ["-i", str(SRC), "-an", "-vf", f"fps={fps},crop={PIC_W}:{BAND_H}:{PIC_X}:{BAND_Y}",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    size = PIC_W * BAND_H * 3
    i = 0
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield start + i / fps, np.frombuffer(buf, np.uint8).reshape(BAND_H, PIC_W, 3)
        i += 1
    p.wait()


def white_mask(band: np.ndarray) -> np.ndarray:
    return (band.min(axis=2) >= WHITE)


SHIFTS = range(13, 20)  # px a comment moves between two scan frames (about 158 px/s at 10 fps)
CORE = 240  # the white of the text, away from its anti-aliased edge
MIN_PX = 14  # moving white pixels a line needs to count


def moving_mask(prev: np.ndarray, cur: np.ndarray) -> np.ndarray:
    """White pixels of `cur` that were `s` pixels further right one frame earlier (s in SHIFTS)."""
    h, w = cur.shape
    out = np.zeros((h, w), bool)
    for s in SHIFTS:
        # white now, white `s` pixels to the right before, and not white in the same place before
        # (a static bar or panel edge matches itself at every shift and is not a comment)
        out[:, : w - s] |= cur[:, : w - s] & prev[:, s:] & ~prev[:, : w - s]
    return out


def lines_of(mv: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    """Text lines in a moving-pixel mask: (y0, y1, x0, x1, pixels), split at wide horizontal gaps."""
    rows = mv.sum(axis=1)
    found = []
    y = 0
    h = mv.shape[0]
    while y < h:
        if rows[y] < 1:
            y += 1
            continue
        y0 = y
        gap = 0
        while y < h and gap <= 3:
            gap = gap + 1 if rows[y] < 1 else 0
            y += 1
        y1 = y - gap
        band = mv[y0:y1]
        if y1 - y0 < 6 or y1 - y0 > 60:
            continue
        cols = np.where(band.any(axis=0))[0]
        if len(cols) == 0:
            continue
        start = cols[0]
        prev_c = cols[0]
        for c in list(cols[1:]) + [10**9]:
            if c - prev_c > 90:
                seg = band[:, start : prev_c + 1]
                n = int(seg.sum())
                if n >= MIN_PX:
                    found.append((y0, y1, int(start), int(prev_c), n))
                start = c
            prev_c = c
    return found


def scan() -> None:
    """Per frame: the text lines that move left (the comments)."""
    WORK.mkdir(exist_ok=True)
    prev = None
    out = []
    for t, band in frames():
        cur = band.min(axis=2) >= CORE
        if prev is not None:
            out.append({"t": round(t, 3), "lines": lines_of(moving_mask(prev, cur))})
        prev = cur
    (WORK / "scan.json").write_text(json.dumps({"fps": SCAN_FPS, "frames": out}))
    print("frames", len(out), "with lines", sum(1 for f in out if f["lines"]))


def build_tracks() -> list[dict]:
    """Link the lines of consecutive frames into one track per comment."""
    fr = json.loads((WORK / "scan.json").read_text())["frames"]
    step = 1 / SCAN_FPS
    active: list[dict] = []
    done: list[dict] = []
    for f in fr:
        t = f["t"]
        # a track that was not seen for a while is finished
        for tr in [a for a in active if t - a["last_t"] > 0.35]:
            active.remove(tr)
            done.append(tr)
        used = set()
        for (y0, y1, x0, x1, n) in f["lines"]:
            yc = (y0 + y1) / 2
            best = None
            for tr in active:
                if id(tr) in used:
                    continue
                dt = t - tr["last_t"]
                want = tr["last_x0"] - 15.8 * dt / step * step * SCAN_FPS / SCAN_FPS * SCAN_FPS * step
                # expected left edge: it moves 15.8 px per scan frame
                want = tr["last_x0"] - 15.8 * round(dt / step)
                if abs(yc - tr["yc"]) <= 10 and abs(x0 - want) <= 7:
                    d = abs(x0 - want)
                    if best is None or d < best[0]:
                        best = (d, tr)
            if best:
                tr = best[1]
            else:
                tr = {"obs": [], "yc": yc}
                active.append(tr)
            used.add(id(tr))
            tr["obs"].append({"t": t, "y0": y0, "y1": y1, "x0": x0, "x1": x1, "n": n})
            tr["last_t"], tr["last_x0"], tr["yc"] = t, x0, yc
    done += active
    return [tr for tr in done if len(tr["obs"]) >= 12]


def tracks() -> None:
    trs = build_tracks()
    # the speed: slope of the left edge against time, over the frames where it is clear of the sides
    xs, ts = [], []
    for tr in trs:
        pts = [(o["t"], o["x0"]) for o in tr["obs"] if 30 < o["x0"] < PIC_W - 40]
        if len(pts) >= 6:
            tt = np.array([p[0] for p in pts])
            xx = np.array([p[1] for p in pts])
            slope = np.polyfit(tt, xx, 1)[0]
            xs.append(slope)
    v = -float(np.median(xs))
    print("tracks", len(trs), "speed px/s median", round(v, 2), "min", round(-max(xs), 1), "max", round(-min(xs), 1))
    out = []
    for tr in trs:
        pts = [o for o in tr["obs"] if 20 < o["x0"] < PIC_W - 20]
        if not pts:
            continue
        t0 = float(np.median([o["t"] - (PIC_W - o["x0"]) / v for o in pts]))
        full = [o for o in tr["obs"] if o["x0"] > 4 and o["x1"] < PIC_W - 30]
        width = max((o["x1"] - o["x0"] for o in full), default=None)
        y0 = int(np.median([o["y0"] for o in tr["obs"]]))
        y1 = int(np.median([o["y1"] for o in tr["obs"]]))
        mid = full[len(full) // 2] if full else None
        tt = np.array([o["t"] for o in pts])
        xx = np.array([o["x0"] for o in pts])
        speed = float(-np.polyfit(tt, xx, 1)[0]) if len(pts) >= 5 else v
        # the entry time with this comment's own speed
        t0 = float(np.median([o["t"] - (PIC_W - o["x0"]) / speed for o in pts]))
        out.append({"t": round(t0, 2), "speed": round(speed, 1), "y0": y0, "y1": y1, "width": width,
                    "frames": len(tr["obs"]),
                    "crop_t": mid["t"] if mid else pts[len(pts) // 2]["t"],
                    "crop_x0": mid["x0"] if mid else pts[len(pts) // 2]["x0"],
                    "crop_x1": mid["x1"] if mid else pts[len(pts) // 2]["x1"]})
    out.sort(key=lambda r: r["t"])
    (WORK / "tracks.json").write_text(json.dumps({"speed": v, "tracks": out}, indent=1))
    print("kept", len(out))


def crops() -> None:
    """One PNG per track: its lane across the whole picture at a moment the text is in view."""
    from PIL import Image
    d = json.loads((WORK / "tracks.json").read_text())
    out_dir = WORK / "crops"
    out_dir.mkdir(exist_ok=True)
    for i, tr in enumerate(d["tracks"]):
        y0, y1 = max(0, tr["y0"] - 8), tr["y1"] + 8
        png = out_dir / f"{i:02d}.png"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(tr["crop_t"]), "-i", str(SRC),
                        "-frames:v", "1", "-vf", f"crop={PIC_W}:{y1 - y0}:{PIC_X}:{y0},scale=iw*2:ih*2:flags=lanczos",
                        str(png)], check=True)
    print("crops", len(d["tracks"]))


TRANSCRIPT = Path(__file__).resolve().parent / "comments.transcript.json"
OUT = Path(__file__).resolve().parents[2] / "apps/web/src/features/character/vexana/stream/comments.generated.ts"


def dedupe(rows: list[dict]) -> list[dict]:
    """A comment whose track broke in two (the text moved behind a bright part) appears twice."""
    kept: list[dict] = []
    for r in rows:
        twin = next((k for k in kept if abs(k["yc"] - r["yc"]) <= 8 and abs(k["t"] - r["t"]) <= 1.5
                     and abs(k["speed"] - r["speed"]) <= 15), None)
        if twin is not None:
            # keep the one that was followed for longer, with the time of the earlier one
            if r["frames"] > twin["frames"]:
                twin.update({k: r[k] for k in ("speed", "width", "frames")})
            twin["t"] = min(twin["t"], r["t"])
            if twin["text"].startswith("DUP"):
                twin["text"] = r["text"]
            continue
        kept.append(dict(r))
    return kept


def emit() -> None:
    """Write comments.generated.ts from tracks.json and the transcript (the text read from the crops)."""
    d = json.loads((WORK / "tracks.json").read_text())
    said = json.loads(TRANSCRIPT.read_text(encoding="utf8"))
    rows = []
    for tr in d["tracks"]:
        yc = (tr["y0"] + tr["y1"]) // 2
        # the transcript was written for these tracks: match on time and lane
        hit = min(said, key=lambda s: abs(s["t"] - tr["t"]) + abs(s["yc"] - yc) / 10)
        if abs(hit["t"] - tr["t"]) > 0.6 or abs(hit["yc"] - yc) > 12:
            raise SystemExit(f"no transcript for the track at {tr['t']} (lane {yc})")
        rows.append({**tr, "yc": yc, "text": hit["text"]})
    rows = [r for r in dedupe(rows) if not r["text"].startswith("DUP")]
    rows.sort(key=lambda r: r["t"])
    lines = [
        "// Made by scripts/vexana/comments.py (emit). Do not edit by hand.",
        "// The viewer comments that fly across the top of the picture of the livestream replay.",
        "",
        "export interface StreamComment {",
        "  /** Second of the video when its first letter enters at the right edge of the picture. */",
        "  t: number;",
        "  /** Speed across the picture, in picture widths per second. */",
        "  speed: number;",
        "  /** Height of its lane, as a fraction of the picture height (the middle of the text). */",
        "  lane: number;",
        "  text: string;",
        "}",
        "",
        "export const STREAM_COMMENTS: readonly StreamComment[] = [",
    ]
    for r in rows:
        lines.append(f'  {{ t: {r["t"]:.2f}, speed: {r["speed"] / PIC_W:.4f}, lane: {r["yc"] / 1080:.4f}, text: {json.dumps(r["text"], ensure_ascii=False)} }},')
    lines += ["];", ""]
    OUT.write_text(chr(10).join(lines), encoding="utf8")
    subprocess.run(["npx", "prettier", "--write", str(OUT)], cwd=Path(__file__).resolve().parents[2] / "apps/web",
                   check=True, shell=(sys.platform == "win32"), stdout=subprocess.DEVNULL)
    print("comments", len(rows), "->", OUT)


if __name__ == "__main__":
    for step in sys.argv[1:]:
        {"scan": scan, "tracks": tracks, "crops": crops, "emit": emit}[step]()
