/**
 * The path Silverbolt flies across the stage (the tib path: from the lower right, through the
 * middle, to the upper left). Pure: no DOM, no three. The keys are fractions of the viewport
 * (x of the width, y of the height, y up, the origin at the middle) and a size, interpolated by a
 * Catmull-Rom spline that is sampled once into an arc length table, so `P` (0 to 1) moves at an even
 * pace along the curve. A `P` outside 0 and 1 goes on along the end tangents (the dragon enters
 * from beyond the corner and leaves beyond the other).
 */

/** x, y (fractions of the viewport) and the size factor of the dragon at that key. */
type Key = readonly [x: number, y: number, size: number];

const KEYS: readonly Key[] = [
  [0.78, -0.78, 1.0],
  [0.52, -0.5, 1.1],
  [0.26, -0.26, 1.28],
  [0.05, -0.17, 1.5],
  [-0.12, 0.05, 1.45],
  [-0.3, 0.24, 1.3],
  [-0.54, 0.5, 1.2],
  [-0.85, 0.85, 1.1],
];

/** The key the dragon hovers at (the middle of the flight) and the key the doll falls at (75 percent). */
export const KEY_CENTRE = 3;
export const KEY_FALL = 5;

const PER_SEGMENT = 28;
/** One unit of x counts as this many of y when arc lengths are measured (the screen is wider than tall). */
const ASPECT = 1.6;

export interface PathPoint {
  /** Fractions of the viewport width and height, y up. */
  x: number;
  y: number;
  /** The size factor (1 at the start, 1.3 at the middle). */
  size: number;
  /** The direction of travel as a unit vector in a space where x is stretched by the aspect. */
  tx: number;
  ty: number;
}

/** Sampled curve: positions, sizes and the cumulative length (0 to 1). */
const sx: number[] = [];
const sy: number[] = [];
const ss: number[] = [];
const cum: number[] = [];
const keyAt: number[] = [];

function keyOf(i: number): Key {
  return KEYS[Math.min(KEYS.length - 1, Math.max(0, i))]!;
}

function cr(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

function build(): void {
  let length = 0;
  for (let seg = 0; seg < KEYS.length - 1; seg += 1) {
    const a = keyOf(seg - 1);
    const b = keyOf(seg);
    const c = keyOf(seg + 1);
    const d = keyOf(seg + 2);
    const last = seg === KEYS.length - 2;
    for (let i = 0; i < PER_SEGMENT + (last ? 1 : 0); i += 1) {
      const u = i / PER_SEGMENT;
      const x = cr(a[0], b[0], c[0], d[0], u);
      const y = cr(a[1], b[1], c[1], d[1], u);
      const s = cr(a[2], b[2], c[2], d[2], u);
      if (sx.length > 0) {
        length += Math.hypot((x - sx[sx.length - 1]!) * ASPECT, y - sy[sy.length - 1]!);
      }
      if (i === 0) keyAt[seg] = length;
      sx.push(x);
      sy.push(y);
      ss.push(s);
      cum.push(length);
    }
  }
  keyAt[KEYS.length - 1] = length;
  for (let i = 0; i < cum.length; i += 1) cum[i] = cum[i]! / length;
  for (let i = 0; i < keyAt.length; i += 1) keyAt[i] = keyAt[i]! / length;
}
build();

/** The arc length fraction of key `i`: where on the path (0 to 1) that key is. */
export function keyFraction(i: number): number {
  return keyAt[Math.min(keyAt.length - 1, Math.max(0, i))]!;
}

/** The path's total length in the stretched space (a scale for going beyond the ends). */
const TOTAL = (() => {
  let length = 0;
  for (let i = 1; i < sx.length; i += 1) {
    length += Math.hypot((sx[i]! - sx[i - 1]!) * ASPECT, sy[i]! - sy[i - 1]!);
  }
  return length;
})();

function find(p: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= p) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The place on the path at `p`. Writes into `out` and returns it. */
export function pathAt(p: number, out: PathPoint): PathPoint {
  const n = cum.length;
  if (p <= 0 || p >= 1) {
    // Beyond an end: straight on along the end tangent (backward at the start), at the end's size.
    const atStart = p <= 0;
    const from = atStart ? 0 : n - 2;
    const to = atStart ? 1 : n - 1;
    const at = atStart ? 0 : n - 1;
    let dx = (sx[to]! - sx[from]!) * ASPECT;
    let dy = sy[to]! - sy[from]!;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const over = (atStart ? p : p - 1) * TOTAL;
    out.x = sx[at]! + (dx / ASPECT) * over;
    out.y = sy[at]! + dy * over;
    out.size = ss[at]!;
    out.tx = dx;
    out.ty = dy;
    return out;
  }
  const i = find(p);
  const span = cum[i + 1]! - cum[i]!;
  const u = span > 0 ? (p - cum[i]!) / span : 0;
  out.x = sx[i]! + (sx[i + 1]! - sx[i]!) * u;
  out.y = sy[i]! + (sy[i + 1]! - sy[i]!) * u;
  out.size = ss[i]! + (ss[i + 1]! - ss[i]!) * u;
  const dx = (sx[i + 1]! - sx[i]!) * ASPECT;
  const dy = sy[i + 1]! - sy[i]!;
  const len = Math.hypot(dx, dy) || 1;
  out.tx = dx / len;
  out.ty = dy / len;
  return out;
}

export function newPathPoint(): PathPoint {
  return { x: 0, y: 0, size: 1, tx: 0, ty: 0 };
}
