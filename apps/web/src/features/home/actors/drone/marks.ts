/**
 * The one icon the drone still draws: the bang of its shock mark, a cell of
 * `scripts/home/drone/marks.cjs`'s picture (`public/img/home/marks.webp`, 576 by 384, a grid of 192
 * pixel cells). The speech bubbles and the other icons are gone (the owner's call, 19 Nov 2026).
 * No three here.
 */

/** The picture of the file: 3 columns by 2 rows of `CELL` pixels. */
export const CELL = 192;

/** Where the bang is, in cells from the top left. */
export const BANG_CELL = { col: 1, row: 1 } as const;
