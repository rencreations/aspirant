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
  readonly z: number;
  /**
   * Where the picture sits. The splash is 16:9. `zoom` is the height of the picture in panel
   * heights, (`fx`, `fy`) is the face in the picture (fractions of it), and (`tx`, `ty`) is where
   * in the panel box that face lands (fractions of the box). `tx` is worked out so that the face
   * is in the middle of the slanted shape at the height of `ty`, and `zoom` is raised, if it has
   * to be, until the picture covers the whole panel with the face there.
   */
  readonly zoom: number;
  readonly fx: number;
  readonly fy: number;
  readonly tx: number;
  readonly ty: number;
}

/** The face of each character in her splash art, as fractions of the picture. */
const FACE: Record<Slug, { fx: number; fy: number }> = {
  selena: { fx: 0.672, fy: 0.272 },
  obsidia: { fx: 0.479, fy: 0.167 },
  vexana: { fx: 0.595, fy: 0.42 },
  guinevere: { fx: 0.607, fy: 0.359 },
  lesley: { fx: 0.62, fy: 0.37 },
  change: { fx: 0.6, fy: 0.34 },
  angela: { fx: 0.565, fy: 0.245 },
  ruby: { fx: 0.453, fy: 0.353 },
  layla: { fx: 0.616, fy: 0.484 },
  fanny: { fx: 0.567, fy: 0.37 },
};

/** The picture is wider than it is tall by this much. */
const RATIO = 16 / 9;
/** Room for the parallax (a few percent of the width either way) and for the scale. */
const SPARE_X = 1.16;
const SPARE_Y = 1.12;

interface Box {
  x0: number;
  x1: number;
  x2: number;
  x3: number;
  y0: number;
  y1: number;
}

/**
 * Put a face in the middle of a panel. The middle of a slanted panel moves across by the lean as
 * you go down it, so `tx` follows the height at which the face is.
 */
function place(
  slug: Slug,
  box: Box,
  want: { zoom: number; ty: number; dx: number },
): Pick<Slot, "zoom" | "fx" | "fy" | "tx" | "ty"> {
  const { fx, fy } = FACE[slug];
  const pw = box.x2 - box.x0;
  const ph = box.y1 - box.y0;
  const lean = box.x1 - box.x0;
  const { ty } = want;
  // `dx` moves the face off the middle, to the left when it is negative.
  const tx = 0.5 + (lean * (0.5 - ty)) / pw + want.dx;
  // The picture must cover the panel on every side with the face where it is asked to be.
  const need = Math.max(
    (ty / fy) * SPARE_Y,
    ((1 - ty) / (1 - fy)) * SPARE_Y,
    ((pw * tx) / (RATIO * ph * fx)) * SPARE_X,
    ((pw * (1 - tx)) / (RATIO * ph * (1 - fx))) * SPARE_X,
  );
  return { zoom: Math.max(want.zoom, need), fx, fy, tx, ty };
}

const ROW = 117; // the lean across half a panel
const TALL = 240; // and across a whole one

function slot(
  slug: Slug,
  pair: PairId,
  box: Box,
  want: { zoom?: number; ty: number; z?: number; dx?: number },
): Slot {
  return {
    slug,
    pair,
    ...box,
    z: want.z ?? 3,
    ...place(slug, box, { zoom: want.zoom ?? 1, ty: want.ty, dx: want.dx ?? 0 }),
  };
}

