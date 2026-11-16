"""TheMLabel's close of the About page: the logo, the M and the footage of the flip book.

The owner asked (16 Nov 2026, third round) for the page to end on TheMLabel, made after the
label's own ident (`mlabel.mp4`, the owner's file): a black ground closes over the page with an
M-shaped window, M plates with footage flip up one over the other, and the logo is spelled out.
This script makes the three kinds of file that scene needs.

1. The logo. The owner's picture (silver THE, orange M, silver LABEL on a clear ground) is trimmed
   and saved whole. The letters are found by the clear columns between them, so the page can fly
   each one in by itself from one picture.
2. The M. Its outline is measured on the logo's own M (the notch, the legs, the middle point) and
   made symmetric, as on the plates of the ident, where the M stands straight in front of the
   camera. The window in the black, the plates and the last plate that becomes the logo's M all
   use this one shape. The four corners of the logo's M are kept too: the last plate is laid on
   them, so it lands exactly on the letter.
3. The footage. Short muted clips cut from the official films, three for each of the five plates.
   A plate has a colour, as in the ident (white and violet, pink, yellow, red, then the logo's
   orange), and each clip is graded toward the colour of its plate. The page picks one clip a
   plate on every visit and starts it at a point of its own, so no two visits are the same.
   Every stretch is cropped to the plate's own shape, and away from the bands where three of the
   films carry subtitles. Each was read through the M for text: none shows.

    python scripts/about/mlabel/build.py            # everything
    python scripts/about/mlabel/build.py logo       # the logo and the M only
    python scripts/about/mlabel/build.py clips      # the footage only
    python scripts/about/mlabel/build.py sheet      # a sheet of the built clips, seen through the M

Outputs (committed): apps/web/public/img/about/mlabel/logo.webp,
apps/web/public/video/about/mlabel/<plate>-<n>.mp4 and .webp, and the generated
apps/web/src/features/about/mlabel/assets.ts (shapes, boxes, addresses and byte counts).
A file made again under the same name needs the cache name bump in lib/media-store.ts.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
LOGO_SOURCE = Path(r"C:\Users\muham\Downloads\image (15) (1).png")
FILMS = Path(r"D:\ren\aspirant-r2\library\v1\video\films")
IMG_OUT = ROOT / "apps" / "web" / "public" / "img" / "about" / "mlabel"
VIDEO_OUT = ROOT / "apps" / "web" / "public" / "video" / "about" / "mlabel"
DATA_OUT = ROOT / "apps" / "web" / "src" / "features" / "about" / "mlabel" / "assets.ts"
STATE = Path(__file__).resolve().parent / "built.json"

# The clear margin kept around the trimmed logo, in pixels of the source.
PAD = 6

# The films, by a short key. All ten are the collection's own files.
FILM = {
    "layla-fanny": "film-layla-and-fanny-video-official-lore-trailer-trailer",
    "ruby-angela": "film-ruby-and-angela-video-trailer-trailer-final",
    "lesley-change": "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
    "connection-lost": "film-vexana-and-guinevere-video-connection-lost-final-video",
    "selena-obsidia": "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
}

# The band of a film's height that is used. The three later films carry subtitles in the lowest
# sixth and lyrics along the top, so their band stops short of both.
BAND = {
    "layla-fanny": (0.03, 0.97),
    "ruby-angela": (0.03, 0.97),
    "lesley-change": (0.03, 0.97),
    "connection-lost": (0.13, 0.81),
    "selena-obsidia": (0.13, 0.81),
}

# The clips' size. The shape is the M's own box (see `m_shape`), so nothing is cropped on the page.
CLIP_W = 480
FPS = 30

# The colour of each plate, as ffmpeg filters laid over the film's own colours. The last plate is
# the logo's orange and nothing else: the film is reduced to its light and dark and painted in it.
GRADE = {
    "white": "eq=brightness=0.07:contrast=1.04:saturation=0.92,colorbalance=bs=0.10:bm=0.10:bh=0.06:rh=0.02",
    "pink": "eq=saturation=1.12,colorbalance=rm=0.14:bm=0.12:gm=-0.08:rh=0.06:bh=0.04",
    "gold": "eq=saturation=1.1:brightness=0.03,colorbalance=rm=0.16:gm=0.05:bm=-0.18:rh=0.08:bh=-0.10",
    "red": "eq=saturation=1.15:contrast=1.05,colorbalance=rs=0.18:rm=0.24:gm=-0.12:bm=-0.16:rh=0.10:bh=-0.08",
    "orange": (
        "hue=s=0,eq=contrast=1.15:brightness=0.02,"
        "curves=r='0/0.42 0.35/0.90 0.7/1 1/1':g='0/0.03 0.35/0.24 0.7/0.47 1/0.78':b='0/0 0.35/0.01 0.7/0.03 1/0.22'"
    ),
}

# (plate, film, start in seconds, seconds, where the middle of the crop is across the film 0..1,
# what the stretch shows). Three for each plate, and every phase is in the set.
SHOTS = [
    ("white", "layla-fanny", 33.2, 1.8, 0.42, "Fanny in the white corridor"),
    ("white", "lesley-change", 34.6, 1.8, 0.52, "the laboratory in the light"),
    ("white", "ruby-angela", 57.5, 1.8, 0.50, "Angela waking in the white light"),
    ("pink", "selena-obsidia", 160.0, 1.8, 0.50, "the wings of pink light"),
    ("pink", "ruby-angela", 92.6, 1.8, 0.50, "Angela, close"),
    ("pink", "connection-lost", 84.6, 1.8, 0.45, "the violet storm"),
    ("gold", "lesley-change", 121.6, 1.8, 0.50, "the city in the gold blast"),
    ("gold", "layla-fanny", 55.4, 1.8, 0.55, "the city at sunset"),
    ("gold", "selena-obsidia", 155.7, 1.7, 0.50, "the hand in the golden fire"),
    ("red", "selena-obsidia", 106.0, 1.8, 0.50, "the red sky"),
    ("red", "ruby-angela", 122.0, 1.8, 0.45, "Ruby with her scythe"),
    ("red", "selena-obsidia", 31.1, 1.8, 0.45, "the burst of red light"),
    ("orange", "ruby-angela", 156.6, 2.6, 0.50, "Ruby, close"),
    ("orange", "layla-fanny", 86.2, 2.6, 0.50, "Fanny at sunset"),
    ("orange", "ruby-angela", 173.0, 2.6, 0.42, "Ruby at sunset"),
]

PLATES = ["white", "pink", "gold", "red", "orange"]


# The logo and the M --------------------------------------------------------------------------


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """The stretches of a row or a column that are set, as (first, last)."""
    out, start = [], None
    for i, on in enumerate(mask):
        if on and start is None:
            start = i
        if not on and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def measure_logo() -> dict:
    """Trim the logo, find its letters and measure its M."""
    image = Image.open(LOGO_SOURCE).convert("RGBA")
    alpha = np.array(image)[..., 3]
    solid = alpha > 96
    ys, xs = np.where(alpha > 8)
    left, right, top, bottom = xs.min() - PAD, xs.max() + PAD, ys.min() - PAD, ys.max() + PAD
    trimmed = image.crop((left, top, right + 1, bottom + 1))
    width, height = trimmed.size

    letters = []
    for a, b in runs((alpha > 8).any(axis=0)):
        rows = np.where((alpha[:, a : b + 1] > 8).any(axis=1))[0]
        letters.append((a - left, rows.min() - top, b - left + 1, rows.max() - top + 1))
    if len(letters) != 9:
        raise SystemExit(f"expected nine letters, found {len(letters)}")
    names = ["t", "h", "e", "m", "l", "a", "b", "e2", "l2"]

    # The M: the fourth letter. Its rows are read for the points of the shape.
    ma, mt, mb, _ = letters[3][0] + left, letters[3][1] + top, letters[3][2] + left - 1, 0
    m_solid = solid[:, ma : mb + 1]
    rows = np.where(m_solid.any(axis=1))[0]
    m_top = int(rows.min())
    w = mb - ma + 1
    # The notch: rows with two runs at the top. Its point is where they join.
    notch_rows = [y for y in rows if len(runs(m_solid[y])) == 2 and y < m_top + 0.6 * w]
    # Skip the rounded first rows when reading the width of the notch at the top.
    first = runs(m_solid[notch_rows[4]])
    notch_tip_y = max(notch_rows) + 1
    slope_rows = notch_rows[4:-4]
    lefts = np.array([runs(m_solid[y])[0][1] for y in slope_rows], dtype=float)
    rights = np.array([runs(m_solid[y])[1][0] for y in slope_rows], dtype=float)
    yy = np.array(slope_rows, dtype=float)
    # The edges of the notch as lines, read back at the top of the letter.
    lk, lc = np.polyfit(yy, lefts, 1)
    rk, rc = np.polyfit(yy, rights, 1)
    notch_left = lk * m_top + lc
    notch_right = rk * m_top + rc
    notch_tip_y = (rc - lc) / (lk - rk)
    # The legs: rows with three runs. The inner gaps start where the middle stroke leaves a leg.
    leg_rows = [y for y in rows if len(runs(m_solid[y])) == 3 and y > max(notch_rows)]
    gap_top = min(leg_rows)
    sample = runs(m_solid[leg_rows[len(leg_rows) // 3]])
    leg_left = sample[0][1] + 1
    leg_right = w - sample[2][0]
    left_bottom = int(np.where(m_solid[:, : leg_left - 2].any(axis=1))[0].max())
    right_bottom = int(np.where(m_solid[:, w - leg_right + 2 :].any(axis=1))[0].max())
    # The M stands on its left leg's foot: the right one runs on, as the logo is drawn in depth.
    h = left_bottom - m_top + 1

    leg = (leg_left + leg_right) / 2 / w
    notch = ((notch_left + 1) / w + (1 - notch_right / w)) / 2
    shape = {
        "aspect": round(w / h, 4),
        "leg": round(leg, 4),
        "notch": round(notch, 4),
        "notch_tip": round((notch_tip_y - m_top) / h, 4),
        "gap_top": round((gap_top - m_top) / h, 4),
    }
    # The corners of the logo's M inside the trimmed picture, as fractions of it: top left, top
    # right, bottom right, bottom left.
    quad = [
        ((ma - left) / width, (m_top - top) / height),
        ((mb + 1 - left) / width, (m_top - top) / height),
        ((mb + 1 - left) / width, (right_bottom + 1 - top) / height),
        ((ma - left) / width, (left_bottom + 1 - top) / height),
    ]
    # The logo's orange, from the middle of the letter.
    patch = np.array(image)[m_top + h // 2 - 6 : m_top + h // 2 + 6, ma + 10 : ma + 40, :3]
    orange = "#" + "".join(f"{int(v):02x}" for v in patch.reshape(-1, 3).mean(axis=0))

    return {
        "image": trimmed,
        "size": (width, height),
        "letters": [
            {
                "id": n,
                "x": round(a / width, 5),
                "y": round(t / height, 5),
                "w": round((b - a) / width, 5),
                "h": round((bt - t) / height, 5),
            }
            for n, (a, t, b, bt) in zip(names, letters)
        ],
        "shape": shape,
        "quad": [(round(x, 5), round(y, 5)) for x, y in quad],
        "orange": orange,
    }


def m_polygon(shape: dict) -> list[tuple[float, float]]:
    """The M as twelve points in its own box, 0 to 1, clockwise from the top left."""
    leg, notch, tip, gap = shape["leg"], shape["notch"], shape["notch_tip"], shape["gap_top"]
    return [
        (0, 0),
        (notch, 0),
        (0.5, tip),
        (1 - notch, 0),
        (1, 0),
        (1, 1),
        (1 - leg, 1),
        (1 - leg, gap),
        (0.5, 1),
        (leg, gap),
        (leg, 1),
        (0, 1),
    ]


def build_logo() -> dict:
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    logo = measure_logo()
    target = IMG_OUT / "logo.webp"
    logo["image"].save(target, "WEBP", quality=92, method=6, exact=True)
    print(target.name, logo["size"], target.stat().st_size)
    return {
        "logo": {"src": "/img/about/mlabel/logo.webp", "width": logo["size"][0], "height": logo["size"][1]},
        "letters": logo["letters"],
        "shape": logo["shape"],
        "polygon": [(round(x, 4), round(y, 4)) for x, y in m_polygon(logo["shape"])],
        "quad": logo["quad"],
        "orange": logo["orange"],
    }


# The footage ---------------------------------------------------------------------------------


def clip_size(aspect: float) -> tuple[int, int]:
    height = int(round(CLIP_W / aspect / 2)) * 2
    return CLIP_W, height


def crop_filter(film: str, centre: float, aspect: float) -> str:
    """Crop a film to the plate's shape, inside the band that carries no text."""
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
            "stream=width,height", "-of", "csv=p=0", str(FILMS / FILM[film] / "video.mp4"),
        ],
        check=True, capture_output=True, text=True,
    )
    fw, fh = (int(v) for v in probe.stdout.strip().split(","))
    top, bottom = BAND[film]
    ch = int(fh * (bottom - top) / 2) * 2
    cw = int(ch * aspect / 2) * 2
    x = int(min(max(centre * fw - cw / 2, 0), fw - cw))
    return f"crop={cw}:{ch}:{x}:{int(fh * top)}"


