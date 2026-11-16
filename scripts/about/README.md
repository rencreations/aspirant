# About page files (`scripts/about/`)

Makes the About page's own files. Design: `docs/superpowers/specs/2026-11-15-about-page-redesign.md`. The addresses and the byte counts the page uses are in `apps/web/src/features/about/media.ts`.

| Script            | Reads                                            | Writes (committed)                                                                                                                          |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `drone/build.cjs` | `D:\ren\aspirant\3d\angela\drone.fbx`            | `apps/web/public/models/about/drone.glb` (250,192 bytes) and `apps/web/public/img/about/drone.webp` (the still for a browser without WebGL) |
| `reel.py`         | six official films under `D:\ren\aspirant\media` | `apps/web/public/video/about/reel-1920.mp4` (8,460,783 bytes), `reel-1280.mp4` (4,795,108 bytes), `reel-poster.webp`                        |

Never edit the outputs by hand: change the script and run it. The sources are read only. After a run, write the byte counts the script prints into `media.ts` (`DRONE_MODEL_BYTES`, `REEL_LARGE_BYTES`, `REEL_SMALL_BYTES`): the loading bar counts real bytes. If a file was ever published under its name, also bump the cache name in `apps/web/src/lib/media-store.ts`, or a returning visitor keeps the old one.

The drone has its own README: `drone/README.md` (how to run, what the file keeps, the bones and their axes, the face atlas, the still).

## The reel (`reel.py`)

A muted loop of 29.44 s cut from the official phase trailers, in release order, for the first screen of the page: small beside the description, then the big window. No subtitle, no lyric, no logo and no end card is in any frame. The end dissolves into the first shot, so the loop has no seam.

```
C:\Users\muham\anaconda3\python.exe -I scripts/about/reel.py          # build (about two minutes)
C:\Users\muham\anaconda3\python.exe -I scripts/about/reel.py check    # sheets of every shot, to read
C:\Users\muham\anaconda3\python.exe -I scripts/about/reel.py sheet    # sheets of the built files
```

The anaconda Python (Pillow, numpy) and ffmpeg on the PATH. `ABOUT_MEDIA` names another source folder, `ABOUT_WORK` another work folder (default `aspirant-about-reel` in the temp folder; the lossless master and the sheets go there).

### The output

| File               | Size                                                            | Rate         | Bytes     |
| ------------------ | --------------------------------------------------------------- | ------------ | --------- |
| `reel-1920.mp4`    | 1920 by 810                                                     | 2,300 kbit/s | 8,460,783 |
| `reel-1280.mp4`    | 1280 by 540                                                     | 1,300 kbit/s | 4,795,108 |
| `reel-poster.webp` | 1920 by 810, the first frame of the large file, WebP quality 80 |              | 45,980    |

Both films: H.264 high profile, yuv420p, 25 frames a second, 736 frames, a key frame at least every two seconds, faststart, no sound track, tagged BT.709 limited range. The page plays the small one below a display width of 700 px (`REEL_SMALL_BELOW`) and the large one everywhere else.

The whole file is waited for by the loading screen, so the size is set, not left to a quality number: two encoder passes hit the rate of `SIZES`, and the sizes are known before the encode (frames / 25 x rate / 8). The aim was 7 to 9 MB and 4 to 5 MB.

### The shape

1920 by 810 is 2.37 to 1, the trailers' own shape and `REEL_ASPECT` of the page.

| Film                                        | File                                      | Picture         | Window                                                              |
| ------------------------------------------- | ----------------------------------------- | --------------- | ------------------------------------------------------------------- |
| Go For It! Aspirants!                       | 1920 by 1080, 24 fps, bars baked in       | rows 130 to 950 | `1920:810` at `0:135` (5 rows inside each bar)                      |
| Awakening, Rekindled Light, Connection Lost | 2560 by 1080, 25 fps                      | whole           | whole, scaled to 1920                                               |
| Day of Enders                               | 1920 by 1080, 24 fps, bars baked in       | rows 136 to 944 | `1916:808` at `2:136` (2 columns a side given up to keep the shape) |
| The Queen's Endgame                         | 1920 by 1080, 30 fps, a full 16:9 picture | whole           | `1920:810` at `0:100`, set on Obsidia's face                        |

### The frame rate

One rate, 25 frames a second: three of the six films are 25, and the others are brought to it without showing a frame twice or leaving one out, so a pan never stutters.

- The 24 fps films play every frame at 25: 4 percent faster. With no sound nothing gives it away.
- "Rekindled Light" is a 24 fps film in a 25 fps file. Frames 1, 26, 51 and so on repeat the frame before: they are left out (`check` proves it on every run).
- "The Queen's Endgame" is 30 fps. Every frame is shown at 25, so the shot runs at five sixths of its speed. It is a slow gesture and reads as one. Leaving out every sixth frame would keep the speed and stutter.

CLAUDE.md asks for 60 fps for a video that plays beside the stage. No source of these films has more than 30 frames a second, and made-up frames would smear the line art, so the reel stays at the films' own rate, as the Design room's hero does.

### The cut

Twelve shots. Frame numbers are of the source file (frame 0 is its first), so a bound is exact; seconds are frame / the file's rate. Shots of one phase meet in a plain cut. Phases meet in a dissolve of 15 frames (0.6 s), and the last shot dissolves into the first over 25 frames (1 s). The file begins on the frame after that dissolve.

