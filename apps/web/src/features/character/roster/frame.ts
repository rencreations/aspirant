import type { Slot } from "./layout";

/** A point in units of the board, measured from the top left of the box of a panel. */
export type Pt = readonly [number, number];

/** How the frame of a panel is built, in board units (the stylesheet scales them by `--u`). */
const CUT = 10.5; // the two sharp corners are cut off: this far down the long side
const RIM = 4.2; // the silver bevel
const LINE = 1; // the dark line inside the bevel

export interface Frame {
  /** The box of the panel. */
  readonly w: number;
  readonly h: number;
  /** The lean: across for each unit down. */
  readonly k: number;
  /** The silver bevel, with its two sharp corners cut. */
  readonly outer: readonly Pt[];
  /** The dark line inside the bevel. */
  readonly line: readonly Pt[];
  /** The picture. */
  readonly face: readonly Pt[];
}

/**
 * Move every side of a convex shape inwards by `d`. The points run clockwise on the screen (y is
 * down), so the inside of a side is on the right of its direction.
 */
export function inset(pts: readonly Pt[], d: number): Pt[] {
  const n = pts.length;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    // The side, moved towards the inside.
    return { x: p[0] - (dy / len) * d, y: p[1] + (dx / len) * d, dx, dy };
  });
  return lines.map((b, i) => {
    const a = lines[(i + n - 1) % n]!;
    const cross = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(cross) < 1e-9) return [b.x, b.y] as const;
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / cross;
    return [a.x + a.dx * t, a.y + a.dy * t] as const;
  });
}

/** The outline of a panel: a slanted box with its two sharp corners cut. */
export function frameOf(s: Slot): Frame {
  const w = s.x2 - s.x0;
  const h = s.y1 - s.y0;
  const a = s.x1 - s.x0;
  const k = a / h;
  const cy = CUT;
  const cx = CUT * 1.2;
  const outer: Pt[] = [
    [a, 0],
    [w - cx, 0],
    [w - k * cy, cy],
    [w - a, h],
    [cx, h],
    [k * cy, h - cy],
  ];
  return { w, h, k, outer, line: inset(outer, RIM), face: inset(outer, RIM + LINE) };
}

export interface Trim {
  /** The long bright line along the top, from the top left corner. */
  readonly bar: { x: number; y: number; w: number; h: number };
  /** The brackets at the two blunt corners (top left and bottom right), as SVG paths. */
  readonly tl: string;
  readonly br: string;
  /** The two screws in the bevel, at the same corners. */
  readonly screws: readonly Pt[];
  /** Small marks in the bevel: notches, and strips of ticks. */
  readonly notches: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
  readonly ticks: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
}

const n1 = (n: number) => n.toFixed(2);

/** The small mechanical details of a frame: brackets, a bright bar, screws, notches and ticks. */
export function trimOf(fr: Frame): Trim {
  const { w, h, k, outer, line, face } = fr;
  const tl = face[0]!;
  const br = face[3]!;
  const arm = Math.min(30, w * 0.14);
  const armD = Math.min(26, h * 0.13);
  const ax = tl[0] + 1.5 - k * 1.2;
  const ay = tl[1] + 1.2;
  const bx = br[0] + k * 1.2 - 1.5;
  const by = br[1] - 1.2;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const cx = CUT * 1.2;
  const topX = Math.min(w * 0.6, w - cx - 44);
  return {
    bar: {
      x: ax,
      y: ay - 0.3,
      w: Math.max(10, Math.min(w * 0.5, (face[1]?.[0] ?? w) - ax - 3)),
      h: 0.6,
    },
    tl: `M${n1(ax + arm)} ${n1(ay)}H${n1(ax)}L${n1(ax - k * armD)} ${n1(ay + armD)}`,
    br: `M${n1(bx - arm)} ${n1(by)}H${n1(bx)}L${n1(bx + k * armD)} ${n1(by - armD)}`,
    screws: [mid(outer[0]!, line[0]!), mid(outer[3]!, line[3]!)],
    notches: [
      { x: w * 0.46, y: 1.5, w: 5, h: 1.2 },
      { x: w * 0.46 + 7, y: 1.5, w: 1.8, h: 1.2 },
      { x: w * 0.4, y: h - 2.7, w: 5, h: 1.2 },
    ],
    ticks: [
      { x: topX, y: 1.35, w: 40, h: 1.5 },
      { x: cx + 10, y: h - 2.85, w: 44, h: 1.5 },
    ],
  };
}

/** A list of points as the `points` of an SVG shape. */
export const pointsOf = (pts: readonly Pt[]) =>
  pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/** A list of points as a CSS `polygon()` that scales with the board unit. */
export const polygonOf = (pts: readonly Pt[]) =>
  `polygon(${pts
    .map(([x, y]) => `calc(var(--u) * ${x.toFixed(2)}) calc(var(--u) * ${y.toFixed(2)})`)
    .join(",")})`;
