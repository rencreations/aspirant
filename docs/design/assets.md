# Asset pipeline and outputs

The originals live in `D:\ren\aspirant` (override with `ASPIRANT_SRC`). They are read only and never copied wholesale. The pipeline in `scripts/assets/` writes optimised, committed outputs to `apps/web/public/` and a manifest at `apps/web/public/data/manifest.json`.

Result of the last full run: 685 listed assets, 365 MB for the whole `public/` folder (budget 450 MB), largest single file 29.5 MB (budget 40 MB per file), no Git LFS.

## Re-running

```
pnpm assets                                   # same as: node scripts/assets/build.mjs
node scripts/assets/build.mjs --only=images,comics,video,audio,models,portal
node scripts/assets/build.mjs --only=video --force            # ignore the freshness check
node scripts/assets/build.mjs --only=video -- --hero-candidates   # write contact sheets of trailer frames to the temp folder
```

- Idempotent: an output is skipped when it exists and is newer than its inputs (and, for GLB, the Blender scripts). `--force` redoes it.
- One build at a time: `scripts/assets/.cache/build.lock` stops a second run. (A first version of the pipeline was started twice by mistake, the two runs wrote the same temp file, and three videos came out corrupt. They were re-encoded and all 31 MP4 files were then fully decoded with `ffmpeg -f null` with zero errors.)
- Environment variables: `ASPIRANT_SRC` (originals), `ASSET_TMP` (scratch folder; default is the OS temp folder, never the repo), `BLENDER` (blender.exe), `DEPTH_PYTHON` (python of a venv with torch, transformers, pillow, numpy; without it portal depth falls back to a pseudo-depth), `--concurrency=N` (images, audio; default 3), `--vconcurrency=N` (video; default 2).
- Tools: `sharp` (root devDependency), `ffmpeg` and `ffprobe` on PATH, Blender 4.5 for models. Installing sharp with pnpm needed `--config.engine-strict=false` because the machine has Node 24.2 and some repo dependencies want 24.11 or newer.
- `scripts/assets/.cache/` holds per-stage records that `manifest.mjs` merges; it is git-ignored.
- Files: `build.mjs` (entry), `lib.mjs`, `images.mjs`, `comics.mjs`, `video.mjs`, `audio.mjs`, `models.mjs`, `portal.mjs`, `manifest.mjs`, `depth.py`, `blender/convert.py`, `blender/verify.py`.

## Conventions

