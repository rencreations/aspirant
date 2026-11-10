# Library pipeline (the Collection)

Builds the media and data behind `/collection` and its ten pages. Design: `docs/superpowers/specs/2026-11-04-collection-library-design.md`. Progress and decisions: `docs/superpowers/plans/2026-11-04-collection-library-progress.md`.

## The flow

```
D:\ren\aspirant  (read only)         scripts/library/<slug>/*.py          D:\ren\aspirant-r2  (local mirror)
media, audio, story/official   ->    one pipeline per collection    ->    library/v1/<slug>/...   (assets)
                                                                    ->    apps/web/public/data/library/<slug>.json (data, in the repo)

python scripts/library/r2.py sync    mirror  ->  R2 bucket "aspirant"  ->  https://s3.aspirant.cc/library/v1/...
```

- **All collection assets live in R2** (images, audio, video, captions, covers). The data files (small JSON) live in the repo and name assets by key.
- **The mirror is the same tree as the bucket.** `D:\ren\aspirant-r2\library\v1\arts\x\f.webp` is `https://s3.aspirant.cc/library/v1/arts/x/f.webp`. To replicate the bucket from the mirror, run `r2.py sync`. To rebuild the mirror from the bucket, run `r2.py restore`. `r2.py status` says whether they match.
- A **key** is a path relative to `library/v1/` with forward slashes, for example `arts/official/layla-splash/f.webp`. Data files store keys, never addresses. The site makes the address with `libUrl(key)` (`apps/web/src/lib/library.ts`).
- The site can read the mirror before anything is uploaded: `npx serve D:\ren\aspirant-r2 -l 3300 --cors`, and start the site with `NEXT_PUBLIC_LIBRARY_ORIGIN=http://localhost:3300`.

## Rules for every pipeline

1. Run with `C:/Users/muham/anaconda3/python.exe` (Pillow, numpy), without `-I` (the scripts import `common` from this folder: add `sys.path.insert(0, str(Path(__file__).resolve().parents[1]))` in a subfolder script). `ffmpeg` and `ffprobe` are on the PATH. No OpenCV, no imagehash: use numpy and Pillow.
2. **C: is nearly full. Scratch and outputs go on D:.** `import common` sets TEMP and TMP to `D:\ren\aspirant-work\tmp`. Put scratch files in `D:\ren\aspirant-work\<slug>\`. Keep no big files in the repo.
3. **Read only on the source.** Never write in `D:\ren\aspirant`. Outputs go to the mirror (`common.key_path(key)`) and to `public/data/library/<slug>.json` (`common.write_json`).
4. **Idempotent.** Skip work whose output is fresh (`common.fresh`). A re-run must be cheap and must not change a key's content for no reason.
5. **Text rules.** Every string in a data file passes `common.write_json` (it fails on dashes and banned words) and `node scripts/qa/scan-text.mjs apps/web/public/data` (0 problems). No em or en dashes. "Aspirant power". Spell Terrinia, Selrick, Storm Citadel. The live-action video is "the live-action parody": never write its on-screen academy name.
6. **Truth and labels.** Each item has `canon`: `official`, `fan` (fan art, fan comics, fan videos, cosplay, edits, gameplay) or `non-canon` (the live-action parody). Fan items carry a `credit`. See `D:\ren\aspirant\CLAUDE.md`, "Truth hierarchy".
7. **Quality.** Art: full size WebP up to 3840 on the long side at quality 90 (`common.image_set`). Never upscale. Video: H.264 High, yuv420p, `-movflags +faststart`, AAC, at most 1080p unless the source is wider (2560x1080 stays). Audio: AAC m4a for music, the original FLAC beside it for voice lines.
8. **Item shape.** Each collection file is `{ "v": 1, "slug": "<slug>", "items": [...] , ... }`. Items extend `ItemBase` in `apps/web/src/features/library/types.ts` (id, title, collection, chars, pair, canon, tags, credit). Character slugs: fanny, layla, ruby, angela, lesley, change, guinevere, vexana, obsidia, selena. Pair ids: fanny-layla, ruby-angela, lesley-change, guinevere-vexana, selena-obsidia.
9. **Validation.** Each pipeline ends by printing counts, the bytes written to the mirror, and any source file it left out with the reason. A file that no pipeline maps goes in `scripts/library/ignored.json` with a reason.
10. Never print or store a secret. R2 credentials stay in `~/.config/aspirant/r2-scoped.env` (outside the repo) and only `r2.py` reads them.

## Files

| File           | What                                                               |
| -------------- | ------------------------------------------------------------------ |
| `common.py`    | paths, keys, text rules, `image_set`, `ffprobe`, `write_json`      |
| `r2.py`        | `sync`, `status`, `restore` between the mirror and the bucket      |
| `<slug>/`      | one folder per collection, owned by whoever builds that collection |
| `ignored.json` | source files that are deliberately not shipped, with the reason    |
| `.cache/`      | per pipeline caches (git ignored)                                  |

## Rooms rebuilt on 10 Nov 2026

| Folder            | What                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video_films/`    | The ten Films, encoded once at full size (H.264, CRF 18), posters, backdrops and captions into `video/films/<id>/`; writes `video-films.json`                 |
| `films/`          | Others: a fresh scan of every non-footage video, reusing what is in the mirror, writes `video-others.json` (the old Films pipeline; `catalog.py`, `reuse.py`) |
| `music/discs.py`  | The nine disc faces (`music/discs/*.webp`) and the loudness line (`wave`) of each track, run by `music/build.py`                                              |
| `covers.py video` | The Video cover and its two halves (`covers/video.webp`, `video-films.webp`, `video-others.webp`)                                                             |

Video has two data files, `video-films.json` and `video-others.json`; `build_index.py` reads both into the Video count and `index.json` `rooms`. See `docs/design/collection-rooms.md`.
