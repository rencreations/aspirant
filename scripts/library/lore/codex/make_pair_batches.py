"""Cut the relationships that deserve prose into batches for the writers (stage 4 of the codex).

    python scripts/library/lore/codex/make_pair_batches.py [--size 20]

Reads the built `lore-codex.json` and writes `pairs-in/pNN.json`: the pairs of two people where one
is an Aspirant (and the other pairs of two people with three or more ties), each with the two
entries' summaries and every tie between them. A writer answers with `pairs/pNN.json`
(`{"a--b": ["paragraph", ...]}`; see `check_pairs.py`).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CODEX = ROOT / "apps" / "web" / "public" / "data" / "library" / "lore-codex.json"
TEN = {"layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=20)
    args = ap.parse_args()
    data = json.loads(CODEX.read_text(encoding="utf-8"))
    entries = {e["slug"]: e for e in data["entries"]}
    picked = []
    for p in data["pairs"]:
        a, b = entries[p["a"]], entries[p["b"]]
        if a["kind"] != "person" or b["kind"] != "person":
            continue
        ten = p["a"] in TEN or p["b"] in TEN
        if not (ten or len(p["ties"]) >= 3):
            continue
        picked.append((not ten, -len(p["ties"]), p))
    picked.sort(key=lambda x: (x[0], x[1], x[2]["slug"]))
    rows = []
    for _, _, p in picked:
        a, b = entries[p["a"]], entries[p["b"]]
        rows.append(
            {
                "slug": p["slug"],
                "a": {"slug": a["slug"], "name": a["name"], "sub": a["sub"], "summary": a["summary"]},
                "b": {"slug": b["slug"], "name": b["name"], "sub": b["sub"], "summary": b["summary"]},
                "ties": [
                    {
                        "n": t["n"],
                        "p": t["p"],
                        "kind": t["type"],
                        "who": "a to b" if t["dir"] == "out" else "b to a",
                        "t": t["t"],
                    }
                    for t in p["ties"]
                ],
            }
        )
    out = HERE / "pairs-in"
    out.mkdir(exist_ok=True)
    for f in out.glob("*.json"):
        f.unlink()
    names = []
    for i in range(0, len(rows), args.size):
        name = f"p{i // args.size + 1:02d}"
        (out / f"{name}.json").write_text(
            json.dumps(rows[i : i + args.size], ensure_ascii=False, indent=1), encoding="utf-8"
        )
        names.append(name)
    print(f"{len(rows)} pairs in {len(names)} batches: {', '.join(names)}")


if __name__ == "__main__":
    main()
