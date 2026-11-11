"""Candidate pictures for the codex entries that have none (read only; writes a scratch file).

A picture is a candidate for an entry when its own words (alt text, title, tags, place folders)
name the entry or one of its aliases. Two pools: the pictures of the Arts rooms (official only) and
the pictures the story pages already carry (a chapter's hero and its inserts, curated by hand
against the text). The result goes to D:/ren/aspirant-work/lore_pics/candidates.json for the
looking step. Nothing here decides what is shipped.

    C:/Users/muham/anaconda3/python.exe scripts/library/lore/codex/pictures_candidates.py
"""

from __future__ import annotations

import glob
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
DATA = REPO / "apps" / "web" / "public" / "data"
OUT = Path("D:/ren/aspirant-work/lore_pics")
OUT.mkdir(parents=True, exist_ok=True)

STOP = {
    "the", "a", "an", "of", "and", "in", "on", "at", "to", "for", "with", "from", "by", "her", "his",
    "its", "their", "day", "room", "door", "wall", "tree", "girl", "boy", "man", "woman", "one",
}


def norm(s: str) -> str:
    s = s.lower().replace("\u2019", "'")
    s = re.sub(r"'s\b", "", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def phrases(entry: dict) -> list[str]:
    out = []
    for n in [entry["name"], *entry.get("aka", [])]:
        p = norm(n)
        p = re.sub(r"^(the|a|an) ", "", p)
        if len(p) >= 5 and p not in STOP and len(p.split()) <= 5:
            out.append(p)
    return sorted(set(out), key=len, reverse=True)


def pool() -> list[dict]:
    items: list[dict] = []
    for room in ("scene", "game", "comic", "design", "others"):
        d = json.loads((DATA / "library" / f"arts-{room}.json").read_text(encoding="utf-8"))
        for it in d["items"]:
            if it.get("canon") != "official":
                continue
            text = " ".join([it.get("title", ""), it.get("alt", ""), " ".join(it.get("tags", [])), " ".join(it.get("places", []))])
            items.append({
                "src": "arts", "id": it["id"], "room": room, "title": it.get("title", ""), "alt": it.get("alt", ""),
                "key": it["img"]["f"].rsplit("/", 1)[0], "w": it["img"]["w"], "h": it["img"]["h"],
                "text": norm(text), "chars": it.get("chars", []),
            })
    for f in sorted(glob.glob(str(DATA / "story" / "c*.json"))):
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        n = d["number"]
        hero = d.get("hero")
        if hero and hero.get("kind") == "image":
            items.append({"src": "story", "id": f"{d['id']}-hero", "chapter": n, "alt": hero.get("alt", ""), "path": hero["src"],
                          "w": hero["w"], "h": hero["h"], "credit": hero.get("credit", ""), "text": norm(hero.get("alt", "")), "after": -1})
        last_p = -1
        for b in d.get("blocks", []):
            if b["t"] == "p":
                last_p = b["i"]
            elif b["t"] == "insert":
                raw = b.get("media") or {}
                ms = raw if isinstance(raw, list) else [raw]
                for j, m in enumerate(ms):
                    if not isinstance(m, dict):
                        continue
                    path = m.get("poster") if m.get("kind") == "clip" else m.get("src")
                    if not path or not m.get("alt"):
                        continue
                    items.append({"src": "story", "id": f"{d['id']}-p{last_p}-{j}", "chapter": n, "alt": m["alt"], "path": path,
                                  "w": m.get("w", 0), "h": m.get("h", 0), "credit": m.get("credit", ""), "text": norm(m["alt"]), "after": last_p,
                                  "kind": b.get("kind")})
    return items


def second_pass() -> None:
    """For the entries still without a picture: the pictures of the chapters where the entry appears
    (nearest to its facts first), and the arts pictures that name a significant word of its name."""
    codex = json.loads((DATA / "library" / "lore-codex.json").read_text(encoding="utf-8"))
    items = pool()
    story = [i for i in items if i["src"] == "story"]
    arts = [i for i in items if i["src"] == "arts"]
    out: dict[str, list[dict]] = {}
    for e in codex["entries"]:
        if e["media"] or e.get("character") or e["kind"] == "idea":
            continue
        chapters = {n for n in e["seen"] if n >= e["first"]}
        facts = defaultdict(list)
        for f in e["facts"]:
            facts[f["n"]].append(f["p"])
        got = []
        for it in story:
            if it["chapter"] not in chapters:
                continue
            ps = facts.get(it["chapter"], [])
            dist = min((abs(it["after"] - p) for p in ps), default=99)
            got.append((dist, {"id": it["id"], "src": "story", "hit": f"chapter {it['chapter']}"}))
        got.sort(key=lambda t: (t[0], t[1]["id"]))
        picks = [g for _, g in got[:8]]
        words = [w for w in norm(e["name"]).split() if len(w) >= 6 and w not in STOP]
        for it in arts:
            if len(picks) >= 12:
                break
            hit = next((w for w in words if re.search(rf"{re.escape(w)}", it["text"])), None)
            if hit:
                picks.append({"id": it["id"], "src": "arts", "hit": hit})
        if picks:
            out[e["slug"]] = picks
    (OUT / "candidates2.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("second pass: entries with candidates", len(out))


def main() -> None:
    if "--second" in sys.argv:
        second_pass()
        return
    codex = json.loads((DATA / "library" / "lore-codex.json").read_text(encoding="utf-8"))
    items = pool()
    print("pool:", len(items), "arts", sum(i["src"] == "arts" for i in items), "story", sum(i["src"] == "story" for i in items))
    cands: dict[str, list[dict]] = {}
    for e in codex["entries"]:
        if e["media"] or e.get("character"):
            continue
        ph = phrases(e)
        if not ph:
            continue
        found = []
        for it in items:
            hit = next((p for p in ph if re.search(rf"\b{re.escape(p)}\b", it["text"])), None)
            if not hit:
                continue
            if it["src"] == "story" and it["chapter"] < e["first"]:
                continue  # a picture of the book never comes before the entry first shows in it
            found.append({"id": it["id"], "src": it["src"], "hit": hit})
        if found:
            cands[e["slug"]] = found
    # Proximity: a picture set in the chapter right beside a paragraph the book uses for a fact of the entry.
    prox: dict[str, list[dict]] = {}
    story = [i for i in items if i["src"] == "story"]
    for e in codex["entries"]:
        if e["media"] or e.get("character") or e["slug"] in cands:
            continue
        got = []
        for f in e["facts"]:
            for it in story:
                if it["chapter"] == f["n"] and f["p"] - 1 <= it["after"] <= f["p"] + 2:
                    got.append({"id": it["id"], "src": "story", "hit": f"near c{f['n']} p{f['p']}"})
        if got:
            seen = set()
            prox[e["slug"]] = [g for g in got if not (g["id"] in seen or seen.add(g["id"]))]
    (OUT / "proximity.json").write_text(json.dumps(prox, ensure_ascii=False, indent=1), encoding="utf-8")
    print("entries with a proximity candidate only:", len(prox))
    (OUT / "candidates.json").write_text(json.dumps(cands, ensure_ascii=False, indent=1), encoding="utf-8")
    kinds = defaultdict(int)
    by_slug = {e["slug"]: e for e in codex["entries"]}
    for s in cands:
        kinds[by_slug[s]["kind"]] += 1
    print("entries with a candidate:", len(cands), dict(kinds), "of", sum(1 for e in codex["entries"] if not e["media"]))
    print("pictures used:", len({c["id"] for v in cands.values() for c in v}))


if __name__ == "__main__":
    main()