| #   | Film                  | Frames       | Seconds in the film | Shot                                                   | Why these bounds                                                                                                                                                                                                                                       |
| --- | --------------------- | ------------ | ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Go For It! Aspirants! | 381 to 463   | 15.88 to 19.29      | The skyline, night to sunrise                          | A slow push with no cut. The film's own dissolve to the next scene begins at 463.                                                                                                                                                                      |
| 2   | Go For It! Aspirants! | 1366 to 1406 | 56.92 to 58.58      | Layla on the roof                                      | Cut to cut.                                                                                                                                                                                                                                            |
| 3   | Go For It! Aspirants! | 2036 to 2126 | 84.83 to 88.58      | Fanny close, a whip pan, Layla close                   | Cut to cut: the pan is the film's own.                                                                                                                                                                                                                 |
| 4   | Awakening             | 0 to 94      | 0.00 to 3.76        | The city and the airship                               | The film's first shot, whole.                                                                                                                                                                                                                          |
| 5   | Awakening             | 1668 to 1756 | 66.72 to 70.24      | Ruby and Angela in the meadow                          | The film pulls back fast from a close-up of Angela's hand. At 1668 both are in the picture and the pull is easing to a stop (it rests by 1677). The out is the cut.                                                                                    |
| 6   | Rekindled Light       | 31 to 104    | 1.24 to 4.16        | The city by night                                      | Cut to cut.                                                                                                                                                                                                                                            |
| 7   | Rekindled Light       | 477 to 546   | 19.08 to 21.84      | Lesley, Chang'e and the robot                          | In at the fastest frame of the film's own whip pan from the photo on the desk to the three (476 repeats 475), so the shot arrives moving and settles. The film's own dissolve to the wider view of the room is kept. The out is the cut.               |
| 8   | Rekindled Light       | 935 to 992   | 37.40 to 39.68      | Lesley close                                           | In after the film's dissolve has cleared. Frame 992 is the first of a glitch effect that tears the picture.                                                                                                                                            |
| 9   | Connection Lost       | 444 to 493   | 17.76 to 19.72      | Guinevere                                              | Cut to cut, **in a window of its own**: see below.                                                                                                                                                                                                     |
| 10  | Connection Lost       | 493 to 536   | 19.72 to 21.44      | Vexana                                                 | Cut to cut.                                                                                                                                                                                                                                            |
| 11  | Day of Enders         | 280 to 363   | 11.67 to 15.13      | Selena on the bridge, then the city under the red star | Two shots of the film with its own cut at 316. Cut to cut.                                                                                                                                                                                             |
| 12  | The Queen's Endgame   | 1178 to 1238 | 39.27 to 41.27      | Obsidia and the black sun                              | A plain cut from shot 11: both are phase V, and a dissolve would leave Obsidia under a second of clear picture. In once the debris of the film's wipe has left the picture. Out before the orb floods the picture with white: a loop should not flash. |

All five phases are there, in order, and all ten Aspirants are seen: Layla and Fanny (2, 3), Ruby and Angela (5), Lesley and Chang'e (7, 8), Guinevere (9), Vexana (10), Selena (11) and Obsidia (12). Obsidia comes from her own film, "The Queen's Endgame", the one source that is not a phase trailer.

**Burned-in text.** The films of phases I to III carry none. "Connection Lost", "Day of Enders" and "The Queen's Endgame" have English subtitles in the picture, at the bottom centre in the lowest tenth of it, and "Connection Lost" has lyrics at the top centre from about 128 s.

- Shot 9: the subtitle "No..." is on frames 452 to 464, its letters in rows 992 to 1025 of the 1080. This is the one calm look at Guinevere before the fight (the other clean shots of her alone are half a second long or in the middle of a blow), so the shot keeps its frames and loses its lowest rows: the window is `2294:968` at `133:0`, which ends 24 rows above the letters and is 12 percent closer. The film is 2560 wide, so nothing is enlarged.
- Shot 10 and shot 11 have no subtitle on any frame.
- Shot 12: the subtitles of the 16:9 film sit below the window (which ends at row 910), and no line is spoken during the shot: the next one starts nearly three seconds after it ends.

**How it was checked.** `check` writes, for every shot, the three frames before it, its first and last three, the three after it, a frame every half second, and the top and bottom text bands of those frames at full size. It also prints, for every shot, each stretch where the same pixels of a text band stay white for six frames or more (a short subtitle is a few hundred pixels and the half second sheets can miss it: this is how "No..." was found), the frames with a dark first or last row (a bar left by a crop: none), the largest step between two frames (a cut, a flash or a torn frame), and whether the decoder gave the very frame asked for. A stretch it names is not always text: a white glove, a bright sky and a lamp hold still too. Every named stretch has to be read in the band sheets. After any change to `SHOTS`: run `check`, read the sheets, then build, run `sheet` and read those, the seam last (`reel-1920-seam.jpg`: the last 30 frames, then frames 0 and 3).

### How it is put together

- Frames go from the decoder to the encoder as raw yuv420p on pipes, through numpy only for the dissolves (a mean of the planes), so no colour is converted on the way. Step k of a dissolve of n frames is k + 1 parts of n + 1: never wholly one picture or the other.
- The loop: the frames of the dissolve that brings a shot in are written with the shot before it. For the first shot that is the last one, so the file ends on the dissolve and begins on the first shot's frame 25. The last frame and the first are neighbours of one dissolve.
- The whole loop is first written without loss (`master.mkv`, FFV1), and both sizes and both passes read that file.
- Each output is written beside its target and then moved over it, so the dev server never serves half a file.
