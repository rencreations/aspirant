import type { PairId, Slug } from "@/content/types";

/**
 * The geometry of the roster wall, taken from the owner's reference strip. Every number is in
 * units of the board: the board is 404 units high and the panels fill 375 of them (from 5 to
 * 380), so the whole composition scales with the height of the screen (`--u` in the stylesheet).
 *
 * Every panel is a parallelogram whose sides lean at the same angle (about 33 degrees from the
 * vertical, 0.64 units across for each unit down). A panel is named by its four corners:
 *
 *      x1 ───── x2        top edge, at `y0`
 *     /         /
 *   x0 ───── x3           bottom edge, at `y1`   (x0 is left of x1, x3 is left of x2)
 *
 * The panels sit side by side with a thin gap, in rows (half height) and tall (full height),
 * staggered so that the rows never line up. The pairs run from the newest to the oldest.
 */
export const BOARD_H = 404;
export const SLANT = 0.64;

export interface Slot {
  readonly slug: Slug;
  readonly pair: PairId;
  /** The bottom left corner, the top left, the top right and the bottom right. */
  readonly x0: number;
  readonly x1: number;
  readonly x2: number;
  readonly x3: number;
  /** The top edge and the bottom edge. */
  readonly y0: number;
  readonly y1: number;
  /** Stacking: the hero sits at the back, the rest in front of it. */
  readonly z: number;
  /**
   * Where the picture sits. The splash is 16:9. `zoom` is the height of the picture in panel
   * heights, (`fx`, `fy`) is the point of it to show (a face, as fractions of the picture) and
   * (`tx`, `ty`) is where in the panel that point goes (as fractions of the panel box).
   */
  readonly zoom: number;
  readonly fx: number;
  readonly fy: number;
  readonly tx: number;
  readonly ty: number;
  /** A tall panel shows its ribbon all the time, like the reference. */
  readonly tall: boolean;
  /** The part of the hero that is always lit. */
  readonly bright?: boolean;
}

const ROW = 117; // the lean across half a panel
const TALL = 240; // and across a whole one

const top = (slug: Slug, pair: PairId, x1: number, x2: number, rest: Partial<Slot>): Slot => ({
  slug,
  pair,
  x0: x1 - ROW,
  x1,
  x2,
  x3: x2 - ROW,
  y0: 5,
  y1: 188,
  z: 3,
  zoom: 1.4,
  fx: 0.5,
  fy: 0.3,
  tx: 0.5,
  ty: 0.42,
  tall: false,
  ...rest,
});

const bottom = (slug: Slug, pair: PairId, x1: number, x2: number, rest: Partial<Slot>): Slot => ({
  slug,
  pair,
  x0: x1 - ROW,
  x1,
  x2,
  x3: x2 - ROW,
  y0: 197,
  y1: 380,
  z: 3,
  zoom: 1.4,
  fx: 0.5,
  fy: 0.3,
  tx: 0.5,
  ty: 0.42,
  tall: false,
  ...rest,
});

const tall = (slug: Slug, pair: PairId, x1: number, x2: number, rest: Partial<Slot>): Slot => ({
  slug,
  pair,
  x0: x1 - TALL,
  x1,
  x2,
  x3: x2 - TALL,
  y0: 5,
  y1: 380,
  z: 2,
  zoom: 1.15,
  fx: 0.5,
  fy: 0.3,
  tx: 0.5,
  ty: 0.36,
  tall: true,
  ...rest,
});

/** The pairs, newest first. */
export const BAYS: readonly PairId[] = [
  "selena-obsidia",
  "guinevere-vexana",
  "lesley-change",
  "ruby-angela",
  "fanny-layla",
];

export const SLOTS: readonly Slot[] = [
  // The pair at the front: Obsidia in the crimson, Selena behind the red tear.
  {
    slug: "obsidia",
    pair: "selena-obsidia",
    x0: 0,
    x1: 0,
    x2: 545,
    x3: 545 - TALL,
    y0: 5,
    y1: 380,
    z: 1,
    zoom: 1.12,
    fx: 0.5,
    fy: 0.45,
    tx: 0.56,
    ty: 0.5,
    tall: true,
    bright: true,
  },
  tall("selena", "selena-obsidia", 553, 727, {
    z: 1,
    zoom: 1.2,
    fx: 0.66,
    fy: 0.4,
    ty: 0.45,
  }),
  // Guinevere and Vexana, one over the other.
  top("vexana", "guinevere-vexana", 735, 971, { zoom: 1.5, fx: 0.7, fy: 0.55, ty: 0.46 }),
  bottom("guinevere", "guinevere-vexana", 615, 840, { zoom: 1.45, fx: 0.62, fy: 0.36, ty: 0.4 }),
  // Lesley tall, Chang'e under the next pair.
  tall("lesley", "lesley-change", 979, 1148, { zoom: 1.35, fx: 0.62, fy: 0.34, ty: 0.38 }),
  bottom("change", "lesley-change", 1036, 1164, { zoom: 1.7, fx: 0.4, fy: 0.3, ty: 0.42 }),
  // Angela above, Ruby under.
  top("angela", "ruby-angela", 1156, 1389, { zoom: 1.5, fx: 0.68, fy: 0.34, ty: 0.46 }),
  bottom("ruby", "ruby-angela", 1169, 1396, { zoom: 1.4, fx: 0.52, fy: 0.3, ty: 0.42 }),
  // Layla above, narrow, and Fanny tall at the end.
  top("layla", "fanny-layla", 1397, 1529, { zoom: 1.7, fx: 0.72, fy: 0.48, ty: 0.46 }),
  tall("fanny", "fanny-layla", 1539, 1714, { zoom: 1.35, fx: 0.62, fy: 0.3, ty: 0.36 }),
];

/** The blue plate at the end of the row. */
export const END = { x0: 1482, x1: 1722, x2: 2290 } as const;
/** The tear between Obsidia and Selena runs along the right edge of Obsidia's panel. */
export const TEAR = { top: 545, bottom: 545 - TALL } as const;
export const BOARD_W = END.x2;

/** The middle of a panel across its box, for the parallax and for finding the one in front. */
export const mid = (s: Slot) => (s.x0 + s.x2) / 2;
