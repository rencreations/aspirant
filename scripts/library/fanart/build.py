"""Build the Fanart room: pictures, cosplay and fan videos with credits.

    C:/Users/muham/anaconda3/python.exe scripts/library/fanart/build.py [--regroup]

Writes the mirror keys fanart/<id>/{t,p,f}.webp (and video.mp4 for videos) and
apps/web/public/data/library/fanart.json. Safe to run again: finished files are skipped.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import captions  # noqa: E402
import common  # noqa: E402
import curated  # noqa: E402
import inventory  # noqa: E402
import resolve  # noqa: E402

CACHE = common.WORK / "fanart" / "groups-cache.json"
FRAMES = common.WORK / "fanart" / "frames"
NAMES = {
    "fanny": "Fanny", "layla": "Layla", "ruby": "Ruby", "angela": "Angela", "lesley": "Lesley",
    "change": "Chang'e", "guinevere": "Guinevere", "vexana": "Vexana", "selena": "Selena", "obsidia": "Obsidia",
}
KEYS = {e["key"]: e for e in captions._entries()}  # noqa: SLF001
OFFICIAL_REEL_NOTE = "A reel posted by the official account, cut from in-game animation. It is not part of the story."


def sort_chars(chars: list[str]) -> list[str]:
    return [c for c in common.CHAR_SLUGS if c in chars]


def pairs_of(chars: list[str]) -> list[str]:
    out: list[str] = []
    for c in chars:
        p = common.pair_of_char(c)
        if p and p not in out:
            out.append(p)
    return out


def name_list(chars: list[str]) -> str:
    n = [NAMES[c] for c in chars]
    return n[0] if len(n) == 1 else (" and ".join(n) if len(n) == 2 else ", ".join(n[:-1]) + " and " + n[-1])


def title_for(chars: list[str], kind: str, rep: str, members: list[str]) -> str:
    t = lookup(curated.TITLES, rep, members)
    if t:
        return t
    suffix = "cosplay" if kind == "cosplay" else "fan art"
    if not chars:
        return f"Mobile Legends heroes, {suffix}"
    if len(chars) > 4:
        return f"The Aspirants together, {suffix}"
    return f"{name_list(chars)}, {suffix}"


def lookup(table: dict[str, Any], rep: str, members: list[str]) -> Any:
    """A curated fact for a picture. Full path keys must equal the picture's largest copy; a short
    key matches any copy. The longest key wins."""
    best = None
    for key, v in table.items():
        full = "/art/fanart/" in key
        hit = key == rep if full else (key in rep or any(key in m for m in members))
        if hit and (best is None or len(key) > len(best[0])):
            best = (key, v)
    return best[1] if best else None


def artist_key(by: str | None) -> str | None:
    if not by or by == "Several artists" or " and @" in by:
        return None
    m = re.search(r"\(@([^)]+)\)", by)
    if m:
        return m.group(1).lower()
    return by.lstrip("@").lower()


def load_groups(regroup: bool) -> list[dict[str, Any]]:
    if CACHE.exists() and not regroup:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    gs = inventory.build_groups()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(gs, ensure_ascii=False), encoding="utf-8")
    return gs


# ---------------------------------------------------------------------------------------------
# Pictures
# ---------------------------------------------------------------------------------------------


def image_items(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    posts: dict[str, int] = {}
    for g in groups:
        if g["post"]:
            posts[g["post"]] = posts.get(g["post"], 0) + 1
    used: set[str] = set()
    items: list[dict[str, Any]] = []
    for g in groups:
        rep, members = g["rep"], g["members"]
        post = KEYS.get(g["post"]) if g["post"] else None
        profile = KEYS.get(g["profile"]) if g["profile"] else None
        how = g["how"]
        if how == "personal" and post:
            credit = resolve.post_credit(post)
        elif profile:
            credit = resolve.profile_credit(profile, post)
        elif post:
            credit = resolve.post_credit(post, count=posts[g["post"]])
        else:
            credit = {"by": None, "platform": None, "url": None}
        chars = lookup(curated.CHARS, rep, members)
        if chars is None:
            chars = g["folder_chars"]
            if not chars:
                print("  NO CHARS", rep)
        chars = sort_chars(chars)
        base = common.slugify(g["post"]) if g["post"] else common.slugify(Path(rep).stem)[:40]
        n = None
        for m in members:
            e = resolve.match(m)
            if post and e and e["key"] == post["key"] and inventory.index_in_name(m):
                n = inventory.index_in_name(m)
                break
        iid = f"{base}-{n}" if n else base
        k = 2
        while iid in used:
            iid = f"{base}-{n or 0}-{k}"
            k += 1
        used.add(iid)
        note = lookup(curated.NOTES, rep, members)
        if note:
            credit = {**credit, "note": note}
        tags = list(lookup(curated.TAGS, rep, members) or [])
        if g["subs"] and all(s == "many" for s in g["subs"]) and len(chars) > 2:
            tags.append("group")
        items.append(
            {
                "id": f"fanart-{iid}",
                "kind": "image",
                "title": title_for(chars, "image", rep, members),
                "chars": chars,
                "pairs": pairs_of(chars),
                "tags": tags,
                "credit": credit,
                "_src": members,
                "_rep": rep,
            }
        )
    return items


def cosplay_items() -> list[dict[str, Any]]:
    paths = inventory.cosplay_images()
    items: list[dict[str, Any]] = []
    for grp in inventory.merge_groups(paths, near=False):
        grp.sort(key=lambda p: inventory.rel(p))
        rel0 = inventory.rel(grp[0])
        e = resolve.match(rel0)
        if not e:
            print("  cosplay without post", rel0)
            continue
        chars, _ = inventory.folder_chars(rel0)
        n = inventory.index_in_name(rel0)
        iid = f"cosplay-{common.slugify(e['key'])}" + (f"-{n}" if n else "")
        items.append(
            {
                "id": f"fanart-{iid}",
                "kind": "cosplay",
                "title": title_for(sort_chars(chars), "cosplay", rel0, [rel0]),
                "chars": sort_chars(chars),
                "pairs": pairs_of(chars),
                "tags": ["cosplay", "photo"],
                "credit": resolve.post_credit(e),
                "_src": [inventory.rel(p) for p in grp],
                "_rep": rel0,
            }
        )
    return items


def looks_like_line_art(key: str) -> bool:
    """A grey, bright picture with little colour is a sketch or line art."""
    from PIL import Image, ImageStat

    with Image.open(common.key_path(key)) as im:
        small = im.convert("RGB").resize((64, 64))
        sat = ImageStat.Stat(small.convert("HSV")).mean[1]
        luma = ImageStat.Stat(small.convert("L")).mean[0]
    return sat < 14 and luma > 190


def make_image(it: dict[str, Any]) -> None:
    src = common.MEDIA / it["_rep"]
    it["img"] = common.image_set(src, f"fanart/{it['id'].removeprefix('fanart-')}", full_max=3840, q_full=88, q_small=80)
    if it["kind"] == "image" and not it["tags"] and looks_like_line_art(it["img"]["t"]):
        it["tags"] = ["sketch"]
        it["title"] = it["title"].replace(", fan art", ", sketch")


# ---------------------------------------------------------------------------------------------
# Videos
# ---------------------------------------------------------------------------------------------


def encode(src: Path, dst: Path) -> None:
    if common.fresh(dst, src):
        return
    tmp = dst.with_name(dst.stem + ".part.mp4")
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high",
        "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ac", "2", str(tmp),
    ]
    subprocess.run(cmd, check=True, timeout=600)
    tmp.replace(dst)


def poster_for(src: Path, folder: Path | None, vid_id: str) -> Path:
    """The site's own cover when its shape matches the video, else a frame that is not black."""
    from PIL import Image, ImageStat

    info = common.ffprobe(src)
    want = info["w"] / info["h"] if info["h"] else 16 / 9
    if folder:
        for pat in ("*_cover.*", "thumbnail.*"):
            f = next(iter(sorted(folder.glob(pat))), None)
            if f and f.suffix.lower() in (".jpg", ".png", ".jpeg", ".webp"):
                with Image.open(f) as im:
                    if abs((im.width / im.height) / want - 1) < 0.15:
                        return f
    FRAMES.mkdir(parents=True, exist_ok=True)
    out = FRAMES / f"{vid_id}.png"
    if out.exists():
        return out
    # Take the most colourful frame among a few samples (the first frame is often black or white).
    best, best_score = None, -1.0
    dur = max(info["dur"], 1.0)
    for k in range(9):
        t = round(0.3 + k * (dur * 0.85) / 8, 2)
        tmp = FRAMES / f"{vid_id}-{k}.png"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(src), "-frames:v", "1", str(tmp)], check=False, timeout=120)
        if not tmp.exists():
            continue
        with Image.open(tmp) as im:
            small = im.convert("RGB").resize((64, 64))
            luma = ImageStat.Stat(small.convert("L")).mean[0]
            sat = ImageStat.Stat(small.convert("HSV")).mean[1]
        score = sat + (0 if luma > 30 else -200)
        if score > best_score:
            best, best_score = tmp, score
    if best is None:
        return out
    best.replace(out)
    for f in FRAMES.glob(f"{vid_id}-*.png"):
        f.unlink()
    return out