const top = (x1: number, x2: number): Box => ({
  x0: x1 - ROW,
  x1,
  x2,
  x3: x2 - ROW,
  y0: 5,
  y1: 188,
});
const bottom = (x1: number, x2: number): Box => ({
  x0: x1 - ROW,
  x1,
  x2,
  x3: x2 - ROW,
  y0: 197,
  y1: 380,
});
const tall = (x1: number, x2: number): Box => ({
  x0: x1 - TALL,
  x1,
  x2,
  x3: x2 - TALL,
  y0: 5,
  y1: 380,
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
  // The pair at the front: Obsidia on the red field and Selena beside her, the same size. The two
  // meet along one slanted line (2 units apart) and the red slash is drawn over it.
  slot("obsidia", "selena-obsidia", tall(293, 545), { ty: 0.19, z: 1, dx: -0.035 }),
  slot("selena", "selena-obsidia", tall(547, 799), { ty: 0.24, z: 1 }),
  // Guinevere and Vexana, one over the other.
  slot("vexana", "guinevere-vexana", top(813, 1049), { ty: 0.38, zoom: 2.4, dx: -0.06 }),
  slot("guinevere", "guinevere-vexana", bottom(693, 918), { ty: 0.45, zoom: 1.7, dx: -0.02 }),
  // Lesley tall, Chang'e under the next pair.
  slot("lesley", "lesley-change", tall(1057, 1226), { ty: 0.34 }),
  slot("change", "lesley-change", bottom(1114, 1242), { ty: 0.45, zoom: 2 }),
  // Angela above, Ruby under.
  slot("angela", "ruby-angela", top(1234, 1467), { ty: 0.25 }),
  slot("ruby", "ruby-angela", bottom(1247, 1474), { ty: 0.45, zoom: 1.6 }),
  // Layla above, narrow, and Fanny tall at the end.
  slot("layla", "fanny-layla", top(1475, 1607), { ty: 0.45, zoom: 2.2 }),
  slot("fanny", "fanny-layla", tall(1617, 1792), { ty: 0.34 }),
];

/** The blue plate at the end of the row. */
export const END = { x0: 1560, x1: 1800, x2: 2368 } as const;
export const BOARD_W = END.x2;

/** The middle of a panel across its box, for the parallax and for finding the one in front. */
export const mid = (s: Slot) => (s.x0 + s.x2) / 2;

/** How far a panel edge moves across for each unit down (the lean). */
export const LEAN = TALL / (380 - 5);

const slotOf = (slug: Slug): Slot => {
  const s = SLOTS.find((x) => x.slug === slug);
  if (!s) throw new Error(`no slot for ${slug}`);
  return s;
};
/** Where the left and the right edge of a panel are at a height. */
const edgeLeft = (s: Slot, y: number) => s.x1 - ((s.x1 - s.x0) / (s.y1 - s.y0)) * (y - s.y0);
const edgeRight = (s: Slot, y: number) => s.x2 - ((s.x1 - s.x0) / (s.y1 - s.y0)) * (y - s.y0);

/**
 * The centre line of the red slash that runs between Obsidia and Selena: a point on it at the top
 * of the panels, and how far across it moves for each unit down.
 */
export const SLASH = {
  x: (edgeRight(slotOf("obsidia"), 5) + edgeLeft(slotOf("selena"), 5)) / 2,
  y: 5,
  lean: LEAN,
} as const;

/** A thin line in the colours of a pair along the gap between its two panels. */
export interface Seam {
  readonly pair: PairId;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** One panel over the other: a level line through the gap, as wide as both of them are there. */
function stacked(pair: PairId, upper: Slug, lower: Slug): Seam {
  const a = slotOf(upper);
  const b = slotOf(lower);
  const y = (a.y1 + b.y0) / 2;
  return {
    pair,
    x1: Math.max(edgeLeft(a, y), edgeLeft(b, y)),
    y1: y,
    x2: Math.min(edgeRight(a, y), edgeRight(b, y)),
    y2: y,
  };
}

/** Side by side: a slanted line through the gap, over the heights `from` to `to`. */
function beside(pair: PairId, left: Slug, right: Slug, from: number, to: number): Seam {
  const a = slotOf(left);
  const b = slotOf(right);
  const at = (y: number) => (edgeRight(a, y) + edgeLeft(b, y)) / 2;
  return { pair, x1: at(from), y1: from, x2: at(to), y2: to };
}

/** The separators between the two panels of the pairs that are not the front pair. */
export const SEAMS: readonly Seam[] = [
  stacked("guinevere-vexana", "vexana", "guinevere"),
  beside("lesley-change", "lesley", "change", 197, 380),
  stacked("ruby-angela", "angela", "ruby"),
  beside("fanny-layla", "layla", "fanny", 5, 188),
];
