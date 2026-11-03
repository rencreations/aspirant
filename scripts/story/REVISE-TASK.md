# Revision task: rewrite scenes of the novel and their pictures after the owner's notes

The owner has looked at the live story pages and sent notes (their own words are in "The owner's notes" below). Your block of chapters needs BOTH a change of the story text (the novel) AND new visual scripts (the pictures, clips and voices), because the owner wants the Layla and Fanny arc to follow the official trailer exactly and to be full of footage.

## Read first

1. `D:\aspirant\scripts\story\README.md` (the pipeline, the looking tools, the sources) and `D:\aspirant\docs\superpowers\specs\2026-11-03-story-visual-reader-design.md` ("The visual script"). New since then, also valid in `visuals/cNN.json`:
   - A `clip` insert may have `"overlay": {"kicker": "...", "title": "Meet Obsidia"}`: text laid over the clip (large display type, bottom left).
   - A `voice` insert plays a spoken line taken from the sound of an official film: `{"after": N, "anchor": "...", "kind": "voice", "speaker": "obsidia", "src": "<video path under media>", "start": 12.4, "end": 15.1, "line": "the words spoken"}`. `speaker` is a character slug (fanny, layla, ruby, angela, lesley, change, guinevere, vexana, obsidia, selena). It is placed after paragraph N like any insert and shows as a small player. The `line` is only for you and the caption; the words in the novel's paragraph must match what is spoken.
   - Clips: at most 8.5 s each. For the chapters of this task the old limits are LIFTED: you may use many clips (about 8 to 14 inserts a chapter, up to 12 clips), and a clip may follow a clip when the scenes are an action sequence cut in quick beats (keep every cut a different shot or moment). Pictures may be reused only when the owner asks.
   - Subtitles: some films have subtitles burned into the picture. Crop every clip and frame so no subtitle shows (the `crop` field is `[x, y, w, h]` in source pixels; use `tools/frame.py ... --crop` to check). If a crop is impossible, choose another shot. (The site also fades the foot of every clip.)
2. The novel's rules: `D:\ren\aspirant\CLAUDE.md` and `D:\ren\aspirant\story\main-build\style-guide.md` section 2, `style-samples.md`, `rulings.md`, `drafting-brief.md` section 7. Chapter files are `D:\ren\aspirant\story\main-build\chapters\NN-slug.md`; the book `story/main.md` is built from them by `C:\Users\muham\anaconda3\python.exe D:\ren\aspirant\story\main-build\chapters\assemble.py` (never edit main.md by hand) and checked by `...\chapters\check.py <file>`. The style is the SHORT STYLE: very short plain sentences, short paragraphs, about a third dialogue, italic thoughts, no padding; no em or en dashes, never "conviction" (write "aspirant power"), spellings Terrinia, Selrick, Storm Citadel, US spelling, straight quotes, no romance. Voice lines used as dialogue stay word for word, each followed by its `<!-- voice: ... -->` marker line.
3. The official sources outrank the old draft: the official videos are the truth (`media/**/readme.txt`, `footages/manifest.json`, the films themselves), then `story/official/*` (the Aspirant comic transcript is `story/official/the-aspirant-comic/comic.md`; the comic pages are `media/layla-and-fanny/art/comic/official-aspirant-comic/1.jpg` to `43.jpg`), then the rulings. The owner may change the story: you may rewrite, add and cut scenes of your chapters to match the footage, but you must not contradict an official fact or the rulings, must not resolve the open endings, and must keep what later chapters depend on (check the neighbouring chapters, `continuity.md`, `setups-payoffs.md`, `canon-events.md`). Log every real invention (a new beat that no source states) as a row in `invention-log.md` section 8 (continue the DI numbers after the last one) and say so in your report.

## The trailer is the absolute truth for the Layla and Fanny arc

`D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm` (the film, 1:41 with credits; times below are seconds in that file; the song "We Believe" has lyrics but no spoken lines; `subtitle/` holds the lyrics; `footages/manifest.json` has one-line notes per cut). Look at it closely with `tools/sheet.py` (use `--start` and `--end` to zoom into a stretch) and `tools/frame.py`. The scene list, from the owner:

