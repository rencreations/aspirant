# Fifth round of owner notes: more footage in the Layla and Fanny arc

After round 3 (fewer pictures, more text) the owner finds the Layla and Fanny chapters now have too little visual material: several places that were videos became stills, and some videos are the wrong cut. Their notes for YOUR chapters are in "The owner's notes" below, word for word; they win over anything else. Only the chapters named in your prompt change.

## Read first

`D:\aspirant\scripts\story\README.md`, `REVISE-TASK.md` (the trailer scene list and the novel's rules), `REVISE2-TASK.md` (sequences, the cut check, the 45 words of text between pictures, which is still an ERROR for chapters 0 to 5 and 9) and `REVISE3-TASK.md` (the pipeline reminders: `spanCuts` parts to keep a film's own quick cuts, no subtitle, seamless loops). The same text rules apply to any text you write (`D:\ren\aspirant\CLAUDE.md`, `story\main-build\style-guide.md` section 2). After a text edit: `C:\Users\muham\anaconda3\python.exe D:\ren\aspirant\story\main-build\chapters\assemble.py`, `...\check.py <file>`, then print the chapter with `cd D:\aspirant\scripts\story` and `C:\Users\muham\anaconda3\python.exe storytext.py cNN` (paragraph numbers shift).

**History:** you may run READ-ONLY git commands in `D:\aspirant` (`git log --oneline -- scripts/story/visuals/c01.json`, `git show <commit>:scripts/story/visuals/c01.json`) to see how a chapter's pictures looked in earlier versions (for example before the round that reduced them, commit `7c3d68d` and its parent `f5b9cf2`); never commit, checkout or reset. "See history" in the owner's notes means: look at what the chapter had before and restore the videos that fit, as clean multi-shot sequences, wherever the text has room for them (45 words of text between pictures).

**New in the pipeline:** a picture whose source has a transparent background (a PNG with real transparency) now keeps it: it is shown with no frame, no backdrop and nothing cropped (a cut-out). For such a picture give it an `image` source with NO crop unless the owner asks, and the page shows it as is.

## The rules for every video (same as before)

Two or more shots, 3 s or more, clean cuts (no frame of the next shot at any end), seamless loop, no burned-in subtitle: build it as a `sequence`; use `"spanCuts": true` on a part when the owner's time range contains the film's own quick cuts that should play (the first and last frame of the part must still lie inside a shot, which the validator checks). A time range from the owner is the footage to use for that moment; the trailer's cut times for `trailer.webm` are in REVISE2-TASK.md; `tools/shots.py` gives them for any film. LOOK at the first, middle and last frame of every part and at the frame just after it.

## You must not

Run `build.py` (the coordinator builds once), run any git command that changes anything, edit chapters or visual scripts that are not yours, edit anything under `D:\ren\aspirant\media`, `audio`, `story/official`, `story/selfmade`.

## Report (at most 300 words)

Per chapter: what you changed (in the owner's words), the final list of pictures, what you disputed or could not do, and any record that needs a look.

## The owner's notes (word for word)

> Now in Fanny and Layla have too little visual assets, see history.
>
> Chapter 1:
> Above "The Chief Combat Instructor", it should've been a video, find the video that's suitable and make sure it's minimum 2 scene and cuts are clean and can loop smoothly. Do the same also for "They competed even in the smallest things.", it should've been a video, you can see the layla and fanny trailer for it.
>
> Chapter 3:
> The "Professor Joe" photo supposed to have transparent background without any outline for the frame.
>
> Chapter 4:
> Above "Joe had taken that slab across his back for a child", it supposed to be a VIDEO ("D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" from 01:04-01:07), see the trailer and previous version. Same goes for video above "None of Joe's three ranks had been gold." using the same video from 01:07-01:11
>
> Chapter 5:
> Video above "Fanny was on the right edge now", change it to "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" from 01:11-01:23
>
> Chapter 7:
> In "An AI droid, one of the Academy's helpers." image, do NOT remove the backgound yourself, just change it to this "C:\Users\muham\Downloads\ai.png" without any crop and make sure the transparent background works (it's already transparent)
>
> In meet selena, the crop are too much. Make it more broad and crop like waist up "C:\Users\muham\Downloads\s.png".
>
> Chapter 9:
> Videos are in "D:\ren\aspirant\media\layla-and-fanny\video\official\other\short-animation\short-animation-final.mp4"
>
> Video below "Fanny looked at her, puzzled. Nobody had touched her.", use the video from 00:07-0:18
>
> For video below "Layla stood there with her arms still out", use the video from 00:18-00:33
>
> Video above "In class she sat with her arms folded", use the video from 00:47-01:05
>
> Video above "That night, in the lab, Layla set", use the video from 01:05-01:26

"Above X" means the picture sits just before the paragraph that contains X; "below X" means just after it. The pictures supplied by the owner are in `D:\aspirant\scripts\story\extra\` (`joe-hd.png`, `ai.png`, `s.png`; use them as `"src": "extra/<name>"`).
