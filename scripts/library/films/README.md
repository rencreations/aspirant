# Films room pipeline

Builds the media and the data of `/collection/films`.

```
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py all     # encodes, posters, captions, films.json
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py media   # only the files in the mirror
C:/Users/muham/anaconda3/python.exe scripts/library/films/build.py data    # only apps/web/public/data/library/films.json
```

- `catalog.py`: every film (title, kind, pair, characters, description, plan) and the drama. A film has a plan: `encode` (H.264 High, CRF 24, CRF 27 for the 28 minute match), `copy` (the source is already H.264 and is only remuxed with `faststart`) or `local` (the site already ships the same film in `apps/web/public/video`, so nothing is encoded or uploaded).
- `chapters.py`: hand written scene captions for the films that have a `footages/manifest.json`. The other films fall back to a shortened note.
- `build.py`: runs at most three encodes at once, writes to the mirror (`films/<id>/video.mp4`, `poster/{t,p,f}.webp`, `en.vtt`) and is idempotent: a file that exists and has the right length is kept. To redo a film, delete its `video.mp4`. To change a poster, set `poster_t` in the catalog and delete `D:\ren\aspirant-work\films\posters\<id>.*`.
- Film ids are `film-` plus the slug of the path under `media/`, so the scene stills of the Arts room can link to `?i=<id>&t=<seconds>`. The drama films posted under a second or third id carry those ids in `also`.
- Nothing is written in the source library. Skipped sources are merged into `scripts/library/ignored.json`.
