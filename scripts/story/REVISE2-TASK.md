# Third round of owner notes: fewer pictures, more text, merged clean footage (the Layla and Fanny arc)

The owner looked at the story again and found: too many pictures with too little text between them, clips that are short bad cuts of a film, cuts where the next shot shows for a frame, clips that do not match the text, and some pictures to swap or remove. Their notes for YOUR chapters are in "The owner's notes" below, word for word, and they win over anything else. Only the chapters named in your prompt change. Do not change chapters outside the Layla and Fanny arc.

## Read first

`D:\aspirant\scripts\story\README.md`, `REVISE-TASK.md` (the owner's earlier notes, the trailer scene list, the novel's rules and how to edit and rebuild the book), `docs\superpowers\specs\2026-11-03-story-visual-reader-design.md`. The novel's rules still apply to any text you write: `D:\ren\aspirant\CLAUDE.md`, `story\main-build\style-guide.md` section 2 (short plain sentences, short paragraphs, no em or en dashes, never "conviction", US spelling, straight quotes, Terrinia, Selrick, Storm Citadel, no romance), the official sources outrank the old draft, voice lines word for word with their markers. Edit `story\main-build\chapters\NN-slug.md`, then `C:\Users\muham\anaconda3\python.exe D:\ren\aspirant\story\main-build\chapters\assemble.py`, then `...\check.py <file>`, then print the chapter with `cd D:\aspirant\scripts\story` and `C:\Users\muham\anaconda3\python.exe storytext.py cNN` (paragraph numbers can shift: always re-print before writing the visual script).

## What is new in the pipeline (use it)

