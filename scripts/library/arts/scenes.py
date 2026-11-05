"""Scene stills for the Arts room: a still for every distinct scene of every official animated film.

Run with the anaconda Python (numpy, Pillow; ffmpeg on the PATH):

    python scripts/library/arts/scenes.py                 # every film (cached, so a re-run is cheap)
    python scripts/library/arts/scenes.py --only trailer  # films whose path contains the text
    python scripts/library/arts/scenes.py --force         # ignore the cache
    python scripts/library/arts/scenes.py --list          # print the film list and skipped videos

Writes the stills into the mirror (`arts/scenes/<film id>/<NNN>/{t,p,f}.webp`) and the data file
`apps/web/public/data/library/arts-scenes.json`. The cache of every film (analysis, extracted
frames and the result) is in `scripts/library/.cache/scenes/<film id>/`.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import common  # noqa: E402
import scenes_detect as sd  # noqa: E402
import scenes_films as sf  # noqa: E402

CACHE = common.REPO / "scripts" / "library" / ".cache" / "scenes"
FULL_MAX = 1920
NOTE_MAX = 150


# --- text ---------------------------------------------------------------------------------------
def _open_quote(text: str) -> int | None:
    """Index of a single quote that opens a quoted line and is never closed, or None."""
    stack: list[int] = []
    for m in re.finditer(r"'", text):
        i = m.start()
        prev = text[i - 1] if i > 0 else " "
        nxt = text[i + 1] if i + 1 < len(text) else " "
        if prev.isalnum() and nxt.isalnum():
            continue  # an apostrophe inside a word
        if i == 0 or (not prev.isalnum() and prev not in ".!?,;:)"):
            stack.append(i)
        elif stack:
            stack.pop()
    return stack[-1] if stack else None


def _balanced(text: str) -> bool:
    return text.count("(") == text.count(")") and _open_quote(text) is None


def short_note(note: str) -> str:
    """The footage note as one plain sentence of at most about 150 characters. It never ends inside
    a bracket or a quoted line."""
    s = " ".join(common.clean_text(note).replace(chr(10), " ").split())
    if len(s) <= NOTE_MAX:
        return s
    # The longest clause end that fits and leaves nothing open.
    for k in range(NOTE_MAX, 49, -1):
        if k < len(s) and s[k] in ",;" or (k < len(s) and s[k] == " " and s[k - 1] in "'\")"):
            cut = s[:k].rstrip(" ,;:-/")
            if _balanced(cut):
                return cut if cut.endswith((".", "!", "?")) else cut + "."
    # Otherwise cut at a word and drop what is left open.
    cut = s[:NOTE_MAX]
    cut = cut[: cut.rfind(" ")] if " " in cut else cut
    while cut.count("(") > cut.count(")") and "(" in cut:
        cut = cut[: cut.rfind("(")]
    q = _open_quote(cut)
    if q is not None:
        cut = cut[:q]
    cut = cut.rstrip(" ,;:-/")
    return cut if cut.endswith((".", "!", "?")) else cut + "."


def quality_pass(stills: list[dict]) -> list[dict]:
    """Drop flat frames and a still that repeats the one just before it (same picture, a speech bubble
    or a flash added). Works on the stored 32x18 thumbnails, so it needs no new decode. The still
    numbers are kept, so a still keeps its address when a neighbour goes."""
    from PIL import Image

    def bits(th: np.ndarray) -> int:
        a = np.asarray(Image.fromarray(th).resize((9, 8), Image.BOX), dtype=np.int16)
        return int.from_bytes(np.packbits((a[:, 1:] > a[:, :-1]).flatten()).tobytes(), "big")

    kept: list[dict] = []
    last_bits = last_thumb = None
    for st in stills:
        th = np.array(st["thumb"], dtype=np.uint8).reshape(18, 32)
        if float(th.std()) < 7.0:
            continue
        b = bits(th)
        if kept and last_thumb is not None and st["t"] - kept[-1]["t"] <= 4.0:
            mad = float(np.abs(th.astype(np.int16) - last_thumb.astype(np.int16)).mean())
            # The same picture a moment later (a speech bubble, a flash or a small move added).
            if sd.hamming(b, last_bits) <= 12 and mad < 30.0:
                continue
        kept.append(st)
        last_bits, last_thumb = b, th
    return kept


def mmss(t: float) -> str:
    t = int(t)
    return f"{t // 60:02d}:{t % 60:02d}"


def load_beats(spec: sf.FilmSpec) -> list[dict]:
    """Footage sections of a film: [{i, from, to, note}] in seconds, or []."""
    if not spec.manifest:
        return []
    m = json.loads((common.MEDIA / spec.manifest).read_text(encoding="utf-8"))
    src = Path(m.get("source", "")).name
    if src and src != Path(spec.rel).name:
        print(f"  warning: manifest source {src} is not {Path(spec.rel).name}", flush=True)
    fps = float(m.get("fps") or 24)
    out = []
    for it in m["footages"]:
        out.append(
            {
                "i": int(it["index"]),
                "from": round(it["start_frame"] / fps, 3),
                "to": round(it["end_frame_exclusive"] / fps, 3),
                "note": short_note(it.get("note", "")),
            }
        )
    return out


def beat_for(beats: list[dict], t: float) -> dict | None:
    for b in beats:
        if b["from"] <= t < b["to"]:
            return b
    if beats and t >= beats[-1]["to"]:
        return beats[-1]
    return None


# --- one film -----------------------------------------------------------------------------------
def _cache_key(spec: sf.FilmSpec) -> dict:
    st = spec.path.stat()
    return {"algo": sd.ALGO, "size": st.st_size, "mtime": int(st.st_mtime), "full": FULL_MAX}


def _extract(spec: sf.FilmSpec, geo: sd.Geometry, t: float, out: Path) -> None:
    cw, ch, x, y = geo.crop
    vf = f"crop={cw}:{ch}:{x}:{y},scale=w='min({FULL_MAX},iw)':h=-2:flags=lanczos"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0.0, t):.4f}", "-i", str(spec.path), "-frames:v", "1",
         "-an", "-sn", "-vf", vf, "-pix_fmt", "rgb24", str(out)],
        check=True, timeout=300, stdout=subprocess.DEVNULL,
    )


def _extract_batch(spec: sf.FilmSpec, geo: sd.Geometry, items: list[dict], cdir: Path, log: list[str]) -> set[int]:
    """Decode the film once and write the frames of `items` (by frame number). Returns the still numbers written."""
    cw, ch, x, y = geo.crop
    ordered = sorted(items, key=lambda st: st["frame"])
    tmp = cdir / "batch"
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)
    got: set[int] = set()
    # The select expression grows with the number of frames, so work in groups of 60.
    for g in range(0, len(ordered), 60):
        group = ordered[g : g + 60]
        expr = "+".join(f"eq(n,{st['frame']})" for st in group)
        vf = f"select='{expr}',crop={cw}:{ch}:{x}:{y},scale=w='min({FULL_MAX},iw)':h=-2:flags=lanczos"
        out = tmp / f"g{g:04d}_%04d.png"
        r = subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(spec.path), "-an", "-sn", "-vf", vf, "-fps_mode", "passthrough",
             "-pix_fmt", "rgb24", str(out)],
            capture_output=True, timeout=1800, encoding="utf-8", errors="replace",
        )
        files = sorted(tmp.glob(f"g{g:04d}_*.png"))
        if r.returncode != 0 or len(files) != len(group):
            log.append(f"  batch {g}: {len(files)} of {len(group)} frames (code {r.returncode})")
        for st, f in zip(group, files):
            shutil.move(str(f), cdir / f"{st['n']:03d}.png")
            got.add(st["n"])
    shutil.rmtree(tmp, ignore_errors=True)
    return got


def _png_thumb(png: Path) -> np.ndarray:
    with Image.open(png) as im:
        return sd.thumb18(np.asarray(im.convert("RGB")))


def process_film(spec_rel: str, force: bool = False, images: bool = True) -> dict:
    spec = next(s for s in sf.films() if s.rel == spec_rel)
    t_start = time.time()
    cdir = CACHE / spec.id
    cdir.mkdir(parents=True, exist_ok=True)
    key = _cache_key(spec)
    ana_path = cdir / "analysis.json"
    ana = None
    if ana_path.exists() and not force:
        a = json.loads(ana_path.read_text(encoding="utf-8"))
        if a.get("key") == key:
            ana = a
    log = []
    if ana is None:
        for old in cdir.glob("*.png"):
            old.unlink()
        info = sd.probe(spec.path)
        crop = sd.detect_crop(spec.path, info["w"], info["h"], info["dur"])
        aw, ah = sd.analysis_size(crop[0], crop[1])
        geo = sd.Geometry(info["w"], info["h"], info["fps"], info["dur"], crop, aw, ah)
        feats = None
        for attempt in range(3):
            feats = sd.analyse(spec.path, geo)
            if feats.n >= 0.9 * info["dur"] * info["fps"]:
                break
            log.append(f"decode gave {feats.n} frames of about {int(info['dur'] * info['fps'])}, trying again")
            time.sleep(5)
        if feats is None or feats.n < 0.9 * info["dur"] * info["fps"]:
            raise RuntimeError(f"decode failed: {feats.n if feats else 0} frames")
        segs = sd.segment(feats, geo.fps)
        picks = sd.choose(feats, geo.fps, segs)
        dp, dh = sd.frame_diffs(feats)
        cuts = sd.find_cuts(dp, dh)
        stills = []
        for n, p in enumerate(picks, 1):
            fr = p["frame"]
            stills.append(
                {
                    "n": n,
                    "frame": fr,
                    "t": round(fr / geo.fps, 3),
                    "how": p["how"],
                    "seg": [round(p["seg"][0] / geo.fps, 3), round(p["seg"][1] / geo.fps, 3)],
                    "sharp": round(p["sharp"], 1),
                    "mean": round(feats.mean[fr], 1),
                    "thumb": feats.thumb[fr].flatten().tolist(),
                    "done": False,
                }
            )
        ana = {
            "key": key,
            "geo": {"w": geo.w, "h": geo.h, "fps": geo.fps, "dur": geo.dur, "crop": list(crop), "aw": aw, "ah": ah},
            "frames": feats.n,
            "cuts": len(cuts),
            "shots": len(segs),
            "stills": stills,
        }
        ana_path.write_text(json.dumps(ana), encoding="utf-8")
        log.append(f"analysed {feats.n} frames, {len(cuts)} cuts, {len(segs)} shots, {len(stills)} stills")
    g = ana["geo"]
    geo = sd.Geometry(g["w"], g["h"], g["fps"], g["dur"], tuple(g["crop"]), g["aw"], g["ah"])
    stills = quality_pass(ana["stills"])
    keep = {st["n"] for st in stills}
    if len(stills) != len(ana["stills"]):
        log.append(f"quality pass kept {len(stills)} of {len(ana['stills'])} stills")
    bad = 0
    if images:
        # Remove stills of an older run that are no longer wanted.
        for old in cdir.glob("*.png"):
            if int(old.stem) not in keep:
                old.unlink()
        base = common.LIB_ROOT / "arts" / "scenes" / spec.id
        if base.exists():
            for d in base.iterdir():
                if d.is_dir() and d.name.isdigit() and int(d.name) not in keep:
                    shutil.rmtree(d, ignore_errors=True)
        changed = False
        pending = [st for st in stills if not (st.get("done") and (cdir / f"{st['n']:03d}.png").exists())]
        if pending:
            # One pass over the film for every pending frame (a seek for each one is far slower).
            got = _extract_batch(spec, geo, pending, cdir, log)
            for st in pending:
                png = cdir / f"{st['n']:03d}.png"
                want = np.array(st["thumb"], dtype=np.uint8).reshape(18, 32)
                diff = None
                if st["n"] in got:
                    diff = float(np.abs(_png_thumb(png).astype(np.int16) - want.astype(np.int16)).mean())
                if diff is not None and diff <= 6.0:
                    st["off"], st["diff"] = 0, round(diff, 2)
                else:
                    # A mismatch (or a missing frame): seek to it, trying the frames next to it.
                    best = None
                    for off in (0, -1, 1, -2, 2, -3, 3):
                        _extract(spec, geo, (st["frame"] + off + 0.5) / geo.fps, png)
                        d = float(np.abs(_png_thumb(png).astype(np.int16) - want.astype(np.int16)).mean())
                        if best is None or d < best[0]:
                            best = (d, off)
                        if d <= 6.0:
                            break
                    if best and best[0] > 6.0 and best[1] != off:
                        _extract(spec, geo, (st["frame"] + best[1] + 0.5) / geo.fps, png)
                    st["diff"], st["off"] = round(best[0], 2), best[1]
                    if best[0] > 12:
                        bad += 1
                        log.append(f"  mismatch still {st['n']} at {st['t']}s (diff {best[0]:.1f})")
                st["t"] = round((st["frame"] + st["off"]) / geo.fps, 3)
                st["done"] = True
                changed = True
        if changed:
            ana_path.write_text(json.dumps(ana), encoding="utf-8")

    beats = load_beats(spec)
    scenes = []
    mirror_bytes = 0
    pw = ph = 0
    for st in stills:
        png = cdir / f"{st['n']:03d}.png"
        base_key = f"arts/scenes/{spec.id}/{st['n']:03d}"
        img = None
        if images:
            img = common.image_set(png, base_key, full_max=FULL_MAX, preview=960, thumb=480, q_full=85)
            pw, ph = img["w"], img["h"]
        b = beat_for(beats, st["t"])
        scenes.append(
            {
                "id": f"scene-{spec.id[5:]}-{st['n']:03d}",
                "t": round(st["t"], 2),
                "time": mmss(st["t"]),
                "note": b["note"] if b else "",
                "img": img,
                "beat": b["i"] if b else None,
                "_sharp": st["sharp"],
                "_mean": st["mean"],
            }
        )
    if images:
        root = common.LIB_ROOT / "arts" / "scenes" / spec.id
        mirror_bytes = sum(f.stat().st_size for f in root.rglob("*.webp")) if root.exists() else 0
    cw, ch = g["crop"][0], g["crop"][1]
    film = {
        "id": spec.id,
        "title": spec.title,
        "pair": spec.pair,
        "chars": list(spec.chars),
        "kind": spec.kind,
        "duration": round(g["dur"], 1),
        "w": pw or min(cw, FULL_MAX),
        "h": ph or (round(min(cw, FULL_MAX) * ch / cw / 2) * 2),
        "beats": beats,
        "scenes": scenes,
    }
    return {
        "film": film,
        "bytes": mirror_bytes,
        "bad": bad,
        "log": log,
        "secs": round(time.time() - t_start, 1),
        "cuts": ana.get("cuts"),
        "shots": ana.get("shots"),
        "crop": g["crop"],
    }


# --- poster, data file ---------------------------------------------------------------------------
def pick_poster(film: dict) -> int:
    """Index of the still that stands for the film: sharp and bright, between 12% and 75% of the film."""
    best, best_i = -1.0, 0
    dur = film["duration"] or 1
    for i, s in enumerate(film["scenes"]):
        frac = s["t"] / dur
        if not 0.12 <= frac <= 0.75:
            continue
        score = s["_sharp"] * min(1.0, s["_mean"] / 60.0)
        if score > best:
            best, best_i = score, i
    if best < 0 and film["scenes"]:
        best_i = len(film["scenes"]) // 3
    return best_i


def build_data(results: list[dict]) -> dict:
    films = []
    for r in results:
        f = r["film"]
        if not f["scenes"]:
            continue
        f["poster"] = pick_poster(f)
        for s in f["scenes"]:
            s.pop("_sharp", None)
            s.pop("_mean", None)
        films.append(f)
    return {
        "v": 1,
        "films": films,
        "totals": {"films": len(films), "scenes": sum(len(f["scenes"]) for f in films)},
        # The film (index in `films`) of every still, in order. The Arts page counts the stills by
        # the length of this list without reading the films.
        "items": [i for i, f in enumerate(films) for _ in f["scenes"]],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma separated path fragments")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--no-images", action="store_true", help="analyse only (no extraction, no data file)")
    args = ap.parse_args()

    allfilms = sf.films()
    if args.list:
        for s in allfilms:
            print(f"{s.id}  {s.title}  [{s.kind}]  manifest={'yes' if s.manifest else 'no'}")
        print("\nSkipped:")
        for k, v in sf.SKIPPED.items():
            print(f"  {k}: {v}")
        return 0

    frags = [x for x in args.only.split(",") if x]
    chosen = [s for s in allfilms if not frags or any(x in s.rel for x in frags)]
    # Biggest files first so the three workers finish together.
    chosen.sort(key=lambda s: -s.path.stat().st_size)
    results: dict[str, dict] = {}
    failed: dict[str, str] = {}
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=max(1, min(3, args.workers))) as ex:
        futs = {ex.submit(process_film, s.rel, args.force, not args.no_images): s for s in chosen}
        for fut in as_completed(futs):
            s = futs[fut]
            try:
                r = fut.result()
            except Exception as e:  # noqa: BLE001
                failed[s.id] = f"{type(e).__name__}: {e}"
                traceback.print_exc()
                continue
            results[s.id] = r
            n = len(r["film"]["scenes"])
            print(
                f"{s.id}: {n} stills, {r['cuts']} cuts, {r['shots']} shots, {common.human(r['bytes'])}, "
                f"{r['secs']}s, crop {r['crop']}" + (f", {r['bad']} mismatches" if r["bad"] else ""),
                flush=True,
            )
            for line in r["log"]:
                print("   ", line, flush=True)
    print(f"\nprocessed {len(results)} films in {time.time() - t0:.0f}s")
    if failed:
        print("FAILED:", json.dumps(failed, indent=1))
    if args.no_images:
        print("stills (analysis only):", sum(len(r["film"]["scenes"]) for r in results.values()))
        return 0

    if frags:
        print("--only: the data file is written by a run without --only (cached films are quick)")
        return 1 if failed else 0
    full = [results[s.id] for s in allfilms if s.id in results]
    data = build_data(full)
    common.write_json("arts-scenes", data)
    total_bytes = sum(r["bytes"] for r in full)
    print(f"\nfilms {data['totals']['films']}, scenes {data['totals']['scenes']}, mirror {common.human(total_bytes)}")
    for r in full:
        f = r["film"]
        print(f"  {len(f['scenes']):4d}  {common.human(r['bytes']):>9}  {f['id']}")
    print("\nSkipped on purpose:")
    for k, v in sf.SKIPPED.items():
        print(f"  {k}: {v}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
