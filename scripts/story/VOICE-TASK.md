# Voice task: put the spoken lines of the official films into the story as playable voice lines

The owner asked: "extract all of the audio and voicelines from the video, like the trailer, etc and put it also there in the story dialogue, so that it will have more hearable voicelines dialogues." The book already has 88 voice lines from the character voice tables (the paragraphs that end with a `<!-- voice: ... -->` marker); those stay. You add MORE, taken from the sound of the official films, as `voice` inserts in the visual scripts.

## Read first

`D:\aspirant\scripts\story\README.md`, `D:\aspirant\scripts\story\REVISE-TASK.md` (the schema of a `voice` insert and the looking tools; ignore its parts about rewriting chapters) and `D:\aspirant\docs\superpowers\specs\2026-11-03-story-visual-reader-design.md`.

## The `voice` insert

```json
{
  "after": 12,
  "anchor": "first words of paragraph 12",
  "kind": "voice",
  "speaker": "ruby",
  "src": "ruby-and-angela/video/trailer/001_xxx.mp4",
  "start": 44.0,
  "end": 47.3,
  "line": "I'm Ruby! Don't you remember?"
}
```

It plays `src` from `start` to `end` seconds (the window is cut out of the film's sound and levelled; the film's own music may sit under it). It shows as a small player with the speaker's portrait after paragraph `after`. `src` is the full film file (times are absolute in that file), not a `footages/*/footage.mp4` cut, unless the line is in a cut and you prefer the cut's own times (then `start`/`end` are relative to the cut). Window at most 15 s; aim for the spoken words only, with 0.1 to 0.2 s of margin.

## Where the lines and their times are

- **Subtitle files with exact times** (English): `ruby-and-angela/video/trailer/english.srt`, `ruby-and-angela/video/ruby/english.srt`, `ruby-and-angela/video/angela/english.srt`, `ruby-and-angela/video/qna/english.srt`, `lesley-and-change/video/official/trailer/subtitles/NA.en.srt` (note: it belongs to the 157 s trailer), `layla-and-fanny/video/official/other/short-animation/english.srt`. Each folder holds the film (`001_*.mp4`, `*.webm`, `video.*`; use `tools/probe.py` and `ls`). Subtitle times are in the film's own timeline.
- **Scene descriptions with the quoted lines but no exact times**: the `readme.txt` next to each film (`selena-and-obsidia/video/trailer`, `.../selena`, `.../obsidia`, `vexana-and-guinevere/video/connection-lost`, `.../relink`, and others) lists the scenes with time ranges in square brackets and the lines spoken in them; the `footages/manifest.json` gives each cut's range. For these, take the scene's range as the window only when the scene holds ONE line (or trim with `tools/sheet.py` frames of the burned-in subtitle: a subtitle is on screen while the line is spoken, so find the first and last frame where it shows with `tools/frame.py` at several times to bound the window).
- The game's character voice tables (`D:\ren\aspirant\audio\<name>\voice.md`) are the already-used voice lines. A line that is already a marked voice line in the paragraph is not repeated.

## What to do

1. Read your chapters with `cd D:\aspirant\scripts\story` and `C:\Users\muham\anaconda3\python.exe storytext.py cNN`. Find quoted speech that is spoken, in the same words or nearly, in one of the films above (the novel was written from the films, so many lines match: for example Ruby's "Angela, stop!", Lesley's "No! It's a decoy!", the Selena and Obsidia lines).
2. When the paragraph's words are the film's words (small differences of punctuation are fine), add a `voice` insert right after that paragraph (`after` = that paragraph's number, `anchor` = its first words) with the right `speaker` (a character film has one speaker; in a trailer decide from the scene description and the paragraph). When the paragraph paraphrases a line that the film says in other words and the film is the official truth, you may change the novel paragraph to the film's exact words if the meaning and the scene are the same (edit `D:\ren\aspirant\story\main-build\chapters\NN-slug.md`, then run `C:\Users\muham\anaconda3\python.exe D:\ren\aspirant\story\main-build\chapters\assemble.py` and `...\check.py <file>`, then print the chapter again because paragraph numbers can shift; keep the short style, no dashes). Do not rewrite scenes: this is only for aligning a line's words.
3. Verify every window with the tools: the subtitle's time range for SRT lines; for readme scenes, look at frames at the window's start, middle and end to see the right subtitle text on screen. A wrong window (cut mid-word or the wrong line) is worse than none.
4. Do not add a voice insert to a paragraph that already has a voice marker, and not more than one voice insert after the same paragraph unless two different people speak in it. Spread them: a chapter with many quoted lines should get the strongest ones (the lines the films give the most weight), up to about 8 a chapter.
5. Only edit `visuals/cNN.json` of YOUR chapters (add inserts in text order; keep the existing ones; run `C:\Users\muham\anaconda3\python.exe visuals.py cNN` for each, 0 errors). Do not run `build.py`, do not run git, do not touch chapters outside your range (other agents are rewriting chapters 0 to 5 and 9 right now).

## Report (at most 300 words)

Per chapter: how many voice inserts added, which films they came from, any novel paragraph you changed (with the old and new words), any quoted line that has a film source but you could not bound, and any film with spoken lines that you found no place for.
