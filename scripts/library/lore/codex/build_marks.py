"""Build the marks of the story pages from the plans (stage 7 of the codex).

    python scripts/library/lore/codex/build_marks.py [--check]

Reads `marks-plan/*.json` (lists of `{"n", "p", "phrase", "slug", "why"}`), checks every mark against the
chapter text (`apps/web/public/data/story/cNN.json`) and the codex (`lore-codex.json`), and writes
`apps/web/src/content/marks.json`: for each chapter id the marks `{p, phrase, slug, name, kind, tip}`.
The chapter text is never touched; a mark only names words that are already in a paragraph.

Rules: the words are in ONE piece of the paragraph (not across an italic), exactly as written, and
occur once in the paragraph; the entry exists and is not one of the ten Aspirants; at most 3 marks
in a chapter and 1 in a paragraph; the same entry at least 6 chapters apart and at most 3 times in the
book; the tip is the entry's short text.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WEB = ROOT / "apps" / "web"
CODEX = WEB / "public" / "data" / "library" / "lore-codex.json"
STORY = WEB / "public" / "data" / "story"
OUT = WEB / "src" / "content" / "marks.json"
ASPIRANTS = {
    "layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia",
}
MAX_PER_CHAPTER = 3
MIN_GAP = 6
MAX_PER_ENTRY = 3


def paragraph(n: int, p: int) -> list[dict] | None:
    f = STORY / f"c{n:02d}.json"
    if not f.exists():
        return None
    for b in json.loads(f.read_text(encoding="utf-8"))["blocks"]:
        if b.get("t") == "p" and b.get("i") == p:
            return b["segs"]
    return None


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    codex = json.loads(CODEX.read_text(encoding="utf-8"))
    entries = {e["slug"]: e for e in codex["entries"]}
    plans: list[dict] = []
    for f in sorted((HERE / "marks-plan").glob("*.json")):
        plans += json.loads(f.read_text(encoding="utf-8"))
    problems: list[str] = []
    by_chapter: dict[int, list[dict]] = defaultdict(list)
    by_entry: dict[str, list[int]] = defaultdict(list)
    seen_para: set[tuple[int, int]] = set()
    for m in plans:
        label = f"c{m.get('n')} p{m.get('p')} {m.get('phrase')!r}"
        e = entries.get(m.get("slug", ""))
        if not e:
            problems.append(f"{label}: no entry {m.get('slug')!r}")
            continue
        if m["slug"] in ASPIRANTS:
            problems.append(f"{label}: {m['slug']} is one of the ten")
        segs = paragraph(m["n"], m["p"])
        if segs is None:
            problems.append(f"{label}: no such paragraph")
            continue
        text = "".join(s["t"] for s in segs)
        if text.count(m["phrase"]) != 1:
            problems.append(f"{label}: the words occur {text.count(m['phrase'])} times in the paragraph")
        if not any(m["phrase"] in s["t"] for s in segs):
            problems.append(f"{label}: the words are not in one piece of the paragraph")
        if (m["n"], m["p"]) in seen_para:
            problems.append(f"{label}: two marks in one paragraph")
        seen_para.add((m["n"], m["p"]))
        if m["n"] < e["first"]:
            problems.append(f"{label}: {m['slug']} is first met in chapter {e['first']}")
        by_chapter[m["n"]].append(m)
        by_entry[m["slug"]].append(m["n"])
    for n, list_ in by_chapter.items():
        if len(list_) > MAX_PER_CHAPTER:
            problems.append(f"chapter {n}: {len(list_)} marks, at most {MAX_PER_CHAPTER}")
    for slug, chs in by_entry.items():
        chs.sort()
        if len(chs) > MAX_PER_ENTRY:
            problems.append(f"{slug}: {len(chs)} marks, at most {MAX_PER_ENTRY}")
        for a, b in zip(chs, chs[1:]):
            if b - a < MIN_GAP:
                problems.append(f"{slug}: marks in chapters {a} and {b}, less than {MIN_GAP} apart")
    print(f"{len(plans)} marks in {len(by_chapter)} chapters, {len(by_entry)} entries, {len(problems)} problems")
    for line in problems[:60]:
        print("problem:", line)
    if check_only or problems:
        return 1 if problems else 0
    out: dict[str, list[dict]] = {}
    for n in sorted(by_chapter):
        out[f"c{n:02d}"] = [
            {
                "p": m["p"],
                "phrase": m["phrase"],
                "slug": m["slug"],
                "name": entries[m["slug"]]["name"],
                "kind": entries[m["slug"]]["kind"],
                "tip": entries[m["slug"]]["short"],
            }
            for m in sorted(by_chapter[n], key=lambda m: m["p"])
        ]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
