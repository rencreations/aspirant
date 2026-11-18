# More faces for the normal drone, and the icons of the dialogue bubble (`scripts/home/drone/`)

The normal drone (`apps/web/public/models/about/drone.glb`, shared with `/about`, **never changed**) has a face atlas of nine drawings and all nine are used. The home needs more, so this draws two more atlases in the same grid, with the same ground and the same cyan. The page swaps the face texture at run time. The shader is not touched.

| File                                          | What it is                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/web/public/img/home/drone-faces.webp`   | Page A: shocked, confused, thanks, sweat, exclaim, question, sparkle, sad, dizzy. 21,286 bytes.                     |
| `apps/web/public/img/home/drone-faces-2.webp` | Page B: proud, cry, heart, smug, wink, dots, music, determined, laugh. 12,976 bytes.                                |
| `apps/web/public/img/home/drone-faces.json`   | Every face: its page, its cell, its `uCell`, its rectangle in the picture, whether it blinks.                       |
| `apps/web/public/img/home/marks.webp`         | Six icons for a bubble (heart, sparkle, thanks, smile, bang, question) on a clear ground, 576 by 384, 24,700 bytes. |
| `apps/web/public/img/home/marks.json`         | The cell of each icon (pixels and uv).                                                                              |

Never edit the outputs by hand. Change a script and run it.

## How to run

```
node scripts/home/drone/faces.cjs                 # the two atlases and drone-faces.json
node scripts/home/drone/check.cjs --renders D:\some\folder   # every face on the real drone, beside the shipped nine
node scripts/home/drone/marks.cjs                 # marks.webp and marks.json
```

`faces.cjs` and `marks.cjs` draw SVG and render it with `sharp` (from the root `node_modules`), at twice the size and brought down. `check.cjs` needs Chrome: it loads the shipped `drone.glb` in real Chrome with the site's three, patches the screen's material with the same lines as `features/about/drone/drone-scene.ts` (the cell, the blink about 0.585 of the cell, the look), swaps in the atlas and photographs each cell. `--faces DIR` names another folder with the atlases.

## The faces

- **Same grid, same style.** 3 by 3 cells, ground `#0a121a`, ink `#23d0d8` (the `CYAN` of the scene), flat chunky rounded strokes. The glyphs sit where the shipped ones do (the eyes' middle at 44 percent of the cell from the top, in the drawing as seen), so the shader's blink squash about its pivot and the look slide work unchanged. The two atlases are 1024 pixels square (341 per cell) and lossless: sharper than the shipped 512, the same arrangement.
- **Stored upside down, like the shipped one.** The FBX had v up and the build of the drone flipped the picture, so the screen shows a stored cell upside down. These atlases are drawn upright and flipped top to bottom, so what is drawn shows upright on the drone. The screen's UVs lie in the cell at column 1, row 2 of the stored picture: `uCell` of a face is `[column - 1, row - 2]` (the same convention as `CELL` in `drone-scene.ts`), and the JSON gives it.
- **The screen is a shield.** The visible part of a cell is a rounded shape that narrows toward the bottom: keep the details in the middle. Everything here was drawn, photographed (`check.cjs`) and moved in until it showed. `home-faces.png` is the proof; `home-faces-blink-look.png` shows every face with the blink at 0.6 and with the look slid, and none leaves its cell.
- **How a page uses it.** Load the second atlas like the first (`flipY` false, `SRGBColorSpace`, repeat wrap, anisotropy), keep both textures, and set `material.map = atlasB` and `uCell` from the JSON when a face of page B is wanted. Changing which texture a sampler holds does not rebuild the program. Cells do not blend: hide a change behind a blink, as the scene does now. `blinks: false` faces (the symbols, the closed-eye faces) should not blink: a blink only squashes them.
- **The faces:** shocked (wide rings, small pupils, a small mouth), confused (one big oval, one small, a raised brow, a wavy mouth), thanks (closed arcs, hearts on the cheeks, a smile), sweat (worried brows and a drop), exclaim (a big `!`), question (a big `?`), sparkle (four point stars), sad (drooping eyes, brows, a frown, a tear), dizzy (two spirals), proud (half lids, a smile, a sparkle), cry (closed cups and streams of tears), heart (two hearts), smug (half lids, one brow raised, a smirk), wink (an arc and an oval), dots (`...`), music (two notes), determined (flat slanted bars), laugh (arcs and a big open mouth).

## The marks

Six icons for the bubble the drone speaks in, flat colour with the drone's ink line (`#1f2735`, 7 units on a 192 unit cell): pink heart, gold sparkle, a heart held up on two cupped hands (thanks), gold smile, pink bang, cyan question mark. The shapes of the heart, sparkle, bang and question are the page's own comic marks (`features/about/companions/fx.ts`), the rest is new. The bubble itself is drawn by the page. `marks.json` has each cell in pixels and in uv (`u`, `v` from the top left, `du`, `dv`).
