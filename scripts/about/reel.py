"""The reel of the About page: a muted loop cut from the official phase trailers, in release order.

    C:/Users/muham/anaconda3/python.exe -I scripts/about/reel.py            (build)
    C:/Users/muham/anaconda3/python.exe -I scripts/about/reel.py check      (frames of every shot, to read)
    C:/Users/muham/anaconda3/python.exe -I scripts/about/reel.py sheet      (frames of the built files)

Sources: the trailers under D:\\ren\\aspirant\\media (read only; ABOUT_MEDIA names another folder). ffmpeg
must be on the PATH. Work files go to ABOUT_WORK (default: aspirant-about-reel in the temp folder).

What it does
  * Cuts the shots of SHOTS, one film after another, phase I to phase V. Every shot was read for
    burned-in text: no subtitle, no lyric, no logo and no end card is in any frame that is shown (the
    `check` command writes the frames to read and names every stretch where white holds still in a
    text band; README.md has the reason for each shot). The films of phases IV and V carry English
    subtitles in the picture: a shot from them is either free of them or cropped clear of them.
  * Brings every source to one shape, 1920 by 810 (2.37 to 1, the trailers' own). The 2560 by 1080
    films are that shape already and are only scaled. The two 1920 by 1080 films with black bars baked
    in are cropped inside the bars. The one 16:9 film gives a window of that shape. One shot has a
    window of its own, to leave a subtitle out.
  * Plays every source frame once at 25 frames a second, so a pan never stutters: no frame is shown
    twice and none is dropped. The 24 fps films run 4 percent faster (with no sound nothing gives it
    away). "Rekindled Light" is a 24 fps film in a 25 fps file, with one frame a second shown twice:
    those repeats are left out. The one 30 fps film runs at five sixths of its speed, see FILMS.
  * Joins shots of one phase with a plain cut and phases with a short dissolve, and dissolves the end
    of the last shot into the head of the first, so the loop has no seam: the file begins on the
    frame after that dissolve.
  * Stays in YUV from the decoder to the encoder (a dissolve is a mean of the planes), so no colour is
    converted on the way. The output is tagged BT.709, limited range.
  * Writes two sizes with two encoder passes each, so the sizes land where SIZES says: the whole file
    is waited for by the loading screen. The still is the first frame of the large file.

Output (committed): apps/web/public/video/about/reel-1920.mp4, reel-1280.mp4 (H.264 high, yuv420p,
faststart, no sound) and reel-poster.webp. After a build, write the two byte counts it prints into
apps/web/src/features/about/media.ts. If the files were ever published under these names, also bump
the cache name in apps/web/src/lib/media-store.ts.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[2]
MEDIA = Path(os.environ.get("ABOUT_MEDIA", r"D:\ren\aspirant\media"))
WORK = Path(os.environ.get("ABOUT_WORK", str(Path(tempfile.gettempdir()) / "aspirant-about-reel")))
OUT_DIR = REPO / "apps" / "web" / "public" / "video" / "about"
MEDIA_TS = REPO / "apps" / "web" / "src" / "features" / "about" / "media.ts"

W, H, FPS = 1920, 810, 25
FRAME_BYTES = W * H * 3 // 2  # one yuv420p frame

# Frames of the dissolve between two phases, and of the one that closes the loop.
PHASE_FADE = 15
LOOP_FADE = 25

# name, width, height, kbit/s. Two passes hit the rate, so the sizes are known before the encode.
SIZES = [
    ("reel-1920.mp4", 1920, 810, 2300),
    ("reel-1280.mp4", 1280, 540, 1300),
]
POSTER = "reel-poster.webp"

# Two of the sources carry no colour tags. All are HD films, which is BT.709, limited range.
COLOUR = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]


@dataclass(frozen=True)
class Film:
    title: str
    phase: int  # the phase of the series the film belongs to, 1 to 5
    path: str  # under MEDIA
    rate: int  # frames a second of the file
    crop: tuple[int, int, int, int]  # left, top, width, height of the part that is kept
    # (every, at): frame n repeats the one before when n % every == at. Such a frame is left out.
    repeats: tuple[int, int] | None = None


# The crops. A film of 2560 by 1080 is kept whole. "Go For It! Aspirants!" has its picture in rows
# 130 to 950 (820 rows) and "Day of Enders" in rows 136 to 944 (808 rows), found with cropdetect on
# the shots used: the first is cut 5 rows inside each bar, the second gives up 2 columns a side to
# keep the shape. "The Queen's Endgame" is a full 16:9 picture: its window is set on Obsidia's face,
# and the subtitles of that film (in the lowest tenth of the picture) fall below the window.
FILMS = {
    "go": Film("Go For It! Aspirants!", 1, "layla-and-fanny/video/official/lore/trailer/trailer.webm", 24, (0, 135, 1920, 810)),
    "awakening": Film("Awakening", 2, "ruby-and-angela/video/trailer/trailer-final.mp4", 25, (0, 0, 2560, 1080)),
    # A 24 fps film in a 25 fps file: frames 1, 26, 51 and so on repeat the frame before (found by
    # comparing each frame with the one before; `check` proves it again on every run).
    "rekindled": Film("Rekindled Light", 3, "lesley-and-change/video/official/trailer/video.webm", 25, (0, 0, 2560, 1080), repeats=(25, 1)),
    "connection": Film("Connection Lost", 4, "vexana-and-guinevere/video/connection-lost/final_video.mp4", 25, (0, 0, 2560, 1080)),
    "enders": Film("Day of Enders", 5, "selena-and-obsidia/video/trailer/001_3994447231709070185.mp4", 24, (2, 136, 1916, 808)),
    # 30 frames a second. Every frame is shown once at 25, so the shot runs at five sixths of its
    # speed: a slow gesture, a little slower. Leaving out every sixth frame would keep the speed and
    # stutter, which shows on the drifting hair and the lightning.
    "queen": Film("The Queen's Endgame", 5, "selena-and-obsidia/video/obsidia/001_3997406762701005025.mp4", 30, (0, 100, 1920, 810)),
}


@dataclass(frozen=True)
class Shot:
    film: str
    first: int  # the first frame of the source that is shown (frame 0 is the file's first)
    end: int  # the frame after the last one shown
    note: str
    # A window of this shot's own (left, top, width, height), in place of the film's.
    crop: tuple[int, int, int, int] | None = None

    @property
    def window(self) -> tuple[int, int, int, int]:
        return self.crop or FILMS[self.film].crop

    @property
    def shown(self) -> list[int]:
        """The frames of the source that are shown: all of them, less the repeats of the film."""
        repeats = FILMS[self.film].repeats
        if not repeats:
            return list(range(self.first, self.end))
        every, at = repeats
        return [n for n in range(self.first, self.end) if n % every != at]

    @property
    def frames(self) -> int:
        return len(self.shown)


# The cut. Frame numbers of the source file, so a bound is exact: seconds = frame / the film's rate.
SHOTS = [
    Shot("go", 381, 463, "the skyline, night to sunrise"),
    Shot("go", 1366, 1406, "Layla on the roof"),
    Shot("go", 2036, 2126, "Fanny close, a whip pan, Layla close"),
    Shot("awakening", 0, 94, "the city and the airship"),
    Shot("awakening", 1668, 1756, "Ruby and Angela in the meadow"),
    Shot("rekindled", 31, 104, "the city by night"),
    Shot("rekindled", 477, 546, "Lesley, Chang'e and the robot"),
    # Frame 992 is the first of a glitch effect that tears the picture.
    Shot("rekindled", 935, 992, "Lesley close"),
    # The subtitle "No..." is burned in on frames 452 to 464, its letters in rows 992 to 1025 of the
    # 1080. This window ends at row 968 and is 12 percent closer: the film is 2560 wide, so nothing
    # is enlarged.
    Shot("connection", 444, 493, "Guinevere", crop=(133, 0, 2294, 968)),
    Shot("connection", 493, 536, "Vexana"),
    Shot("enders", 280, 363, "Selena on the bridge, then the city under the red star"),
    # From the frame the debris of the cut has cleared to the frame before the orb floods the
    # picture with white: a loop should not flash.
    Shot("queen", 1178, 1238, "Obsidia and the black sun"),
]


def fade_into(i: int) -> int:
    """Frames of the dissolve that brings shot i in: none inside a phase, the loop's before shot 0."""
    if i == 0:
        return LOOP_FADE
    return 0 if FILMS[SHOTS[i].film].phase == FILMS[SHOTS[i - 1].film].phase else PHASE_FADE


