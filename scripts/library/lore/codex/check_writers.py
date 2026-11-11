"""Check a writer's answer for one batch.

    python scripts/library/lore/codex/check_writers.py b03        (reads writers-in/b03.json and writers/b03.json)

Every slug of the batch must be answered; the texts must fit their limits and carry no dash, no banned
word and no Markdown.
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
    want = [e["slug"] for e in json.loads((HERE / "writers-in" / f"{batch}.json").read_text(encoding="utf-8"))]
    got = json.loads((HERE / "writers" / f"{batch}.json").read_text(encoding="utf-8"))

    def text(label: str, v: object, limit: int) -> None:
        if not isinstance(v, str) or not v.strip():
            out.append(f"{label}: empty")
            return
        if len(v) > limit:
            out.append(f"{label}: {len(v)} characters, limit {limit}")
        if DASH.search(v):
            out.append(f"{label}: dash")
        if BANNED.search(v):
            out.append(f"{label}: banned word")
        if MARKDOWN.search(v):
            out.append(f"{label}: markdown")

    for slug in want:
        w = got.get(slug)
        if not isinstance(w, dict):
            out.append(f"{slug}: not answered")
            continue
        text(f"{slug} line", w.get("line"), 90)
        text(f"{slug} short", w.get("short"), 150)
        text(f"{slug} summary", w.get("summary"), 700)
        if "sub" in w:
            text(f"{slug} sub", w["sub"], 40)
        rows = w.get("rows", [])
        if not isinstance(rows, list) or len(rows) > 12:
            out.append(f"{slug}: rows must be a list of at most 12")
            rows = []
        for r in rows:
            if not (isinstance(r, list) and len(r) in (2, 3)):
                out.append(f"{slug}: a row must be [label, value, n]")
                continue
            if len(r) == 3 and not (isinstance(r[2], int) and 0 <= r[2] <= 87):
                out.append(f"{slug}: the chapter of a row must be a whole number from 0 to 87")
            if len(r) == 2 and batch.startswith("ten-"):
                out.append(f"{slug}: row {r[0]!r} needs its chapter n")
            text(f"{slug} row label", r[0], 30)
            text(f"{slug} row {r[0]}", r[1], 220)
        weapons = w.get("weapons", [])
        if not isinstance(weapons, list) or len(weapons) > 14:
            out.append(f"{slug}: weapons must be a list of at most 14")
            weapons = []
        for g in weapons:
            if not (isinstance(g, dict) and "name" in g and "note" in g):
                out.append(f"{slug}: a weapon must be {{name, note}}")
                continue
            text(f"{slug} weapon name", g["name"], 60)
            text(f"{slug} weapon {g['name']}", g["note"], 220)
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
