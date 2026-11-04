# Sixth round of owner notes (video details)

The owner looked at the latest build and wants two videos fixed. Their notes for YOUR chapter are quoted word for word below and win over anything else. Change ONLY your chapter's visual script (`D:\aspirant\scripts\story\visuals\cNN.json`); chapters are being renumbered elsewhere at the same time, so do not touch any other file.

## Read first

`D:\aspirant\scripts\story\README.md`, `REVISE2-TASK.md` (sequences, the cut check, `spanCuts`, 45 words between pictures), `REVISE3-TASK.md` and `REVISE4-TASK.md` (pipeline notes). Tools: `tools/shots.py <film>` (cut times), `tools/frame.py`, `tools/strip.py`, `tools/sheet.py`, `tools/crop.py`, `tools/frames_to_clips.py`; `storytext.py cNN` prints the chapter text with paragraph numbers. Validate with `C:\Users\muham\anaconda3\python.exe visuals.py cNN` (cwd `D:\aspirant\scripts\story`): 0 errors required.

## Rules for every video (unchanged)

3 s or more, clean cuts (no frame of the next shot at either end), seamless loop, no burned-in subtitle, `sequence` type with `spanCuts` parts where the film's own quick cuts should play. LOOK at the first, middle and last frame of every part and the frame just after it. A `still` (`frame` media) must be sharp and free of subtitles (crop them out).

## You must not

Run `build.py`, run any git command that changes anything, edit any file other than your one visual script, edit anything under `D:\ren\aspirant\media`, `audio`, `story/official`, `story/selfmade`.

## Report (at most 200 words)

What you changed (in the owner's words), the final parts with times, what you could not do.

## The owner's notes (word for word)

> Chapter 4:
> Video above "“See?” said Layla. “You covered me.”" is cut mid play, make sure it's not cut "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" 00:50-00:58
>
> Video below "Somewhere in the smoke a man was calling a name, over and over." where layla stoods in front of fire, change it to image instead.

> Chapter 10:
> In meet ruby, add more duration in the ruby on the second part and do the transition also. See the video detailly and there's a transition after the ruby second part and I wanted it to looped from there. Make sure it's smooth.

Notes on reading them:

- **Chapter 4, first note:** the video sitting between the paragraph "Layla fired. The thin white bolt punched..." and the paragraph `"See?" said Layla.` (visuals/c04.json insert 5) ends in a hard cut or stops partway through its action. The owner wants the trailer's 00:50 to 00:58 to play through completely and cleanly (the trailer's cut times are in REVISE2-TASK.md: this stretch holds the cuts at 50.67, 51.62, 52.29, 53.33, 53.83, 56.08, 56.88, 56.96 and the next shot starts at 58.58). Start just after a cut and end just before one, with `spanCuts` where the quick cuts should play, so it shows the whole beat (Fanny at the neck of the Ender, the chest opening, Layla firing through the billboard, the core blowing out) and nothing of the shot after it. The text before it (paragraphs 30 and 31) and after it (32) must match what is shown; if the footage shows the beats in a different order than the text, say so in your report rather than editing the novel.
- **Chapter 4, second note:** insert 9 (after paragraph 46, `Layla came down to the avenue...`, currently a 3.5 s sequence from 63.5 s) becomes a still image: a sharp frame of Layla standing in front of the burning building with the cannon hanging from her hand (trailer around 65.8 to 67.2 s; choose the best frame and look at it; the cut list shows cuts at 65.75 and 67.21). Use a `plate` insert with `frame` media like the other stills of the chapter (see `visuals/c13.json` insert 0 for the form), with a `credit` and an `alt` that describes the picture. The next insert (about the gold giant) stays as it is.
- **Chapter 10, Meet Ruby** (insert 0 or the first `portrait`/video card of `visuals/c10.json`: the card built from `ruby-and-angela/video/ruby/ruby-final.mp4`, 00:04 to 00:14 in two parts, the child and then the older girl): look at the film around 0:04 to 0:20 shot by shot (`tools/shots.py`, `tools/strip.py`). After the second part (older Ruby) the film makes a transition (a dissolve or wipe into the next scene). The owner wants (1) more of the second part (older Ruby) to play, longer than now, and (2) the film's own transition after it included, and the loop to restart from there, so the video flows from the older Ruby through that transition and back to the child at the start, smoothly. Build it as a `sequence` (or a single `spanCuts` part if the transition is inside one stretch) so that the end-of-loop looks like a natural continuation: if the transition is a fade/dissolve to a different scene, the loop should start at the first frame the transition lands on only if that is the child scene; otherwise end the video at the end of the transition, with the dissolve back into the first part (the sequence's own tail dissolve) landing cleanly. Look at the rendered result (render with `build.py`'s helpers into the scratchpad as the previous agents did, never into `public/`), check the loop seam frame by frame, and keep the information overlay and everything else about the card unchanged.
