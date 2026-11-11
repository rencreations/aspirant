"""Cut the registry into batches for the writers (stage 3 of the codex).

    python scripts/library/lore/codex/make_batches.py [--size 40] [--size-b 100]

Reads `merged.json` and `registry-A/B/C.json` and writes `writers-in/bNN.json`: for each batch a list
of entries with everything a writer needs (the facts of all members, the ties by name, the gear, where
the book explains the thing). The ten Aspirants are one batch each (`ten-<slug>.json`). A writer
answers with `writers/<batch>.json` (see `check_writers.py`).
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASPIRANTS = [
    "layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia",
]
ORDER = ["person", "creature", "group", "place", "event", "thing", "idea"]


def norm(s: str) -> str:
    s = s.lower().replace("’", "'")
    s = re.sub(r"^(the|a|an)\s+", "", s)
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=40)
    ap.add_argument("--size-b", type=int, default=100)
    args = ap.parse_args()

    merged = {m["id"]: m for m in json.loads((HERE / "merged.json").read_text(encoding="utf-8"))}
    registry: list[dict] = []
    for label in "ABC":
        for e in json.loads((HERE / f"registry-{label}.json").read_text(encoding="utf-8"))["entries"]:
            first = next((x for x in registry if x["slug"] == e["slug"]), None)
            if first:  # the same slug in two sets: one entry
                first["members"] += e["members"]
                first["aka"] = list(dict.fromkeys([*first.get("aka", []), *e.get("aka", [])]))
                if e["tier"] == "A":
                    first["tier"] = "A"
            else:
                registry.append(e)
    res = json.loads((HERE / "resolutions.json").read_text(encoding="utf-8")) if (HERE / "resolutions.json").exists() else {"merge": []}
    for m in res["merge"]:
        keep = next(e for e in registry if e["slug"] == m["keep"])
        for slug in m["drop"]:
            gone = next(e for e in registry if e["slug"] == slug)
            keep["members"] += gone["members"]
            keep["aka"] = list(dict.fromkeys([*keep.get("aka", []), gone["name"], *gone.get("aka", [])]))
            registry.remove(gone)
    names: dict[str, str] = {norm(e["name"]): e["name"] for e in registry}
    for e in registry:
        for a in e.get("aka", []):
            names.setdefault(norm(a), e["name"])

    def pack(e: dict) -> dict:
        facts: dict[tuple, dict] = {}
        explained: set[tuple] = set()
        ties: list[dict] = []
        gear: list[dict] = []
        for mid in e["members"]:
            m = merged[mid]
            for f in m["facts"]:
                facts[(f["n"], f["p"], f["t"])] = f
            for r in m["explained"]:
                ps = r["p"] if isinstance(r["p"], list) else [r["p"]]
                for p in ps:
                    explained.add((r["n"], p))
            for t in m["ties"]:
                target = names.get(norm(t["with"]))
                if target and target != e["name"]:
                    ties.append({"to": target, "type": t["type"], "n": t["n"], "t": t["t"]})
            gear += [{"name": g["name"], "n": g["n"], "t": g["t"]} for g in m["gear"]]
        fl = sorted(facts.values(), key=lambda f: (f["n"], f["p"]))
        return {
            "slug": e["slug"],
            "name": e["name"],
            "kind": e["kind"],
            "sub": e["sub"],
            "aka": e.get("aka", []),
            "tier": e["tier"],
            "first": min([f["n"] for f in fl] or [0]),
            "explained_at": [{"n": n, "p": p} for n, p in sorted(explained)][:6],
            "facts": [{"n": f["n"], "p": f["p"], "t": f["t"]} for f in fl],
            "ties": sorted(ties, key=lambda t: t["n"])[:40],
            "gear": gear[:30],
        }

    out = HERE / "writers-in"
    out.mkdir(exist_ok=True)
    for f in out.glob("*.json"):
        f.unlink()

    packed = {e["slug"]: pack(e) for e in registry}
    for slug in ASPIRANTS:
        if slug in packed:
            (out / f"ten-{slug}.json").write_text(
                json.dumps([packed[slug]], ensure_ascii=False, indent=1), encoding="utf-8"
            )
    rest = [p for s, p in packed.items() if s not in ASPIRANTS]
    rest.sort(key=lambda p: (p["tier"], ORDER.index(p["kind"]), p["name"].lower()))
    batches: list[list[dict]] = []
    for tier, size in (("A", args.size), ("B", args.size_b)):
        group = [p for p in rest if p["tier"] == tier]
        for i in range(0, len(group), size):
            batches.append(group[i : i + size])
    lines = []
    for i, b in enumerate(batches, 1):
        name = f"b{i:02d}"
        (out / f"{name}.json").write_text(json.dumps(b, ensure_ascii=False, indent=1), encoding="utf-8")
        words = sum(len(f["t"].split()) for p in b for f in p["facts"])
        lines.append(f"{name}: {len(b)} entries ({b[0]['tier']}), {b[0]['kind']} to {b[-1]['kind']}, {words} words of facts")
    (out / "INDEX.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"{len(ASPIRANTS)} Aspirant files, {len(batches)} batches, {len(packed)} entries")


if __name__ == "__main__":
    main()
