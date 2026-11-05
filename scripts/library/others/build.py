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

OWNER_DIR = common.WORK / "3d" / "x"  # the models the owner supplied, unpacked (read only, never run)

# Which part of the model a piece belongs to. A rule is [regex, part]; the regex is tried on the
# lower case text "<object name> <material name>", the first match wins, no match means "body".
# The viewer applies the same rules, so the layer switches only exist where a part is really there.
ROBOT_RULES = [["jiqirenbiaoqing", "robotFace"], ["jiqi", "robot"], ["wuqi|weapon", "weapon"]]

MODELS = [
    {
        "slug": "fanny", "title": "Fanny", "chars": ["fanny"], "pair": "fanny-layla", "format": "obj",
        "src": common.MEDIA / "layla-and-fanny" / "3d" / "fanny", "obj": "hero_fanny_skin09_high_add.obj",
        "mtl": "hero_fanny_skin09_high_add.mtl", "rename": False, "rules": ROBOT_RULES, "faces": True,
        "note": "A model taken from the game client, used here as a visual reference. Her cable weapon is stored flat and laid out to one side of the body. The little robot beside the body has a face screen that can show eight other expressions.",
    },
    {
        "slug": "layla", "title": "Layla", "chars": ["layla"], "pair": "fanny-layla", "format": "obj",
        "src": common.MEDIA / "layla-and-fanny" / "3d" / "layla", "obj": "hero_shooter_skin08_high_add.obj",
        "mtl": "hero_shooter_skin08_high_add.mtl", "rename": False, "rules": ROBOT_RULES, "faces": True,
        "note": "A model taken from the game client, used here as a visual reference. Her rifle is stored separate from the body and laid out to one side. The little robot beside the body has a face screen that can show eight other expressions.",
    },
    {
        "slug": "ruby", "title": "Ruby, Mecha Maiden", "skin": "Mecha Maiden", "chars": ["ruby"], "pair": "ruby-angela",
        "format": "obj", "src": OWNER_DIR / "ruby", "obj": "Ruby-Mecha Maiden.obj", "mtl": "Ruby-Mecha Maiden.mtl",
        "rename": True, "rules": [["material\\.001$", "weapon"]], "owner": True,
    },
    {
        "slug": "angela", "title": "Angela, Cyber Cherubin", "skin": "Cyber Cherubin", "chars": ["angela"], "pair": "ruby-angela",
        "format": "fbx", "src": OWNER_DIR / "angela" / "08 Angela THE ASPIRANTS Cyber Cherubin",
        "obj": "hero_angela_skin08_high_add.fbx", "mtl": "", "rename": False,
        "rules": [["cylinder|cityaction", "hidden"], ["jiqi", "robot"]], "owner": True,
        "maps": {
            "body": "Angela_skin08_body.png", "body_A": "Angela_skin08_body.png", "hair": "Angela_skin08_hair.png",
            "face": "Angela_skin08_face.png", "jiqiren_skin09_high_body": "jiqiren_skin09_d.png",
            "jiqiren_skin09_high_face": "jiqirenbiaoqing_skin09_1.png",
        },
    },
    {
        "slug": "lesley", "title": "Lesley, Deadeye Spectre", "skin": "Deadeye Spectre", "chars": ["lesley"], "pair": "lesley-change",
        "format": "obj", "src": OWNER_DIR / "lesley", "obj": "Lesley - Deadeye Spectre.obj", "mtl": "Lesley - Deadeye Spectre.mtl",
        "rename": True, "rules": [["weapon|npc", "weapon"]], "owner": True,
    },
    {
        "slug": "change", "title": "Chang'e, Tech Tensai", "skin": "Tech Tensai", "chars": ["change"], "pair": "lesley-change",
        "format": "obj", "src": OWNER_DIR / "change", "obj": "Change - Tech Tensai .obj", "mtl": "Change - Tech Tensai .mtl",
        "rename": True, "rules": [["\\snone$", "hidden"], ["jiqi", "robot"], ["weapon", "weapon"]], "owner": True,
    },
    {
        "slug": "guinevere", "title": "Guinevere, Daybreak Halo", "skin": "Daybreak Halo", "chars": ["guinevere"], "pair": "guinevere-vexana",
        "format": "obj", "src": OWNER_DIR / "guinevere", "obj": "GUINEVERE - Daybreak Halo.obj", "mtl": "GUINEVERE - Daybreak Halo.mtl",
        "rename": True, "rules": [["weapon", "weapon"]], "owner": True,
    },
    {
        "slug": "vexana", "title": "Vexana, Twilight Star", "skin": "Twilight Star", "chars": ["vexana"], "pair": "guinevere-vexana",
        "format": "obj", "src": OWNER_DIR / "vexana", "obj": "VEXANA - Twilight Star .obj", "mtl": "VEXANA - Twilight Star .mtl",
        "rename": True, "rules": [["material\\.010$", "hidden"], ["high_body02_mat$", "weapon"]], "owner": True,
    },
    {
        "slug": "vexana-eternal-guard", "title": "Eternal Guard", "skin": "Eternal Guard", "chars": ["vexana"], "pair": "guinevere-vexana",
        "format": "obj", "src": OWNER_DIR / "vexana-eternal-guard", "obj": "Eternal Guard.obj", "mtl": "Eternal Guard.mtl",
        "rename": True, "rules": [["weapon", "weapon"]], "owner": True,
    },
]

