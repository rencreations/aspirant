# Collection redesign: Music, Video (Films and Others), Animation

Status: built, 10 Nov 2026 (how each room works and its files: [`docs/design/collection-rooms.md`](../../design/collection-rooms.md)). Written as the working design before the build. The owner's request, word for word, is in [2026-11-10-collection-redesign-request.md](2026-11-10-collection-redesign-request.md). Read it first. It overrides anything here where they differ. This file records how it is built and the calls made on the owner's behalf.

## What the owner wants

Four rooms of `/collection` are rebuilt from scratch, each as a faithful copy of a reference site, in the site's own design system:

| Room          | Reference                                          | Route                                                           |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Music         | <https://a24.raviklaassens.com/> (3D discs)        | `/collection/music`                                             |
| Video, Films  | <https://www.juliencalot.com/> (full-bleed works)  | `/collection/video/films`                                       |
| Video, Others | none: an easy browsing page, like the collection   | `/collection/video/others`                                      |
| Animation     | <https://apechain.com/> hero only (panel carousel) | `/collection/animation` and `/collection/animation/<character>` |

And the shelf: the "Films" cover becomes "Video". Pressing it splits the square into two choices, Films and Others, with a smooth animation.

Copy the structure, motion and feeling of the reference. Do not copy its code, text, pictures or fonts. Read the reference's public page and scripts to understand how it behaves, then build it in our stack. The site's rules (`CLAUDE.md`) still hold: one version, transform and opacity, a real loading bar, light theme by default, no dashes, no tool named.

## Calls made on the owner's behalf (change any of them)

1. **Slugs and routes.** The shelf slot 02 is `video` (display name "Video"). `/collection/video` is a plain page with the two ways in (the no-WebGL fallback and the page crawlers see). `/collection/video/films` and `/collection/video/others` are the two rooms. The old `/collection/films?i=<id>&t=<s>` forwards to the right room. The tenth shelf slot is still called "Others" (odds and ends, `/collection/others`). The video room is titled "Others" under the Video heading. The two are different pages.
2. **Films = the ten files in the owner's order**, no more. `FILM_IDS` in `features/library/video/links.ts` holds their ids.
3. **Others = every video in `D:\ren\aspirant\media` that is not a Film and not footage**, with one exception: the raw in-game animation recordings (`media/_others/in-game-animation/**/*.mkv`, about 12 GB). They are the source of the Animation room and are not watchable films. Everything else is in: shorts, showcases, interviews, behind the scenes, music films, events, the interactive drama episodes, livestreams, the match recording, emotes, promotional reels, fan videos and edits, gameplay clips, the live-action parody. Canon labels stay (`CanonBadge`, `CreditLine`). Files already encoded for the old Films room are reused, not encoded again.
4. **Films are encoded once, at full quality**: H.264 High, yuv420p, `faststart`, the source's own width and height (never scaled down: 1920x1080 or 2560x1080), CRF 17 to 18, the source frame rate, AAC audio at 192k. Three sources are AV1 or VP9 and several browsers cannot play AV1 in an mp4, so H.264 is the one version. The files go to R2 under `video/films/<id>/video.mp4` (see `scripts/library/README.md`).
5. **Sound.** Films autoplay when they scroll into view. They start with sound when the browser allows it (the visitor has already pressed something in this page, which the shelf click guarantees) and the site sound is on, otherwise muted with a clear sound button. A sound button is always there.
6. **Animation order** is by pair, the roster order: Selena, Obsidia, Guinevere, Vexana, Lesley, Chang'e, Ruby, Angela, Layla, Fanny. The owner's list names films (it matches the Films order), but the Animation room is about characters, so the film names were read as the pair order. The trailers are not Animation items.
7. **The other six rooms are unchanged** (Arts, Voicelines, Fanart, Comic, Lore, Design) and the tenth (Others) keeps its page. They keep `LibraryShell`, with its switcher. The four rebuilt rooms do not use `LibraryShell`: they are full screen, have a transparent top bar and one "Collection" button back to the shelf.

