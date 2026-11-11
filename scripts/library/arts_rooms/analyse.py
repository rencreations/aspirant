"""Read inventory.json and print the facts the Arts rooms depend on (duplicates, ratios, counts).

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/analyse.py
"""

from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

INV = common.WORK / "arts_rooms" / "inventory.json"


def ham(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


def main() -> None:
    recs = json.loads(INV.read_text(encoding="utf-8"))
    allr = [r for r in recs if r["root"] == "_all"]
    print("pictures:", len(recs), " in _all:", len(allr))

    print("\n== _all by category")
    cat = collections.Counter(r["cat"] for r in allr)
    for k, v in cat.most_common():
        print(f"  {k or '(root)'}: {v}")

    print("\n== _all by entity x category (files)")
    ent = collections.defaultdict(collections.Counter)
    for r in allr:
        ent[r["entity"]][r["cat"]] += 1
    for e, c in sorted(ent.items(), key=lambda kv: -sum(kv[1].values())):
        print(f"  {e}: {sum(c.values())}  " + ", ".join(f"{k}={v}" for k, v in c.most_common()))

    print("\n== exact duplicates (sha1) inside _all")
    by_sha = collections.defaultdict(list)
    for r in allr:
        by_sha[r["sha1"]].append(r)
    dup = {k: v for k, v in by_sha.items() if len(v) > 1}
    print("  unique files:", len(by_sha), " groups with copies:", len(dup), " extra copies:", sum(len(v) - 1 for v in dup.values()))
    for k, v in list(dup.items())[:12]:
        print("   ", [x["rel"].replace("_all/", "") for x in v])

    print("\n== _all picture also found outside _all (same bytes)")
    outside = collections.defaultdict(list)
    for r in recs:
        if r["root"] != "_all":
            outside[r["sha1"]].append(r["rel"])
    hit = sum(1 for h in by_sha if h in outside)
    print("  unique _all files that also exist under another media folder:", hit)

    print("\n== near duplicates (dhash distance <= 4) among unique _all files, same category")
    uniq = [v[0] for v in by_sha.values()]
    near = 0
    seen = set()
    groups = []
    for i, a in enumerate(uniq):
        if i in seen:
            continue
        grp = [a]
        for j in range(i + 1, len(uniq)):
            if j in seen:
                continue
            b = uniq[j]
            if a["cat"] == b["cat"] and ham(a["dhash"], b["dhash"]) <= 4:
                grp.append(b)
                seen.add(j)
        if len(grp) > 1:
            groups.append(grp)
            near += len(grp) - 1
    print("  near duplicate groups:", len(groups), " extra pictures:", near)
    for g in groups[:10]:
        print("   ", [x["rel"].replace("_all/", "") for x in g])

    print("\n== aspect ratios by category (unique files), w/h buckets")
    def bucket(r):
        a = r["w"] / r["h"]
        if a >= 3: return ">=3 (ultra wide)"
        if a >= 1.9: return "1.9-3 (wide)"
        if a >= 1.6: return "1.6-1.9 (16:9)"
        if a >= 1.2: return "1.2-1.6"
        if a >= 0.85: return "0.85-1.2 (square)"
        if a >= 0.5: return "0.5-0.85 (portrait)"
        if a >= 0.25: return "0.25-0.5 (tall)"
        return "<0.25 (ultra tall)"
    cats = collections.defaultdict(collections.Counter)
    for r in uniq:
        cats[r["cat"]][bucket(r)] += 1
    for c, b in cats.items():
        print(f"  {c}: " + ", ".join(f"{k}={v}" for k, v in sorted(b.items())))

    print("\n== resolution of splash-art files (unique)")
    for r in sorted((x for x in uniq if x["cat"] == "splash-art"), key=lambda x: (x["entity"], x["rel"])):
        print(f"  {r['entity']:12s} {r['w']}x{r['h']}  {r['w']/r['h']:.2f}  {r['bytes']//1024}KB  {Path(r['rel']).name}")

    print("\n== bars (letterbox) in films files: files with bars >= 4 px on a side")
    f = [r for r in uniq if r["cat"] == "films"]
    withbars = [r for r in f if max(r["bars"].values()) >= 4]
    print("  films:", len(f), " with bars:", len(withbars))
    sizes = collections.Counter((r["w"], r["h"]) for r in f)
    print("  most common sizes:", sizes.most_common(8))
    bc = collections.Counter(tuple(sorted(r["bars"].items())) for r in withbars)
    print("  bar shapes:", bc.most_common(6))

    print("\n== comic files: sizes")
    cm = [r for r in uniq if r["cat"] == "comic"]
    print("  count:", len(cm))
    for r in sorted(cm, key=lambda x: x["w"] / x["h"])[:8] + sorted(cm, key=lambda x: -x["w"] / x["h"])[:8]:
        print(f"   {r['w']}x{r['h']} ({r['w']/r['h']:.2f}) {r['rel'].replace('_all/', '')}")
    subs = collections.Counter((r["entity"], r["sub"]) for r in cm)
    print("  comic subfolders:", subs.most_common(10))

    print("\n== non _all roots: image counts by root/category")
    oc = collections.Counter((r["root"], r["cat"]) for r in recs if r["root"] != "_all")
    for k, v in sorted(oc.items()):
        print(f"  {k}: {v}")

    print("\n== names with 'Copy' / 'ChatGPT' / 'Screenshot' in _all by category")
    for key in ("Copy", "ChatGPT", "Screenshot", "Screen Shot"):
        c = collections.Counter(r["cat"] for r in allr if key in r["rel"])
        print(" ", key, dict(c))


if __name__ == "__main__":
    main()
