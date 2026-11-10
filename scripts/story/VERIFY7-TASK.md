# Review task, round 7: check the pictures of the new built chapters against their text

The pictures of chapters 18 to 87 (the new Acts III to VI) were chosen by hand (`scripts/story/visuals/cNN.json`) and built. You review a block of 14 chapters the way a reader would meet them, and fix what is clearly wrong. Read `CURATE6-TASK.md` (the rules the curators followed) and `docs/superpowers/specs/2026-11-03-story-visual-reader-design.md` ("The visual script" and "Curation rules") first. The owner asked for the story text first and real text between pictures; chapters with few or no inserts are on purpose (official media is thin for the backstory).

## For each chapter of your block

1. Print the text: `cd D:\aspirant\scripts\story` then `C:\Users\muham\anaconda3\python.exe storytext.py c25`.
2. Make its storyboard sheet and open it with the Read tool: `C:\Users\muham\anaconda3\python.exe tools\storyboard.py c25` prints a JPEG path (the built data is current). Each row is the paragraph an insert follows (left) and the picture with its alt text (right); a clip shows its still and the word CLIP. Read the sheet at full size.
3. Judge every picture (hero, thumb and inserts) against the text and the rules below.
4. Fix clear errors in `visuals/cNN.json` of YOUR chapters only (see "What you may change"), then run `C:\Users\muham\anaconda3\python.exe visuals.py cNN` and get 0 errors.

## What to check

- **Fit.** The picture shows what the paragraph before it says (the right people, place, action, mood), or is a clearly fitting establishing shot. A near miss that still reads as the scene is fine; a wrong person, place or action, or a picture of something the text does not say, is not.
- **Spoilers (the book's reveal order).** The reader knows only what the book has told them. No picture may show, before its chapter: the Mother Matrix's face or body before chapter 49; Vexana's Ender form, her new hair and dark outfit, before chapter 50 (the interactive drama's billboard of Vexana shows her Ender form: not before 50); the Storm Citadel before chapter 54 (the prologue's black cloud over the bay is fine); Selena as an Ender, with pointed ears, red eyes, horns as more than headgear, or in her combat suit, before chapter 61, and her full suit and mecha form only from chapter 83 (the reveal); Obsidia's mecha form ("LORD OF ECLIPSE") before chapter 87. Where the text names someone as a surprise, the picture must not give it away.
- **Canon and sources.** Official sources only. Interactive-drama frames may come only from the canon path of episodes `1`, `2B`, `3B1`, `3B2`, `4B1`, `4B2`, `5C`, `6C1`, `6C2`, `6C3`; frames from other branches (`2A`, `3A*`, `4A*`, `5A`, `5B`, `6A*`, `6B*`) must be replaced or removed. `_others/web/**` is not official art: replace or remove. Fan art, cosplay, edits, gameplay, the live-action parody: never.
- **Quality.** A hero crop narrower than about 1000 source pixels is soft at full screen: if a sharper official picture of the same scene exists (LOOK at it first), swap it; if not, leave it and say so. No burned-in subtitles, watermarks, letterbox bars or burned-in titles inside a frame (crop them out). Comic crops end at panel borders: no half-cut speech bubbles, no sliver of the next panel. Alt text says only what is seen, with no wrong claim (hair colour, weapon, who is who). Videos: at least 3 s, two or more shots, no frame of the next shot at either end, a seamless loop.
- **Order of reveal inside the chapter.** A picture placed after paragraph N must not show what only paragraph N+5 tells.
- **Peaks.** A death, a loss, a reunion or a reveal should not have a picture sitting on top of the key line; move or remove it.

## What you may change

- Remove an insert that does not fit and cannot be fixed.
- Change a crop, a time, a clip's start or end, an `alt`, a `caption`, a `label`, a `mood`, a `score`, the `spoiler` flag, or the `after`/`anchor` of an insert to a better paragraph (`after` is the paragraph number; `anchor` is its first words).
- Replace a picture with another official one that you have LOOKED at with the tools (`tools/dirsheet.py`, `tools/sheet.py`, `tools/frame.py`, `tools/strip.py`, `tools/crop.py`). Look at the crop or frame before you write it down.
- Keep at least 45 words of text between pictures and after the last one (the validator enforces it). Do not add inserts only to fill a chapter. Do not use a source that two other chapters already use (`tools/used.py`; note it does not see every case: read the other scripts too).
- No em dashes or en dashes anywhere. US spelling. Terrinia, Selrick, Storm Citadel, "aspirant power".

## You must not

Edit any file except `visuals/cNN.json` of your own chapters. Run `build.py` (the coordinator builds once after all reviews). Run git. Change anything under `D:\ren\aspirant`.

## Report (at most 250 words)

Per chapter: what was wrong and what you changed, one line each. Then what is still uncertain and why, and anything the owner should look at.
