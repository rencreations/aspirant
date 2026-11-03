"""Print size, duration and frame rate of media files.

    python scripts/story/tools/probe.py <path> [<path> ...]
"""

from __future__ import annotations

import sys

from common import probe, resolve


def main() -> None:
    for arg in sys.argv[1:]:
        p = resolve(arg)
        info = probe(p)
        dur = f"{info['duration']:.2f}s" if info["duration"] else "-"
        print(f"{arg}: {info['width']}x{info['height']} {dur} {info['fps']}fps {info['codec']}  {p.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
