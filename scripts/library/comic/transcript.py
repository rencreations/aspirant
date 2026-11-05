"""Parse the two comic transcripts (story/official/*/comic.md) into blocks of lines.

A block is {"from": n, "to": m, "lines": [...]} for the pages the source groups under one header
(`2.jpg:`, `5-10.jpg:`, `27-37.jpg (fighting scene)`). A line is one of

    {"k": "say",   "who": "Layla" | "Narrator" | None, "t": "text"}   a speech bubble or a caption box
    {"k": "scene", "t": "text"}                                      the author's description of the picture
    {"k": "note",  "t": "text"}                                      an "Explanation:" from the author

`who` is None for a caption box that has no speaker. A quoted line with no speaker of its own takes
the last speaker of the block (a speech that runs over several bubbles).

The transcripts are the author's own, with typos and some broken English. The clean up is limited:
the text rules (no dashes, Terrinia), the typos listed in FIXES, and a plain rewrite (REPLACE) of
the author's descriptions of the pictures where the grammar is too broken to read. The words that
the characters say are never reworded: only typos are fixed there.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

HEADER = re.compile(r"^(\d+)(?:-(\d+))?\.jpg\b[^\n]*$")
SAY = re.compile(r'^([A-Z][A-Za-z\' ]{0,24}):\s*(?:\(([^)]*)\)\s*)?"(.*)"\s*\.?$')
QUOTE = re.compile(r'^"(.*)"\s*\.?$')
TIME_CARD = re.compile(r"^\d+ hours? ago:", re.I)

# Words that are wrong in the sources (whole words).
FIXES: list[tuple[str, str]] = [
    (r"\bTerrania\b", "Terrinia"),
    (r"\btechnologial\b", "technological"),
    (r"\boean\b", "ocean"),
    (r"\bRubby\b", "Ruby"),
    (r"\bASpirants\b", "Aspirants"),
    (r"\btrainig\b", "training"),
    (r"\bfigher\b", "fighter"),
    (r"\bseperated\b", "separated"),
    (r"\bunconcious\b", "unconscious"),
    (r"\bDawnbreak Planet\b", "Planet Dawnbreak"),
    (r"\bit's neck\b", "its neck"),
    (r"\bit's dark void\b", "its dark void"),
    (r"\bcyborgs \(Ender\) appear\b", "cyborgs appeared"),
    (r"\bknow when but at\b", "know when. But at"),
    (r"\bakward\b", "awkward"),
    (r"\bvibes is\b", "mood is"),
    (r"\blonggerheads\b", "loggerheads"),
    (r"\bEveryine\b", "Everyone"),
    (r"\baademy\b", "academy"),
    (r"\bbrighest\b", "brightest"),
    (r"\bWhat a pushovers\b", "What pushovers"),
    (r"\bAcademy, A place\b", "Academy, a place"),
    (r"\bprofessor Joe\b", "Professor Joe"),
    (r"\bThe vibes\b", "The mood"),
]

# The author's descriptions of the pictures are broken English in places. Each entry is
# (the start of the source line, the plain version). The meaning is kept.
REPLACE: list[tuple[str, str]] = [
    ("It shown an technologial", "It shows a technologically advanced city of tall buildings, with a lake in the middle that joins the ocean. The whole city lies on a shore. Half of it is a human city and a large part of it is Selrick Academy."),
    ("We can see a boy running", "A boy runs, breathing heavily. He trips and falls as a monster suddenly attacks him."),
    ("There's a shining cable", "A shining cable wraps around the monster's hand and holds it. A woman flies in, holding the cable. She defeats the monster easily. This woman is Fanny."),
    ("When Fanny wanted to deliver", "As Fanny is about to deliver the final blow, a cannon fires a laser from far away and takes the kill. It is Layla."),
    ("Fanny scolded Layla", "Fanny scolds Layla angrily."),
    ("Layla with her arrogance", "Layla, arrogant as ever, pushes Fanny away."),
    ("Fanny is grabbing her head", "Fanny holds her head."),
    ("We can see they both hate", "The two cannot stand each other. Layla was always top of the class until Fanny arrived, a transfer student whose achievements can only be described as true perfection."),
    ("We can see the view of Selrick", "A view of Selrick Academy: tall, industrial buildings with one tall tower in the middle that shoots a laser at the sky."),
    ("Layla is in happy", "Layla is happy that she has more kills than Fanny."),
    ("We can see that Fanny is annoyed", "Fanny is annoyed by her attitude."),
    ("Layla is anonyed", "Layla is annoyed at being named second to Fanny."),
    ("There's an alert", "An alert sounds in the academy."),
    ("We can see Enders are destroying", "Enders are destroying Terrinia's defense shield. Civilians run for their lives."),
    ("We can see professor Jor", "Professor Joe is fighting and guiding civilians to safety."),
    ("We can see that they're fighting", "The two fight together."),
    ("That day marked", "That day is the first time the two join forces. Miraculously, they work together quite well."),
    ("Layla here used a canon", "Layla uses a cannon that fires a laser. Fanny uses highly maneuverable gear to fly and strike the Ender directly."),
    ("They defeated many Enders", "They defeat many Enders together."),
    ("Layla here knew that Fanny", "Layla realizes that Fanny is not trying to put her down. Fanny is only trying her best to catch up to her brother."),
    ("They both smiled", "They both smile."),
    ("we can see Guinevere are down", "Guinevere lies on the ground, unconscious and badly injured, along with other Aspirants."),
    ("We can see Vexana in her normal", "Vexana, in her normal human form, is still conscious. She kneels in a torn uniform, with injuries across her body. She cries as she looks at the scene, holding her Emblem of Hope."),
    ("Vexana tears hit", "Vexana's tears fall on the Emblem of Hope, but it does not light up. This means that Vexana's and Guinevere's power are not in sync. Vexana cries with despairing eyes, like a person who has lost her world."),
    ("Then we can see the Emblem of Hope", "The Emblem of Hope that Vexana holds tight cracks and disappears."),
    ("This is a future that Will", "This is a future that the Will of the Planet shows Vexana. It makes her desperate and determined to join the Enders and destroy them from within. It shows her that neither she nor anyone else can do anything about that future as things stand, and that she has to do something."),
    ("Guinevere and Vexana are fighting back", "Guinevere and Vexana fight back to back. Guinevere uses her close combat skills and Vexana uses magic with a staff. They fight many Enders together. Suddenly an Ender comes out of a portal behind Guinevere. Guinevere is shocked and has no time to react."),
    ("Vexana ran to Guin", "Vexana runs to Guinevere and pushes her away from the Ender."),
    ("While Vexana pushes Guin", "As Vexana pushes Guinevere away, the Ender grabs Vexana's hand instead and drags her into the portal. Guinevere tries to save her."),
    ("It was to late", "It is too late. Tears fall from Vexana's eyes as she thinks it is okay to sacrifice herself as long as Guinevere is okay."),
    ("Vexana being dragged", "Vexana is dragged into the portal while Guinevere watches her face slowly disappear from view."),
    ("We can see Vexana falling", "Vexana falls into the abyss, accepting her fate. Suddenly her Emblem of Hope lights up, and she sees hope and her past memories with Guinevere."),
    ("Guinevere and Vexana are watching", "Guinevere and Vexana watch fireworks together, holding hands. Vexana looks happily at Guinevere's face while Guinevere points at a firework."),
    ("as Vexana feel deeper", "As Vexana sinks deeper, she remembers more memories."),
    ("We can see scene Guinevere", "Guinevere and Vexana receive badges of honor, at a ceremony, for being the best Aspirant duo in the academy. Both smile and hold hands. Teacher Lesley smiles at them and other Aspirants celebrate in the background."),
    ("Vexana grabbing her head", "Vexana holds her head. Remembering all of these memories is painful, because she is now separated from Guinevere. But the Emblem of Hope shines brighter, and her hope grows bigger too."),
    ("scene transition", "The scene changes to another memory."),
    ("We can see bright blue sky", "Under a bright blue sky, Vexana and Guinevere rest below a shady tree on a sunny day and talk. Guinevere lies on Vexana's lap while Vexana pats her hair."),
    ("Then Guin get up", "Then Guinevere gets up, excited."),
    ("The screen cracks", "The screen cracks, as if someone is trying to interrupt Vexana as she sees these memories. Big, sharp hands reach out of the cracks in her memories."),
    ("We can see the Will of the Planet coming", "The Will of the Planet comes out of Vexana's memory."),
    ("We can see Vexana staring", "Vexana stares at the Will of the Planet, shocked, scared and helpless."),
    ("So here, the Will", "Here the Will of the Planet shows Vexana a vision of a future where Planet Dawnbreak is destroyed by the Enders and nobody can do anything about it (it refers to the first panel). Vexana remembers that the Enders, or the Will of the Planet, can be destroyed by taking control of the Enders with the Ender Control Core. Vexana is determined to join the Enders and steal the Ender Control Core when she gets the chance. For now, she has to follow the orders of the Will of the Planet."),
    ("The timeline is present", "The timeline returns to the present. Vexana wears an Ender costume. Her hair has turned from black to white and her outfit represents the Enders."),
    ("We can see Guinevere in academy", "Guinevere is in the academy, watching the attack. Her Emblem of Hope begins to shine and beep, which shows that Vexana is near and that their power is in sync. Guinevere is shocked, and sure that Vexana is connected to the attack."),
    ("We can see Vexana on top", "Vexana stands on top of a building and looks down at all the attacks from the Ender side."),
    ("We can see Guinevere is crying", "Guinevere cries, knowing Vexana is still alive and that there is still hope of saving her. She touches the Emblem of Hope, which lights up, a symbol of hope."),
]


def clean_line(s: str, prose: bool = False) -> str:
    """Clean one line. `prose` is True for the author's descriptions (rewritten where broken)."""
    s = common.clean_text(s)
    if prose:
        for start, plain in REPLACE:
            if s.startswith(start):
                return plain
    for pat, rep in FIXES:
        s = re.sub(pat, rep, s)
    # A hyphen used as a dash at the end of a cut off line ("one name-").
    s = re.sub(r"(?<=\w)-$", "...", s)
    s = s.replace(" ,", ",")
    # A sentence that starts with a small letter after ! or ? (the source types them like this).
    s = re.sub(r"([!?]) ([a-z])", lambda m: f"{m.group(1)} {m.group(2).upper()}", s)
    if prose and s and s[0].islower():
        s = s[0].upper() + s[1:]
    if prose and s and s[-1] not in ".!?)":
        s += "."
    return s


