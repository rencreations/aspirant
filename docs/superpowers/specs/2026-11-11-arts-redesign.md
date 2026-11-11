# Arts rebuilt: Official, Fanart and Cosplay (11 Nov 2026)

The owner's words, word for word, are in [2026-11-11-arts-request.md](2026-11-11-arts-request.md). They override this file. How the rooms work today: [`docs/design/collection-rooms.md`](../../design/collection-rooms.md). The rules every helper follows (the shared checkout, the dev servers, the checks): [2026-11-11-collection-round2.md](2026-11-11-collection-round2.md), "Rules for every helper", plus the ones below.

## What was asked, in one list

1. Arts splits into three on the shelf, like Video: **Official**, **Fanart**, **Cosplay**. Fanart is the old Fanart room, now inside Arts.
2. Shelf slot 05 (it was Fanart) becomes **3D Models**. The 3D models leave the Others room and live there.
3. **Official** has six sub-pages: Splash art, Scene, Comic, Game, Design, Others. Their pictures come from `D:\ren\aspirant\media\_all` first, then the rest of `D:\ren\aspirant`.
4. **Splash art** is a 1:1 copy of the home page of https://www.east64films.com/ in our design system: one picture per section, the next one revealed as the visitor scrolls, endless (it loops), a cursor that says "Zoom In" over the picture, a morph to full screen on a press (fit width, nothing cut), "Zoom Out" to come back. Pictures that are not 16:9 are cropped as little as possible, and the full picture always shows when zoomed.
5. **Scene**, **Game**, **Others** (official) and **Fanart** are "a flow of images": rows that slide sideways with the scroll, alternating direction, like the Gallery of https://www.east64films.com/works/hodinkee-x-g-shock/ . _Changed on 12 Nov 2026: the owner found the sliding too much motion. They are now a still wall, grouped by Aspirant (see `docs/design/collection-rooms.md`, "The still walls"). Search, the filter, the zoom and the outline are as asked._ Search, a filter by what appears most (with "See more"), the sub-page buttons and a way back, nothing else. Same zoom and cursor as Splash art. The hovered picture gets an outline.
6. **Comic** shows the art made for the comics (panels without the words), whatever their shape, big enough to read.
7. **Design** is the few character designs and sheets.
8. **Cosplay**: all ten Aspirants, a sub-page for each, even an Aspirant with no picture.

## Calls made while the owner slept

- **Routes, taken literally.** `/collection/arts` is Splash art. `/collection/arts/{scene,comic,game,design,others}` are the other Official sub-pages. `/collection/arts/fanart` is Fanart. `/collection/arts/cosplay` is the roster of the ten and `/collection/arts/cosplay/<slug>` is one Aspirant (ten static pages). `/collection/models` is 3D Models. The shelf is the chooser (`/collection?open=arts`, the Arts cover opens like the Video cover, into three), so the browser's Back from any Arts room comes back to the open cover. `/collection/fanart` (and `?i=`) forwards to `/collection/arts/fanart`.
- **The Official page is about official art only.** The `splash-art` folders hold pictures that are not official: the ones with an image generator's file names and similar, in-game screenshots, copies. A generated picture is never labelled official and never shown as a character's splash art. If it belongs on the site it goes to Official, Others with the credit "Made for this site" and the note "Generated for this site. Not official art." (`canon: "fan"`). The call is logged in `docs/OPEN-QUESTIONS.md`.
- **Dedupe first.** `_all` has 1730 files and only about 1024 are different pictures (the same file sits in several entity folders, and a screenshot is often taken twice). A picture is one item, found by content hash and, for re-taken screenshots, by a difference hash. Its `places` are all the entity folders it sat in (`oro-attack`, `android`, `angela` ...). The Scene filter counts these.
- **Names of the filter** come from the folder names, spelled as canon (`docs/design/canon-rules.md`, the lore codex names), for example `selrick-academy` is "Selrick Academy", `change` is "Chang'e", `mother-matrix` is "Mother Matrix". The filter shows the few with the most pictures and "See more" for the rest.
- **Comic.** The real shapes of the 115 different comic files are mostly tall (webtoon strips, 1:2 to 1:4) and square to wide, with very few wide ones, so "ultra long" here means tall. The room is built for the real distribution, and for any shape.
- **Metadata is never invented.** Artist, date and place come from the captions index (`media/_captions/captions.json`), the post folder names, the file names and the official pages. Where nothing says, the field is null and the page says nothing about it.
- **Nothing is upscaled.** A 1024 px square cropped to 16:9 is soft at full screen, so a picture that is too small for its frame is shown at its own size, centred, never stretched, or is left out of Splash art (and goes to Others).
- **One home per item** (as in the first design): a picture that already has a room of its own outside Arts (the promotional posts in Design, the two webtoons in Comic, the atlas in Lore) is not copied into Arts. The 34 pictures of the old Arts room are merged in by hash, so none is shown twice.

