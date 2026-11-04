# Fourth round of owner notes: the Ruby and Angela arc (chapters 10 to 18)

The owner wants the Ruby and Angela chapters to use the new high quality finished films of the arc, longer and smoother clips, sharper stills, and a few pictures swapped or removed. Their notes for YOUR chapters are in "The owner's notes" below, word for word. They win over anything else. Only the chapters named in your prompt change; change nothing else.

**Chapter numbers moved:** the old chapter 17 ("Sis", Lesley and Chang'e before the Academy) now sits as chapter 18, and "Newcomers" (the arrival of Ruby and Angela at the Academy) is now chapter 17, because "Sis" did not belong between Ruby's escape and her arrival. The owner's notes below were written before the move: their "Chapter 18" notes (Angela small and pink-haired, Planet Oro, the chamber of Oro's Council, the AI droid) are about "Newcomers", which is now `c17`.

## Read first

`D:\aspirant\scripts\story\README.md`, `REVISE-TASK.md` (the earlier owner's notes, the novel's rules and how to edit and rebuild the book) and `REVISE2-TASK.md` (the pipeline notes: `sequence` media with dissolves and a seamless loop, the cut check, the 45 words of text between pictures). Same rules for the novel text: `D:\ren\aspirant\CLAUDE.md`, `story\main-build\style-guide.md` section 2 (short plain sentences, no em or en dashes, never "conviction", US spelling, straight quotes, Terrinia, Selrick, Storm Citadel, no romance), the official films are the truth. After a text edit: `C:\Users\muham\anaconda3\python.exe D:\ren\aspirant\story\main-build\chapters\assemble.py`, `...\check.py <file>`, then print the chapter with `cd D:\aspirant\scripts\story` and `C:\Users\muham\anaconda3\python.exe storytext.py cNN` (paragraph numbers shift: re-print before writing the visual script).

## The films (all in `D:\ren\aspirant\media\ruby-and-angela\video\`, 2560x1080, sharp: stills taken from them are high quality)

- `ruby\ruby-final.mp4` (1:55, Ruby's film), `angela\angela-final.mp4` (1:32, Angela's film), `trailer\trailer-final.mp4` (3:20, the trailer; "trailer" in the owner's notes for chapters 14 and 15 means this file). Times in the notes are minutes:seconds in that file. Each folder also has a `readme.txt` (the author's scene by scene description with the quoted lines: READ IT, the text must match what the footage shows), `english.srt` (the subtitles with times) and `footages\manifest.json` (a note per cut).
- To use a stretch: a `frame` at time `t` for a still (take the best frame near the time the owner names; use `crop` so no subtitle or logo shows; choose a frame where nobody is mid-word when the owner asks for that), a `clip` or a `sequence` for video.

## Pipeline reminders (details in REVISE2-TASK.md)

