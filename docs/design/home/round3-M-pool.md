# Home, round three: the wall's picture pool (M-pool, 20 Nov 2026)

The owner: "the list of photo size on the left are too small so many images are repeated to frequently. Also I wanted you to make sure there's no same image near each other or same row." The wall drew from 18 splash arts and 50 scene thumbnails (`tiles-data.ts`). This is a pool of 159 different official pictures with the data the wall needs to keep look-alikes apart. The helper that builds the wall (H2-wall) reads this note.

## What was made

| File                                                                                    | What                                                                                     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web/public/img/home/wall/<id>.webp` (159)                                         | 640 wide WebP, 9 to 51 KB each, 4.42 MB in all (named by the collection's id)            |
| `apps/web/public/data/home/wall.json` (103 KB)                                          | the pool: one record for each picture, `order`, `first`, `gap`, counts                   |
| `scripts/home/media/pool_scan.py`, `pool.py`                                            | measure the candidates once, then choose, cut and write (README in that folder)          |
| `scripts/home/media/pool-curation.json`                                                 | the pictures left out by eye, each with its reason (`exclude`), `include`, `focus`       |
| `apps/web/src/features/home/fx/image-field/pool.ts`                                     | the pure reader: types, `loadPool`, `byCharacter`, `byGroup`, `apart`, `pickApart`, ...  |
| `.../pool-preload.ts`                                                                   | `poolItems()`: the loading list (first 24 waited, the rest deferred)                     |
| `.../pool.test.ts`                                                                      | tests on the real file (distinct, official only, spread, order holds) and on the helpers |
| `sections/aspirants/preload.ts` (one line) and `preload-items.test.ts` (one allowed id) | `...poolItems()` and `"field:pool:first"` in the allowed waited list                     |

## Where the pictures come from

Only OFFICIAL pictures (`canon: "official"` of the Arts data, checked for every record, never fan art, never a picture "Made for this site"): the 18 official splash arts (all in, with the game's corner mark cut out by the `clean` windows of `picks.json`), 55 Game art stills and 86 scene stills of the collection. The posters, stickers and panels of Others and the design sheets are left out (words, sheets, small). A scene or game still is cut from the 1280 wide `p` of the mirror.

- 120 pictures are single Aspirants: 12 each (Fanny 11: the collection has few of her), 40 are group pictures (two or more Aspirants, or none: 5 at most with none). The `character` field is one of the ten ids or `"group"`; `chars` lists everyone in the picture.
- Every picture is cut to 16:9 around its subject (`focus`): the films' 2.2 to 2.4 to 1 frames lose their sides, which a 16:9 card would lose anyway, and the card keeps all its pixels. The three splash arts that are not 16:9 use the `clean` window. So the whole pool is 16:9 (the brief said "and a few other shapes": none were kept on purpose, a wide card shows fewer pixels; `shape` and `lib` (the whole picture in the bucket) are in the data if the wall wants another shape).
- Near duplicates were removed by a look-alike test on an equalised 32 by 18 gray thumbnail (colour grade or gamma does not fool it), plus a 16 by 9 colour one for "the same scene in another light". Two pictures closer than 0.30 are one shot (the better one stays). A picture closer than 0.9 to one already chosen is left out.
- `group` is the same scene: average linkage over the gray look plus four times the colour look (threshold 1.25). The Game art stills share a purple city backdrop with a different Aspirant in it: they are one group. At most two pictures of a group are in the pool (in practice 159 pictures stand in 155 groups).
- Looked at: three full contact sheets of the pool (160 pictures at 240 wide, in dealing order), and the pairs closest to each other. About 60 pictures were left out by eye (a drone close up, an explosion, a dark frame, words burned in, a sticker on white, a UI screen), each listed in `pool-curation.json` with its reason, and the pool was cut again.

## The record (`wall.json`, parsed by `pool.ts`)

```ts
interface PoolPicture {
  id: string; // the collection's id, e.g. "arts-game-..."; the splash arts keep the ids of picks.json
  file: string; // "/img/home/wall/<id>.webp", under public/, 640 wide, no corner mark
  w: number; h: number; bytes: number;
  character: "fanny" | ... | "selena" | "group";
  chars: string[]; pair: string | null;
  hue: number; // dominant hue 0..360
  dark: number; // MEAN LUMINANCE 0 (black) to 1 (white): the brief's name, the value is brightness
  group: string; // "g000".. pictures that look alike share one
  room: "splash" | "game" | "scene"; shape: "16:9" | ...;
  focus: { x: number; y: number }; // the subject, fractions of the picture
  title: string; alt: string;
  lib: { p: string; f: string; w: number; h: number }; // the same picture in the bucket (libUrl), for a preview window
}
```

`wall.json` also has `order` (one cyclic order of all ids), `gap` (7), `first` (24), `cardW`, `counts`.

## How the wall should use it (for H2-wall)

1. **`import { loadPool, ordered, apart, pickApart, poolSource } from "../image-field/pool"`**, never from `image-field/index.ts` (that pulls three.js; `pool.ts` is pure). `await loadPool()` is one memoised fetch. The loading list has already run it.
2. **`order` is a ready dealing sequence.** Deal the wall from it (`ordered(pool)[n % count]`): any two pictures less than `gap` (7) places apart never share a group, a single Aspirant or a pair of group pictures (`orderProblems(pool)` is empty, a test keeps it so), and neighbours differ in hue and brightness where it can. If the wall has rows of 6 or 7, deal along the order and the same row never repeats a picture or an Aspirant. For another layout (several rows side by side, pictures arriving from off screen) use `pickApart(pool, near, used, rand)`: it returns a picture apart from every picture in `near` (the neighbours and the row), the least used first, null when nothing fits. `apart(a, b)` is the single rule.
3. **Textures.** `poolSource(pic)` is the `PicSource` (`id` `field:pool:<id>`, the whole file, no crop). Fetch with `getBitmap(poolSource(pic))` from `bitmaps.ts`. A 640 by 360 texture with mips is about 1.2 MB of GPU memory: 159 at once would be about 190 MB. Keep a rolling window (about 40 live textures around what is on screen) and `releaseBitmap` the rest. The pool's own cycle order is the natural window.
4. **Subject.** Use `focus` the way `wideSource`'s `focusInWindow` does: centre the crop of a card of another shape on it.
5. **A press on a pool picture** can open the preview window from `lib` (`p` for the quick look, `f` the full size, 2560 wide mostly), as the tiles do. The old `WALL_TILES` (50 thumbnails, `field:tiles`, waited) and `HERO_WALLS` (the 18 `p` pictures, which the hero's ring flies onto) stay as they are: the 18 splash arts are also in the pool, with the same ids as `picks.json`'s `wall.order`. When the hero's cards land on the wall, avoid a card that shows the pool's own copy of the same splash art next to it (same id, so `apart` already says no). If the wall switches fully to the pool, `field:tiles` can go (and the test's allowed id with it).

## Loading (`pool-preload.ts`, added to `sections/aspirants/preload.ts`)

- `field:pool:first` is WAITED (weight 2): the first 24 pictures of `order` (688 KB), decoded into the bitmap store, real bytes in the bar. They are every Aspirant once or twice, the first screen of the wall.
- `field:pool:1` to `field:pool:8` are DEFERRED (20 pictures each, about 0.55 MB, priority 40 to 47, so after the preview windows' sooner items and before the full size pictures at 160). They fetch the bytes into the browser's cache only (no decode), so the wall's `getBitmap` is quick and the 135 decoded bitmaps do not sit in memory. A tranche past the end of a smaller pool does nothing.
- The waited site list in `preload-items.test.ts` now allows `field:pool:first` (0.69 MB of waited bytes on top of the old list; the test's byte budget counts only files that `publicBytes` can see by id, so it does not change).

## Rebuild

```
python scripts/home/media/pool_scan.py        # about 2 minutes, writes the cache to D:/ren/aspirant-work/home/M-pool/
python scripts/home/media/pool.py --sheet     # about 1 minute, writes the files and the looking sheets
```

Change what is in it with `pool-curation.json` (`exclude` an id with a reason; `include` forces one; `focus` sets a subject point `{x, y}` of the source picture), or `PER_CHAR`, `GROUP_TARGET`, `MAX_KB`, `CARD_W`, `SEED` in `pool.py`. The same input gives the same output. A picture that leaves the pool is deleted from `public/img/home/wall/`.

## Numbers to tune

`PER_CHAR` 12 and `GROUP_TARGET` 40 (159 pictures; more Aspirants' art exists in the scene room: raise them for 200), `MIN_LOOK` 0.9, `GROUP_SD` 1.25, `DUP_SD` 0.30, `DEAL_GAP` 7 (raise it for a wider wall: the order needs about twice the gap in pictures per Aspirant), `FIRST` 24, `START_Q` 82 and `MAX_KB` 52.

## Not done, not verified

- Not seen on the wall: no card of the pool has been drawn in the field yet (that is H2-wall's). The pictures were looked at as contact sheets and one at full size (corner mark gone, sharp at 640).
- A picture file replaced under the same name (a rebuild with another crop) can be served from the browser's cache: the names are by id, with no version. Bump a folder name or add a query if a rebuild changes cuts after release.
- The hue is skewed to purple and blue (the art is): 50 of 159 in 300 to 360, 49 in 240 to 300, almost no yellow or green. Fanny has 11 (the collection holds few of her).
- The tail of a 135 picture warm-up is not timed on a slow link, and nobody watched the deferred items run in the bar. `knip` will list the exports only the test uses (`byGroup`, `firstScreen`, `orderProblems`, `pickApart`, `POOL_*`) until the wall imports them.
- `pnpm check`, the full vitest run, knip, eslint and the build were not run (the owner's process rule). One targeted vitest file (`pool.test.ts`, 14 tests) passes; the filtered `tsc` is named in the report.
