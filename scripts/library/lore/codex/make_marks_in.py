"""Write the list of entries the marks may use (stage 7 of the codex).

    python scripts/library/lore/codex/make_marks_in.py

Reads the built `lore-codex.json` and writes `marks-in.tsv`: `slug`, `name`, `kind`, other names, the
first chapter, where the book explains it (`chapter:paragraph`) and the tooltip text. The ten
Aspirants and ordinary human characters are left out (the story does not mark people); non-human
beings (androids, machines, minds, the Will, the Matrix) are kept.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CODEX = ROOT / "apps" / "web" / "public" / "data" / "library" / "lore-codex.json"
TEN = {"layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia"}
NONHUMAN = re.compile(r"android|\bai\b|ender|machine|\bmind\b|\bwill\b|matrix|droid|doll|robot|program|body|voice|drone", re.I)


def main() -> None:
    data = json.loads(CODEX.read_text(encoding="utf-8"))
    rows = ["slug\tname\tkind\tother names\tfirst\texplained_at\tshort"]
    kept = 0
    for e in data["entries"]:
        if e["slug"] in TEN:
            continue
        if e["kind"] == "person" and not NONHUMAN.search(e["sub"] + " " + e["name"]):
            continue
        expl = ",".join(f"{r['n']}:{r['p']}" for r in e["explained"][:3])
        rows.append(
            "\t".join(
                [e["slug"], e["name"], e["kind"], "; ".join(e["aka"][:5]), str(e["first"]), expl, e["short"]]
            )
        )
        kept += 1
    (HERE / "marks-in.tsv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(f"{kept} entries in marks-in.tsv")


if __name__ == "__main__":
    main()
