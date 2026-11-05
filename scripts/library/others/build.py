"""The Others room: everything that fits no other room.

Builds the mirror assets under library/v1/others/ and apps/web/public/data/library/others.json.

  3D models   media/layla-and-fanny/3d/{fanny,layla}        copied unchanged (the .obj, the .mtl and the PNG textures)
  Emotes      media/layla-and-fanny/art/emotes              remuxed with faststart, posters picked from the frames
  Gameplay    media/selena-and-obsidia/video/_gameplay      VP9 re-encoded to H.264, posters, captions from captions.py
  Skill icons media/_others/web/skills-icon                 copied unchanged (100 px WebP)
  Site art    media/_others/web/{logo,menu,page}            image_set (alpha kept, never upscaled)
  Links       the novel, the ten character pages, the interactive drama

Run:  C:/Users/muham/anaconda3/python.exe scripts/library/others/build.py [--force]
Safe to run again: finished outputs are skipped.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import captions  # noqa: E402
import common  # noqa: E402

FORCE = "--force" in sys.argv
SRC = common.SRC
WEB = common.MEDIA / "_others" / "web"
SCRATCH = common.WORK / "others"
SCRATCH.mkdir(parents=True, exist_ok=True)
RENDERS = SCRATCH / "render"  # screenshots of the viewer, made by render_previews.cjs
CHAR_NAMES = {
    "fanny": "Fanny",
    "layla": "Layla",
    "ruby": "Ruby",
    "angela": "Angela",
    "lesley": "Lesley",
    "change": "Chang'e",
    "guinevere": "Guinevere",
    "vexana": "Vexana",
    "obsidia": "Obsidia",
    "selena": "Selena",
}

written = 0  # bytes written into the mirror this run
left_out: list[str] = []


def put(src: Path, key: str) -> Path:
    """Copy a file unchanged into the mirror (skipped when the copy is the same size and newer)."""
    global written
    dst = common.key_path(key)
    if not FORCE and dst.exists() and dst.stat().st_size == src.stat().st_size and dst.stat().st_mtime >= src.stat().st_mtime:
        return dst
    shutil.copy2(src, dst)
    written += dst.stat().st_size
    return dst


def size_of(key: str) -> int:
    return common.key_path(key).stat().st_size


def dominant(path: Path) -> str:
    from PIL import Image

    with Image.open(path) as im:
        return common._dominant(im.convert("RGBA") if im.mode != "RGB" else im)


def note_bytes(path: Path) -> None:
    global written
    written += path.stat().st_size


# ---------------------------------------------------------------------------------------------
# 3D models
# ---------------------------------------------------------------------------------------------

MODELS = [
    {
        "slug": "fanny",
        "title": "Fanny",
        "pair": "fanny-layla",
        "obj": "hero_fanny_skin09_high_add.obj",
        "mtl": "hero_fanny_skin09_high_add.mtl",
        "weapon_note": "Her cable weapon is stored flat and laid out to one side of the body.",
    },
    {
        "slug": "layla",
        "title": "Layla",
        "pair": "fanny-layla",
        "obj": "hero_shooter_skin08_high_add.obj",
        "mtl": "hero_shooter_skin08_high_add.mtl",
        "weapon_note": "Her rifle is stored separate from the body and laid out to one side.",
    },
]


def part_of(material: str) -> str:
    if material == "jiqiren_skin09_d":
        return "robot"
    if material == "jiqirenbiaoqing_skin09_d":
        return "robotFace"
    if material.endswith("_wuqi_d") or material.endswith("_weapon_d"):
        return "weapon"
    return "body"


def build_models() -> list[dict]:
    items = []
    for m in MODELS:
        src_dir = common.MEDIA / "layla-and-fanny" / "3d" / m["slug"]
        base = f"others/3d/{m['slug']}"
        obj_src, mtl_src = src_dir / m["obj"], src_dir / m["mtl"]
        put(obj_src, f"{base}/{m['obj']}")
        put(mtl_src, f"{base}/{m['mtl']}")

        # The .mtl names the texture of each material: copy exactly those files, same names.
        maps: dict[str, str] = {}
        cur = None
        for line in mtl_src.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line.startswith("newmtl "):
                cur = line.split(None, 1)[1]
            elif line.startswith("map_Kd ") and cur:
                maps[cur] = line.split(None, 1)[1].strip()
        for tex in sorted(set(maps.values())):
            put(src_dir / tex, f"{base}/{tex}")
        # The eight expression sheets of the robot's face. The folder is lower case in the mirror
        # (the keys are case sensitive on R2). Nothing in the .mtl points at them.
        faces = []
        for p in sorted((src_dir / "Emote").glob("*.png")):
            put(p, f"{base}/emote/{p.name}")
            faces.append(f"{base}/emote/{p.name}")

        verts = tris = 0
        for line in obj_src.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("v "):
                verts += 1
            elif line.startswith("f "):
                tris += max(1, len(line.split()) - 3)

        parts = {mat: part_of(mat) for mat in maps}
        item = {
            "id": f"others-3d-{m['slug']}",
            "kind": "model",
            "group": "models",
            "title": m["title"],
            "collection": "others",
            "chars": [m["slug"]],
            "pair": m["pair"],
            "canon": "official",
            "tags": ["3d", "model", "game client", m["slug"], "visual reference"],
            "note": f"A model taken from the game client, used here as a visual reference. {m['weapon_note']} The little robot beside the body has a face screen that can show eight other expressions.",
            "model": {
                "dir": base,
                "obj": m["obj"],
                "mtl": m["mtl"],
                "verts": verts,
                "tris": tris,
                "bytes": size_of(f"{base}/{m['obj']}"),
                "maps": {mat: f"{tex}" for mat, tex in maps.items()},
                "parts": parts,
                "faces": [f.split("/", 3)[-1] for f in faces],
                "texBytes": sum(size_of(f"{base}/{t}") for t in set(maps.values())),
            },
        }
        render = RENDERS / f"{m['slug']}.png"
        if render.exists():
            item["img"] = common.image_set(render, f"{base}/preview", full_max=1600, force=FORCE)
        items.append(item)
        print(f"model {m['slug']}: {verts} vertices, {tris} triangles, {len(maps)} materials, {len(faces)} face sheets")
    return items


# ---------------------------------------------------------------------------------------------
# Emotes
# ---------------------------------------------------------------------------------------------


def pick_frame(video: Path, out_png: Path, dur: float) -> None:
    """Pick the frame with the most ink (the least blank white) out of six, so a poster is never empty."""
    import numpy as np
    from PIL import Image

    best, best_score = None, -1.0
    tmp = SCRATCH / "tmp"
    tmp.mkdir(exist_ok=True)
    for i, frac in enumerate((0.1, 0.25, 0.4, 0.55, 0.7, 0.85)):
        f = tmp / f"{video.stem}-{i}.png"
        subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{dur * frac:.3f}", "-i", str(video), "-frames:v", "1", str(f)],
            check=True,
        )
        a = np.asarray(Image.open(f).convert("L"), dtype=np.uint8)
        score = float((a < 235).mean())
        if score > best_score:
            best, best_score = f, score
    assert best is not None
    shutil.copy2(best, out_png)


EMOTE_TITLES = {
    "fanny-awkward": ("Fanny, awkward", "fanny"),
    "fanny-flying": ("Fanny, flying", "fanny"),
    "fanny-nod": ("Fanny, nod", "fanny"),
    "fanny-peeking": ("Fanny, peeking", "fanny"),
    "layla-air-kiss": ("Layla, air kiss", "layla"),
    "layla-fbi-swatting": ("Layla, FBI swatting", "layla"),
    "layla-lying-dead": ("Layla, lying dead", "layla"),
    "layla-sad-spin": ("Layla, sad spin", "layla"),
    "preview": ("The emote set, preview", None),
}


def build_emotes() -> list[dict]:
    from PIL import Image

    global written
    folder = common.MEDIA / "layla-and-fanny" / "art" / "emotes"
    post = captions.find((folder / "source.txt").read_text(encoding="utf-8").strip())
    assert post, "emote post not found in captions.json"
    cr = captions.credit(post) or {}
    credit = {
        "by": "@anggorogorgor (MGL Artist)",
        "platform": cr.get("platform"),
        "url": cr.get("url"),
        "date": cr.get("date"),
        "note": "Design by @cafe_latteland (MGL Designer). Posted by the official Mobile Legends: Bang Bang account, who share MGL creator work.",
    }
    items = []
    for name, (title, who) in EMOTE_TITLES.items():
        src = folder / f"{name}.mp4"
        meta = common.ffprobe(src)
        key = f"others/emotes/{name}.mp4"
        out = common.key_path(key)
        if FORCE or not common.fresh(out, src):
            common.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-c", "copy", "-movflags", "+faststart", out])
            written += out.stat().st_size
        pkey = f"others/emotes/{name}.webp"
        pout = common.key_path(pkey)
        if FORCE or not common.fresh(pout, src):
            frame = SCRATCH / "tmp" / f"{name}-poster.png"
            pick_frame(src, frame, meta["dur"])
            with Image.open(frame) as im:
                im.convert("RGB").save(pout, "WEBP", quality=84, method=5)
            written += pout.stat().st_size
        is_preview = name == "preview"
        items.append(
            {
                "id": f"others-emote-{name}",
                "kind": "emote",
                "group": "emotes",
                "title": title,
                "collection": "others",
                "chars": [who] if who else ["fanny", "layla"],
                "pair": "fanny-layla",
                "canon": "fan",
                "tags": ["emote", "sticker", "preview"] if is_preview else ["emote", "sticker", who or "", name.split("-", 1)[-1]],
                "credit": credit,
                "preview": is_preview,
                "video": {
                    "src": key,
                    "poster": pkey,
                    "w": meta["w"],
                    "h": meta["h"],
                    "dur": round(meta["dur"], 2),
                    "sound": bool(meta["has_audio"]),
                    "bytes": out.stat().st_size,
                },
            }
        )
        items[-1]["tags"] = [t for t in items[-1]["tags"] if t]
    print(f"emotes: {len(items)}")
    return items


# ---------------------------------------------------------------------------------------------
# Gameplay clips
# ---------------------------------------------------------------------------------------------


def encode_clip(src: Path, out: Path) -> None:
    common.run(
        [
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src,
            "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-maxrate", "4M", "-bufsize", "8M", "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
        ]
    )


def clean_caption(raw: str) -> str:
    """The post's words without hashtags. (captions.caption_text drops a whole caption that has no
    punctuation, so this does the same job line by line.)"""
    lines = [re.sub(r"#\w+", "", ln).strip() for ln in raw.splitlines()]
    return common.clean_text("\n".join(ln for ln in lines if ln))


def build_gameplay() -> list[dict]:
    from PIL import Image

    global written
    base = common.MEDIA / "selena-and-obsidia" / "video" / "_gameplay"
    jobs, rows = [], []
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        mp4 = next(d.glob("*.mp4"))
        code = d.name.replace("instagram_p_", "")
        out = common.key_path(f"others/gameplay/{code}.mp4")
        rows.append((d, mp4, code, out))
        if FORCE or not common.fresh(out, mp4):
            jobs.append((mp4, out))
    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(lambda j: encode_clip(*j), jobs))
    for _, _, _, out in rows:
        pass
    items = []
    for d, mp4, code, out in rows:
        written += out.stat().st_size if any(out == j[1] for j in jobs) else 0
        meta = common.ffprobe(out)
        entry = captions.find(d.name)
        assert entry, f"no caption for {d.name}"
        raw = entry.get("caption") or ""
        text = clean_caption(raw)
        first = text.splitlines()[0].strip() if text else code
        title = re.sub(r"[.!?]+$", "", first) or code
        tags_in_post = {t.lower() for t in re.findall(r"#(\w+)", raw)}
        chars = [c for c in ("selena", "obsidia") if c in tags_in_post]
        pair = common.pair_of_char(chars[0]) if chars else None
        # Poster: the post's own cover when it has the same shape as the video, else a frame from the video.
        pkey = f"others/gameplay/{code}.webp"
        pout = common.key_path(pkey)
        if FORCE or not common.fresh(pout, out):
            thumb = d / "thumbnail.jpg"
            use_thumb = False
            if thumb.exists():
                with Image.open(thumb) as t:
                    use_thumb = abs(t.width / t.height - meta["w"] / meta["h"]) < 0.02
            if use_thumb:
                im = Image.open(thumb).convert("RGB")
            else:
                f = SCRATCH / "tmp" / f"gp-{code}.png"
                subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{meta['dur'] * 0.3:.2f}", "-i", str(out), "-frames:v", "1", str(f)], check=True)
                im = Image.open(f).convert("RGB")
            im.thumbnail((960, 960))
            im.save(pout, "WEBP", quality=82, method=5)
            written += pout.stat().st_size
        cr = captions.credit(entry) or {}
        cr["note"] = "Game footage posted by the official account. It is not part of the story."
        items.append(
            {
                "id": f"others-gameplay-{code.lower()}",
                "kind": "gameplay",
                "group": "gameplay",
                "title": title,
                "collection": "others",
                "chars": chars,
                "pair": pair,
                "canon": "official",
                "tags": ["gameplay", "clip", *chars],
                "credit": cr,
                "caption": text,
                "date": cr.get("date", ""),
                "video": {
                    "src": f"others/gameplay/{code}.mp4",
                    "poster": pkey,
                    "w": meta["w"],
                    "h": meta["h"],
                    "dur": round(meta["dur"], 2),
                    "bytes": meta["bytes"],
                },
            }
        )
    items.sort(key=lambda i: i["date"])
    print(f"gameplay: {len(items)} clips, {sum(i['video']['bytes'] for i in items) / 1e6:.1f} MB")
    return items


# ---------------------------------------------------------------------------------------------
# Skill icons
# ---------------------------------------------------------------------------------------------


def skill_label(stem: str) -> str:
    """Passive, Skill 1, Skill 2 blink, Skill 3 cancel. Only words that are in the file name."""
    s = stem.lower().replace("-", " ")
    if s == "passive":
        return "Passive"
    m = re.match(r"skill\s*(\d)\s*(.*)$", s)
    if not m:
        return stem
    rest = m.group(2).strip()
    return f"Skill {m.group(1)}" + (f", {rest}" if rest else "")


def build_skills() -> list[dict]:
    items = []
    base = WEB / "skills-icon"
    for cdir in sorted(p for p in base.iterdir() if p.is_dir()):
        slug = cdir.name
        files = sorted(cdir.glob("*.webp"), key=lambda p: (0 if p.stem == "passive" else 1, p.stem))
        for p in files:
            key = f"others/skill-icons/{slug}/{p.name}"
            put(p, key)
            items.append(
                {
                    "id": f"others-skill-{slug}-{common.slugify(p.stem)}",
                    "kind": "skill",
                    "group": "skills",
                    "title": f"{CHAR_NAMES[slug]}, {skill_label(p.stem).lower() if p.stem != 'passive' else 'passive'}",
                    "label": skill_label(p.stem),
                    "collection": "others",
                    "chars": [slug],
                    "pair": common.pair_of_char(slug),
                    "canon": "official",
                    "tags": ["skill icon", "icon", "game interface", slug],
                    "img": {"t": key, "p": key, "f": key, "w": 100, "h": 100, "c": dominant(p)},
                }
            )
    print(f"skill icons: {len(items)}")
    return items


# ---------------------------------------------------------------------------------------------
# Made for this site
# ---------------------------------------------------------------------------------------------

SITE_CREDIT = {
    "by": "Made for this site",
    "platform": None,
    "url": None,
    "note": "Art supplied by the site's owner, cut from official art or built for the site. It is not official art.",
}

PAGES = {"home": "Home", "story": "Story", "character": "Characters", "collection": "Collection", "experience": "About"}


def site_item(group_id: str, ident: str, title: str, set_id: str, set_label: str, src: Path, chars: list[str], note: str) -> dict:
    img = common.image_set(src, f"others/site/{set_id}/{ident}", force=FORCE)
    return {
        "id": f"others-site-{set_id}-{ident}",
        "kind": "site",
        "group": group_id,
        "title": title,
        "collection": "others",
        "chars": chars,
        "pair": None,
        "canon": "fan",
        "tags": ["made for this site", set_id, *chars],
        "credit": SITE_CREDIT,
        "set": set_id,
        "setLabel": set_label,
        "note": note,
        "img": img,
    }


def build_site() -> list[dict]:
    items = []
    items.append(
        site_item("site", "logo", "The Aspirants logo", "logo", "Logo", WEB / "logo" / "logo.png", [], "The logo as a flat picture with a clear background. The site draws its own copy as a vector.")
    )
    for stem in sorted((WEB / "menu").glob("*.png")):
        page, side = stem.stem.split("-")
        items.append(
            site_item(
                "site", stem.stem, f"Menu art, {PAGES[page]}, {side}", "menu", "Menu art", stem, [],
                f"One of the two figures that stand beside the {PAGES[page].lower()} entry of the site's menu. The art has a clear background.",
            )
        )
    for who in ("guinevere", "vexana"):
        for p in sorted((WEB / "page" / who).glob("*.png")):
            words = p.stem.replace("-", " ")
            items.append(
                site_item(
                    "site", f"{who}-{p.stem}", f"{CHAR_NAMES[who]} page, {words}", f"page-{who}", f"{CHAR_NAMES[who]} page art", p, [who],
                    f"A cut-out used on the page of {CHAR_NAMES[who]}. The art has a clear background.",
                )
            )
    print(f"site art: {len(items)}")
    return items


# ---------------------------------------------------------------------------------------------
# More of the world (links)
# ---------------------------------------------------------------------------------------------


def build_links() -> list[dict]:
    items = [
        {
            "id": "others-link-story",
            "kind": "link",
            "group": "more",
            "title": "The novel",
            "line": "Read the whole story, one chapter to a page.",
            "to": "story",
            "local": "/img/hero-stills/fanny-layla-01.webp",
        },
        {
            "id": "others-link-drama",
            "kind": "link",
            "group": "more",
            "title": "The interactive drama",
            "line": "Make the choices yourself. It lives on the page of Vexana.",
            "to": "character:vexana",
            "local": "/img/hero-stills/guinevere-vexana-01.webp",
            "chars": ["vexana", "guinevere"],
        },
    ]
    for slug, name in CHAR_NAMES.items():
        items.append(
            {
                "id": f"others-link-{slug}",
                "kind": "link",
                "group": "more",
                "title": name,
                "line": f"The page for {name}.",
                "to": f"character:{slug}",
                "local": f"/img/char/{slug}/splash-sm.webp",
                "chars": [slug],
            }
        )
    for it in items:
        it.setdefault("collection", "others")
        it.setdefault("chars", [])
        it.setdefault("pair", None)
        it["canon"] = "official"
        it["tags"] = ["link", "more of the world"]
    return items


# ---------------------------------------------------------------------------------------------
# ignored.json
# ---------------------------------------------------------------------------------------------


def update_ignored() -> None:
    path = common.REPO / "scripts" / "library" / "ignored.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except json.JSONDecodeError:
        data = {}
    reason = "Raw voice compilation video (1.8 GB in all). Source material for the voice and music pipelines. Not shipped."
    for f in sorted((common.AUDIO / "source").glob("*.mp4")):
        data.setdefault(f"audio/source/{f.name}", reason)
    data.setdefault("media/_captions", "Captions, links and the fetch tools behind the credits. Read by scripts/library/captions.py. Not shipped as items.")
    path.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"ignored.json: {len(data)} entries")


# ---------------------------------------------------------------------------------------------


GROUPS = [
    {"id": "models", "title": "3D models", "line": "Two game client models, Fanny and Layla. Drag to turn them, scroll to come closer.", "kind": "models"},
    {"id": "emotes", "title": "Emotes", "line": "Eight chibi stickers of Fanny and Layla. They loop while you look.", "kind": "stickers"},
    {"id": "gameplay", "title": "Gameplay clips (not part of the story)", "line": "Ten short clips of the game itself, posted by the official account.", "kind": "clips"},
    {"id": "skills", "title": "Skill icons", "line": "Game interface icons for Guinevere, Obsidia, Selena and Vexana, shown at their real size.", "kind": "icons"},
    {"id": "site", "title": "Made for this site", "line": "Art and files made for this site. They are not official art.", "kind": "images"},
    {"id": "more", "title": "More of the world", "line": "Where else to go.", "kind": "links"},
]


def main() -> None:
    items: list[dict] = []
    items += build_models()
    items += build_emotes()
    items += build_gameplay()
    items += build_skills()
    items += build_site()
    items += build_links()
    for it in items:
        it["tags"] = [t.lower() for t in it["tags"]]
    common.write_json("others", {"v": 1, "slug": "others", "groups": GROUPS, "items": items})
    update_ignored()
    total = sum(p.stat().st_size for p in (common.LIB_ROOT / "others").rglob("*") if p.is_file())
    print(f"items: {len(items)}   mirror others/: {common.human(total)}   written this run: {common.human(written)}")
    for line in left_out:
        print("left out:", line)


if __name__ == "__main__":
    main()
