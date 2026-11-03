# Review task: check the pictures of built chapters against their text

The pictures of every chapter of the story pages were chosen by hand (the visual scripts `scripts/story/visuals/cNN.json`) and built. You review a block of chapters the way a reader would meet them, and fix what is clearly wrong. Read `docs/superpowers/specs/2026-11-03-story-visual-reader-design.md` ("The visual script" and "Curation rules") and `scripts/story/README.md` first.

## For each chapter of your block

1. Print the text: `cd D:\aspirant\scripts\story` then `C:\Users\muham\anaconda3\python.exe storytext.py c05`.
2. Make its storyboard sheet and open it with the Read tool: `C:\Users\muham\anaconda3\python.exe tools\storyboard.py c05` prints a JPEG path. Each row is: the paragraph an insert follows (left), the picture or pictures with their alt text (right). A clip shows its still and the word CLIP. Read the sheet at its full size.
3. Judge every picture against the text and against the rules below.
4. Fix clear errors in `visuals/cNN.json` of YOUR chapters only (see "What you may change"), then run `C:\Users\muham\anaconda3\python.exe visuals.py cNN` and get 0 errors.

## What to check

- **Fit.** The picture shows what the paragraph before it says (the right people, place, action and mood), or is a clearly fitting establishing shot. A near miss that still reads as the scene is fine; a wrong person, a wrong place, a wrong action or a picture of something the text does not say is not.
- **Spoilers.** The reader knows only what the book has told them up to that paragraph. No picture may show a character, form or event the book has not reached: Selena is a student in uniform until chapter 42, and her Ender form (red eyes, pointed ears, black and purple plating, horns read as headgear before) must not appear before chapter 42 paragraph 29; Vexana's Ender look is not seen before chapter 29; the Mother Matrix does not appear before chapter 24 (as an idea) and not in picture before chapter 33; Obsidia is seen in the prologue and not again as a face before chapter 31. When a chapter text names someone as a surprise, the picture must not give it away.
- **Canon and sources.** Official sources only. Interactive-drama frames may come only from the canon path of episodes `1`, `2B`, `3B1`, `3B2`, `4B1`, `4B2`, `5C`, `6C1`, `6C2`, `6C3`. Frames from the other branches (`2A`, `3A1`, `3A2`, `4A1`, `4A2`, `5A`, `5B`, `6A*`, `6B*`) are off the canon and must be replaced or the insert removed. `_others/web/**` is not official art (it is made for the site): replace it with an official picture of the same thing or remove the insert. Fan art, cosplay, edits, gameplay and the live-action parody are never allowed.
- **Quality.** A hero crop narrower than 1000 source pixels is soft at full screen: prefer another crop or picture if one fits. No burned-in subtitles, watermarks or letterbox bars inside a frame (crop them out). Comic crops end at panel borders: no half-cut speech bubbles and no sliver of the next panel. Alt text says only what is seen, without a wrong claim (check the hair colour, the weapon, who is who).
- **Order of reveal inside the chapter.** A picture placed after paragraph N must not show what only paragraph N+5 tells.

## What you may change

- Remove an insert that does not fit and cannot be fixed.
- Change a crop, a time, a clip's start or end, an `alt`, a `caption`, a `label`, a `mood`, a `score`, the `spoiler` flag, or the `after`/`anchor` of an insert to a better paragraph.
- Replace a picture with another official one that you have LOOKED at with the tools (`tools/dirsheet.py`, `tools/sheet.py`, `tools/frame.py`, `tools/strip.py`, `tools/crop.py`; see the README). Look at the crop or frame before you write it down.
- Do not add inserts only to fill a chapter. Do not use a source picture, panel or footage moment that two other chapters already use (run `visuals.py` with no argument to see the reuse lines; note it counts a clip by its start).
- No em dashes or en dashes anywhere. US spelling. Terrinia, Selrick, Storm Citadel, "aspirant power".

## You must not

Edit any file except `visuals/cNN.json` of your own chapters. Run `build.py` (the build is run once by the coordinator after all reviews; do not run it, it would race with the others). Run git. Change anything under `D:\ren\aspirant`.

## Report (at most 250 words)

Per chapter: what was wrong and what you changed, in one line each. Then what is still uncertain and why, and anything the author should look at.
