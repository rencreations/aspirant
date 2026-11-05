"""Builds the lore room: apps/web/public/data/library/lore.json and the atlas pictures.

    C:/Users/muham/anaconda3/python.exe scripts/library/lore/build.py

Source (read only): D:\\ren\\aspirant\\story\\official (28 texts) and media/_others/places and
media/_others/character (24 pictures). Pictures go to the mirror under library/v1/lore/atlas/<id>/
(thumb, preview, full WebP, alpha kept, never upscaled). The data file is
    {v, slug, items (a light index for search), texts (with blocks), atlas, people}.
See scripts/library/README.md for the pipeline contract and fixes.py for every correction made to the
source wording.
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
from fixes import apply_fixes  # noqa: E402
from parse import (  # noqa: E402
    SLUG_OF,
    block_text,
    parse_archives,
    parse_characters,
    parse_generic,
    parse_places,
    parse_relationship,
    parse_video_decs,
    section_paragraphs,
)

OFFICIAL = common.STORY / "official"
PLACES_DIR = common.MEDIA / "_others" / "places"
CHAR_DIR = common.MEDIA / "_others" / "character"

# ---------------------------------------------------------------------------------------------
# The texts. Order here is the order of the library (World, Characters, Stories, Videos).
# `rank` is "older" for the two oldest texts (they rank lowest). `also` names the profile that
# holds the same story, so the reader can say so.
# ---------------------------------------------------------------------------------------------

T = dict  # readability

TEXTS: list[dict] = [
    # World
    T(stem="universe", title="Universe A5-01", group="world",
      summary="How the universe began, how its will called Balance keeps the galaxies in check, and how Planet Dawnbreak and Planet Oro were born."),
    T(stem="settings", title="Settings", group="world",
      summary="The Academy, the Council, the Training Field, the Energy System, the Laboratory and the Garden, each in a few lines."),
    T(stem="places", title="Places", group="world", parser="places",
      summary="A short guide to the Storm Citadel, Terrinia, Selrick Academy and the Aspirants, under the motto of the blade that severs despair."),
    T(stem="entity", title="Entities", group="world",
      summary="The Androids, the Enders, Joe, Ruby's father, the droids, the trainee divisions, Oro's soldiers and Tetra, in a line or two each."),
    T(stem="selrick-archives", title="Selrick Archives", group="world", parser="archives",
      summary="A relationship chart, the files on Obsidia and Selena, and the battle report of the Singularity Crisis."),
    T(stem="day-of-enders", title="Day of Enders", group="world",
      summary="On a stormy night under the thunderclouds, Selena meets Obsidia and answers her with a declaration of war."),
    # Characters
    T(stem="characters", title="The Ten Aspirants", group="characters", parser="characters",
      summary="A card for each of the ten, with role, status, personality and a short profile."),
    T(stem="relationship", title="Relationships", group="characters", parser="relationship",
      summary="What each of the ten is to the others, with a profile of each and notes on Ruby's father, Chang'e's parents and Guinevere's father."),
    T(stem="fanny", title="Fanny", group="characters",
      summary="Fanny's profile, how a military family trained her to fight the Enders, and a squad archive of a battle and a late arrival with Layla."),
    T(stem="layla", title="Layla", group="characters",
      summary="Layla's profile, the secret hours of practice behind her proud face, and a squad archive of a battle and a late arrival with Fanny."),
    T(stem="ruby", title="Ruby", group="characters",
      summary="Ruby's profile, her story Teardrops, and a squad archive of the escape from Planet Oro with Angela."),
    T(stem="angela", title="Angela", group="characters",
      summary="Angela's profile, her story A Miracle, and a squad archive of the escape from Planet Oro with Ruby."),
    T(stem="selena", title="Selena: A Storm Born of Rebellion", group="characters",
      summary="Selena's earliest memory, her double life as a student and an Ender, and the night she turns on Obsidia's recall."),
    T(stem="obsidia", title="Obsidia: The Desire for a Different Ending", group="characters",
      summary="The first Ender to awaken, her experiment with Selena, and the ending she wants to see."),
    # Stories
    T(stem="the-lonely-champion", title="The Lonely Champion", group="stories", also="layla",
      summary="Layla, proud and secretly working hard, longs for friends until a transfer student takes first place."),
    T(stem="defending-an-undefeated-record", title="Defending an Undefeated Record", group="stories", also="fanny",
      summary="Fanny trains from childhood, enters Selrick Academy as a transfer student and beats the record Layla set."),
    T(stem="we-believe", title="We Believe!", group="stories",
      summary="The Enders fall from the sky, Selrick Academy is founded, and Layla and Fanny set out to fight them."),
    T(stem="teardrops", title="Teardrops", group="stories", also="ruby",
      summary="Ruby, kept under her father's shadow, creates the android Angela and resolves to follow her to Planet Dawnbreak."),
    T(stem="a-miracle", title="A Miracle", group="stories", also="angela",
      summary="Angela, shut away on Planet Oro, is sent to Planet Dawnbreak, is taken over by the Decisionmakers, and is reached by Ruby."),
    T(stem="awakening", title="Awakening", group="stories",
      summary="Planet Oro's android force lands on Planet Dawnbreak under Angela, and Ruby comes to wake her."),
    T(stem="shattered-light", title="Shattered Light", group="stories",
      summary="Lesley relives the day she lost Chang'e, and wakes to find that the Enders have returned."),
    T(stem="rekindled-light", title="Rekindled Light", group="stories",
      summary="Lesley captures a core component from the Enders, and Chang'e is left to finish her parents' work."),
    T(stem="vexana-and-guinevere", title="From Hope Comes Miracles", group="stories",
      summary="Two monologues from inside the black hole: Vexana on Side A, Guinevere on Side B."),
    T(stem="aspirant-backstory", title="A Tale of War, Loss, and Hope", group="stories", rank="older",
      summary="The war between Planet Oro and the Enders, and the long story of Lesley and Chang'e, from loss to the founding of Selrick Academy."),
    T(stem="renewed-hope", title="Lesley: The Scars of the Past", group="stories", rank="older",
      summary="Lesley's nightmares of the day Chang'e turned from her, the years of silence, and the night the Enders return."),
    # Videos
    T(stem="video-official-decs", title="Official Film Descriptions", group="videos", parser="videos",
      summary="The official descriptions of five films: Re:Link, Connection Lost, Rekindled Light, Awakening and We Believe!"),
    T(stem="connection-lost", title="Connection Lost", group="videos",
      summary="Vexana, disguised as an Ender, attacks the Academy, while Guinevere believes she never betrayed them."),
    T(stem="relink", title="Re:Link", group="videos",
      summary="The Mother Matrix descends on Planet Dawnbreak, and Vexana and Guinevere charge it together."),
]

# ---------------------------------------------------------------------------------------------
# The atlas. Passages are taken word for word from the cleaned texts: (text stem, heading).
# `layer` says which text the picture belongs with: worlds (universe), notes (places), settings, figures (entity).
# ---------------------------------------------------------------------------------------------

PLACES = [
    dict(id="universe", name="Universe A5-01", layer="worlds", file="universe.jpg",
         src=[("universe", "Universe's Origin"), ("universe", "Will of the Cosmos")],
         rx=r"Universe A5-01|\bA5-01\b"),
    dict(id="planet-dawnbreak", name="Planet Dawnbreak", layer="worlds", file="planet-dawnbreak.jpg",
         src=[("universe", "Planet Dawnbreak")], rx=r"Dawnbreak"),
    dict(id="planet-oro", name="Planet Oro", layer="worlds", file="planet-oro.jpg",
         src=[("universe", "Planet Oro")], rx=r"\bOro\b"),
    dict(id="storm-citadel", name="Storm Citadel", layer="notes", file="storm-citadel.png",
         src=[("places", "Storm Citadel")], rx=r"Storm Citadel"),
    dict(id="terrinia", name="Terrinia", layer="notes", file="terrinia.png",
         src=[("places", "Terrinia")], rx=r"Terrinia"),
    dict(id="selrick-academy", name="Selrick Academy", layer="notes", file="selrick-academy.jpg",
         src=[("settings", "Selrick Academy"), ("places", "Selrick Academy")], rx=r"Selrick Academy|\bAcademy\b"),
    dict(id="selrick-academy-barrier", name="Selrick Academy, barrier view from above", layer="notes",
         file="selrick-academy-barrier-view-from-above.png",
         src=[("settings", "Selrick Academy"), ("places", "Selrick Academy")], rx=r"Selrick Academy|\bAcademy\b"),
    dict(id="selrick-academy-cloudy", name="Selrick Academy, cloudy", layer="notes", file="selrick-academy-cloudy.png",
         src=[("settings", "Selrick Academy"), ("places", "Selrick Academy")], rx=r"Selrick Academy|\bAcademy\b"),
    dict(id="aspirants", name="The Aspirants", layer="notes", file="aspirants.png",
         src=[("places", "Aspirants")], rx=r"\bAspirants?\b"),
    dict(id="the-council", name="The Council", layer="settings", file="the-council.png",
         src=[("settings", "The Council")], rx=r"\b[Cc]ouncil\b"),
    dict(id="training-field", name="Training Field", layer="settings", file="training-fields.png",
         src=[("settings", "Training Field")], rx=r"Training Fields?"),
    dict(id="energy-system", name="Energy System", layer="settings", file="energy-system.png",
         src=[("settings", "Energy System")], rx=r"Energy System|Defensive Bubble"),
    dict(id="laboratory", name="Laboratory", layer="settings", file="laboratory.png",
         src=[("settings", "Laboratory")], rx=r"\b[Ll]aboratory\b"),
    dict(id="the-garden", name="The Garden", layer="settings", file="the-garden.png",
         src=[("settings", "The Garden")], rx=r"The Garden"),
]

ENTITIES = [
    dict(id="androids", name="Androids", file="androids.png", src=[("entity", "Androids")], rx=r"\b[Aa]ndroids?\b"),
    dict(id="the-enders", name="The Enders", file="the-enders.png", src=[("entity", "The Enders")], rx=r"\bEnders?\b"),
    dict(id="joe", name="Joe", file="joe.jpg", src=[("entity", "Joe")], rx=r"\bJoe\b"),
    dict(id="rubys-father", name="Ruby's Father", file="rubyfather.png",
         src=[("entity", "Ruby's Father"), ("relationship", "Ruby's Father")], rx=r"Ruby's [Ff]ather|Her Father"),
    dict(id="ai-droids", name="AI Droids", file="ai-droids.png", src=[("entity", "AI Droids")], rx=r"AI Droids"),
    dict(id="support-division-trainee", name="Support Division Trainee", file="support-division.png",
         src=[("entity", "Support Division Trainee")], rx=r"Support Division"),
    dict(id="combat-division-trainee", name="Combat Division Trainee", file="combat-division-trainee.png",
         src=[("entity", "Combat Division Trainee")], rx=r"Combat Division"),
    dict(id="training-droids", name="Training Droids", file="training-droids.png",
         src=[("entity", "Training Droids")], rx=r"Training Droids"),
    dict(id="soldier-of-planet-oro", name="Soldier of Planet Oro", file="soldiers-of-planet-oro.png",
         src=[("entity", "Soldier of Planet Oro")], rx=r"Soldiers? of Planet Oro"),
    dict(id="tetra", name="Tetra", file="tetra.png", src=[("entity", "Tetra")], rx=r"\bTetra\b"),
]

LAYERS = {
    "worlds": "Universe and worlds",
    "notes": "Place notes",
    "settings": "Settings",
    "figures": "Entities",
}

CHAR_RX = {
    "fanny": r"\bFanny\b",
    "layla": r"\bLayla\b",
    "ruby": r"\bRuby\b",
    "angela": r"\bAngela\b",
    "lesley": r"\bLesley\b",
    "change": r"Chang'e",
    "guinevere": r"\bGuinevere\b",
    "vexana": r"\bVexana\b",
    "obsidia": r"\bObsidia\b",
    "selena": r"\bSelena\b",
}
ROSTER = list(CHAR_RX)

PARSERS = {
    "places": parse_places,
    "videos": parse_video_decs,
    "archives": parse_archives,
}


# ---------------------------------------------------------------------------------------------


def load_text(stem: str, fixlog: list[str]) -> str:
    raw = (OFFICIAL / f"{stem}.md").read_text(encoding="utf-8-sig")
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text, log = apply_fixes(f"{stem}.md", text)
    fixlog.extend(log)
    return text


def full_text(title: str, blocks: list[dict]) -> str:
    return "\n".join([title, *[block_text(b) for b in blocks]])


def main() -> None:
    fixlog: list[str] = []
    parsed: dict[str, dict] = {}
    people_chars: dict[str, dict] = {}
    people_rel: dict[str, dict] = {}

    for cfg in TEXTS:
        stem = cfg["stem"]
        text = load_text(stem, fixlog)
        kind = cfg.get("parser", "generic")
        if kind == "characters":
            _, blocks, people_chars = parse_characters(text)
        elif kind == "relationship":
            _, blocks, people_rel = parse_relationship(text)
        elif kind in PARSERS:
            _, blocks = PARSERS[kind](text)
        else:
            _, blocks = parse_generic(text)
        parsed[stem] = {"cfg": cfg, "blocks": blocks, "src": text}

    # The profile facts (age, interest) that the four profile files carry.
    profile_facts: dict[str, list[list[str]]] = {}
    for stem in ("ruby", "angela", "fanny", "layla"):
        first = parsed[stem]["blocks"][0]
        assert first["t"] == "kv", stem
        profile_facts[stem] = first["rows"]

    # ---- texts
    texts: list[dict] = []
    for cfg in TEXTS:
        stem = cfg["stem"]
        blocks = parsed[stem]["blocks"]
        title = cfg["title"]
        body = full_text(title, blocks)
        words = len(re.findall(r"\w+", body))
        counts = {s: len(re.findall(rx, body)) for s, rx in CHAR_RX.items()}
        chars = [s for s in sorted(ROSTER, key=lambda s: (-counts[s], ROSTER.index(s))) if counts[s]]
        t = {
            "id": f"lore-{stem}",
            "title": common.clean_text(title),
            "group": cfg["group"],
            "summary": common.clean_text(cfg["summary"]),
            "blocks": blocks,
            "minutes": max(1, round(words / 220)),
            "words": words,
            "chars": chars,
            "rank": cfg.get("rank", "official"),
        }
        if cfg.get("also"):
            t["also"] = f"lore-{cfg['also']}"
        texts.append(t)
    by_stem = {c["stem"]: t for c, t in zip(TEXTS, texts)}

    # ---- atlas
    atlas: list[dict] = []
    img_bytes = 0
    for kind, rows in (("place", PLACES), ("entity", ENTITIES)):
        for cfg in rows:
            src_dir = PLACES_DIR if kind == "place" else CHAR_DIR
            src_file = src_dir / cfg["file"]
            if not src_file.exists():
                raise SystemExit(f"missing picture {src_file}")
            aid = f"lore-{kind}-{cfg['id']}"
            img = common.image_set(src_file, f"lore/atlas/{cfg['id']}")
            alpha = has_alpha(src_file)
            passages = []
            for stem, heading in cfg["src"]:
                paras = section_paragraphs(parsed[stem]["blocks"], heading)
                assert paras, (stem, heading)
                hid = next(h["id"] for h in parsed[stem]["blocks"] if h["t"] == "h" and h["x"] == heading)
                passages.append({"text": " ".join(paras), "from": f"lore-{stem}", "head": heading, "hid": hid})
            rx = re.compile(cfg["rx"])
            mentioned = [t["id"] for t in texts if rx.search(full_text(t["title"], t["blocks"]))]
            atlas.append({
                "id": aid,
                "kind": kind,
                "layer": cfg.get("layer", "figures"),
                "name": common.clean_text(cfg["name"]),
                "text": passages[0]["text"],
                "from": passages[0]["from"],
                "hid": passages[0]["hid"],
                "more": passages[1:],
                "img": img,
                "alpha": alpha,
                "texts": mentioned,
            })

    place_ids_by_text: dict[str, list[str]] = {t["id"]: [] for t in texts}
    # The chips of a text name each place once: the other views of the Academy and the Aspirants
    # picture (which nearly every text mentions) stay out of that list.
    skip_chips = {"lore-place-selrick-academy-barrier", "lore-place-selrick-academy-cloudy", "lore-place-aspirants"}
    for a in atlas:
        if a["kind"] != "place" or a["id"] in skip_chips:
            continue
        for tid in a["texts"]:
            if a["id"] not in place_ids_by_text[tid]:
                place_ids_by_text[tid].append(a["id"])
    for t in texts:
        t["places"] = place_ids_by_text[t["id"]]

    # ---- people (Who is who): characters.md cards + relationship.md lists, as given
    people = []
    for slug in ROSTER:
        c, r = people_chars[slug], people_rel[slug]
        people.append({
            "slug": slug,
            "name": c["name"],
            "aka": c["aka"],
            "fields": c["fields"],
            "text": c["text"],
            "blurb": r["blurb"],
            "facts": profile_facts.get(slug, []),
            "rels": r["rels"],
            "more": r["more"],
            "texts": [t["id"] for t in texts if slug in t["chars"] and t["id"] not in ("lore-characters", "lore-relationship")][:40],
        })

    # ---- the light index (the shell reads items.length; the lead builds search.json from it)
    group_name = {"world": "world", "characters": "characters", "stories": "stories", "videos": "videos"}
    items = []
    for t in texts:
        items.append({
            "id": t["id"], "title": t["title"], "collection": "lore", "chars": t["chars"], "pair": None,
            "canon": "official", "tags": ["text", group_name[t["group"]], *(["older text"] if t["rank"] == "older" else [])],
        })
    for a in atlas:
        items.append({
            "id": a["id"], "title": a["name"], "collection": "lore", "chars": [], "pair": None,
            "canon": "official", "tags": ["atlas", a["kind"], a["layer"]], "thumb": a["img"]["t"],
        })

    data = {
        "v": 1,
        "slug": "lore",
        "items": items,
        "layers": LAYERS,
        "texts": texts,
        "atlas": atlas,
        "people": people,
    }

    check(data, parsed)
    common.write_json("lore", data)
    write_thumbs_ts(atlas)

    for p in common.LIB_ROOT.joinpath("lore").rglob("*.webp"):
        img_bytes += p.stat().st_size
    print(f"texts {len(texts)}, atlas {len(atlas)} ({sum(a['kind'] == 'place' for a in atlas)} places, "
          f"{sum(a['kind'] == 'entity' for a in atlas)} entities), people {len(people)}")
    print(f"fixes applied: {len(fixlog)}")
    print(f"pictures in mirror: {common.human(img_bytes)}")
    print("words:", sum(t["words"] for t in texts), "minutes:", sum(t["minutes"] for t in texts))


def write_thumbs_ts(atlas: list[dict]) -> None:
    """The keys of the atlas thumbnails, for the loading list (they download in the background)."""
    path = common.REPO / "apps" / "web" / "src" / "features" / "library" / "lore" / "atlas-thumbs.generated.ts"
    lines = [f'  "{a["img"]["t"]}",' for a in atlas]
    head = "// Generated by scripts/library/lore/build.py. Do not edit."
    out = [head, "export const ATLAS_THUMBS: readonly string[] = [", *lines, "];", ""]
    path.write_text(chr(10).join(out), encoding="utf-8", newline="")
    print(f"wrote {path.relative_to(common.REPO)}")


def has_alpha(path: Path) -> bool:
    """True when the picture has real transparency (a cut-out), not just an unused alpha channel."""
    from PIL import Image
    import numpy as np

    with Image.open(path) as im:
        im.seek(0)
        if im.mode in ("RGBA", "LA") or im.info.get("transparency") is not None:
            a = np.asarray(im.convert("RGBA").getchannel("A"))
            return float((a < 250).mean()) > 0.01
    return False


BAD = re.compile(r"[A-Za-z]:\\|\\media\\|\.(?:png|mp4|webm|flac)\b|D:/", re.I)


def check(data: dict, parsed: dict) -> None:
    """Fail loudly on anything that must not ship."""
    texts, atlas = data["texts"], data["atlas"]
    assert len(texts) == 28, len(texts)
    assert len(atlas) == 24 and sum(a["kind"] == "place" for a in atlas) == 14, len(atlas)
    ids = [t["id"] for t in texts] + [a["id"] for a in atlas]
    assert len(set(ids)) == len(ids), "duplicate ids"
    stems = {c["stem"] for c in TEXTS}
    on_disk = {p.stem for p in OFFICIAL.glob("*.md")}
    assert stems == on_disk, (stems ^ on_disk)
    blob = json.dumps(data, ensure_ascii=False)
    m = BAD.search(blob)
    assert not m, f"a file path reached the data: {blob[max(0, m.start() - 40): m.end() + 40]!r}"
    # Every atlas passage is word for word from the cleaned source file.
    for a in atlas:
        for p in [{"text": a["text"], "from": a["from"]}, *a["more"]]:
            stem = p["from"].removeprefix("lore-")
            source = common.clean_text(parsed[stem]["src"])
            assert p["text"] in source, (a["id"], p["text"][:70])
    for t in texts:
        assert t["blocks"], t["id"]
        for b in t["blocks"]:
            assert b["t"] in {"h", "p", "q", "sub", "note", "ul", "ol", "kv", "tb", "hr", "rel", "chart"}, b
    for a in atlas:
        assert a["texts"], f"{a['id']} is mentioned nowhere"
        assert a["img"]["w"] > 0
    for p in data["people"]:
        assert p["text"] and p["blurb"] and p["rels"], p["slug"]
    print("checks passed")


if __name__ == "__main__":
    main()
