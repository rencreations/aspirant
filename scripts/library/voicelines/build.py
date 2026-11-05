"""Voicelines room: 380 voice lines, ten long compilations and sixteen trailer clips.

Run with the anaconda Python (needs ffmpeg and node on the PATH):

    C:/Users/muham/anaconda3/python.exe scripts/library/voicelines/build.py

Reads (read only)
    audio/<slug>/NN_<Japanese>.flac, audio/<slug>/voice.md, audio/<slug>/<slug>.m4a,
    audio/obsidia/long/obsidia.m4a,
    media/ruby-and-angela/video/trailer/{voicelines/*, english.srt}
    apps/web/src/content (the reviewed English text and the character cards, through node)

Writes
    <mirror>/library/v1/voicelines/<slug>/NN.m4a   AAC, 96 kbps, 44.1 kHz, mono stays mono
    <mirror>/library/v1/voicelines/<slug>/NN.flac  the original, copied unchanged
    <mirror>/library/v1/voicelines/<slug>/full.m4a the long compilation of the character
    <mirror>/library/v1/voicelines/trailer/NN.*    the sixteen trailer clips
    apps/web/public/data/library/voicelines.json
    scripts/library/ignored.json                   source files this room deliberately leaves out

Idempotent: a step whose output is newer than its input is skipped.
"""

from __future__ import annotations

import csv
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

WORK = common.WORK / "voicelines"
WORK.mkdir(parents=True, exist_ok=True)

IGNORED = Path(__file__).resolve().parents[1] / "ignored.json"
TRAILER_DIR = common.MEDIA / "ruby-and-angela" / "video" / "trailer"
TRAILER_FILM_ID = "film-ruby-and-angela-video-trailer-trailer-final"

JOBS = 3  # the machine is shared: at most three ffmpeg jobs at a time

NOTE_CUT_OFF = "The recording is cut off at the end."
NOTE_JOKER = (
    "The file name reads ジョーカー (Joker), a transcript error. "
    "The line is addressed to Chang'e (嫦娥)."
)
NOTE_SHARED = "This line is also in {other}'s list, with the same Japanese and the same file name."

TRANSLATOR_NOTE = re.compile(r"\s*\((cut off)\)\s*$", re.I)


# ---------------------------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------------------------


def punct_free(text: str) -> str:
    return re.sub(r"[^\w']", "", text.lower(), flags=re.UNICODE)


def parse_voice_md(slug: str) -> list[dict[str, Any]]:
    """Rows of audio/<slug>/voice.md: number, the file on disk, the English as written."""
    rows = []
    path = common.AUDIO / slug / "voice.md"
    for line in path.read_text(encoding="utf-8").splitlines():
        if not re.match(r"^\|\s*\d+\s*\|", line):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 3:
            raise SystemExit(f"{slug}: bad row {line!r}")
        n = int(cells[0])
        fname = cells[1].strip("`")
        m = re.match(r"^(\d+)_(.+)\.flac$", fname)
        if not m or int(m.group(1)) != n:
            raise SystemExit(f"{slug} {n}: bad file name {fname!r}")
        src = common.AUDIO / slug / fname
        if not src.exists():
            raise SystemExit(f"{slug} {n}: missing {src}")
        rows.append({"n": n, "file": fname, "src": src, "jp": m.group(2), "md_en": cells[2]})
    for i, r in enumerate(rows):
        if r["n"] != i + 1:
            raise SystemExit(f"{slug}: line numbers are not 1..N")
    on_disk = len(list((common.AUDIO / slug).glob("*.flac")))
    if on_disk != len(rows):
        raise SystemExit(f"{slug}: {on_disk} flac files but {len(rows)} rows in voice.md")
    return rows


def load_site_content() -> tuple[dict[str, list[dict]], dict[str, dict]]:
    script = Path(__file__).with_name("dump-site-content.mjs")
    subprocess.run(
        ["node", "--experimental-strip-types", "--no-warnings", str(script), str(WORK)],
        check=True,
        capture_output=True,
    )
    voice = json.loads((WORK / "site-voice.json").read_text(encoding="utf-8"))
    chars = json.loads((WORK / "site-chars.json").read_text(encoding="utf-8"))
    return voice, chars


# ---------------------------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------------------------


