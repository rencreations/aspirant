# Films room pipeline (Video, Films)

Builds the ten official films of `/collection/video/films` and `apps/web/public/data/library/video-films.json`.

```
C:/Users/muham/anaconda3/python.exe scripts/library/video_films/build.py        # the mirror and the data
C:/Users/muham/anaconda3/python.exe scripts/library/video_films/build.py data   # only the data file
C:/Users/muham/anaconda3/python.exe scripts/library/build_index.py              # then the counts and the search
```

- `FILMS` in `build.py` is the list, in the owner's order: the source folder under `D:\ren\aspirant\media`, the file, the thumbnail, the English subtitles, a crop for black bars, the title (the official one on the thumbnail), the kind, the characters, the words. The ids must equal `FILM_IDS` in `apps/web/src/features/library/video/links.ts` (the script checks).
- One version, full quality, never scaled down. A source that is already H.264 High, yuv420p, AAC (the three Ruby and Angela films) is remuxed with `faststart`. The VP9 and AV1 sources are encoded to H.264 High at their own size and frame rate, CRF 18, preset slow, a keyframe every 2 s, AAC 192k. Day of Enders and Go For It! Aspirants! have black bars inside the 1080 frame: they are cut (1920x808 and 1920x820).
- Outputs in the mirror, `video/films/<id>/`: `video.mp4`, `poster.webp` (the thumbnail at its own size, 1280 wide), `thumb.webp` (480), `backdrop.webp` (a small blurred poster), `en.vtt` (five films).
- Idempotent: an output newer than its source and made with the same settings is kept (`D:\ren\aspirant-work\video_films\state`). To make a film again, delete its `video.mp4`. Changing `SETTINGS` makes every encode again.
- A date is written only where the source is an Instagram post (its id holds the time of the post).
