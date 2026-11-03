"""Find the cuts (shot changes) of a video, so a clip can be kept inside one shot.

    python scripts/story/tools/shots.py <video> [--threshold 0.30]

Prints the times of the cuts in seconds. Results are cached in the tools' preview folder.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess

from common import SCRATCH, probe, resolve


def cuts(path_arg: str, threshold: float = 0.30) -> list[float]:
    src = resolve(path_arg)
    cache = SCRATCH / "shots-cache"
    cache.mkdir(exist_ok=True)
    key = re.sub(r"[^A-Za-z0-9]+", "_", str(src))[-120:] + f"_{threshold}.json"
    f = cache / key
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    proc = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(src), "-an", "-vf",
         f"scale=320:-2,select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
        capture_output=True, text=True, check=False,
    )
    times = sorted({round(float(m), 3) for m in re.findall(r"pts_time:([0-9.]+)", proc.stderr)})
    f.write_text(json.dumps(times), encoding="utf-8")
    return times


def shot_of(path_arg: str, t: float, threshold: float = 0.30) -> tuple[float, float]:
    """The start and end of the shot that holds time t."""
    c = cuts(path_arg, threshold)
    dur = probe(resolve(path_arg))["duration"] or t + 1
    starts = [0.0, *c]
    ends = [*c, dur]
    for s, e in zip(starts, ends):
        if s <= t < e:
            return s, e
    return starts[-1], ends[-1]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--threshold", type=float, default=0.30)
    args = ap.parse_args()
    print(cuts(args.video, args.threshold))
