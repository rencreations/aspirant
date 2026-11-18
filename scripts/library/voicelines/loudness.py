"""Loudness of every voice clip, and the gain that levels them (the home page and the Voicelines room).

The clips of the room were recorded far apart: the Japanese lines sit near -22 LUFS, the other seven
languages between -32 and -37 LUFS, a few trailer clips near -17. Nothing is re-encoded and no key is
written again. Each record carries a gain `g` (dB, one decimal) and the player applies it
(`audio.playVoice`, option `gainDb`).

    g = min(TARGET_LUFS - I - BUS_DB, CEIL_DBTP - TP - BUS_DB)

`I` is the integrated loudness of the playing file (the AAC in the mirror, read with ffmpeg ebur128),
`TP` its true peak. `BUS_DB` is the fixed lift of the voice bus in `apps/web/src/lib/audio.ts`
(`voiceBus.gain.value = 1.9`), so the level that reaches the master is TARGET_LUFS for every clip whose
peak allows it. A clip that cannot reach the target without passing CEIL_DBTP stays a little quieter.

A mono file is measured as it is played: Web Audio copies it to both channels at full level (ffmpeg's own
up-mix lowers each channel by 3 dB), so a mono clip is 3 LU louder than ebur128 says of the bare file. Without
this the Japanese lines, which are mostly mono, came out 3 LU too loud (found by `verify_gain.cjs`).

Run (anaconda Python, ffmpeg on the PATH):

    C:/Users/muham/anaconda3/python.exe scripts/library/voicelines/loudness.py            measure what is new, print the report
    C:/Users/muham/anaconda3/python.exe scripts/library/voicelines/loudness.py --check    only report, measure nothing

`loudness.json` (beside this file) is the cache: key -> {i, tp, size, mt, m}. A key is measured again only when the
size or the modified time of its file changed, or the way of measuring (METHOD) did. `build.py` calls `ensure()` after it has encoded.
"""

from __future__ import annotations

import json
import math
import re
import statistics
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

HERE = Path(__file__).resolve().parent
CACHE = HERE / "loudness.json"

TARGET_LUFS = -18.0
CEIL_DBTP = -1.0
VOICE_BUS_GAIN = 1.9  # voiceBus.gain.value in apps/web/src/lib/audio.ts
BUS_DB = 20 * math.log10(VOICE_BUS_GAIN)  # 5.575 dB
JOBS = 3  # the machine is shared

METHOD = 2  # bump when the way of measuring changes: every cached value is measured again

_I = re.compile(r"I:\s+(-?[\d.]+|-inf)\s+LUFS")
_TP = re.compile(r"Peak:\s+(-?[\d.]+|-inf)\s+dBFS")


def gain_db(integrated: float, true_peak: float, bus_db: float = BUS_DB) -> float:
    """The gain (dB, one decimal) that brings a clip to the target without passing the ceiling."""
    g = min(TARGET_LUFS - integrated - bus_db, CEIL_DBTP - true_peak - bus_db)
    return round(g, 1)


def channels(path: Path) -> int:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "csv=p=0", str(path)],
        capture_output=True, encoding="utf-8", errors="replace", timeout=120,
    ).stdout
    return int(out.strip() or 0)


def measure(path: Path) -> dict[str, float]:
    """Integrated loudness (LUFS) and true peak (dBTP) of one file, as the browser plays it (a mono file on both channels)."""
    n = channels(path)
    if n not in (1, 2):
        raise SystemExit(f"{path}: {n} channels, expected 1 or 2")
    graph = "pan=stereo|c0=c0|c1=c0," if n == 1 else ""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-nostdin", "-i", str(path), "-af", f"{graph}ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, encoding="utf-8", errors="replace", timeout=300,
    )
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i, tp = _I.search(tail), _TP.search(tail)
    if not i or not tp or "inf" in i.group(1) or "inf" in tp.group(1):
        raise SystemExit(f"cannot measure {path}")
    return {"i": float(i.group(1)), "tp": float(tp.group(1))}


