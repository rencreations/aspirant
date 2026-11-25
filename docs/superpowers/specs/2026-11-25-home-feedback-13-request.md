# The owner's thirteenth message of feedback, 25 Nov 2026 (word for word)

It follows `2026-11-25-home-feedback-12-request.md`. The rules for the turn were the same: do not run any test or CI, do not push, change only what was asked, and make sure `localhost:3000` has the latest version (it is the built site, so it is rebuilt after a change).

> I wanted you to fix some things in homepage,
>
> In comic section, I wanted you to fix the 3d comic model by removing the black shadow from the model completely and just leave the book.
>
> In artwork section, put a maximum scroll so user can't scroll too fast that the model animations become weird. Do this also in next section and the transition to it (tetra interaction with the drone and tetra running). Also make sure to put maximum scroll across all section if it's applicable and scrolling roo fast will make the experience weird.
>
> In the archive or homepage, fix the voiceline count to "3,046", fix also in /about page where it says the wrong voiceline count.
>
> In "next destination section, make the bar that show how much scroll needed to go to next section more obvious and visible to user (like different color). Fix the transition between the archive section and footer. Currently, the footer is showing first even though the archive list is still there, so it's covering the archive section. I wanted the archive section to be gone first before showing footer.
>
> In character section in homepage, fix the selena content on the list. Currently, when scrolled, the selena next content preview is suddenly vanishes and not scroll left like the other content. What I mean here is when other content is next on the list, the preview will scroll left as the content get shown, but in selena one, when it's next, and scrolled to it, the next preview suddenly disappears. Fix it and make sure it moves to left first like the other.
>
> I will give you more things to change, so do not run any test or CI and only fix or change the things I've told you, and do not push and only make sure you only change or fix the things. Make sure it's localhost:3000 is updated with latest version and I will see it there first.

## How it was read

"The comic section" is the end of the chase, where Tetra sits and reads the book: the dark patches round the book were its two shadows (the soft one that multiplies over her clothes, and the flat ones of the raised shapes on the boards). "The artwork section" is the bend section (the fan art wall and the artwork spiral), "the next section and the transition to it (tetra interaction with the drone and tetra running)" is the end of the bend and the archive's entry (the drone pats Tetra, they hug, she waves and runs off).

## What was done, by part

**The book.** No shadow at all, soft or flat. The ink line stays.

**Top scroll speed.** Every scroll zone of the page has a top scene speed of 1.5 screens a second (`AUTO_ZONE_SPEED`, `kernel/speed.ts`); a section names a slower one in `topSpeed`: the bend 0.9 in every zone (to the one that takes Tetra and the drone to the archive), the archive 0.9 through the entry (Tetra waves and runs, the drone arcs over the first cover), 1.5 through the tour and 1.2 through the way out. Where two meet the lower one wins (`normalizeRanges`).

**The voice line count.** 3,046, the room's own figure (`totals.lines` of `voicelines.json`). The index counted the 812 searchable entries; `build_index.py` now writes the room's figure, so the home's archive, the About page and the shelf agree.

**The footer.** The bar that fills as the end of the page comes is 0.5 rem thick, has a track and fills in the accent colour. The archive is 0.8 screens longer (its way out is 1.5 screens): the covers, the title and the light are gone before the footer's card starts to rise, and the drone waits where the tour left it and goes down to the ring when the card comes.

**Selena's small picture in the list.** It goes on with the row to the left under the window's edge like every other one. It is her model only while it stands still beside the frame; once the strip turns to her it is her picture (the row moves it), and her model is the slice in the window.

**What the top speed does not slow.** A move of the page that no wheel or touch made (the scrollbar dragged, Home or End, a script's `scrollTo`, a restored place) is a jump and lands at once; a test put the scene at 6 screens after 3 s on a 45 screen drag before this was fixed. The idle snaps do not start while the scene is behind the page (a flick, or held back by a top speed), so a snap never makes the scene leap to the page.

**What changed that was not named.** The voice line count is also the shelf's (the collection shows 3,046 on its Voicelines cover, and the index's `total` is 2,234 larger). The page is 0.8 screens longer after the archive, so the probes' positions near the footer moved. Her model and her picture in the small slot differ in colour (the model is not translucent): a veil over the model makes it as pale as the pictures beside it, and what is left is a slight change of look when the row starts to move.