- 00:00 to 00:06 title card, then a dark corridor: a pink-haired caped figure charges a glowing blue shot; a silhouette in a bright doorway.
- 00:06 to 00:08 and 00:13 to 00:16: Layla and Fanny race each other on the white spiral stairs, to see who gets to the top first (simple things, competing).
- 00:08 to 00:10: Layla dodges an attack while flying.
- 00:10 to 00:12: Layla on a sofa, watching the sunset from a window.
- 00:12 to 00:14: an Ender drops down.
- 00:15 to 00:21: the song begins, the city skyline at dawn.
- 00:19 to 00:21: Layla fixing her cannon.
- 00:22 to 00:25: the two compete, even in the smallest things.
- 00:28 to 00:33: Fanny flying and defeating the training drones (the red countdown 0150 to 0148 is the count of DRONES destroyed in the training, they compete together, it is not seconds).
- 00:33 to 00:44: Layla and Fanny's training fight in the white corridor, fast, with their moves.
- 00:44 to 00:50: Fanny lying in an open green field, her hand reaching for the sky.
- 00:50 to 00:58: an Ender shot in the chest by Layla from far away (billboard destroyed, the shot passes through a building).
- 00:58 to 01:04: Fanny fights an Ender alone with her 3D maneuver gear.
- 01:04 to 01:07: Layla stands in front of flames, looking sad and depressed.
- 01:07 to 01:10: the big Ender breaks the dome shield or the energy system.
- 01:10 to 01:11: the big Ender shoots a laser from its chest.
- 01:11 to 01:13: Fanny fights Enders, trying to get close to the big Ender.
- 01:13 to 01:16: Fanny charges and jumps in front of the big Ender, recklessly.
- 01:16 to 01:17: the big Ender shoots a big laser at Fanny.
- 01:17 to 01:24: Layla pushes Fanny away while charging, aims her cannon at the laser and shoots it.
- 01:24 to 01:31: Layla and Fanny fight together, back to back, protecting each other.

Use ALL of these moments somewhere in the arc (chapters 1 to 5, and 6 to 9 where they fit), as clips cut from `trailer.webm` placed after the paragraphs that tell them, and change the story text so that each moment is told in it (the trailer wins when the old text differs). The block split between agents is in your prompt; tell me in your report which trailer moments you placed where.

## What you must produce

1. The changed chapter files (novel repo), then run `assemble.py` and `check.py`.
2. For each chapter of your block, a new `D:\aspirant\scripts\story\visuals\cNN.json` whose `after` and `anchor` match the NEW text (print paragraphs with `cd D:\aspirant\scripts\story` and `C:\Users\muham\anaconda3\python.exe storytext.py cNN`, run after assemble). Run `C:\Users\muham\anaconda3\python.exe visuals.py cNN` to 0 errors. Look at every frame and crop you choose with the tools before writing it down. Prefer clips (footage) to stills everywhere a clip fits, and use `voice` inserts where a quoted line is spoken in an official film you have timing for (see the end of "The owner's notes").
3. A report (at most 400 words): what you changed in the text (by chapter), the trailer moments placed and where, the inventions logged, anything you disputed or could not do, and any later chapter that now needs a look.

## You must not

Run `build.py` (the coordinator builds once, it would race), run git, edit another agent's chapters or visual scripts, edit anything under `D:\ren\aspirant\media`, `audio`, `story/official` or `story/selfmade`.

## The owner's notes (their own words, for the whole story page)

