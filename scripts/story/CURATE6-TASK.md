# Curator task, round 7: the visuals of the new chapters (18 to 87)

The owner restructured the novel into six acts (`RESTRUCTURE-TASK.md` in this folder holds their request word for word). Chapters 0 to 17 keep their pictures and are **not to be touched**. Chapters 18 to 87 are new text with no visual script yet. Your job: write `visuals/cNN.json` for your block of chapters, nothing else. The novel text is final; do not edit it.

## Read first, in this order

1. `D:\aspirant\scripts\story\CURATOR-TASK.md` ("What a good chapter looks like", the schema notes) and the schema in `D:\aspirant\docs\superpowers\specs\2026-11-03-story-visual-reader-design.md` ("The visual script", "Curation rules").
2. `D:\aspirant\scripts\story\README.md` (the looking tools, where the sources are) and `REVISE2-TASK.md`, `REVISE3-TASK.md` (sequences, `spanCuts`, cut checks, seamless loops: every rule there still holds).
3. For each chapter: `C:\Users\muham\anaconda3\python.exe storytext.py cNN` (the numbered paragraphs; read all of it), the chapter's notes `D:\ren\aspirant\story\main-build\restructure\notes\NN.md` (its **Sources** section names the official files and lines or times behind each scene), and the chapter's entry in the act's outline (`D:\ren\aspirant\story\main-build\restructure\outline-act-3.md` to `outline-act-6.md`, the **Visuals** line: official media the outline writers suggested; the paths exist). The first edition's `source-log.md` is for the OLD book: ignore it.

## What the owner wants (lessons of six earlier rounds, all binding)

