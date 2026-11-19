# Home page media (workstream D)

The small media and the data files of the home page, made by repeatable scripts. The notes (what each file is, the numbers, what was checked) are in `docs/design/home/media.md`. Read that first.

Run with the anaconda Python, **without `-I`** (the scripts import `hcommon.py` and `scripts/library/common.py`), from the repository root. `ffmpeg` and `ffprobe` must be on the PATH. Work files and the looking sheets go to `D:\ren\aspirant-work\home\D\` (set `ASPIRANT_HOME_WORK` to change it). Sources in `D:\ren\aspirant` and the mirror `D:\ren\aspirant-r2` are read only. Nothing is uploaded and no R2 key is written. Every script is idempotent: it rewrites the same output.

| Script                           | Reads                                                             | Writes                                                                                        |
| -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `cards.py`                       | `media/_all/splash-art/{cropped,normal}`                          | `public/img/home/cards/<slug>-45.webp` (10, 960x1200)                                         |
| `hero_cards.py [--sheet]`        | the Game art stills of the library data and the mirror            | `public/img/home/cards/<slug>-b-45.webp` (8, 640x800), `public/data/home/hero-cards.json`     |
| `logo.py [file]`                 | `C:\Users\muham\Downloads\mlbb.png`                               | `public/img/home/mlbb.webp` (lossless, checked pixel for pixel)                               |
| `previews.py [--sheet] [--scan]` | the ten films in the mirror                                       | `public/video/home/preview/v2/<film-id>.mp4` (1280 wide, the film's own shape) and `.webp`    |
| `loops.py [--sheet]`             | `media/_all/webmedia/*.mov`, `public/video/obsidia/1080/idle.mp4` | `public/video/home/loops/<slug>.mp4`, `public/img/home/loops/<slug>-45.webp` and `-full.webp` |
| `voices.py`                      | `public/data/library/voicelines*.json`, the mirror                | `public/data/home/voices.json`                                                                |
| `picks.py [--sheet]`             | the library data, the mirror, the files above                     | `public/data/home/picks.json`                                                                 |
| `test_media.py`                  | all of the above                                                  | none (`python -m unittest test_media`, from this folder)                                      |

Order: `cards`, `hero_cards`, `logo`, `previews`, `loops`, `voices`, then `picks` (it reads what the others wrote and stops when a file is missing), then the tests.

The voice gain is in `scripts/library/voicelines/`: `loudness.py` (measures every clip, caches in `loudness.json`, holds the formula), `build.py` (writes `g` into the data, new step `add_gains`) and `verify_gain.cjs` (checks the result through a copy of the real audio graph in Chrome).

## Where to change what

- A different hero card crop: `CUT_CENTRE` and `CARD_SIZE` in `cards.py`; for the eight official stills that make the other cards, `CUTS` in `hero_cards.py` (the still, where the character is).
- The trailer is no longer cut here: the strip streams the library's whole film (round two). Its rest moment is `TRAILER_START` in `picks.py` (and `TRAILER_FILM.start` in `fx/video-plane/data.ts`, kept equal by a test), the seconds the bar waits for are `TRAILER_WARM_SECONDS`.
- A different preview window: `STARTS` in `previews.py` (the film's second where the clip starts). Run `previews.py --scan` and look at `windows-sheet.jpg`: the clips are the whole picture, so a burned in subtitle in the window shows. Quality is `CRF` (21) and `OUT_W` (1280).
- A different loop window or quality: `LOOPS` in `loops.py` (crop box in source pixels, CRF). The window must be 4:5.
- The owner's voice lines: `WANTED` in `voices.py`.
- The target loudness: `TARGET_LUFS` and `CEIL_DBTP` in `loudness.py`, then `build.py`, then `verify_gain.cjs`. The voice bus lift is `VOICE_BUS_GAIN` in `apps/web/src/lib/voice-gain.ts` (the pipeline and the player must agree).
- The wall order: `wall_order` in `picks.py` (seeded, so it is the same every run).

## Cache

A file written under a new address needs nothing. A file replaced under the same address (a re-cut loop, for example) needs the cache name bump in `apps/web/src/lib/media-store.ts`.
