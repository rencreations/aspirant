"""The owner's curated voice lines of the home page, resolved from the library data.

    C:/Users/muham/anaconda3/python.exe scripts/home/media/voices.py

The owner's list, character (line number): Fanny 18, Ruby 5, Lesley 2, Guinevere 39, Selena 43 (42 for Japanese),
Layla 7, Angela 23, Chang'e 12, Vexana 41, Obsidia 18. The number is the line's own `n` in the Voicelines data
(`public/data/library/voicelines-<slug>.json`). For each Aspirant there is one line in each of the eight languages,
in the order of the home page: Japanese first, then English, then Indonesian, Arabic, Spanish, Portuguese, Turkish,
Russian. Nothing is written here: the text, the duration, the gain `g` and the key come from the library data, and
the script checks that every one of the 80 clips exists in the mirror.

Writes   apps/web/public/data/home/voices.json

A line:   { n, lang, dir, t, tr?, trLang?, d, g, key, url?, note? }
            n       the line's own number in its language's list
            t       the text, in its own language (lang and dir say which, Arabic reads right to left)
            tr      a translation when the data has one: Japanese lines carry the English that came with them;
                    for the seven languages that share one list, the English line of the same number
            d       seconds
            g       the gain in dB that levels the clip to the others (`audio.playVoice(url, { gainDb: g })`)
            key     the library key of the AAC that plays (`libUrl(key)`)
          Guinevere's English, Spanish and Portuguese lines hold a stage direction in brackets, for example
          "(Chuckles)": style it or leave it out, it is in the data.
"""

from __future__ import annotations

from typing import Any

import hcommon as h

# The owner's order and numbers.
WANTED: list[tuple[str, int]] = [
    ("fanny", 18), ("ruby", 5), ("lesley", 2), ("guinevere", 39), ("selena", 43),
    ("layla", 7), ("angela", 23), ("change", 12), ("vexana", 41), ("obsidia", 18),
]
JAPANESE_EXCEPTION = {"selena": 42}  # the Japanese list of Selena is one shorter
LANGS = ["jp", "en", "id", "ar", "es", "pt", "tr", "ru"]  # Japanese first, English second, then the rest
ALIGNED = [lang for lang in LANGS if lang != "jp"]


def line_key(slug: str, lang: str, n: int) -> str:
    return f"voicelines/{slug}/{n:02d}.m4a" if lang == "jp" else f"voicelines/{slug}/{lang}/{n:02d}.m4a"


def main() -> None:
    index = h.library_data("voicelines")
    langs_info = {lang["id"]: lang for lang in index["languages"]}
    characters_info = {c["slug"]: c for c in index["characters"]}
    out_chars = []
    for slug, number in WANTED:
        data = h.library_data(f"voicelines-{slug}")
        info = characters_info[slug]
        lines: dict[str, Any] = {}
        for lang in LANGS:
            n = JAPANESE_EXCEPTION.get(slug, number) if lang == "jp" else number
            found = next((line for line in data["langs"][lang] if line["n"] == n), None)
            if found is None or "d" not in found or "g" not in found:
                raise SystemExit(f"{slug} {lang} {n}: no recording, or no gain (run scripts/library/voicelines/build.py)")
            key = line_key(slug, lang, n)
            if not (h.MIRROR / key).exists():
                raise SystemExit(f"{slug} {lang} {n}: {key} is not in the mirror")
            li = langs_info[lang]
            rec: dict[str, Any] = {"n": n, "lang": li["html"], "dir": li["dir"], "t": found["t"], "d": found["d"], "g": found["g"], "key": key}
            if lang == "jp":
                if found.get("tr"):
                    rec["tr"], rec["trLang"] = found["tr"], "en"
            else:
                en = next(line for line in data["langs"]["en"] if line["n"] == n)
                if lang != "en":
                    rec["tr"], rec["trLang"] = en["t"], "en"
            if found.get("note"):
                rec["note"] = found["note"]
            lines[lang] = rec
        splash = h.PUBLIC / info["splash"]
        cutout = h.PUBLIC / "img" / "char" / slug / "cutout.webp"
        out_chars.append({
            "slug": slug, "name": info["name"], "jp": info["jp"], "romaji": info["romaji"], "aspirant": info["aspirant"], "pair": info["pair"],
            "palette": info["palette"],
            "splash": "/" + info["splash"] if splash.exists() else None,
            "cutout": f"/img/char/{slug}/cutout.webp" if cutout.exists() else None,
            "line": number, "lineJp": JAPANESE_EXCEPTION.get(slug, number),
            "page": f"/collection/voicelines/{slug}", "lines": lines,
        })
    languages = [{"id": lid, "html": langs_info[lid]["html"], "dir": langs_info[lid]["dir"], "native": langs_info[lid]["native"],
                  "english": langs_info[lid]["english"], "flag": langs_info[lid]["flag"]} for lid in LANGS]
    obj = {"v": 1, "all": "/collection/voicelines", "languages": languages, "characters": out_chars}
    h.write_json("voices", obj)
    n_clips = sum(len(c["lines"]) for c in out_chars)
    gains = [r["g"] for c in out_chars for r in c["lines"].values()]
    print(f"{len(out_chars)} Aspirants, {n_clips} clips, all present in the mirror; g from {min(gains)} to {max(gains)} dB")
    for c in out_chars:
        print(f"  {c['name']:10} {c['line']:>2}  jp {c['lines']['jp']['n']:>2}  {c['lines']['en']['t'][:70]}")


if __name__ == "__main__":
    main()
