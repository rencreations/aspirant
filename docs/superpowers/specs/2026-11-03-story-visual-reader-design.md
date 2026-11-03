# The story page: a visual novel reader (design)

Date: 3 Nov 2026. Owner request: replace the old story on `/story` with the new novel (`D:\ren\aspirant\story\main.md`, "Aspirant", a prologue and 48 chapters) and make it a heavily visual read: images, comic panels, film clips, voice lines and music placed where the scene happens, so a reader sees and hears the story and is not bored by plain text.

This reverses the owner decision of 1 Nov 2026 ("the reader is plain text on one plain colour"). The owner has now asked for the opposite in plain words. The rules file and the handoff are updated in the same change.

## Goals

- Every chapter is its own page (`/story/prologue`, `/story/chapter-01` to `/story/chapter-48`) and opens with a full-screen title card (a film clip or an art still, the chapter number, title and the time and place line).
- Each chapter carries about 5 to 9 visuals chosen for that scene: wide stills, establishing shots of places, strips of official comic panels, muted film clips, character introduction cards. Voice lines in the text (88 in the book) play from the page. A music score sits under each stretch of the story (sound only when the visitor has sound on).
- The landing (`/story`) keeps the hero film and the Continue / Start reading call, and gets a spoiler-free description, a chapter preview grid with a picture for every chapter, the ten Aspirants, and a way into the story.
- A new reader needs nothing else: the book explains itself, the page adds pictures, names and a cast sheet.

## Non-goals and anti-goals