## Shared pieces (already in the repository)

- `features/library/shell/room-chrome.tsx`: `useTransparentNav("storm" | "daybreak")` (the top bar has no background, the page name and buttons stay) and `<BackToCollection tone="light|dark" />` (the one way out). `storm` is for a dark page behind the bar.
- `features/library/video/links.ts`: `FILM_IDS`, `videoRoomOf(id)`, `videoRoute(room)`, `videoHref(id, t?)`. Both video rooms read `?i=<id>` and `?t=<seconds>`.
- `features/library/video/video-room.tsx` maps a room to its page. `features/library/preloads.ts` maps a route to its loading list (`libraryPageItems("video/films")`).
- `features/library/data.ts`: `useLibraryData("music" | "video-films" | "video-others" | ...)`, `libraryDataItem(name)`.
- Data files in `apps/web/public/data/library/`: `video-films.json` (ten items), `video-others.json` (the rest). Both have `slug: "video"`, items extend `ItemBase` with `collection: "video"`. `build_index.py` reads both under the Video count and `search.json`.

## Loading (applies to every room)

Everything the first screen needs is a `PreloadItem` in the room's `preload.ts`, and the bar is real. Pictures, data and code chunks go through `lib/preload.ts`, small files through `cachedFetch`. Only what the visitor sees or hears first is waited for; the rest is `deferred` and streams in the background by `priority`.

**Big video is the exception to "load whole into memory".** A film is 35 to 250 MB, and the Films room has ten. The Films room keeps a real, measured buffer: the loading list waits until the first film has buffered its first seconds (a hidden `<video>` or ranged fetches, progress = seconds buffered over the target, never a timer), the next film is buffered while the current one plays, and a film that is not ready yet shows its thumbnail and a real loading state, never a black frame. Details are the helper's to design and must be written in the room's section of `docs/design/design-system.md`.

## The rooms

### A. Music (`features/library/music/`, rebuilt)

Copy a24.raviklaassens.com: a field of 3D discs. Read the reference with a real browser (frame sheets at idle, on hover, on press, while scrolling, at the start and at the end) and read its scripts to learn the disc's geometry (rim bevel, hub ring, hole, the sleeve art mapped on the face), the tilt, the way the discs follow the scroll and the pointer, the focus on the current disc, the title block, and the press. Reproduce each of them. Then:

- Each track is a disc, its cover is the disc face (cover art, circular text, the hole). The nine tracks are in `public/data/library/music.json`.
- Scroll is infinite: past the last disc the first comes back, and back past the first. No end.
- No ratings, no quotes. The title block shows title, credit and year like the reference's director line, in our type.
- A press on the disc does what the reference does on a press (focus, open, play). Music plays through the site's player (`player-store`, the mini player). Keep the track credits and the downloads that exist today if they fit.
- No switcher to other rooms. `BackToCollection`. Transparent bar.
- **The drawn line.** The reference has a component that draws a line while the page scrolls or while a disc is hovered. Make our own with the same idea and a form that belongs to music (a record groove, a tonearm trace, a waveform that draws itself). It must feel unique and fit the page. Transform, opacity and SVG stroke dash only (no per-frame attribute writes: use a CSS or Web Animation on `stroke-dashoffset`, or draw it in the WebGL scene).
- Keep what the old page did that still matters: deep links (`?i=<id>`), the queue and mini player, credits, the Japanese or English title where the data has it.
- WebGL is raw three.js in one lazy chunk, render on demand, like the shelf (`features/library/shelf/`). Wait for the scene with `expectReady`. No WebGL: the plain list of tracks (a failure, not a version).

### B. Films (`features/library/video/films/`, new)

Copy juliencalot.com: read how its home works (the loader with a percentage, the full-bleed work that fills the screen, the title, the years and counts at the sides, the way the next work comes in on scroll, the cursor, the menu) and rebuild it with our films. One film is one "work". The page is a vertical, snapping, infinite scroll: the end goes back to the beginning, and back from the first goes to the last.