def build_clips(aspect: float) -> list[dict]:
    VIDEO_OUT.mkdir(parents=True, exist_ok=True)
    width, height = clip_size(aspect)
    out = []
    counts: dict[str, int] = {}
    for plate, film, start, seconds, centre, what in SHOTS:
        counts[plate] = counts.get(plate, 0) + 1
        name = f"{plate}-{counts[plate]}"
        video = VIDEO_OUT / f"{name}.mp4"
        still = VIDEO_OUT / f"{name}.webp"
        chain = (
            f"{crop_filter(film, centre, aspect)},fps={FPS},"
            f"scale={width}:{height}:flags=lanczos,{GRADE[plate]},setsar=1,format=yuv420p"
        )
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-ss", f"{start}", "-t", f"{seconds}",
                "-i", str(FILMS / FILM[film] / "video.mp4"), "-vf", chain,
                "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", "26",
                "-g", "15", "-keyint_min", "15", "-movflags", "+faststart", "-an", str(video),
            ],
            check=True,
        )
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y", "-i", str(video), "-frames:v", "1",
                "-c:v", "libwebp", "-quality", "70", str(still),
            ],
            check=True,
        )
        out.append(
            {
                "plate": plate,
                "src": f"/video/about/mlabel/{name}.mp4",
                "still": f"/video/about/mlabel/{name}.webp",
                "bytes": video.stat().st_size,
                "seconds": seconds,
                "what": f"{what} ({film})",
            }
        )
        print(name, video.stat().st_size, still.stat().st_size, what)
    return out