SKIP_FILES = {"undefined-dawn-savanna.jpg"}  # a stray preview picture that came with each download


def unquote(name: str) -> str:
    return name.strip().strip('"').strip()


def parse_mtl(path: Path) -> tuple[dict[str, str], dict[str, float]]:
    """Material name to the texture of map_Kd, and to its opacity when it is below 1."""
    maps: dict[str, str] = {}
    opacity: dict[str, float] = {}
    cur = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line.startswith("newmtl "):
            cur = line.split(None, 1)[1].strip()
        elif cur and line.startswith("map_Kd "):
            maps[cur] = unquote(line.split(None, 1)[1])
        elif cur and (line.startswith("d ") or line.startswith("Tr ")):
            try:
                v = float(line.split()[1])
            except ValueError:
                continue
            if line.startswith("Tr "):
                v = 1.0 - v
            if v < 0.999:
                opacity[cur] = round(v, 3)
    return maps, opacity


def obj_segments(path: Path) -> tuple[int, int, list[tuple[str, str]]]:
    """(vertices, triangles, [(object name, material name)]) the way the viewer's loader splits it."""
    verts = tris = 0
    segs: set[tuple[str, str]] = set()
    obj = ""
    mat = ""
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("v "):
            verts += 1
        elif line.startswith("f "):
            tris += max(1, len(line.split()) - 3)
            segs.add((obj, mat))
        elif line.startswith(("o ", "g ")):
            obj = line[2:].strip()
        elif line.startswith("usemtl"):
            mat = line.split(None, 1)[1].strip()
    return verts, tris, sorted(segs)


def fbx_counts(path: Path) -> tuple[int, int]:
    """Vertices and triangles of a binary FBX (version 7.x), read from its geometry nodes. Nothing is run."""
    import struct
    import zlib

    d = path.read_bytes()
    ver = struct.unpack("<I", d[23:27])[0]
    wide = ver >= 7500

    def prop(p: int):
        t = chr(d[p])
        p += 1
        if t in "YCIFDL":
            size = {"Y": 2, "C": 1, "I": 4, "F": 4, "D": 8, "L": 8}[t]
            return None, p + size
        if t in "fdilb":
            n, enc, cl = struct.unpack("<III", d[p : p + 12])
            p += 12
            raw = d[p : p + cl]
            return (t, n, zlib.decompress(raw) if enc else raw), p + cl
        n = struct.unpack("<I", d[p : p + 4])[0]
        return None, p + 4 + n

    def node(p: int):
        if wide:
            end, npr, pl = struct.unpack("<QQQ", d[p : p + 24])
            p += 24
        else:
            end, npr, pl = struct.unpack("<III", d[p : p + 12])
            p += 12
        nl = d[p]
        p += 1
        name = d[p : p + nl].decode()
        p += nl
        if end == 0:
            return None, p
        props = []
        q = p
        for _ in range(npr):
            v, q = prop(q)
            props.append(v)
        p += pl
        kids = []
        while p < end:
            k, p = node(p)
            if k is None:
                break
            kids.append(k)
        return (name, props, kids), end

    p = 27
    verts = tris = 0
    while p < len(d) - 200:
        n, p = node(p)
        if n is None:
            break
        if n[0] != "Objects":
            continue
        for g in n[2]:
            if g[0] != "Geometry":
                continue
            for k in g[2]:
                if k[0] == "Vertices" and k[1] and k[1][0]:
                    verts += k[1][0][1] // 3
                if k[0] == "PolygonVertexIndex" and k[1] and k[1][0]:
                    _t, cnt, raw = k[1][0]
                    idx = struct.unpack(f"<{cnt}i", raw)
                    polys = sum(1 for i in idx if i < 0)
                    tris += cnt - 2 * polys
    return verts, tris


def part_of(rules: list[list[str]], obj: str, mat: str) -> str:
    text = f"{obj} {mat}".lower()
    for pattern, part in rules:
        if re.search(pattern, text):
            return part
    return "body"