- **Text first.** The owner asked again and again for fewer pictures and real text between them. Aim for **3 to 7 inserts** per chapter, never more than 8, and keep at least **45 words of text between two pictures and after the last one** (the validator enforces this for chapters 18 to 87; the chapter 1 to 5 and 8 rule). A peak scene (a death, a loss, a reunion, a reveal) may have no picture at all while it happens: put the picture before or after.
- **Every video really plays**: at least 3 s, at least two scenes (a `sequence` of parts, with `spanCuts` where the film's own quick cuts should play), clean cuts (no frame of the next shot at either end), a seamless loop, no burned-in subtitle or logo (crop it out), the hero film too. LOOK at the first, middle and last frame of every part and at the frame just after it. A `still` or `frame` must be sharp and subtitle free.
- **Show only what the chapter tells.** A picture must match the paragraph it follows; never borrow a film scene of another event (for example the Layla and Fanny trailer's breach is not a Crisis scene). Prefer an honest place, a comic panel, an official art crop or a film moment of the same event; where the official media gave nothing for a scene, use no picture.
- **Official sources only**: never fan art, cosplay, fanmade, `_edits`, `_gameplay`, in-game animation, the live-action parody (the validator rejects them). Dashes: none in the JSON. US spelling.
- **Credit and alt** on every picture (what the picture shows, in plain words; the credit names the official source).
- **No reveal before the book reveals it.** Do not show: the Mother Matrix's face or body before chapter 49 (the Will's face in Vexana's memory); Vexana's Ender form before chapter 50; the Storm Citadel before chapter 54 (the prologue's black cloud is fine); Selena as an Ender or in her combat suit before chapter 61 (she is a Science Division student in uniform with a lollipop and Silverbolt until then; her horns read as headgear); Obsidia's mecha form ("LORD OF ECLIPSE") before chapter 87. Set `spoiler: true` only when the picture that best represents the chapter (hero or thumb) would reveal one of these to someone who has not read that far; prefer a safe `thumb` over `spoiler: true`.
- **Portrait cards** (`kind: "portrait"`) exist only where the reader first meets a character: Ruby and Angela c09, Lesley c14, Chang'e c14 (their cards are in c17 already), Selena c17 (done), none for the others in your block. Do not add portrait inserts.

## Sources by act (suggestions; the notes' Sources sections win)

- **Act III (18 to 30), Lesley and Chang'e:** `lesley-and-change/video/official/{trailer,teaser,short-trailer}` (scene cuts in `footages/`, the readme and manifest say what each shows), `lesley-and-change/art/official`, `art/lore`, `_others/places` (Terrinia, the research base is not shown as such: use Terrinia places sparingly), `_others/character` (Mr. Bunny is not there; check). The family's home (chapter 18) and Chang'e's parents have no official footage: use only what the trailer and teaser show (the photo, the lab) and art; say nothing the chapter does not.
- **Act IV (31 to 47), Guinevere and Vexana:** `vexana-and-guinevere/art/comic` (45 pages, tall strips: cut panels with `crop`), `video/comic`, `video/connection-lost` and `relink` (for the recalled scenes in 75 and 77, not before), `video/interactive-drama/footages/<episode>` (only the canon path 1, 2B, 3B, 4B, 5C, 6C), the splash arts (but avoid the ten big splashes as plates). House Baroque and Guinevere's father: `art/official/guin-father-silhouette.png` and the comic pages that show him.
- **Act V (48 to 67), Vexana in the void, Obsidia, Selena:** the Guinevere and Vexana comic pages of the capture, the vision and the Will (pages 1 to 6, 35 to 37), `selena-and-obsidia/video/{trailer,selena,obsidia,selena-portrait,obsidia-portrait}`, `selena-and-obsidia/art/lore` (the archive slides), `_others/places` (the Storm Citadel, the Energy System, Planet Dawnbreak, the universe), `_others/character` (Enders, Karina is not there: no portrait of Karina unless an official picture exists).
- **Act VI (68 to 87), the Singularity Crisis:** `vexana-and-guinevere/video/{connection-lost,relink}`, `selena-and-obsidia/video/trailer` (the arrival, the field, the reveal, the throne hall, the duel), `_others/places`, `_others/character` (the Enders). Chapters 68 to 72 are before the Citadel: no Citadel pictures there.

## Scores

`score` is one of: `we-believe`, `guinevere-theme`, `vexana-theme`, `silverbolt-raiko`, `obsidia-theme`, `obsidia-aspirant`, `obsidia-solo`, or `null` for a quiet chapter. Neighbouring chapters about the same people share a track so the music does not jump. Suggested: Act III `we-believe` or `null`; Act IV `guinevere-theme` (Vexana's chapters `vexana-theme`); Act V Vexana's void `vexana-theme`, Obsidia's talks `obsidia-theme`, Selena's chapters `silverbolt-raiko`; Act VI `obsidia-aspirant` for the Citadel half, `guinevere-theme` or `vexana-theme` for the Matrix half.

## Avoid colliding with other curators

A source may be used at most twice in the whole book, and other curators are working on other blocks at the same time. Before you choose a source run `C:\Users\muham\anaconda3\python.exe tools\used.py <part of the path>` (add `--twice` to see what is already full) and choose around it; run it again before you finish. Prefer sources the notes tie to your chapters.

## Per chapter

1. Read the chapter and its notes. 2. Find candidates and LOOK at them (contact sheets first: `tools/sheet.py`, `tools/strip.py`, `tools/dirsheet.py`, `tools/frame.py`, `tools/crop.py`, `tools/shots.py`). Choose only what you have seen. 3. Write `D:\aspirant\scripts\story\visuals\cNN.json` (UTF-8, two-space indent). 4. `cd D:\aspirant\scripts\story` then `C:\Users\muham\anaconda3\python.exe visuals.py cNN`: **0 errors required**; read the warnings and fix those you agree with. Work one chapter at a time and finish it before the next. After the whole block run `visuals.py` on every chapter of your block once more.

## You must not

Edit any file except `visuals/cNN.json` of your own chapters. Touch chapters 0 to 17. Run `build.py` or any git command. Change anything under `D:\ren\aspirant`.

## Report (at most 200 words)

Per chapter: hero type, number of inserts and kinds, score, spoiler flag, anything you could not fill and why. List any picture you are unsure matches the text, and any chapter where the official media gave you little.
