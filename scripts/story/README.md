# Story pipeline (`scripts/story/`)

Turns the novel (`D:\ren\aspirant\story\main.md`) and the originals in `D:\ren\aspirant\media` into the data and media of the story pages. Design: `docs/superpowers/specs/2026-11-03-story-visual-reader-design.md` (read it first, it defines the visual script and the curation rules).

Use the anaconda Python (Pillow, numpy): `C:\Users\muham\anaconda3\python.exe`. ffmpeg and ffprobe must be on the PATH. Run the scripts from this folder without `-I` (they import each other).

| File               | What it does                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `storytext.py`     | Parses `main.md`. `python storytext.py c05` prints chapter 5 with its paragraph numbers.                   |
| `visuals.py`       | Validates `visuals/cNN.json` against the text and the files. `python visuals.py c05` or no argument (all). |
| `visuals/cNN.json` | The visual script of a chapter (`c00` is the prologue).                                                    |
| `tools/*.py`       | Looking tools, see below. They write previews to `%TEMP%\aspirant-story-tools` and print the path.         |
| `hero.py`          | The landing page's hero film (older, see the handoff).                                                     |

## Looking tools

All paths are relative to the media root `D:\ren\aspirant\media` (or absolute).

```
python tools/dirsheet.py "_others/places" --cols 5 --cell 300        # every image of a folder, with names and sizes
python tools/sheet.py "<video>" --n 12 [--start 0 --end 8]            # contact sheet of a video, times on each frame
python tools/frame.py "<video>" 3.2 [--crop X Y W H]                  # one frame, full size
python tools/strip.py "<comic page>" [--slice 1300]                    # slices of a tall comic strip, with source y ranges
python tools/crop.py "<image>" X Y W H                                 # preview of a crop box (source pixels)
python tools/probe.py "<file>" ...                                     # size, duration, fps
```

Open the printed PNG or JPEG with the Read tool to see it.

## Where the sources are

- The two official comics, as tall strips about 1000 px wide: `layla-and-fanny/art/comic/official-aspirant-comic/1.jpg` to `43.jpg` (the Layla and Fanny story) and `vexana-and-guinevere/art/comic/1.jpg` to `45.jpg` (Guinevere and Vexana; some numbers are missing). Crop panels with `[x, y, w, h]` in source pixels.
- Official films and their scene cuts: every video folder under `*/video/**` has the full film and, in `footages/<time range>/footage.mp4`, one clip per scene (1920x1080, with sound). `footages/manifest.json` has a one-line note for each cut; the folder's `readme.txt` describes the film scene by scene (the author's description, with the on-screen text). Times in a visual script are seconds into the file you name (a `footage.mp4` starts at 0).
- Films worth knowing: `selena-and-obsidia/video/trailer`, `selena-and-obsidia/video/selena`, `.../obsidia`, `layla-and-fanny/video/official/lore/{trailer,teaser}`, `lesley-and-change/video/official/{trailer,teaser,short-trailer}`, `ruby-and-angela/video/{trailer,ruby,angela}`, `vexana-and-guinevere/video/{connection-lost,relink,comic}`, `vexana-and-guinevere/video/interactive-drama/footages/<episode>`.
- Official art: `*/art/official`, `*/art/lore`, `_others/places` (14 establishing pictures: Terrinia, Selrick Academy, Storm Citadel, Planet Dawnbreak, Planet Oro, the Garden, the Laboratory, the Council, the training fields, the Energy System, the universe), `_others/character` (Joe, Tetra, Ruby's father, Oro soldiers, androids, droids, Combat and Support Division trainees, the Enders).
- Official promotional posts: `*/promotional/**` and `_others/promotional/**` (each folder has a `readme.txt` with the caption). Use only when the caption shows the post is official art or a scene.
- Files already on the site (no processing, use `"type": "site"`): `apps/web/public/img/char/<slug>/{splash,splash-sm,cutout}.webp`, `img/comic/...`, `img/portal/...`, `img/hero-stills/...`, `img/stills/...`.
- Which official source each scene of the book comes from: `D:\ren\aspirant\story\main-build\source-log.md` (a table with a row per scene: chapter, scene, what the text says, the source file and line or timestamp). Start there. The chapter text itself: `python storytext.py cNN`.

## Not to use

Fan art, cosplay, `fanmade`, `_edits`, `_gameplay`, `in-game-animation`, `live-action` (a non-canon parody), `_backup*`. The validator rejects them. Avoid frames with burned-in subtitles, watermarks and black bars (crop them out, or pick another frame).

## Output of a curation pass

One `visuals/cNN.json` per chapter, passing `python visuals.py cNN` with no errors and as few warnings as possible. Look at every picture you choose (a crop or a frame) before you choose it.
