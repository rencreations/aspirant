# Home page: media derivatives, data picks and the voice gain (workstream D)

Written 18 Nov 2026 by the media workstream. Everything here is made by scripts in `scripts/home/media/` and `scripts/library/voicelines/`, never by hand, and is idempotent. Sources are read only. Nothing was uploaded to R2 and no R2 key was written: the library's pictures, films, music and voice lines are reused by their keys.

## 1. What was made

| Output                                                                                                 |                    Size | What                                                            |
| ------------------------------------------------------------------------------------------------------ | ----------------------: | --------------------------------------------------------------- |
| `public/data/home/picks.json`                                                                          |                   67 KB | every pick of the page, resolved and measured (section 2)       |
| `public/data/home/voices.json`                                                                         |                   24 KB | the owner's 80 curated voice lines (section 3)                  |
| `public/img/home/cards/<slug>-45.webp` (10)                                                            |                 1.41 MB | the 4:5 hero cards, 960x1200, one for each Aspirant (section 4) |
| `public/img/home/mlbb.webp`                                                                            |                   21 KB | the MLBB logo, 555x167, lossless                                |
| `public/video/home/strip-1280.mp4`, `strip-1920.mp4`, `public/img/home/strip-poster.webp`              | 2.43 MB, 3.81 MB, 29 KB | the trailer strip loop, the whole 1920x808 picture (section 5)  |
| `public/video/home/preview/<film-id>.mp4` and `.webp` (10)                                             |       2.69 MB + 0.11 MB | the floating previews, 4 s, 560x286 (section 6)                 |
| `public/video/home/loops/<slug>.mp4` (7), `public/img/home/loops/<slug>-45.webp` and `-full.webp` (14) |      10.67 MB + 0.98 MB | the character list loops (section 7)                            |
| `scripts/library/voicelines/loudness.json` and a field `g` in `voicelines-<slug>.json`                 |                  262 KB | the voice gain (section 8)                                      |

New committed media: **22.5 MB** (budget about 30). Files of other workstreams in `public/img/home/` (`drone-faces*`, `kite*`, `marks*`) are not mine.

Rebuild everything, in this order (anaconda Python, ffmpeg on the PATH, no `-I`; the scripts import their neighbours):

```
python scripts/library/voicelines/loudness.py      # only when the voice files change (measures what is new)
python scripts/library/voicelines/build.py         # writes g into the voicelines data
python scripts/library/build_index.py
python scripts/home/media/cards.py
python scripts/home/media/logo.py
python scripts/home/media/trailer.py --sheets
python scripts/home/media/previews.py --sheet
python scripts/home/media/loops.py --sheet
python scripts/home/media/voices.py
python scripts/home/media/picks.py --sheet
python -m unittest test_media                      # from scripts/home/media
node scripts/library/voicelines/verify_gain.cjs    # the gain through a copy of the real audio graph, in Chrome
```