def video_items() -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    for v in curated.VIDEOS:
        v = dict(v)
        if "dir" in v:
            folder = common.MEDIA / v["dir"]
            vids = sorted(f for f in folder.iterdir() if f.suffix.lower() == ".mp4")
            v["src"] = vids[0]
            v["folder"] = folder
            v["consumed"] = [inventory.rel(f) for f in folder.iterdir() if f.is_file()]
        else:
            v["src"] = common.MEDIA / v["file"]
            v["folder"] = None
            v["consumed"] = [v["file"], *v.get("copies", [])]
        specs.append(v)
    edits_root = common.MEDIA / "selena-and-obsidia" / "video" / "_edits"
    for d in sorted(edits_root.iterdir()):
        title, chars = curated.EDITS[d.name]
        vid = next(f for f in d.iterdir() if f.suffix.lower() == ".mp4")
        media = re.search(r"_(\d{16,19})\.mp4$", vid.name).group(1)  # type: ignore[union-attr]
        specs.append(
            {
                "src": vid, "folder": d, "id": f"edit-{d.name}", "title": title, "chars": chars,
                "tags": ["edit", "reel", "official"], "media": media, "edit": True,
                "consumed": [inventory.rel(f) for f in d.iterdir() if f.is_file()],
            }
        )

    def work(v: dict[str, Any]) -> dict[str, Any]:
        vid_id = v["id"]
        dst = common.key_path(f"fanart/{vid_id}/video.mp4")
        encode(v["src"], dst)
        pf = poster_for(v["src"], v["folder"], vid_id)
        img = common.image_set(pf, f"fanart/{vid_id}", full_max=1920, q_full=88, q_small=80)
        info = common.ffprobe(dst)
        v["img"] = img
        v["video"] = {
            "src": f"fanart/{vid_id}/video.mp4", "poster": img["p"], "w": info["w"], "h": info["h"],
            "dur": round(info["dur"], 2),
        }
        v["has_audio"] = info["has_audio"]
        return v

    with ThreadPoolExecutor(3) as ex:
        done = list(ex.map(work, specs))

    items: list[dict[str, Any]] = []
    for v in done:
        e = KEYS.get(v.get("post", "")) if v.get("post") else None
        if v.get("media"):
            code = resolve.media_id_to_shortcode(v["media"])
            e = KEYS.get(f"ig:{code}")
            if e is None:
                credit = {
                    "by": None, "platform": "Instagram", "url": f"https://www.instagram.com/p/{code}/",
                    "note": "The link is rebuilt from the file name. The post is not in the caption records.",
                }
            elif v.get("edit"):
                credit = {
                    "by": "Mobile Legends: Bang Bang", "platform": "Instagram", "url": e["url"],
                    "date": e["date"][:10], "note": OFFICIAL_REEL_NOTE,
                }
            else:
                credit = resolve.post_credit(e)
        elif e is not None:
            credit = resolve.post_credit(e, count=1)
        else:
            credit = {"by": None, "platform": None, "url": None}
        if v.get("note"):
            credit = {**credit, "note": v["note"]}
        chars = sort_chars(v["chars"])
        items.append(
            {
                "id": f"fanart-video-{v['id']}",
                "kind": "video",
                "title": v["title"],
                "chars": chars,
                "pairs": pairs_of(chars),
                "tags": v["tags"] + ([] if v["has_audio"] else ["silent"]),
                "credit": credit,
                "canon": "non-canon" if v.get("edit") else "fan",
                "img": v["img"],
                "video": v["video"],
                "_src": v["consumed"],
            }
        )
    return items


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------