1. **`sequence` media** (a hero, or a `clip` insert's media): two or more shots joined with short dissolves, ending in a dissolve back into the first, so the LOOP HAS NO SEAM. Muted.
   ```json
   {
     "type": "sequence",
     "xfade": 0.4,
     "alt": "what is seen, shot by shot",
     "credit": "Official trailer",
     "parts": [
       {
         "src": "layla-and-fanny/video/official/lore/trailer/trailer.webm",
         "start": 16.0,
         "end": 19.0,
         "crop": [0, 134, 1920, 812]
       },
       { "src": "...", "start": 9.92, "end": 11.62, "crop": [0, 134, 1920, 812] }
     ]
   }
   ```
   Each part is one shot only; the output size follows the first part's crop (give the parts crops of similar shape); the dissolves cost `xfade` seconds each, so a part must be at least 1.2 s (and 3 times `xfade`) long; the whole sequence must come to at least **3 s** and at most 24 s. The validator **checks that no cut of the film lies inside a part** (with 0.1 s to spare), so the next shot never shows: end a part at least 0.1 s before a cut and start it at least 0.1 s after one. Find the cuts with `C:\Users\muham\anaconda3\python.exe tools\shots.py "<film path under media>" --threshold 0.2` (lists the cut times in seconds; for the Layla and Fanny trailer they are: 0.04 0.75 3.29 3.42 3.75 4.75 6.75 8.42 9.75 9.79 11.75 12.38 13.96 15.88 21.88 23.50 24.83 28.50 28.67 36.58 36.62 41.08 44.58 46.62 46.67 50.67 51.62 52.29 53.33 53.83 56.08 56.88 56.96 58.58 59.88 59.96 60.25 60.29 63.25 64.54 64.67 64.71 65.75 67.21 69.17 69.96 70.38 70.54 70.58 70.62 70.67 70.71 70.83 72.83 72.92 76.38 76.96 77.00 77.04 77.08 77.12 77.92 81.62 82.71 82.83 82.96 83.00 83.50 84.83 88.58 90.71 95.71; a run of cuts close together is a rapid flash sequence: pick a single shot or skip it). A plain `clip` insert is still allowed for a single long shot of 3 s or more, but the owner wants **every video of the arc to have at least two scenes** and loop smoothly: use a `sequence`. A video must always be at least 3 s.
2. **Text between pictures:** the validator now ERRORS when fewer than **45 words** of text lie between the title card and the first picture, between two pictures, and after the last picture (before the next-chapter button). A `voice` insert does not count as a picture. Two or three sentences or a paragraph of real text between pictures: if a chapter has too many pictures, merge or drop pictures; if a scene is too thin, ADD text in the novel's style (short plain sentences; emotional where the owner asks).
3. **Supplied pictures:** `"src": "extra/joe-hd.png"`, `"extra/ai.png"`, `"extra/s.png"` (files in `scripts/story/extra/`, 1086x1448, 1672x941 and 775x817) work as an `image` source like any other.
4. Looking tools (see the README): `tools/sheet.py`, `tools/frame.py ... --crop`, `tools/strip.py`, `tools/crop.py`, `tools/shots.py`. LOOK at every part you choose (first, middle and last frame, and the frame just after the end) before you write it.

## Rules for every video of your chapters

- No burned-in subtitle may show (crop it out).
- Two or more shots, 3 s or more, clean cuts, smooth loop (the `sequence` type does the loop and the dissolves).
- The footage must show what the text next to it says. If a clip's context is wrong, change the clip or remove it; do not change the text to fit a wrong clip unless the owner says so.
- Do not put pictures close together: each picture needs real text before it and after it. Use only as many pictures as it takes to picture the scene. Prefer merging the clips of one action into one sequence.
- The site fades the foot of every clip; that does not replace cropping a subtitle.

## You must not

Run `build.py` (the coordinator builds once), run git, edit chapters or visual scripts that are not yours, edit anything under `D:\ren\aspirant\media`, `audio`, `story/official`, `story/selfmade`.

## Report (at most 350 words)

Per chapter: what you changed in the text, which pictures you removed, merged or replaced (by the owner's words), the final number of pictures, anything you disputed or could not do, and any later chapter or record that needs a look. Log new inventions in `invention-log.md` section 8 (continue the DI numbers after the last one).

## The owner's notes (word for word)

> there's too much visuals with not enough text. Make sure there's sufficient text between each visuals, for example like 2 or 3 sentences or paragraph anot not 1. Also you can merge the visuals or footage to one long one. do NOT put too much visuals and only enough. to make user can visualize it easily. also only focus on layla and fanny, do not change anything outside that. Change this below
>
> Prologue:
> Below the "Her Enders walked the ruins" there's video of enders. I wanted you to concat it to this video footage "D:\ren\aspirant\media\selena-and-obsidia\video\obsidia\001_3997406762701005025.mp4" from 00:14-00:20, so when the current video is done, it will transition to that video and make sure the transition and loop are smooth.
>
> Chapter 1:
> In hero, concat current video with "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" from 00:09-00:12, the footage where Layla is looking out to the window. Make sure the transition and loop are smooth.
>
> Remove "Then she was flying, straight out of a fireball, and the last Ender on the screen burst into light. The hall cheered." and the video below it.
>
> This chapters contains the MOST undistributed visual in which one section have TOO MUCH visuals, and one section have TOO LITTLE visuals. Make sure to have sufficient text between the visual.
>
> Above the "At seven she took the", the fanny video cuts at the end are not smooth, user can see the next frame. Make sure it only shows fanny scene only.
>
> For the scene where layla and fanny climbing stair together, concat it to one video with clean transition and smooth loop.
>
> In "They competed even in the smallest things.", the cuts are not clean. I can see slight of the next frame on one of the cuts, make sure the cut are clean.
>
> Below "Even the weapons bench was a race", the video context was not right. In the video it only shows Layla is fixing her canon normally in her secret base.
>
> Below "She was watching the sun go down over the city.", make it into image instead of video.
>
> Above "At seven she took the white" I wanted you to concat it using another footage, so it doesn't look cuts and instead will change to another video and transition cleanly and will loop smoothly, choose the right footage.
>
> Chapter 2:
> This page also have a lots of undistributed visuals, one have too much visuals, one have too little.
>
> The hero section video are stopped and not playing, fix it, if you intend to make it video, make sure it can play and have at least two scene so it can transition cleanly and loop smoothly.
>
> Below the "counter read 0150. Then 0151" there's a LOTS of footage that I wanted you to concat it to be NOT too many footage because currently all of the footage are cuts few scenes. I wanted the footage to have MINIMUM of two scenes, so it can cuts clean and loop smooth. The one I wanted you to change is "Fanny's counter: 150 drones destroyed, then 151.", "Layla's counter: 148, then 149.", above "You can't escape my magic gun!", above "She rose to the ceiling", above "Layla aimed again", above "From the ceiling Fanny swept down", above "Layla tossed her cannon up", above "She walked to the middle of the corridor", and above "The swarm ran out", it's all footage I wanted you to modify. Make sure each of them have at least two different scene and minimum of 3s in length and have clean cuts and can loop smoothly.
>
> The ""I'm going to take back first place!"" at very bottom of the chapter felt out of place, since fanny is still laying in grass, I wanted you to change and add more text below the footage of fanny in grass laying, this is to keep distance from the last footage to the next chapter button.
>
> Chapter 3:
> In professor Joe image, change it to "C:\Users\muham\Downloads\joe-hd.png"
>
> In the storm citadel, only shows the image of the storm citadel instead of video.
>
> Remove "Official Aspirant comic, page 11", "Official Aspirant comic, page 12", "Official Aspirant comic, page 13", "Official Aspirant comic, page 14" and Official Aspirant comic, page 19
>
> Chapter 4:
> The hero section video are stopped and not playing, fix it, if you intend to make it video, make sure it can play and have at least two scene so it can transition cleanly and loop smoothly.
>
> Remove the "Don't be scared kiddo, everything's gonna be alright." text since it's already in the image below it.
>
> Remove Official Aspirant comic, page 24, 26 (below "Whatever, let's do this!" only),
>
> Put more text in "The crowd went quiet" section or below the footage where layla stood in front of fire depressed, make it feel emotional.
>
> Put more text also below "None of Joe's three ranks had been gold." or when the gold ender broke the shield/dome.
>
> Chapter 5:
> In hero, find another video cuts or footage to play after it (concat), so it have two scene and make sure the cuts are clean and loop smoothly.
>
> Video above ""Eleven," said the channel. "Ten."" are too short, so it feels like bad cut from an video, either finds another scene that match, ot just put it in next video footage or remove it.
>
> Merge the video above "The chest opened, and the giant fired at her" to video below it, also with footage of Layla shooting it below the "the cannon on her shoulder and every cell lit." and video below "Then everything the giant had gathered went off inside it.", so it will be one sequence of fanny striking, fanny saved her, and shoot the ender. This means also removing the "Official Aspirant comic, page 32"
>
> Remove Official Aspirant comic, page 30
>
> Chapter 6:
> Remove Official comic, page 38
>
> Chaper 7:
> In "An AI droid, one of the Academy's helpers.", change the image to "C:\Users\muham\Downloads\ai.png"
>
> In meet Chang'e, move the change photo a tiny bit to the left, and little bit up and make sure the face is centered.
>
> In meet Selean, change the photo to "C:\Users\muham\Downloads\s.png", you can crop it to fit.
>
> In meet Lesley, move the photo image more to the right, make sure the body and face is centered.
>
> Chapter 9
> Merge the video below "Jump training was on the Academy roofs. Layla backed up to the rail" with video below "Layla stood there with her arms still out", so the video and scene are one.
>
> Remove the Guinevere and vexana encounter, save it for another chapter since the next chapter is already moving to Oro and it's too short to introduce a character. So end the chapter in "The raid that mattered was on a shore ward. At the portal, a pink-haired girl stopped in front of Layla with her chin up.", and remove the "Terrinia's shore wards" image

"The Official Aspirant comic, page N" in these notes is the credit line printed under a picture: remove the picture (the panel insert) whose credit reads that page. A paragraph that the owner quotes is found by its words in the chapter.