def total_frames() -> int:
    return sum(s.frames for s in SHOTS) - sum(fade_into(i) for i in range(len(SHOTS)))


def run(cmd: list[str]) -> None:
    done = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if done.returncode != 0:
        raise SystemExit(f"{' '.join(cmd[:6])} ... failed:\n{done.stderr[-2000:]}")


Window = tuple[int, int, int, int]


def decoder(film: Film, first: int, count: int, window: Window | None = None) -> subprocess.Popen:
    """Frames first to first + count of a film, cropped and scaled, as raw yuv420p on a pipe."""
    x, y, w, h = window or film.crop
    # Half a frame before the frame wanted: the seek lands on it whatever the rounding of the file.
    at = max(0.0, (first - 0.5) / film.rate)
    return subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-ss", f"{at:.5f}", "-i", str(MEDIA / film.path), "-an",
            # Every decoded frame once, whatever its time stamp: without the pass through ffmpeg
            # repeats the first frame to fill the half frame between the seek and the picture, and
            # the plain count as the time keeps the rounded stamps of a WebM file from colliding.
            "-vf", f"crop={w}:{h}:{x}:{y},scale={W}:{H}:flags=lanczos,setsar=1,setpts=N/TB",
            "-fps_mode", "passthrough",
            "-frames:v", str(count), "-pix_fmt", "yuv420p", "-f", "rawvideo", "-",
        ],
        stdout=subprocess.PIPE,
    )


