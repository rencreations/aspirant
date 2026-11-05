"""Turn the official lore markdown (story/official) into typed blocks.

Block shapes (short keys, kept small because every text ships in one data file):

  {"t":"h","l":2,"x":"Heading","id":"heading"}      heading (l is 2, 3 or 4)
  {"t":"p","x":"A paragraph."}                       paragraph
  {"t":"q","x":"A quoted line."}                     quote or epigraph
  {"t":"sub","x":"Imperatrix Arashi"}                a short line under a heading (a code name)
  {"t":"note","x":"..."}                             a note that heads a text (not part of the story)
  {"t":"ul","i":["a","b"]}   {"t":"ol","i":[...]}    lists
  {"t":"kv","rows":[["Age","14"]]}                   key and value lines
  {"t":"tb","head":[...],"rows":[[...]]}             table
  {"t":"hr"}                                         rule
  {"t":"rel","x":"Layla's Relationship","rows":[{"w":"Obsidia","r":"Hostile","s":"obsidia"}]}
  {"t":"chart","rows":[{"a":"Fanny","b":"Layla","l":"teammates","both":true}]}

Every string goes through `tidy`: a dash used as a pause becomes punctuation, and `common.clean_text`
removes whatever dash is left.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

DASHES = "—–"

SLUG_OF = {
    "Layla": "layla",
    "Fanny": "fanny",
    "Ruby": "ruby",
    "Angela": "angela",
    "Lesley": "lesley",
    "Chang'e": "change",
    "Guinevere": "guinevere",
    "Vexana": "vexana",
    "Obsidia": "obsidia",
    "Selena": "selena",
}


# ---------------------------------------------------------------------------------------------
# Text rules
# ---------------------------------------------------------------------------------------------


def tidy(s: str, heading: bool = False) -> str:
    """A pause written as a dash becomes punctuation; any other dash goes through clean_text."""
    s = s.strip()
    s = re.sub(rf"\s*[{DASHES}]\s*$", "...", s)  # an interrupted line
    if heading:
        m = re.search(rf"\s[{DASHES}]\s", s)
        if m:
            sep = ", " if ":" in s[: m.start()] else ": "
            s = s[: m.start()] + sep + s[m.end() :]
    return common.clean_text(s)


def hslug(text: str, used: set[str]) -> str:
    base = common.slugify(text)
    slug, n = base, 2
    while slug in used:
        slug = f"{base}-{n}"
        n += 1
    used.add(slug)
    return slug


# ---------------------------------------------------------------------------------------------
# Chunks
# ---------------------------------------------------------------------------------------------


def chunks(text: str) -> list[list[str]]:
    """Blank-line separated groups of lines. A heading line always stands in a group of its own."""
    out: list[list[str]] = []
    cur: list[str] = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.strip()
        if not line:
            if cur:
                out.append(cur)
                cur = []
            continue
        if re.match(r"^#{1,6} ", line):
            if cur:
                out.append(cur)
                cur = []
            out.append([line])
            continue
        cur.append(line)
    if cur:
        out.append(cur)
    return out


KV_RE = re.compile(r"^([A-Za-z][^:]{0,30}): (.+)$")
KV_SINGLE_OK = {"Theme", "Keywords"}


def is_kv_chunk(lines: list[str]) -> bool:
    keys = []
    for ln in lines:
        m = KV_RE.match(ln)
        if not m or m.group(1).startswith("Note"):
            return False
        keys.append(m.group(1))
    if len(lines) >= 2:
        return all(len(k.split()) <= 3 for k in keys)
    return keys[0] in KV_SINGLE_OK


def kv_rows(lines: list[str]) -> list[list[str]]:
    rows = []
    for ln in lines:
        m = KV_RE.match(ln)
        assert m, ln
        rows.append([tidy(m.group(1)), tidy(m.group(2))])
    return rows


def merge_kv(blocks: list[dict]) -> list[dict]:
    out: list[dict] = []
    for b in blocks:
        if b["t"] == "kv" and out and out[-1]["t"] == "kv":
            out[-1]["rows"].extend(b["rows"])
        else:
            out.append(b)
    return out


# ---------------------------------------------------------------------------------------------
# Generic markdown
# ---------------------------------------------------------------------------------------------


def parse_generic(text: str) -> tuple[str | None, list[dict]]:
    """Headings, paragraphs, quotes, lists, tables, rules and key-value groups."""
    title: str | None = None
    blocks: list[dict] = []
    used: set[str] = set()
    for ch in chunks(text):
        first = ch[0]
        m = re.match(r"^(#{1,6}) (.+)$", first)
        if m:
            level, raw = len(m.group(1)), m.group(2)
            if level == 1:
                title = tidy(raw, heading=True)
            else:
                x = tidy(raw, heading=True)
                blocks.append({"t": "h", "l": min(level, 4), "x": x, "id": hslug(x, used)})
            continue
        if all(ln.strip() == "---" for ln in ch):
            blocks.append({"t": "hr"})
            continue
        if first.startswith("|"):
            rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in ch]
            rows = [r for r in rows if not all(re.fullmatch(r":?-{2,}:?", c) for c in r)]
            head, body = rows[0], rows[1:]
            blocks.append({"t": "tb", "head": [tidy(c) for c in head], "rows": [[tidy(c) for c in r] for r in body]})
            continue
        if first.startswith("> "):
            blocks.append({"t": "q", "x": tidy(" ".join(ln[2:] if ln.startswith("> ") else ln for ln in ch))})
            continue
        if all(ln.startswith("- ") for ln in ch):
            blocks.append({"t": "ul", "i": [tidy(ln[2:]) for ln in ch]})
            continue
        if first.startswith(("— ", "– ")):
            blocks.append({"t": "q", "x": tidy(" ".join(ln[2:] if ln[:2] in ("— ", "– ") else ln for ln in ch))})
            continue
        if is_kv_chunk(ch):
            blocks.append({"t": "kv", "rows": kv_rows(ch)})
            continue
        blocks.append({"t": "p", "x": tidy(" ".join(ch))})
    return title, merge_kv(blocks)


# ---------------------------------------------------------------------------------------------
# Special shapes
# ---------------------------------------------------------------------------------------------


def parse_places(text: str) -> tuple[str | None, list[dict]]:
    """places.md: bare title lines (no '#'), each followed by its paragraph."""
    heads = {"Storm Citadel", "Terrinia", "Selrick Academy", "Aspirants"}
    used: set[str] = set()
    blocks: list[dict] = []
    for ch in chunks(text):
        if ch[0] in heads:
            x = tidy(ch[0], heading=True)
            blocks.append({"t": "h", "l": 2, "x": x, "id": hslug(x, used)})
            if len(ch) > 1:
                blocks.append({"t": "p", "x": tidy(" ".join(ch[1:]))})
        elif len(ch) > 1 and ch[0].endswith("!"):  # the motto and its paragraph
            x = tidy(ch[0], heading=True)
            blocks.append({"t": "h", "l": 2, "x": x, "id": hslug(x, used)})
            blocks.append({"t": "p", "x": tidy(" ".join(ch[1:]))})
        else:
            blocks.append({"t": "p", "x": tidy(" ".join(ch))})
    return None, blocks


def parse_video_decs(text: str) -> tuple[str | None, list[dict]]:
    """video-official-decs.md: a note, then 'Title "path"' lines that head each film."""
    used: set[str] = set()
    blocks: list[dict] = []
    for ch in chunks(text):
        m = re.match(r'^(.+?) "[A-Za-z]:\\[^"]*"$', ch[0])
        if m:
            x = tidy(m.group(1), heading=True)
            blocks.append({"t": "h", "l": 2, "x": x, "id": hslug(x, used)})
            if len(ch) > 1:
                blocks.append({"t": "p", "x": tidy(" ".join(ch[1:]))})
        elif ch[0].startswith("This is the official description"):
            blocks.append({"t": "note", "x": tidy(" ".join(ch))})
        else:
            blocks.append({"t": "p", "x": tidy(" ".join(ch))})
    return None, blocks


CHART_RE = re.compile(r"^(.+?) (<)?-(.+?)-> (.+)$")


def parse_archives(text: str) -> tuple[str | None, list[dict]]:
    """selrick-archives.md: a relationship chart, two dossiers and a battle report."""
    title: str | None = None
    used: set[str] = set()
    blocks: list[dict] = []
    in_report = False
    report: list[str] = []
    for ch in chunks(text):
        first = ch[0]
        m = re.match(r"^(#{1,6}) (.+)$", first)
        if m:
            level, raw = len(m.group(1)), m.group(2)
            if level == 1:
                title = tidy(raw, heading=True)
                continue
            x = tidy(raw, heading=True)
            blocks.append({"t": "h", "l": min(level, 4), "x": x, "id": hslug(x, used)})
            in_report = x.startswith("Singularity")
            continue
        if in_report:
            report.append(tidy(" ".join(ch)))
            continue
        if all(CHART_RE.match(ln) for ln in ch):
            rows = []
            for ln in ch:
                cm = CHART_RE.match(ln)
                assert cm
                rows.append({"a": tidy(cm.group(1)), "b": tidy(cm.group(4)), "l": tidy(cm.group(3)), "both": bool(cm.group(2))})
            blocks.append({"t": "chart", "rows": rows})
            continue
        if all(" = " in ln for ln in ch):
            blocks.append({"t": "ul", "i": [tidy(ln) for ln in ch]})
            continue
        head = re.sub(r":$", "", first)
        if head in ("Confirmed Intel", "Observation Record"):
            x = tidy(head, heading=True)
            blocks.append({"t": "h", "l": 4, "x": x, "id": hslug(x, used)})
            rest = ch[1:]
            if rest and all(ln.startswith("- ") for ln in rest):
                blocks.append({"t": "ul", "i": [tidy(ln[2:]) for ln in rest]})
            elif rest:
                blocks.append({"t": "kv", "rows": kv_rows(rest)})
            continue
        if first.startswith("Note:"):
            blocks.append({"t": "p", "x": tidy(" ".join(ch))})
            continue
        if all(KV_RE.match(ln) for ln in ch):
            blocks.append({"t": "kv", "rows": kv_rows(ch)})
            continue
        blocks.append({"t": "p", "x": tidy(" ".join(ch))})
    if report:
        blocks.append({"t": "p", "x": report[0]})
        blocks.append({"t": "ol", "i": report[1:-1]})
        blocks.append({"t": "p", "x": report[-1]})
    return title, merge_kv(blocks)


PROFILE_NAMES = ["Obsidia", "Selena", "Guinevere", "Vexana", "Chang'e", "Lesley", "Angela", "Ruby", "Fanny", "Layla"]
FIELD_KEYS = ("Role", "Status", "Ability", "Abilities", "Personality", "Division", "Combat Power")


def parse_characters(text: str) -> tuple[str | None, list[dict], dict[str, dict]]:
    """characters.md: ten cards (name, code name, fields) each followed by its paragraph."""
    used: set[str] = set()
    blocks: list[dict] = []
    people: dict[str, dict] = {}
    current: str | None = None
    for ch in chunks(text):
        name = ch[0].strip()
        if name in PROFILE_NAMES:
            current = SLUG_OF[name]
            x = tidy(name, heading=True)
            blocks.append({"t": "h", "l": 2, "x": x, "id": hslug(x, used)})
            rest = ch[1:]
            aka = ""
            if rest and not KV_RE.match(rest[0]):
                aka = tidy(rest[0])
                rest = rest[1:]
                blocks.append({"t": "sub", "x": aka})
            rows = kv_rows(rest)
            blocks.append({"t": "kv", "rows": rows})
            people[current] = {"slug": current, "name": x, "aka": aka, "fields": rows, "text": ""}
        elif current:
            para = tidy(" ".join(ch))
            blocks.append({"t": "p", "x": para})
            people[current]["text"] = para
        else:
            raise SystemExit(f"characters.md: stray chunk {ch[0]!r}")
    assert len(people) == 10, sorted(people)
    return None, blocks, people


REL_HEAD_RE = re.compile(r"^(?:.+?'s |.+? )Relationship:?\s*$")
REL_ROW_RE = re.compile(r"^(.+?) - (.+?)\s*$")
FILE_NOTE_RE = re.compile(r'\s*(?:Silhouette image|Image|image) in "[^"]*"\.?')


def parse_relationship(text: str) -> tuple[str | None, list[dict], dict[str, dict]]:
    """relationship.md: who is what to whom, as given."""
    used: set[str] = set()
    lines = [ln.strip() for ln in text.replace("\r\n", "\n").split("\n")]
    roll: list[str] = []
    while lines and lines[0].startswith(("The Aspirants:", "The Enders:")):
        roll.append(lines.pop(0))

    extras = {"Ruby's Father", "Chang'e Mother", "Chang'e Father", "Guinevere's Father"}
    mains: list[dict] = []
    cur: dict | None = None
    cur_extra: dict | None = None
    mode = ""
    for ln in lines:
        if not ln:
            continue
        if ln in PROFILE_NAMES:
            cur = {"name": ln, "desc": [], "head": "", "rows": [], "extras": []}
            mains.append(cur)
            cur_extra, mode = None, "desc"
        elif ln in extras:
            assert cur is not None
            cur_extra = {"name": ln, "desc": []}
            cur["extras"].append(cur_extra)
            mode = "extra"
        elif REL_HEAD_RE.match(ln):
            assert cur is not None
            cur["head"] = ln.rstrip(":").strip()
            mode = "rows"
        elif mode == "rows":
            assert cur is not None
            m = REL_ROW_RE.match(ln)
            if not m:
                raise SystemExit(f"relationship.md: bad row {ln!r}")
            who, rel = tidy(m.group(1)), tidy(m.group(2))
            cur["rows"].append({"w": who, "r": rel, "s": SLUG_OF.get(who, "")})
        elif mode == "desc":
            assert cur is not None
            cur["desc"].append(ln)
        elif mode == "extra":
            assert cur_extra is not None
            cur_extra["desc"].append(ln)
        else:
            raise SystemExit(f"relationship.md: stray line {ln!r}")

    blocks: list[dict] = [{"t": "kv", "rows": kv_rows(roll)}]
    people: dict[str, dict] = {}
    for m in mains:
        slug = SLUG_OF[m["name"]]
        x = tidy(m["name"], heading=True)
        blurb = tidy(FILE_NOTE_RE.sub("", " ".join(m["desc"])))
        blocks.append({"t": "h", "l": 2, "x": x, "id": hslug(x, used)})
        blocks.append({"t": "p", "x": blurb})
        if m["rows"]:
            blocks.append({"t": "rel", "x": tidy(m["head"]), "rows": m["rows"]})
        more = []
        for e in m["extras"]:
            ex = tidy(e["name"], heading=True)
            et = tidy(FILE_NOTE_RE.sub("", " ".join(e["desc"])))
            blocks.append({"t": "h", "l": 3, "x": ex, "id": hslug(ex, used)})
            blocks.append({"t": "p", "x": et})
            more.append({"name": ex, "text": et})
        people[slug] = {"slug": slug, "name": x, "blurb": blurb, "rels": m["rows"], "more": more}
    assert len(people) == 10, sorted(people)
    return None, blocks, people


# ---------------------------------------------------------------------------------------------
# Section lookup (for the atlas passages)
# ---------------------------------------------------------------------------------------------


def section_paragraphs(blocks: list[dict], heading: str) -> list[str]:
    """The paragraphs under the heading named `heading`, up to the next heading of the same or a higher level."""
    for idx, b in enumerate(blocks):
        if b["t"] == "h" and b["x"] == heading:
            level = b["l"]
            out = []
            for nb in blocks[idx + 1 :]:
                if nb["t"] == "h" and nb["l"] <= level:
                    break
                if nb["t"] == "p":
                    out.append(nb["x"])
            return out
    raise SystemExit(f"no section {heading!r}")


def block_text(b: dict) -> str:
    """Plain text of a block, for word counts and mention matching."""
    t = b["t"]
    if t in ("h", "p", "q", "sub", "note"):
        return b["x"]
    if t in ("ul", "ol"):
        return "\n".join(b["i"])
    if t == "kv":
        return "\n".join(f"{k}: {v}" for k, v in b["rows"])
    if t == "tb":
        return "\n".join(" ".join(r) for r in [b["head"], *b["rows"]])
    if t == "rel":
        return b["x"] + "\n" + "\n".join(f"{r['w']} {r['r']}" for r in b["rows"])
    if t == "chart":
        return "\n".join(f"{r['a']} {r['l']} {r['b']}" for r in b["rows"])
    return ""
