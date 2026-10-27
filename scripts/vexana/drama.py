"""
Builds the interactive drama of Vexana's page: downloads the 21 episode videos, studies them,
encodes them for the web and writes the data the game reads.

Origin: the official "Become The Aspirants | Interactive Drama" videos of Mobile Legends: Bang
Bang (the Aspirants campaign), as listed in C:/Users/muham/Downloads/aspirant.md. The owner asked
for them to be hosted on the fan site. SOURCES below is the full list of where every file comes from.

Steps (each is idempotent, cached in WORK, and skips what already exists unless --force):

  download   yt-dlp: the best H.264 + AAC mp4, the info json and the thumbnail of every episode.
  analyse    frame hashes (finds duplicate episodes), dialogue marks, the time the choices appear.
             Results are cached in WORK/analysis.json (so the encode and the manifest never redo it).
  encode     H.264 + AAC for the web into apps/web/public/video/vexana/drama/<file>.mp4, with a
             poster and a small thumbnail (webp). Duplicate episodes share one file.
  manifest   writes apps/web/src/features/character/vexana/drama/drama.generated.ts (sizes,
             lengths, dialogue marks, the choice time) and the readable decision tree in
             docs/superpowers/specs/2026-10-27-interactive-drama-graph.md.

Run (the analysis needs numpy and Pillow: the anaconda python has them):
  C:/Users/muham/anaconda3/python.exe scripts/vexana/drama.py download
  C:/Users/muham/anaconda3/python.exe scripts/vexana/drama.py analyse
  C:/Users/muham/anaconda3/python.exe scripts/vexana/drama.py encode [--only 4A1,5B] [--force]
  C:/Users/muham/anaconda3/python.exe scripts/vexana/drama.py manifest

The curated story (titles, summaries, choice labels, what leads where) is written by hand in
apps/web/src/features/character/vexana/drama/drama-graph.ts; this script never overwrites it.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Downloads and analysis caches (large): set DRAMA_WORK to a folder with room for about 2 GB.
WORK = Path(os.environ.get("DRAMA_WORK", str(Path(tempfile.gettempdir()) / "aspirants-drama")))
OUT = ROOT / "apps/web/public/video/vexana/drama"
WEB = ROOT / "apps/web/src/features/character/vexana/drama"

# code -> YouTube id. The code is the owner's: the chapter number, then the branch letter, then the
# variant number ("1" is the first episode).
SOURCES: dict[str, str] = {
    "1": "gcxvhUBtPdo",
    "2A": "P8nZiJ4Rthc",
    "2B": "Jz6qM0a0TkY",
    "3A1": "IOskQELHGyM",
    "3A2": "5zEFdHsXoWE",
    "3B1": "fjSm_OWUUl0",
    "3B2": "lmyVUxymxwQ",
    "4A1": "lkya-sAe65s",
    "4A2": "SLbnW1G2jx8",
    "4B1": "b1OlxJsaNes",
    "4B2": "zz3tK6Fke34",
    "5A": "GvrVMQq1GC4",
    "5B": "L1wXa9dlHow",
    "5C": "iV1qKDhlrDQ",
    "6A1": "COsRkCJls0w",
    "6A2": "tBVrrFK31xI",
    "6B1": "GeK_uEQhdIg",
    "6B2": "xZez3eszP4w",
    "6C1": "TgA_BHpTDOA",
    "6C2": "KnIdG-_OBOs",
    "6C3": "KmMQ1XlMyY0",
}

# The tree of the owner's file: code -> the two codes its two choices lead to, in the order listed.
EDGES: dict[str, list[str]] = {
    "1": ["2A", "2B"],
    "2A": ["3A1", "3B1"],
    "2B": ["3A2", "3B2"],
    "3A1": ["4A1", "4B1"],
    "3B1": ["4A2", "4B2"],
    "3A2": ["4A1", "4B1"],
    "3B2": ["4A2", "4B2"],
    "4A1": ["5A", "5C"],
    "4A2": ["5A", "5C"],
    "4B1": ["6C1", "5B"],
    "4B2": ["6C1", "5B"],
    "5A": ["6A1", "6B1"],
    "5B": ["6A2", "6C2"],
    "5C": ["6B2", "6C3"],
}

CODES = list(SOURCES)


def url(code: str) -> str:
    return f"https://www.youtube.com/watch?v={SOURCES[code]}"


def run(args: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, **kw)


def download(force: bool = False) -> None:
    """Downloads what is missing, politely (a pause between requests, spaced retries). YouTube may
    ask a client to sign in ("confirm you are not a bot") after a burst of requests: this script does
    not read any browser cookies; if a download keeps failing it is listed at the end and can be
    re-run later (it skips what exists)."""
    import time

    raw = WORK / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    failed: list[str] = []
    for code in CODES:
        vid = SOURCES[code]
        mp4 = raw / f"{code}.mp4"
        if mp4.exists() and not force:
            continue
        for attempt in range(3):
            print(f"download {code} ({vid}) try {attempt + 1}", flush=True)
            r = subprocess.run(
                [
                    "yt-dlp",
                    "--no-warnings",
                    "--sleep-requests",
                    "2",
                    "--sleep-interval",
                    "6",
                    "--max-sleep-interval",
                    "15",
                    "-f",
                    "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*+ba/b",
                    "--merge-output-format",
                    "mp4",
                    "--write-info-json",
                    "--write-thumbnail",
                    "--convert-thumbnails",
                    "jpg",
                    "-o",
                    str(raw / f"{code}.%(ext)s"),
                    url(code),
                ]
            )
            if r.returncode == 0 and mp4.exists():
                break
            time.sleep(90 * (attempt + 1))
        else:
            failed.append(code)
    if failed:
        print("NOT DOWNLOADED:", ", ".join(failed), flush=True)


# ---------------------------------------------------------------------------------------------
# analysis
# ---------------------------------------------------------------------------------------------

# The dialogue box of every episode is a dark band along the bottom of the 1920x1080 picture, with
# bold white text in it. The text region is cut out and watched at 10 frames a second.
TEXT_CROP = (1800, 170, 60, 870)  # width, height, x, y
TEXT_SCALE = (450, 42)
TEXT_FPS = 10
WHITE = 200  # a pixel above this is text
PRESENT = 40  # at least this many text pixels (of 450x42) means a line is on screen


def raw_frames(path: Path, vf: str, w: int, h: int, pix: str = "gray"):
    """Decodes a video through a filter into an array of frames: (n, h, w) for grey, (n, h, w, 3) for rgb24."""
    import numpy as np

    ch = 3 if pix == "rgb24" else 1
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-an", "-vf", vf + f",format={pix}", "-f", "rawvideo", "-"],
        check=True,
        stdout=subprocess.PIPE,
    )
    a = np.frombuffer(p.stdout, dtype=np.uint8)
    size = w * h * ch
    a = a[: (len(a) // size) * size]
    return a.reshape(-1, h, w, 3) if ch == 3 else a.reshape(-1, h, w)


def text_track(path: Path):
    cw, ch, cx, cy = TEXT_CROP
    tw, th = TEXT_SCALE
    return raw_frames(
        path, f"fps={TEXT_FPS},crop={cw}:{ch}:{cx}:{cy},scale={tw}:{th}:flags=area", tw, th, "rgb24"
    )


def tag_track(path: Path):
    """Per frame (10 a second): how many cyan pixels the name tag of the dialogue box has. A box on
    screen has about 150 (the slash at the left of the tag); a picture without a box has none, and a
    big cyan scene has far more."""
    import numpy as np

    fr = raw_frames(path, f"fps={TEXT_FPS},crop=300:100:0:712,scale=75:25:flags=area", 75, 25, "rgb24").astype(np.int16)
    r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
    return ((b > 170) & (r < 110) & (g > 90) & (g < 235) & (b - r > 90)).sum(axis=(1, 2))


def find_marks(frames, tag) -> tuple[list[float], list[tuple[float, float]]]:
    """Returns (marks, segments): the times a new line of dialogue is on screen, and the stretches
    (start, end) in seconds where the dialogue box shows text.

    The box is a dark band (most of the cut-out is dark) with white text and a name tag with a cyan slash. Without the band the
    picture is just a picture (bright walls look like text): that is not dialogue. A line starts
    when text appears in the band after none, or when the text on screen is replaced by other text
    (the overlap with what was there is under half). Text that types itself out only grows, so it
    stays one line. Marks closer than 1 s are one, and a line shorter than 0.6 s is not one."""
    import numpy as np

    # Subtitles are neutral white. The cyan lines of a map or a bright wall are not.
    lo = frames.min(axis=3)
    hi = frames.max(axis=3)
    white = (lo > 215) & ((hi.astype(np.int16) - lo) < 30)
    area = white.sum(axis=(1, 2))
    dark = (frames.mean(axis=3) < 120).mean(axis=(1, 2))
    n_tag = min(len(tag), len(area))
    tag_on = np.zeros(len(area), dtype=bool)
    tag_on[:n_tag] = (tag[:n_tag] >= 60) & (tag[:n_tag] <= 300)
    present = (dark >= 0.6) & (area >= PRESENT) & tag_on
    marks: list[float] = []
    segments: list[tuple[float, float]] = []
    ref = None
    ref_area = 0
    start = None
    bad = 0
    n = len(area)
    for i in range(n):
        t = i / TEXT_FPS
        if present[i]:
            if start is None:
                start = t
                marks.append(round(t, 2))
                ref, ref_area, bad = white[i], int(area[i]), 0
                continue
            inter = int(np.logical_and(ref, white[i]).sum())
            keep = inter / max(1, min(ref_area, int(area[i])))
            if keep < 0.5:
                bad += 1
                if bad >= 2:
                    marks.append(round(t - 1 / TEXT_FPS, 2))
                    ref, ref_area, bad = white[i], int(area[i]), 0
            else:
                bad = 0
                if area[i] >= ref_area:
                    ref, ref_area = white[i], int(area[i])
        elif start is not None:
            segments.append((round(start, 2), round(t, 2)))
            start = None
    if start is not None:
        segments.append((round(start, 2), round(n / TEXT_FPS, 2)))
    # A line stays on screen for a while: a flash of a few frames is not dialogue.
    segments = [(a_, b_) for (a_, b_) in segments if b_ - a_ >= 0.6]
    keep = [m for m in marks if any(a_ - 0.01 <= m <= b_ for (a_, b_) in segments)]
    merged: list[float] = []
    for m in keep:
        if not merged or m - merged[-1] >= 1.0:
            merged.append(m)
    return merged, segments


def dhashes(path: Path):
    """One 64 bit difference hash per second of picture (as an array of bits)."""
    import numpy as np

    fr = raw_frames(path, "fps=1,scale=9:8:flags=area", 9, 8).astype(np.int16)
    return (fr[:, :, 1:] > fr[:, :, :-1]).reshape(len(fr), -1)


def audio_md5(path: Path) -> str:
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-f", "md5", "-"],
        check=True,
        stdout=subprocess.PIPE,
        text=True,
    )
    return p.stdout.strip()


def probe(path: Path) -> dict:
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(path)],
        check=True,
        stdout=subprocess.PIPE,
        text=True,
    )
    return json.loads(p.stdout)


def analyse(force: bool = False) -> None:
    import numpy as np

    out = WORK / "analysis.json"
    data: dict = json.loads(out.read_text()) if out.exists() and not force else {}
    raw = WORK / "raw"
    for code in CODES:
        mp4 = raw / f"{code}.mp4"
        if not mp4.exists() or code in data:
            continue
        print(f"analyse {code}", flush=True)
        info = probe(mp4)
        dur = float(info["format"]["duration"])
        marks, segments = find_marks(text_track(mp4), tag_track(mp4))
        data[code] = {
            "duration": round(dur, 3),
            "size": int(info["format"]["size"]),
            "marks": marks,
            "segments": segments,
            "audio": audio_md5(mp4),
        }
        np.save(WORK / f"hash-{code}.npy", dhashes(mp4))
    # Duplicates: the same length and nearly the same picture all the way through.
    codes = [c for c in CODES if c in data]
    same: dict[str, dict] = {}
    for i, a in enumerate(codes):
        for b in codes[i + 1 :]:
            if abs(data[a]["duration"] - data[b]["duration"]) > 0.15:
                continue
            ha, hb = np.load(WORK / f"hash-{a}.npy"), np.load(WORK / f"hash-{b}.npy")
            n = min(len(ha), len(hb))
            d = (ha[:n] != hb[:n]).sum(axis=1)
            same[f"{a}~{b}"] = {
                "mean_bits": round(float(d.mean()), 2),
                "max_bits": int(d.max()),
                "frames_over_6": int((d > 6).sum()),
                "audio_same": data[a]["audio"] == data[b]["audio"],
            }
    data["_pairs"] = same
    out.write_text(json.dumps(data, indent=1))
    print(f"wrote {out}")


# The episodes that are the same picture under two or three YouTube ids (found by `analyse`): one
# file is encoded for each, named after the first code of the group.
CANON: dict[str, str] = {
    "3A2": "3A1",
    "3B2": "3B1",
    "4A2": "4A1",
    "4B2": "4B1",
    "6A2": "6A1",
    "6B2": "6B1",
    "6C2": "6C1",
    "6C3": "6C1",
}
# The node id of each file: the code without the variant number ("3A1" is node "3A").
NODE: dict[str, str] = {c: (c[:2] if len(c) == 3 and c[0] != "1" else c) for c in CODES}


def canonical() -> list[str]:
    return [c for c in CODES if c not in CANON]


def transcript(force: bool = False) -> None:
    """Reads every line of dialogue with the Windows OCR engine: for each mark, one frame taken just
    before the next line starts (the text has finished typing), cropped to the text and to the name
    tag. Writes WORK/lines.json: code -> [{t, who, text}]."""
    ana = json.loads((WORK / "analysis.json").read_text())
    out = WORK / "lines.json"
    if out.exists() and not force:
        print("lines.json exists")
        return
    shots = WORK / "ocr"
    if shots.exists():
        import shutil

        shutil.rmtree(shots)
    shots.mkdir(parents=True)
    plan: dict[str, list[float]] = {}
    for code in canonical():
        a = ana[code]
        segs = a["segments"]
        times = []
        for i, m in enumerate(a["marks"]):
            seg_end = next((e for (s_, e) in segs if s_ <= m + 0.05 < e + 0.05), a["duration"])
            nxt = a["marks"][i + 1] if i + 1 < len(a["marks"]) else seg_end
            end = min(nxt, seg_end)
            times.append(round(max(m + 0.1, end - 0.3), 2))
        plan[code] = times
        for i, t in enumerate(times):
            base = shots / f"{code}-{i:02d}"
            # The text, and the tag with the name of who speaks.
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(WORK / "raw" / f"{code}.mp4"), "-frames:v", "1", "-vf", "crop=1800:190:60:850", f"{base}-text.png"])
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(WORK / "raw" / f"{code}.mp4"), "-frames:v", "1", "-vf", "crop=520:90:0:712,scale=1040:180", f"{base}-who.png"])
    run(["powershell", "-NoProfile", "-File", str(ROOT / "scripts/vexana/ocr.ps1"), str(shots), str(WORK / "ocr.json")])
    raw = json.loads((WORK / "ocr.json").read_text(encoding="utf-8-sig"))
    lines: dict[str, list[dict]] = {}
    for code, times in plan.items():
        rows = []
        for i, t in enumerate(times):
            text = raw.get(f"{code}-{i:02d}-text.png", "").replace(" | ", " ").strip()
            who = raw.get(f"{code}-{i:02d}-who.png", "").replace(" | ", " ").strip()
            rows.append({"t": ana[code]["marks"][i], "at": t, "who": who, "text": text})
        lines[code] = rows
    out.write_text(json.dumps(lines, indent=1, ensure_ascii=False), encoding="utf8")
    print(f"wrote {out}")


# ---------------------------------------------------------------------------------------------
# the dialogue, as read from the videos
# ---------------------------------------------------------------------------------------------

# One entry per mark of each film, in order: (who, text). The times come from the analysis (the
# moment the line appears on screen); the words were read by the Windows OCR engine (`transcript`)
# and corrected by eye against the frames, so a misread letter or a dash that did not survive is
# fixed. Dashes of the original are written as a comma or a colon (the site has no long dashes).
# `check` fails when the number of lines is not the number of marks found in a film.
LINES: dict[str, list[tuple[str, str]]] = {
    "1": [
        ("???", "You traveled through time and space, arriving at the Selrick Academy, where everything is filled with mystery..."),
        ("Me", "Did I travel through time? Coming here... is it to become The Aspirants?"),
        ("Narrator", "Selrick Academy's ace duo: Guinevere and Vexana!"),
        ("Narrator", "Their undefeated record has made them legends even among the Aspirants!"),
        ("Me", "The badge in her hand is so peculiar."),
        ("Me", "I feel a surge of anxiety."),
        ("Me", "I feel like someone's watching this place."),
        ("Me", "Is that... the rooftop?!"),
    ],
    "2A": [
        ("Guinevere", "What are you looking at?! This is... a tactical beacon! It's the latest anti-Ender tech!"),
        ("Me", "But why haven't I seen it in the equipment manual?"),
        ("Guinevere", "...Actually, these are our Emblems of Hope. Vexana and I... we made them together."),
        ("Guinevere", "These emblems are proof of our bond. As long as our hearts are connected, they will resonate, always."),
        ("Vexana", "Always."),
    ],
    "2B": [
        ("Angela", "Ruby, the energy readings here are still unstable. The repair process is going slowly."),
        ("Guinevere", "It's flashing... could it be Vexana?"),
        ("Ruby", "Based on the energy waveform, it's likely an Ender. The energy fluctuation from the chest area... is exceptionally powerful. I think it's trying to lure us in."),
    ],
    "3A": [
        ("Guinevere", "This is where Vexana and I met."),
        ("Guinevere", "Due to my family's reputation, everyone was scared to approach me. I thought I would never find a partner."),
        ("Vexana", "You're strong. You need a strong partner."),
        ("Guinevere", "This emblem lights up whenever our powers resonate. I know she's still waiting for me out there."),
    ],
    "3B": [
        ("Student", "Detecting an abnormal signal from the Singularity: energy fluctuations are highly unstable. It could be an Ender invasion."),
        ("Student", "Wonder what the Aspirants plan to do..."),
        ("Guinevere", "The emblem... it's flashing. It's Vexana... she must be at the Singularity. I have to go find her."),
        ("Guinevere", "I don't know what we'll encounter, you should stay here."),
    ],
    "4A": [
        ("Guinevere", "You want to be my temporary partner? Then prove you have what it takes!"),
        ("Me", "Then I'll work hard to become the perfect partner!"),
        ("Guinevere", "The best partners..."),
        ("", "True partners don't just think alike: they complete each other."),
        ("Guinevere", "That's why we're the best partners!"),
        ("Layla", "Hmph, I guess you pass. But your aim is still no match for mine!"),
        ("Guinevere", "I acknowledge your strength, but you're not ready for real combat. I won't lose another partner."),
    ],
    "4B": [
        ("Guinevere", "I'm prepared to enter the Singularity."),
        ("Angela", "According to the readings, the Singularity's energy signature is spiking rapidly. The Enders are mobilizing. What is our course of action?"),
        ("Fanny", "So many hostiles, she must be in danger!"),
        ("Layla", "I've already identified several weak points in their defenses. This rescue operation is ready to go!"),
    ],
    "5A": [
        ("Guinevere", "I never told anyone this... but Vexana and I... we had an argument the day she vanished."),
        ("Vexana", "I have glimpsed the future. We are doomed to fail."),
        ("Guinevere", "You're wrong! As long as we have hope, we can make our own future!"),
        ("Vexana", "Perhaps... you should find a partner who still believes in hope."),
        ("Guinevere", "I thought she was afraid... but now I understand: she was only trying to protect me."),
        ("Guinevere", "I have to find her."),
    ],
    "5B": [
        ("Me", "Too many enemies! Retreat now!"),
        ("Guinevere", "I'm putting it all on the line, Vexana."),
        ("Guinevere", "No matter what happens, I want Vexana to know that I never stopped believing in her. Hey, newbie, I'm entrusting the academy to you."),
    ],
    "5C": [
        ("Guinevere", "Newbie, we're heading into a real battle. Stay alert."),
        ("Guinevere", "Ender! Watch out!"),
        ("Vexana", "Hold on to me!"),
        ("Guinevere", "You're the one who needs my protection!"),
    ],
    "6A": [
        ("Vexana", "I've glimpsed the end that awaits us. There is no other choice..."),
        ("Guinevere", "That should be our choice! Don't forget, we're partners!"),
        ("Me", "Watch out!"),
        ("Guinevere", "Witness our moment!"),
    ],
    "6B": [
        ("Vexana", "I've seen the end that awaits us. There is no other choice..."),
        ("Guinevere", "Vexana! If you think I'm going to let you sacrifice yourself for some greater good, think again!"),
        ("Me", "They're out of sight! I've got to go after them!"),
        ("Vexana", "I saw it... everyone... dead. Only I can stop it..."),
        ("Guinevere", "No! There must be another way! We will fight for a new future, together!"),
        ("Me", "Such powerful energy!"),
        ("Me", "The Control Core seems to be scoured by energy!"),
        ("Me", "Singularity... disappeared?!"),
        ("Guinevere", "See, Vexana? This is our future."),
    ],
    "6C": [
        ("Layla", "I've locked on to the enemies!"),
        ("Ruby", "We escaped from this cage, we can also destroy it!"),
        ("Angela", "Go, Guinevere, pursue your light."),
        ("Vexana", "I've seen the end that awaits us. There is no other choice..."),
        ("Guinevere", "Vexana, if you think I'm going to let you sacrifice yourself for some greater good, think again!"),
        ("Guinevere", "Aspirants! Today, our light shall pierce the Singularity!"),
        ("Vexana", "Hope never dies!"),
        ("Everyone", "The Aspirants always stand united!"),
    ],
}
ENDINGS = {"6A", "6B", "6C"}
# A line stays on screen at least this long before the choices are drawn over it.
CHOICE_AFTER_LAST_LINE = 1.5


def file_of(node: str) -> str:
    return node.lower()


def canonical_nodes() -> list[tuple[str, str]]:
    """(node id, the code the film is encoded from) for the 13 different films."""
    return [(NODE[c], c) for c in canonical()]


def check_lines() -> None:
    ana = json.loads((WORK / "analysis.json").read_text())
    for node, code in canonical_nodes():
        marks = ana[code]["marks"]
        if len(marks) != len(LINES[node]):
            raise SystemExit(f"{node}: {len(marks)} marks but {len(LINES[node])} lines")
    print("lines match the marks")


# ---------------------------------------------------------------------------------------------
# encode
# ---------------------------------------------------------------------------------------------

CRF = 25  # close to the YouTube picture: about 78 percent of its size. 1080p, the source frame rate.
# A keyframe every 4 seconds at most. A jump to the next line (a seek) decodes from the one before
# it: 4 seconds of mostly still picture is quick. A keyframe a second made the films 20 percent bigger.
GOP = 120


def choice_at(node: str, code: str, ana: dict) -> float | None:
    if node in ENDINGS:
        return None
    a = ana[code]
    last_end = a["segments"][-1][1] if a["segments"] else a["marks"][-1]
    return round(max(last_end, a["marks"][-1] + CHOICE_AFTER_LAST_LINE), 1)


def poster_time(node: str, code: str, ana: dict) -> float:
    dur = ana[code]["duration"]
    if node in ENDINGS:
        return round(dur - 1.0, 2)
    return round(min(dur - 0.6, (choice_at(node, code, ana) or 0) + 1.0), 2)


def encode(only: set[str] | None, force: bool) -> None:
    ana = json.loads((WORK / "analysis.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for node, code in canonical_nodes():
        if only and node not in only:
            continue
        name = file_of(node)
        mp4 = OUT / f"{name}.mp4"
        src = WORK / "raw" / f"{code}.mp4"
        if not mp4.exists() or force:
            print(f"encode {node} from {code}", flush=True)
            run(
                [
                    "ffmpeg", "-v", "error", "-y", "-i", str(src),
                    "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
                    "-preset", "slow", "-tune", "animation", "-crf", str(CRF),
                    "-g", str(GOP), "-keyint_min", "24",
                    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
                    "-movflags", "+faststart", str(mp4),
                ]
            )
        t = poster_time(node, code, ana)
        for suffix, width, q in (("poster", 1280, 82), ("thumb", 480, 80)):
            out = OUT / f"{name}-{suffix}.webp"
            if out.exists() and not force:
                continue
            run(
                [
                    "ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1",
                    "-vf", f"scale={width}:-2:flags=lanczos", "-c:v", "libwebp", "-quality", str(q), str(out),
                ]
            )
    # The official thumbnail of every id: the card of the answer that leads to it.
    if not only:
        for code in CODES:
            out = OUT / f"yt-{code}.webp"
            jpg = WORK / "raw" / f"{code}.jpg"
            if jpg.exists() and (not out.exists() or force):
                run(
                    [
                        "ffmpeg", "-v", "error", "-y", "-i", str(jpg), "-vf", "scale=640:-2:flags=lanczos",
                        "-c:v", "libwebp", "-quality", "80", str(out),
                    ]
                )


# ---------------------------------------------------------------------------------------------
# manifest
# ---------------------------------------------------------------------------------------------


def manifest() -> None:
    check_lines()
    ana = json.loads((WORK / "analysis.json").read_text())
    names = [file_of(n) for n, _ in canonical_nodes()]
    files: dict[str, dict] = {}
    total = 0
    for node, code in canonical_nodes():
        name = file_of(node)
        mp4 = OUT / f"{name}.mp4"
        if not mp4.exists():
            raise SystemExit(f"{mp4} is missing: run the encode step first")
        info = probe(mp4)
        v = next(s for s in info["streams"] if s.get("codec_type") == "video")
        num, den = v["r_frame_rate"].split("/")
        a = ana[code]
        starts = a["marks"]
        size = int(info["format"]["size"])
        total += size
        files[name] = {
            "node": node,
            "code": code,
            "duration": round(float(info["format"]["duration"]), 2),
            "bytes": size,
            "width": int(v["width"]),
            "height": int(v["height"]),
            "fps": round(int(num) / int(den), 2),
            "marks": [0.0] + [m for m in starts if m > 0.05],
            "choiceAt": choice_at(node, code, ana),
            "lines": [{"t": starts[i], "who": who, "text": text} for i, (who, text) in enumerate(LINES[node])],
        }
    head = [
        "// Generated by scripts/vexana/drama.py (`manifest`). Do not edit.",
        "",
        "export type DramaFileName =",
        "\n".join(f'  | "{n}"' for n in names) + ";",
        "",
        "export interface DramaLine {",
        "  /** When the line appears on screen, in seconds. */",
        "  t: number;",
        '  /** Who speaks: a name, "Me" for the player, or an empty string for a line with no name tag. */',
        "  who: string;",
        "  text: string;",
        "}",
        "",
        "export interface DramaFileInfo {",
        "  /** The id of the episode this film is (see drama-graph.ts). */",
        "  node: string;",
        "  /** The official id the film was encoded from. */",
        "  code: string;",
        "  duration: number;",
        "  bytes: number;",
        "  width: number;",
        "  height: number;",
        "  fps: number;",
        "  /**",
        "   * The times a line of dialogue is fully on screen, in seconds, the first being 0 (the start of the film). A line fades in over about 0.4 s",
        "   * and a mark is the end of that fade, so a skip to the next mark shows a line that can be read at once: it goes to the first mark",
        "   * after the current time.",
        "   */",
        "  marks: readonly number[];",
        "  /** From this time the last line is gone and the picture holds: the choices go over it. Null for an ending. */",
        "  choiceAt: number | null;",
        "  /** What is said, for the log. One line for each start time found: lines[i].t is marks[i + 1] (marks[0] is the start of the film). */",
        "  lines: readonly DramaLine[];",
        "}",
        "",
    ]
    body = [
        "export const DRAMA_FILES: Record<DramaFileName, DramaFileInfo> = "
        + json.dumps(files, indent=2, ensure_ascii=False)
        + ";",
    ]
    out = WEB / "drama.generated.ts"
    out.write_text("\n".join(head + body) + "\n", encoding="utf8")
    subprocess.run(["npx", "prettier", "--write", str(out)], cwd=str(ROOT), shell=True, check=True)
    print(f"wrote {out} ({total / 1048576:.1f} MB of video)")


def doc() -> None:
    """Writes the readable decision tree (Node 22 or later strips the types of the graph file)."""
    run(["node", str(ROOT / "scripts/vexana/drama-doc.mjs")], cwd=str(ROOT))


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    steps = [a for i, a in enumerate(args) if not a.startswith("--") and not (i > 0 and args[i - 1] == "--only")]
    if not steps:
        print(__doc__)
        return
    for step in steps:
        if step == "download":
            download(force)
        elif step == "analyse":
            analyse(force)
        elif step == "transcript":
            transcript(force)
        elif step == "encode":
            only = None
            if "--only" in args:
                only = set(args[args.index("--only") + 1].split(","))
            encode(only, force)
        elif step == "manifest":
            manifest()
        elif step == "doc":
            doc()
        elif step == "check":
            check_lines()
        else:
            raise SystemExit(f"unknown or not yet implemented step: {step}")


if __name__ == "__main__":
    main()
