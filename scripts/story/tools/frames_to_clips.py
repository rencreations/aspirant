"""Turn the still frames of visual scripts into short clips cut from the same shot.

    python scripts/story/tools/frames_to_clips.py c06 c07 ...      # these chapters
    python scripts/story/tools/frames_to_clips.py --all --skip c00,c01,...

A `frame` (a plate, a place shot or a hero) becomes a `clip` of about 3 seconds around the frame's
time, kept inside the shot that holds the frame (so it never runs into a cut and shows nothing the
frame did not). A shot shorter than 1.4 s stays a still. A place shot keeps its name as overlay text.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from shots import shot_of

VISUALS = Path(__file__).resolve().parents[1] / "visuals"
MIN_LEN = 1.4
BEFORE, AFTER = 1.2, 1.8


def clip_of(media: dict) -> dict | None:
    if media.get("type") != "frame":
        return None
    t = float(media["t"])
    s0, e1 = shot_of(media["src"], t)
    start = max(s0 + 0.04, t - BEFORE)
    end = min(e1 - 0.04, t + AFTER)
    if end - start < 3.0:  # near an edge of the shot: use what the shot has, up to 3 s
        start = max(s0 + 0.04, end - 3.0)
        end = min(e1 - 0.04, start + 3.0)
    if end - start < MIN_LEN:
        return None
    out = {k: v for k, v in media.items() if k not in ("type", "t")}
    out.update({"type": "clip", "start": round(start, 2), "end": round(end, 2), "sound": False,
                "poster": round(min(max(t - start, 0.0), end - start), 2)})
    return out


def convert(name: str) -> int:
    path = VISUALS / f"{name}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    n = 0
    if data.get("hero", {}).get("type") == "frame":
        c = clip_of(data["hero"])
        if c:
            data["hero"] = c
            n += 1
    for ins in data.get("inserts", []):
        m = ins.get("media")
        if ins["kind"] in ("plate", "place") and isinstance(m, dict) and m.get("type") == "frame":
            c = clip_of(m)
            if not c:
                continue
            if ins["kind"] == "place":
                ins["overlay"] = {"kicker": "The place", "title": ins.pop("label", "")}
            ins["kind"] = "clip"
            ins["media"] = c
            n += 1
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return n


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("chapters", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--skip", default="")
    args = ap.parse_args()
    skip = {s for s in args.skip.split(",") if s}
    names = sorted(p.stem for p in VISUALS.glob("c*.json")) if args.all else args.chapters
    total = 0
    for name in names:
        if name in skip:
            continue
        n = convert(name)
        total += n
        print(f"{name}: {n} converted")
    print(f"{total} frames turned into clips")
    sys.exit(0)
