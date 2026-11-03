# Curator task: choose the visuals of a block of chapters

You are curating the pictures, comic panels, film clips and music for the story pages of the Aspirant website. The novel text is final and must not change. Your output is one JSON visual script per chapter of your block, nothing else.

## Read first, in this order

1. `D:\aspirant\docs\superpowers\specs\2026-11-03-story-visual-reader-design.md`: what the page is, "The visual script" (the schema) and "Curation rules" (binding).
2. `D:\aspirant\scripts\story\README.md`: the looking tools and where the sources are.

## For each chapter of your block

1. Print it: `cd D:\aspirant\scripts\story` then `C:\Users\muham\anaconda3\python.exe storytext.py c05` (numbered paragraphs, the dateline, voice lines marked). Read all of it.
2. Read its rows in `D:\ren\aspirant\story\main-build\source-log.md` (use Grep for `^\| 5 \|`; the prologue is `^\| P \|`). They name the official files and timestamps behind each scene. The scene's real picture is usually the comic page or the trailer moment they point at.
3. Find candidates and LOOK at them with the tools (contact sheets first, then single frames or crops). Choose only what you have actually seen. Check every crop and every frame in the preview before you write it down.
4. Write `D:\aspirant\scripts\story\visuals\cNN.json` (UTF-8, two-space indent) and run `C:\Users\muham\anaconda3\python.exe visuals.py cNN`. Fix every error. Read the warnings and fix those you agree with.

Work one chapter at a time and finish it before the next. Be efficient: contact sheets, not frame by frame. Keep scratch work in the tools' preview folder.

## What a good chapter looks like

- A **hero** that is the best single picture of the chapter's opening or its heart: it fills the screen as a title card (desktop 16:9, phone portrait with `heroFocus`). About a third of the heroes should be short clips (4 to 6 s) from the official films when a strong one exists; the rest are stills (a comic panel, a frame, an official art crop, a place). Heroes must be distinct across the book.
- **5 to 9 inserts**, placed after the paragraph they illustrate, mixing kinds (plate, clip, panels, place, portrait; `film` rarely). A chapter over 600 words should use at least 3 different kinds. Do not decorate: each insert shows something the text just said, or sets the place or the mood of the next stretch.
- **Comic panels** are the best source for scenes the Aspirant comic or the Guinevere and Vexana comic shows. Cut single panels (or two or three in a row) with `crop`; the crop must end at panel borders, with no speech bubbles cut in half and no neighbouring panel showing. Look at the strip slices with `strip.py` to find the y ranges.
- **Clips**: 3 to 8 seconds, one idea, from the scene cuts in `footages/`. Check for baked-in black bars, subtitles and logos; crop them out. Say in `alt` what happens in the clip.
- **portrait** inserts: one per Aspirant, at the chapter where the reader first meets her (table below). The card uses the site's own art for her by default; if that art would give away something the reader has not reached (Selena's or Vexana's Ender form, anyone's later look), add a `media` override with a fitting picture of her in the form the reader knows.
- **score**: a track that suits the chapter's people and mood (see the spec for the list; null for a chapter that should be quiet). Neighbouring chapters about the same people should share a track so the music does not jump.
- **thumb**: leave it out unless the hero is unsuitable as a small card. **spoiler**: set `true` only when the picture that best represents the chapter (hero or thumb) would reveal a later plot fact to someone who has not read that far (Selena as an Ender, the Mother Matrix, Vexana's Ender form, who the child in the prologue becomes). Prefer a safe thumb over `spoiler: true`.
- **mood**: one short, spoiler-free line (at most 120 characters) that sells the chapter on a preview card, in the book's plain voice. No dashes.

## Order in which the ten first appear in the book (portrait inserts)

Obsidia c00 (the prologue shows her). Layla c01. Fanny c01. Guinevere c04. Vexana c04. Lesley c07. Chang'e c07. Selena c07 (mentioned lightly; give her portrait where she matters to the reader, as a student in uniform, never as an Ender before chapter 43). Ruby c10. Angela c10. Other recurring people (Joe, Roger, Karina, Hester, Mr. Bunny, Tetra, the Mother Matrix from c24) have no portrait kind: use a `plate` from `_others/character` when it helps and fits.

## Hard rules (the validator checks most of them)

- Only official sources. Never fan art, cosplay, fanmade, `_edits`, `_gameplay`, in-game animation, the live-action parody. Never invent: a picture may not show an event the chapter does not tell.
- Do not show a character or a reveal before the book does.
- No em dashes or en dashes anywhere in the JSON. US spelling. Terrinia, Selrick, Storm Citadel, "aspirant power" (never "conviction").
- A source picture or panel may be used at most twice in the whole book; other curators work on other chapters at the same time, so prefer sources the source log ties to your chapters, and avoid the ten big splash arts as plates (the portrait cards use them).

## You must not

Edit any file except `visuals/cNN.json` of your own chapters. Run git. Change anything under `D:\ren\aspirant`. Run `build.py` (it does not exist yet).

## Report (at most 250 words)

Per chapter: hero type, number of inserts and their kinds, score, anything you could not fill and why. Then list any picture you are unsure matches the text, and any chapter where the official media gave you little.
