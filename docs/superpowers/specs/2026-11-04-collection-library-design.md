# The Collection: a shelf of ten, and a library behind it

Status: draft for the owner's approval, 4 Nov 2026. Reference frames: `docs/design/collection-reference/`.

## Intent

The owner wants `/collection` to be the complete library of everything made for Aspirant. A visitor arrives at a shelf of ten covers, picks one, and lands on a page built for that kind of material. Each page must be beautiful, animated and easy to search, and together they must hold everything in `D:\ren\aspirant` that belongs to the series. The old one-page archive (six sections, 468 items) is replaced.

The opening copies the structure and feeling of <https://www.shopify.com/editions>: one screen, a WebGL shelf, covers that lift on hover, a focus view with the title, and an index row. Only the structure and motion are copied. The pictures, type and words are ours.

## Goals

1. `/collection` opens on the shelf (ten covers, two shelves of five) and behaves like the reference on desktop and phone.
2. Ten pages, `/collection/<slug>`, in shelf order: `arts`, `films`, `music`, `voicelines`, `fanart`, `comic`, `lore`, `design`, `animation`, `others`.
3. Every item in the source library that belongs to the series is on one of them, in the best quality that is practical, with credits where it is not official.
4. A visitor finds things quickly: filters by character, pair and type, search, deep links, and a clear order inside each page.
5. The site's own rules hold (loading bar, one version, transform and opacity motion, no AI mention, no dashes).

## Non-goals

- No change to anything in `D:\ren\aspirant`. It is read only.
- No new lore, and no use of the old Claude-written novel or the Whisper transcripts as text.
- No GIFs on the site. The native clips replace them.
- No per-character hotspot pages for the six characters that have no stage today (see Animation).

## Anti-goals (a failure even if it works)

- A page that pops in late, or that has a lite mode or a timer instead of a real loading bar.
- Fan work shown without a credit, or fan or non-canon work that looks official.
- A shelf that is slow on an ordinary laptop, or that blurs live pictures with CSS.
- Dashes in shipped text, the banned word, or a wrong spelling of Terrinia, Selrick or Storm Citadel.

## The pages, in shelf order

Shelf one: Arts, Films, Music, Voicelines, Fanart. Shelf two: Comic, Lore, Design, Animation, Others. Numbers come from the source recon of 4 Nov 2026 and are checked again by the build.

