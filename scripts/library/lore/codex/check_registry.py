"""Check a registry file (the reviewers' decisions for one set) against its names list.

    python scripts/library/lore/codex/check_registry.py A

Every id of `names-A.tsv` must be in exactly one entry's `members` or in `dropped`; slugs must be
unique and well formed; kinds and tiers valid; the ten Aspirants keep their slugs.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KINDS = {"person", "creature", "thing", "place", "group", "idea", "event"}
DASH = re.compile("[–—]")
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
ASPIRANTS = {
    "layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia",
}


def problems(label: str) -> list[str]:
    out: list[str] = []
    rows = (HERE / f"names-{label}.tsv").read_text(encoding="utf-8").splitlines()[1:]
    cols = {r.split("\t")[0]: r.split("\t") for r in rows}
    ids = set(cols)
    data = json.loads((HERE / f"registry-{label}.json").read_text(encoding="utf-8"))
    used: dict[str, str] = {}
    slugs: set[str] = set()
    for e in data["entries"]:
        slug = e.get("slug", "")
        if not SLUG.match(slug):
            out.append(f"slug {slug!r} is not well formed")
        if slug in slugs:
            out.append(f"slug {slug!r} twice")
        slugs.add(slug)
        if e.get("kind") not in KINDS:
            out.append(f"{slug}: kind {e.get('kind')!r}")
        if e.get("tier") not in {"A", "B"}:
            out.append(f"{slug}: tier {e.get('tier')!r}")
        for key in ("name", "sub"):
            v = e.get(key)
            if not isinstance(v, str) or not v.strip():
                out.append(f"{slug}: empty {key}")
            elif DASH.search(v):
                out.append(f"{slug}: dash in {key}")
        for a in e.get("aka", []):
            if DASH.search(a):
                out.append(f"{slug}: dash in aka")
        if not e.get("members"):
            out.append(f"{slug}: no members")
        for m in e.get("members", []):
            if m not in ids:
                out.append(f"{slug}: member {m} is not in names-{label}.tsv")
            elif m in used:
                out.append(f"{m} is in {used[m]} and in {slug}")
            used[m] = slug
    for d in data.get("dropped", []):
        i = d.get("id")
        if i not in ids:
            out.append(f"dropped {i} is not in names-{label}.tsv")
        elif i in used:
            out.append(f"{i} is dropped and also in {used[i]}")
        else:
            used[i] = "(dropped)"
        if not d.get("why"):
            out.append(f"dropped {i}: no reason")
    for i in sorted(ids - set(used)):
        out.append(f"{i} ({cols[i][2]}) is neither an entry nor dropped")
    # The ten keep their slugs, in whichever set holds them.
    for i, row in cols.items():
        if row[-1] == "main" and used.get(i) not in ASPIRANTS:
            out.append(f"{i} ({row[2]}) is a main Aspirant but is in {used.get(i)!r}")
    return out


def main(argv: list[str]) -> int:
    bad = 0
    for label in argv:
        found = problems(label)
        for line in found:
            print(f"set {label}: {line}")
        data = json.loads((HERE / f"registry-{label}.json").read_text(encoding="utf-8"))
        print(
            f"set {label}: {len(data['entries'])} entries, {len(data.get('dropped', []))} dropped, "
            f"{len(found)} problems"
        )
        bad += len(found)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