def source(film: Film, numbers: list[int], window: Window | None = None):
    """Yields the named frames of a film, in order (the numbers rise; the ones between are read
    and left out)."""
    if not numbers:
        return
    pipe = decoder(film, numbers[0], numbers[-1] - numbers[0] + 1, window)
    assert pipe.stdout is not None
    wanted = set(numbers)
    for n in range(numbers[0], numbers[-1] + 1):
        raw = pipe.stdout.read(FRAME_BYTES)
        if len(raw) < FRAME_BYTES:
            raise SystemExit(f"{film.title} ended before frame {n}: check the frame numbers in SHOTS")
        if n in wanted:
            yield np.frombuffer(raw, np.uint8)
    pipe.wait()


def luma(frame: np.ndarray) -> np.ndarray:
    return frame[: W * H].reshape(H, W)


def timeline():
    """Yields the frames of the loop, in order, as yuv420p bytes."""
    count = len(SHOTS)
    for i, shot in enumerate(SHOTS):
        lead = fade_into(i)
        nxt = SHOTS[(i + 1) % count]
        tail = fade_into((i + 1) % count)
        shown = shot.shown
        if len(shown) < lead + tail:
            raise SystemExit(f"shot {i + 1} is shorter than its two dissolves")
        # The frames of the dissolve that brought this shot in were written with the shot before
        # (for the first shot: they are written at the very end, with the last one).
        frames = source(FILMS[shot.film], shown[lead:], shot.window)
        for _ in range(len(shown) - lead - tail):
            yield next(frames).tobytes()
        head = source(FILMS[nxt.film], nxt.shown[:tail], nxt.window)
        for k, (a, b) in enumerate(zip(frames, head)):
            # Never wholly one or the other: step k of `tail` is k + 1 parts of tail + 1.
            t = (k + 1) / (tail + 1)
            a = a.astype(np.float32)
            yield np.rint(a + (b.astype(np.float32) - a) * t).astype(np.uint8).tobytes()


def master() -> Path:
    """The whole loop without loss, so the two sizes and both passes read the same frames."""
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / "master.mkv"
    encode = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{W}x{H}",
            "-r", str(FPS), "-i", "-", "-an", "-c:v", "ffv1", "-level", "3", "-g", "1",
            *COLOUR, str(out),
        ],
        stdin=subprocess.PIPE,
    )
    assert encode.stdin is not None
    written = 0
    for frame in timeline():
        encode.stdin.write(frame)
        written += 1
    encode.stdin.close()
    if encode.wait() != 0:
        raise SystemExit("the master failed to encode")
    if written != total_frames():
        raise SystemExit(f"{written} frames written, {total_frames()} expected")
    return out