| Slug         | What it holds                                                                                                                                                                                                                                                                                                                                                                                                       | Layout and flow                                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arts`       | All official art at full quality: splash art for the ten, pair art, `art/official`, `art/lore` cards, cut-outs, the site's character art. Plus a still for every distinct scene of every official animated film (see Scene stills).                                                                                                                                                                                 | Two tabs: Official art and Scene stills. Masonry of thumbnails with staggered reveals, a lightbox with zoom, pan, keys and a download link to the original. Scene stills group by film, ordered by time, each with its timestamp, the scene note and a link that opens the film at that second. |
| `films`      | Every video: trailers, teasers, character films (Ruby, Angela, Selena, Obsidia), Connection Lost, Re:Link, Rekindled Light, We Believe, the short animation, music video and behind the scenes, skin showcases, interviews, events, shorts, the 8 official promo reels, the match and livestream recordings, fan-made videos, the interactive drama episodes (linked to Vexana's page), and the live-action parody. | A featured film on top, then rows by kind. The parody sits alone in a row with a plain non-canon notice, and fan-made films carry a fan badge. Each film opens in the site's player (`VideoCard`) with English captions and a chapter list built from the scene notes.                          |
| `music`      | The songs and long audio: We Believe, Obsidia's pieces, the four page themes, the music compilation, and the music videos and talks.                                                                                                                                                                                                                                                                                | A track list with cover art, one player that stays (`player-store`, `MiniPlayer`), a live spectrum, credits from the sources.                                                                                                                                                                   |
| `voicelines` | All 380 lines, Japanese original and English, for the ten, plus the long voice compilations.                                                                                                                                                                                                                                                                                                                        | One panel per character, search over both languages, play, a random line, the three notes the sources carry (Lesley 36 and 37, Vexana 42), and a link to the original FLAC.                                                                                                                     |
| `fanart`     | All fan art, fan comics' covers, cosplay and fan-made animation, with credits.                                                                                                                                                                                                                                                                                                                                      | Masonry plus a video row. Filters: pair, character, platform, kind. Every item links to its original post when the sources know it.                                                                                                                                                             |
| `comic`      | The two official webtoons (The Aspirant, 42 pages; Guinevere and Vexana, 43 pages, 3 missing in the source) with their transcripts, then the fan comics (Layla and Fanny, 47 pages in 19 posts; Ruby and Angela, 28 pages).                                                                                                                                                                                         | A shelf of comic covers, then a reader that scrolls the long strips, remembers the place, and can show the transcript beside the page. Fan comics are marked non-canon.                                                                                                                         |
| `lore`       | The 28 official text files in `story/official`, as articles. Places and entities with their official pictures (14 places, 10 entities).                                                                                                                                                                                                                                                                             | Grouped as World, Characters, Stories and Videos. A reader with a contents rail. A places atlas with the official pictures. The two oldest texts are marked as older sources. A note says that Stories may give away the plot.                                                                  |
| `design`     | Promotional posts and graphics: the 17 `_others/promotional` posts, the per-pair promotional folders, the carousels and the reels, each with its English caption and date.                                                                                                                                                                                                                                          | A wall by campaign and year. Carousels open as a swipe set, reels play in the player. Filters: pair, year, format.                                                                                                                                                                              |
| `animation`  | The in-game animation of all ten characters: welcome, idle, the page poses and the body-part clips.                                                                                                                                                                                                                                                                                                                 | A character picker and one stage. Buttons play the clips with smooth cuts back to the idle loop. See below.                                                                                                                                                                                     |
| `others`     | What fits nowhere else: the 3D models of Fanny and Layla, the emotes, the page-score and wallpaper extras, the skill icons, the logo, and a card that leads to the book at `/story`.                                                                                                                                                                                                                                | A small mixed page. The 3D models open in an orbit viewer.                                                                                                                                                                                                                                      |

### Scene stills (Arts)

The 174 footage scenes in `media/**/footages` are story beats of 3 to 49 seconds, not shots. The Selena and Obsidia trailer has 12 sections and about 46 hard cuts. So stills are made from the full films, not from the footages.

1. Films that count: official animated films (trailers, teasers, character films, Connection Lost, Re:Link, the short animation, the comic film, the interactive drama episodes, the Selena preview). Not: the parody, `_edits`, `_gameplay`, fan-made, skin showcases, streams, matches, promo reels or the in-game animation.
2. Detect cuts with ffmpeg (`scdet`), pick the sharpest frame in the middle of each shot, drop near duplicates inside a film by a perceptual hash, and keep a record of the time.
3. Caption each still with the footage note whose time range holds it. If none does, the caption is the time only.
4. Output WebP at 1920 wide plus a 480 wide thumb. Expect 600 to 900 stills.

### Animation

Selena, Obsidia, Vexana and Guinevere already have the frame matched stage (`features/character/stage`). The page reuses their timelines and videos. Layla, Fanny, Ruby, Angela, Lesley and Chang'e have only the roster cuts. For them a generalized builder (`scripts/animation/build.py`, adapted from `scripts/selena/build.py`) finds a seamless loop point in each idle recording and the matching frames for each clip, then encodes 1080p and 1440p. They play on the same engine, in the collection page only, with no hotspots and no separate route. Chang'e has two body-part clips, so her third short repeats the nearer one.

## The shelf (`/collection`)

- A full screen WebGL scene (R3F through `GLStage`): a soft ground with fine grain, two shelves, ten square covers leaning back, soft contact shadows, a small pointer parallax.
- Entrance: the loading mark, then covers drop onto the shelf one by one, row one first, 40 ms apart. Fade of the tagline and the index row after the last cover.
- Hover (and keyboard focus): the cover lifts and comes forward. Details and Open pills appear on its lower edge. The cursor stays the arrow.
- Details or a click on the cover: the scene blurs and dims inside WebGL (a half size render target and two Gaussian passes, run only while focused), the cover scales to the middle, the name and a one line description fade in on the left, Open sits under the cover.
- Open: `useTransitionRouter().push` with the collection's name as the label, so the logo transition runs as it does everywhere. The curtain itself is not changed. Esc or a click outside goes back to the shelf.
- Search: a Search button in the top bar, as in the reference, opens an overlay over the whole library. It reads `public/data/library/search.json` (id, title, collection, characters, tags) and opens the item's page with its deep link. `/` opens it from anywhere in the collection.
- Index row at the bottom: number, name, count for each of the ten. Hovering an entry lifts its cover. It is also the keyboard path (arrows, Enter).
- Phone: the covers become one vertical stack in depth, front cover full, the rest showing a strip. A swipe or the scrollbar thumb moves through. Name and count bottom left, Details and Open bottom right.
- Words: a two line tagline top left ("Everything made for Aspirant. In ten rooms."), and per collection a name, a one line description and a count. The sound button in the site bar stays. Hover and click use the site's blips.
- Covers: each is a 1024 square picture made by `scripts/library/covers.py` from official art (a chosen crop, a flat colour field, a thin grid), with the number and the name drawn over it in the browser in Big Shoulders Display after the fonts load. One colour per collection, taken from the character palettes in `content/characters`.
- Failure handling, not a version: with no WebGL the shelf is a CSS grid of the same ten covers. A real list of ten links is always in the page HTML for crawlers, keyboards and screen readers.
- The scene calls `expectReady`, and the loading list for `/collection` holds the fonts, the scene chunk and the ten covers.

## Collection pages: shared shape

Folder `features/collection/` is rebuilt. One shell, ten page components.

- Header: the cover art, number, name, one sentence, the count and the total size or runtime, a link back to the shelf and a ten dot switcher for the other pages.
- Controls: character chips (ten faces), pair, kind, a search box, and a sort. State is in the URL (`?who=layla&kind=splash&q=...`) so a view can be shared. An item has a deep link (`?i=<id>`).
- Grids use `content-visibility: auto`, are built in slices, and load thumbnails lazily. Each item reveals with a short transform and opacity animation.
- Viewers: the existing image viewer and the site's `VideoCard`. A fan or non-canon item always shows a badge and its credit.
- Routes: `generateStaticParams` for the ten slugs. `/collections` and `/collections/<slug>` redirect to the real routes, as `/experience` does. `/collection` stays the main route, so every link already in the site keeps working.
- Loading: each page's data file and its first screen of thumbnails are in `routeItems` for `/collection/<slug>`. Everything else is `deferred`.

## Data and build pipeline

New folder `scripts/library/` (the anaconda Python, ffmpeg, `aws` CLI). Source root `ASPIRANT_SRC` (default `D:\ren\aspirant`).

1. `inventory.py` walks `media`, `audio` and `story/official`, classifies every file into a collection with explicit rules, hashes images to drop the 64 duplicates, and writes `scripts/library/.cache/inventory.json` (git ignored). It reads `CLAUDE.md`'s fan material list as code: `fanart`, `cosplay`, `_edits`, `_gameplay`, `fanmade*` and the live-action folder are never official.
2. `credits.py` joins `media/_captions/captions.json` on the `ig:<code>` key (never on the stale paths) to get account, date and caption for each post, and takes artist names from DeviantArt and X file names. Items with no artist get "Artist not named" and the link to the post.
3. `images.py` makes WebP derivatives: full (at most 3840 on the long side, quality 90 for art, 82 for stills and fan art), preview (1280) and thumb (480), with width, height and a dominant colour. The 11 `.heic` files are read as the JPEGs they are.
4. `scenes.py` makes the scene stills. `videos.py` encodes films to H.264 High at 1080p (CRF 20, `faststart`), makes posters and WebVTT from SRT. `animation.py` is the generalized stage builder.
5. `text.py` turns the official markdown and comic transcripts into typed blocks and runs the site's `cleanText` (no dashes, spellings, "Aspirant power").
6. `build.py` writes `apps/web/public/data/library/index.json` and one `<slug>.json` per collection, and a unit test validates them.
7. `upload.py` sends heavy files to R2 and records their addresses in the data files.

Where files live:

| Kind                                                                                                                                        | Place                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Previews (1280) and thumbs (480) of every image, the shelf covers, data files, voice and music audio, posters, captions                     | Repo, `apps/web/public/` (about 0.3 GB new, so the pack does not grow much)                                                                                                                           |
| Films the site already ships                                                                                                                | Where they are now, `public/video/...`                                                                                                                                                                |
| Full quality art (up to 3840), comic page originals, full size scene stills, new films, the long videos, new animation tiers, original FLAC | R2 bucket `aspirant`, public at `https://s3.aspirant.cc`, key `library/v1/<collection>/<name>`, `Cache-Control: public, max-age=31536000, immutable`. About 6 to 8 GB in all, inside R2's free 10 GB. |

