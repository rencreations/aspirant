"""Videos that other rooms of the library already encode, for the Others room.

The promo reels (Design), the emotes and the gameplay clips (the Others collection), the nine official
edits and the nine fan videos (Fanart) are encoded and in the mirror already. The Others room points at
those same files by key, so nothing is encoded or uploaded twice. Each record is read from the room's
own data file, so the credit, the canon label and the picture size are exactly what that room shows.

Every function returns specs in the shape `build.py` plans with: `src` (the source files under
`media/`, the first one is the film, the others are the same film found twice), `key` (the library key
of the file that plays), `title`, `kind`, `pair`, `chars`, `canon`, `credit`, `tags`, `desc`, `date`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import common

MEDIA = common.MEDIA

KIND_DESIGN = "reel"
KIND_EMOTE = "emote"
KIND_GAMEPLAY = "gameplay"
KIND_EDIT = "edit"
KIND_FAN = "fan"

_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _load(name: str) -> dict[str, Any]:
    return json.loads((common.DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))


def date_words(iso: str | None) -> str:
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    return f"{int(m.group(3))} {_MONTHS[int(m.group(2)) - 1]} {m.group(1)}" if m else ""


def sentences(text: str, limit: int = 230) -> str:
    """The first sentences of a post caption that fit in `limit`, without links, tags or line breaks."""
    t = re.sub(r"(?im)^\s*LINK:.*$", "", text or "")
    t = re.sub(r"#\w+", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = common.clean_text(t)
    parts = re.split(r"(?<=[.!?])\s+", t)
    out = ""
    for p in parts:
        if len(out) + len(p) + (1 if out else 0) > limit:
            break
        out = f"{out} {p}".strip()
    out = out or t[:limit].rstrip(" ,;:")
    # A caption without a full stop at the end gets one, so the sentence after it reads right.
    return out if not out or out[-1] in ".!?" else out + "."


def _one(pattern: str) -> Path:
    found = sorted(MEDIA.glob(pattern))
    if len(found) != 1:
        raise SystemExit(f"{pattern}: expected one file, found {len(found)}")
    return found[0]


def _rel(path: Path) -> str:
    return path.relative_to(MEDIA).as_posix()


def _credit(record: dict[str, Any]) -> dict[str, Any] | None:
    c = record.get("credit")
    return dict(c) if c else None


def _date(record: dict[str, Any]) -> str | None:
    c = record.get("credit") or {}
    return c.get("date") or record.get("date")


def _moved_reels() -> list[dict[str, Any]]:
    """The six reels that were posts of Design until 13 Nov 2026 (design/build.py writes them here)."""
    path = Path(__file__).resolve().parents[1] / "design" / "moved-reels.json"
    return json.loads(path.read_text(encoding="utf-8"))["items"] if path.exists() else []


def promo_reels() -> list[dict[str, Any]]:
    """The eight reels of the promotional folder: two are still posts of Design, six moved out of it."""
    out: list[dict[str, Any]] = []
    reels = sorted([*_load("design")["items"], *_moved_reels()], key=lambda it: (it["date"], it["id"]))
    for item in reels:
        v = item.get("video") or {}
        if not str(v.get("src", "")).endswith(".mp4"):
            continue
        code = item["id"].removeprefix("design-")
        src = _one(f"_others/promotional/instagram_p_{code}/001_*.mp4")
        when = date_words(_date(item))
        caption = sentences(item.get("caption", ""))
        lead = f"A reel from the official account, posted on {when}." if when else "A reel from the official account."
        out.append(
            {
                "src": [_rel(src)],
                "key": v["src"],
                "title": item["title"],
                "kind": KIND_DESIGN,
                "pair": item.get("pair"),
                "chars": item.get("chars", []),
                "canon": item["canon"],
                "credit": _credit(item),
                "tags": [*item.get("tags", []), "reel", "promo"],
                "desc": f"{lead} {caption}".strip() if caption and caption.lower() != item["title"].lower() else lead,
                "date": _date(item),
            }
        )
    return out


def emotes_and_gameplay() -> list[dict[str, Any]]:
    """The nine emote loops and the ten gameplay clips of the Others collection."""
    out: list[dict[str, Any]] = []
    for item in _load("others")["items"]:
        v = item.get("video") or {}
        kind = item.get("kind")
        if kind not in ("emote", "gameplay") or not str(v.get("src", "")).endswith(".mp4"):
            continue
        name = Path(v["src"]).stem
        if kind == "emote":
            src = MEDIA / "layla-and-fanny" / "art" / "emotes" / f"{name}.mp4"
            if not src.exists():
                raise SystemExit(f"missing emote source {src}")
            if item["id"].endswith("-preview"):
                desc = "The whole emote set in one loop: eight chibi stickers of Fanny and Layla, with sound."
            else:
                who = item["chars"][0].capitalize() if item["chars"] else "a character"
                desc = f"A looping chibi sticker of {who}. It plays on a loop and has no sound."
            tags = [*item.get("tags", []), "loop"]
        else:
            src = _one(f"selena-and-obsidia/video/_gameplay/instagram_p_{name}/001_*.mp4")
            caption = sentences(item.get("caption", ""), 140)
            desc = f"{caption} Game footage from the official account. It is not part of the story.".strip()
            tags = [*item.get("tags", []), "not story"]
        out.append(
            {
                "src": [_rel(src)],
                "key": v["src"],
                "title": item["title"],
                "kind": KIND_EMOTE if kind == "emote" else KIND_GAMEPLAY,
                "pair": item.get("pair"),
                "chars": item.get("chars", []),
                "canon": item["canon"],
                "credit": _credit(item),
                "tags": tags,
                "desc": common.clean_text(desc),
                "date": _date(item),
            }
        )
    return out


# Plain descriptions for the nine fan videos (the fan room gives titles and credits, not sentences).
FAN_DESC = {
    "fanart-video-isakochii-selena-obsidia-speedpaint": "A speedpaint of Selena and Obsidia, drawn on screen and sped up. A fan work.",
    "fanart-video-bomboclau-jealousy": "A short fan animation in which Obsidia and Selena get jealous of each other.",
    "fanart-video-hashirama-selena-speedpaint": "A speedpaint of Selena, drawn on screen and sped up. A fan work.",
    "fanart-video-nibiru-ruby-speedpaint": "A speedpaint of Ruby, drawn on screen and sped up. A fan work.",
    "fanart-video-nibiru-fanny-speedpaint": "A speedpaint of Fanny, drawn on screen and sped up. A fan work.",
    "fanart-video-guinevere-vexana-funny-short": "A joke animation of Guinevere and Vexana. The maker says it is not canon.",
    "fanart-video-badminton-animation": "A fan animation in which Fanny and Layla play badminton, with voices by two fan actors.",
    "fanart-video-lesley-dance": "A fan dance edit of Lesley, set to music.",
    "fanart-video-change-dance": "A fan dance edit of Chang'e and Lesley, set to music.",
}

EDIT_DESC = "A reel from the official account, cut from in-game animation. It is not part of the story."


def fanart_videos() -> list[dict[str, Any]]:
    """The nine official edits and the nine fan videos that the Fanart room carries."""
    out: list[dict[str, Any]] = []
    for item in _load("fanart")["items"]:
        v = item.get("video") or {}
        if not str(v.get("src", "")).endswith(".mp4"):
            continue
        sources = [s for s in item.get("src", []) if s.lower().endswith((".mp4", ".webm"))]
        if not sources:
            raise SystemExit(f"{item['id']}: no source video in its record")
        official = "official" in item.get("tags", [])
        when = date_words(_date(item))
        if official:
            desc = EDIT_DESC if not when else f"A reel from the official account, posted on {when}. It was cut from in-game animation and is not part of the story."
        else:
            desc = FAN_DESC.get(item["id"]) or f"A fan video by {item['credit'].get('by') or 'a fan'}."
        out.append(
            {
                "src": sources,
                "key": v["src"],
                "title": item["title"],
                "kind": KIND_EDIT if official else KIND_FAN,
                "pair": item.get("pair"),
                "chars": item.get("chars", []),
                "canon": item["canon"],
                "credit": _credit(item),
                "tags": [*item.get("tags", []), KIND_EDIT if official else KIND_FAN],
                "desc": common.clean_text(desc),
                "date": _date(item),
            }
        )
    return out


def all_reused() -> list[dict[str, Any]]:
    return [*promo_reels(), *emotes_and_gameplay(), *fanart_videos()]