Work files and the looking sheets go to `D:\ren\aspirant-work\home\D\` (`cards-sheet.jpg`, `clean-sheet.jpg`, `trailer\loop-sheet.jpg`, `previews\previews-sheet.jpg`, `loops\loops-sheet.jpg`).

## 2. `picks.json`

Library keys are paths under `library/v1/` (`libUrl(key)` makes the address). Repo paths start with a slash and are under `apps/web/public/`. Every file record carries `bytes` so the loading list can weigh its items.

```ts
interface Pic {
  // a splash art picture, official only
  id: string;
  title: string;
  alt: string;
  chars: string[];
  pair: string | null;
  lib: { t: string; p: string; f: string }; // R2 keys: 480 wide, 1280x720 (or native), full
  p: { w: number; h: number; bytes: number };
  f: { w: number; h: number; bytes: number };
  frame: Rect; // the data's 16:9 window of the whole picture
  clean: Rect; // the window to SHOW: 16:9, no corner mark
  focus: { x: number; y: number }; // the subject, fractions of the whole picture
  marked: boolean; // the game's mark is in the top left of the picture
}
type Rect = { x: number; y: number; w: number; h: number }; // fractions of the whole picture
```

- `hero.wide.single` (10) and `hero.wide.group` (6): all `Pic`, all shared with the wall, so they cost no new bytes. `hero.portrait` (10): `{ id, chars, repo, w: 960, h: 1200, bytes, focus, alt, source }`, the new 4:5 cards.
- `wall.order` (18): the carousel and the wall, one cyclic order. Neighbours, and the pictures 6 and 12 places apart (three rows that start 6 places apart), never share a pair or an Aspirant. The two pictures that are not 16:9 (`guinevere-raises-a-fist`, `aspirants-on-a-photo-frame`) are cut to 16:9 by their `frame`, which is also their `clean`.
- `spiral` (10): the ten single-character `Pic`, in the order Fanny, Layla, Ruby, Angela, Lesley, Chang'e, Guinevere, Vexana, Obsidia, Selena. Same keys as the wall, so the spiral costs nothing.
- `fanart.items` (15): `{ id, title, alt, chars, canon: "fan", badge: "Fan work", credit: { by, platform, url, date }, artistLink, creditLine, lib: { t, p, f }, w, h, color, bytes: { t, p, f }, report: { item, title } }`. `fanart.note` says what the section must carry: `CanonBadge` (prints "Fan work"), `CreditLine` (the credit and "View the original"), and a small `ReportLink` ("Copyright or takedown") in the section and in the preview of a picture.
- `music` (7): `{ id, title, ep, released, chars, credits, audio: { lib, d, bytes }, disc: { lib, w, h, bytes }, jacket: { lib: { t, p }, bytes } | null, site: string | null, color }`. `jacket` is a real album cover (two tracks, Gray New World and Lullaby of Oblivion); the other five have `site` (the splash picture the room uses, a repo path under `public/`). `disc` is a square label picture (518 or 1024).
- `comics` (2): `{ id, title, dataTitle, slug, route, pages, cover, panels[], chibi[] }`. `title` is the owner's wording ("The Aspirants", "Vexana & Guinevere"); the routes are `/collection/comic/the-aspirant/` and `/collection/comic/guinevere-and-vexana/`. `panels` (7 and 7) and `chibi` (3 and 5, real transparency) are the stage pictures of the room's COMIC hero, with their size and colour.
- `archive` (10): `{ slug, index, name, tagline, line, colour, ink, route, count, cover: { lib, w: 1024, h: 1024, bytes } }`, read from `features/library/registry.ts`. Every route was checked against `app/collection/`.
- `logos`: `mlbb` (`/img/home/mlbb.webp`, 555x167), `themlabel` (`/img/about/themlabel.webp`, grey letters, for the light page), `themlabelDark` (`/img/about/mlabel/logo.webp`). The MLBB file is a raster: show it at 270 CSS px wide or less (sharp at 2x). A crisp larger size needs a bigger or vector source from the owner. No upscaling was made, it adds no detail.
- `trailer.strip[]` (two files), `trailer.poster`, `trailer.film` (the library's film for "Play Films": `lib.video`, `lib.poster`, `dur` 180.8, `durLabel` "03:01", `href`, and `smallerCopy`, the repo's own 23 MB 1280x540 stream of the same film).
- `previews` (10), `loops` (9): sections 6 and 7.
- `loading`: the byte plan (section 9).

### The corner mark (contract for the hero, the wall and the spiral)

Eleven of the 18 official pictures carry the "MOBILE LEGENDS BANG BANG" mark at the top left: the eight singles (all but Selena and Obsidia) and the three Guinevere and Vexana group pictures. **It is in the R2 `t`, `p` and `f` too** (it is part of the art). The mark and its line fill x 0.02 to 0.125 and y 0.035 to 0.108 of the picture. No new file is made. Instead `clean` is a 16:9 window, flush right and top: `{ x: 0.13, y: 0, w: 0.87, h: 0.87 }`. **Show `clean` in cards (hero, wall, spiral) and the whole picture (`frame`) in the preview window.** A card is cut by the texture coordinates: `uv = clean.xy + uv * clean.wh`. Looked at on `clean-sheet.jpg`: the mark is out in all eleven. The preview window (full size `f`) shows the art as published, with the mark.

`fanny-layla-key-art` carries the series' own title ("THE ASPIRANTS") at the top left. It is **in the wall only**, not in the hero, because it would compete with the big logo. The sixth hero group picture is `aspirants-on-a-photo-frame` (all ten) instead.

## 3. `voices.json`

Fanny 18, Ruby 5, Lesley 2, Guinevere 39, Selena 43 (42 in Japanese), Layla 7, Angela 23, Chang'e 12, Vexana 41, Obsidia 18, in the owner's order. Each Aspirant has one line in each of eight languages, in the order `jp, en, id, ar, es, pt, tr, ru`. All 80 clips exist in the mirror. The text, duration, key and gain are copied from the library data by the script (a test keeps them equal).

```ts
interface HomeLine {
  n: number;
  lang: string /* ja, en, ... */;
  dir: "ltr" | "rtl";
  t: string;
  tr?: string;
  trLang?: "en";
  d: number;
  g: number;
  key: string;
  note?: string;
}
```

`tr` is the translation the data has: the English that came with a Japanese line, and for the seven languages that share one list, the English line of the same number. Play with `audio.playVoice(libUrl(line.key), { gainDb: line.g })`. Arabic reads right to left: set `lang` and `dir` on the element. Guinevere's English, Spanish and Portuguese lines hold a stage direction in brackets, for example "(Chuckles)": style it or drop it. Each character also has `splash`, `cutout` (a repo path or null), `palette`, `page` (her page in the room) and `lineJp`. `all` is `/collection/voicelines`.

## 4. The hero cards (4:5)

Eight come from the owner's `splash-art/cropped` (1152x1440, Vexana 973x1216, the mark already out). The folder has no Obsidia and no Selena: `cards.py` cuts them from `normal/*.png` (2560x1440) with a 1152x1440 window, centred on the character by eye with a grid drawn on the picture (Obsidia x 0.495, Selena x 0.615). All ten are resized to 960x1200 (never enlarged) and saved as WebP q82: 1.41 MB in all. 960x1200 is a choice (the brief says about 1152x1440): on the biggest card (about 390 CSS px tall) it is sharp up to a pixel ratio of 2 and costs 61 MB of GPU memory with mip maps against 88 MB. Change `CARD_SIZE` in `cards.py`.

## 5. The trailer strip

> **Round two (19 Nov 2026): replaced.** The strip no longer plays a cut loop. It plays the library's whole film (`trailer.film`, 145 MB, 1920 by 808), streamed, from the rest moment `trailer.film.start` (11.7 s), and the bar waits for its first 6 s (`trailer.film.warm`, 4.8 MB). `strip-1280.mp4`, `strip-1920.mp4`, `strip-poster.webp` and `trailer.py` are deleted. Notes: `round2-R-A4.md`. The text below is the first version.

Source: the 1920x1080 VP9 file with black bars (the picture is 1920x808, `crop=1920:808:0:136`, verified on frames), 180.8 s, with burned in English subtitles at y 0.90 to 0.97, and a song line at the very top from about 120 s. The page crops with CSS, so **the whole picture is kept** (a centred 3.7:1 cut loses the faces).

No stretch of 9 s is both free of subtitles and good looking (the only long clean one, 38.5 to 49 s, is Obsidia's hair and a dark dip). So the loop is two clean stretches joined by a dissolve, with a dissolve back into the first, so the loop has no seam (the method of `scripts/story/media.py`): 44.6 to 46.9 s (the horned Ender queen in the purple hall) and 90.0 to 97.45 s (the fight, with the film's own hard cuts at 91.17 and 95.42). The subtitle bands were scanned (a static bright pixel test, then frames every half second of each candidate, in the bands), and the loop was looked at frame by frame at 20 moments and at the seam (`loop-sheet.jpg`, `seam-sheet.jpg`): no subtitle, no title, no black bar. 8.95 s, 24 fps, muted, H.264 High, faststart.

| File                        |    Size | CRF | Used by                                                                                                           |
| --------------------------- | ------: | --: | ----------------------------------------------------------------------------------------------------------------- |
| `strip-1280.mp4` (1280x538) | 2.43 MB |  27 | displays under 1920 physical px wide: **waited**                                                                  |
| `strip-1920.mp4` (1920x808) | 3.81 MB |  28 | 1920 and over: written only because it is under the 4 MB limit; loaded instead of the 1280 one, not as well as it |

Pick by the display only (width times pixel ratio). The poster is the first frame of the loop (`strip-poster.webp`, 1280 wide). "Play Films" opens `trailer.film.lib.video` (the library's 145 MB H.264 film, faststart, so it streams with range requests) or the 23 MB repo copy.

## 6. The ten previews

> **Round two (19 Nov 2026): re-cut.** `preview/v2/<film-id>.mp4`, 1280 wide, the whole picture at each film's own shape (no 1.96 to 1 crop), CRF 21, 0.70 to 2.02 MB each, 14.7 MB in all, windows chosen again at full frame so no subtitle shows, and Awakening moved from the meadow to the burning city (118 s) so no two share a scene. The table below is the first version (windows and sizes); the current windows are in `previews.py` and `round2-R-A4.md`.

One clip per film of `FILM_IDS`, cut from the library's own films. 4 s (97 frames at 24 fps), 560x286 (1.96 to 1, the card of the reference is 1.45 by 0.74), H.264 Main CRF 26, no audio, faststart, plus a WebP poster (the first frame). The crop is the middle of the picture between 7 and 87 percent of its height, which leaves out the burned in subtitles (below 88 percent, and the few lines at the very top of Re:Link and Connection Lost). Each loop closes with a 0.35 s dissolve into its head. Total 2.69 MB, 142 to 489 KB each.

Windows, chosen by looking at frames every 4 s, then every half second (my first guesses were wrong for several, as the recon said):

|   # | Film                  | Start (s) | What the clip shows                                          |
| --: | --------------------- | --------: | ------------------------------------------------------------ |
|   0 | Day of Enders         |      56.2 | Selena and Obsidia face to face, then a pink haired close up |
|   1 | The Pawn's Gambit     |       5.9 | Selena runs along a rooftop, the silver dragon beside her    |
|   2 | The Queen's Endgame   |      39.2 | Obsidia draws a dark star in her gloved hand                 |
|   3 | Connection Lost       |      56.0 | a selfie on the roof, then Fanny in profile                  |
|   4 | Re:Link               |     13.95 | Vexana's light burst and the pink ring                       |
|   5 | Rekindled Light       |      11.0 | the girl in red light, then the white robot                  |
|   6 | A Way Out             |       5.0 | Ruby, the hologram cube on her eye                           |
|   7 | A Friend              |      27.0 | a hand reaches, then the meadow under the dome               |
|   8 | Awakening             |      64.7 | the meadow, an arm, two girls face to face                   |
|   9 | Go For It! Aspirants! |      28.8 | Fanny with her blade in the white corridor                   |

`picks.previews[n]` has `id`, `title`, `href` (`/collection/video/films?i=<id>`), `video`, `poster`, `color`.

## 7. The character list loops

> **Round nine (20 Nov 2026): Guinevere, Ruby and Vexana are pictures now** (the splash art of the owner's `splash-art/cropped`, like Fanny and Layla), and Chang'e's window was re-cut. Four loops remain (Obsidia, Angela, Lesley, Chang'e). The table below is the first version. Notes: `round9-FIX-chars.md`.

Owner's order: Obsidia, Fanny, Guinevere, Angela, Lesley, Layla, Ruby, Vexana, Chang'e. **One file serves both states**: the full picture is the file, the list shows `window`, a 4:5 window of it, and a press opens the same file whole with the empty space around it.

```ts
window: {
  (x, y, w, h, cx, cy, zoom);
} // fractions of the full picture; w * W / (h * H) = 0.8; zoom = 1 / h
```

For a 4:5 box with the window as the visible part: texture or CSS crop `x, y, w, h`; `cx, cy` is its centre.

| Slug      | Kind      | File                         | Full picture          | Window h |    Size | Note                                                                                                                   |
| --------- | --------- | ---------------------------- | --------------------- | -------: | ------: | ---------------------------------------------------------------------------------------------------------------------- |
| obsidia   | idle      | `loops/obsidia.mp4` 8.03 s   | 1920x864              |      1.0 | 1.93 MB | the site's own idle loop, every second frame of the 60 fps file, so it stays exact; closing step 1.04x the median step |
| fanny     | still     | card `cards/fanny-45.webp`   | library `f` 2560x1440 |      1.0 |         | no motion exists for her in the owner's folder; the page gives the still a slow push                                   |
| guinevere | ping-pong | `loops/guinevere.mp4` 10.5 s | 1920x1080             |      0.8 | 1.85 MB |                                                                                                                        |
| angela    | ping-pong | 6.1 s                        | 1920x1080             |      0.8 | 1.28 MB |                                                                                                                        |
| lesley    | ping-pong | 5.9 s                        | 1920x1080             |     0.78 | 1.44 MB | window ends above her title label                                                                                      |
| layla     | still     | card `cards/layla-45.webp`   | library `f`           |      1.0 |         | as Fanny                                                                                                               |
| ruby      | ping-pong | 7.1 s                        | 1920x1080             |      0.8 | 1.78 MB |                                                                                                                        |
| vexana    | ping-pong | 8.0 s                        | 1920x1080             |    0.667 | 1.49 MB | her banner title starts at y 0.78                                                                                      |
| change    | ping-pong | 4.2 s                        | 1920x1080             |      0.8 | 1.15 MB |                                                                                                                        |

The `webmedia` banners are the official animated title banners (a slow push, text in the lower fifth), not loops: the first and last frames differ (RMSE 10 to 57), so the loop finder finds nothing and they are played forward and back, with neither end frame twice. It is seamless by construction. The windows leave the title text out; the full picture keeps it (it is the official banner). The seven videos are 1.1 to 1.9 MB each, 10.67 MB in all. A 4:5 window of a 1080p banner is 864 px tall (Vexana 720), sharp for a frame of 720 CSS px up to a pixel ratio of about 1.2 and acceptable at 1.5. A sharper crop needs bigger files than the 2 MB asked for: this was the trade. Each record has `poster45` (640x800, the window of the first frame) and `posterFull` (1280 wide). Not checked by playing: that a drifting particle never runs backward (the banners have none to speak of in the frames looked at).

## 8. The voice gain

The recon found 3,066 lines spanning 33 LU (median -33.4 LUFS): Japanese about -22, the other seven languages -32 to -37. Nothing is re-encoded and no key changes. Each record now carries `g`, written by `scripts/library/voicelines/build.py` (new step `add_gains`, which runs `loudness.py` after the encoding):

```
g = min(TARGET - I - BUS_DB, CEIL - TP - BUS_DB)      rounded to 0.1 dB
TARGET = -18 LUFS, CEIL = -1 dBTP, BUS_DB = 20 log10 1.9 = 5.575 dB (voiceBus.gain in lib/audio.ts)
```

`I` and `TP` are measured on the AAC the browser plays (ffmpeg ebur128). **One finding changed the first numbers:** a mono file is played by Web Audio on both channels at full level, which is 3 LU louder than ebur128 says of the bare mono file (ffmpeg's own up-mix lowers each channel by 3 dB). Most Japanese lines are mono. They are measured as dual mono (`pan=stereo|c0=c0|c1=c0`). With the plain measure, a real graph check showed the Japanese lines 3 LU too loud.

Result on 3,082 clips (lines and trailer clips): `g` from -9.5 to +23.9 dB, median +9.8, none held by the peak ceiling. The 10 recordings (`full`) have `g` from -1.4 to +2.5 dB (no bus lift on that path, measured as dual mono); the 36 trailer clips have `g` from -8.9 to -2.0 dB (they were louder than the lines).

**Checked through a copy of the real graph** (`verify_gain.cjs`, real Chrome, an `OfflineAudioContext`: gain, voice bus 1.9, analyser, master, compressor threshold -14 ratio 3, the numbers read from `audio.ts`; output measured with ebur128). 10 quietest lines, 10 loudest and a seeded sample of 30:

|              |              Without `g` |                                         With `g` |
| ------------ | -----------------------: | -----------------------------------------------: |
| all 50 clips | spread 33.2 LU (sd 11.5) | **spread 0.5 LU (sd 0.12)**, -18.0 to -17.5 LUFS |
| 10 quietest  |           -41.7 to -39.8 |                                   -17.9 to -17.6 |
| 10 loudest   |             -9.6 to -8.5 |                                   -17.7 to -17.5 |

The output level sits near -17.7 (the compressor's makeup gain adds a little); the worst true peak after the graph is -4.2 dBFS. So the spread after the gain is under 1 LU, inside the 2 LU asked. **Not checked by ear.** The risk the recon named stands: +24 dB lifts the AAC coding noise of the quietest clips by as much. The clips are clean single sentences.

Applied by: `audio.playVoice(url, { gainDb })` (new option; `volume` stays a plain linear factor, no caller passes it), `toggleLine(url, { onEnd, gainDb })` in the room (the Aspirant pages and the trailer clips pass the record's `g`), `toggleRecording` (`full.g`, as the music element's level: a GainNode takes a value above 1; the element fallback is now clamped to 0 to 1). The master compressor is kept. `lib/voice-gain.ts` holds `VOICE_BUS_GAIN` (the engine uses it) and the pure `dbToLinear` and `voiceLevel` (a corrupt `g` is held to -24 to +30 dB). Tests: `lib/voice-gain.test.ts`, `lib/audio.test.ts` (a fake graph: the gain node gets `10^(g/20)`, the bus is 1.9), `features/library/voicelines/gain-data.test.ts` (every record equals the formula, and the levelled spread is under 0.7 LU), `home-voices.test.ts`.

**Other players, measured, not changed.** The character pages (`public/audio/voice/**`, 382 files) and the story reader (`public/audio/story/**`, 42 files) play repo files with their own data, not library records, so `g` never reaches them. Measured as dual mono: character pages mean -15.0 LUFS (sd 0.67, so already even among themselves), story mean -15.1 (sd 0.54). After the bus they sit near -9 LUFS, about 9 LU **louder** than the room and the home after the gain. Going from a character page to the room, the voice drops by about 9 dB. The owner asked for the room and the home, so they were left alone. To bring them to the same level: a table `path -> g` (about -8.5 dB, range -10.9 to -7.0) fetched lazily by `playVoice`, never imported (`audio.ts` is in every route's first load). A decision for the owner.

## 9. The loading plan (design section 6)

Bytes of the files (`picks.loading`). The 3D models and the code are not counted.

**Waited, 6.48 MB:** the ten 4:5 hero cards 1.45 MB; the 18 `p` pictures that the hero, the wall and the spiral share 2.53 MB; the strip (1280, held whole) and its poster 2.46 MB; the logos 0.05 MB. (A display of 1920 or more waits for the 1920 strip, 3.81 MB, instead of the 1280 one: 7.8 MB.) Use `mediaItem` for the strip (a seamless loop is better held whole) and `imageItem` for the pictures.

**Deferred, 33.95 MB, in section order:** the ten previews 2.83 MB (priority first, they are the next screens); the seven character loops and posters 11.88 MB, the two list stills 1.01 MB; voice lines (80 clips) 5.12 MB; music discs and jackets 0.95 MB; comic stage pictures and covers 1.46 MB; fan art thumbnails 0.70 MB; archive covers 0.78 MB; the 18 full size pictures for the preview window `f` 9.23 MB (load one on hover or press, not all).

**On demand:** the music audio, 13.8 MB in seven tracks, streamed on pick; the fan art `p` and `f` 7.05 MB, on hover and press; the film for Play Films 145 MB, streamed.

Voice lines load when a character is chosen (8 clips each, about 0.5 MB). A deferred item that the visitor reaches first shows its loading state.

## 10. Not done, not verified

- No sound was listened to. The gain was measured and checked through a copy of the graph, not heard.
- The strip, the previews and the loops were looked at as frames and sheets, not played in a browser. The loop seams were measured (frame differences) and looked at frame by frame.
- The ping-pong loops of the banners reverse their drift: not checked for a particle running backward.
- The cards at 960x1200, not 1152x1440 (section 4). The Lesley window is 0.78 of the height to keep her label out.
- The `clean` windows lose 13 percent of the picture at the left and the bottom for the eleven marked pictures.
- `scripts/library/ignored.json` and `build_index.py` outputs are unchanged by the gain step (checked with git).
- A TypeScript type for `picks.json` is not written (the feature folder is the kernel owner's). Section 2 has the shape.
