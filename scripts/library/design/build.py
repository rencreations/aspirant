"""Design room pipeline: the promotional posts and graphics of the official accounts.

    C:/Users/muham/anaconda3/python.exe scripts/library/design/build.py [--force]

Reads (never writes) these folders of the source library:
    media/_others/promotional                     17 posts (the 8 reels live here)
    media/layla-and-fanny/promotional             posts as loose jpg files and as carousel folders
    media/ruby-and-angela/promotional
    media/lesley-and-change/art/promotional
    media/selena-and-obsidia/art/promotion        (the folder really is called "promotion")
    media/vexana-and-guinevere/art/promotional

Writes into the mirror (library/v1/design/<post id>/...):
    s1, s2, ... /{t,p,f}.webp     the slides of a poster or a carousel (thumb, preview, full)
    cover/{t,p,f}.webp            the cover of a reel (its thumbnail, as posted)
    poster/{t,p,f}.webp           the poster for the player, when the cover is not the video's shape
    v.mp4                         the reel, H.264 High yuv420p, AAC, faststart
and apps/web/public/data/library/design.json.

The English captions, dates and accounts come from media/_captions/captions.json through
scripts/library/captions.py (joined on `ig:<shortcode>`, never on the stale paths).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import captions  # noqa: E402
import common  # noqa: E402
import numpy as np  # noqa: E402
import posts as P  # noqa: E402
from PIL import Image  # noqa: E402

ROOTS: list[tuple[str, str | None]] = [
    ("_others/promotional", None),
    ("layla-and-fanny/promotional", "fanny-layla"),
    ("ruby-and-angela/promotional", "ruby-angela"),
    ("lesley-and-change/art/promotional", "lesley-change"),
    ("selena-and-obsidia/art/promotion", "selena-obsidia"),
    ("vexana-and-guinevere/art/promotional", "guinevere-vexana"),
]
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
WORK = common.WORK / "design"
FORCE = "--force" in sys.argv
Q_FULL = 88


# ---------------------------------------------------------------------------------------------
# Walk the source
# ---------------------------------------------------------------------------------------------


class Source:
    """One post as found on disk: its images (in slide order), an optional mp4 and cover."""

    def __init__(self, code: str, root: str, pair_folder: str | None):
        self.code = code
        self.root = root
        self.pair_folder = pair_folder
        self.images: list[Path] = []
        self.video: Path | None = None
        self.cover: Path | None = None


def walk() -> dict[str, Source]:
    found: dict[str, Source] = {}
    for root, pair in ROOTS:
        base = common.MEDIA / root
        for entry in sorted(base.iterdir(), key=lambda p: p.name):
            m = re.match(r"instagram_p_([A-Za-z0-9_-]+?)(?:\.[A-Za-z0-9]+)?$", entry.name)
            if not m:
                print(f"  ! not a post: {entry}")
                continue
            code = m.group(1)
            src = found.setdefault(code, Source(code, root, pair))
            files = [entry] if entry.is_file() else sorted(p for p in entry.rglob("*") if p.is_file())
            for f in files:
                ext = f.suffix.lower()
                if ext == ".mp4":
                    src.video = f
                elif f.name.lower().startswith("thumbnail"):
                    src.cover = f
                elif ext in IMG_EXT:
                    src.images.append(f)
                else:
                    print(f"  ! unknown file {f}")
    return found


# ---------------------------------------------------------------------------------------------
# Palette: five dominant colours with their share of the picture
# ---------------------------------------------------------------------------------------------


def palette(path: Path, k: int = 8, keep: int = 5) -> list[list[Any]]:
    """K-means on a 96 px copy (fixed seed), near colours merged, the five largest kept.

    Returns [["#rrggbb", percent], ...] largest first, percents summing to about 100.
    """
    with Image.open(path) as im:
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im).convert("RGB")
        im.thumbnail((96, 96), Image.LANCZOS)
        px = np.asarray(im, dtype=np.float64).reshape(-1, 3)
    rng = np.random.default_rng(7)
    # k-means++ start
    centres = [px[rng.integers(len(px))]]
    for _ in range(k - 1):
        d = np.min(((px[:, None, :] - np.array(centres)[None, :, :]) ** 2).sum(-1), axis=1)
        total = d.sum()
        if total <= 0:
            break
        centres.append(px[rng.choice(len(px), p=d / total)])
    c = np.array(centres)
    for _ in range(12):
        d = ((px[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for i in range(len(c)):
            sel = px[lab == i]
            if len(sel):
                c[i] = sel.mean(0)
    d = ((px[:, None, :] - c[None, :, :]) ** 2).sum(-1)
    lab = d.argmin(1)
    counts = np.bincount(lab, minlength=len(c)).astype(float)
    order = np.argsort(-counts)
    merged: list[list[Any]] = []  # [rgb array, count]
    for i in order:
        if counts[i] == 0:
            continue
        for m in merged:
            if np.linalg.norm(m[0] - c[i]) < 38:
                total = m[1] + counts[i]
                m[0] = (m[0] * m[1] + c[i] * counts[i]) / total
                m[1] = total
                break
        else:
            merged.append([c[i].copy(), counts[i]])
    merged.sort(key=lambda m: -m[1])
    merged = merged[:keep]
    total = sum(m[1] for m in merged)
    out = []
    for rgb, n in merged:
        r, g, b = (int(round(v)) for v in rgb)
        out.append([f"#{r:02x}{g:02x}{b:02x}", int(round(100 * n / total))])
    return out


# ---------------------------------------------------------------------------------------------
# Captions
# ---------------------------------------------------------------------------------------------

_EMOJI = re.compile(
    "[\U0001f000-\U0001faff\u2600-\u27bf\u2b00-\u2bff\ufe0f\u200d\u20e3\U0001f1e6-\U0001f1ff]",
    flags=re.UNICODE,
)


def clean_caption(entry: dict[str, Any]) -> str:
    text = captions.caption_text(entry)
    text = _EMOJI.sub("", text)
    text = re.sub(r"#\w+", "", text)  # hashtags glued to a word are not caught by caption_text
    text = text.replace("\uff01", "! ").replace("\uff1a", ": ").replace("\uff1b", "; ")
    text = re.sub(r"(?m)^\s*[-_=*]{5,}\s*$", "", text)  # a rule line
    text = re.sub(r"(?m)^[ \t]+|[ \t]+$", "", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s+([,.!?])", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return common.clean_text(unicodedata.normalize("NFC", text))


# ---------------------------------------------------------------------------------------------
# Video
# ---------------------------------------------------------------------------------------------


def probe_stream(path: Path) -> dict[str, Any]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=codec_name,pix_fmt,profile,width,height", "-of", "json", str(path)],
        capture_output=True, text=True, timeout=120,
    ).stdout
    return (json.loads(out or "{}").get("streams") or [{}])[0]


def encode_reel(src: Path, out: Path) -> str:
    """H.264 High yuv420p with the AAC audio copied. Stream copy when it already is H.264 yuv420p."""
    if not FORCE and common.fresh(out, src):
        return "kept"
    meta = common.ffprobe(src)
    s = probe_stream(src)
    tmp = out.with_name(out.stem + ".tmp.mp4")
    base = ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?"]
    if s.get("codec_name") == "h264" and s.get("pix_fmt") == "yuv420p" and meta["acodec"] in ("aac", None):
        cmd = base + ["-c", "copy", "-movflags", "+faststart", str(tmp)]
        how = "copied"
    else:
        # Never upscale: the sources are 1080 wide or tall at most, so no scale filter is needed.
        audio = ["-c:a", "copy"] if meta["acodec"] == "aac" else ["-c:a", "aac", "-b:a", "160k"]
        cmd = base + ["-c:v", "libx264", "-crf", "20", "-preset", "slow", "-profile:v", "high",
                      "-pix_fmt", "yuv420p", "-threads", "8", *audio, "-movflags", "+faststart", str(tmp)]
        how = "encoded"
    subprocess.run(cmd, check=True)
    tmp.replace(out)
    return how


def grab_frame(video: Path, at: float, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at:.2f}", "-i", str(video), "-frames:v", "1",
                    "-q:v", "2", str(dest)], check=True)
    return dest


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------


def kb(path: Path) -> int:
    return max(1, round(path.stat().st_size / 1024))


def chars_in_order(chars: list[str]) -> list[str]:
    return [c for c in common.CHAR_SLUGS if c in chars]


def pair_of(chars: list[str]) -> str | None:
    pairs = {common.pair_of_char(c) for c in chars}
    return next(iter(pairs)) if len(pairs) == 1 and None not in pairs else None


def main() -> None:
    found = walk()
    WORK.mkdir(parents=True, exist_ok=True)

    # Every post needs a title; every title needs a post.
    codes = set(found) - set(P.EXCLUDED)
    missing = codes - set(P.META)
    extra = set(P.META) - codes
    if missing or extra:
        raise SystemExit(f"META mismatch. No title for {sorted(missing)}. Title without a post {sorted(extra)}.")
    low = defaultdict(list)
    for c in codes:
        low[c.lower()].append(c)
    clash = {k: v for k, v in low.items() if len(v) > 1}
    if clash:
        raise SystemExit(f"Shortcodes that differ only by case would collide in the mirror: {clash}")
    campaign_ids = {c["id"] for c in P.CAMPAIGNS}
    for code, (_t, cid, _tags, _x) in P.META.items():
        if cid not in campaign_ids:
            raise SystemExit(f"{code}: unknown campaign {cid}")

    # Hash every image: one copy of a duplicate, tagged with everything it appeared under.
    sha_owner: dict[str, str] = {}
    sha_key: dict[str, dict[str, Any]] = {}
    seen_posts: dict[tuple[str, ...], str] = {}
    merged_into: dict[str, str] = {}
    dup_images = 0
    for code in sorted(codes):
        s = found[code]
        shas = tuple(common.sha1_file(p) for p in s.images)
        if shas and shas in seen_posts:
            merged_into[code] = seen_posts[shas]
            continue
        if shas:
            seen_posts[shas] = code
        for sha in shas:
            if sha in sha_owner and sha_owner[sha] != code:
                dup_images += 1
            sha_owner.setdefault(sha, code)

    items: list[dict[str, Any]] = []
    jobs: list[tuple[str, Path, Path]] = []
    total_full = 0

    # ---- encode the reels (three at a time) ------------------------------------------------
    for code in sorted(codes):
        s = found[code]
        if s.video:
            jobs.append((code, s.video, common.key_path(f"design/design-{code}/v.mp4")))
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda j: (j[0], encode_reel(j[1], j[2])), jobs))
    for code, how in results:
        print(f"  reel {code}: {how}")

    # ---- build every post ------------------------------------------------------------------
    for code in sorted(codes):
        if code in merged_into:
            continue
        s = found[code]
        title, cid, tags, extra_meta = P.META[code]
        entry = captions.find(f"instagram_p_{code}")
        if not entry:
            raise SystemExit(f"{code}: no caption entry")
        caption = clean_caption(entry)
        if not caption:
            print(f"  skip {code}: empty caption")
            continue
        if re.search(r"#\w", caption):
            raise SystemExit(f"{code}: a hashtag is left in the caption")
        handle = (entry.get("uploader_handle") or "").lower()
        account = f"@{handle}"
        date = entry["date"][:10]
        pid = f"design-{code}"

        # characters and pair
        if "chars" in extra_meta:
            chars = list(extra_meta["chars"])  # type: ignore[arg-type]
        elif s.pair_folder:
            chars = list(common.PAIRS[s.pair_folder])
        else:
            raise SystemExit(f"{code}: a post outside the pair folders needs explicit chars")
        for dup_code, owner in merged_into.items():
            if owner == code:
                dsrc = found[dup_code]
                if dsrc.pair_folder:
                    chars += common.PAIRS[dsrc.pair_folder]
        chars = chars_in_order(chars)

        canon = extra_meta.get("canon", "official")
        credit = captions.credit(entry) or {}
        credit = {"by": credit.get("by"), "platform": credit.get("platform"), "url": credit.get("url"),
                  "date": date}
        if extra_meta.get("by"):
            credit["by"] = extra_meta["by"]
        if extra_meta.get("note"):
            credit["note"] = extra_meta["note"]

        item: dict[str, Any] = {
            "id": pid,
            "title": title,
            "collection": "design",
            "chars": chars,
            "pair": pair_of(chars),
            "canon": canon,
            "tags": tags,
            "credit": credit,
            "caption": caption,
            "date": date,
            "account": account,
            "campaign": cid,
            "url": entry.get("url"),
        }
        if extra_meta.get("note"):
            item["note"] = extra_meta["note"]

        if s.video:
            if not s.cover:
                raise SystemExit(f"{code}: reel without a thumbnail")
            vpath = common.key_path(f"design/{pid}/v.mp4")
            vi = common.ffprobe(vpath)
            cover = common.image_set(s.cover, f"design/{pid}/cover", q_full=Q_FULL, force=FORCE)
            cover_aspect = cover["w"] / cover["h"]
            video_aspect = vi["w"] / vi["h"]
            if abs(cover_aspect - video_aspect) / video_aspect < 0.04:
                poster_key = cover["p"]
            else:
                # The cover is a different shape from the film: the player gets a frame of the film.
                frame = grab_frame(vpath, min(vi["dur"] * 0.12, 6.0), WORK / f"{code}-poster.jpg")
                poster = common.image_set(frame, f"design/{pid}/poster", q_full=Q_FULL, force=FORCE)
                poster_key = poster["p"]
            item["kind"] = "reel"
            item["video"] = {
                "src": f"design/{pid}/v.mp4",
                "poster": poster_key,
                "cover": cover,
                "pal": palette(s.cover),
                "dur": round(vi["dur"], 1),
                "w": vi["w"],
                "h": vi["h"],
                "kb": kb(vpath),
            }
            item["thumb"] = cover["t"]
            total_full += vpath.stat().st_size
        else:
            slides = []
            for n, img in enumerate(s.images, 1):
                sha = common.sha1_file(img)
                if sha in sha_key:
                    li = sha_key[sha]
                else:
                    li = common.image_set(img, f"design/{pid}/s{n}", q_full=Q_FULL, force=FORCE)
                    sha_key[sha] = li
                full = common.key_path(li["f"])
                total_full += full.stat().st_size
                slides.append({"img": li, "pal": palette(img), "kb": kb(full)})
            item["kind"] = "carousel" if len(slides) > 1 else "poster"
            item["slides"] = slides
            item["thumb"] = slides[0]["img"]["t"]
        items.append(item)

    items.sort(key=lambda it: (it["date"], it["id"]))

    # ---- campaigns -------------------------------------------------------------------------
    by_campaign: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for it in items:
        by_campaign[it["campaign"]].append(it)
    campaigns = []
    for c in P.CAMPAIGNS:
        members = by_campaign.get(c["id"], [])
        if not members:
            raise SystemExit(f"campaign {c['id']} is empty")
        dates = sorted(m["date"] for m in members)
        chars = chars_in_order(sorted({ch for m in members for ch in m["chars"]}))
        campaigns.append({
            "id": c["id"],
            "title": c["title"],
            "line": c["line"],
            "from": dates[0],
            "to": dates[-1],
            "chars": chars,
            "posts": [m["id"] for m in members],
        })
    campaigns.sort(key=lambda c: (c["from"], c["id"]))

    topics = [{"tag": t, "label": label} for t, label in P.TOPICS]
    used_tags = {t for it in items for t in it["tags"]}
    for t in topics:
        if t["tag"] not in used_tags:
            raise SystemExit(f"topic {t['tag']} is not used by any post")

    data = {"v": 1, "slug": "design", "items": items, "campaigns": campaigns, "topics": topics}
    common.write_json("design", data)

    n_img = sum(len(it.get("slides", [])) for it in items)
    kinds = defaultdict(int)
    for it in items:
        kinds[it["kind"]] += 1
    mirror_bytes = sum(p.stat().st_size for p in (common.LIB_ROOT / "design").rglob("*") if p.is_file())
    print(f"posts {len(items)} {dict(kinds)}; image slides {n_img}; reels {kinds['reel']}")
    print(f"duplicates: {dup_images} repeated images, {len(merged_into)} merged posts")
    print(f"campaigns {len(campaigns)}; fan posts {sum(1 for it in items if it['canon'] == 'fan')}")
    print(f"mirror design/: {common.human(mirror_bytes)}")
    print("left out:", ", ".join(f"{k} ({v})" for k, v in P.EXCLUDED.items()))


if __name__ == "__main__":
    main()