- Only the ten films, in the owner's order (`FILM_IDS`). The title, the kind and the year or count labels come from the data.
- A film plays by itself, full bleed, when it scrolls into view, and pauses when it leaves. Its thumbnail (the `thumbnail.jpg` beside the source video) is the poster and shows while the film loads. At full quality, never scaled down.
- The next film is preloaded while the current one plays, so it plays at once when the visitor scrolls. The first film is ready when the page opens (see Loading).
- A button opens an index (a contents sheet) of the ten films. Pressing one jumps to it directly. A smooth jump, then it plays.
- Transparent bar. One button back to `/collection`. No link to other rooms.
- Subtitles: the sources have `english.srt` for some films. Offer them as a toggle if they exist. Sound button always.
- Deep link `?i=<id>&t=<seconds>`.
- Pipeline `scripts/library/video_films/build.py` (new): picks the ten sources, encodes them as in call 4, copies the thumbnails (a 1920 WebP and a small one), writes `video-films.json`, writes into the mirror `D:\ren\aspirant-r2`. Item shape: `ItemBase` plus `kind`, `year` (if the sources know it), `video: LibVideo`, `thumb`, `c` (average colour), `bytes`, `desc`.

### C. Others (`features/library/video/others/`, built from the old Films room)

The old Films room (57 films, featured film, rows by kind, a cinema player) was moved here as the starting point. Rebuild it as a page that is easy to scroll and to search: every video visible just by scrolling, like the collection. Not a copy of the Films page and not focused on one video. Think about the experience: a dense but calm wall, kinds as sections or filters, hover previews on desktop, a quick way to find a video (search, character, pair, kind, canon, duration), an opening view that plays a video in place without leaving the scroll, deep link `?i=<id>&t=<s>`. Labels: fan and non-canon items always show the badge and the credit. Takedown line at the end. Transparent bar, `BackToCollection`, no switcher.

- Pipeline: `scripts/library/films/build.py` (the old one) is updated to write `video-others.json` from a fresh scan of `D:\ren\aspirant\media`, using the exclusions in call 3 and leaving out the ten Films. It reuses what is already in the mirror. Report every video it found and where it went, and every one it left out and why. The interactive drama episodes: keep the group as one entry per episode set, as the old data did.
- Every video file not yet in the mirror is encoded as before (H.264 High, at most 1080p unless the source is wider, 2560x1080 stays) and uploaded by the final sync.
- `e2e/library-video-others.spec.ts` is the old Films spec, to be rewritten for this room.

### D. Animation (`features/library/animation/`, rebuilt, plus `/collection/animation/<character>`)

Copy the hero of apechain.com and nothing below it: a full-screen panel carousel. Read how it moves (the slow automatic drift to the next panel, the drag, the swipe, the panel frames, the launch button, the small previews, the side buttons). Then:

- One panel per character, in the pair order (call 6). Scroll down or swipe left and right to move to the next or the previous panel. No other sections.
- When a panel arrives it plays that character's welcome animation, then settles into its idle loop, forever. Every arrival plays the welcome again, even for a panel seen before.
- A Launch button below the panel, and the panel itself, open the full screen view. The panel morphs smoothly to full screen with the video continuing, whether it was in the welcome or in the idle. No cut.
- Full screen is its own route, `/collection/animation/<character>` (`generateStaticParams` for the ten). It shows only that character's animation, with its options as buttons on the right to play the other animations. No progress bar, no time, no controls that say "video". It must feel like a live 3D character. A back button returns to `/collection/animation`, morphing back to where the panel was. A direct visit to the route works too (it opens with a plain fade in).
- While nobody touches it, the carousel moves on to the next panel by itself, slowly, like a slow drag (as in the reference).
- The existing stage engine (`features/character/stage/`) and the data in `features/library/animation/stage-data/` are the base for playing the clips smoothly (idle loop, welcome, cuts back to idle). Reuse them. Do not show timestamps.
- Transparent bar, `BackToCollection` to `/collection` on the carousel, and a back button to `/collection/animation` in full screen.

