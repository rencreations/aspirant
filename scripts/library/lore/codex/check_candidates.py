"""Check a candidates file of the lore codex against the book.

    python scripts/library/lore/codex/check_candidates.py candidates/p3.json

A candidates file lists everything one stretch of chapters names or explains: people, creatures,
things, places, groups, ideas and events, with where each is seen, what the book says about it
and how it ties to the others. The paragraph numbers are the ones `scripts/story/storytext.py`
prints (they start at 0 after the dateline). Exit code 1 when there is a problem.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent.parent / "story"))
import storytext  # noqa: E402

KINDS = {"person", "creature", "thing", "place", "group", "idea", "event"}
RELATIONS = {
    "family", "partner", "friend", "rival", "teacher", "student", "ally", "enemy", "maker",
    "creation", "guardian", "ward", "leader", "serves", "member", "owns", "lives", "found", "part",
}
DASH = re.compile("[–—]")
BANNED = re.compile(r"\bconviction\b|Terenia|Terinia|Terrenia|Seiresk|Windstorm Nest", re.I)


def problems(path: Path) -> list[str]:
    out: list[str] = []
    book = storytext.parse()
    counts = {c.number: len(c.paragraphs) for c in book.chapters}
    data = json.loads(path.read_text(encoding="utf-8"))
    lo, hi = data["chapters"]
    names: set[str] = set()

    def where(label: str, ref: dict) -> None:
        n, p = ref.get("n"), ref.get("p")
        if not isinstance(n, int) or not lo <= n <= hi:
            out.append(f"{label}: chapter {n!r} outside {lo} to {hi}")
            return
        ps = p if isinstance(p, list) else [p]
        for one in ps:
            if not isinstance(one, int) or not 0 <= one < counts[n]:
                out.append(f"{label}: paragraph {one!r} not in chapter {n} (0 to {counts[n] - 1})")

    def text(label: str, value: object) -> None:
        if not isinstance(value, str) or not value.strip():
            out.append(f"{label}: empty text")
            return
        if DASH.search(value):
            out.append(f"{label}: dash in text")
        if BANNED.search(value):
            out.append(f"{label}: banned word")

    for t in data["things"]:
        name = t.get("name", "")
        label = f"[{name}]"
        text(label + " name", name)
        if name.lower() in names:
            out.append(f"{label}: listed twice")
        names.add(name.lower())
        if t.get("kind") not in KINDS:
            out.append(f"{label}: kind {t.get('kind')!r}")
        text(label + " sub", t.get("sub"))
        for a in t.get("aliases", []):
            text(label + " alias", a)
        if not t.get("seen"):
            out.append(f"{label}: no 'seen'")
        for r in t.get("seen", []):
            where(label + " seen", r)
        for f in t.get("facts", []):
            where(label + " fact", f)
            text(label + " fact", f.get("t"))
        for r in t.get("explained", []):
            where(label + " explained", r)
        for r in t.get("ties", []):
            where(label + " tie", r)
            text(label + " tie", r.get("t"))
            text(label + " tie with", r.get("with"))
            if r.get("type") not in RELATIONS:
                out.append(f"{label}: tie type {r.get('type')!r}")
        for g in t.get("gear", []):
            where(label + " gear", g)
            text(label + " gear", g.get("t"))
    return out


def main(argv: list[str]) -> int:
    bad = 0
    for arg in argv:
        found = problems(Path(arg))
        for line in found:
            print(f"{arg}: {line}")
        data = json.loads(Path(arg).read_text(encoding="utf-8"))
        print(f"{arg}: {len(data['things'])} things, {len(found)} problems")
        bad += len(found)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