def encode(src: Path, name: str, w: int, h: int, kbit: int) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / name
    # Written beside the target, then moved over it: the dev server never sees half a file, and the
    # move works when the work folder is on another drive.
    tmp = OUT_DIR / f"{name}.part"
    log = str(WORK / f"{out.stem}.pass")
    scale = [] if (w, h) == (W, H) else ["-vf", f"scale={w}:{h}:flags=lanczos,setsar=1"]
    common = [
        "ffmpeg", "-v", "error", "-y", "-i", str(src), *scale, "-an",
        "-c:v", "libx264", "-preset", "veryslow", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-b:v", f"{kbit}k", "-g", "50", "-keyint_min", "25", "-passlogfile", log, *COLOUR,
    ]
    run([*common, "-pass", "1", "-f", "null", os.devnull])
    run([*common, "-pass", "2", "-movflags", "+faststart", "-f", "mp4", str(tmp)])
    tmp.replace(out)
    return out


def build() -> None:
    src = master()
    print(f"master: {total_frames()} frames, {total_frames() / FPS:.2f} s")
    sizes = {}
    for name, w, h, kbit in SIZES:
        out = encode(src, name, w, h, kbit)
        sizes[name] = out.stat().st_size
        print(f"{name}: {w}x{h}, {sizes[name]:,} bytes")
    # The still: the first frame of the large file, as the visitor's browser decodes it.
    first = WORK / "first.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT_DIR / SIZES[0][0]), "-frames:v", "1", str(first)])
    poster = OUT_DIR / POSTER
    with Image.open(first) as im:
        im.convert("RGB").save(poster, "WEBP", quality=80, method=6)
    print(f"{POSTER}: {poster.stat().st_size:,} bytes")
    said = MEDIA_TS.read_text(encoding="utf-8") if MEDIA_TS.exists() else ""
    for const, name in (("REEL_LARGE_BYTES", SIZES[0][0]), ("REEL_SMALL_BYTES", SIZES[1][0])):
        want = f"{const} = {sizes[name]:_}"
        if want not in said:
            print(f"write into features/about/media.ts: export const {want};")


# ---------------------------------------------------------------------------------------------
# Reading the footage. Nothing below writes into the site.
# ---------------------------------------------------------------------------------------------


