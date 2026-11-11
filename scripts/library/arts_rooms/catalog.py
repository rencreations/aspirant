"""The shared view of the source pictures for the Arts rooms: dedupe, classify, name.

Every room script starts here:

    import catalog
    groups = catalog.groups()              # one Group per different picture
    scene = [g for g in groups if g.room == "scene"]

A Group is one picture. The same file sits in several entity folders of `_all`, so a Group has
every place it was found (`places`) and every source file (`members`). `room` is the room its
folders suggest (the highest priority one when a picture sits in two). The room scripts may
change it after looking at the picture, and say why in their report.

Run `python catalog.py` for a summary. Reads D:\\ren\\aspirant-work\\arts_rooms\\inventory.json,
made by `inventory.py` (run that first).
"""

from __future__ import annotations

import collections
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

INV = common.WORK / "arts_rooms" / "inventory.json"

# `_all/<entity>/<category>` -> room. A category that is not listed goes to Others.
ROOM_OF_CAT = {
    "splash-art": "splash",
    "films": "scene",
    "comic": "comic",
    "game": "game",
    "in-game-animation": "game",
    "design": "design",
    "art": "others",
    "chibi": "others",
    "poster": "others",
    "posters": "others",
}
# When one picture sits in two categories the first room here wins.
ROOM_PRIORITY = ["splash", "design", "comic", "game", "scene", "others"]

# Entity folder of `_all` -> the Aspirants it is about (character slugs of the site).
CHARS_OF_ENTITY = {
    "fanny": ["fanny"], "layla": ["layla"], "ruby": ["ruby"], "angela": ["angela"],
    "lesley": ["lesley"], "change": ["change"], "guinevere": ["guinevere"], "vexana": ["vexana"],
    "obsidia": ["obsidia"], "selena": ["selena"],
    "vexana-black-hair": ["vexana"], "vexana-room": ["vexana"],
    "guinevere-father": ["guinevere"], "guinevere-room": ["guinevere"],
    "obsidia-attack": ["obsidia"], "obsidia-mecha": ["obsidia"],
    "selena-mecha": ["selena"], "selena-school": ["selena"],
    "lesley-weapon": ["lesley"], "change-weapon": ["change"], "change-parents": ["change"],
    "angela-training-ground": ["angela"], "ruby-father": ["ruby"],
    "layla-fanny-weapon": ["layla", "fanny"],
}

# First names for the filter and the credit line, spelled as canon (docs/design/canon-rules.md).
# The Scene helper checks them against the lore codex and may refine them in its own script.
ENTITY_NAMES = {
    "ai-droids": "AI Droids", "android": "Androids", "angela": "Angela",
    "angela-training-ground": "Angela's Training Ground", "change": "Chang'e",
    "change-parents": "Chang'e's Parents", "change-weapon": "Chang'e's Weapon", "drones": "Drones",
    "ender": "Enders", "eternal-guard": "Eternal Guards", "fanny": "Fanny", "far-away": "Far Away",
    "guinevere": "Guinevere", "guinevere-father": "Guinevere's Father",
    "guinevere-room": "Guinevere's Room", "layla": "Layla",
    "layla-fanny-weapon": "Layla and Fanny's Weapons", "lesley": "Lesley",
    "lesley-weapon": "Lesley's Weapon", "mother-matrix": "Mother Matrix",
    "mother-matrix-attack": "Mother Matrix Attack", "mr-bunny": "Mr. Bunny", "obsidia": "Obsidia",
    "obsidia-attack": "Obsidia's Attack", "obsidia-mecha": "Obsidia's Mecha", "oro": "Oro",
    "oro-attack": "Oro Attack", "oro-laboratory": "Oro Laboratory", "oro-ship": "Oro Ship",
    "oro-soldier": "Oro Soldiers", "oro-training-droids": "Oro Training Droids", "others": "Others",
    "professor-joe": "Professor Joe", "research-base": "Research Base", "roger": "Roger",
    "ruby": "Ruby", "ruby-father": "Ruby's Father", "selena": "Selena",
    "selena-mecha": "Selena's Mecha", "selena-school": "Selena at School",
    "selrick-academy": "Selrick Academy", "selrick-student": "Selrick Students",
    "selrick-training-ground": "Selrick Training Ground", "silverbolt": "Silverbolt",
    "singularity": "Singularity", "storm-citadel": "Storm Citadel", "terrinia": "Terrinia",
    "terrinia-attack-1": "Terrinia Attack, Part 1", "terrinia-attack-2": "Terrinia Attack, Part 2",
    "the-council": "The Council", "the-garden": "The Garden", "vexana": "Vexana",
    "vexana-black-hair": "Vexana, Black Hair", "vexana-room": "Vexana's Room",
}

PAIR_OF_CHAR = {
    "fanny": "fanny-layla", "layla": "fanny-layla", "ruby": "ruby-angela", "angela": "ruby-angela",
    "lesley": "lesley-change", "change": "lesley-change", "guinevere": "guinevere-vexana",
    "vexana": "guinevere-vexana", "selena": "selena-obsidia", "obsidia": "selena-obsidia",
}