The WebGL covers and anything a canvas reads stay in the repo, so no texture needs CORS. A lightbox opens the full quality file from R2 with a plain `<img>`, which needs no CORS either.

R2 credentials stay outside the repo (`~/.config/aspirant/r2.env`, read by `upload.py`). CORS allows GET and HEAD with Range from `aspirant.cc` and localhost. `asset()` already passes full URLs through. The API token the owner pasted in chat expires on 11 Nov 2026 and should be rotated when the upload ends.

## Constraints that shape the build

- One version for everyone. No lite mode, no quality switch, no reduced motion code.
- Animate transform and opacity. No CSS `filter` or `backdrop-filter` over live pictures, so the shelf blur is drawn in WebGL.
- Only the first screen is waited for. Long films, full size art and the voice lines are deferred. Never fake progress.
- Video: use `VideoCard`. Nothing plays by itself except what the rules file already allows (muted loops inside the Animation stage count as stage playback and start on a press).
- Ten animated cover textures are still pictures, not ten video decodes. Only the focused cover may animate, and only with shader motion.
- Writing: short sentences, no dashes, "Aspirant power", `node scripts/qa/scan-text.mjs` reports 0 problems.
- Canon: the parody is labeled non-canon wherever it appears. Fan comics and fan art are labeled fan work. Official text keeps its facts. Lore uses `story/official` only.
- Repo hygiene: conventional commits under 100 characters, no tool or assistant named anywhere, `pnpm check` before a push, docs updated in the same commit, the production build looked at in Chrome at 1440x900, 1920x1080 and 390x844.