- No spoilers on the landing: the description and the cards give nothing away; pictures of late reveals (Selena's Ender form, the Matrix) are sealed on the landing until the visitor has reached that chapter.
- No invented story. The pictures illustrate the text; they never add events. No fan art, cosplay, `_edits`, `_gameplay` or in-game animation, and never the live-action parody.
- No lite version. One version, full motion, everything waits behind the loading screen (rules file).
- No infinite scroll: one chapter is one page.
- The old story (`short-v2`, 12 Parts, 62 chapters) is removed completely: its data, its reader, its tests.

## Source of truth

- Text: `D:\ren\aspirant\story\main.md` (built from `story/main-build/chapters/`). The build script reads it; it never edits it. Override the path with `ASPIRANT_STORY`.
- Pictures and film: the originals in `D:\ren\aspirant\media` (never modified; the site gets processed copies).
- Voice: `D:\ren\aspirant\audio\<name>\voice.md` through the markers `<!-- voice: audio/<name>/<file>.flac -->` in the text. The shipped lines are `public/audio/voice/<slug>/NN.m4a` (NN is the number in the file name).
- Which official source each scene comes from: `story/main-build/source-log.md` (rows per chapter, with file and line or timestamp).

## Pipeline

`scripts/story/` (Python, the anaconda one: `C:\Users\muham\anaconda3\python.exe`; ffmpeg on the PATH):

1. `storytext.py` parses `main.md` into chapters and blocks. A paragraph is a non-empty block of lines that is not a heading, a `<!-- voice -->` marker, a scene break (`* * *`) or the dateline (the first block after the heading when it is wholly italic). Paragraph numbers start at 0 after the dateline and count every paragraph in the chapter, in order.
2. `visuals/cNN.json` is the visual script of a chapter, written by hand (by the curators): which hero, which inserts, after which paragraph. `c00` is the prologue.
3. `build.py` validates the scripts against the text and the files, processes the media, and writes `apps/web/public/data/story/{index,cNN}.json`, `media.json` (id to file, size, colour) and `src/content/story-index.generated.ts`.
4. The site reads those files at build time. The chapter text is in the page's HTML.

## The visual script (`scripts/story/visuals/cNN.json`)

```jsonc
{
  "chapter": "c05",                  // c00 = Prologue
  "mood": "Day of the first attack on the dome", // optional, one short line for the card/preview, no spoilers
  "hero": <Media>,                   // required, the title card picture: image, frame or clip
  "heroFocus": "50% 40%",            // object-position on narrow screens
  "thumb": <Media|null>,             // picture for the chapter list; default is a still of the hero
  "spoiler": false,                  // true: the landing card is sealed until the visitor reaches this chapter
  "score": "we-believe",             // or null; see list below
  "inserts": [ <Insert>, ... ]
}
```

`<Media>` is one of (all `src` paths are relative to `D:\ren\aspirant\media`, forward slashes):

```jsonc
{ "type": "image", "src": "layla-and-fanny/art/comic/official-aspirant-comic/12.jpg",
  "crop": [x, y, w, h],             // source pixels, optional
  "alt": "…", "credit": "Official comic, page 12" }
{ "type": "frame", "src": "selena-and-obsidia/video/trailer/footages/00m08s208ms-00m15s125ms/footage.mp4",
  "t": 3.2,                          // seconds into that file
  "crop": [x, y, w, h], "alt": "…", "credit": "Official trailer" }
{ "type": "clip", "src": "…/footage.mp4", "start": 0.5, "end": 6.0,
  "crop": [x, y, w, h],             // optional
  "sound": false,                    // true keeps the clip's own sound; the visitor still starts it
  "poster": 1.2,                     // seconds into the clip used for the still, default the middle
  "alt": "…", "credit": "Official trailer" }
{ "type": "site", "src": "img/char/fanny/splash.webp", "alt": "…" }   // a file already in apps/web/public
```

`<Insert>`:

```jsonc
{ "after": 7,                        // placed after paragraph 7 of the chapter (0 based, see Pipeline 1)
  "anchor": "She went out through",  // the first words of that paragraph; the build checks it
  "kind": "plate",                   // plate | clip | panels | place | portrait | film
  "media": <Media> | [<Media>, …],   // panels takes 1 to 3 images
  "caption": "…",                    // optional, at most 90 characters
  "label": "Selrick Academy",        // place: the name shown on the picture
  "character": "fanny" }             // portrait: the character slug; media is optional (default from the site)
```

Kinds: `plate` is a wide still, full width. `clip` is a wide muted loop that plays while on screen. `panels` is one to three comic panels side by side (stacked on a phone). `place` is an establishing picture with its name. `portrait` is an introduction card for a character the first time she matters (name, Aspirant name, art); use it once per character, at the first chapter where the reader meets her. `film` is a whole official film from `apps/web/public/video/` in the site's player (`"public": "video/fanny-layla/trailer.mp4", "poster": "...", "title": "..."`); at most one per three chapters.

Scores (files in `public/audio/music/`): `we-believe` (Layla and Fanny), `guinevere-theme`, `vexana-theme`, `silverbolt-raiko` (Selena), `obsidia-theme`, `obsidia-aspirant`, `obsidia-solo`. A score is set per chapter; the player keeps playing the same track across chapters and crossfades when the next chapter names another.

### Curation rules

1. Truth first: the picture must show what the paragraph before it describes (right people, right place, right mood) or be a clearly fitting establishing shot. If nothing fits, leave the slot out. Do not stretch a match.
2. Never show a character or a reveal before the book does (check the chapter order, not the characters' lore): no Ruby or Angela before they are met, no Mother Matrix, Ender Selena or Ender Vexana early, no Obsidia's face before the prologue shows it.
3. Spacing: first insert after paragraph 2 or later; at least 3 paragraphs between inserts; no two clips next to each other; at most 2 `clip` inserts a chapter (the hero may also be a clip); at least 3 different kinds a chapter when the chapter is longer than 600 words.
4. Reuse: one source picture or panel at most twice in the whole book (different crops count as the same source). Prefer the comic and the film clips that the source log names for the chapter.
5. Sources allowed: official art (`art/official`, `art/lore`, `art/comic` of the two official comics: `layla-and-fanny/art/comic/official-aspirant-comic` and `vexana-and-guinevere/art/comic`), official videos and their `footages/*/footage.mp4` cuts, official stills in `_others/places` and `_others/character`, official promotional posts with an official caption. Not allowed: `fanart`, `cosplay`, `fanmade`, `_edits`, `_gameplay`, `in-game-animation`, `live-action`, anything marked non-canon.
6. Size: a clip is at most 8 seconds. A chapter ships at most about 6 MB of clips. Images are cropped to the subject; do not send a whole tall comic strip as one picture (crop panels).
7. Writing in `alt`, `caption`, `label`, `mood`: plain, short, no dashes (use a comma or a period), US spelling, Terrinia, Selrick, Storm Citadel, "aspirant power". Alt text says what is seen, in one sentence, without giving away what the text has not yet said.

## The reader

`features/story/reader/`, route `app/story/[chapter]/page.tsx` (static, `generateStaticParams` for the 49 chapters, plus `part-01` to `part-12` that redirect old links).

- **Title card:** full screen. A clip or a still, slowly pushed in (transform), a scrim for the text, the chapter label, the title, the time and place line, and a cue to scroll. On a clip, the picture is a muted loop that plays while on screen.
- **Text:** one column on a plain surface (white or the site's black, the visitor's choice, saved). Each paragraph is a `<p id="c05-p012" data-p>`. Dialogue and thoughts keep the book's own marks (italics). Scene breaks are a quiet glyph.
- **Voice lines:** the paragraph that ends with a marker gets a player under it: the speaker's round portrait, a play button, the waveform while it plays. Plays through the shared audio graph (`audio.playVoice`), asks for sound if it is off (`withSound`).
- **Inserts:** plate, clip, panels, place, portrait and film, as above. Images are lazy; a clip starts when 60 percent is on screen and stops when it leaves; at most two clips decode at once. All motion is transform and opacity (scroll-linked parallax through CSS scroll-driven animations when the browser has them, none otherwise).
- **Score:** a quiet music track under the chapter (`audio.playMusic`), crossfaded between chapters, silent when site sound is off. Voice lines duck it (the audio graph does this).
- **Chrome:** the mini-bar (chapter, progress, Contents, Settings). Contents lists the 49 pieces in Acts with a small picture each. Settings: text size and the light or dark theme. The place is saved as before.
- **End of a chapter:** a card for the next chapter with its picture and title; the one before; the list.
- **After the last chapter:** an end page `/story/the-end`: the cast sheet (the book's Characters) with portraits, the timeline, and the way on to the characters.

## Loading

Each chapter route lists in `route-preloads.ts`: the hero (poster plus clip, waited), the first two inserts, the fonts. Everything below is lazy by the browser or `deferred`. The landing lists the hero film and its still, and the first row of preview pictures; the rest is deferred.

## Old links

`storyChapterHref(oldId)` is kept for the About page and the character pages, which still carry text from the old story. It maps an old chapter id (`c01` to `c60`, `i-far-above-N`) to the nearest chapter of the new book (`legacy-map.ts`). `/story/part-NN` redirects to the first mapped chapter of that old Part. This is a stopgap: those pages still describe the old story and need their own pass.

## Tests

Unit: the parser (paragraph counting, dateline, voice markers), the visual script validator, chapter links, the legacy map, preferences. E2E (`e2e/story.spec.ts`): landing (hero, call, preview grid, sealed cards), a chapter page (title card, text, inserts present, voice player, next card), settings, contents, the saved place, redirects, the end page, no horizontal scroll at phone size, axe.

## Size budget

New media about 300 MB: stills about 120 to 250 KB each, clips about 1 to 3 MB each (960 wide, H.264, 24 fps, AAC 48 kbps only where sound is kept). Everything is produced by `scripts/story/build.py` from the originals; nothing is hand-copied.