@dataclass
class Group:
    """One different picture. `members` are the source records, best first."""

    sha1: str
    members: list[dict]
    room: str
    places: list[str] = field(default_factory=list)  # entity folders, most common first, stable
    cats: list[str] = field(default_factory=list)  # source categories

    @property
    def main(self) -> dict:
        return self.members[0]

    @property
    def abs_path(self) -> Path:
        return common.MEDIA / self.main["rel"]

    @property
    def w(self) -> int:
        return self.main["w"]

    @property
    def h(self) -> int:
        return self.main["h"]

    @property
    def ratio(self) -> float:
        return self.w / self.h

    @property
    def chars(self) -> list[str]:
        out: list[str] = []
        for p in self.places:
            for c in CHARS_OF_ENTITY.get(p, []):
                if c not in out:
                    out.append(c)
        return out

    @property
    def pair(self) -> str | None:
        cs = self.chars
        if not cs:
            return None
        pairs = {PAIR_OF_CHAR[c] for c in cs}
        return pairs.pop() if len(pairs) == 1 else None

    @property
    def maybe_generated(self) -> bool:
        """A cheap flag only: the file name or size of the usual image generators. Look at the picture."""
        name = Path(self.main["rel"]).name
        if any(re.search(r"ChatGPT|Gemini|Midjourney|DALL", m["rel"], re.I) for m in self.members):
            return True
        return (self.w, self.h) in {(1254, 1254), (1122, 1402), (1930, 815), (1024, 1024), (1536, 1024)} and name.endswith(".png")

    @property
    def id_hint(self) -> str:
        return self.sha1[:10]

    @property
    def name_hint(self) -> str:
        """A readable name from the best file name, or '' when it is a screenshot name."""
        stem = Path(self.main["rel"]).stem
        stem = re.sub(r"\s*-\s*Copy(\s*\(\d+\))?$", "", stem, flags=re.I)
        if re.match(r"(Screenshot|ChatGPT Image|Screen Shot)", stem, re.I):
            return ""
        return re.sub(r"[-_]+", " ", stem).strip()


def load() -> list[dict]:
    if not INV.exists():
        raise SystemExit(f"{INV} is missing: run inventory.py first")
    return json.loads(INV.read_text(encoding="utf-8"))


def _rank(rec: dict) -> tuple:
    """Best member first: a name that says what it is, then no ' - Copy', then the shorter path."""
    name = Path(rec["rel"]).name
    screenshot = bool(re.match(r"(Screenshot|ChatGPT Image|Screen Shot)", name, re.I))
    copy = " - Copy" in name
    return (screenshot, copy, len(rec["rel"]), rec["rel"])


def groups(root: str = "_all") -> list[Group]:
    """Different pictures of one source root (default `_all`), deduped by content hash."""
    recs = [r for r in load() if r["root"] == root and "error" not in r]
    by: dict[str, list[dict]] = collections.defaultdict(list)
    for r in recs:
        by[r["sha1"]].append(r)
    out: list[Group] = []
    for sha, members in by.items():
        members.sort(key=_rank)
        rooms = {ROOM_OF_CAT.get(m["cat"], "others") for m in members}
        room = next(r for r in ROOM_PRIORITY if r in rooms)
        count = collections.Counter(m["entity"] for m in members if m["entity"])
        # Most common first; ties by the entity's own total so the stable order is the same on every run.
        places = sorted(count, key=lambda e: (-count[e], e))
        cats = sorted({m["cat"] for m in members})
        out.append(Group(sha, members, room, places, cats))
    out.sort(key=lambda g: (g.room, g.main["rel"]))
    return out


def ham(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


def near_groups(items: list[Group], max_dist: int = 4) -> list[list[Group]]:
    """Groups of pictures that look the same (difference hash within `max_dist` bits) and have the same
    pixel size: re-taken screenshots. Look at them before dropping any, frames of one scene can differ."""
    seen: set[int] = set()
    out: list[list[Group]] = []
    for i, a in enumerate(items):
        if i in seen:
            continue
        grp = [a]
        for j in range(i + 1, len(items)):
            b = items[j]
            if j in seen or (a.w, a.h) != (b.w, b.h):
                continue
            if ham(a.main["dhash"], b.main["dhash"]) <= max_dist:
                grp.append(b)
                seen.add(j)
        if len(grp) > 1:
            out.append(grp)
    return out


def place_counts(items: list[Group]) -> collections.Counter:
    """How many different pictures each entity folder holds (a picture counts once in every folder it sat in)."""
    c: collections.Counter = collections.Counter()
    for g in items:
        for p in g.places:
            c[p] += 1
    return c


def main() -> None:
    gs = groups()
    print(f"{len(gs)} different pictures in _all")
    for room in ROOM_PRIORITY:
        sub = [g for g in gs if g.room == room]
        gen = sum(g.maybe_generated for g in sub)
        print(f"  {room}: {len(sub)}  (maybe generated: {gen})")
    scene = [g for g in gs if g.room == "scene"]
    print("scene filter, top 20:", place_counts(scene).most_common(20))
    print("near duplicates in scene:", len(near_groups(scene)))


if __name__ == "__main__":
    main()