def encode_m4a(src: Path, out: Path, bitrate: str) -> bool:
    """AAC m4a at 44.1 kHz. The channel count is kept (mono stays mono). True when it ran."""
    if common.fresh(out, src):
        return False
    tmp = out.with_suffix(".tmp.m4a")
    cmd = [
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-vn", "-map_metadata", "-1",
        "-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-movflags", "+faststart", str(tmp),
    ]
    subprocess.run(cmd, check=True)
    tmp.replace(out)
    return True


def copy_unchanged(src: Path, out: Path) -> bool:
    if out.exists() and out.stat().st_size == src.stat().st_size and out.stat().st_mtime >= src.stat().st_mtime:
        return False
    shutil.copyfile(src, out)
    return True


def flac_seconds(path: Path) -> float | None:
    """Duration read from the FLAC STREAMINFO block (no process needed)."""
    with path.open("rb") as f:
        head = f.read(42)
    if head[:4] != b"fLaC" or len(head) < 42:
        return None
    info = head[8:42]
    rate = (info[10] << 12) | (info[11] << 4) | (info[12] >> 4)
    total = ((info[13] & 0x0F) << 32) | int.from_bytes(info[14:18], "big")
    return total / rate if rate and total else None


_DUR_CACHE = WORK / "durations.json"


def duration(path: Path) -> float:
    """Seconds. FLAC is read directly. Anything else asks ffprobe for the duration only
    (`common.ffprobe` prints the whole file name too, and Japanese names break its text
    decoding), retried, and remembered by size and time so a re-run is cheap."""
    if path.suffix.lower() == ".flac":
        value = flac_seconds(path)
        if value:
            return round(value, 2)
    st = path.stat()
    stamp = f"{st.st_size}:{int(st.st_mtime)}"
    cache = json.loads(_DUR_CACHE.read_text(encoding="utf-8")) if _DUR_CACHE.exists() else {}
    hit = cache.get(str(path))
    if hit and hit["stamp"] == stamp:
        return hit["dur"]
    last: Exception | None = None
    for _ in range(4):
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                check=True,
                timeout=120,
            ).stdout
            value = round(float(out.strip()), 2)
            if value > 0:
                cache[str(path)] = {"stamp": stamp, "dur": value}
                _DUR_CACHE.write_text(json.dumps(cache), encoding="utf-8")
                return value
        except (subprocess.SubprocessError, ValueError) as e:  # noqa: PERF203
            last = e
    raise SystemExit(f"no duration for {path}: {last}")


# ---------------------------------------------------------------------------------------------
# Trailer subtitles
# ---------------------------------------------------------------------------------------------


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    cues = []
    text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.split("\n")
        if len(lines) < 3:
            continue
        m = re.match(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)", lines[1])
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        start = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        end = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        cues.append((start, end, common.clean_text(" ".join(lines[2:]))))
    return cues


def overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


# ---------------------------------------------------------------------------------------------
# Ignored sources
# ---------------------------------------------------------------------------------------------


