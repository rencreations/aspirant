/**
 * The arithmetic of TheMLabel's scene: what was measured on the label's own ident, and the pure
 * functions the stage draws with. Nothing here touches the page.
 *
 * THE REFERENCE (`mlabel.mp4`, the owner's file: 139 frames, 24 a second, 1920 by 1080), read
 * frame by frame. Frames are counted from 1.
 *
 *   1 to 9     black.
 *   10         the first plate (white and violet) is there, lying flat: a wide, low band, its top
 *              edge nearest the camera and wider than the screen, a chrome edge along it.
 *   10 to 16   it swings up about its bottom edge (about 85, 75, 50, 25, 10, 5, 0 degrees: fast,
 *              then easing out) while the camera draws back: the M is 150% of the screen's width
 *              at frame 13, 95% at 14, 58% at 16, 40% at 19, 25% at 21.
 *   17, 22.5,  the next plates start the same way (pink, yellow, red, then the logo's orange at
 *   27, 32     32): FIVE plates, 7, 5.5, 4.5 and 5 frames apart, each over the one before, which
 *              goes on shrinking behind it and shows through the new one's notch and legs.
 *   36         the last M stands, 27.6% of the screen wide; it goes on shrinking (21% at 44).
 *   36 to 44   the letters fly in from the sides, the nearest first (E and L at 36, H and A at
 *              37.5, T and B at 39, E at 40, L at 41), each in about 4.5 frames, turned on the
 *              vertical axis, large and streaked at first.
 *   45 to 48   the logo holds, 68% of the screen wide.
 *   49 to 92   a dark wave runs along the foot of the letters, left to right; the M loses its
 *              footage for the logo's flat orange at 53 to 57; a warm light crosses the M at 61
 *              to 70. The logo draws back to 58% of the width.
 *   93 to 139  it holds.
 *
 * OURS. The same beats, `SLOWER` times slower so they read on a page at 60 frames a second, and
 * counted from the first plate (frame 10 is 0 ms). The black of frames 1 to 9 is the close: the
 * visitor's scroll brings it in.
 */

/** One frame of the reference, in milliseconds. */
const FRAME = 1000 / 24;
/** How much slower than the reference the scene plays. */
const SLOWER = 1.25;
/** Milliseconds of our clock for a count of reference frames. */
const ms = (frames: number) => Math.round(frames * FRAME * SLOWER);

/** When each of the five plates starts (reference frames 10, 17, 22.5, 27 and 32). */
export const PLATE_START = [ms(0), ms(7), ms(12.5), ms(17), ms(22)] as const;
/** A plate swings from flat to standing in six frames. */
export const PLATE_RISE = ms(6);
/** A plate goes on drawing back for this long after it started, behind the next ones. */
export const PLATE_LIFE = ms(15);

/** The angle a plate lies at when it appears, in degrees (top edge toward the viewer). */
export const PLATE_FLAT = -86;
/** The plate's size against the window's: lying flat, standing, and at the end of its life. */
export const PLATE_SCALE = { flat: 2.3, up: 1.18, far: 0.34 } as const;
/** The last plate stands at this size, then lands on the logo's M. */
export const LAST_SCALE = { flat: 2.1, up: 0.92 } as const;

/** The short scene: the last plate and the letters. It is also what a later scroll scrubs. */
export const SHORT_START = PLATE_START[4];
/** When the letters start, in reading order: T H E, then L A B E L (see the frames above). */
export const LETTER_START = [
  ms(29),
  ms(27.5),
  ms(26),
  ms(26),
  ms(27.5),
  ms(29),
  ms(30),
  ms(31),
] as const;
export const LETTER_FLIGHT = ms(4.5);
/** The last plate goes from the window's size to the logo's M while the letters arrive. */
export const LAND = { start: ms(26), end: ms(34.5) } as const;
/** The logo stands: the scroll is given back here. */
export const SHORT_END = ms(35.5);

/** The M's footage gives way to the logo's flat orange (frames 53 to 57). */
export const FLAT = { start: ms(43), end: ms(47) } as const;
/** The dark wave along the foot of the letters (frames 49 to 92). */
export const WAVE = { start: ms(39), end: ms(82) } as const;
/** The light across the logo (frames 61 to 70). */
export const SHEEN = { start: ms(51), end: ms(62) } as const;
/** The whole clock. */
export const SCENE_END = WAVE.end;

