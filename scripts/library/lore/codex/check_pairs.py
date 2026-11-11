"""Check a writer's answer for one batch of relationship texts.

    python scripts/library/lore/codex/check_pairs.py p03     (reads pairs-in/p03.json and pairs/p03.json)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DASH = re.compile("[–—]")
BANNED = re.compile(r"\bconviction\b|Terenia|Terinia|Terrenia|Seiresk|Windstorm Nest", re.I)
MARKDOWN = re.compile(r"[*_`#]|\]\(")


def problems(batch: str) -> list[str]:
    out: list[str] = []
    want = [p["slug"] for p in json.loads((HERE / "pairs-in" / f"{batch}.json").read_text(encoding="utf-8"))]
    got = json.loads((HERE / "pairs" / f"{batch}.json").read_text(encoding="utf-8"))
    for slug in want:
        paras = got.get(slug)
        if not isinstance(paras, list) or not 2 <= len(paras) <= 4:
            out.append(f"{slug}: needs two to four paragraphs")
            continue
        for i, para in enumerate(paras):
            label = f"{slug} paragraph {i + 1}"
            if not isinstance(para, str) or not para.strip():
                out.append(f"{label}: empty")
                continue
            if len(para) > 520:
                out.append(f"{label}: {len(para)} characters, limit 520")
            if DASH.search(para):
                out.append(f"{label}: dash")
            if BANNED.search(para):
                out.append(f"{label}: banned word")
            if MARKDOWN.search(para):
                out.append(f"{label}: markdown")
    for slug in got:
        if slug not in want:
            out.append(f"{slug}: not in the batch")
    return out


def main(argv: list[str]) -> int:
    bad = 0
    for batch in argv:
        found = problems(batch)
        for line in found:
            print(f"{batch}: {line}")
        print(f"{batch}: {len(found)} problems")
        bad += len(found)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