def finish(it: dict[str, Any]) -> dict[str, Any]:
    pairs = it["pairs"]
    credit = {k: v for k, v in it["credit"].items() if v not in (None, "") or k in ("by", "platform", "url")}
    out: dict[str, Any] = {
        "id": it["id"],
        "kind": it["kind"],
        "title": common.clean_text(it["title"]),
        "collection": "fanart",
        "chars": it["chars"],
        "pair": pairs[0] if len(pairs) == 1 else None,
        "pairs": pairs,
        "canon": it.get("canon", "fan"),
        "tags": it["tags"],
        "credit": credit,
        "platform": credit.get("platform"),
        "date": credit.get("date"),
        "artist": artist_key(credit.get("by")) if it.get("canon", "fan") == "fan" else None,
        "img": it["img"],
    }
    if "video" in it:
        out["video"] = it["video"]
    out["src"] = it["_src"]
    return out


def update_ignored(extra: dict[str, str]) -> None:
    path = Path(__file__).resolve().parents[1] / "ignored.json"
    cur = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    cur.update(extra)
    path.write_text(json.dumps(dict(sorted(cur.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    t0 = time.time()
    groups = load_groups("--regroup" in sys.argv)
    print(len(groups), "picture groups from", sum(len(g["members"]) for g in groups), "files", flush=True)
    imgs = image_items(groups)
    cos = cosplay_items()
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(make_image, imgs + cos))
    print("pictures done", round(time.time() - t0), "s", flush=True)
    vids = video_items()
    print("videos done", round(time.time() - t0), "s", flush=True)

    items = [finish(i) for i in imgs + cos + vids]
    items.sort(key=lambda i: (i["date"] or "0000", i["id"]), reverse=True)
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids)), "duplicate ids"
    common.write_json("fanart", {"v": 1, "slug": "fanart", "items": items})

    update_ignored(
        {
            "media/layla-and-fanny/video/fanmade/cosplayer/001_2756751471464452184.mp4": "cosplay without an identified post",
            "media/layla-and-fanny/video/fanmade/cosplayer/readme.txt": "cosplay without an identified post",
        }
    )
    kinds: dict[str, int] = {}
    for i in items:
        kinds[i["kind"]] = kinds.get(i["kind"], 0) + 1
    mirror = sum(f.stat().st_size for f in (common.LIB_ROOT / "fanart").rglob("*") if f.is_file())
    print(kinds, "mirror", common.human(mirror), "total", round(time.time() - t0), "s")
    shown = {s for i in items for s in i["src"]}
    print("source files used:", len(shown))


if __name__ == "__main__":
    main()