/** The logo's width on the screen when it stands (58% in the reference), and on a narrow one. */
export const LOGO_WIDTH = { wide: 0.56, narrow: 0.86 } as const;

/**
 * The scroll of the close, as shares of its stretch: the black comes in up to `sheet`, the short
 * scene is scrubbed up to `short`, and the M turns flat over the rest.
 */
export const CLOSE = { sheet: 0.6, short: 0.93 } as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The scale the black sheet starts from: large enough that the band of the M that is solid from
 * side to side (`solid`, shares of the M's height) covers the whole screen, so nothing of the
 * black shows. `pivot` is the share of the M's height the sheet is scaled about (inside the band).
 */
export function openScale(
  vw: number,
  vh: number,
  mw: number,
  mh: number,
  solid: { top: number; bottom: number },
  pivot: number,
): number {
  const up = (pivot - solid.top) * mh;
  const down = (solid.bottom - pivot) * mh;
  const tall = vh / 2 / Math.max(1, Math.min(up, down));
  const wide = vw / 2 / Math.max(1, mw / 2);
  // A little over, for the half pixel of a rounded scroll and a window that sits off centre.
  return Math.max(tall, wide) * 1.12;
}

/**
 * The sheet's scale for a progress of the close, 0 to 1. Scales multiply, so the way from `open`
 * to 1 is taken in the exponent: the hole shrinks at an even pace to the eye.
 */
export function sheetScale(progress: number, open: number): number {
  return Math.pow(open, 1 - easeInOut(clamp01(progress)));
}

/** The three parts of the close for a progress 0 to 1: the sheet, the short scene, the flat M. */
export function closeParts(p: number): { sheet: number; short: number; flat: number } {
  return {
    sheet: clamp01(p / CLOSE.sheet),
    short: clamp01((p - CLOSE.sheet) / (CLOSE.short - CLOSE.sheet)),
    flat: clamp01((p - CLOSE.short) / (1 - CLOSE.short)),
  };
}

/**
 * The progress of the sheet at which the black has reached the top bar: the M's box no longer
 * rises to the bar's row. From there the bar is on black.
 */
export function barCovered(
  scale: number,
  mh: number,
  vh: number,
  pivot: number,
  barH = 72,
): boolean {
  return scale * pivot * mh < vh / 2 - barH;
}

type Point = readonly [number, number];

/** Solves `a x = b` for a small system, by elimination with pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col += 1) {
    let best = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row]?.[col] ?? 0) > Math.abs(m[best]?.[col] ?? 0)) best = row;
    }
    const top = m[best] ?? [];
    m[best] = m[col] ?? [];
    m[col] = top;
    const lead = top[col] ?? 1;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const line = m[row] ?? [];
      const k = (line[col] ?? 0) / lead;
      for (let c = col; c <= n; c += 1) line[c] = (line[c] ?? 0) - k * (top[c] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

/**
 * The CSS `matrix3d` that lays a box of `w` by `h` (its own top left at 0, 0, with
 * `transform-origin: 0 0`) on four points: top left, top right, bottom right, bottom left. The
 * last plate is laid on the corners of the logo's M with it, so the plate becomes the letter.
 */
export function quadMatrix(
  w: number,
  h: number,
  to: readonly [Point, Point, Point, Point],
): string {
  const from: Point[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const a: number[][] = [];
  const b: number[] = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i] ?? [0, 0];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  const [h0 = 1, h1 = 0, h2 = 0, h3 = 0, h4 = 1, h5 = 0, h6 = 0, h7 = 0] = solve(a, b);
  // Column by column, as CSS reads it. The third row and column leave depth alone.
  const cells = [h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1];
  return `matrix3d(${cells.map((c) => Number(c.toFixed(8))).join(",")})`;
}

/** Where a point of the box lands under `quadMatrix`, for the tests. */
export function quadPoint(matrix: string, x: number, y: number): Point {
  const c = matrix
    .slice(9, -1)
    .split(",")
    .map((v) => Number.parseFloat(v));
  const w = (c[3] ?? 0) * x + (c[7] ?? 0) * y + (c[15] ?? 1);
  return [
    ((c[0] ?? 0) * x + (c[4] ?? 0) * y + (c[12] ?? 0)) / w,
    ((c[1] ?? 0) * x + (c[5] ?? 0) * y + (c[13] ?? 0)) / w,
  ];
}

/** A shuffled copy (Fisher and Yates), with the random source passed in so a test can fix it. */
export function pickOne<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}
