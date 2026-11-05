"""Join fan art files to their posts in media/_captions/captions.json and work out the credit.

`captions.credit()` is not used as is: it names the official account when a post does not say
"creator" in exactly the usual way, and it keeps only the first handle. The rules here:

* every handle on a line that says creator, artist, animator or designer is an artist of the post;
* one artist is `by`; two artists on one work are "@a and @b"; a carousel with many artists is
  "Several artists" and the handles go in `note`;
* the official account is never put in `by` for fan art;
* a file named after an artist's profile (`httpswww.instagram.comnryo_c.jpg`) is that artist's own
  picture, so a copy of it inside a carousel carries the artist.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import captions  # noqa: E402
import common  # noqa: E402

OFFICIAL = captions.OFFICIAL_HANDLES
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
ROLE = re.compile(r"(?i)\b(creators?|artists?|animators?|designers?)\b")
HANDLE = re.compile(r"@\s*([A-Za-z0-9_.]+[A-Za-z0-9_])")


def media_id_to_shortcode(n: int | str) -> str:
    """Instagram's numeric media id is the shortcode in base 64."""
    n = int(n)
    out = ""
    while n:
        n, r = divmod(n, 64)
        out = ALPHABET[r] + out
    return out


def _entries() -> list[dict[str, Any]]:
    return captions._entries()  # noqa: SLF001 (shared helper, read only)


def match(name: str) -> dict[str, Any] | None:
    """Find the captions entry of a file or folder path. Falls back on the sites `captions.find` skips."""
    e = captions.find(name)
    if e:
        return e
    keys = {x["key"]: x for x in _entries()}
    for k, x in keys.items():
        pre, _, ident = k.partition(":")
        if pre == "reddit" and any(f"comments{sep}{ident}" in name for sep in ("", "/", "-")):
            return x
    m = re.search(r"posts[-/]?(\d{10,})", name)
    if m and f"fb:grp:{m.group(1)}" in keys:
        return keys[f"fb:grp:{m.group(1)}"]
    m = re.search(r"fbid=(\d{8,})", name)
    if m and f"fb:photo:{m.group(1)}" in keys:
        return keys[f"fb:photo:{m.group(1)}"]
    for k, x in keys.items():
        pre, _, ident = k.partition(":")
        if pre == "li" and ident.split("_")[0] in name:
            return x
        if pre == "medibang" and ident in name:
            return x
    m = re.search(r"(?:^|/)\d{3}_(\d{16,19})(?:\.|_)", name)
    if m:
        e = keys.get(f"ig:{media_id_to_shortcode(m.group(1))}")
        if e:
            return e
    return None


def profile_of(name: str) -> dict[str, Any] | None:
    """A file named after an artist's profile page (instagram.com/<handle> or x.com/<handle>)."""
    for e in _entries():
        pre, _, ident = e["key"].partition(":")
        if pre == "igprofile" and re.search(rf"instagram\.com{re.escape(ident)}(?![A-Za-z0-9_])", name):
            return e
        if pre == "xprofile" and re.search(rf"x\.com{re.escape(ident)}(?![A-Za-z0-9_])", name):
            return e
    return None


def handles_of(entry: dict[str, Any]) -> list[str]:
    """Every artist handle named in the caption, in order, without duplicates."""
    out: list[str] = []
    for line in (entry.get("caption") or "").splitlines():
        if not ROLE.search(line):
            continue
        for h in HANDLE.findall(line):
            h = h.rstrip(".")
            if h.lower() not in [x.lower() for x in out]:
                out.append(h)
    return out


def cosplayer_of(entry: dict[str, Any]) -> str | None:
    m = re.search(r"(?im)cosplayers?\s*[:：]\s*(.+)$", entry.get("caption") or "")
    if not m:
        return None
    raw = m.group(1).replace("（", " (").replace("）", ") ")
    return re.sub(r"\s+", " ", common.clean_text(raw)).strip()


def is_official(entry: dict[str, Any] | None) -> bool:
    return bool(entry) and (entry.get("uploader_handle") or "").lower() in OFFICIAL