def load() -> dict[str, dict[str, float]]:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def _stat(path: Path) -> tuple[int, int]:
    s = path.stat()
    return s.st_size, s.st_mtime_ns // 1_000_000  # milliseconds are enough and survive a copy that keeps the time


def ensure(keys: list[str], measure_missing: bool = True) -> dict[str, dict[str, float]]:
    """The loudness of every key (a path under library/v1/), measuring the ones that are new or changed."""
    cache = load()
    todo = []
    for key in keys:
        path = common.LIB_ROOT / key
        if not path.exists():
            raise SystemExit(f"loudness: missing file {key}")
        size, mt = _stat(path)
        c = cache.get(key)
        if not c or c.get("m") != METHOD or c["size"] != size or c["mt"] != mt:
            todo.append((key, path, size, mt))
    if todo and measure_missing:
        print(f"measuring the loudness of {len(todo)} files ({JOBS} at a time)", flush=True)

        def one(job):
            key, path, size, mt = job
            m = measure(path)
            return key, {"i": m["i"], "tp": m["tp"], "size": size, "mt": mt, "m": METHOD}

        with ThreadPoolExecutor(JOBS) as pool:
            for n, (key, rec) in enumerate(pool.map(one, todo), 1):
                cache[key] = rec
                if n % 300 == 0:
                    print(f"  {n}/{len(todo)}", flush=True)
        _save(cache)
    missing = [k for k in keys if k not in cache]
    if missing:
        raise SystemExit(f"loudness: {len(missing)} keys not measured, first {missing[0]}")
    return cache


def _save(cache: dict[str, dict[str, float]]) -> None:
    ordered = dict(sorted(cache.items()))
    CACHE.write_text(json.dumps(ordered, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")


def all_voice_keys() -> list[str]:
    root = common.LIB_ROOT / "voicelines"
    return sorted(p.relative_to(common.LIB_ROOT).as_posix() for p in root.rglob("*.m4a"))


def _is_clip(key: str) -> bool:
    """A line of one language (voicelines/<slug>/[<lang>/]NN.m4a) or a trailer clip. Not the full recording."""
    return not key.endswith("/full.m4a")


def report(cache: dict[str, dict[str, float]]) -> None:
    clips = {k: v for k, v in cache.items() if _is_clip(k)}
    before = [v["i"] for v in clips.values()]
    gains = [gain_db(v["i"], v["tp"]) for v in clips.values()]
    after = [v["i"] + g + BUS_DB for v, g in zip(clips.values(), gains)]
    capped = sum(1 for v in clips.values() if CEIL_DBTP - v["tp"] - BUS_DB < TARGET_LUFS - v["i"] - BUS_DB)
    print(f"{len(clips)} clips, bus lift {BUS_DB:.2f} dB, target {TARGET_LUFS} LUFS, ceiling {CEIL_DBTP} dBTP")
    print(f"  before: mean {statistics.mean(before):.1f}  sd {statistics.pstdev(before):.2f}  min {min(before):.1f}  max {max(before):.1f} LUFS")
    print(f"  gain  : min {min(gains):.1f}  median {statistics.median(gains):.1f}  max {max(gains):.1f} dB, {capped} held by the peak ceiling")
    print(f"  after : mean {statistics.mean(after):.2f}  sd {statistics.pstdev(after):.2f}  min {min(after):.1f}  max {max(after):.1f} LUFS")
    p5, p95 = sorted(after)[int(len(after) * 0.05)], sorted(after)[int(len(after) * 0.95)]
    print(f"  after, p5..p95: {p5:.1f} to {p95:.1f} LUFS ({p95 - p5:.1f} LU)")


if __name__ == "__main__":
    keys = all_voice_keys()
    cache = ensure(keys, measure_missing="--check" not in sys.argv)
    report(cache)