- A video of the arc is a **`sequence`**: parts joined with dissolves, ending in a dissolve back into the first part, so the loop has no seam; at least 3 s in all; muted. A part is one shot; the validator errors when a cut of the film lies inside a part. When the owner asks for a long stretch of the trailer with its own quick cuts (for example "from 00:17 to 00:28"), build it from parts and set `"spanCuts": true` on a part that should keep the film's own cuts: its first and last frame must then be well inside a shot (the validator checks 0.1 s). Use `C:\Users\muham\anaconda3\python.exe tools\shots.py "<path under media>" --threshold 0.2` for the cut times. Never start or end a part on a frame of the neighbouring shot, and look at the first, middle and last frame of every part and at the frame just after it.
- A "Meet" card on a film: a `portrait` insert whose `media` is a `clip` or `sequence` shows the film wide, with the Aspirant's name, Aspirant name and one line over a gradient that rises from the foot and fades out toward the top (the site writes the text; you only choose the film).
- Supplied pictures: `"src": "extra/fathe.png"` (829x727, Ruby's father, from the owner) works as an image source. Other new pictures come from the films.
- Looking tools: `tools/sheet.py`, `tools/frame.py ... --crop`, `tools/shots.py`, `tools/crop.py` (see the README). LOOK at everything you choose.
- Text between pictures: the validator warns when fewer than 45 words of text lie between two pictures in these chapters (it is an error only for chapters 0 to 5 and 9). Do not make it worse; where you add or extend a picture next to another, add text or merge.
- No burned-in subtitle may show in any picture or clip (crop it out).
- A still is `frame`/`image`, never a clip: the owner wants stills in the places they say "image" or "snap the photo". A "high resolution" request means: use a picture taken from the 2560x1080 films (or another sharp source) at its full size, not a small art file stretched.

## You must not

Run `build.py` (the coordinator builds once), run git, edit chapters or visual scripts that are not yours, edit anything under `D:\ren\aspirant\media`, `audio`, `story/official`, `story/selfmade`.

## Report (at most 350 words)

Per chapter: what you changed in the text, which pictures you changed, removed or merged (in the owner's words), the final number of pictures, what you disputed or could not do (with the reason), and any later chapter or record that needs a look. Log new inventions in `invention-log.md` section 8 (continue the DI numbers after the last one).

## The owner's notes (word for word)

> Chapter 10:
> I wanted you to change the "meet ruby" to use a video "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" from 00:04-00:14, and make sure to cut and make the loop seamless. So we will introduce Ruby using this video with the overlay text of the information (put gradient so the text are visible, do not cover all, so only gradient from bottom and will disappear gradually to top). Also the text above it like the schoolroom, etc, I wanted you to change it to fit the context more. Read the trailer again and make sure the context are match with the video displayed (taken from trailer).
>
> The official art image "The place, Planet Oro" above "The summons came the next morning", the image are blurry, make sure you take the high quality visuals for it.
>
> Below the "The council hall was dark and very tall…" paragraph, put the video showing The Council, it's in "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" 00:00-00:04.
>
> Below the "You cannot allow yourself to be so weak…", change the image to "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" in 00:15, snap the photo and make sure it's high quality and can show both ruby and her father. Also below the "She had no plan yet…" put also image snapped from the same ruby-final in 00:18.
>
> In "The council's androids of Project Angel" image, above the "The Council's engineers had taught…" text, change it to this footage "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" in 1:04-1:0.
>
> Below "So I can hide something in her…" text, change the image to the footage in "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" from 00:20-00:25
>
> Above the "From now on, I call you Angela", there's a footage. From the same video ("D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4"), use it from 00:26-00:36, make sure the loop is smooth.
>
> In meet Angela, move the angela photo position a tiny bit to the left and make it centered.
>
> Chapter 11:
> In The Place: The Laboratory image are too low resolution, make it more HD.
>
> In "The Gardens" image, I wanted you to change it into a video. You can take it form "D:\ren\aspirant\media\ruby-and-angela\video\angela\angela-final.mp4" 00:27-00:34 and "D:\ren\aspirant\media\ruby-and-angela\video\trailer\trailer-final.mp4" 1:01-1:11 and make sure the transitions and loops are smooth.
>
> Below the "Angela held out both hand..", there's a photo, change it to this footage "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" 00:36-00:45.
>
> In the training field, change it to the video "D:\ren\aspirant\media\ruby-and-angela\video\angela\angela-final.mp4" 00:34 – 00:36, make sure the loop are smooth.
>
> Chapter 12:
> Above the "Angela looked at her face…", for the video that ruby cried, extend it to where the tears actually drop, so from 1:06-1:16 in angela's video.
>
> Above "Angela hugged her hard…", in pictures showing Tetra, crop or take the image some ms later so it will not looked cropped. Currently the photo looked cropped, make sure to take it in full, see the video.
>
> Chapter 13:
> Change the hero cover to be a video, so in "D:\ren\aspirant\media\ruby-and-angela\video\angela\angela-final.mp4" from 00:06-00:16.
>
> Below "Tetra was pressed to her chest.", add the image of Angela holding tetra, it's in angela-final.mp4 in around 00:10, take the images, make sure it's clear.
>
> Below "…her cheeks, from her eyes. They had been blue." there's a image. Change it to a video footage, you can use "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" from 1:26-1:30 and 1:40-1:44, make sure the transition and loop are smooth.
>
> Above "The Council had taken Angela's mind.", the image are too low resolution, make sure it's high resolution.
>
> Below the "Someone knocked once and opened the door" there's image of soldier of oro, change it completely to footage "D:\ren\aspirant\media\ruby-and-angela\video\ruby\ruby-final.mp4" from 1:10-1:16, make sure the loop are smooth, also now put it above ""Yes," said Ruby. "Only I can.""
>
> Remove the Planet Dawnbreak image at the end of the chapter.
>
> Chapter 14:
> When I mention trailer, it's "D:\ren\aspirant\media\ruby-and-angela\video\trailer\trailer-final.mp4"
>
> In the place, Terrinia video footage, add the next part which shows the inside of the ship, so in trailer from ~0:04-~0:10, make sure the loop are smooth.
>
> The video above the ""Go!" The students ran.", extend it, so now it contains trailer from 00:17-00:28, make sure cuts are clean and loop smoothly.
>
> Video below "I'm Ruby! Don't you remember?", extend it. Not it;s the trailer from 00:40-00:50
>
> Video above "She was inside the swing", extend it, so now it's the trailer from 01:10-01:19, make sure the cuts clean and loop smooth.
>
> Video above "Ruby held her", extend it, now it's trailer from 01:35-01:46
>
> Video below "The rest of the company came down the avenue in rows", extend it now it's trailer from 01:47-02:10 (when screen turns black after explosion). Make sure it loop smoothly.
>
> Video above "Ruby raised the scythe" will starts with the trailer from 02:11-02:27. Also add more text below the video so there is spaces to the next chapter.
>
> Chapter 15:
> In hero video, extend it so it's now the trailer from 2:52-3:00
>
> Video above "The last thing she remembered", extend it. Now it's trailer from 02:25-02:30
>
> Video above "The scythe reached the top of its swing.", extend it. Now it's trailer from 02:30-02:36 (do not put the angela part)
>
> Video above "The scythe had not fallen", extend it. Now it's trailer from 02:46 (Angela eyes zoomed in) to 03:00
>
> Video above "Nobody fights that hard for a city" change it to a image. Make sure it's the one where the frame is zoomed out max and shows both Layla and Fanny figure, and in screen show both Ruby and Angela.
>
> Above "For now.", change the video to be image. Make sure both character are centered with normal mouth (not mid talking)
>
> Video above "The girl with the scythe cut the androids down", extend it. Now it's the trailer from 00:10-00:20 (before the slash and black screen)
>
> Remove the film on the most bottom of the chapter page.
>
> Chapter 16:
> Make the hero video just an image
>
> The "Ruby's father, the Decisionmaker" image, chage it to "C:\Users\muham\Downloads\fathe.png"
>
> The video above "Freedom! Hahaha!", change it to image insead that shows the imafe fully in view (last frame) with the ship in view.
>
> Chapter 17:
> This chapter doesn't suits to be here and is very out of place, since last chapter explain the leaving of Angela and Ruby from Oro, and next chapter is their arrival. Remove this chapter completely or moved it to another one that fits the context and timeline more correctly;
> (The coordinator moved it: it is now chapter 18.)
>
> Chapter 18:
> Remove the "Angela, small and pink-haired." visuals completely.
>
> The "Planet Oro" photo are too blur, make it high quality
>
> Make "The chamber of Oro's Council." to images instead and make sure it's the high quality and cut it when it's not blur
>
> Remove "An AI droid, the kind that would follow Ruby everywhere" image
> (These three notes are about "Newcomers", now `c17`.)

Where a note names a paragraph in quotes, find it by its words in the chapter. "Below X" means the picture sits after the paragraph that contains X; "above X" means it sits just before it. Where the owner gives a time range for a paragraph's footage, that range is the footage for that moment, cut into clean shots as described.