def merge_ignored(entries: dict[str, str]) -> None:
    """Read, update, write at once, so another room's entries are kept."""
    current: dict[str, str] = {}
    if IGNORED.exists():
        current = json.loads(IGNORED.read_text(encoding="utf-8"))
    current.update(entries)
    IGNORED.write_text(
        json.dumps(dict(sorted(current.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------


def main() -> None:
    site_voice, site_chars = load_site_content()
    log: list[str] = []
    jobs: list[tuple[Path, Path, str]] = []  # (src, out, bitrate)
    copies: list[tuple[Path, Path]] = []
    items: list[dict[str, Any]] = []
    characters: list[dict[str, Any]] = []
    ignored: dict[str, str] = {}

    def rel(p: Path) -> str:
        return p.relative_to(common.SRC).as_posix()

    by_slug_rows: dict[str, list[dict[str, Any]]] = {}
    for slug in common.CHAR_SLUGS:
        rows = parse_voice_md(slug)
        by_slug_rows[slug] = rows
        site = site_voice[slug]
        if len(site) != len(rows):
            raise SystemExit(f"{slug}: site has {len(site)} lines, voice.md has {len(rows)}")
        ignored[rel(common.AUDIO / slug / "voice.md")] = "Read into voicelines.json (text of the lines), not shipped as a file."

    # Lines of Guinevere and Vexana that share a name (30 and 31): the same words, two folders.
    shared = {
        ("guinevere", r["n"]): "Vexana"
        for r in by_slug_rows["guinevere"]
        for v in by_slug_rows["vexana"]
        if r["file"] == v["file"]
    }
    shared.update(
        {
            ("vexana", v["n"]): "Guinevere"
            for v in by_slug_rows["vexana"]
            for r in by_slug_rows["guinevere"]
            if r["file"] == v["file"]
        }
    )

    for slug in common.CHAR_SLUGS:
        card = site_chars[slug]
        name = card["name"]
        pair = card["pair"]
        line_dur = 0.0
        for row, site_line in zip(by_slug_rows[slug], site_voice[slug]):
            n = row["n"]
            md_en = TRANSLATOR_NOTE.sub("", row["md_en"])
            site_en = site_line["en"]
            if punct_free(md_en) == punct_free(site_en):
                en = site_en
            else:
                en = common.clean_text(md_en)
                log.append(f"{slug} {n:02d}: site English differs, used voice.md: {site_en!r} vs {md_en!r}")
            en = common.clean_text(en)
            notes = []
            if slug == "lesley" and n in (36, 37):
                notes.append(NOTE_JOKER)
            if TRANSLATOR_NOTE.search(row["md_en"]):
                notes.append(NOTE_CUT_OFF)
            if (slug, n) in shared:
                notes.append(NOTE_SHARED.format(other=shared[(slug, n)]))
            nn = f"{n:02d}"
            key = f"voicelines/{slug}/{nn}"
            out_m4a = common.key_path(f"{key}.m4a")
            out_flac = common.key_path(f"{key}.flac")
            jobs.append((row["src"], out_m4a, "96k"))
            copies.append((row["src"], out_flac))
            dur = duration(row["src"])
            line_dur += dur
            item: dict[str, Any] = {
                "id": f"voice-{slug}-{nn}",
                "title": f"{name}: {en}",
                "collection": "voicelines",
                "chars": [slug],
                "pair": pair,
                "canon": "official",
                "tags": ["voice line", "line"],
                "slug": slug,
                "n": n,
                "jp": row["jp"],
                "en": en,
            }
            if notes:
                item["note"] = " ".join(notes)
            item.update({"m4a": f"{key}.m4a", "flac": f"{key}.flac", "dur": dur, "group": "line"})
            items.append(item)

        # The long compilation of this character.
        comp_src = common.AUDIO / slug / "long" / f"{slug}.m4a" if slug == "obsidia" else common.AUDIO / slug / f"{slug}.m4a"
        if slug == "obsidia":
            comp_src = common.AUDIO / "obsidia" / "long" / "obsidia.m4a"
        comp_key = f"voicelines/{slug}/full"
        out_full = common.key_path(f"{comp_key}.m4a")
        jobs.append((comp_src, out_full, "128k"))
        comp_dur = duration(comp_src)
        n_lines = len(by_slug_rows[slug])
        items.append(
            {
                "id": f"voice-{slug}-full",
                "title": f"{name}: full compilation",
                "collection": "voicelines",
                "chars": [slug],
                "pair": pair,
                "canon": "official",
                "tags": ["voice line", "compilation", "full"],
                "slug": slug,
                "n": 0,
                "jp": "",
                "en": "",
                "note": f"All {n_lines} lines of {name} in one recording, in order.",
                "m4a": f"{comp_key}.m4a",
                "dur": comp_dur,
                "group": "compilation",
            }
        )
        src_mp4 = common.AUDIO / "source" / f"{slug}.mp4"
        if src_mp4.exists():
            ignored[rel(src_mp4)] = (
                f"The recording behind {slug}'s compilation (HEVC video, up to 516 MB). "
                "Its sound is already the compilation m4a, and the room plays sound only."
            )
        characters.append(
            {
                "slug": slug,
                "name": name,
                "jp": card["jp"]["script"],
                "romaji": card["jp"]["romaji"],
                "aspirant": card["aspirantName"],
                "pair": pair,
                "palette": card["palette"],
                "splash": f"img/char/{slug}/splash-sm.webp",
                "lines": n_lines,
                "dur": round(line_dur, 2),
                "full": f"voice-{slug}-full",
                "fullDur": comp_dur,
            }
        )

    # The trailer clips: Japanese only, with the trailer's own English subtitle beside them.
    clip_dir = TRAILER_DIR / "voicelines"
    manifest = list(csv.DictReader((clip_dir / "clip_manifest.csv").open(encoding="utf-8-sig")))
    cues = parse_srt(TRAILER_DIR / "english.srt")
    speaker_slug = {"Ruby": "ruby", "Angry Ruby": "ruby", "Angela": "angela", "Fanny": "fanny"}
    cue_users: dict[int, int] = {}
    matches: list[list[int]] = []
    for m in manifest:
        t0, t1 = float(m["start_seconds"]), float(m["end_seconds"])
        hit = [i for i, (c0, c1, _) in enumerate(cues) if overlap(t0, t1, c0, c1) / (t1 - t0) > 0.3]
        matches.append(hit)
        for i in hit:
            cue_users[i] = cue_users.get(i, 0) + 1
    for m, hit in zip(manifest, matches):
        n = int(m["number"])
        nn = f"{n:02d}"
        src = clip_dir / m["filename"]
        if not src.exists():
            raise SystemExit(f"missing trailer clip {src}")
        who = speaker_slug[m["speaker"]]
        card = site_chars[who]
        key = f"voicelines/trailer/{nn}"
        jobs.append((src, common.key_path(f"{key}.m4a"), "128k"))
        copies.append((src, common.key_path(f"{key}.flac")))
        sub = common.clean_text(" ".join(cues[i][2] for i in hit))
        note = "No official translation."
        if sub and any(cue_users[i] > 1 for i in hit):
            note += " One subtitle covers this clip and the one beside it."
        item = {
            "id": f"voice-trailer-{nn}",
            "title": f"Trailer clip {n}: {card['name']}" + (" (angry)" if m["speaker"] == "Angry Ruby" else ""),
            "collection": "voicelines",
            "chars": [who],
            "pair": card["pair"],
            "canon": "official",
            "tags": ["voice line", "trailer clip", "trailer"],
            "slug": who,
            "n": n,
            "speaker": m["speaker"],
            "jp": m["japanese_text"],
            "en": "",
            "sub": sub,
            "note": note,
            "m4a": f"{key}.m4a",
            "flac": f"{key}.flac",
            "dur": float(m["duration_seconds"]),
            "t": float(m["start_seconds"]),
            "film": TRAILER_FILM_ID,
            "group": "trailer",
        }
        items.append(item)
    ignored[rel(clip_dir / "clip_manifest.csv")] = "Read into voicelines.json (speaker and time of each clip)."
    ignored[rel(clip_dir / "README.txt")] = "Read for the clip notes, not shipped as a file."
    for who in ("angela", "ruby", "trailer"):
        out_m4a = common.MEDIA / "ruby-and-angela" / "video" / who / "output.m4a"
        film = {"angela": "angela-final", "ruby": "ruby-final", "trailer": "trailer-final"}[who]
        ignored[rel(out_m4a)] = f"The sound track of {film}.mp4, which is in the Films room. Not a separate recording."

    # Encode and copy, three at a time.
    print(f"encoding {len(jobs)} files, copying {len(copies)}")
    with ThreadPoolExecutor(JOBS) as pool:
        ran = sum(pool.map(lambda j: encode_m4a(*j), jobs))
    copied = sum(copy_unchanged(s, o) for s, o in copies)
    print(f"encoded {ran}, copied {copied} (the rest were fresh)")

    # Totals and file.
    lines = [i for i in items if i["group"] == "line"]
    totals = {
        "lines": len(lines),
        "compilations": sum(1 for i in items if i["group"] == "compilation"),
        "trailer": sum(1 for i in items if i["group"] == "trailer"),
        "seconds": round(sum(i["dur"] for i in items), 1),
    }
    if totals["lines"] != 380:
        raise SystemExit(f"expected 380 lines, found {totals['lines']}")
    ids = [i["id"] for i in items]
    if len(set(ids)) != len(ids):
        raise SystemExit("duplicate ids")
    problems = [p for i in items for p in common.check_json_text(i["en"], i["id"])]
    if problems:
        raise SystemExit("\n".join(problems))
    data = {"v": 1, "slug": "voicelines", "totals": totals, "characters": characters, "items": items}
    common.write_json("voicelines", data)
    merge_ignored(ignored)

    # Report.
    flac_bytes = sum(p.stat().st_size for p in (common.LIB_ROOT / "voicelines").rglob("*.flac"))
    m4a_bytes = sum(p.stat().st_size for p in (common.LIB_ROOT / "voicelines").rglob("*.m4a"))
    print(f"items {len(items)}: {totals}")
    print(f"mirror voicelines/: flac {common.human(flac_bytes)}, m4a {common.human(m4a_bytes)}")
    for entry in log:
        print("  note:", entry)
    print(f"ignored.json updated with {len(ignored)} entries")


if __name__ == "__main__":
    main()
