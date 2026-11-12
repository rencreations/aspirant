"""Intake of the fan art and cosplay folders the owner added on 12 Nov 2026 (C:\\Users\\muham\\Downloads).

    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/intake.py freeze
    C:/Users/muham/anaconda3/python.exe scripts/library/arts_rooms/intake.py inventory

`freeze` copies every file of the 14 folders to D:\\ren\\aspirant-work\\intake\\2026-11-12\\files\\<sha1>.<ext>
(short, safe names: some source names are over 200 characters or hold % and #) and writes manifest.json,
which maps each copy to every original path. The Downloads folders are never changed.

`inventory` reads the manifest and writes inventory.json: size in pixels, the 256 bit difference hash
that fanart/inventory.py uses for "the same picture at another size", the source of the file as far as
its NAME says (platform, post code, handle, a link that is certain), and for a video its ffprobe facts and
three frames. Nothing here decides what is shown: that is curation/intake.json (the later steps).
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

DOWNLOADS = Path(r"C:\Users\muham\Downloads")
FOLDERS = [
    "cosplay", "fanny", "angela", "aspirants", "ruby-and-angela", "ruby", "change",
    "guin-and-vexana", "selena", "layla", "lesley", "guinevere", "obsidia", "obsidia-and-selena",
]
STAMP = "2026-11-12"
BASE = common.WORK / "intake" / STAMP
FILES = BASE / "files"
FRAMES = BASE / "frames"
MANIFEST = BASE / "manifest.json"
INVENTORY = BASE / "inventory.json"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
VID_EXT = {".mp4"}


def long(p: Path) -> str:
    """The extended length form of a Windows path (some source names are very long)."""
    return "\\\\?\\" + str(p)


def sha1_of(path: Path) -> str:
    h = hashlib.sha1()
    with open(long(path), "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------------------------
# freeze
# --------------------------------------------------------------------------------------------


def freeze() -> None:
    FILES.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    for folder in FOLDERS:
        root = DOWNLOADS / folder
        if not root.is_dir():
            raise SystemExit(f"missing folder {root}")
        for p in sorted(root.rglob("*")):
            if not p.is_file():
                continue
            ext = p.suffix.lower()
            if ext not in IMG_EXT | VID_EXT:
                print("  skipped (not a picture or an mp4):", p.relative_to(DOWNLOADS))
                continue
            sha = sha1_of(p)
            dest = FILES / f"{sha}{ext}"
            if not dest.exists():
                with open(long(p), "rb") as src, open(dest, "wb") as out:
                    shutil.copyfileobj(src, out)
            entries.append({
                "orig": p.relative_to(DOWNLOADS).as_posix(),
                "folder": folder,
                "sha1": sha,
                "ext": ext,
                "bytes": p.stat().st_size,
            })
    MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    uniq = len({e["sha1"] for e in entries})
    print(f"{len(entries)} files, {uniq} different by content, copied to {FILES}")


# --------------------------------------------------------------------------------------------
# What the NAME of a file says about where it came from
# --------------------------------------------------------------------------------------------


def source_of(orig: str) -> dict:
    """{"platform", "post", "handle", "url", "kind"} read from the path, never guessed.

    `url` is only set when the name gives it with certainty. `kind` says what the name is:
    post (a post of a platform), file (a bare file name with no source), video-name (a downloader's
    `<name>_video_no_watermark`).
    """
    parts = [unquote(x) for x in orig.split("/")]
    out = {"platform": None, "post": None, "handle": None, "url": None, "kind": "file"}
    # The innermost folder or the file name that names a post wins.
    for name in list(reversed(parts[1:])) or []:
        stem = re.sub(r"\.(?:jpe?g|png|webp|mp4)$", "", name, flags=re.I)
        m = re.match(r"instagram_(p|reel)_([A-Za-z0-9_-]+)$", stem)
        if m:
            seg = "reel" if m.group(1) == "reel" else "p"
            out.update(platform="Instagram", post=m.group(2), kind="post", url=f"https://www.instagram.com/{seg}/{m.group(2)}/")
            return out
        m = re.match(r"httpswww\.instagram\.com(p|reel)([A-Za-z0-9_-]{11})(?:_?img_index=\d+)?$", stem)
        if m:
            seg = "reel" if m.group(1) == "reel" else "p"
            out.update(platform="Instagram", post=m.group(2), kind="post", url=f"https://www.instagram.com/{seg}/{m.group(2)}/")
            return out
        m = re.match(r"httpswww\.tiktok\.com@([A-Za-z0-9_.]+?)video(\d{15,})$", stem)
        if m:
            out.update(platform="TikTok", post=m.group(2), handle=m.group(1), kind="post",
                       url=f"https://www.tiktok.com/@{m.group(1)}/video/{m.group(2)}")
            return out
        m = re.match(r"httpsx\.com([A-Za-z0-9_]+?)status(\d{10,})$", stem)
        if m:
            out.update(platform="X", post=m.group(2), handle=m.group(1), kind="post",
                       url=f"https://x.com/{m.group(1)}/status/{m.group(2)}")
            return out
        m = re.match(r"httpswww\.pixiv\.netenartworks(\d+)$", stem) or re.match(r"https://www\.pixiv\.net/en/artworks/(\d+)$", stem)
        if m:
            out.update(platform="Pixiv", post=m.group(1), kind="post", url=f"https://www.pixiv.net/en/artworks/{m.group(1)}")
            return out
        m = re.match(r"httpswww\.artstation\.comartwork([A-Za-z0-9]+)$", stem)
        if m:
            out.update(platform="ArtStation", post=m.group(1), kind="post", url=f"https://www.artstation.com/artwork/{m.group(1)}")
            return out
        m = re.match(r"httpsmedibang\.compicture([a-z0-9]+)$", stem)
        if m:
            out.update(platform="MediBang", post=m.group(1), kind="post", url=f"https://medibang.com/picture/{m.group(1)}/")
            return out
        m = re.match(r"httpswww\.deviantart\.com(.+)$", stem)
        if m:
            rest = m.group(1)
            # <user>art<Title>-<id>: the last `art` whose rest looks like a slug with a hyphen and a number.
            cands = [i for i in range(len(rest)) if rest.startswith("art", i) and re.fullmatch(r"[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*-\d{6,}", rest[i + 3:])]
            if cands:
                i = cands[-1]
                user, slug = rest[:i], rest[i + 3:]
                out.update(platform="DeviantArt", post=slug.rsplit("-", 1)[1], handle=user, kind="post",
                           url=f"https://www.deviantart.com/{user}/art/{slug}")
                return out
        m = re.match(r"httpswww\.reddit\.comrMobileLegendsGamecomments([a-z0-9]{6,})", stem)
        if m:
            rest = m.group(1)
            # Reddit ids of 2022 to 2026: 7 characters when they start with 1, else 6.
            n = 7 if rest.startswith("1") else 6
            out.update(platform="Reddit", post=rest[:n], kind="post", url=f"https://www.reddit.com/comments/{rest[:n]}/")
            return out
        if re.match(r"https://www\.linkedin\.com/posts/", stem):
            out.update(platform="LinkedIn", post=stem, kind="post", url=stem)
            return out
        if re.match(r"https://www\.facebook\.com/photo/\?fbid=\d+", stem):
            out.update(platform="Facebook", post=re.search(r"fbid=(\d+)", stem).group(1), kind="post", url=stem)
            return out
        m = re.match(r"httpswww\.facebook\.comreel(\d+)$", stem)
        if m:
            out.update(platform="Facebook", post=m.group(1), kind="post", url=f"https://www.facebook.com/reel/{m.group(1)}")
            return out
        m = re.match(r"httpswww\.facebook\.comgroups(\d+)posts(\d+)$", stem)
        if m:
            out.update(platform="Facebook", post=m.group(2), kind="post", url=f"https://www.facebook.com/groups/{m.group(1)}/posts/{m.group(2)}/")
            return out
        m = re.match(r"httpswww\.facebook\.comgroups([A-Za-z0-9.]+?)posts(\d+)$", stem)
        if m:
            out.update(platform="Facebook", post=m.group(2), kind="post", url=f"https://www.facebook.com/groups/{m.group(1)}/posts/{m.group(2)}/")
            return out
        # A page post: <page>posts<slug><numeric id>. The page name is what the name gives; the id is the trailing digits.
        m = re.match(r"httpswww\.facebook\.com([A-Za-z0-9.]+?)posts(.+?)(\d{12,})$", stem)
        if m:
            out.update(platform="Facebook", post=m.group(3), handle=m.group(1), kind="post",
                       url=f"https://www.facebook.com/{m.group(1)}/posts/{m.group(3)}")
            return out
        m = re.match(r"(.+?)_video_no_watermark$", stem)
        if m:
            out.update(kind="video-name", handle=m.group(1))
            return out
    return out


# --------------------------------------------------------------------------------------------
# inventory
# --------------------------------------------------------------------------------------------


def dhash256(path: Path) -> str:
    import numpy as np
    from PIL import Image, ImageOps

    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        if getattr(im, "is_animated", False):
            im.seek(0)
        im = im.convert("L").resize((17, 16), Image.LANCZOS)
    a = np.asarray(im, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return "".join("1" if b else "0" for b in bits)


def frames_of(sha: str, path: Path, dur: float) -> list[str]:
    FRAMES.mkdir(parents=True, exist_ok=True)
    outs = []
    for n, frac in enumerate((0.08, 0.5, 0.9)):
        out = FRAMES / f"{sha}-{n}.jpg"
        if not out.exists():
            tail = ["-frames:v", "1", "-vf", "scale='min(1000,iw)':-2", "-q:v", "3", str(out)]
            try:
                common.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{max(0.0, dur * frac):.2f}", "-i", str(path)] + tail)
            except subprocess.CalledProcessError:
                out.unlink(missing_ok=True)
            if not out.exists():
                # A seek past the last frame of a short clip: take the last half second instead.
                common.run(["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.5", "-i", str(path)] + tail)
        outs.append(out.name)
    return outs


def inventory() -> None:
    from PIL import Image

    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_sha: dict[str, dict] = {}
    for e in man:
        rec = by_sha.setdefault(e["sha1"], {"sha1": e["sha1"], "ext": e["ext"], "bytes": e["bytes"], "origs": [], "folders": []})
        rec["origs"].append(e["orig"])
        if e["folder"] not in rec["folders"]:
            rec["folders"].append(e["folder"])
    recs = []
    for sha, rec in by_sha.items():
        path = FILES / f"{sha}{rec['ext']}"
        rec["source"] = source_of(rec["origs"][0])
        # A copy under another folder may name the post when the first does not.
        for o in rec["origs"][1:]:
            s = source_of(o)
            if rec["source"]["kind"] == "file" and s["kind"] != "file":
                rec["source"] = s
        if rec["ext"] in VID_EXT:
            info = common.ffprobe(path)
            rec["video"] = info
            rec["frames"] = frames_of(sha, path, float(info.get("dur") or info.get("duration") or 2.0))
            rec["kind"] = "video"
        else:
            try:
                with Image.open(path) as im:
                    rec["w"], rec["h"] = im.size
                    rec["fmt"] = im.format
                    rec["animated"] = bool(getattr(im, "is_animated", False))
                rec["dhash"] = dhash256(path)
                rec["kind"] = "image"
            except Exception as e:  # noqa: BLE001
                rec["error"] = f"{type(e).__name__}: {e}"
        recs.append(rec)
    recs.sort(key=lambda r: r["origs"][0])
    INVENTORY.write_text(json.dumps(recs, ensure_ascii=False, indent=1), encoding="utf-8")
    kinds = {}
    for r in recs:
        kinds[r.get("kind", "error")] = kinds.get(r.get("kind", "error"), 0) + 1
    print(f"{len(recs)} different files: {kinds}")
    srcs = {}
    for r in recs:
        k = (r["source"]["platform"] or r["source"]["kind"])
        srcs[k] = srcs.get(k, 0) + 1
    print("sources by name:", srcs)


# --------------------------------------------------------------------------------------------
# duplicates
# --------------------------------------------------------------------------------------------

NEAR = 34  # bits of 256 (fanart/inventory.py): the same picture at another size
DATA = common.DATA_DIR


def existing_pictures() -> list[dict]:
    """Every picture the site already shows, with the mirror file of its preview."""
    out: list[dict] = []
    seen: set[str] = set()

    def add(room: str, iid: str, title: str, key: str | None, url: str | None, src) -> None:
        if not key or key in seen:
            return
        path = common.LIB_ROOT / key
        if not path.is_file():
            return
        seen.add(key)
        out.append({"room": room, "id": iid, "title": title, "key": key, "url": url, "src": src, "path": str(path)})

    for slug in ("arts-fanart", "arts-cosplay", "arts-others", "arts-splash", "arts-scene", "arts-game", "arts-design", "arts-comic"):
        d = json.loads((DATA / f"{slug}.json").read_text(encoding="utf-8"))
        for it in d["items"]:
            img = it.get("img")
            if img:
                add(slug, it["id"], it.get("title", ""), img.get("p"), (it.get("credit") or {}).get("url"), it.get("src"))
    d = json.loads((DATA / "others.json").read_text(encoding="utf-8"))
    for it in d["items"]:
        img = it.get("img")
        if img:
            add("others", it["id"], it.get("title", ""), img.get("p"), None, it.get("src"))
    d = json.loads((DATA / "video-others.json").read_text(encoding="utf-8"))
    for it in d["items"]:
        add("video-others", it["id"], it.get("title", ""), it.get("thumb"), (it.get("credit") or {}).get("url"), None)
    return out


def ham(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


def dupes() -> None:
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    ex = existing_pictures()
    cache = BASE / "existing-dhash.json"
    hashes = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    for e in ex:
        if e["key"] not in hashes:
            try:
                hashes[e["key"]] = dhash256(Path(e["path"]))
            except Exception:  # noqa: BLE001
                hashes[e["key"]] = None
    cache.write_text(json.dumps(hashes), encoding="utf-8")
    print(f"{len(ex)} pictures on the site compared")

    # post codes already on the site
    site_text = " ".join(filter(None, [e["url"] for e in ex])) + " " + " ".join(str(e["src"]) for e in ex)
    cands: list[dict] = []
    imgs = [r for r in inv if r.get("kind") == "image"]
    vids = [r for r in inv if r.get("kind") == "video"]
    for r in imgs:
        for e in ex:
            h = hashes.get(e["key"])
            if h and ham(r["dhash"], h) <= NEAR:
                cands.append({"new": r["sha1"], "with": "site", "room": e["room"], "id": e["id"], "title": e["title"], "key": e["key"], "dist": ham(r["dhash"], h)})
    for i, a in enumerate(imgs):
        for b in imgs[i + 1:]:
            d = ham(a["dhash"], b["dhash"])
            if d <= NEAR:
                cands.append({"new": a["sha1"], "with": "batch", "other": b["sha1"], "dist": d})
    # video frames against the posters of the videos already on the site
    for r in vids:
        for fr in r["frames"]:
            h = dhash256(FRAMES / fr)
            for e in ex:
                if e["room"] in ("arts-fanart", "video-others"):
                    eh = hashes.get(e["key"])
                    if eh and ham(h, eh) <= NEAR:
                        cands.append({"new": r["sha1"], "with": "site-video", "room": e["room"], "id": e["id"], "title": e["title"], "key": e["key"], "dist": ham(h, eh), "frame": fr})
    posts = []
    for r in inv:
        s = r["source"]
        if s["post"] and s["platform"] == "Instagram" and s["post"] in site_text:
            posts.append({"new": r["sha1"], "post": s["post"], "orig": r["origs"][0]})
    out = {"candidates": cands, "post_on_site": posts}
    (BASE / "dupes.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(cands), "look-alike pairs;", len(posts), "files whose Instagram post code is already on the site")
    by = {}
    for c in cands:
        by.setdefault(c["with"], 0)
        by[c["with"]] += 1
    print(by)


# --------------------------------------------------------------------------------------------
# sheets (for looking)
# --------------------------------------------------------------------------------------------

REVIEW = BASE / "review"


def _fit(path: Path, box: int):
    from PIL import Image, ImageOps

    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        if getattr(im, "is_animated", False):
            im.seek(0)
        im = im.convert("RGB")
        im.thumbnail((box, box))
        return im.copy()


def _label(draw, xy, text, fill=(255, 255, 0)):
    x, y = xy
    draw.rectangle((x, y, x + 8 * len(text) + 6, y + 14), fill=(0, 0, 0))
    draw.text((x + 3, y + 1), text, fill=fill)


def pair_sheets() -> None:
    from PIL import Image, ImageDraw

    REVIEW.mkdir(parents=True, exist_ok=True)
    inv = {r["sha1"]: r for r in json.loads(INVENTORY.read_text(encoding="utf-8"))}
    d = json.loads((BASE / "dupes.json").read_text(encoding="utf-8"))
    ex = {e["key"]: e for e in existing_pictures()}

    def path_of(sha: str, frame: str | None = None) -> Path:
        r = inv[sha]
        return FRAMES / frame if frame else FILES / f"{sha}{r['ext']}"

    tiles = []
    for i, c in enumerate(d["candidates"]):
        a = path_of(c["new"], c.get("frame"))
        b = Path(ex[c["key"]]["path"]) if c["with"] != "batch" else path_of(c["other"])
        la = f"#{i} NEW {inv[c['new']]['origs'][0][-34:]}"
        lb = (f"{c['room']} {c['id'][-30:]}" if c["with"] != "batch" else "BATCH " + inv[c["other"]]["origs"][0][-30:]) + f"  d={c['dist']}"
        tiles.append((a, b, la, lb))
    per = 6
    for n in range(0, len(tiles), per):
        chunk = tiles[n:n + per]
        sheet = Image.new("RGB", (2 * 2 * 430, 3 * 450), (30, 30, 30))
        dr = ImageDraw.Draw(sheet)
        for k, (a, b, la, lb) in enumerate(chunk):
            col, row = k % 2, k // 2
            x0, y0 = col * 860, row * 450
            for j, (pth, lab) in enumerate(((a, la), (b, lb))):
                im = _fit(pth, 420)
                sheet.paste(im, (x0 + j * 430, y0 + 18))
                _label(dr, (x0 + j * 430, y0 + 2), lab[:52])
        out = REVIEW / f"pairs-{n // per:02d}.png"
        sheet.save(out)
        print(out)


# --------------------------------------------------------------------------------------------
# decisions: duplicates, then contact sheets
# --------------------------------------------------------------------------------------------

CURATION = Path(__file__).resolve().parent / "curation" / "intake.json"
# Pairs that look alike but are different photos (frames of one shoot): both are kept (checked by eye).
NOT_DUPLICATES = {
    frozenset({"instagram_p_C9KPZdSS6Lf/2.jpg", "instagram_p_C9KPZdSS6Lf/3.jpg"}),
    frozenset({"instagram_p_DVIR3JlE_ge/1.jpg", "instagram_p_DVIR3JlE_ge/8.jpg"}),
}


def load_cur() -> dict:
    return json.loads(CURATION.read_text(encoding="utf-8")) if CURATION.exists() else {}


def dupmark() -> None:
    inv = {r["sha1"]: r for r in json.loads(INVENTORY.read_text(encoding="utf-8"))}
    d = json.loads((BASE / "dupes.json").read_text(encoding="utf-8"))
    ex = {e["key"]: e for e in existing_pictures()}
    dup: dict[str, dict] = {}
    for c in d["candidates"]:
        if c["with"] in ("site", "site-video"):
            dup.setdefault(c["new"], {"of": f"{c['room']}:{c['id']}", "dist": c["dist"], "kind": "site"})
    area = lambda r: (r.get("w", 0) * r.get("h", 0), r["bytes"])  # noqa: E731
    for c in d["candidates"]:
        if c["with"] != "batch":
            continue
        a, b = inv[c["new"]], inv[c["other"]]
        if any(frozenset(x[-len(k):] for x in (a["origs"][0], b["origs"][0])) == k for k in NOT_DUPLICATES for _ in [0]):
            continue
        if any(a["origs"][0].endswith(next(iter(k))) or a["origs"][0].endswith(list(k)[1]) for k in NOT_DUPLICATES) and any(
            b["origs"][0].endswith(x) for k in NOT_DUPLICATES for x in k
        ):
            continue
        keep, drop = (a, b) if area(a) >= area(b) else (b, a)
        if drop["sha1"] in dup or keep["sha1"] in dup:
            # one of the two is already a copy of something on the site: both go, the site copy stays
            for r in (a, b):
                dup.setdefault(r["sha1"], {"of": "batch copy of a picture that is on the site", "dist": c["dist"], "kind": "site"})
            continue
        dup.setdefault(drop["sha1"], {"of": "batch:" + keep["origs"][0], "keep": keep["sha1"], "dist": c["dist"], "kind": "batch"})
    cur = load_cur()
    cur["duplicates"] = [
        {"sha1": sha, "orig": inv[sha]["origs"][0], **info} for sha, info in sorted(dup.items(), key=lambda kv: inv[kv[0]]["origs"][0])
    ]
    CURATION.parent.mkdir(parents=True, exist_ok=True)
    CURATION.write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(dup), "duplicates marked:", {k: sum(1 for v in dup.values() if v["kind"] == k) for k in ("site", "batch")})
    for sha, info in sorted(dup.items(), key=lambda kv: inv[kv[0]]["origs"][0]):
        print("  ", inv[sha]["origs"][0][-58:].ljust(58), "->", info["of"][:60])


def ref_sheet() -> None:
    from PIL import Image, ImageDraw

    REVIEW.mkdir(parents=True, exist_ok=True)
    d = json.loads((DATA / "arts-splash.json").read_text(encoding="utf-8"))
    order = ["fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia"]
    pick = {}
    for it in d["items"]:
        if it["canon"] == "official" and len(it["chars"]) == 1 and it["chars"][0] not in pick:
            pick[it["chars"][0]] = it
    sheet = Image.new("RGB", (5 * 400, 2 * 430), (30, 30, 30))
    dr = ImageDraw.Draw(sheet)
    for i, c in enumerate(order):
        im = _fit(common.LIB_ROOT / pick[c]["img"]["p"], 400)
        x, y = (i % 5) * 400, (i // 5) * 430
        sheet.paste(im, (x, y + 18))
        _label(dr, (x, y + 2), c.upper(), fill=(120, 255, 120))
    out = REVIEW / "reference-aspirants.png"
    sheet.save(out)
    print(out)


def sheets() -> None:
    from PIL import Image, ImageDraw

    REVIEW.mkdir(parents=True, exist_ok=True)
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    dup = {x["sha1"] for x in load_cur().get("duplicates", [])}
    keep = [r for r in inv if r["sha1"] not in dup]
    imgs = [r for r in keep if r.get("kind") == "image"]
    vids = [r for r in keep if r.get("kind") == "video"]
    index = {}
    for n, r in enumerate(imgs, 1):
        index[f"n{n:03d}"] = r["sha1"]
    for n, r in enumerate(vids, 1):
        index[f"v{n:02d}"] = r["sha1"]
    (BASE / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    cell = 500
    per = 9
    for k in range(0, len(imgs), per):
        sheet = Image.new("RGB", (3 * cell, 3 * (cell + 18)), (30, 30, 30))
        dr = ImageDraw.Draw(sheet)
        for j, r in enumerate(imgs[k:k + per]):
            n = k + j + 1
            x, y = (j % 3) * cell, (j // 3) * (cell + 18)
            im = _fit(FILES / f"{r['sha1']}{r['ext']}", cell - 4)
            sheet.paste(im, (x + 2, y + 18))
            tag = f"n{n:03d} {r['folders'][0]} {r['w']}x{r['h']}"
            _label(dr, (x + 2, y + 2), tag)
        out = REVIEW / f"images-{k // per:02d}.png"
        sheet.save(out)
    print(len(imgs), "images on", (len(imgs) + per - 1) // per, "sheets")
    # videos: three frames in a row, three videos to a sheet
    for k in range(0, len(vids), 3):
        sheet = Image.new("RGB", (3 * 500, 3 * (500 + 18)), (30, 30, 30))
        dr = ImageDraw.Draw(sheet)
        for j, r in enumerate(vids[k:k + 3]):
            n = k + j + 1
            y = j * 518
            _label(dr, (2, y + 2), f"v{n:02d} {r['folders'][0]} {r['video']['dur']:.1f}s {r['video']['w']}x{r['video']['h']} " + r["origs"][0][-40:])
            for m, fr in enumerate(r["frames"]):
                im = _fit(FRAMES / fr, 490)
                sheet.paste(im, (m * 500 + 2, y + 18))
        sheet.save(REVIEW / f"videos-{k // 3:02d}.png")
    print(len(vids), "videos on", (len(vids) + 2) // 3, "sheets")


# --------------------------------------------------------------------------------------------
# decide: classify.txt -> curation/intake.json
# --------------------------------------------------------------------------------------------

CLASSIFY = BASE / "classify.txt"
ROTATE = {"n010": 90}  # a slide that was saved on its side: counter clockwise degrees to stand it up
TRIM = {"n100", "n101", "n104", "n105", "n106", "n107", "n108"}  # white borders around a photo
RESOLVED = {  # looked at full size after the contact sheets
    "n010": ("fanart", "angela", "Angela with a chibi", "the slide was on its side: turned upright"),
    "n013": ("fanart", "ruby,angela,fanny,layla", "The Aspirants say Let's go", ""),
    "n064": ("out", "ruby", "", "an official poster used as the cover of a cosplayer's post; where it is from is not clear, and official art has its own rooms"),
}
CHAR_ORDER = ["fanny", "layla", "ruby", "angela", "lesley", "change", "guinevere", "vexana", "selena", "obsidia"]
FOLDER_CHARS = {
    "fanny": ["fanny"], "layla": ["layla"], "ruby": ["ruby"], "angela": ["angela"], "lesley": ["lesley"],
    "change": ["change"], "guinevere": ["guinevere"], "obsidia": ["obsidia"], "selena": ["selena"],
    "ruby-and-angela": ["ruby", "angela"], "guin-and-vexana": ["guinevere", "vexana"],
    "obsidia-and-selena": ["selena", "obsidia"],
}


def reason_of(room: str, note: str) -> str:
    """The reason a picture is left out, in neutral words, from the note written on the contact sheet."""
    n = note.lower()
    if "sexualised" in n or "intimate" in n or "stage of" in n or "close up of n221" in n:
        return "left out: not suitable for a character whose official age is a minor's"
    if "romantic" in n:
        return "left out: romantic, and the Aspirants are shown without romance"
    if "same artwork" in n or "same photo" in n or "same illustration" in n or "same edit" in n or "cropped" in n or "close up of the chibi" in n or "the same as" in n or "same shoot" in n:
        return "left out: another version of a picture that is shown"
    if "advert" in n:
        return "left out: an advert, not a picture"
    if "not an aspirant" in n or "not the subject" in n or "none is the subject" in n:
        return "left out: it shows heroes who are not Aspirants"
    if "process shot" in n or "work in progress" in n or "screenshot of an art app" in n:
        return "left out: a work in progress, not the finished picture"
    if "too small" in n:
        return "left out: too small to show well"
    if "blurred" in n or "blurry" in n or "not a clear" in n or "shaky" in n or "burned in" in n:
        return "left out: not a clear picture or clip"
    if "photo of the artist's screen" in n:
        return "left out: a photo of a screen, not the picture"
    return "left out: " + note


def decide() -> None:
    inv = {r["sha1"]: r for r in json.loads(INVENTORY.read_text(encoding="utf-8"))}
    idx = json.loads((BASE / "index.json").read_text(encoding="utf-8"))
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    cur = load_cur()
    dups = cur.get("duplicates", [])
    dup_sha = {d["sha1"] for d in dups}
    decisions = []
    seen = set()
    for line in CLASSIFY.read_text(encoding="utf-8").splitlines():
        if not re.match(r"[nv]\d+\|", line):
            continue
        key, room, chars, title, note = (line.split("|") + [""] * 5)[:5]
        if key in RESOLVED:
            room, chars, title, note = RESOLVED[key]
        sha = idx[key]
        if sha in seen:
            raise SystemExit("classified twice: " + key)
        seen.add(sha)
        r = inv[sha]
        cl = [c for c in CHAR_ORDER if c in [x.strip() for x in chars.split(",")]]
        d = {
            "sha1": sha, "orig": r["origs"][0], "also": r["origs"][1:], "folder": r["folders"][0], "kind": r["kind"], "room": room,
            "chars": cl, "title": title, "note": note,
            "source": {k: r["source"][k] for k in ("platform", "post", "handle", "url")},
        }
        if key in ROTATE:
            d["rotate"] = ROTATE[key]
        if key in TRIM:
            d["trim"] = True
        if room == "out":
            d["why"] = reason_of(room, note or title)
        decisions.append(d)
    missing = [o for e in man for o in [e["orig"]] if e["sha1"] not in seen and e["sha1"] not in dup_sha]
    if missing:
        raise SystemExit("files with no decision: " + ", ".join(missing[:10]))
    extra = seen & dup_sha
    if extra:
        raise SystemExit("a duplicate is also classified: " + ", ".join(sorted(extra)[:5]))
    cur["about"] = (
        "Intake of the fan art and cosplay folders the owner added on 12 Nov 2026. Every file of the 14 folders is a duplicate "
        "(of something on the site or of another file of the batch), shown (room fanart, cosplay, fanart-video, cosplay-video) or "
        "left out with a reason. The room is decided from the picture, not from the folder it came in. intake.py decide writes this file."
    )
    cur["decisions"] = decisions
    cur["rules"] = [
        "A character is named only when she can be told from the picture (her costume, her hair, her weapon).",
        "A real person in a photo is shown only as a cosplayer of an Aspirant, with a link to the post. A person who is not named is not named.",
        "Work that is romantic, or suggestive, about a character whose official age is a minor's is left out and listed, never shown.",
        "Nothing is credited that the file name or the picture does not say. No date is invented.",
    ]
    CURATION.write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")
    import collections as C
    by = C.Counter(d["room"] for d in decisions)
    print(len(decisions), "decisions:", dict(by), "+", len(dups), "duplicates;", len(man), "files in the manifest")
    why = C.Counter(d["why"] for d in decisions if d["room"] == "out")
    for k, v in why.most_common():
        print("  ", v, k)


# --------------------------------------------------------------------------------------------
# build: the pictures and clips of the shown items, and curation/intake-items.json
# --------------------------------------------------------------------------------------------

ITEMS = Path(__file__).resolve().parent / "curation" / "intake-items.json"
NAMES = {
    "fanny": "Fanny", "layla": "Layla", "ruby": "Ruby", "angela": "Angela", "lesley": "Lesley",
    "change": "Chang'e", "guinevere": "Guinevere", "vexana": "Vexana", "selena": "Selena", "obsidia": "Obsidia",
}
HANDLE_PLATFORMS = {"DeviantArt", "X", "TikTok"}


def names_of(chars: list[str]) -> str:
    n = [NAMES[c] for c in chars]
    return n[0] if len(n) == 1 else ", ".join(n[:-1]) + " and " + n[-1]


def credit_of(d: dict, cosplay: bool) -> tuple[dict, str | None]:
    """(credit, artist key). Only what the file name says: a handle, a platform, a link. No date."""
    src = d["source"]
    by = None
    artist = None
    if src["platform"] in HANDLE_PLATFORMS and src["handle"]:
        by = "@" + src["handle"]
        artist = src["handle"].lower()
    elif src["platform"] == "Facebook" and src["handle"]:
        by = src["handle"]
        artist = src["handle"].lower()
    if by is None and cosplay:
        by = "Cosplayer not named"
    credit: dict = {"by": by, "platform": src["platform"], "url": src["url"]}
    return credit, artist


def prepare(d: dict, work: Path) -> Path:
    """The source file, turned upright or trimmed when curation says so, as a temp file."""
    from PIL import Image, ImageOps
    import numpy as np

    path = FILES / f"{d['sha1']}{Path(d['orig']).suffix.lower()}"
    if not path.exists():
        path = next(FILES.glob(d["sha1"] + ".*"))
    if not d.get("rotate") and not d.get("trim"):
        return path
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        if d.get("rotate"):
            im = im.rotate(d["rotate"], expand=True)
        if d.get("trim"):
            a = np.asarray(im, dtype=np.uint8)
            non_white = a.min(axis=2) < 248
            rows = np.where(non_white.mean(axis=1) >= 0.5)[0]
            cols = np.where(non_white.mean(axis=0) >= 0.5)[0]
            if len(rows) and len(cols):
                im = im.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1))
        out = work / f"{d['sha1']}.png"
        im.save(out)
        return out


def poster_of(d: dict, work: Path) -> Path:
    """One frame of a clip, full size, taken a quarter of the way in."""
    path = next(FILES.glob(d["sha1"] + ".*"))
    info = common.ffprobe(path)
    out = work / f"{d['sha1']}-poster.png"
    if not out.exists():
        t = max(0.0, info["dur"] * 0.25)
        common.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1", str(out)])
    return out


def encode(src: Path, dst: Path) -> None:
    if common.fresh(dst, src):
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.stem + ".part.mp4")
    common.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high",
        "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ac", "2", str(tmp),
    ])
    tmp.replace(dst)


def build() -> None:
    cur = load_cur()
    work = common.WORK / "tmp" / "intake"
    work.mkdir(parents=True, exist_ok=True)
    fan: list[dict] = []
    cos: list[dict] = []
    for d in cur["decisions"]:
        room = d["room"]
        if room == "out":
            continue
        sha, chars = d["sha1"], d["chars"]
        pairs = []
        for c in chars:
            pr = common.pair_of_char(c)
            if pr and pr not in pairs:
                pairs.append(pr)
        pair = pairs[0] if len(pairs) == 1 else None
        src_rel = f"intake/{STAMP}/{sha}" + Path(d["orig"]).suffix.lower()
        if room == "cosplay":
            slug = "-and-".join(chars)
            iid = f"arts-cosplay-{slug}-{sha[:6]}"
            img = common.image_set(prepare(d, work), f"arts/v2/cosplay/{slug}-{sha[:6]}", full_max=3840, q_full=88, q_small=80)
            credit, _ = credit_of(d, True)
            cos.append({
                "id": iid, "title": d["title"], "collection": "arts", "room": "cosplay", "chars": chars, "pair": pair,
                "canon": "fan", "tags": ["cosplay", "photo", "duo" if len(chars) > 1 else "solo"], "places": chars,
                "alt": f"A cosplayer dressed as {names_of(chars)}: {d['title'].split(',', 1)[-1].strip().lower()}." if "," in d["title"] else f"A cosplayer dressed as {names_of(chars)}.",
                "img": img, "credit": credit,
            })
        elif room == "fanart":
            iid = f"fanart-{sha[:8]}"
            img = common.image_set(prepare(d, work), f"arts/v2/fanart/{sha[:8]}", full_max=3840, q_full=88, q_small=80)
            credit, artist = credit_of(d, False)
            tags = [t for t, w in (("lineart", "line art"), ("sketch", "sketch")) if w in d["title"].lower()]
            fan.append({
                "id": iid, "kind": "image", "title": d["title"], "collection": "arts", "chars": chars, "pair": pair, "pairs": pairs,
                "canon": "fan", "tags": tags, "credit": credit, "platform": credit["platform"], "date": None, "artist": artist,
                "img": img, "src": [src_rel],
            })
        else:  # fanart-video, cosplay-video: both go to the video row of Fanart
            iid = f"fanart-video-{sha[:8]}"
            src = next(FILES.glob(sha + ".*"))
            base = f"arts/v2/fanart/video-{sha[:8]}"
            encode(src, common.key_path(f"{base}/video.mp4"))
            img = common.image_set(poster_of(d, work), base, full_max=1920, q_full=88, q_small=80)
            info = common.ffprobe(common.key_path(f"{base}/video.mp4"))
            credit, artist = credit_of(d, room == "cosplay-video")
            tags = ["cosplay"] if room == "cosplay-video" else (["speedpaint"] if "speed paint" in d["title"].lower() else ["animation"])
            fan.append({
                "id": iid, "kind": "video", "title": d["title"], "collection": "arts", "chars": chars, "pair": pair, "pairs": pairs,
                "canon": "fan", "tags": tags, "credit": credit, "platform": credit["platform"], "date": None, "artist": artist,
                "img": img,
                "video": {"src": f"{base}/video.mp4", "poster": img["p"], "w": info["w"], "h": info["h"], "dur": round(info["dur"], 2)},
                "src": [src_rel],
            })
    ids = [i["id"] for i in fan + cos]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate ids")
    ITEMS.write_text(json.dumps({"fanart": fan, "cosplay": cos}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(fan), "fanart items (", sum(1 for i in fan if i["kind"] == "video"), "videos ),", len(cos), "cosplay photos")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    {"freeze": freeze, "inventory": inventory, "dupes": dupes, "pairs": pair_sheets, "dupmark": dupmark, "ref": ref_sheet, "sheets": sheets, "decide": decide, "build": build}.get(cmd, lambda: sys.exit(__doc__))()
