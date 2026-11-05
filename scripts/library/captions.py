"""Look up posts in media/_captions/captions.json (264 posts: Instagram, DeviantArt, TikTok, ...).

    import captions
    entry = captions.find("instagram_p_ClbT9aULTis")      # by a folder or file name, a key or a URL
    cr = captions.credit(entry)                            # {"by", "platform", "url", "date"} for the site
    text = captions.caption_text(entry)                    # the English caption, cleaned, or ""

Never join on the `local_references` paths of the file: they are stale. Join on the key.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

import common

OFFICIAL_HANDLES = {"mobilelegendsgame", "mgl_mlbb"}
PLATFORM_NAMES = {
    "instagram": "Instagram",
    "deviantart": "DeviantArt",
    "tiktok": "TikTok",
    "artstation": "ArtStation",
    "facebook": "Facebook",
    "linkedin": "LinkedIn",
    "pixiv": "Pixiv",
    "reddit": "Reddit",
    "x": "X",
    "medibang": "Medibang",
}


@lru_cache(maxsize=1)
def _entries() -> list[dict[str, Any]]:
    path = common.MEDIA / "_captions" / "captions.json"
    return json.loads(path.read_text(encoding="utf-8"))["entries"]


@lru_cache(maxsize=1)
def _by_key() -> dict[str, dict[str, Any]]:
    return {e["key"]: e for e in _entries()}


def find(name: str) -> dict[str, Any] | None:
    """Find a post from a folder or file name (`instagram_p_<code>`, `tiktok_com_<user>_video_<id>`,
    a DeviantArt or Pixiv or X file name that holds the id), a key (`ig:<code>`) or a URL."""
    if not name:
        return None
    keys = _by_key()
    if name in keys:
        return keys[name]
    m = re.search(r"instagram_p_([A-Za-z0-9_-]{6,})", name)
    if m and f"ig:{m.group(1)}" in keys:
        return keys[f"ig:{m.group(1)}"]
    m = re.search(r"tiktok_com_.*?_video_(\d{10,})", name)
    if m and f"tt:{m.group(1)}" in keys:
        return keys[f"tt:{m.group(1)}"]
    for e in _entries():
        url = e.get("url") or ""
        ident = e["key"].split(":", 1)[-1]
        if url and url == name:
            return e
        if len(ident) >= 6 and ident in name and e["key"].split(":", 1)[0] in ("da", "pixiv", "x", "as", "ig", "tt"):
            return e
    return None


def _uploader(e: dict[str, Any]) -> str | None:
    up = e.get("uploader")
    if isinstance(up, dict):  # ArtStation gives a dict
        return up.get("full_name") or up.get("username")
    return up or None


def creator_of(e: dict[str, Any]) -> str | None:
    """The artist. On the official accounts the artist is named in the caption ("MGL Creator @name")."""
    handle = (e.get("uploader_handle") or "").lower()
    cap = e.get("caption") or ""
    if handle in OFFICIAL_HANDLES or e["platform"] == "instagram":
        m = re.search(r"(?i)(?:mgl\s*creators?|creator|artist|art\s*by|credits?)\s*[:\-]?\s*(@\s*[\w.]+)", cap)
        if m:
            return m.group(1).replace(" ", "")
        if handle in OFFICIAL_HANDLES:
            return None  # an official post with no named artist: the credit is the account
    if e["platform"] == "tiktok":
        return f"@{e.get('uploader') or e.get('uploader_handle')}" if (e.get("uploader") or e.get("uploader_handle")) else None
    return _uploader(e)


def credit(e: dict[str, Any] | None) -> dict[str, Any] | None:
    """A `Credit` record for the site (see features/library/types.ts)."""
    if not e:
        return None
    by = creator_of(e)
    handle = (e.get("uploader_handle") or "").lower()
    if by is None and handle in OFFICIAL_HANDLES:
        by = "Mobile Legends: Bang Bang" if handle == "mobilelegendsgame" else "MLBB Game Lovers (MGL)"
    out: dict[str, Any] = {
        "by": common.clean_text(by) if by else None,
        "platform": PLATFORM_NAMES.get(e["platform"], e["platform"]),
        "url": e.get("url") or None,
    }
    if e.get("date"):
        out["date"] = e["date"][:10]
    return out


def caption_text(e: dict[str, Any] | None) -> str:
    """The post's caption without hashtags and credit lines, cleaned for the site.

    Hashtags are removed wherever they are, a line that is only a credit ("MGL Creator @name") or
    only account tags is dropped, and everything else is kept.
    """
    if not e or not e.get("caption"):
        return ""
    credit_line = re.compile(
        r"\s*(?:mgl\s*creators?|creator|artist|art\s*by|credits?)?\s*[:\-]?\s*(?:@\s*[\w.]+\s*)*",
        re.I,
    )
    lines = []
    for line in e["caption"].splitlines():
        line = re.sub(r"#\w+", " ", line)
        if credit_line.fullmatch(line):
            line = ""
        lines.append(re.sub(r"[ \t]+", " ", line).strip())
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return common.clean_text(text)


def is_official_post(e: dict[str, Any] | None) -> bool:
    return bool(e) and (e.get("uploader_handle") or "").lower() in OFFICIAL_HANDLES
