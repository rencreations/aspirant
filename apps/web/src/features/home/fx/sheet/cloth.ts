/**
 * The shape of the white sheet (round seven, the out animation). The sheet is drawn as a grid whose
 * columns run across the screen and whose rows run from its bottom edge up to above the screen. All
 * numbers here are in the picture's own units (normalised device coordinates of the camera, y up),
 * so the actor can put the grid on a plane at any distance and it lands in the same place on the
 * screen. Pure and deterministic: the same inputs give the same sheet, so the scroll plays it both ways.
 *
 *  - the bottom edge is held by the fingers: it passes through the grip, tilts with the hand, and
 *    rises away from the grip (the cloth trails behind a pulled point), more while it is pulled;
 *  - folds run up from the edge like the creases of cloth held at one point: a small push in depth
 *    and a shade value for the soft band, both dying out up the sheet and gone when the sheet has
 *    covered the screen (`calm`), so a full screen of it is exactly the flat paper;
 *  - a ribbon of ink runs along the edge (the thin outline of the toon look).
 */

/** Columns across the sheet and rows up it (the ribbon is two more rows at the foot). */
export const COLS = 40;
export const ROWS = 14;
/** The vertices: the ribbon's two rows, then the body's `ROWS + 1` rows. */
export const VERTS = (COLS + 1) * (ROWS + 3);

export interface Shape {
  /** The grip, in the picture: where the fingers hold the edge. */
  gripX: number;
  gripY: number;
  /** The tilt of the edge, rise over run. */
  slope: number;
  /** How far the edge away from the grip trails above it (picture units). */
  lag: number;
  /** The folds, 0 (flat) to 1. */
  fold: number;
  /** A phase that moves the folds (a function of the pull, so a scroll back undoes it). */
  phase: number;
  /** The sheet's top and half width in the picture (it covers the screen when wide and tall enough). */
  top: number;
  halfWidth: number;
  /** The ink ribbon's width in the picture's units. */
  ink: number;
}

export function newShape(): Shape {
  return {
    gripX: 0,
    gripY: 1.4,
    slope: 0,
    lag: 0,
    fold: 0,
    phase: 0,
    top: 3,
    halfWidth: 1.6,
    ink: 0.007,
  };
}

/** What the grid writes: three numbers a vertex (x, y, depth push as a share of the depth) and shade, ink. */
export interface Grid {
  pos: Float32Array;
  shade: Float32Array;
  ink: Float32Array;
}

export function newGrid(): Grid {
  return {
    pos: new Float32Array(VERTS * 3),
    shade: new Float32Array(VERTS),
    ink: new Float32Array(VERTS),
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The edge's height at a column's x. */
export function edgeAt(s: Shape, x: number): number {
  const d = (x - s.gripX) / 0.55;
  return s.gripY + s.slope * (x - s.gripX) + s.lag * (1 - Math.exp(-d * d));
}

/** Fill the grid for a shape. */
export function fillGrid(s: Shape, g: Grid): Grid {
  const { pos, shade, ink } = g;
  let v = 0;
  for (let c = 0; c <= COLS; c += 1) {
    // Columns bunch a little toward the grip, where the folds are.
    const u = c / COLS;
    const x = -s.halfWidth + 2 * s.halfWidth * u;
    const yb = edgeAt(s, x);
    // Row 0 is the foot of the ribbon, row 1 its top, rows 2 to ROWS + 2 the body.
    for (let r = 0; r < ROWS + 3; r += 1) {
      const i = c + r * (COLS + 1);
      let y: number;
      let isInk = 0;
      if (r === 0) {
        y = yb;
        isInk = 1;
      } else if (r === 1) {
        y = yb + s.ink;
        isInk = 1;
      } else {
        const k = (r - 2) / ROWS;
        y = yb + s.ink + (s.top - yb - s.ink) * k;
      }
      // Folds: creases fanning from the grip, strongest at the edge and gone high up.
      const up = Math.max(0, y - yb);
      const reach = Math.exp(-up / 0.7);
      const spread = (x - s.gripX) * (1 + 0.5 * up);
      const wave =
        Math.sin(spread * 7.5 + s.phase) + 0.45 * Math.sin(spread * 15.5 - s.phase * 1.3);
      const amount = s.fold * reach;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = amount * 0.012 * wave;
      shade[i] = isInk ? 0 : clamp01(0.5 + 0.42 * amount * wave);
      ink[i] = isInk;
      v += 1;
    }
  }
  return g;
}

/** The triangles of the grid: two for each cell. Built once. */
export function gridIndex(): Uint16Array {
  const rows = ROWS + 2;
  const idx = new Uint16Array(COLS * rows * 6);
  let n = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const a = c + r * (COLS + 1);
      const b = a + 1;
      const d = a + (COLS + 1);
      const e = d + 1;
      idx[n++] = a;
      idx[n++] = b;
      idx[n++] = d;
      idx[n++] = b;
      idx[n++] = e;
      idx[n++] = d;
    }
  }
  return idx;
}
