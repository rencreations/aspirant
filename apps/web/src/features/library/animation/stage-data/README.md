# Stage data of the Animation room

One `<slug>.generated.ts` for each of the six aspirants that have no stage of their own: Layla,
Fanny, Ruby, Angela, Lesley and Chang'e (`change`). They are written by
`scripts/library/animation/stage.py <slug>`. Do not edit them by hand: change `stage.py` or
`analyze.py` and run the script again.

Each file exports three things (the room reads them by shape, so the names do not matter):

- `<SLUG>_STAGE_TIERS`: the sizes the videos exist in (`1080` is 1920 wide, `1440` is 2560 wide).
  There is no 2160 size, so `pickTier` gives a 4K screen the 2560 picture.
- `<SLUG>_STAGE_BYTES`: the size in bytes of every file in every size, for the loading bar.
- `<SLUG>_STAGE_TIMELINE`: the frame numbers the stage engine cuts every hand-over on
  (`features/character/stage/timeline.ts`).

The videos are not in the repository. They are in the library bucket under
`animation/<slug>/<size>/<file>.mp4`, with `animation/<slug>/still.webp` (the first picture, 2560 wide)
and `animation/<slug>/poster/{t,p,f}.webp`. Make the media object with
`createStageMedia({ id: "<slug>", dir: libUrl("animation/<slug>"), ... })`. The id must be the slug,
because the stage drops what is still queued by the last part of the folder.

Files of a character: `welcome.mp4`, `idle.mp4`, `gallery-in.mp4`, `gallery-loop.mp4`,
`gallery-out.mp4`, `short-1.mp4`, `short-2.mp4`, `short-3.mp4`. There is one pose, the zoom pose
(`gallery`). `about` and `skills` in the timeline point at the same three files and are never asked
for. Chang'e has two body part clips, so her `short-3` points at the file of `short-2`.

`stage-data.test.ts` checks the invariants of every file that is here.
