# Second review: clips, subtitles and the rewritten scenes

Read `D:\aspirant\scripts\story\VERIFY-TASK.md` first: its checks (fit, spoilers, canon and sources, quality) and its "What you may change" and "You must not" all apply here, except that you may now look at the BUILT media, which is current: clips are in `D:\aspirant\apps\web\public\video\story\cNN\*.mp4` (with a still `*-poster.webp` beside each), stills in `public/img/story/cNN/`, voices in `public/audio/story/cNN/`, and `public/data/story/cNN.json` lists them in text order with their alt text. Look at a built clip with `C:\Users\muham\anaconda3\python.exe tools\sheet.py "D:\aspirant\apps\web\public\video\story\c06\i3-xxxxxxxx.mp4" --n 6` (an absolute path works; it prints a contact sheet of 6 frames with times: look at the first, middle and last frames). The build is NOT re-run by you: you edit `visuals/cNN.json` and check the new range or crop on the SOURCE film with `tools\sheet.py` / `tools\frame.py --crop`, then run `visuals.py cNN`.

Since the first review, a script turned the still FRAMES of these chapters into short CLIPS cut from the same shot (so a clip is about 3 seconds around the old frame, inside one shot), and film voice lines were added as `voice` inserts. The owner's rule for clips: **no subtitle may show** (crop it out with `crop`, or choose another stretch; the page also fades the foot of every clip, which is not enough on its own), and a clip must never show what the book has not reached.

## Check, for every clip of your chapters (hero, inserts)

1. **Subtitles and text:** burned-in subtitles, watermarks, on-screen UI text that is not part of the scene, black bars. Fix with a `crop` that excludes them (keep the clip's aspect sensible: wide, about 16:9 or wider) or move the window; if no stretch of the shot is clean, replace the clip by a still `frame` with a clean crop, or remove it.
2. **Spoilers:** open the clip's first, middle and last frame. Selena shows red eyes, pointed ears or Ender plating only from chapter 42 paragraph 29 on (her student design is in nearly every shot; prefer shots where she is small, turned away or asleep before then, and cut a window that avoids her face close-up); Vexana in her Ender look not before chapter 29; the Mother Matrix not in picture before chapter 33; Obsidia's face not between chapters 1 and 30 except where the text shows her.
3. **Fit:** the clip shows the people, place and action of the paragraph it follows (the alt text may be old: correct it to what the clip shows). A clip that now shows something different from the paragraph (the shot moved on) gets a tighter window.
4. **Cut or flash frames:** a clip must not begin or end on a different shot (a flash, a white frame, a title card): trim it.

## Report (at most 250 words)

Per chapter: what you changed, one line each. Then what is still uncertain.
