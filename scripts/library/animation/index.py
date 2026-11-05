"""
Writes the data of the Animation room.

  apps/web/public/data/library/animation.json
      The ten characters (palette, caption, face crop), and one item for every clip of the room: the
      welcome, the idle loop, the zoom pose(s) and the short clips, with labels, one line of text, the
      length in seconds and the recording each was cut from.
  apps/web/src/features/library/animation/stage-loaders.generated.ts
      One lazy import for every `stage-data/<slug>.generated.ts` that exists. A character lights up on
      the page as soon as its file is in the folder and this script has run again.

The stage data of Layla, Fanny, Ruby, Angela, Lesley and Chang'e is written by `stage.py` in this
folder (a separate step). Selena, Obsidia, Vexana and Guinevere play from the site's own files.

Run: C:/Users/muham/anaconda3/python.exe scripts/library/animation/index.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import common  # noqa: E402

ROOM = common.REPO / "apps" / "web" / "src" / "features" / "library" / "animation"
STAGE_DATA = ROOM / "stage-data"
CONTENT = common.REPO / "apps" / "web" / "src" / "content" / "characters"
SITE_VIDEO = common.PUBLIC / "video"
SRC_DIR = "media/_others/in-game-animation"

# The six that get their stage from the stage builder, and the four that play from the site's files.
# `dir` is where the videos are (a folder of `<tier>/<name>.mp4`).
SITE_DIRS = {
    "selena": SITE_VIDEO / "selena",
    "obsidia": SITE_VIDEO / "obsidia",
    "vexana": SITE_VIDEO / "vexana-stage",
    "guinevere": SITE_VIDEO / "guinevere-stage",
}


def mirror_dir(slug: str) -> Path:
    return common.LIB_ROOT / "animation" / slug


# Which engine scene each button plays, and what to call it. The recording is the file the clip was
# cut from (`<slug>/<name>.mkv`). Words are plain and say what is on the screen.
#   short: (scene, recording name, label, one line)
#   pose:  (scene, recording name, label, one line)
CHARS: list[dict] = [
    dict(
        slug="fanny", name="Fanny", pair="fanny-layla", order=1,
        face=(54, 28, 1.9), focus=48,
        caption="This is Fanny's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her blade, her face and her waist.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "blade", "Blade", "A short clip that follows her blade."),
            ("short-2", "face", "Face", "A short clip that moves in on her face."),
            ("short-3", "stomach", "Waist", "A short clip that moves in on her waist."),
        ],
    ),
    dict(
        slug="layla", name="Layla", pair="fanny-layla", order=2,
        face=(36, 40, 1.9), focus=60,
        caption="This is Layla's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her face, her feet and her hand.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "face", "Face", "A short clip that moves in on her face."),
            ("short-2", "foot", "Feet", "A short clip that looks down at her feet."),
            ("short-3", "hand", "Hand", "A short clip that follows her hand."),
        ],
    ),
    dict(
        slug="ruby", name="Ruby", pair="ruby-angela", order=3,
        face=(35, 28, 1.9), focus=50,
        caption="This is Ruby's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her face, her hand and her scythe.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "face", "Face", "A short clip that moves in on her face."),
            ("short-2", "hand", "Hand", "A short clip that follows her hand."),
            ("short-3", "scythe", "Scythe", "A short clip that follows her scythe."),
        ],
    ),
    dict(
        slug="angela", name="Angela", pair="ruby-angela", order=4,
        face=(70, 30, 1.9), focus=48,
        caption="This is Angela's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her small companion, a crystal and her hand.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "chest", "Companion", "A short clip where the small companion floats up to her."),
            ("short-2", "tetra", "Crystal", "A short clip with a pink crystal that bursts open."),
            ("short-3", "hand", "Hand", "A short clip that follows her hand."),
        ],
    ),
    dict(
        slug="lesley", name="Lesley", pair="lesley-change", order=5,
        face=(70, 31, 1.9), focus=52,
        caption="This is Lesley's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her head, her gun and her foot.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "head", "Head", "A short clip that moves in on her head."),
            ("short-2", "gun", "Gun", "A short clip that follows her gun."),
            ("short-3", "foot", "Foot", "A short clip that looks down at her foot."),
        ],
    ),
    dict(
        slug="change", name="Chang'e", pair="lesley-change", order=6,
        face=(56, 45, 1.9), focus=50,
        caption="This is Chang'e's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and two short clips: her body and the moon.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "body", "Body", "A short clip that shows her whole body."),
            ("short-2", "moon", "Moon", "A short clip that follows the moon."),
        ],
    ),
    dict(
        slug="guinevere", name="Guinevere", pair="guinevere-vexana", order=7,
        face=(47, 36, 1.9), focus=50,
        caption="This is Guinevere's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her face, her feet and her waist.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "face", "Face", "A short clip that moves in on her face."),
            ("short-2", "foot", "Feet", "A short clip that looks down at her feet."),
            ("short-3", "stomach", "Waist", "A short clip that moves in on her waist."),
        ],
    ),
    dict(
        slug="vexana", name="Vexana", pair="guinevere-vexana", order=8,
        face=(41, 44, 1.9), focus=50,
        caption="This is Vexana's in-game hero showcase animation. It has a welcome, an idle loop, a close pose and three short clips: her face, her left hand and the big armored figure behind her.",
        poses=[("gallery", "zoom", "Pose", "The camera moves in on a close pose and she holds it, then it cuts back to idle.")],
        shorts=[
            ("short-1", "face", "Face", "A short clip that moves in on her face."),
            ("short-2", "left-hand", "Left hand", "A short clip that follows her left hand."),
            ("short-3", "big-thing", "Guardian", "A short clip about the big armored figure behind her."),
        ],
    ),
    dict(
        slug="obsidia", name="Obsidia", pair="selena-obsidia", order=9,
        face=(69, 28, 1.9), focus=52,
        caption="This is Obsidia's in-game hero showcase animation. It has a welcome, an idle loop, three close poses and three short clips: her face, her feet and her weapon.",
        poses=[
            ("about", "vertical", "Reach", "A close pose with her arm reaching out, then it cuts back to idle."),
            ("skills", "horizontal", "Rest", "A close pose with her chin on her hand, then it cuts back to idle."),
            ("gallery", "zoom", "Perch", "A close pose with her legs crossed, then it cuts back to idle."),
        ],
        shorts=[
            ("short-1", "short-1", "Face", "A short clip that moves in on her face."),
            ("short-2", "short-2", "Feet", "A short clip that looks down at her feet."),
            ("short-3", "short-3", "Weapon", "A short clip that follows the head of her weapon."),
        ],
    ),
    dict(
        slug="selena", name="Selena", pair="selena-obsidia", order=10,
        face=(57, 28, 1.9), focus=66,
        caption="This is Selena's in-game hero showcase animation. It has a welcome, an idle loop, three close poses and three short clips: the Silverbolt, her badge and her right arm.",
        poses=[
            ("about", "phone-empty", "Phone", "A close pose where she looks at her phone, then it cuts back to idle."),
            ("skills", "horizontal", "Flight", "A close pose in mid air with the Silverbolt above her, then it cuts back to idle."),
            ("gallery", "vertical", "Lean", "A close pose where she leans forward, then it cuts back to idle."),
        ],
        shorts=[
            ("short-1", "short-1", "Silverbolt", "A short clip that follows the Silverbolt."),
            ("short-2", "short-2", "Badge", "A short clip that moves in on her badge."),
            ("short-3", "short-3", "Right arm", "A short clip that follows her right arm."),
        ],
    ),
]

HINT = "Press a button. The animation cuts back to idle on its own."

WELCOME_LINE = "The opening animation of the in-game showcase. It plays once, then the idle loop takes over."
IDLE_LINE = "The loop she returns to between clips."

# Recordings in the source folder that no button plays, with the reason (merged into ignored.json).
UNUSED = {
    f"{SRC_DIR}/selena/phone-messages.mkv": "A second take of the phone pose. The room plays the empty phone take that the stage was cut from.",
    f"{SRC_DIR}/selena/selena-live.mkv": "A long live recording of the showcase. The room plays the cut clips of the stage instead.",
    f"{SRC_DIR}/obsidia/obsidia.mkv": "A long recording of the showcase. The room plays the cut clips of the stage instead.",
    f"{SRC_DIR}/obsidia/obsidia-live.mkv": "A long live recording of the showcase. The room plays the cut clips of the stage instead.",
}


def palette(slug: str) -> dict[str, str]:
    text = (CONTENT / f"{slug}.ts").read_text(encoding="utf-8")
    m = re.search(
        r'palette:\s*\{\s*primary:\s*"(#[0-9A-Fa-f]{6})",\s*secondary:\s*"(#[0-9A-Fa-f]{6})",\s*glow:\s*"(#[0-9A-Fa-f]{6})",\s*ink:\s*"(#[0-9A-Fa-f]{6})"',
        text,
    )
    if not m:
        raise SystemExit(f"no palette in {slug}.ts")
    return dict(zip(("primary", "secondary", "glow", "ink"), m.groups()))


def video_file(slug: str, tier: str, name: str) -> Path:
    base = SITE_DIRS.get(slug) or mirror_dir(slug)
    return base / tier / name


def seconds(path: Path) -> float | None:
    if not path.exists():
        return None
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    try:
        return round(float(p.stdout.strip()), 2)
    except ValueError:
        return None


def total(slug: str, names: list[str]) -> float | None:
    parts = [seconds(video_file(slug, "1080", n)) for n in names]
    if any(p is None for p in parts):
        return None
    return round(sum(parts), 1)  # type: ignore[arg-type]


def clip_items(c: dict) -> list[dict]:
    slug, name, pair = c["slug"], c["name"], c["pair"]
    base = dict(collection="animation", chars=[slug], pair=pair, canon="official")
    items: list[dict] = []
    order = 0

    def add(kind: str, scene: str | None, label: str, line: str, dur: float | None, src: str, tags: list[str]) -> None:
        nonlocal order
        slug_part = kind if kind in ("welcome", "idle") else common.slugify(label)
        items.append(
            {
                "id": f"animation-{slug}-{slug_part}",
                "title": f"{name}, {label}" if kind in ("pose", "short") else f"{name}, {label.lower()}",
                **base,
                "tags": ["in-game", kind, *tags],
                "kind": kind,
                "scene": scene,
                "label": label,
                "line": line,
                "dur": dur,
                "order": order,
                "src": src,
            }
        )
        order += 1

    add("welcome", None, "Welcome", WELCOME_LINE, total(slug, ["welcome.mp4"]), f"{SRC_DIR}/{slug}/welcome.mkv", [])
    add("idle", None, "Idle", IDLE_LINE, total(slug, ["idle.mp4"]), f"{SRC_DIR}/{slug}/idle.mkv", ["loop"])
    for scene, rec, label, line in c["poses"]:
        add(
            "pose", scene, label, line,
            total(slug, [f"{scene}-in.mp4", f"{scene}-loop.mp4", f"{scene}-out.mp4"]),
            f"{SRC_DIR}/{slug}/{rec}.mkv", ["pose", "zoom"],
        )
    for scene, rec, label, line in c["shorts"]:
        add("short", scene, label, line, total(slug, [f"{scene}.mp4"]), f"{SRC_DIR}/{slug}/{rec}.mkv", [common.slugify(label)])
    return items


def write_loaders() -> list[str]:
    ready = []
    if STAGE_DATA.exists():
        ready = sorted(
            f.name[: -len(".generated.ts")] for f in STAGE_DATA.glob("*.generated.ts")
        )
    mine = [s for s in ready if any(c["slug"] == s for c in CHARS) and s not in SITE_DIRS]
    lines = [
        "// Generated by scripts/library/animation/index.py. Do not edit.",
        "",
        "/** A lazy import for every character whose stage data is in `stage-data/`. */",
        "export const STAGE_LOADERS: Readonly<Record<string, () => Promise<unknown>>> = {",
    ]
    for s in mine:
        lines.append(f'  {s}: () => import("./stage-data/{s}.generated"),')
    lines += ["};", ""]
    out = ROOM / "stage-loaders.generated.ts"
    out.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {out.relative_to(common.REPO)} ({len(mine)} characters: {', '.join(mine) or 'none yet'})")
    return mine


def merge_ignored() -> None:
    import json

    path = Path(__file__).resolve().parents[1] / "ignored.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    changed = False
    for k, v in UNUSED.items():
        if data.get(k) != v:
            data[k] = v
            changed = True
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"merged {len(UNUSED)} entries into {path.relative_to(common.REPO)}")


def main() -> None:
    items: list[dict] = []
    characters: list[dict] = []
    for c in sorted(CHARS, key=lambda c: c["order"]):
        items += clip_items(c)
        fx, fy, fz = c["face"]
        characters.append(
            {
                "slug": c["slug"],
                "name": c["name"],
                "caption": c["caption"],
                "palette": palette(c["slug"]),
                "face": {"x": fx, "y": fy, "zoom": fz},
                "focus": c["focus"],
            }
        )
    common.write_json("animation", {"v": 1, "slug": "animation", "hint": HINT, "characters": characters, "items": items})
    missing = [i["id"] for i in items if i["dur"] is None]
    print(f"{len(items)} clips, {len(missing)} without a length yet")
    write_loaders()
    merge_ignored()


if __name__ == "__main__":
    main()
