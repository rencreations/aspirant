# About page files (`scripts/about/`)

Makes the About page's own files. Design: `docs/superpowers/specs/2026-11-15-about-page-redesign.md`. The addresses and the byte counts the page uses are in `apps/web/src/features/about/media.ts`.

| Script                 | Reads                                                                                           | Writes (committed)                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drone/build.cjs`      | `D:\ren\aspirant\3d\angela\drone.fbx`                                                           | `apps/web/public/models/about/drone.glb` (250,192 bytes) and `apps/web/public/img/about/drone.webp` (the still for a browser without WebGL)                                              |
| `tetra/build.cjs`      | `D:\ren\aspirant\3d\angela\tetra.fbx` and the walking and dancing clips of the 3D viewer        | `apps/web/public/models/about/tetra.glb` (see `tetra/README.md`)                                                                                                                         |
| `companions/build.cjs` | `D:\ren\aspirant\3d\guinevere\drone1.fbx` and `drone2.fbx` (the two are one mesh)               | `apps/web/public/models/about/companion.glb` (see `companions/README.md`)                                                                                                                |
| `mlabel/build.py`      | TheMLabel's mark (the owner's file) and five official films of the collection's mirror          | `apps/web/public/img/about/mlabel/logo.webp`, fifteen clips with their stills in `apps/web/public/video/about/mlabel/`, and the generated `apps/web/src/features/about/mlabel/assets.ts` |
| `start.py`             | the studio's film about the first Aspirant ideas (`...\layla-and-fanny\...\idea-bts\idea.webm`) | `apps/web/public/video/about/start-1920.mp4` (6,196,986 bytes), `start-1280.mp4` (3,482,943 bytes), `start-poster.webp`                                                                  |
| `arts.py`              | the key art of the first phase (source folder) and TheMLabel's mark (the owner's file)          | `apps/web/public/img/about/arts/the-aspirants-key-art.webp`, `apps/web/public/img/about/themlabel.webp`                                                                                  |

Never edit the outputs by hand: change the script and run it. The sources are read only. After a run, write the byte counts the script prints into `media.ts` (`DRONE_MODEL_BYTES`, `START_LARGE_BYTES`, `START_SMALL_BYTES`): the loading bar counts real bytes. If a file was ever published under its name, also bump the cache name in `apps/web/src/lib/media-store.ts`, or a returning visitor keeps the old one.

The drone, Tetra and Guinevere's two drones have their own READMEs: `drone/README.md`, `tetra/README.md` and `companions/README.md` (how to run, what the file keeps, the bones and their axes, the faces).

Everything else the page shows (the videos, the music, the comics and the art of the five phases) is the collection's own data and files: nothing is copied for it. The lists are in `apps/web/src/features/about/phase-media.ts`.

## How it started (`start.py`)

The muted loop that plays by itself on the first screen and in the big window it grows into. Until 16 Nov 2026 this was a reel cut from the trailers of the five phases (`reel.py`, gone). The owner then asked for the studio's own film about the first Aspirant ideas, as how the series started. The whole film (160 s, with sound, English subtitles in the picture) is the collection's own file and is what the play control opens. The loop is cut from it.

```
C:\Users\muham\anaconda3\python.exe scripts/about/start.py          # both sizes and the poster
C:\Users\muham\anaconda3\python.exe scripts/about/start.py sheet    # a sheet of the built loop, two frames a second
```

- **Shape.** The window is 1920 by 810 and the film 1920 by 1080, so the film is cropped to its middle band (`crop=1920:810:0:135`). That band holds none of the subtitles (they sit in the lowest eighth) and not the game's mark (top left).
- **Shots** (`SHOTS` in the script, seconds of the film, in its own order): the first drawing on the whiteboard and "NEW WORLD" (50.0 to 57.2), the mecha drawn on the board (128.25 to 131.0), the concept sheets (135.0 to 140.4), the first animation (142.0 to 143.4), the two characters in costume (148.3 to 150.2) and on the stage (152.0 to 153.7). Every stretch was read four frames a second for text: none shows. About 19.6 s.
- **Loop.** Plain cuts between the stretches (the film is a fast comedy and cuts the same way). The first 0.8 s is laid over the last, so the end dissolves into the start.
- **Encode.** H.264 high, yuv420p, 25 frames a second (the film's own rate), `-crf 25` with a cap of 2,600 and 1,500 kbit/s, a key frame every two seconds, faststart, no sound.

After a change to `SHOTS`: read the frames of the new stretch for subtitles, build, run `sheet` and read it, the seam last.

## The two pictures (`arts.py`)

```
C:\Users\muham\anaconda3\python.exe scripts/about/arts.py
```

The key art of the first phase is copied as WebP. TheMLabel's mark is made for a dark ground (bright silver letters) and the page is light: the script redraws the letters in ink, keeping the metal's shading from edge to face, and leaves the orange M as it is. To use the mark as it came, remove the `colourless` step in `logo()`.

## TheMLabel's close (`mlabel/build.py`)

The page ends on TheMLabel, made after the label's own ident (the owner's file `mlabel.mp4`, studied frame by frame; the beats are written at the top of `apps/web/src/features/about/mlabel/choreo.ts`). The script makes what that scene needs.

```
C:\Users\muham\anaconda3\python.exe scripts/about/mlabel/build.py          # everything
C:\Users\muham\anaconda3\python.exe scripts/about/mlabel/build.py logo     # the logo and the M only
C:\Users\muham\anaconda3\python.exe scripts/about/mlabel/build.py clips    # the footage only
C:\Users\muham\anaconda3\python.exe scripts/about/mlabel/build.py sheet    # a sheet of the built clips, seen through the M
```

- **The logo** is the owner's picture, trimmed and saved whole. The letters are found by the clear columns between them, so the page flies each one in by itself from one picture.
- **The M** is measured on the logo's own M and made symmetric, as on the plates of the ident. The window in the black, the plates and the last plate that becomes the logo's M all use that one shape.
- **The footage** is three short muted clips for each of the five plates, cut from the official films in the mirror (`D:\ren\aspirant-r2`), each graded toward the colour of its plate and cropped away from the bands where a film carries subtitles. Each was read through the M for text: none shows. The page picks one clip a plate on every visit.
- `assets.ts` is generated (shapes, boxes, addresses, byte counts) and `built.json` is the script's own record: never edit either. A file made again under the same name needs the cache name bump in `apps/web/src/lib/media-store.ts`.
