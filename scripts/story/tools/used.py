"""List the sources the visual scripts already use, so a curator can avoid reusing one.

    python tools/used.py                      # every source, with the chapters that use it
    python tools/used.py lesley-and-change    # only sources whose path contains the text
    python tools/used.py --twice              # only sources already used twice (do not use again)

A source is a picture file (with its crop), or a film (with a three second window), as the
validator counts them: at most twice in the whole book.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

VISUALS = Path(__file__).resolve().parent.parent / "visuals"


def keys_of(m) -> list[str]:
    if isinstance(m, list):  # a panels insert is a list of pictures
        return [k for one in m for k in keys_of(one)]
    if not isinstance(m, dict):
        return []
    t = m.get("type")
    if t == "image":
        return [f"{m['src']} crop={m.get('crop')}"]
    if t in ("frame", "clip"):
        at = m.get("t") if t == "frame" else m.get("start", 0)
        return [f"{m['src']} window={int((at or 0) // 3) * 3}s"]
    if t == "sequence":
        out = []
        for part in m.get("parts", []):
            out.append(f"{part['src']} window={int((part.get('start', 0) or 0) // 3) * 3}s")
        return out
    return []


def main(argv: list[str]) -> int:
    twice = "--twice" in argv
    needle = next((a for a in argv if not a.startswith("--")), "")
    seen: dict[str, list[str]] = {}
    for f in sorted(VISUALS.glob("c*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        pieces = [d.get("hero"), d.get("thumb")] + [i.get("media") for i in d.get("inserts", [])]
        for m in pieces:
            for k in keys_of(m):
                if k not in seen or f.stem not in seen[k]:
                    seen.setdefault(k, []).append(f.stem)
    for k in sorted(seen):
        if needle and needle not in k:
            continue
        if twice and len(seen[k]) < 2:
            continue
        print(f"{len(seen[k])}x  {k}  <- {', '.join(seen[k])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
