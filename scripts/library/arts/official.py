"""The official art of the Arts room: splash art, pair art, the lore cards, the stills and the
portraits of the families. Writes the pictures into the mirror (arts/official/<slug>/t|p|f.webp and
the untouched original as o.<ext>) and apps/web/public/data/library/arts.json.

Run:  C:/Users/muham/anaconda3/python.exe scripts/library/arts/official.py

Sources (read only, under D:\\ren\\aspirant\\media): <pair>/art/official, <pair>/art/lore. Fan art,
promotional posts, places and entity art belong to other rooms and are not touched here. Each
source file is listed once in ART below: a file in those two folders that is not listed fails the
run, so nothing is left out by accident. Files with the same content are hashed and dropped (the
trailer card exists three times in the library), and the drops go into ignored.json.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import captions  # noqa: E402
import common  # noqa: E402

ROOMS = "arts"
BASE = "arts/official"
IGNORED = Path(__file__).resolve().parents[1] / "ignored.json"

# The Instagram post that carries the Selena and Obsidia lore cards (an official account).
LORE_POST = "instagram_p_Ddxz3PUI3if"

# Each entry: src (under media/), slug, title, kind, chars, pair, alt, and an optional note.
# Kinds: splash (a character's splash art), pair (two or more Aspirants together), lore (a lore
# card), official (anything else the studio made: family portraits, trailer title cards).
# Order is the order on the page: pair by pair in shelf order, splash art first.
ART: list[dict[str, Any]] = [
    # --- Fanny and Layla -------------------------------------------------------------------------
    dict(
        src="layla-and-fanny/art/official/fanny-splash-art.jpg",
        slug="fanny-splash",
        title="Fanny, splash art",
        kind="splash",
        chars=["fanny"],
        pair="fanny-layla",
        alt="Fanny with orange hair leaps through the air with her steel cables out, over a blue sky and a glass city.",
    ),
    dict(
        src="layla-and-fanny/art/official/layla-splash-art.jpg",
        slug="layla-splash",
        title="Layla, splash art",
        kind="splash",
        chars=["layla"],
        pair="fanny-layla",
        alt="Layla with long pink twin tails kneels behind a large white cannon, a round black droid beside her, in a bright city.",
    ),
    dict(
        src="layla-and-fanny/art/official/fighting-together-splash-art.jpg",
        slug="fanny-layla-fighting-together",
        title="Fanny and Layla, fighting together",
        kind="pair",
        chars=["fanny", "layla"],
        pair="fanny-layla",
        alt="Fanny and Layla fight side by side in a bright city, Layla's cannon aimed ahead and Fanny diving beside her.",
    ),
    dict(
        src="layla-and-fanny/art/official/fanny-and-layla.webp",
        slug="fanny-and-layla",
        title="Fanny and Layla",
        kind="pair",
        chars=["fanny", "layla"],
        pair="fanny-layla",
        alt="Fanny and Layla stand together under a blue sky with white clouds and a city behind them.",
    ),
    # --- Ruby and Angela -------------------------------------------------------------------------
    dict(
        src="ruby-and-angela/art/official/ruby-splash-art.jpg",
        slug="ruby-splash",
        title="Ruby, splash art",
        kind="splash",
        chars=["ruby"],
        pair="ruby-angela",
        alt="Ruby with dark hair swings a large white blade over a blue city, dark droids reaching in from the right.",
    ),
    dict(
        src="ruby-and-angela/art/official/angela-splash-art.jpg",
        slug="angela-splash",
        title="Angela, splash art",
        kind="splash",
        chars=["angela"],
        pair="ruby-angela",
        alt="Angela with pink hair and bunny ear headphones sits at a window desk with a small droid, a tiny copy of herself beside her.",
    ),
    dict(
        src="ruby-and-angela/art/official/ruby-father.png",
        slug="ruby-father",
        title="Ruby's father",
        kind="official",
        chars=["ruby"],
        pair="ruby-angela",
        note="The ruler of Planet Oro.",
        alt="Ruby's father in a long dark coat with a fur collar, one hand on his hip, cut out on a plain background.",
    ),
    # --- Lesley and Chang'e ----------------------------------------------------------------------
    dict(
        src="lesley-and-change/art/official/lesley-splash-art.jpg",
        slug="lesley-splash",
        title="Lesley, splash art",
        kind="splash",
        chars=["lesley"],
        pair="lesley-change",
        alt="Lesley with long blonde hair aims a large orange and gold cannon high above a pale city.",
    ),
    dict(
        src="lesley-and-change/art/official/change-splash-art.jpg",
        slug="change-splash",
        title="Chang'e, splash art",
        kind="splash",
        chars=["change"],
        pair="lesley-change",
        alt="Chang'e with pink twin tails and bunny ears rides a white mecha in front of a glowing ring, a city behind her.",
    ),
    dict(
        src="lesley-and-change/art/official/change-father.png",
        slug="change-father",
        title="Chang'e's father",
        kind="official",
        chars=["change"],
        pair="lesley-change",
        note="A chief scientist who built the Aspirant mecha suit with Chang'e.",
        alt="A man with glasses in a white lab coat stands in a laboratory beside a framed family photo.",
    ),
    dict(
        src="lesley-and-change/art/official/change-mother.png",
        slug="change-mother",
        title="Chang'e's mother",
        kind="official",
        chars=["change"],
        pair="lesley-change",
        note="A chief scientist who built the Aspirant mecha suit with Chang'e.",
        alt="A woman with short pink hair and glasses in a white lab coat stands in a laboratory beside a framed family photo.",
    ),
    dict(
        src="lesley-and-change/art/lore/1 - cover.jpg",
        slug="lesley-change-lore-1",
        title="Form-altering weapons, lore card 1",
        kind="lore",
        chars=["lesley", "change"],
        pair="lesley-change",
        note="The cover card: the weapons Chang'e built for Lesley and for herself.",
        alt="Lore card titled Form-altering weapons, with Chang'e in the middle and the weapons of Lesley and Chang'e around her.",
    ),
    dict(
        src="lesley-and-change/art/lore/2 - lesley weapon.jpg",
        slug="lesley-change-lore-2",
        title="Lesley's weapon, lore card 2",
        kind="lore",
        chars=["lesley", "change"],
        pair="lesley-change",
        note="Made by Chang'e, wielded by Lesley. It turns into a cannon during her ultimate. Its goal: make Lesley the most deadly sniper.",
        alt="Lore card of Lesley's orange sniper weapon, with the notes: creator Chang'e, wielder Lesley, transforms into cannon form during Ultimate.",
    ),
    dict(
        src="lesley-and-change/art/lore/3 - lesley holding weapon.jpg",
        slug="lesley-change-lore-3",
        title="Lesley's vow, lore card 3",
        kind="lore",
        chars=["lesley", "change"],
        pair="lesley-change",
        note="\"Ever since that day, I vowed to keep you safe, Chang'e.\"",
        alt="Lore card of Lesley holding her weapon, with the line: Ever since that day, I vowed to keep you safe, Chang'e.",
    ),
    dict(
        src="lesley-and-change/art/lore/4 - change gear.jpg",
        slug="lesley-change-lore-4",
        title="Chang'e's gear, lore card 4",
        kind="lore",
        chars=["lesley", "change"],
        pair="lesley-change",
        note="Made by Chang'e for herself. Its goal: keep herself safe.",
        alt="Lore card of Chang'e's glowing ring weapon, with the note: alter weapon form during Ultimate in Crescent Moon state.",
    ),
    dict(
        src="lesley-and-change/art/lore/5 - end.jpg",
        slug="lesley-change-lore-5",
        title="Lesley and Chang'e, end card",
        kind="lore",
        chars=["lesley", "change"],
        pair="lesley-change",
        note="The last card: Please stay tuned! Can't wait to meet you!",
        alt="The end card of the set: a smiling Chang'e with Lesley beside her and the line: Please stay tuned! Can't wait to meet you!",
    ),
    # --- Guinevere and Vexana --------------------------------------------------------------------
    dict(
        src="vexana-and-guinevere/art/official/guinevere-splash-art.jpg",
        slug="guinevere-splash",
        title="Guinevere, splash art",
        kind="splash",
        chars=["guinevere"],
        pair="guinevere-vexana",
        alt="Guinevere with long blonde hair and red ribbons leaps among floating droids and bright shards in the sky.",
    ),
    dict(
        src="vexana-and-guinevere/art/official/vexana-splash-art.jpg",
        slug="vexana-splash",
        title="Vexana, splash art",
        kind="splash",
        chars=["vexana"],
        pair="guinevere-vexana",
        alt="Vexana with violet hair stands before a huge dark armored figure with great blades, over a ruined city.",
    ),
    dict(
        src="vexana-and-guinevere/art/official/both-splash-art.jpg",
        slug="guinevere-vexana-both",
        title="Guinevere and Vexana, splash art",
        kind="pair",
        chars=["guinevere", "vexana"],
        pair="guinevere-vexana",
        alt="Vexana's face large at the left in violet light, Guinevere flying toward the right with her droids.",
    ),
    dict(
        src="vexana-and-guinevere/art/official/fighting-moment.jpg",
        slug="guinevere-vexana-fighting-moment",
        title="Guinevere and Vexana, fighting moment",
        kind="pair",
        chars=["guinevere", "vexana"],
        pair="guinevere-vexana",
        alt="Vexana and Guinevere in mid fight inside a dark spiked shell of violet energy.",
    ),
    dict(
        src="vexana-and-guinevere/art/official/fighting-stance.jpg",
        slug="guinevere-vexana-fighting-stance",
        title="Guinevere and Vexana, fighting stance",
        kind="pair",
        chars=["guinevere", "vexana"],
        pair="guinevere-vexana",
        alt="Vexana and Guinevere stand ready in a dark violet storm, Guinevere in red and gold with floating droids around her.",
    ),
    dict(
        src="vexana-and-guinevere/art/official/guin-father-silhouette.png",
        slug="guinevere-father",
        title="Guinevere's father, silhouette",
        kind="official",
        chars=["guinevere"],
        pair="guinevere-vexana",
        note="The head of House Baroque. He has not appeared in the main story yet.",
        alt="A black silhouette of a man in a long coat with a fur collar, holding papers, with a glowing gold question mark on his chest.",
    ),
    # --- Selena and Obsidia ----------------------------------------------------------------------
    dict(
        src="selena-and-obsidia/art/official/obsidia/obsidia-splash-art.png",
        slug="obsidia-splash",
        title="Obsidia, splash art",
        kind="splash",
        chars=["obsidia"],
        pair="selena-obsidia",
        alt="Obsidia in a black and gold gown with long red and gold hair leaps with a spiked blade of red light before a dark sun.",
    ),
    dict(
        src="selena-and-obsidia/art/official/selena/selena-splash-art.png",
        slug="selena-splash",
        title="Selena, splash art",
        kind="splash",
        chars=["selena"],
        pair="selena-obsidia",
        alt="Selena with long golden hair and small horns flies forward in a blue and silver mecha suit, two fox eared droids above her.",
    ),
    dict(
        src="selena-and-obsidia/art/official/selena/aspirant.jpg",
        slug="day-of-enders",
        title="Day of Enders, trailer card",
        kind="official",
        chars=["selena", "obsidia"],
        pair="selena-obsidia",
        note="The title card of the Day of Enders trailer.",
        alt="Obsidia at the left and Selena at the right face each other as their weapons cross in a burst of light, under the title Day of Enders.",
    ),
    dict(
        src="selena-and-obsidia/art/official/selena/selena.jpg",
        slug="the-pawns-gambit",
        title="The Pawn's Gambit, trailer card",
        kind="official",
        chars=["selena"],
        pair="selena-obsidia",
        note="The title card of Selena's character trailer.",
        alt="Selena with long golden hair and horns, a finger at her lips, under the title The Pawn's Gambit.",
    ),
    dict(
        src="selena-and-obsidia/art/official/obsidia/obsidia.jpg",
        slug="the-queens-endgame",
        title="The Queen's Endgame, trailer card",
        kind="official",
        chars=["obsidia"],
        pair="selena-obsidia",
        note="The title card of Obsidia's character trailer.",
        alt="Obsidia with short white hair looks down beside a black sun, under the title The Queen's Endgame.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/001_3995201964049940804.jpg",
        slug="selrick-archives-card",
        title="Selrick Archives, announcement card",
        kind="lore",
        chars=["selena", "obsidia"],
        pair="selena-obsidia",
        note="The card that opened the Selrick Academy Archives.",
        post=LORE_POST,
        alt="Card titled Selrick Archives with Selena and Obsidia and small portraits of the other Aspirants, new skins coming 10/09.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/002_3995202034656852492.jpg",
        slug="relationship-chart",
        title="The Aspirants, relationship chart",
        kind="lore",
        chars=list(common.CHAR_SLUGS),
        pair=None,
        note="Who is teacher, teammate, rival or confidant to whom.",
        post=LORE_POST,
        alt="A chart of the Aspirants with lines between them: teammates, classmates, rivals, creators, confidants and teachers.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/003_3995202112033376586.jpg",
        slug="obsidia-enders-file",
        title="The Enders Archives, Obsidia",
        kind="lore",
        chars=["obsidia"],
        pair="selena-obsidia",
        note="Her file in the Enders Archives: code name Imperatrix Arashi, commander-type Ender.",
        post=LORE_POST,
        alt="An archive file for Obsidia, code name Imperatrix Arashi, with her portrait and a list of confirmed intel.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/004_3995202180677328998.jpg",
        slug="obsidia-observation-record",
        title="Observation record, Obsidia",
        kind="lore",
        chars=["obsidia"],
        pair="selena-obsidia",
        note="Her record from the previous civilization to May 997, and her Ender mecha suit.",
        post=LORE_POST,
        alt="An observation record for Obsidia in a pink panel: four dated entries and her armored Ender mecha suit.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/005_3995202251208766803.jpg",
        slug="selena-enders-file",
        title="The Enders Archives, Selena",
        kind="lore",
        chars=["selena"],
        pair="selena-obsidia",
        note="Her file: code name Silverbolt Raiko, mobile-type Ender, cover identity a Selrick Academy student.",
        post=LORE_POST,
        alt="An archive file for Selena, code name Silverbolt Raiko, with her portrait and a list of confirmed intel.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/006_3995202327830274062.jpg",
        slug="selena-observation-record",
        title="Observation record, Selena",
        kind="lore",
        chars=["selena"],
        pair="selena-obsidia",
        note="Her record from year 978 to May 997, and her Ender mecha suit.",
        post=LORE_POST,
        alt="An observation record for Selena in a blue panel: four dated entries and her armored Ender mecha suit.",
    ),
    dict(
        src=f"selena-and-obsidia/art/lore/{LORE_POST}/007_3995202392573558292.jpg",
        slug="singularity-timeline",
        title="Singularity, battle report timeline",
        kind="lore",
        chars=["selena", "obsidia"],
        pair="selena-obsidia",
        note="What happened on the day of the Singularity, step by step. The outcome remains undecided.",
        post=LORE_POST,
        alt="A battle report timeline of the Singularity crisis, one pink panel after another with the Aspirants' portraits.",
    ),
]

KIND_TAGS = {
    "splash": ["splash art", "art"],
    "pair": ["pair art", "art"],
    "lore": ["lore card", "card"],
    "official": ["official art"],
}


def media_path(rel: str) -> Path:
    return common.MEDIA / rel


# A cut-out (a figure on a transparent background) has no real average colour: the hidden pixels
# are black. It gets a soft slate instead, so a dark coat still shows against its tile.
CUTOUT_COLOUR = "#56607c"


def mostly_transparent(src: Path) -> bool:
    from PIL import Image
    import numpy as np

    with Image.open(src) as im:
        rgba = im.convert("RGBA")
        alpha = np.asarray(rgba.getchannel("A"))
    return float((alpha < 128).mean()) > 0.3


def gather_unlisted() -> list[str]:
    """Image files in the two source folders that ART does not list (they would be left out)."""
    listed = {a["src"] for a in ART}
    exts = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif"}
    missing: list[str] = []
    for pair_dir in common.PAIR_FOLDERS:
        for sub in ("art/official", "art/lore"):
            root = common.MEDIA / pair_dir / sub
            if not root.exists():
                continue
            for p in sorted(root.rglob("*")):
                if p.is_file() and p.suffix.lower() in exts:
                    rel = p.relative_to(common.MEDIA).as_posix()
                    if rel not in listed:
                        missing.append(rel)
    return missing


def main() -> int:
    unlisted = gather_unlisted()

    # Hash every listed file, keep the first of each group, and remember what was dropped.
    keep: list[dict[str, Any]] = []
    seen: dict[str, str] = {}
    dropped: dict[str, str] = {}
    for a in ART:
        src = media_path(a["src"])
        if not src.exists():
            raise SystemExit(f"missing source: {src}")
        h = common.sha1_file(src)
        if h in seen:
            dropped[a["src"]] = f"duplicate of {seen[h]}"
            continue
        seen[h] = a["src"]
        keep.append(a)
    # The same picture is also stored under a second name in the library (the other half of the
    # Selena and Obsidia pair holds a copy of the trailer card). Those are not in ART at all.
    for rel in unlisted:
        h = common.sha1_file(media_path(rel))
        if h in seen:
            dropped[rel] = f"duplicate of {seen[h]} (kept as an arts item)"
    still_unlisted = [r for r in unlisted if r not in dropped]
    if still_unlisted:
        raise SystemExit("source files not listed in ART:\n  " + "\n  ".join(still_unlisted))

    items: list[dict[str, Any]] = []
    for n, a in enumerate(keep, 1):
        src = media_path(a["src"])
        key_base = f"{BASE}/{a['slug']}"
        img = common.image_set(src, key_base)
        if mostly_transparent(src):
            img = {**img, "c": CUTOUT_COLOUR}
        # The untouched original, for the download button.
        ext = src.suffix.lower().lstrip(".")
        okey = f"{key_base}/o.{ext}"
        dest = common.key_path(okey)
        if not common.fresh(dest, src):
            shutil.copyfile(src, dest)
        item: dict[str, Any] = {
            "id": f"arts-official-{a['slug']}",
            "title": common.clean_text(a["title"]),
            "collection": "arts",
            "chars": a["chars"],
            "pair": a["pair"],
            "canon": "official",
            "tags": KIND_TAGS[a["kind"]] + [c for c in a["chars"] if len(a["chars"]) < 4],
            "kind": a["kind"],
            "alt": common.clean_text(a["alt"]),
            "img": img,
            "download": {
                "key": okey,
                "name": f"aspirant-{a['slug']}.{ext}",
                "bytes": dest.stat().st_size,
            },
        }
        if a.get("note"):
            item["note"] = common.clean_text(a["note"])
        if a.get("post"):
            cr = captions.credit(captions.find(a["post"]))
            if cr:
                item["credit"] = cr
        items.append(item)
        print(f"  {n:2d}/{len(keep)} {item['id']} {img['w']}x{img['h']}", flush=True)

    out = {"v": 1, "slug": "arts", "items": items}
    common.write_json("arts", out)

    # Merge what was left out into ignored.json (a flat object: source path -> reason).
    if dropped:
        data: dict[str, str] = {}
        if IGNORED.exists():
            data = json.loads(IGNORED.read_text(encoding="utf-8") or "{}")
        for rel, why in dropped.items():
            data[f"media/{rel}"] = why
        IGNORED.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"ignored.json: {len(dropped)} entries added")

    total = sum(f.stat().st_size for f in (common.LIB_ROOT / BASE).rglob("*") if f.is_file())
    by_kind: dict[str, int] = {}
    for it in items:
        by_kind[it["kind"]] = by_kind.get(it["kind"], 0) + 1
    print(f"\n{len(items)} items {by_kind}; {len(dropped)} dropped {dropped}")
    print(f"mirror {common.LIB_ROOT / BASE}: {common.human(total)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
