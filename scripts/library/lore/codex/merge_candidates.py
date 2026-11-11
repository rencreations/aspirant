"""Merge the candidate lists of the eight parts into one list of things (stage 2 of the codex).

    python scripts/library/lore/codex/merge_candidates.py

Reads `candidates/p*.json`. The first pass merges only what is certain: the same name (ignoring
case, a leading "the", punctuation) AND the same kind. The result is `merged.json`, one object per
merged thing with an id `m0001` and the union of what the parts said (seen, facts, explained, ties,
gear). It also writes `names-<set>.tsv` for the three registry sets, one line per merged thing, so a
reviewer can decide the real merges (`Professor Joe` with `Joe`), the final kinds, the slugs and
which things are dropped. The reviewers' answers are `registry-<set>.json` (see `build_registry.py`).
"""

from __future__ import annotations

import glob
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent

SETS = {
    "A": ("person", "creature", "group"),
    "B": ("place", "event"),
    "C": ("thing", "idea"),
}


def norm(s: str) -> str:
    s = s.lower().replace("’", "'")
    s = re.sub(r"^(the|a|an)\s+", "", s)
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load() -> list[dict]:
    items: list[dict] = []
    for f in sorted(glob.glob(str(HERE / "candidates" / "p*.json"))):
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        for t in d["things"]:
            t["part"] = d["part"]
            items.append(t)
    return items


def merge(items: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for t in items:
        groups[(norm(t["name"]), t["kind"])].append(t)
    out: list[dict] = []
    for (key, kind), members in sorted(groups.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        # The most used spelling of the name.
        names: dict[str, int] = defaultdict(int)
        for m in members:
            names[m["name"]] += 1
        name = max(names, key=lambda n: (names[n], -len(n)))
        aliases: list[str] = []
        for m in members:
            for a in [m["name"], *m.get("aliases", [])]:
                if a != name and a not in aliases:
                    aliases.append(a)
        subs = [m["sub"] for m in members]
        seen: dict[int, list[int]] = defaultdict(list)
        for m in members:
            for r in m.get("seen", []):
                for p in r["p"] if isinstance(r["p"], list) else [r["p"]]:
                    if p not in seen[r["n"]]:
                        seen[r["n"]].append(p)
        facts, explained, ties, gear = [], [], [], []
        for m in members:
            facts += m.get("facts", [])
            explained += m.get("explained", [])
            ties += m.get("ties", [])
            gear += m.get("gear", [])
        facts.sort(key=lambda f: (f["n"], f["p"]))
        out.append(
            {
                "id": "",
                "name": name,
                "kind": kind,
                "sub": subs[0],
                "subs": sorted(set(subs)),
                "aliases": aliases,
                "main": any(m.get("main") for m in members),
                "parts": sorted({m["part"] for m in members}),
                "seen": [{"n": n, "p": sorted(seen[n])} for n in sorted(seen)],
                "facts": facts,
                "explained": sorted(explained, key=lambda r: (r["n"], str(r["p"]))),
                "ties": ties,
                "gear": gear,
            }
        )
    for i, t in enumerate(out, 1):
        t["id"] = f"m{i:04d}"
    return out


def main() -> None:
    merged = merge(load())
    (HERE / "merged.json").write_text(
        json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    for label, kinds in SETS.items():
        lines = ["id\tkind\tname\taliases\tsub\tchapters\tfacts\tties\tmain"]
        for t in merged:
            if t["kind"] not in kinds:
                continue
            chs = [r["n"] for r in t["seen"]]
            span = f"{min(chs)}-{max(chs)} ({len(chs)})" if chs else ""
            lines.append(
                "\t".join(
                    [
                        t["id"],
                        t["kind"],
                        t["name"],
                        "; ".join(t["aliases"]),
                        "; ".join(t["subs"]),
                        span,
                        str(len(t["facts"])),
                        str(len(t["ties"])),
                        "main" if t["main"] else "",
                    ]
                )
            )
        (HERE / f"names-{label}.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"set {label}: {len(lines) - 1} things")
    print(f"{len(merged)} merged things from {len(load())} candidates")


if __name__ == "__main__":
    main()
