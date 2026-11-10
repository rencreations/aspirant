# Others room pipeline (Video, Others)

Builds the data and the small media of `/collection/video/others`. The folder keeps the name `films` because the
mirror keys of the first Films room (`films/<id>/video.mp4`, `poster/`, `en.vtt`) live under that name and stay.

```
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py scan    # every video found, where it went, what was left out
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py media   # posters, strips, captions (encodes only a video that is missing)
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py data    # only apps/web/public/data/library/video-others.json
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py all     # all three
C:/Users/muham/anaconda3/python.exe scripts/library/build_index.py          # afterwards: index.json and search.json
```

- **The scan** walks `D:\ren\aspirant\media` for mp4, webm, mov, mkv, m4v and avi, skips every `footage` or `footages`
  folder and `_others/in-game-animation` (the source of the Animation room), and puts each file in exactly one bucket:
  a Film (the ten ids in `features/library/video/links.ts`, read from that file), a catalog item, a drama episode
  (13 entries, the second and third ids of an episode set are carried in `also`), a file another room already
  encodes, an alias of one of those, or a file in `ignored.json` (left out, with the reason). A video that no bucket
  takes stops the script, so a new file is never lost quietly. The table is written to
  `D:\ren\aspirant-work\films\others-scan.txt`.
- `catalog.py`: the videos only this room encodes (title, kind, pair, characters, description, plan) and the drama. A
  plan is `encode` (H.264 High, yuv420p, faststart, AAC, the source's own size), `copy` (already H.264, remuxed with
  `faststart`) or `local` (the site already ships the file in `apps/web/public/video`). `ROWS` is the list of shelves
  and must match `SHELVES` in `features/library/video/others/video-data.ts` (a unit test reads both).
- `reuse.py`: the promo reels (Design), the emotes and gameplay clips (the Others collection) and the official edits
  and fan videos (Fanart) are already encoded and in the mirror. The room points at those keys and takes the credit
  and the canon label from the owning room's data file. Nothing is encoded or uploaded twice.
- `chapters.py`: hand written scene captions for the films that have a `footages/manifest.json`.
- `build.py` also makes, for every video, a poster (`poster/{t,p,f}.webp`, black bars cut) and a strip
  (`video/others/<id>/strip.webp`, eight frames side by side, 400 px on the long side, for the hover preview). Old
  posters stay at `films/<id>/poster`, new ones go to `video/others/<id>/poster`. Captions are `films/<id>/en.vtt`.
- Ids are `film-` plus the slug of the path under `media/`, so links already in the site (the scene stills of the
  Arts room, the library search) still resolve, and no id is used by two collections.
- Idempotent: a video, poster, strip or caption already in the mirror is kept. To redo a poster, delete its files and
  `D:\ren\aspirant-work\films\posters\<id>.*`. To redo a strip, delete `strip.webp`.
- Nothing is written in the source library. Skipped sources are merged into `scripts/library/ignored.json`.