def build_models() -> list[dict]:
    global written
    items = []
    for m in MODELS:
        slug = m["slug"]
        src_dir: Path = m["src"]
        base = f"others/3d/{slug}"
        if m["format"] == "fbx":
            main_name = m["obj"]
            put(src_dir / main_name, f"{base}/{main_name}")
            mtl_name = ""
        elif m["rename"]:
            # The downloaded names hold spaces (one has a space before the dot): clean names, and the
            # line in the .obj that names the .mtl follows. Nothing else in the file is touched.
            main_name, mtl_name = f"{slug}.obj", f"{slug}.mtl"
            raw = (src_dir / m["obj"]).read_bytes()
            out = common.key_path(f"{base}/{main_name}")
            lines = raw.split(b"\n", 12)
            for i, ln in enumerate(lines[:12]):
                if ln.lstrip().startswith(b"mtllib"):
                    eol = b"\r" if ln.endswith(b"\r") else b""
                    lines[i] = b"mtllib " + mtl_name.encode() + eol
            patched = b"\n".join(lines)
            if FORCE or not out.exists() or out.read_bytes() != patched:
                out.write_bytes(patched)
                written += len(patched)
            put(src_dir / m["mtl"], f"{base}/{mtl_name}")
        else:
            main_name, mtl_name = m["obj"], m["mtl"]
            put(src_dir / main_name, f"{base}/{main_name}")
            put(src_dir / mtl_name, f"{base}/{mtl_name}")

        # Every other file of the model goes in as it came (the PNG textures), except the stray preview.
        main_src = {m["obj"], m.get("mtl", "")}
        all_files = []
        for f in sorted(src_dir.iterdir()):
            if f.is_dir() or f.name in SKIP_FILES or f.name in main_src:
                continue
            put(f, f"{base}/{f.name}")
            all_files.append(f.name)

        opacity: dict[str, float] = {}
        missing: list[str] = []
        if m["format"] == "obj":
            maps_raw, opacity = parse_mtl(src_dir / m["mtl"])
            maps = {}
            for mat, tex in maps_raw.items():
                if (src_dir / tex).exists():
                    maps[mat] = tex
                else:
                    missing.append(f"{mat} -> {tex}")
            verts, tris, segs = obj_segments(src_dir / m["obj"])
            parts = {part_of(m["rules"], o, mt) for o, mt in segs}
        else:
            maps = dict(m["maps"])
            for tex in maps.values():
                assert (src_dir / tex).exists(), tex
            verts, tris = fbx_counts(src_dir / m["obj"])
            parts = {"body", "robot"}

        faces = []
        if m.get("faces"):
            for p in sorted((src_dir / "Emote").glob("*.png")):
                put(p, f"{base}/emote/{p.name}")
                faces.append(f"emote/{p.name}")

        layers = [layer for layer in ("body", "weapon", "robot") if layer in parts or (layer == "robot" and "robotFace" in parts)]
        tex_files = sorted(set(maps.values()))
        info = {
            "format": m["format"],
            "dir": base,
            "obj": main_name,
            "mtl": mtl_name,
            "verts": verts,
            "tris": tris,
            "bytes": size_of(f"{base}/{main_name}"),
            "maps": maps,
            "rules": m["rules"],
            "layers": layers,
            "faces": faces,
            "texBytes": sum(size_of(f"{base}/{t}") for t in tex_files),
            "files": len(all_files) + (2 if mtl_name else 1) + len(faces),
        }
        info["totalBytes"] = (
            sum(size_of(f"{base}/{n}") for n in all_files)
            + info["bytes"]
            + (size_of(f"{base}/{mtl_name}") if mtl_name else 0)
            + sum(size_of(f"{base}/{f}") for f in faces)
        )
        if opacity:
            info["opacity"] = opacity
        item = {
            "id": f"others-3d-{slug}",
            "kind": "model",
            "group": "models",
            "title": m["title"],
            "collection": "others",
            "chars": m["chars"],
            "pair": m["pair"],
            "canon": "official",
            "tags": ["3d", "model", "game client", *m["chars"], "visual reference", *([m["skin"].lower()] if m.get("skin") else [])],
            "note": m.get("note")
            or "A game client model supplied by the site's owner, used here as a visual reference. The parts sit as the client file stores them.",
            "model": info,
        }
        if m.get("skin"):
            item["skin"] = m["skin"]
        if m.get("owner"):
            item["credit"] = {
                "by": "Supplied by the site's owner",
                "platform": None,
                "url": None,
                "note": "A game client model, used as a visual reference.",
            }
        render = RENDERS / f"{slug}.png"
        if render.exists():
            item["img"] = common.image_set(render, f"{base}/preview", full_max=1600, force=FORCE)
        items.append(item)
        total = sum(size_of(f"{base}/{n}") for n in all_files)
        print(
            f"model {slug}: {m['format']}, {verts} vertices, {tris} triangles, layers {layers}, "
            f"{len(maps)} mapped materials, {len(all_files)} extra files, {common.human(total + info['bytes'])}"
            + (f", MISSING textures: {missing}" if missing else "")
        )
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
    {"id": "models", "title": "3D models", "line": "Nine game client models of the Aspirants. Pick one, drag to turn it, scroll to come closer.", "kind": "models"},
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