def sheet(polygon: list[tuple[float, float]], aspect: float) -> None:
    """Every built clip at five moments, seen through the M on black, as it is on a plate."""
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent / "sheet.jpg"
    width, height = clip_size(aspect)
    cell_w, cell_h, shots = 240, int(240 / aspect), 5
    mask = Image.new("L", (cell_w, cell_h), 0)
    ImageDraw.Draw(mask).polygon([(x * cell_w, y * cell_h) for x, y in polygon], fill=255)
    names = sorted(p for p in VIDEO_OUT.glob("*.mp4"))
    names.sort(key=lambda p: (PLATES.index(p.stem.split("-")[0]), p.stem))
    board = Image.new("RGB", (cell_w * shots * 3 + 40, (cell_h + 8) * 5 + 8), "black")
    for i, path in enumerate(names):
        frames = subprocess.run(
            [
                "ffmpeg", "-v", "error", "-i", str(path), "-vf",
                f"fps={shots}/{1.7},scale={cell_w}:{cell_h}", "-frames:v", str(shots),
                "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
            ],
            check=True, capture_output=True,
        ).stdout
        row, col = PLATES.index(path.stem.split("-")[0]), int(path.stem.split("-")[1]) - 1
        for k in range(shots):
            chunk = frames[k * cell_w * cell_h * 3 : (k + 1) * cell_w * cell_h * 3]
            if len(chunk) < cell_w * cell_h * 3:
                break
            frame = Image.frombytes("RGB", (cell_w, cell_h), chunk)
            # The first and last of the five are shown whole, to read the edges for text.
            cut = frame if k in (0, shots - 1) else Image.composite(frame, Image.new("RGB", frame.size), mask)
            board.paste(cut, (col * (cell_w * shots + 20) + k * cell_w, 8 + row * (cell_h + 8)))
    board.save(target, quality=88)
    print(target, (width, height))


