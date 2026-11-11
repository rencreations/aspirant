"""Add the source pictures that no Arts room ships to scripts/library/ignored.json, with the reason
the room's helper gave in curation/<room>.json. Run after the room scripts:

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/ignored.py
"""

from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import catalog  # noqa: E402
import common  # noqa: E402

ROOMS = ["splash", "scene", "comic", "game", "design", "others", "fanart", "cosplay"]
IGNORED = Path(__file__).resolve().parents[1] / "ignored.json"
HERE = Path(__file__).resolve().parent

EXTRA = {
    "media/layla-and-fanny/video/fanmade/cosplayer/audio.mp3": "Sound of a cosplay clip whose post the sources do not identify. It stays out of the Cosplay rooms (see curation/cosplay.json).",
}


def reasons() -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    for f in sorted(glob.glob(str(HERE / "curation" / "*.json"))):
        out.append((f, json.loads(Path(f).read_text(encoding="utf-8"))))
    return out


def reason_for(prefix: str, cur: list[tuple[str, dict]]) -> str | None:
    found: list[str] = []

    def walk(n, name):
        if isinstance(n, dict):
            sha = n.get("sha1") or n.get("sha")
            if isinstance(sha, str) and sha.startswith(prefix) and isinstance(n.get("reason") or n.get("why"), str):
                found.append(n.get("reason") or n.get("why"))
            for k, v in n.items():
                if isinstance(k, str) and k.startswith(prefix) and isinstance(v, dict):
                    r = v.get("reason") or v.get("why")
                    if isinstance(r, str):
                        found.append(r)
                walk(v, name)
        elif isinstance(n, list):
            for v in n:
                walk(v, name)

    for name, c in cur:
        walk(c, name)
    return found[0] if found else None


def main() -> None:
    ids: list[str] = []
    for r in ROOMS:
        d = json.loads((common.DATA_DIR / f"arts-{r}.json").read_text(encoding="utf-8"))
        ids += [i["id"] for i in d["items"]]
    blob = "\n".join(ids)
    cur = reasons()
    ignored = json.loads(IGNORED.read_text(encoding="utf-8"))
    added = 0
    for g in catalog.groups():
        if g.sha1[:6] in blob:
            continue
        why = reason_for(g.sha1[:6], cur) or "Not shipped in the Arts rooms (see scripts/library/arts_rooms/curation)."
        why = common.clean_text(why)
        for m in g.members:
            key = f"media/{m['rel']}"
            if ignored.get(key) != f"Arts rooms: {why}":
                ignored[key] = f"Arts rooms: {why}"
                added += 1
    for key, why in EXTRA.items():
        if ignored.get(key) != why:
            ignored[key] = why
            added += 1
    problems = common.check_json_text(ignored, "ignored")
    if problems:
        raise SystemExit("\n".join(problems[:20]))
    IGNORED.write_text(json.dumps(ignored, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"ignored.json: {added} entries added or changed, {len(ignored)} in all")


if __name__ == "__main__":
    main()
