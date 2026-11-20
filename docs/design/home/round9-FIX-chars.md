# Round nine: the character page content (FIX-chars, 20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-9-request.md` (last paragraph). Code: `apps/web/src/features/home/sections/list/frames.ts`, media script `scripts/home/media/loops.py` and `picks.py`.

## What changed

- **Guinevere, Ruby and Vexana are pictures.** Their frames come from the owner's folder `media/_all/splash-art/cropped` (1152x1440, Vexana 973x1216, already 4:5 and centred on the character). They had loops of the title banners before. They are now `kind: "still"`, the same as Fanny and Layla: the 4:5 frame shows the card (`img/home/cards/<slug>-45.webp`, cut from that folder by `cards.py`, 960x1200) and a press opens the whole splash art of the library (`arts/v2/splash/<id>/f.webp`, 2560x1440, from R2). The page gives a still its slow push.
- **The folder's pictures are exact windows of the library's art.** Found by sliding each one over the official picture (error 7 to 10 against 50 to 66 elsewhere, Fanny and Layla as the check): Guinevere x 996, Ruby x 555 (both 1152 wide, full height) and Vexana x 1060, y 224 (973x1216, not scaled). These are the `crop` boxes in `LOOPS`, so the frame's window is exactly the owner's cut and the viewer's morph from the frame to the whole picture has no jump.
- **Chang'e's video, zoomed out and centred.** The window was 691x864 at x 806 of the 1920x1080 banner, which left her left of centre. It is now 776x970 at x 640 (`window` x 0.3333, w 0.4042, h 0.8981): 12 percent more of the picture, and her face (x 1010 to 1040) and torso sit in the middle. The content moved right in the frame by about 100 CSS px. The limit on the left is the quote box and the title (the box ends at x 635), on the bottom the small letters at y 1037. The 4:5 poster is `loops/change-45-v2.webp` (a new name, cut again from the first frame of the same video). The video and `change-full.webp` are the same files (checked by hash), so no media-store bump. The viewer shows the whole banner, so it needed no change.
- **Removed:** `public/video/home/loops/{guinevere,ruby,vexana}.mp4`, `public/img/home/loops/{guinevere,ruby,vexana}-{45,full}.webp` and `loops/change-45.webp`. The deferred loop bytes of the list went from 11.88 MB to 6.33 MB, the library stills (R2, on a press) from 1.01 MB to 3.09 MB. The posters of the three pictures are the hero's cards, so they were already in the cache.

## How it was made (nothing by hand)

- `loops.py`: the three `LOOPS` entries are `kind: "still"` with `art` (the library id) and `crop`; Chang'e's crop changed and has `poster: "change-45-v2"`. New flags: `--only a,b` and `--posters-only` (cut the posters again without encoding the video). Run: `python scripts/home/media/loops.py --only change --posters-only`.
- `picks.py` reads the poster name from `loops.poster_stem` and writes the records (`picks.json` `loops`; the diff against the old file touched only `loops` and `loading`). The loading labels name the new counts.
- `frames.ts` is the copy of `picks.json` `loops` (kept equal by `frames.test.ts`, which passes). `preload.ts` needed no logic change: a still is a poster item and a deferred whole picture item, the loops that left simply drop out of the list. Only its comment changed.

## Looked at (real Chrome, dev server on 3000, scripts in `D:/ren/aspirant-work/home/chars/`)

- 1440x900: the rests of Guinevere, Ruby, Vexana and Chang'e (the video loop playing), the thumbnails on both sides, and the viewer on Ruby, Vexana and Chang'e at rest, 330 ms into the morph and open. The frames fill the 4:5 window, the morph goes from the crop to the whole with no jump, the whole picture opens with the game's mark in its corner (as Fanny and Layla's do).
- 390x844: the same four frames. No console error in any run.

## Calls made without the owner

- The viewer shows the library's whole 16:9 splash (with the game's mark in its corner), as it does for Fanny and Layla, not the 4:5 cut again. A 4:5 whole picture would have needed a new kind of frame for no gain.
- "Move it a little to the right" for Chang'e is read as "move her to the right inside the frame so she stands in the middle": the window moved left over the banner.
- Alt texts of the three pictures are the library's own (`picks.json`).

## Not done

- The loops of Guinevere, Ruby and Vexana were not kept as an option. The production build and a weak machine were not run (the owner's process rule).
- `test_media.py` was run for its `Windows` cases only; the rest of the suite and `knip` were not.