# The page's data -----------------------------------------------------------------------------


def write_data(state: dict) -> None:
    def ts(value: object) -> str:
        return json.dumps(value, indent=2)

    clips = state["clips"]
    by_plate = {p: [c for c in clips if c["plate"] == p] for p in PLATES}
    lines = [
        "/**",
        " * Made by `scripts/about/mlabel/build.py` from the owner's logo picture and the official films.",
        " * Never edit it: change the script and run it.",
        " */",
        "",
        "/** TheMLabel's logo, trimmed, on a clear ground. */",
        f"export const LOGO = {ts(state['logo'])} as const;",
        "",
        "/** The nine letters inside the logo, as fractions of the picture, in reading order. */",
        f"export const LETTERS = {ts(state['letters'])} as const;",
        "",
        "/**",
        " * The logo's orange, read from the middle of its M (the stylesheet's `--orange` is this value).",
        " * @public",
        " */",
        f"export const LOGO_ORANGE = {ts(state['orange'])};",
        "",
        "/** The M's box: its width over its height. */",
        f"export const M_ASPECT = {state['shape']['aspect']};",
        "",
        "/**",
        " * The M, made symmetric: twelve points in its own box (0 to 1), clockwise from the top left.",
        " * The window in the black, the plates and the last plate all use it.",
        " */",
        f"export const M_POINTS: ReadonlyArray<readonly [number, number]> = {ts(state['polygon'])};",
        "",
        "/** The band of the M that is solid from side to side (between the notch and the legs' gaps). */",
        f"export const M_SOLID = {{ top: {state['shape']['notch_tip']}, bottom: {state['shape']['gap_top']} }} as const;",
        "",
        "/**",
        " * The corners of the logo's own M inside the logo picture (fractions of it): top left, top",
        " * right, bottom right, bottom left. The last plate is laid on them.",
        " */",
        f"export const M_QUAD: ReadonlyArray<readonly [number, number]> = {ts(state['quad'])};",
        "",
        "export interface PlateClip {",
        "  readonly src: string;",
        "  readonly still: string;",
        "  readonly bytes: number;",
        "  readonly seconds: number;",
        "  /** What the stretch shows and the film it is cut from. */",
        "  readonly what: string;",
        "}",
        "",
        "/** The plates in the order they flip up, by their colour. */",
        f"export const PLATE_ORDER = {ts(PLATES)} as const;",
        "",
        "export type PlateTone = (typeof PLATE_ORDER)[number];",
        "",
        "/** The clips a plate can show. One is picked a visit. */",
        "export const PLATE_CLIPS: Record<PlateTone, readonly PlateClip[]> = "
        + ts({p: [{k: v for k, v in c.items() if k != "plate"} for c in by_plate[p]] for p in PLATES})
        + ";",
        "",
    ]
    DATA_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(DATA_OUT)


def main() -> None:
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    if what in ("all", "logo"):
        state.update(build_logo())
    if what in ("all", "clips"):
        state["clips"] = build_clips(state["shape"]["aspect"])
    if what == "sheet":
        sheet([tuple(p) for p in state["polygon"]], state["shape"]["aspect"])
        return
    STATE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    if "clips" in state and "logo" in state:
        write_data(state)


if __name__ == "__main__":
    main()
