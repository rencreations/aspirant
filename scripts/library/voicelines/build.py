"""Voicelines room: eight languages, ten Aspirants, one data file for each.

Run with the anaconda Python (needs ffmpeg on the PATH):

    C:/Users/muham/anaconda3/python.exe scripts/library/voicelines/build.py

Reads (read only)
    audio/<slug>/<slug>-japanese/voice.md and NN_<Japanese>.flac (the Japanese list of the character;
        a row may name an mp3 in <slug>-japanese/trailer/, those are kept as mp3)
    audio/<slug>/<slug>-<language>/manifest.json and NN_<text>.flac for english, arabic, indonesian,
        spanish, portuguese, turkish and russian (the transcript of a clip is the text of the line)
    audio/selena/selena-japanese/trailer/*.flac and voiceline_index.csv (Selena's trailer clips)
    scripts/library/voicelines/carry.json  what the room already had: the ten full compilations,
        the sixteen Ruby and Angela trailer clips, the notes on the Japanese lines and the character cards
        (made once from the first version of voicelines.json, so their keys and ids never change)

Writes
    <mirror>/library/v1/voicelines/<slug>/NN.{m4a,flac}          Japanese (keys of the first version, untouched)
    <mirror>/library/v1/voicelines/<slug>/<lang>/NN.{m4a,flac}   the seven other languages (new keys)
    <mirror>/library/v1/voicelines/<slug>/trailer/NN.{m4a,flac}  Selena's trailer clips (new keys)
    apps/web/public/data/library/voicelines.json                 the index: languages, characters, search items, hero
    apps/web/public/data/library/voicelines-<slug>.json          one file for each Aspirant: her lines in every language
    scripts/library/ignored.json                                 source files this room deliberately leaves out

How the languages relate (checked, see the report this prints):
    English, Arabic, Indonesian, Spanish, Portuguese, Turkish and Russian are ONE list: line N is the same
    line in all seven (the lengths of the clips agree line by line). Japanese is its own list: the Japanese
    game has its own order and a few other lines, so a Japanese line is never presented as the same line of
    another language. The Japanese rows carry their own English translation.

AAC is for playing (96 kbps), the original is for downloading. Idempotent: a step whose output is newer
than its input is skipped, and a key that exists is never written again with other content.

Loudness (loudness.py, added 18 Nov 2026): every line, trailer clip and recording carries `g`, a gain in dB that
levels it to the others. It is measured on the AAC in the mirror (cached in loudness.json) and applied by the player
(`audio.playVoice`, option `gainDb`). No file is encoded again and no key changes.
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
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
import loudness  # noqa: E402

HERE = Path(__file__).resolve().parent
CARRY = HERE / "carry.json"
HERO = HERE / "hero.json"
IGNORED = HERE.parent / "ignored.json"
FIRST_VERSION = common.DATA_DIR / "voicelines.json"
JOBS = 3  # the machine is shared: at most three ffmpeg jobs at a time

# The order of the shortcuts on the room: id, folder suffix, native name, English name, html lang, direction, flag.
LANGS: list[dict[str, str]] = [
    {"id": "en", "folder": "english", "name": "English", "english": "English", "html": "en", "dir": "ltr", "flag": "gb"},
    {"id": "id", "folder": "indonesian", "name": "Bahasa Indonesia", "english": "Indonesian", "html": "id", "dir": "ltr", "flag": "id"},
    {"id": "jp", "folder": "japanese", "name": "日本語", "english": "Japanese", "html": "ja", "dir": "ltr", "flag": "jp"},
    {"id": "ar", "folder": "arabic", "name": "اللغة العربية", "english": "Arabic", "html": "ar", "dir": "rtl", "flag": "ae"},
    {"id": "es", "folder": "spanish", "name": "español", "english": "Spanish", "html": "es", "dir": "ltr", "flag": "es"},
    {"id": "pt", "folder": "portuguese", "name": "português", "english": "Portuguese", "html": "pt", "dir": "ltr", "flag": "br"},
    {"id": "tr", "folder": "turkish", "name": "türkçe", "english": "Turkish", "html": "tr", "dir": "ltr", "flag": "tr"},
    {"id": "ru", "folder": "russian", "name": "русский", "english": "Russian", "html": "ru", "dir": "ltr", "flag": "ru"},
]
ALIGNED = [lang["id"] for lang in LANGS if lang["id"] != "jp"]  # one list, line N is the same line in all of them
FOLDER = {lang["id"]: lang["folder"] for lang in LANGS}

NOTE_FROM_AUDIO = (
    "The recording has this line but the screenshots of the text did not, so the words are what the audio says."
)
NOTE_TENTATIVE = "The Japanese and the English are tentative: they were not checked by ear."
# The owner's ruling (canon rules): 信念 is "aspirant power", and the site never says the other English word.
_BANNED_WORD = re.compile("con" + "viction", re.I)


def canon_words(text: str) -> str:
    return _BANNED_WORD.sub("aspirant power", text)


# ---------------------------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------------------------


def flac_seconds(path: Path) -> float:
    """Duration read from the FLAC STREAMINFO block (no process needed)."""
    with path.open("rb") as f:
        head = f.read(42)
    if head[:4] != b"fLaC" or len(head) < 42:
        raise SystemExit(f"not a FLAC file: {path}")
    info = head[8:42]
    rate = (info[10] << 12) | (info[11] << 4) | (info[12] >> 4)
    total = ((info[13] & 0x0F) << 32) | int.from_bytes(info[14:18], "big")
    return total / rate


def mp3_seconds(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, encoding="utf-8", errors="replace", check=True, timeout=120,
    ).stdout
    return float(out.strip())


def seconds(path: Path) -> float:
    return round(flac_seconds(path) if path.suffix.lower() == ".flac" else mp3_seconds(path), 2)


def load_carry() -> dict[str, Any]:
    """What the first version of the room shipped. Made once from its data file, then kept in the repo."""
    if CARRY.exists():
        return json.loads(CARRY.read_text(encoding="utf-8"))
    old = json.loads(FIRST_VERSION.read_text(encoding="utf-8"))
    if old.get("v") != 1:
        raise SystemExit("carry.json is missing and voicelines.json is not the first version")
    carry = {
        "characters": {c["slug"]: c for c in old["characters"]},
        "lines": {f"{i['slug']}-{i['n']}": {"jp": i["jp"], "en": i["en"], **({"note": i["note"]} if "note" in i else {})}
                  for i in old["items"] if i["group"] == "line"},
        "compilations": {i["slug"]: i for i in old["items"] if i["group"] == "compilation"},
        "trailer": [i for i in old["items"] if i["group"] == "trailer"],
    }
    CARRY.write_text(json.dumps(carry, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return carry


def parse_voice_md(slug: str) -> list[dict[str, Any]]:
    """Rows of the Japanese voice.md: number, file name, English translation. The file may be in trailer/."""
    folder = common.AUDIO / slug / f"{slug}-japanese"
    rows = []
    for line in (folder / "voice.md").read_text(encoding="utf-8").splitlines():
        if not re.match(r"^\|\s*\d+\s*\|", line):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 3:
            raise SystemExit(f"{slug}: bad row {line!r}")
        n = int(cells[0])
        fname = cells[1].strip("`")
        m = re.match(r"^(\d+)_(.+)\.(flac|mp3)$", fname)
        if not m or int(m.group(1)) != n:
            raise SystemExit(f"{slug} {n}: bad file name {fname!r}")
        src = folder / fname
        if not src.exists():
            src = folder / "trailer" / fname
        if not src.exists():
            raise SystemExit(f"{slug} {n}: missing {fname}")
        rows.append({"n": n, "src": src, "jp": m.group(2), "md_en": re.sub(r"\s*\((cut off)\)\s*$", "", cells[2], flags=re.I)})
    for i, r in enumerate(rows):
        if r["n"] != i + 1:
            raise SystemExit(f"{slug}: Japanese line numbers are not 1..N")
    return rows


def load_language(slug: str, lang: str) -> list[dict[str, Any]]:
    """The lines of one language of one Aspirant, from its manifest: n, text, source file, flags."""
    folder = common.AUDIO / slug / f"{slug}-{FOLDER[lang]}"
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    lines = []
    for c in manifest["clips"]:
        src = folder / c["filename"] if c["filename"] else None
        if src is not None and not src.exists():
            raise SystemExit(f"{slug} {lang} {c['index']}: manifest names a missing file {c['filename']}")
        from_audio = "audio_only" in c.get("flags", []) or "text comes from what the audio says" in c.get("note", "")
        lines.append({"n": c["index"], "text": common.clean_text(c["transcript"]), "src": src, "from_audio": from_audio})
    lines.sort(key=lambda r: r["n"])
    return lines


# ---------------------------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------------------------


def encode_m4a(src: Path, out: Path, bitrate: str = "96k") -> bool:
    """AAC m4a at 44.1 kHz. The channel count is kept. True when it ran."""
    if common.fresh(out, src):
        return False
    tmp = out.with_suffix(".tmp.m4a")
    subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-vn", "-map_metadata", "-1",
         "-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-movflags", "+faststart", str(tmp)],
        check=True,
    )
    tmp.replace(out)
    return True


def copy_unchanged(src: Path, out: Path) -> bool:
    if out.exists() and out.stat().st_size == src.stat().st_size and out.stat().st_mtime >= src.stat().st_mtime:
        return False
    shutil.copyfile(src, out)
    return True


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------


def main() -> None:
    carry = load_carry()
    encode: list[tuple[Path, Path]] = []
    copies: list[tuple[Path, Path]] = []
    report: list[str] = []
    ignored: dict[str, str] = {}

    def rel(p: Path) -> str:
        return p.relative_to(common.SRC).as_posix()

    def ship(src: Path, key: str, ext_original: str | None = None) -> None:
        """Queue the AAC for playing and the original for downloading."""
        encode.append((src, common.key_path(f"{key}.m4a")))
        copies.append((src, common.key_path(f"{key}.{ext_original or src.suffix.lstrip('.').lower()}")))

    characters: list[dict[str, Any]] = []
    files: dict[str, dict[str, Any]] = {}
    search: list[dict[str, Any]] = []
    totals_by_lang = {lang["id"]: {"lines": 0, "seconds": 0.0, "noAudio": 0} for lang in LANGS}

    for slug in common.CHAR_SLUGS:
        card = carry["characters"][slug]
        name = card["name"]
        pair = card["pair"]
        langs: dict[str, list[dict[str, Any]]] = {}

        # --- the seven aligned languages
        counts = {}
        for lang in ALIGNED:
            rows = load_language(slug, lang)
            numbers = [r["n"] for r in rows]
            if numbers != list(range(1, len(rows) + 1)):
                raise SystemExit(f"{slug} {lang}: line numbers are not 1..N ({numbers[:5]}...)")
            counts[lang] = len(rows)
            out_rows = []
            for r in rows:
                n = r["n"]
                nn = f"{n:02d}"
                line: dict[str, Any] = {"n": n, "t": r["text"]}
                if r["src"] is not None:
                    ship(r["src"], f"voicelines/{slug}/{lang}/{nn}", "flac")
                    line["d"] = seconds(r["src"])
                    totals_by_lang[lang]["seconds"] += line["d"]
                else:
                    totals_by_lang[lang]["noAudio"] += 1
                if r["from_audio"]:
                    line["note"] = NOTE_FROM_AUDIO
                out_rows.append(line)
                totals_by_lang[lang]["lines"] += 1
            langs[lang] = out_rows
        if len(set(counts.values())) != 1:
            raise SystemExit(f"{slug}: the seven aligned languages do not have the same number of lines: {counts}")

        # --- Japanese: its own list
        jp_rows = parse_voice_md(slug)
        jp_out = []
        for row in jp_rows:
            n = row["n"]
            nn = f"{n:02d}"
            first = carry["lines"].get(f"{slug}-{n}")
            if first and first["jp"] != row["jp"]:
                raise SystemExit(f"{slug} {n}: the Japanese of a line of the first version changed ({first['jp']} -> {row['jp']})")
            ext = row["src"].suffix.lstrip(".").lower()
            ship(row["src"], f"voicelines/{slug}/{nn}", ext)
            dur = seconds(row["src"])
            line = {"n": n, "t": row["jp"], "tr": common.clean_text(first["en"] if first else row["md_en"]), "d": dur}
            if first and "note" in first:
                line["note"] = first["note"]
            if ext != "flac":
                line["x"] = ext
            jp_out.append(line)
            totals_by_lang["jp"]["lines"] += 1
            totals_by_lang["jp"]["seconds"] += dur
        langs["jp"] = jp_out

        # --- the long compilation and the trailer clips of the Japanese list (carried over, keys unchanged)
        comp = carry["compilations"][slug]
        extras: dict[str, Any] = {"full": {"id": comp["id"], "m4a": comp["m4a"], "d": comp["dur"], "note": comp["note"]}}
        trailer = []
        for t in carry["trailer"]:
            if t["slug"] != slug:
                continue
            trailer.append({"id": t["id"], "n": t["n"], "t": t["jp"], "tr": t["sub"], "who": t["speaker"], "d": t["dur"], "m4a": t["m4a"],
                            "flac": t["flac"], "film": t["film"], "at": t["t"], "note": t["note"]})
        if slug == "selena":
            idx = common.AUDIO / "selena" / "selena-japanese" / "trailer"
            for row in csv.DictReader((idx / "voiceline_index.csv").open(encoding="utf-8-sig")):
                n = int(row["Number"])
                src = idx / row["Filename"]
                if not src.exists():
                    raise SystemExit(f"selena trailer {n}: missing {row['Filename']}")
                ship(src, f"voicelines/selena/trailer/{n:02d}", "flac")
                trailer.append({"id": f"voice-selena-trailer-{n:02d}", "n": n, "t": common.clean_text(row["Japanese transcription (tentative)"]),
                                "tr": canon_words(common.clean_text(row["English translation (tentative)"])), "who": "Selena", "d": seconds(src),
                                "m4a": f"voicelines/selena/trailer/{n:02d}.m4a", "flac": f"voicelines/selena/trailer/{n:02d}.flac",
                                "note": NOTE_TENTATIVE})
            ignored[rel(idx / "voiceline_index.csv")] = "Read into voicelines-selena.json (the tentative text and translation of her trailer clips)."
            ignored[rel(idx / "README.txt")] = "Read for the clip notes, not shipped as a file."
        if trailer:
            extras["trailer"] = trailer

        # --- bookkeeping per character
        ignored[rel(common.AUDIO / slug / f"{slug}-japanese" / "voice.md")] = "Read into the voicelines files (the English translation of each Japanese line), not shipped as a file."
        for lang in ALIGNED:
            folder = common.AUDIO / slug / f"{slug}-{FOLDER[lang]}"
            for extra in ("manifest.json", "manifest.csv", "extracted-text.md", "extracted-text.json"):
                if (folder / extra).exists():
                    ignored[rel(folder / extra)] = "The text of the lines is read from the manifest; the other files are working notes of the cutting."
        characters.append({
            "slug": slug, "name": name, "jp": card["jp"], "romaji": card["romaji"], "aspirant": card["aspirant"], "pair": pair,
            "palette": card["palette"], "splash": card["splash"],
            "lines": {lang["id"]: len(langs[lang["id"]]) for lang in LANGS},
        })
        files[slug] = {"v": 2, "slug": slug, "name": name,
                       "card": {"jp": card["jp"], "romaji": card["romaji"], "aspirant": card["aspirant"], "palette": card["palette"]},
                       "langs": langs, **extras}

        # --- search items (Japanese and English lines, the recordings and the trailer clips)
        for r in jp_out:
            en = r["tr"]
            search.append({"id": f"voice-{slug}-{r['n']:02d}", "title": f"{name}: {en}", "collection": "voicelines", "chars": [slug], "pair": pair,
                           "canon": "official", "tags": ["voice line", "line"], "slug": slug, "n": r["n"], "lang": "jp", "jp": r["t"], "en": en,
                           "group": "line"})
        for r in langs["en"]:
            search.append({"id": f"voice-{slug}-en-{r['n']:02d}", "title": f"{name}: {r['t']}", "collection": "voicelines", "chars": [slug],
                           "pair": pair, "canon": "official", "tags": ["voice line", "line", "english"], "slug": slug, "n": r["n"], "lang": "en",
                           "jp": "", "en": r["t"], "group": "line"})
        search.append({"id": comp["id"], "title": comp["title"], "collection": "voicelines", "chars": [slug], "pair": pair, "canon": "official",
                       "tags": comp["tags"], "slug": slug, "n": 0, "lang": "jp", "jp": "", "en": "", "note": comp["note"], "group": "compilation"})
        for t in trailer:
            search.append({"id": t["id"], "title": f"Trailer clip {t['n']}: {name}", "collection": "voicelines", "chars": [slug], "pair": pair,
                           "canon": "official", "tags": ["voice line", "trailer clip", "trailer"], "slug": slug, "n": t["n"], "lang": "jp",
                           "jp": t["t"], "en": t["tr"], "group": "trailer"})

    # --- sources that are not shipped
    for slug in ("ruby", "angela"):
        folder = common.AUDIO / slug / f"{slug}-japanese"
        for sub in ("trailer", "ruby-trailer", "angela-trailer"):
            d = folder / sub
            if not d.is_dir():
                continue
            for f in sorted(d.iterdir()):
                ignored[rel(f)] = ("The trailer lines of Ruby and Angela are the sixteen clips the room already has (carried over, with their "
                                   "film links). This is a second cut of the same trailer vocals.")
    for slug in ("change", "lesley"):
        d = common.AUDIO / slug / f"{slug}-japanese" / "trailer"
        if d.is_dir():
            for f in sorted(d.iterdir()):
                ignored[rel(f)] = "The same file is row of the Japanese list (voice.md), shipped there as an mp3 under its own number."
    for review in ("voiceline-review.html", "voiceline-review.csv", "voiceline-summary.json"):
        if (common.AUDIO / review).exists():
            ignored[rel(common.AUDIO / review)] = "The review page of the cutting, not part of the site."

    # --- encode and copy, three at a time
    seen: set[Path] = set()
    jobs = [(s, o) for s, o in encode if not (o in seen or seen.add(o))]
    print(f"encoding {len(jobs)} files, copying {len(copies)}")
    with ThreadPoolExecutor(JOBS) as pool:
        ran = sum(pool.map(lambda j: encode_m4a(*j), jobs))
        copied = sum(pool.map(lambda c: copy_unchanged(*c), copies))
    print(f"encoded {ran}, copied {copied} (the rest were fresh)")

    # --- the gain of every clip, so the player can level them
    gain_report = add_gains(files)

    # --- the files
    hero = json.loads(HERO.read_text(encoding="utf-8")) if HERO.exists() else None
    all_seconds = round(sum(t["seconds"] for t in totals_by_lang.values()), 1)
    # `native` and not `name`: build_index.py would take an entry with an id and a name for a searchable item.
    languages = [
        {**{k: v for k, v in lang.items() if k != "name"}, "native": lang["name"], "lines": totals_by_lang[lang["id"]]["lines"], "seconds": round(totals_by_lang[lang["id"]]["seconds"], 1),
         "noAudio": totals_by_lang[lang["id"]]["noAudio"]}
        for lang in LANGS
    ]
    index: dict[str, Any] = {
        "v": 2, "slug": "voicelines",
        "totals": {"lines": sum(t["lines"] for t in totals_by_lang.values()), "languages": len(LANGS), "seconds": all_seconds,
                   "compilations": len(files), "trailer": sum(len(f.get("trailer", [])) for f in files.values())},
        "languages": languages, "characters": characters, "items": search,
    }
    if hero:
        index["hero"] = hero
    common.write_json("voicelines", index)
    for slug, data in files.items():
        common.write_json(f"voicelines-{slug}", data)
    merge_ignored(ignored)

    # --- report
    flac_bytes = sum(p.stat().st_size for p in (common.LIB_ROOT / "voicelines").rglob("*.flac"))
    m4a_bytes = sum(p.stat().st_size for p in (common.LIB_ROOT / "voicelines").rglob("*.m4a"))
    print(f"totals {index['totals']}")
    for lang in languages:
        print(f"  {lang['id']}  {lang['english']:11} {lang['lines']:4} lines  {lang['seconds'] / 60:6.1f} min  no audio: {lang['noAudio']}")
    print(f"mirror voicelines/: flac {common.human(flac_bytes)}, m4a {common.human(m4a_bytes)}")
    print(gain_report)
    for entry in report:
        print("  note:", entry)
    print(f"ignored.json updated with {len(ignored)} entries")


def line_key(slug: str, lang: str, n: int) -> str:
    """The key of the AAC that plays a line (the same rule as `lineStem` in features/library/voicelines/model.ts)."""
    return f"voicelines/{slug}/{n:02d}.m4a" if lang == "jp" else f"voicelines/{slug}/{lang}/{n:02d}.m4a"


def add_gains(files: dict[str, dict[str, Any]]) -> str:
    """Write `g` (dB, one decimal) on every line, trailer clip and recording. See loudness.py for the formula.

    A line or a clip plays through the voice bus (a fixed lift), a recording through the music bus (none), so the
    recording's gain is worked out without the lift.
    """
    jobs: list[tuple[dict[str, Any], str, float]] = []  # (record, key, bus dB)
    for slug, data in files.items():
        for lang, rows in data["langs"].items():
            jobs += [(r, line_key(slug, lang, r["n"]), loudness.BUS_DB) for r in rows if "d" in r]
        jobs.append((data["full"], data["full"]["m4a"], 0.0))
        jobs += [(t, t["m4a"], loudness.BUS_DB) for t in data.get("trailer", [])]
    loud = loudness.ensure(sorted({key for _, key, _ in jobs}))
    after = []
    for record, key, bus in jobs:
        m = loud[key]
        record["g"] = loudness.gain_db(m["i"], m["tp"], bus)
        if bus:
            after.append(m["i"] + record["g"] + bus)
    return (
        f"gain g written on {len(jobs)} records; level after the gain: {min(after):.1f} to {max(after):.1f} LUFS "
        f"over {len(after)} clips (target {loudness.TARGET_LUFS})"
    )


def merge_ignored(entries: dict[str, str]) -> None:
    """Read, update, write at once, so another room's entries are kept."""
    current: dict[str, str] = {}
    if IGNORED.exists():
        current = json.loads(IGNORED.read_text(encoding="utf-8"))
    current.update(entries)
    IGNORED.write_text(json.dumps(dict(sorted(current.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
