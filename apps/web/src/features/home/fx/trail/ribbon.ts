import { clamp01 } from "../comic-marks/math";
import type { TrailHistory } from "./ring";

/** Floats per ribbon vertex: x, y, across (-1 to 1), then r, g, b, a. */
export const VERTEX_FLOATS = 7;

/** The width of a ribbon at `u` (0 at the head, 1 at the end of the tail): it tapers to nothing. */
export function ribbonWidth(u: number, width: number, taper: number): number {
  const k = 1 - clamp01(u);
  return width * (taper === 1 ? k : Math.pow(k, taper));
}

/** The opacity of a ribbon at `u`. */
export function ribbonAlpha(u: number, fade: number): number {
  const k = 1 - clamp01(u);
  return fade === 1 ? k : Math.pow(k, fade);
}

/**
 * A colour along a gradient of evenly spaced stops (`stops` is a flat list of r, g, b). `u` of 0 is
 * the first stop and 1 the last. Writes three floats into `out` at `at`.
 */
export function gradientAt(
  stops: ArrayLike<number>,
  u: number,
  out: Float32Array | number[],
  at: number,
): void {
  const n = Math.floor(stops.length / 3);
  if (n <= 1) {
    out[at] = stops[0] ?? 1;
    out[at + 1] = stops[1] ?? 1;
    out[at + 2] = stops[2] ?? 1;
    return;
  }
  const f = clamp01(u) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const k = f - i;
  for (let c = 0; c < 3; c++) {
    const a = stops[i * 3 + c]!;
    const b = stops[(i + 1) * 3 + c]!;
    out[at + c] = a + (b - a) * k;
  }
}

export interface RibbonStyle {
  /** The width at the head, in pixels. */
  width: number;
  /** How the width falls off: 1 is a straight taper to a point, above 1 is thicker near the head. */
  taper: number;
  /** The exponent of the opacity falloff along the tail. */
  fade: number;
  /** The most opaque the ribbon gets (0 to 1). */
  alpha: number;
  /** Seconds a point lives: its age over this is `u`. */
  life: number;
  /** The gradient, flat r, g, b stops from head to tail. */
  stops: ArrayLike<number>;
}

/** The most points a polyline of one ribbon can hold: the cap, the head and the remembered points. */
const SCRATCH = 160;
const PX = new Float32Array(SCRATCH);
const PY = new Float32Array(SCRATCH);
const PU = new Float32Array(SCRATCH);

/** The two rows that round the head: how far past it (in half widths) and how wide (in half widths). */
const CAP: ReadonlyArray<readonly [number, number]> = [
  [0.86, 0.5],
  [0.5, 0.866],
];
/** Pairs a ribbon uses for the round cap at its head. */
export const CAP_PAIRS = CAP.length;

/**
 * Write the triangle strip of one trail: a pair of vertices (one each side) for every point of the
 * polyline, which is the round cap, the live head and then every remembered point from the newest
 * to the oldest. The tangent is taken from the neighbours (a zero length step keeps the last
 * tangent, so nothing is ever NaN). `pairs` is the room the slot has. The unused rest is filled with
 * copies of the last pair at zero opacity, so the strip's extra triangles are degenerate and
 * nothing needs a draw range per trail.
 *
 * `head` is the live anchor, or null when the trail is no longer followed: the ribbon then starts
 * at the newest remembered point, already part way along its fade, with no cap, and dissolves from
 * the head side. Returns the number of pairs that hold a real ribbon (0 when there are fewer than
 * two points).
 */
export function writeRibbon(
  out: Float32Array,
  base: number,
  pairs: number,
  head: { x: number; y: number } | null,
  history: TrailHistory,
  now: number,
  style: RibbonStyle,
): number {
  let n = 0;
  const room = Math.min(pairs, SCRATCH);
  if (head) {
    // The tangent at the head, from the newest remembered point.
    let tx = 1;
    let ty = 0;
    if (history.length > 0) {
      const k = history.newest(0);
      const dx = head.x - history.x[k]!;
      const dy = head.y - history.y[k]!;
      const len = Math.hypot(dx, dy);
      if (len > 1e-4) {
        tx = dx / len;
        ty = dy / len;
      }
    }
    const r = style.width * 0.5;
    for (let c = 0; c < CAP.length && n < room; c++) {
      const [ahead, wide] = CAP[c]!;
      PX[n] = head.x + tx * r * ahead;
      PY[n] = head.y + ty * r * ahead;
      PU[n] = -wide;
      n++;
    }
    PX[n] = head.x;
    PY[n] = head.y;
    PU[n] = 0;
    n++;
  }
  for (let i = 0; i < history.length && n < room; i++) {
    const k = history.newest(i);
    PX[n] = history.x[k]!;
    PY[n] = history.y[k]!;
    PU[n] = clamp01((now - history.t[k]!) / style.life);
    n++;
  }
  if (n < 2) {
    out.fill(0, base, base + pairs * 2 * VERTEX_FLOATS);
    return 0;
  }
  let tx = 1;
  let ty = 0;
  let last = base;
  for (let k = 0; k < n; k++) {
    const px = PX[k]!;
    const py = PY[k]!;
    const dx = PX[Math.min(n - 1, k + 1)]! - PX[Math.max(0, k - 1)]!;
    const dy = PY[Math.min(n - 1, k + 1)]! - PY[Math.max(0, k - 1)]!;
    const len = Math.hypot(dx, dy);
    if (len > 1e-4) {
      tx = dx / len;
      ty = dy / len;
    }
    // A negative PU marks a cap row: it keeps the head's colour and opacity at a narrower width.
    const cap = PU[k]! < 0;
    const u = cap ? 0 : PU[k]!;
    const half = (cap ? -PU[k]! * style.width : ribbonWidth(u, style.width, style.taper)) * 0.5;
    const a = ribbonAlpha(u, style.fade) * style.alpha;
    const nx = -ty * half;
    const ny = tx * half;
    const o = base + k * 2 * VERTEX_FLOATS;
    out[o] = px + nx;
    out[o + 1] = py + ny;
    out[o + 2] = -1;
    gradientAt(style.stops, u, out, o + 3);
    out[o + 6] = a;
    const p = o + VERTEX_FLOATS;
    out[p] = px - nx;
    out[p + 1] = py - ny;
    out[p + 2] = 1;
    out[p + 3] = out[o + 3]!;
    out[p + 4] = out[o + 4]!;
    out[p + 5] = out[o + 5]!;
    out[p + 6] = a;
    last = p;
  }
  // Degenerate rest: the last pair again, invisible.
  for (let k = n; k < pairs; k++) {
    const o = base + k * 2 * VERTEX_FLOATS;
    for (let side = 0; side < 2; side++) {
      const from = side === 0 ? last - VERTEX_FLOATS : last;
      const to = o + side * VERTEX_FLOATS;
      for (let c = 0; c < VERTEX_FLOATS; c++) out[to + c] = out[from + c]!;
      out[to + 6] = 0;
    }
  }
  return n;
}