## Routes and files

```
app/collection/arts/page.tsx                 Splash art
app/collection/arts/[room]/page.tsx          scene | comic | game | design | others | fanart   (static params)
app/collection/arts/cosplay/page.tsx         the ten, as a roster
app/collection/arts/cosplay/[character]/page.tsx   ten static pages
app/collection/models/page.tsx               3D Models
app/collection/fanart/page.tsx               client forward to /collection/arts/fanart (keeps ?i=)
```

Feature code is `apps/web/src/features/library/arts/`:

```
core/        shared by every Arts room: routes.ts, types.ts, chrome.tsx (bar, back, sub-page buttons, takedown),
             data.ts (useArtsData), zoom/ (cursor and morph viewer), flow/ (the alternating rows)
splash/      Splash art (east64 home)
scene/ game/ others/    thin pages over flow/ with their data and filters
comic/ design/          their own designs
fanart/      the old Fanart room, moved here, on flow/
cosplay/     the roster and the ten pages
```

`features/library/models/` is the 3D Models room (slot 05). `features/library/fanart/` and the old `arts/` files (ribbon, odometer, scenes, official tab) are removed once the new rooms stand.

## Data

- Media in R2 under `arts/v2/<room>/<id>/{t,p,f}.webp` (`common.image_set`: `t` 480, `p` 1280, `f` up to 3840, never upscaled, WebP). New keys only: a key that exists is cached for 30 days and is never changed. Comic panels that are taller than 3840 keep their width at up to 2000 px and get more tiles if needed (see the Comic helper).
- Data in the repo: `public/data/library/arts-<room>.json` for `splash scene comic game design others cosplay` and `arts-fanart.json` (the old `fanart.json`, rebuilt without its cosplay items). Each is `{ v: 1, slug: "arts-<room>", room, items: [...] }`. Items extend `ArtsItem` (`core/types.ts`): `id`, `title`, `collection: "arts"`, `room`, `chars`, `pair`, `canon`, `tags`, `credit?`, `img: LibImage` (the whole picture, never cropped), `alt`, `places: string[]`, and the fields of their room (Splash: `frame`, `focus`, `facts`; Comic: `comic`, `page`).
- The old `arts.json`, `arts-scenes.json` and `fanart.json` are left in the repo until the new rooms are verified and then deleted with their code. `build_index.py` reads the new files into `index.json` `rooms` (`arts/official`, `arts/fanart`, `arts/cosplay`, `models`) and `search.json`.
- The scripts are in `scripts/library/arts_rooms/` (`inventory.py` and `analyse.py` are done; `catalog.py` loads the inventory, dedupes and classifies by source folder; one script per room).

## Contracts every Arts room follows