def rgb(frame: np.ndarray) -> Image.Image:
    """A yuv420p frame as a picture (BT.709, limited range), for the sheets only."""
    y = frame[: W * H].reshape(H, W).astype(np.float32)
    u = frame[W * H : W * H * 5 // 4].reshape(H // 2, W // 2).astype(np.float32)
    v = frame[W * H * 5 // 4 :].reshape(H // 2, W // 2).astype(np.float32)
    u = u.repeat(2, 0).repeat(2, 1) - 128
    v = v.repeat(2, 0).repeat(2, 1) - 128
    y = (y - 16) * (255 / 219)
    out = np.stack([y + 1.793 * v, y - 0.213 * u - 0.533 * v, y + 2.112 * u], axis=-1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def tile(images: list[tuple[str, Image.Image]], cols: int, width: int) -> Image.Image:
    cell_h = round(width * images[0][1].height / images[0][1].width)
    rows = -(-len(images) // cols)
    sheet = Image.new("RGB", (cols * width, rows * (cell_h + 18)), (20, 0, 30))
    draw = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(images):
        x, y = (i % cols) * width, (i // cols) * (cell_h + 18)
        sheet.paste(im.resize((width, cell_h), Image.LANCZOS), (x, y + 18))
        draw.text((x + 4, y + 3), label, fill=(255, 240, 120))
    return sheet


def step(a: np.ndarray, b: np.ndarray) -> float:
    """How far two frames are apart: the mean difference of their brightness, 0 to 255."""
    return float(np.abs(luma(a)[::2, ::2].astype(np.int16) - luma(b)[::2, ::2].astype(np.int16)).mean())


def exact(shot: Shot) -> bool:
    """Is the first frame the decoder gives for a shot the frame of that number? The slow way to
    the same frame, counting from the start of the file, is the judge."""
    film = FILMS[shot.film]
    x, y, w, h = shot.window
    pick = f"select=eq(n\\,{shot.first})"
    slow = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(MEDIA / film.path), "-an",
            "-vf", f"{pick},crop={w}:{h}:{x}:{y},scale={W}:{H}:flags=lanczos,setsar=1",
            "-fps_mode", "passthrough", "-frames:v", "1", "-pix_fmt", "yuv420p", "-f", "rawvideo", "-",
        ],
        capture_output=True,
    ).stdout
    fast = next(source(film, [shot.first], shot.window))
    return len(slow) == FRAME_BYTES and bool((np.frombuffer(slow, np.uint8) == fast).all())


# Where burned-in text sits in these films: subtitles at the bottom centre, lyrics at the top centre.
BANDS = {"top": (360, 0, 1560, 150), "bottom": (360, 660, 1560, 810)}
# Frames in a row that the same pixels stay white before held_white names the stretch.
HELD = 6


def held_white(frames: dict[int, np.ndarray], shown: list[int], box: Window) -> list[tuple[int, int]]:
    """The stretches of a shot where the same pixels of a text band stay white for HELD frames or
    more. A subtitle does that over a moving picture (a short one is a few hundred pixels, which
    the half second sheets can miss). So does a bright part of a picture that stands still: every
    stretch named here has to be read in the band sheets, where the frames it names are added."""
    x0, y0, x1, y1 = box
    masks = [luma(frames[n])[y0:y1, x0:x1] > 215 for n in shown]
    runs: list[list[int]] = []
    for k in range(len(masks) - HELD + 1):
        if int(np.logical_and.reduce(masks[k : k + HELD]).sum()) < 60:
            continue
        if runs and shown[k] <= runs[-1][1] + 1:
            runs[-1][1] = shown[k + HELD - 1]
        else:
            runs.append([shown[k], shown[k + HELD - 1]])
    return [(a, b) for a, b in runs]


def spans(runs: list[tuple[int, int]]) -> str:
    return ", ".join(f"f{a} to f{b}" for a, b in runs) or "none"


def check() -> None:
    """For every shot: its edges (with the frames just outside it), a frame every half second, and
    the two text bands of those frames at full size. Read them all before trusting a cut. The
    numbers it prints: the white in the bottom band, the stretches where white holds still in a
    text band (see held_white), frames whose first or last row is dark (a bar left by a crop), the
    largest step between two frames inside the shot (a cut, a flash or a damaged frame stands out),
    and the repeated frames."""
    out = WORK / "check"
    out.mkdir(parents=True, exist_ok=True)
    for i, shot in enumerate(SHOTS):
        film = FILMS[shot.film]
        before = min(3, shot.first)
        numbers = list(range(shot.first - before, shot.end + 3))
        frames = dict(zip(numbers, source(film, numbers, shot.window)))
        shown = shot.shown
        held = {name: held_white(frames, shown, box) for name, box in BANDS.items()}

        def label(n: int) -> str:
            return f"{shot.film} f{n} {n / film.rate:.2f}s"

        edges = (
            [(f"OUT {label(n)}", rgb(frames[n])) for n in numbers[:before]]
            + [(f"in {label(n)}", rgb(frames[n])) for n in shown[:3]]
            + [(f"in {label(n)}", rgb(frames[n])) for n in shown[-3:]]
            + [(f"OUT {label(n)}", rgb(frames[n])) for n in numbers[-3:]]
        )
        tile(edges, 3, 640).save(out / f"shot-{i + 1:02d}-edges.jpg", quality=88)
        picks = sorted({*shown[:: FPS // 2], shown[-1]})
        tile([(label(n), rgb(frames[n])) for n in picks], 3, 640).save(out / f"shot-{i + 1:02d}-run.jpg", quality=88)
        for name, box in BANDS.items():
            # With the first and the middle frame of every stretch where white held still.
            extra = {n for a, b in held[name] for n in (a, (a + b) // 2)}
            rows = sorted({*picks, *extra})
            strips = [(label(n), rgb(frames[n]).crop(box)) for n in rows]
            tile(strips, 1, box[2] - box[0]).save(out / f"shot-{i + 1:02d}-{name}.jpg", quality=90)
        x0, y0, x1, y1 = BANDS["bottom"]
        white = [int((luma(frames[n])[y0:y1, x0:x1] > 225).sum()) for n in shown]
        dark = [n for n in shown if min(luma(frames[n])[0].mean(), luma(frames[n])[-1].mean()) < 24]
        steps = {b: step(frames[a], frames[b]) for a, b in zip(shown, shown[1:])}
        worst = max(steps, key=lambda n: steps[n])
        left_out = [n for n in range(shot.first, shot.end) if n not in shown]
        fresh = [n for n in left_out if film.repeats and step(frames[n - 1], frames[n]) > 0.5]
        same = [n for n, d in steps.items() if d < 0.05]
        print(
            f"shot {i + 1:02d} {shot.film} f{shot.first} to f{shot.end}: {shot.frames} frames shown; "
            f"decoder exact: {exact(shot)}; white {min(white)} to {max(white)}; "
            f"white held still, bottom: {spans(held['bottom'])}, top: {spans(held['top'])}; "
            f"dark edge rows: {len(dark)}; "
            f"largest step {steps[worst]:.1f} at f{worst} (median {float(np.median(list(steps.values()))):.1f}); "
            f"left out {len(left_out)}, of them not repeats: {fresh}; shown but equal to the one before: {same}"
        )
    print(f"{total_frames()} frames, {total_frames() / FPS:.2f} s. Sheets in {out}")


def sheet() -> None:
    """A frame every half second of the built files, the frames of the loop's seam, and numbers:
    dark first or last rows (a bar left by a crop), and the step from the last frame back to the
    first against the step from the first to the second (neighbours of one shot differ little)."""
    out = WORK / "sheet"
    out.mkdir(parents=True, exist_ok=True)
    for name, w, h, _ in SIZES:
        pipe = subprocess.Popen(
            [
                "ffmpeg", "-v", "error", "-i", str(OUT_DIR / name), "-vf", f"scale={W}:{H}:flags=lanczos",
                "-fps_mode", "passthrough", "-pix_fmt", "yuv420p", "-f", "rawvideo", "-",
            ],
            stdout=subprocess.PIPE,
        )
        assert pipe.stdout is not None
        frames = []
        while len(raw := pipe.stdout.read(FRAME_BYTES)) == FRAME_BYTES:
            frames.append(np.frombuffer(raw, np.uint8))
        pipe.wait()
        n = len(frames)
        stem = Path(name).stem
        picks = [*range(0, n, 12), n - 1]
        for page, start in enumerate(range(0, len(picks), 24)):
            part = picks[start : start + 24]
            tile([(f"{k / FPS:.2f}s f{k}", rgb(frames[k])) for k in part], 4, 480).save(out / f"{stem}-{page + 1}.jpg", quality=88)
        seam = [*range(n - 30, n, 3), 0, 3]
        tile([(f"f{k}", rgb(frames[k])) for k in seam], 4, 480).save(out / f"{stem}-seam.jpg", quality=88)
        dark = [k for k, f in enumerate(frames) if min(luma(f)[0].mean(), luma(f)[-1].mean()) < 24]
        print(
            f"{name}: {n} frames ({w}x{h}), {n / FPS:.2f} s; dark first or last row in {len(dark)} frames; "
            f"step last to first {step(frames[-1], frames[0]):.2f}, first to second {step(frames[0], frames[1]):.2f}"
        )
    print(f"sheets in {out}")


def main() -> None:
    for film in FILMS.values():
        if not (MEDIA / film.path).exists():
            raise SystemExit(f"missing {MEDIA / film.path}")
    command = sys.argv[1] if len(sys.argv) > 1 else "build"
    {"build": build, "check": check, "sheet": sheet}[command]()


if __name__ == "__main__":
    main()
