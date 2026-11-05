"""Walk the fan art sources, merge copies (same bytes, or the same picture at another size), and
decide the post and credit of each picture. Returns plain dicts; `build.py` turns them into items."""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import common  # noqa: E402
import resolve  # noqa: E402

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
VID_EXT = {".mp4"}
NEAR = 34  # dHash bits (of 256) under which two files are the same picture
# Files that sit under a post's name but are copies of another post's pictures (checked by eye).
MISNAMED = ("ruby-and-angela/art/fanart/many/instagram_p_CoZTtTdrbro",)

PAIR_CHARS = {
    "layla-and-fanny": ["fanny", "layla"],
    "ruby-and-angela": ["ruby", "angela"],
    "lesley-and-change": ["lesley", "change"],
    "vexana-and-guinevere": ["guinevere", "vexana"],
    "selena-and-obsidia": ["selena", "obsidia"],
}
FOLDER_CHAR = {
    "fanny": "fanny", "layla": "layla", "ruby": "ruby", "angela": "angela", "lesley": "lesley",
    "change": "change", "guinevere": "guinevere", "vexana": "vexana", "selena": "selena", "obsidia": "obsidia",
}


def rel(p: Path) -> str:
    return p.relative_to(common.MEDIA).as_posix()


def source_images() -> list[Path]:
    out: list[Path] = []
    for pf in PAIR_CHARS:
        root = common.MEDIA / pf / "art" / "fanart"
        for f in sorted(root.rglob("*")):
            if f.is_file() and f.suffix.lower() in IMG_EXT and "_cover." not in f.name:
                out.append(f)
    extra = common.MEDIA / "_others" / "promotional" / "instagram_p_C4aPqrho3sW"
    out += [f for f in sorted(extra.iterdir()) if f.suffix.lower() in IMG_EXT]
    return out


def cosplay_images() -> list[Path]:
    root = common.MEDIA / "layla-and-fanny" / "art" / "cosplay"
    return [f for f in sorted(root.rglob("*")) if f.is_file() and f.suffix.lower() in IMG_EXT]


def folder_chars(path: str) -> tuple[list[str], str]:
    """(characters named by the folders, the sub folder: both, many or a character)."""
    parts = path.split("/")
    pf = parts[0]
    if pf == "_others":
        return [], "many"
    sub = parts[3] if len(parts) > 4 else ""
    if sub in FOLDER_CHAR:
        return [FOLDER_CHAR[sub]], sub
    if sub == "both":
        return list(PAIR_CHARS[pf]), "both"
    return [], "many"


def dhash(path: Path):
    import numpy as np
    from PIL import Image, ImageOps

    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("L").resize((17, 16), Image.LANCZOS)
    a = np.asarray(im, dtype=np.int16)
    return (a[:, 1:] > a[:, :-1]).flatten()


def size_of(path: Path) -> tuple[int, int]:
    from PIL import Image

    with Image.open(path) as im:
        return im.size


def merge_groups(paths: list[Path], *, near: bool) -> list[list[Path]]:
    """Union of copies. Same bytes always; the same picture at another size when `near`."""
    parent = list(range(len(paths)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        parent[find(i)] = find(j)

    by_sha: dict[str, int] = {}
    for i, p in enumerate(paths):
        s = common.sha1_file(p)
        if s in by_sha:
            union(i, by_sha[s])
        else:
            by_sha[s] = i
    if near:
        reps = sorted({find(i) for i in range(len(paths))})
        feats = {i: dhash(paths[i]) for i in reps}
        for a in range(len(reps)):
            for b in range(a + 1, len(reps)):
                if int((feats[reps[a]] != feats[reps[b]]).sum()) <= NEAR:
                    union(reps[a], reps[b])
    groups: dict[int, list[Path]] = defaultdict(list)
    for i, p in enumerate(paths):
        groups[find(i)].append(p)
    return list(groups.values())


def index_in_name(name: str) -> int | None:
    m = re.search(r"\((\d+)\)", name)
    return int(m.group(1)) if m else None


def pick_post(members: list[str]) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str]:
    """(post entry, profile entry, how). Preference: a profile named file, a personal post,
    a single artist official post, then the earliest official post."""
    profile = None
    cands: list[dict[str, Any]] = []
    for m in members:
        pr = resolve.profile_of(m)
        if pr and not profile:
            profile = pr
        if any(m.startswith(x) for x in MISNAMED):
            continue
        e = resolve.match(m)
        if e and e["key"].split(":", 1)[0] not in ("igprofile", "xprofile") and e not in cands:
            cands.append(e)
    if not cands:
        return None, profile, "profile" if profile else "none"
    personal = [e for e in cands if not resolve.is_official(e)]
    if personal:
        return personal[0], profile, "personal"
    single = [e for e in cands if len(resolve.handles_of(e)) == 1]
    if single:
        return single[0], profile, "single"
    cands.sort(key=lambda e: e.get("date") or "9")
    return cands[0], profile, "official"


def build_groups() -> list[dict[str, Any]]:
    paths = source_images()
    groups: list[dict[str, Any]] = []
    for members in merge_groups(paths, near=True):
        sizes = {m: size_of(m) for m in members}
        members.sort(key=lambda m: (-(sizes[m][0] * sizes[m][1]), -m.stat().st_size, rel(m)))
        rels = [rel(m) for m in members]
        chars: list[str] = []
        subs: list[str] = []
        pairs_seen: list[str] = []
        for r in rels:
            c, sub = folder_chars(r)
            for x in c:
                if x not in chars:
                    chars.append(x)
            subs.append(sub)
            pf = r.split("/")[0]
            if pf in PAIR_CHARS and pf not in pairs_seen:
                pairs_seen.append(pf)
        post, profile, how = pick_post(rels)
        groups.append(
            {
                "rep": rels[0],
                "members": rels,
                "w": sizes[members[0]][0],
                "h": sizes[members[0]][1],
                "folder_chars": chars,
                "subs": subs,
                "pair_folders": pairs_seen,
                "post": post["key"] if post else None,
                "profile": profile["key"] if profile else None,
                "how": how,
                "post_hits": sorted({(resolve.match(r) or {}).get("key", "?") for r in rels}),
            }
        )
    groups.sort(key=lambda g: g["rep"])
    return groups


if __name__ == "__main__":
    import json

    gs = build_groups()
    out = Path(common.WORK / "fanart" / "groups.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(gs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(gs), "groups,", sum(len(g["members"]) for g in gs), "files")
    for i, g in enumerate(gs):
        if len(g["members"]) > 1 or g["post"] is None:
            print(i, g["how"], g["post"], g["profile"], g["post_hits"], g["pair_folders"], len(g["members"]))