- **Chrome.** The top bar has no background (`useTransparentNav`). A way back (`BackToCollection`, to `/collection?open=arts`), the sub-page buttons of the Official family, a takedown line (`TAKEDOWN_URL`) at the end of the page. Nothing else on screen but search, the filter and the pictures.
- **Zoom** (`core/zoom/`). One cursor element moved with `transform`: "Zoom In" over a picture, "Zoom Out" over the open picture, the normal lantern elsewhere. A press morphs the picture from its place to the screen (two nested translating clips as in `features/story/morph/morph-math.ts`, nothing stretched, transform and opacity only), contained in view, never cut. A press or Esc morphs it back. `?i=<id>` deep link and `useLightboxParam`-like history (Back closes). Touch: tap to zoom, tap to close.
- **Flow** (`core/flow/`). Only rows near the viewport mount. Each row moves with the scroll by transform, one direction down, the other up, alternating row by row, and the travel is bounded by the row's own pass through the screen. Pictures in rows use `t` (480), the zoom uses `p` then `f`. The hovered picture has an outline. Smooth on a normal laptop on the production build.
- **Loading.** Only the first screen is in the room's `preload.ts` list (the data, the chunk, the first pictures). Everything else is lazy or `deferred`. No fake progress.
- **Rules of the site apply:** one version for every device, no reduced motion code, transform and opacity only in motion, no `filter` or `backdrop-filter` over live pictures, no dashes in shipped text, canon spellings.
- **Labels.** Fan items show `CanonBadge` and `CreditLine`. Cosplay keeps the earlier decision: only posts that are identified and credited, and no minors.

## Who owns what

Never touch a file you do not own. Shared files are changed only by the main session (it merges your notes).

| Owner                                   | Files                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main session                            | `features/library/{types,registry,preloads,library-room,data}.ts*`, `app/collection/**`, `arts/core/{routes,types,data}.ts`, `arts/core/chrome.tsx`, `video/links.ts`, `lib/route-preloads.ts`, `search/**`, `scripts/library/build_index.py`, `scripts/library/arts_rooms/{inventory,analyse,catalog}.py`, docs, `CLAUDE.md`, `ignored.json` |
| Reference (east64 home, east64 gallery) | `docs/design/arts-reference.md`, `docs/design/collection-reference/east64/**`                                                                                                                                                                                                                                                                 |
| Data helpers                            | `scripts/library/arts_rooms/<room>.py`, `public/data/library/arts-<room>.json`, mirror `arts/v2/<room>/`                                                                                                                                                                                                                                      |
| Zoom                                    | `arts/core/zoom/**`                                                                                                                                                                                                                                                                                                                           |
| Flow                                    | `arts/core/flow/**`, `arts/{scene,game,others}/**`                                                                                                                                                                                                                                                                                            |
| Splash                                  | `arts/splash/**`                                                                                                                                                                                                                                                                                                                              |
| Comic, Design                           | `arts/comic/**`, `arts/design/**`                                                                                                                                                                                                                                                                                                             |
| Fanart                                  | `arts/fanart/**`, `scripts/library/fanart/**`                                                                                                                                                                                                                                                                                                 |
| Cosplay                                 | `arts/cosplay/**`                                                                                                                                                                                                                                                                                                                             |
| Models                                  | `features/library/models/**`, `features/library/others/**`, `scripts/library/others/**`, `public/data/library/{models,others}.json`                                                                                                                                                                                                           |
| Shelf                                   | `features/library/shelf/**`, `scripts/library/covers.py`, covers in the mirror                                                                                                                                                                                                                                                                |

## Process

- **One browser at a time.** The machine ran short of memory before. Before opening Chrome take the lock with `mkdir D:/ren/aspirant-work/locks/chrome` (it fails if another helper holds it: wait 20 seconds and try again), and `rmdir` it when the browser is closed. Never keep Chrome open between steps.
- **Dev server.** Run your own on a private build folder so it never touches the owner's: `NEXT_DIST_DIR=.next-arts NEXT_PUBLIC_LIBRARY_ORIGIN=http://localhost:3300 npx next dev -p 3110` from `apps/web`, with the mirror served by `npx serve D:\ren\aspirant-r2 -l 3300 --cors`. The main session starts both. New media is read from the mirror, so nothing is uploaded until the end. Never run `pnpm build`.
- **Python:** `C:/Users/muham/anaconda3/python.exe`, scratch on D: (`D:\ren\aspirant-work\arts_rooms\`), `import common` as the other pipelines do.
- **No commits.** The main session commits by named paths, with no mention of any assistant (see `CLAUDE.md`).