def uploader_name(entry: dict[str, Any]) -> str | None:
    up = entry.get("uploader")
    if isinstance(up, dict):
        return up.get("full_name") or up.get("username")
    return up or None


def platform_name(entry: dict[str, Any]) -> str:
    return captions.PLATFORM_NAMES.get(entry["platform"], entry["platform"].title())


def post_credit(entry: dict[str, Any], *, count: int = 1) -> dict[str, Any]:
    """The credit of a work posted in `entry`. `count` is how many pictures the post holds in our
    files: several artists on a post that holds several pictures cannot be told apart."""
    plat = platform_name(entry)
    url = entry.get("url") or None
    date = (entry.get("date") or "")[:10] or None
    by: str | None = None
    note: str | None = None
    kind = entry["key"].split(":", 1)[0]

    if is_official(entry):
        cosplayer = cosplayer_of(entry)
        hs = handles_of(entry)
        if cosplayer:
            by = cosplayer
            note = "Cosplay photos from the official Mobile Legends: Bang Bang post."
        elif len(hs) == 1:
            by = f"@{hs[0]}"
        elif len(hs) == 2 and count <= 2:
            by = f"@{hs[0]} and @{hs[1]}"
        elif len(hs) >= 2:
            by = "Several artists"
            note = (
                "Named in the post: "
                + ", ".join(f"@{h}" for h in hs)
                + ". The post does not say who made which picture."
            )
        else:
            note = "Shared by the official Mobile Legends: Bang Bang account, which does not name the maker."
    elif kind == "ig":
        name, handle = uploader_name(entry), entry.get("uploader_handle")
        if name and handle and name.lower() != handle.lower():
            by = f"{name} (@{handle})"
        else:
            by = f"@{handle}" if handle else name
    elif kind == "tt":
        m = re.search(r"tiktok\.com/@([^/]+)/", url or "")
        by = f"@{m.group(1)}" if m else (f"@{entry.get('uploader')}" if entry.get("uploader") else None)
    elif kind == "x":
        name, handle = uploader_name(entry), entry.get("uploader_handle")
        by = f"{name} (@{handle})" if name and handle else name
    elif kind == "li":
        slug = entry["key"].split(":", 1)[1]
        m = re.match(r"([a-z]+)-([a-z]+)-[0-9a-z]{6,}_", slug)
        if m:
            by = f"{m.group(1).title()} {m.group(2).title()}"
            note = "The name comes from the address of the post."
    else:
        by = uploader_name(entry)

    if kind == "fb":
        if "groups/illustratorrajin" in (url or ""):
            note = "Posted in the Facebook group illustratorrajin. The post does not name the artist."
        elif not by:
            note = "The post does not name the artist."
    if kind in ("reddit", "medibang") and not by:
        note = "The post cannot be read any more, so the artist is not named."

    out: dict[str, Any] = {"by": common.clean_text(by) if by else None, "platform": plat, "url": url}
    if date:
        out["date"] = date
    if note:
        out["note"] = common.clean_text(note)
    return out


def profile_credit(profile: dict[str, Any], post: dict[str, Any] | None) -> dict[str, Any]:
    """Credit of a picture named after an artist's profile. The link is the carousel post when we know it."""
    handle = profile["key"].split(":", 1)[1]
    out: dict[str, Any] = {
        "by": f"@{handle}",
        "platform": platform_name(post or profile),
        "url": (post or profile).get("url"),
    }
    d = ((post or {}).get("date") or "")[:10]
    if d:
        out["date"] = d
    out["note"] = (
        "One picture of a group post by Mobile Legends creators. The file is named after this artist's profile."
        if post
        else "The link is the artist's profile."
    )
    return out


if __name__ == "__main__":
    assert media_id_to_shortcode("3322036578790112022") == "C4aPqrho3sW"
    assert handles_of(
        {"caption": "Fan-made animation from MGL animators @anzsketch @mstrzei \nVoice actor of Fanny from MGL member @bleu_wolf99"}
    ) == ["anzsketch", "mstrzei"]
    assert cosplayer_of({"caption": "MLBB Layla&Fanny Cosplayer : XiXia（Heliko） Beta"}) == "XiXia (Heliko) Beta"
    print("ok")