def _line(text: str, state: dict) -> dict | None:
    """Classify one raw line. `state["who"]` carries the speaker across quoted lines."""
    t = text.strip()
    if not t:
        return None
    if re.match(r"^Narrator:\s*$", t):
        state["who"] = "Narrator"
        return None
    m = SAY.match(t)
    if m:
        who = m.group(1).strip()
        state["who"] = who
        return {"k": "say", "who": who, "t": clean_line(m.group(3))}
    m = QUOTE.match(t)
    if m:
        return {"k": "say", "who": state.get("who"), "t": clean_line(m.group(1))}
    if TIME_CARD.match(t):
        state["who"] = None
        return {"k": "say", "who": None, "t": clean_line(t)}
    m = re.match(r"^Explanation:\s*(.*)$", t)
    if m:
        state["who"] = None
        return {"k": "note", "t": clean_line(m.group(1), True)}
    if re.match(r"^\{.*\}$", t):
        state["who"] = None
        return {"k": "scene", "t": clean_line(t.strip("{}").strip(), True)}
    if t.lower() == "ends":
        return None
    state["who"] = None
    return {"k": "scene", "t": clean_line(t, True)}


def parse(path: Path, widen: dict[int, int] | None = None) -> list[dict]:
    """Return the blocks of one comic.md. `widen` stretches a block: {first page: last page}."""
    widen = widen or {}
    blocks: list[dict] = []
    cur: dict | None = None
    state: dict = {}
    for raw in path.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n"):
        h = HEADER.match(raw.strip())
        if h:
            a = int(h.group(1))
            b = widen.get(a, int(h.group(2) or a))
            cur = {"from": a, "to": b, "lines": []}
            blocks.append(cur)
            state = {"who": None}
            continue
        if cur is None:
            continue
        item = _line(raw, state)
        if item:
            cur["lines"].append(item)
    return [b for b in blocks if b["lines"]]


if __name__ == "__main__":
    import json

    base = common.STORY / "official"
    for name, wide in (("the-aspirant-comic", {38: 42}), ("guinevere-vexana-comic", {})):
        blocks = parse(base / name / "comic.md", wide)
        print(name, len(blocks), "blocks")
        for b in blocks:
            print(f"  {b['from']}-{b['to']}")
            for ln in b["lines"]:
                print("     ", json.dumps(ln, ensure_ascii=False))