### E. The shelf (`features/library/shelf/`) and the Video cover

- The Video cover (a new picture made by `scripts/library/covers.py`) is a square with the name "Video". Press it (or Open): the square splits into two, smoothly, inside the WebGL scene. One half becomes "Films", the other "Others", each with its own name, one line and an Open button. Esc, a click outside or a Back control closes the split. Open on a half goes to `/collection/video/films` or `/collection/video/others`. Phones too (the vertical stack).
- The split state may be in the address (`/collection?open=video`) so the browser Back from a Video room returns to the split. `/collection/video` is the plain fallback page and is also what no-WebGL visitors and crawlers get: two big tiles.
- Counts under the Video name: the total from `index.json`.
- Keep every other shelf behaviour. The shelf spec is `e2e/library-shelf.spec.ts`.

## Rules for every helper

- **Own your folder.** Do not edit another room's folder or a shared file (`registry.ts`, `types.ts`, `preloads.ts`, `library-room.tsx`, `lib/route-preloads.ts`, `app/` routes, `CLAUDE.md`, the docs index). If you need a change there, say so in your report and the main session makes it. Exceptions: the shelf helper owns `features/library/shelf/` and `scripts/library/covers.py`; the Animation helper owns `app/collection/animation/` and the Animation routes.
- **Do not commit, do not push, do not run `pnpm build`** (it replaces `apps/web/out`). Do not run `r2.py sync` (the main session uploads once at the end). Write media into the mirror `D:\ren\aspirant-r2\library\v1\...` with `common.key_path`.
- **Dev server:** `http://localhost:3100` is a running `next dev` that reads library files from the local mirror (`NEXT_PUBLIC_LIBRARY_ORIGIN=http://localhost:3300`, served by `npx serve D:\ren\aspirant-r2 -l 3300 --cors`). Do not start another. Judge speed on the production build later (the main session builds); on dev, judge correctness.
- **Look at it.** Use Chrome through Playwright (`channel: "chrome"`, see `scripts/qa/probes/lib.cjs`) at 1440x900, 1920x1080 and 390x844. Take screenshots into your own folder in the scratchpad and read them. Compare with the reference side by side. Test idle, hover, press, scroll, the ends, a slow network (`throttle` in `lib.cjs`) and a failed file. Say plainly what you did not check.
- **Reference recon.** `ref-shots.cjs` in the scratchpad takes screenshots of a site at a few moments. Extend it: record frame sequences with `page.screenshot` in a loop, or CDP screencast, for animations. Read the reference's scripts with `curl` into your scratch folder.
- **Rules from `CLAUDE.md` that bite here:** transform and opacity only in motion; never write a style or custom property on `<html>` or `<body>` per frame; no `filter`, `backdrop-filter` or `mix-blend-mode` over live pictures or video; no performance levels or device checks; no reduced motion code; no timers that fake progress; no `timeoutMs`; the page tells the curtain it is ready with `expectReady`; one `h1`; no dashes in any shipped text; "Aspirant power"; spell Terrinia, Selrick, Storm Citadel.
- **Tests.** Add or update unit tests for pure logic (Vitest, next to the code) and one Playwright spec per room (`apps/web/e2e/library-<room>.spec.ts`, using `skipGate` from `e2e/helpers.ts`). Do not run the whole suite.
- **Write the docs for your room** (a short section in `docs/design/design-system.md` under the collection, and the list of files) in your final report text, and the main session merges it into the docs.
- **Report briefly**: what you built, the files, the numbers (sizes, timings), what you checked and with what, what you did not check, anything the main session must change in shared files.

## Risks and open points

- Release: the data files name R2 keys that do not exist until `r2.py sync` runs. The main session uploads before the push, and checks `https://s3.aspirant.cc/...` answers 200 with Range for a sample of each new key.
- The repository pack is already above 5 GiB. Nothing big goes into `public/`. The covers made for the shelf and the discs are small.
- Browsers: Chrome and Edge are tested. Safari and Firefox are not.