- All paths in the manifest are relative to `public/` with no leading slash. In the app, go through `asset()`.
- Pair slugs are used everywhere: `fanny-layla`, `ruby-angela`, `lesley-change`, `guinevere-vexana` (source folder `vexana-and-guinevere`), `selena-obsidia`. Character slugs: fanny, layla, ruby, angela, lesley, change (Chang'e), guinevere, vexana, obsidia, selena.
- Names are ASCII. Numbers are two digits.
- WebP for images (alpha kept for cut-outs), AAC `.m4a` for audio, H.264 High MP4 for video.
- Text shipped in captions goes through `cleanText`: en and em dashes become " - " and the banned story wording is replaced (canon rules 2 and 3). The English SRT files contained none, so nothing changed.
- Every manifest entry has `id, kind, path, bytes` plus `width, height, durationSec, pair, slug, role, credit, color, source, notes` where they apply. The manifest also has `totals` (with `byCategory`), `skipped`, `notes` and `unlistedFiles` (files in `public/` that no stage produced, for example `data/story/*` written by the content scripts).

## Outputs

| Folder                                   | Contents                                                                                                                                  | Size    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `img/char/{slug}/`                       | `splash.webp` (2048 wide), `splash-sm.webp` (800 wide), `cutout.webp` (alpha, cropped to bounding box, at most 1800 tall), `extra-N.webp` | 7.4 MB  |
| `img/pair/{pair}/`                       | Shared art, 2048 wide                                                                                                                     | 1.1 MB  |
| `img/fanart/`                            | `{id}.webp` (fit in 1800x1800) and `{id}-sm.webp` (fit in 720x720), 29 pieces                                                             | 3.5 MB  |
| `img/comic/{aspirant,guinevere-vexana}/` | `NN.webp`, at most 1000 wide, q78                                                                                                         | 14.1 MB |
| `img/emote/{layla,fanny}/NN.webp`        | 512x512 RGBA, 8 each                                                                                                                      | 0.2 MB  |
| `img/portal/{id}/`                       | `base.webp`, `alt.webp`, `depth.webp`, `depth-alt.webp`, all 1100x1375                                                                    | 1.7 MB  |
| `img/stills/`                            | Two trailer frames, 1280 wide                                                                                                             | 0.1 MB  |
| `img/hero-stills/`                       | 16 trailer frames, 1280 wide, each under 65 KB                                                                                            | 0.5 MB  |
| `video/{pair}/`                          | `{name}.mp4`, `{name}.jpg` poster, `{name}.vtt` where captions exist                                                                      | 323 MB  |
| `audio/voice/{slug}/`                    | `NN.m4a` and `index.json`                                                                                                                 | 5.9 MB  |
| `audio/music/`                           | `we-believe`, `obsidia-aspirant`, `obsidia-solo` (`.m4a`, AAC 96 kbps stereo)                                                             | 5.0 MB  |
| `models/`                                | `layla.glb`, `fanny.glb`                                                                                                                  | 1.9 MB  |
| `data/`                                  | `manifest.json`, `comics.json`, `fanart.json`                                                                                             | small   |

### img/char

Existing files per slug:

- fanny: splash, splash-sm, cutout, extra-1 (flying pose, alpha)
- layla: splash, splash-sm, cutout
- ruby, angela, lesley, change: splash, splash-sm only (no transparent art exists for them)
- guinevere: splash, splash-sm, cutout
- vexana: splash, splash-sm, cutout, extra-1 (mobile wallpaper, 1440x3200, opaque)
- selena, obsidia: splash, splash-sm, cutout

Notes: the Fanny and Layla cut-outs are the transparent full splash compositions (3200x1800 after cropping), not single-figure crops. Layla's source still contains the ground, so her cut-out has a ground patch under it. The Vexana wallpaper carries the "Mobile Legends" logo at the bottom.

### img/pair

`fanny-layla/`: `fighting-together-splash-art`, `fanny-and-layla` (source is only 1000x563, kept at that size). `guinevere-vexana/`: `both-splash-art`, `fighting-moment`, `fighting-stance`. The other three pairs have no shared art in the source.

### Fan art

`data/fanart.json` (also embedded per asset in the manifest) lists, per piece: `id, character (fanny|layla|both), site, artist, title, url, urlConfidence, credit, color, file, fileSm, width, height, originalFile`.

- `urlConfidence`: `high` is the site's standard URL pattern; `medium` is rebuilt from a flattened file name where the exact form could not be checked (Reddit post ids, Facebook post and photo links); `none` means no link is known (`both-xiaodanjoe-1`, file `xiaodan_joe.jpg`, only a handle). The UI should show `credit` always and link only when `url` is not null.
- DeviantArt pieces have handle, title and id parsed from the name. Pixiv, ArtStation, Reddit and Facebook pieces have no artist name in the file name, so `artist` is null and `credit` reads "Unknown artist, via <site>". LinkedIn is by Joshua Tan and the X post is by `@jkun_18`.
- `color` is the dominant accent colour (hue bucket weighted by saturation and brightness, so white backdrops do not win).

### Comics

`data/comics.json`: `comics.{aspirant,guinevere-vexana}` with `title`, `pageCount`, `missingPages` and an ordered `pages` list of `{file, width, height, page, part?}`. `file` is relative to `public/`. No strip was taller than 12000 px after resizing (the tallest is 4950 px), so nothing was sliced; the slicing code produces `NNa`, `NNb` if it ever happens. The Aspirant comic has 42 pages (1 to 42). The Guinevere and Vexana comic has 43 pages; 3, 23 and 40 are missing in the source and numbering is kept.

### Video

31 videos, 1.4 to 29.5 MB each. Encoded with libx264 High, `yuv420p`, CRF with `maxrate` caps, AAC (96 kbps stereo, or 56 to 64 kbps mono for the low-resolution ones), `+faststart`, frame rate capped at 30. Posters are JPG frames near 10% of the duration (moved later if the frame is nearly black). Output size is shown as width x height.

| Pair                     | Videos                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fanny-layla (98 MB)      | trailer 1280x720 (+vtt), skin-showcase 960x540, music-video 1280x720, music-bts 640x360, music-producer-talk 640x360, idea-bts 960x540, short-animation 960x540 (+vtt)                                       |
| lesley-change (33 MB)    | trailer 1280x540 (+vtt), teaser 640x360, skin-showcase 640x360                                                                                                                                               |
| ruby-angela (68 MB)      | trailer 1280x540, angela 1280x540, ruby 1280x540, qna 640x360, rerun 540x960, skin-showcase 640x360                                                                                                          |
| selena-obsidia (63 MB)   | trailer 1280x540 (+vtt), comic-video 640x360 (556 s, 233 kbps video), obsidia 960x540, selena 960x540, selena-short-showcase 540x960, skin-showcase 960x540                                                  |
| guinevere-vexana (64 MB) | trailer 1280x540, relink 1280x540, 3d-process 540x960, comic-video 540x960, heart-short-dance 540x836, interactive-drama 960x540, short-splash-art-showcase 540x960, skin-showcase 960x540, sleeping 540x960 |

Captions come from: `fanny-layla/trailer` (en.en.srt, lyrics), `lesley-change/trailer` (NA.en.srt, its last cue is at 2:30 so it belongs to the 157 s trailer, not the teaser), `selena-obsidia/trailer` (ja.en-US-cQlcVsZB8sQ.srt, last cue at 2:49), `fanny-layla/short-animation` (english.srt). Other trailers have burned-in subtitles in some places (the Guinevere and Vexana trailer has English burned-in captions) and no separate SRT.

The `video/.../*.mp4` of the selena-obsidia trailer and the others are large files: load them lazily, preload `none` or `metadata`, and use the poster.

### Stills

- `img/stills/selena-ender.webp` (trailer 1:18). As seen: a close-up of a pink-haired character in three-quarter view, one glowing pink eye with a star-shaped pupil, dark angular marks on the cheek, a faint smile, gold ornaments at the neck and a horn-like ornament at top right, on a dark indigo background with violet streaks. No on-screen text. The frame does not say who it is.
- `img/stills/obsidia-ender.webp` (trailer 2:35). As seen: a pale, long-haired figure arched backwards with the head tipped up, engulfed in bright white and orange flames and sparks. A caption is burned into the top of the frame ("Purify the corruption, and rewrite the law."), so crop it out if you use it as a backdrop. The frame does not say who it is.
- `img/hero-stills/{pair}-NN.webp`: chosen by eye from contact sheets taken every 6% of each trailer (about 16 candidates per trailer), skipping black, white, text-heavy and burned-in-subtitle frames. Seconds used: fanny-layla 16, 58, 64; lesley-change 25, 82, 129; ruby-angela 32, 68, 104; selena-obsidia 40, 83, 104; guinevere-vexana 18, 51, 137, 170. Edit `HERO_PICKS` in `scripts/assets/video.mjs` to change them.

### Audio

- `audio/voice/{slug}/NN.m4a` for every voice line flac, 380 lines: angela 40, change 37, fanny 28, guinevere 41, layla 28, lesley 37, obsidia 41, ruby 40, selena 46, vexana 42. Mono, 24 kHz, AAC 32 kbps. Leading and trailing silence is trimmed with `silenceremove` (threshold -50 dB, short natural pad kept), then a static gain brings the gated RMS of every line to about -18 dBFS (about -17 to -19 LUFS) with a peak ceiling, 5 ms fade in and 40 ms fade out. Line numbers match `voice.md`.
- `audio/voice/{slug}/index.json`: `[{n, file, durationSec}]`. `file` is relative to that folder (`"01.m4a"`).
- Music: `we-believe` (Layla and Fanny song, 308 s), `obsidia-aspirant` (36 s), `obsidia-solo` (80 s). The two Obsidia files are stereo MP3s in `audio/obsidia/long`; their spectrograms show sustained phrases, not isolated voice lines.

### Models

`models/layla.glb` (856 KB) and `models/fanny.glb` (1.1 MB). Y-up, Draco compressed, textures embedded (the source textures are 512 px, so none needed shrinking). The character is 2 units tall with its bounding box centred on the origin and faces +Z. The OBJ is split into nodes by material: `body`, `face`, `hair_eyes` (the character), `weapon`, `robot` and `robot_screen` (a small robot companion, shared by both characters). The weapon and robot sit beside the character in model space, as in the source (Layla's weapon is about 2.4 units to her left; Fanny's two blade and wing pairs are about 3.5 units to her right), so hide or reposition them. Materials are rebuilt as matte Principled materials with the texture as base colour: the OBJ materials carried an emission value of 0.5 that would have washed the model out, and the alpha channels of the body and weapon textures are masks, so the materials are opaque.

Verification: each GLB is loaded back into Blender headless (6 meshes, 6 textured materials, no untextured material; Layla 29,993 vertices and 28,882 triangles, Fanny 31,820 vertices and 27,699 triangles) and rendered from the front and side with the Workbench engine, textured. Both previews were viewed and look right (faces, hair, weapon and robot textures on the correct parts). The previews are written to the scratch folder, not the repo.

`img/emote/{layla,fanny}/01..08.webp`: the eight robot face-screen textures. The Layla and Fanny PNG files are byte-identical, so both folders hold the same images.

### Portal images

Three ids, each 1100x1375 (4:5):

| id                 | base                                                                                                | alt                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vexana`           | Vexana, `vexana-fighting-stance-transparent.png`, cropped to a head-and-torso portrait, transparent | Ender-form portrait cropped from `vexana-mobile-wallpaper.jpg` (profile view, blue-lavender hair, horns, white gauntlet), opaque purple background |
| `selena-obsidia`   | Selena, `selena-transparent.png`, portrait crop, transparent                                        | Obsidia, `obsidia-transparent.png`, portrait crop, transparent                                                                                     |
| `guinevere-vexana` | Guinevere, `guin-fighting-stance-transparent.png`, portrait crop, transparent                       | Vexana, same crop as `vexana/base`                                                                                                                 |

Note for the page builders: the Vexana "fighting stance" cut-out already shows the winged horns and a pale-white-to-magenta hair gradient, so it is not obviously a different form from the splash art; the wallpaper is the only art where the hair reads blue-lavender in close-up. The Home page can swap `base` and `alt` as the brief says; the canon call about which is "Ender" is the owner's.

Depth: `depth.webp` belongs to `base`, and `depth-alt.webp` (extra) belongs to `alt`, because the alt silhouettes differ. 8-bit grayscale, near is white. **Method used: a real monocular depth model, Depth-Anything-V2-Small (`depth-anything/Depth-Anything-V2-Small-hf`, transformers on CPU, in a throwaway venv under the scratch folder), run by `scripts/assets/depth.py`.** The venv build took a few minutes and each image about 2 s. Post-processing in Node: transparent images are flattened on mid grey for the model, depth is stretched between the 2nd and 98th percentile inside the silhouette, blurred (sigma 2.5) and multiplied by a feathered alpha so the background is 0; the opaque alt is stretched and blurred only. Caveat: the model sees a flat illustration, so it reads the torso as nearest and thin hair strands as flat; expect a gentle parallax, not a sculpted face. If `DEPTH_PYTHON` is not set, `portal.mjs` builds a pseudo-depth (blurred alpha silhouette times a luminance term) instead.

## Skipped, and why

- `media/layla-and-fanny/video/live-action` (video and SRT): non-canon parody.
- `vexana-and-guinevere/live-guin.webm`, `live-vexana.webm`: multi-hour livestreams (220 MB and 150 MB).
- `_backup*` folders and `audio/source`: backups and raw sources.
- Non-English subtitle files (ar, es, id, ja, km, ms, my, pt, ru, tr, vi): site copy is English only.
- `audio/{slug}/{slug}.m4a` for the nine characters that have one, and `audio/obsidia/long/obsidia.m4a`: these are voice-line compilations, not music. They are mono, 44.1 kHz, about 264 kbps, with 1 to 2 s gaps between short bursts of speech; `layla.m4a` is 143 s and has 36 gaps for the same 28 lines that are shipped individually; `obsidia.m4a` is 275 s and its spectrogram shows about 60 isolated bursts and no music. So there are no `{slug}-theme.m4a` or `obsidia-long.m4a` files. (Vexana and Selena have a compilation in `audio/{slug}/` too; they were treated the same way.)
- Cut-outs for ruby, angela, lesley and change: the source folders contain splash art only.
- `img/pair/{ruby-angela,lesley-change,selena-obsidia}`: no shared art in the source.
- `media/others`: empty.
- `story/**/comic.md`, `story/video-transcripts`: text, handled by the content scripts.

## Other findings

- Both comics have all pages as tall JPG strips at 1000 to 2500 px wide; the Guinevere and Vexana originals are 124 MB, the output is 4.5 MB.
- The Selena and Obsidia `comic.webm` is a 556 s narrated comic video (the transcript README says Indonesian narration that repeats `story/villain-arrives.md` with pre-correction wording); it is shipped as `selena-obsidia/comic-video` and should not be quoted as lore.
- Total video is 323 MB of the 365 MB. If the budget gets tight, the cheapest cuts are `fanny-layla/music-bts` (24 MB), `fanny-layla/music-video` (31 MB) and `selena-obsidia/comic-video` (16 MB).