> In story page, modify the navbar to be always light mode and not change (except if user changed it), so it will not dynamically changed color based on the background. Also on the hero section, do not gradually change the navbar background, only shows transparent unti it comes to the story and the background is white or according to the theme (light or dark)
>
> I wanted you to see the visual image and always prioritize using footage of the video and live animations. Here are list of visual things you can change, but see all and add more visual if fit the context.
>
> For video that have subtitle, crop it to make sure the subtitle is not shown or put gradient so it's less shown.
>
> Below are the examples, but I wanted you to see for all of them and change or add more visuals. I wanted you to see all the video detailly from all sources and you can crop or cut some parts to fits it more. See it a lot.
>
> Prologue hero changed to "D:\ren\aspirant\media\selena-and-obsidia\video\obsidia\footages\00m17s033ms-00m26s000ms"
>
> In meet obsidia, change it to this "D:\ren\aspirant\media\selena-and-obsidia\video\obsidia\footages\00m26s000ms-00m44s100ms\footage.mp4", so use video with overlay text instead "Meet Obsidia". Also change the position to be above "The strike had come after midnight" paragraph.
>
> Below the "Her Enders walked" paragraph, put this footage "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" and cut it to ~00:11-~00:14 where the ender appeared.
>
> In "She watched stars collapse.", change it to the video instead "D:\ren\aspirant\media\selena-and-obsidia\video\trailer\footages\02m25s125ms-02m38s958ms\footage.mp4" and crop to the obsidia where it shows only her, around 00:03-00:08
>
> In chapter 1 hero, you can change it to "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\footages\00m15s875ms-00m21s875ms\footage.webm" from 00:00 - 00:03
>
> In chapter 1, below the "A machine shaped like a dragon came through the gate", add the video of the blonde girl (selena) "D:\ren\aspirant\media\selena-and-obsidia\video\selena\video.mp4" from ~00:07-~00:10 where it shows selena and the dragon/silverbolt, cut it. Also remove the lollipop in mouth (fit the video).
>
> In chapter 2, in the sentences "A red counter read 0150: the seconds they had.", it's not a second they had, it's the total of drone they destroyed in the training. They're competing together. Also change the image below it to "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" from 00:28-00:33, the scene that only shows fanny flying and defeating the drone. Also make this scene more long since it's an action one, make it fast paced explaining their moves, and so it's longer and I wanted you to put the footage or cuts of the "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" videos in it and do it a LOTS. their scene are from 00:33-00:44, see it detailly and make sure it fits the context, stories, and videos/footage.
>
> In chapter 3 the storm citadel photo, change it to this video "D:\ren\aspirant\media\selena-and-obsidia\video\trailer\footages\00m15s125ms-00m29s708ms" from 00:00 - ~00:03.
>
> In chapter 3, it takes a lots of reference from the comics "D:\ren\aspirant\story\official\the-aspirant-comic", so I wanted you to put more images of the comics according to the context.
>
> For the comics, make sure the layout are right and nice to view. The example of wrong layout is in act 1 "The Enders came. The survivors drew back to Terrinia and trained the Aspirants.", chapter 4 "Official Aspirant comic, page 21" the layouts and composition are wrong. The difference in height makes them weird. You will mitigate and make sure visual problem like this is not shown. (Coordinator: the page now lays the panels of a row out at one shared height; still choose panels that read well together, and prefer one panel per insert when two panels have very different shapes.)
>
> In chapter 4: "Official Aspirant comic, page 27" image, crop it to not show the text in the first section "That day marked.." and instead put it in the story text itself, not in image.
>
> In chapter 4, change ""I know who they are," said Layla." to be above the guinevere's photo.
>
> In chapter 4: the usage of image above ""Eleven," said the channel. "Ten."" doesn't fit. The image shows Fanny recklessly charging into the Big Enders alone. Same with the image above "The shot came on her left", it shows the big enders destroying the unbreakablle dome shield.
>
> In chapter 4: the energy system image are not showing the actual energy system, see it visually, the position are not right.
>
> In chapter 5, the Official comic, page 38 are arrange poorly and doesn't look good in visuals. Arrange and change it. Also in this chapter it reference the comics a lot, so put more image so user can visualize it more easily.
>
> Also I wanted you to implement image viewer in the story page ... (done by the coordinator).
>
> In Layla and Fanny arc, I wanted you to add parts where layla and fanny is competing even in smallest things, like cleaning the hall. Also put the video footage of them competing since it's available in "D:\ren\aspirant\media\layla-and-fanny\video\official\lore\trailer\trailer.webm" from ~00:22-~00:25.
>
> Also in Fanny and Layla arc, I wanted you to see the trailer video detailly and it's transcript and video description and make sure all scenes are according to the trailer because it's the absolute truth. [the scene list above] You can change the story and make sure to put a lots of clips and footage from the trailer, and also all videos available. Make it have many visuals and assets.
>
> In chapter 9, it reference the short animation video a lot, but the image are little. I wanted you to put more images and visuals into it.
>
> In chapter 9, in "Enders dropped onto the market stalls through a tear in the dome", I wanted you to change the story. The image shows that they're fighting together, but there's too much fighting going on. Perhaps you can put this section and the images where the ender attack when layla and fanny work together, and you will also explain in the guinevere and vexana sides in parallel, so it will change from one POV to the other. Also it it's like this, you can introduce guinevere and vexana earlier.
>
> Below are the visuals that are blurry, you can change it to better image or use the video footage.
>
> Chapter 4: image above "Use the big shot!"
> Chapter 4: image below "None of Joe's three ranks had been gold."
> Chapter 4: image above "The shot came on her left"
>
> In chapter 9, the Karina section or in the last one "The outskirts, a storm night, weeks after the breach." is it really necessary, remove it because it's not really fit since the next chapter explain ruby. You can dispute my suggestions.
>
> Also I wanted you to extract all of the audio and voicelines from the video, like the trailer, etc and put it also there in the story dialogue, so that it will have more hearable voicelines dialogues.

"Chapter N" in these notes means the chapter labelled N on the page (`cNN`; the prologue is `c00`).

### On the voice lines from the films

For the films of your chapters that have spoken lines (the Selena and Obsidia trailer and character films, the Lesley and Chang'e and Ruby and Angela films, the short animation, the Guinevere and Vexana films), find where each line is spoken: the `readme.txt` next to a film gives the scene by scene description with the quoted lines, `footages/manifest.json` and the folder names give the time range of each scene, and the subtitle files (`*.srt`) give exact times where they exist. Cut the window tight around the spoken words (extract a frame and use `tools/sheet.py` to bound a scene; narrow a window by trying ranges with a short `voice` insert and checking the scene's own range). Put a `voice` insert after the paragraph that quotes the line, only when the novel's paragraph really says those words (adjust the paragraph to the film's words where the owner's "the footage is the truth" applies). A line that already has a `<!-- voice: -->` marker from the voice tables keeps that one.