## Work order

1. Foundation: this design approved, `scripts/library` skeleton and inventory, the data schema and tests, the shelf and the shared shell with ten pages that already list real items.
2. Encode and upload early, because the R2 token expires on 11 Nov 2026: `videos.py`, `animation.py` and `upload.py` run in the background as soon as the inventory exists. The pages that use them are built later.
3. The lighter pages in parallel, one helper each with its own folder: Comic, Voicelines, Lore, Design, Fanart, Music, Others.
4. Arts, with the official art first and the scene stills after.
5. The heavy pages: Films (chapters, player), then Animation (all ten on one stage).
6. Quality pass: every route at three sizes, e2e specs, speed on the production build, `pnpm check`, scan-text, docs.

Release: all of it is built on the branch `collection-library`. The old `/collection` stays live on `main` until all ten pages are real and pass the checks. Then one merge to `main`, one push, and the deploy is watched. No cover on the shelf is ever hidden or marked "coming soon". Each phase ends in a commit on the branch.

## Calls made on the owner's behalf (change any of them)

- Routes are `/collection/<slug>` (singular, matching the existing route). `/collections/...` redirects.
- Music is the third shelf item. It is not described by the owner, so it holds the songs, the long audio and the music videos.
- The interactive drama stays on Vexana's page. Films links to it.
- The suspect site file `selena-obsidia/comic-video.mp4` (no source in the library, old wording in its text) is not carried over.
- The credit for We Believe is fixed to Yoshino Nanjo, as the sources say (the old page said Aino).
- Skin showcases, streams, matches, promo reels and the in-game animation get no scene stills.
- Every collection page ends with a short "Not official, not affiliated" line and a takedown contact. The site has no contact line today. The default is the project's GitHub issues page. Cosplay photos of real people (12 in the library) stay out of Fanart until the owner confirms the contact and says yes to them.
- Voice lines keep the Japanese text from the source file names and the English column of `voice.md`.
- Every source file is either mapped to a page or listed in `scripts/library/ignored.json` with a reason, and the inventory test fails on any other file. `_edits` (fan edits) go to Fanart as fan-made video. `_gameplay` clips go to Others as gameplay. The match and livestream recordings go to Films. Each item has one home page and may be linked from another (music videos and talks live in Films and are linked from Music).
- Search is across the whole library, from the shelf and from every page.
- The old design note that mentions a transition origin is out of date. Open uses a plain transition with a label.
- Storage: about 6 to 8 GB on R2 in total, so no paid plan is needed.

## Left to the builder

Exact cover art crops, colours and the motion curves of the shelf; the masonry and lightbox details; the chapter list design; the orbit viewer controls; encode settings within the limits above; how to split the helpers; test names.
