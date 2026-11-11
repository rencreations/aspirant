"""Build the lore codex data file from the registry, the merged candidates and the writers' texts.

    python scripts/library/lore/codex/build_codex.py [--check]

Inputs (all in this folder):
  merged.json            the merged candidates (`merge_candidates.py`)
  registry-A/B/C.json    which merged things are one entry, with names, slugs, tiers
  writers/*.json         the written texts: {slug: {line, short, summary, rows, weapons, sub?}}
  pairs/*.json           prose for the relationship pages: {"a--b": ["paragraph", ...]}
  official.json          optional: {slug: {atlas: id, person: slug}} to attach official passages

Output: apps/web/public/data/library/lore-codex.json (see features/library/lore/codex/types.ts).
With --check nothing is written; the problems are printed and the exit code says whether there are any.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "apps" / "web" / "public" / "data" / "library" / "lore-codex.json"
LORE = ROOT / "apps" / "web" / "public" / "data" / "library" / "lore.json"

KINDS = {"person", "creature", "thing", "place", "group", "idea", "event"}
DASH = re.compile("[–—]")
BANNED = re.compile(r"\bconviction\b|Terenia|Terinia|Terrenia|Seiresk|Windstorm Nest", re.I)
ASPIRANTS = [
    "layla", "fanny", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia",
]
# A tie written from the other side is turned round, so each tie is stored once.
SYMMETRIC = {"family", "partner", "friend", "ally", "rival", "enemy"}
SWAP = {"ward": "guardian", "student": "teacher", "creation": "maker"}
CANON_TYPES = {
    "family", "partner", "friend", "ally", "rival", "enemy", "guardian", "teacher", "maker",
    "leader", "serves", "member", "owns", "part", "lives", "found",
}


def norm(s: str) -> str:
    s = s.lower().replace("’", "'")
    s = re.sub(r"^(the|a|an)\s+", "", s)
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def clip(text: str, limit: int) -> str:
    """The text cut at a word end so that it fits `limit` characters (a full stop when it can)."""
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    stop = max(cut.rfind(". "), cut.rfind("; "), cut.rfind(", "))
    if stop > limit * 0.5:
        cut = cut[:stop]
    else:
        cut = cut[: cut.rfind(" ")] if " " in cut else cut
    return cut.rstrip(" ,;:") + "."


def load_json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def load_writers(folder: str) -> dict:
    out: dict = {}
    for f in sorted((HERE / folder).glob("*.json")):
        out.update(json.loads(f.read_text(encoding="utf-8")))
    return out


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    reg_dir = HERE
    for a in argv:
        if a.startswith("--registry-dir="):
            reg_dir = Path(a.split("=", 1)[1])
    problems: list[str] = []
    merged = {m["id"]: m for m in json.loads((HERE / "merged.json").read_text(encoding="utf-8"))}

    registry: list[dict] = []
    seen_slug: dict[str, str] = {}
    for label in "ABC":
        reg = load_json(reg_dir / f"registry-{label}.json", None)
        if reg is None:
            problems.append(f"registry-{label}.json is missing")
            continue
        for e in reg["entries"]:
            if e["slug"] in seen_slug:
                # The same slug in two sets is the same thing seen from two kinds: one entry.
                first = next(x for x in registry if x["slug"] == e["slug"])
                first["members"] += e["members"]
                first["aka"] = list(dict.fromkeys([*first.get("aka", []), *e.get("aka", [])]))
                if e["tier"] == "A":
                    first["tier"] = "A"
                print(f"note: {e['slug']} is in registry {seen_slug[e['slug']]} and {label}: merged")
                continue
            seen_slug[e["slug"]] = label
            registry.append(e)
    # Duplicates across the three sets that the reviewers flagged (`see_also`) and I settled.
    res = load_json(HERE / "resolutions.json", {"merge": []})
    for m in res["merge"]:
        keep = next((e for e in registry if e["slug"] == m["keep"]), None)
        if keep is None:
            problems.append(f"resolutions: no entry {m['keep']}")
            continue
        for slug in m["drop"]:
            gone = next((e for e in registry if e["slug"] == slug), None)
            if gone is None:
                problems.append(f"resolutions: no entry {slug}")
                continue
            keep["members"] += gone["members"]
            keep["aka"] = list(dict.fromkeys([*keep.get("aka", []), gone["name"], *gone.get("aka", [])]))
            registry.remove(gone)
    by_slug = {e["slug"]: e for e in registry}

    # Names and other names to slugs, for the `with` of a tie. An exact name wins over an alias.
    names: dict[str, str] = {}
    for e in registry:
        names[norm(e["name"])] = e["slug"]
    for e in sorted(registry, key=lambda e: -len(e["members"])):
        for a in e.get("aka", []):
            names.setdefault(norm(a), e["slug"])

    writers = load_writers("writers")
    pair_text = load_writers("pairs")
    official_map = load_json(HERE / "official.json", {})
    lore = json.loads(LORE.read_text(encoding="utf-8")) if LORE.exists() else {"atlas": [], "people": []}
    atlas = {a["id"]: a for a in lore.get("atlas", [])}
    people = {p["slug"]: p for p in lore.get("people", [])}

    # ---- the entries ------------------------------------------------------------------------
    entries: dict[str, dict] = {}
    ties: dict[tuple, dict] = {}
    unresolved: dict[str, int] = defaultdict(int)
    for e in registry:
        members = [merged[m] for m in e["members"] if m in merged]
        facts: dict[tuple, dict] = {}
        seen: set[int] = set()
        explained: dict[tuple, dict] = {}
        gear: dict[str, dict] = {}
        for m in members:
            for f in m["facts"]:
                facts[(f["n"], f["p"], f["t"])] = {"n": f["n"], "p": f["p"], "t": f["t"]}
            for r in m["seen"]:
                seen.add(r["n"])
            for r in m["explained"]:
                ps = r["p"] if isinstance(r["p"], list) else [r["p"]]
                for p in ps:
                    explained[(r["n"], p)] = {"n": r["n"], "p": p}
            for g in m["gear"]:
                gear.setdefault(norm(g["name"]), {"name": g["name"], "note": g["t"], "n": g["n"]})
            for t in m["ties"]:
                target = names.get(norm(t["with"]))
                if not target:
                    unresolved[t["with"]] += 1
                    continue
                if target == e["slug"]:
                    continue
                typ, a, b = t["type"], e["slug"], target
                if typ in SWAP:
                    typ, a, b = SWAP[typ], b, a
                if typ in SYMMETRIC and a > b:
                    a, b = b, a
                # A symmetric tie is one per chapter (both sides say it); the others one per paragraph.
                key = (a, typ, b, t["n"]) if typ in SYMMETRIC else (a, typ, b, t["n"], t["p"])
                if any(k[:3] == (a, typ, b) and v["t"] == t["t"] for k, v in ties.items()):
                    continue
                ties.setdefault(key, {"a": a, "type": typ, "b": b, "n": t["n"], "p": t["p"], "t": t["t"]})
        fact_list = sorted(facts.values(), key=lambda f: (f["n"], f["p"]))
        chapters = sorted(seen | {f["n"] for f in fact_list})
        if not fact_list:
            problems.append(f"{e['slug']}: no facts")
            continue
        entry = {
            "slug": e["slug"],
            "kind": e["kind"],
            "sub": e["sub"],
            "name": e["name"],
            "aka": [a for a in e.get("aka", []) if norm(a) != norm(e["name"])],
            "tier": e["tier"],
            "first": chapters[0] if chapters else 0,
            "last": fact_list[-1]["n"],
            "seen": chapters,
            "explained": sorted(explained.values(), key=lambda r: (r["n"], r["p"])),
            "facts": fact_list,
            "weapons": [],
            "rows": [],
            "rel": [],
            "media": [],
        }
        if e["slug"] in ASPIRANTS:
            entry["character"] = e["slug"]
        entries[e["slug"]] = entry
        if e["kind"] == "person" or gear:
            entry["weapons"] = [
                {"name": g["name"], "note": g["note"], "n": g["n"]}
                for g in sorted(gear.values(), key=lambda g: g["n"])
            ]

    # ---- the writers' texts, or the first facts when nobody has written them yet -------------
    for slug, entry in entries.items():
        w = writers.get(slug, {})
        first = entry["facts"][0]["t"]
        explained = next(
            (f["t"] for f in entry["facts"] for r in entry["explained"] if (f["n"], f["p"]) == (r["n"], r["p"])),
            first,
        )
        entry["line"] = w.get("line") or clip(first, 90)
        entry["short"] = w.get("short") or clip(explained, 150)
        entry["summary"] = w.get("summary") or " ".join(f["t"] for f in entry["facts"][:3])
        if w.get("sub"):
            entry["sub"] = w["sub"]
        if "rows" in w:
            # A row is shown from the chapter its facts reach (the latest chapter it rests on).
            entry["rows"] = [
                [r[0], r[1], r[2] if len(r) > 2 else entry["last"]] for r in w["rows"]
            ]
        if "weapons" in w:
            # The chapter a weapon first shows in (so a reader who has not reached it does not see it).
            gear_n = {norm(g["name"]): g["n"] for g in entry["weapons"] if "n" in g}
            first_n = entry["facts"][0]["n"]
            entry["weapons"] = [
                {"name": g["name"], "note": g["note"], "n": gear_n.get(norm(g["name"]), first_n)}
                for g in w["weapons"]
            ]
        entry["written"] = slug in writers

    # ---- the ties, both ways ------------------------------------------------------------------
    for t in sorted(ties.values(), key=lambda t: (t["n"], t["p"])):
        a, b = t["a"], t["b"]
        if a not in entries or b not in entries:
            continue
        entries[a]["rel"].append({"to": b, "type": t["type"], "dir": "out", "n": t["n"], "p": t["p"], "t": t["t"]})
        entries[b]["rel"].append({"to": a, "type": t["type"], "dir": "in", "n": t["n"], "p": t["p"], "t": t["t"]})
    pairs: dict[str, dict] = {}
    for t in ties.values():
        a, b = t["a"], t["b"]
        if a not in entries or b not in entries:
            continue
        lo, hi = sorted((a, b))
        slug = f"{lo}--{hi}"
        pair = pairs.setdefault(slug, {"slug": slug, "a": lo, "b": hi, "text": [], "ties": [], "chapters": []})
        pair["ties"].append(
            {"type": t["type"], "dir": "out" if a == lo else "in", "n": t["n"], "p": t["p"], "t": t["t"]}
        )
    for slug, pair in pairs.items():
        pair["ties"].sort(key=lambda t: (t["n"], t["p"]))
        pair["chapters"] = sorted({t["n"] for t in pair["ties"]})
        pair["text"] = pair_text.get(slug, [])

    # ---- official pictures and passages ---------------------------------------------------------
    for slug, entry in entries.items():
        m = official_map.get(slug, {})
        if slug in ASPIRANTS:
            entry["media"].append(
                {"src": f"/img/char/{slug}/splash-sm.webp", "alt": f"Official art of {entry['name']}.", "credit": "Official art"}
            )
            person = people.get(slug)
            if person:
                official = [[r[0], r[1], 0] for r in person["fields"]]
                have = {r[0].lower() for r in official}
                entry["rows"] = official + [r for r in entry["rows"] if r[0].lower() not in have]
        ids = [i for i in m.get("atlas", []) if i in atlas]
        for i in ids:
            a = atlas[i]
            entry["media"].append({"src": "lib:" + a["img"]["f"], "alt": f"{a['name']}, an official picture.", "credit": "Official art"})
        if ids:
            # The official passages, word for word, with the text they are taken from.
            a = atlas[ids[0]]
            titles = {t["id"]: t["title"] for t in lore.get("texts", [])}
            passages = [{"text": a["text"], "source": titles.get(a["from"], "The official texts")}]
            passages += [
                {"text": x["text"], "source": titles.get(x["from"], "The official texts")} for x in a.get("more", [])[:2]
            ]
            entry["official"] = passages

    # ---- checks ---------------------------------------------------------------------------------
    def text_ok(label: str, v: object, limit: int | None = None) -> None:
        if not isinstance(v, str) or not v.strip():
            problems.append(f"{label}: empty")
            return
        if DASH.search(v):
            problems.append(f"{label}: dash")
        if BANNED.search(v):
            problems.append(f"{label}: banned word")
        if limit and len(v) > limit:
            problems.append(f"{label}: {len(v)} characters, limit {limit}")

    for slug, e in entries.items():
        text_ok(f"{slug} line", e["line"], 110)
        text_ok(f"{slug} short", e["short"], 220)
        text_ok(f"{slug} summary", e["summary"], 900)
        for r in e["rows"]:
            text_ok(f"{slug} row", r[0], 40)
            text_ok(f"{slug} row {r[0]}", r[1], 240)
            if not isinstance(r[2], int):
                problems.append(f"{slug} row {r[0]}: no chapter")
        for w in e["weapons"]:
            text_ok(f"{slug} weapon", w["name"], 80)
            text_ok(f"{slug} weapon note", w["note"], 300)
    for slug, p in pairs.items():
        for para in p["text"]:
            text_ok(f"{slug} text", para, 1200)

    # A tooltip must not name something the reader has not met by the chapter it is shown in.
    spoilers: list[str] = []
    index = [(norm(e["name"]), e["first"], e["slug"]) for e in entries.values() if len(e["name"]) > 3]
    for slug, e in entries.items():
        shown_at = min([r["n"] for r in e["explained"]] or [e["first"]])
        shown_at = max(shown_at, e["first"])
        low = " " + norm(e["short"]) + " "
        for nm, first, other in index:
            if other != slug and first > shown_at and f" {nm} " in low:
                spoilers.append(f"{slug} (shown at chapter {shown_at}) names {other} (first met in chapter {first})")
    written = sum(1 for e in entries.values() if e["written"])
    for line in spoilers[:60]:
        print("warn:", line)
    if len(spoilers) > 60:
        print(f"warn: ... and {len(spoilers) - 60} more")
    print(f"{len(entries)} entries ({written} with written texts), {len(pairs)} pairs")
    if unresolved:
        top = sorted(unresolved.items(), key=lambda kv: -kv[1])[:25]
        print(f"{len(unresolved)} tie targets were not entries; the most common: {top}")
    for line in problems[:80]:
        print("problem:", line)
    if len(problems) > 80:
        print(f"... and {len(problems) - 80} more")
    if check_only or problems:
        return 1 if problems else 0

    for e in entries.values():
        e.pop("written", None)
    ordered = sorted(entries.values(), key=lambda e: (e["kind"] != "person", e["kind"], e["name"].lower()))
    out = {"v": 1, "entries": ordered, "pairs": sorted(pairs.values(), key=lambda p: p["slug"])}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
