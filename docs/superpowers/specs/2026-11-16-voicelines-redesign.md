# Voicelines room, rebuilt 16 Nov 2026

The request is in [2026-11-16-voicelines-request.md](2026-11-16-voicelines-request.md). Code: `apps/web/src/features/library/voicelines/`, routes `app/collection/voicelines/` and `app/collection/voicelines/[character]/`, pipeline `scripts/library/voicelines/` (`build.py`, `hero.py`). How the two pages work is in `docs/design/collection-rooms.md`, "Voicelines".

## What it is

- **The room** (`/collection/voicelines`): the film behind a simple title, then the ten Aspirants in the layout of the Cosplay roster (one pair to a column from 1000 px, two columns below). Under each picture: a row for each of the eight languages (flag, the name of the language in itself, how many lines it has) and one larger button that opens her page in Japanese.
- **The page of an Aspirant** (`/collection/voicelines/<slug>`): her name and art, the eight languages in a rail on the side (a row that slides sideways on a phone), and her lines in the open language. The language is a parameter of this one page, `?lang=jp` (`ja` is read too, and an unknown value is Japanese). One button back, to the room.
- **A line** has a play button, its number (a link to it), the text in its language, a translation under it, its length (a live waveform while it plays) and a download. A line with no recording says so. The toolbar has a search, the translation, "Play all" (the next line starts when one ends) and "Download all" (one zip).
- **Japanese** adds what the room already had: the full recording of her lines, and her trailer clips.

## The calls

1. **Seven languages are one list, Japanese is its own.** English, Arabic, Indonesian, Spanish, Portuguese, Turkish and Russian have the same number of lines for every Aspirant, and the lengths of the clips agree line by line (checked for all ten, see the pipeline's notes), so line N is the same line in all seven and each can be the translation of the others. The Japanese game has its own order and a few other lines (Fanny's Japanese line 1 is not her English line 1): a Japanese line is never shown as the same line of another language. It carries its own English translation, which is what `Translate` offers there. This is why `?tr=` offers six languages on a page of the shared list and one on the Japanese page.
2. **Keys.** The Japanese keys of the first version are untouched (`voicelines/<slug>/NN.{m4a,flac}`), so nothing in the bucket changes. The seven new languages are `voicelines/<slug>/<lang>/NN.{m4a,flac}`, the trailer clips of Selena are `voicelines/<slug>/trailer/NN.*`, and the film is `voicelines/hero/v1/`. AAC at 96 kbps plays; the original (FLAC, or mp3 for the six Japanese rows that came as mp3) is what a download saves. Nothing is written twice, so a bucket that already holds the first version is only added to.
3. **Data.** `voicelines.json` is the index (the table of languages, the ten cards, the film, the search items). `voicelines-<slug>.json` holds one Aspirant in every language, so switching language does not fetch anything. The ids of the first version (`voice-<slug>-NN`, `voice-<slug>-full`, `voice-trailer-NN`) are kept; the English lines have `voice-<slug>-en-NN`.
4. **The film is cut, not cropped.** The recording has a subtitle and a name card burned in for one stretch only (found by scanning it at ten frames a second: the card at 4.8 to 9.0 s, the subtitle at 5.4 to 11.5 s). The page takes the first 4.6 s and the last 16.7 s and keeps the whole 16:9 frame, instead of a 2.7:1 strip that would be softer on a wide screen and a sliver on a phone. The loop dissolves into itself. It is the Design room's film (`scripts/library/design/hero.py`), and the page is the Design room's join (`stage.tsx`): the page rises over the film, a stop settles after a second, the top bar takes its plate when the page docks.
5. **Language changes never add to the history.** `?lang=`, `?tr=`, `?q=` and `?i=` are written with `replaceState` (`useQueryState`), so the browser's Back from a page goes to the room, whatever was done on it. The button at the top is a link to the room.
6. **The flags are SVG** (a browser on Windows draws no flag emoji). English carries the flag of the United Kingdom, Portuguese Brazil's (the voice lines are in the Brazilian way of speaking), Arabic the United Arab Emirates (Arabic has no country of its own and the flag is only an anchor for the eye; the name is always written beside it).
7. **Text.** Every text and name carries its own `lang` and `dir` (Arabic reads right to left) and is never changed to upper case with CSS (a Turkish i would become the wrong letter). Search ignores case and accents.
8. **Old addresses.** `?who=<slug>` and `?i=<id>` (a line, a recording or a trailer clip, which the library search also uses) are sent to the page of that Aspirant, in the language of the id. A search result of this room opens the page the same way (`search-overlay.tsx`).
9. **A word the site bans.** The tentative English translation that came with Selena's trailer clip 17 used the English word that the site bans. The owner's ruling is that 信念 is "aspirant power" and the site never says the other word, so the pipeline writes "aspirant power" there (`canon_words` in `build.py`). It is the only place.
10. **Lines whose text comes from the audio.** Three lines had no text in the screenshots the transcripts were read from (Spanish Chang'e 16, Turkish Obsidia 41, Arabic Selena 47), so their words are what the recording says. The page says so under each (`Note`).

## Not part of the site

The audio folder was corrected in the same round (recordings added, texts replaced, clips re-cut). One of those fixes matters here: the Arabic Selena recording had her lines 46 and 47 in one clip, so she had 46 lines; it is two clips now.

## Open

- The bucket does not hold the new files yet. `python scripts/library/r2.py sync` publishes them (about 1 GB of FLAC and 140 MB of AAC, and the film); until then the live site would ask for files that are not there. A local mirror and `NEXT_PUBLIC_LIBRARY_ORIGIN` show the room as it will be (`scripts/library/README.md`).
- Search finds the Japanese and the English lines. The other six languages are on the pages but not in the search index (it would add about 400 KB).
