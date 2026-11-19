/**
 * The wall and the rows: wide cards in rows on one tilted plane, after premotio's wall (twist 35,
 * tilt 53, roll -6 degrees: `q = Rz(roll) Rx(-tilt) Rz(twist)`, first the twist about the plane's
 * own normal, then the plane leaning back, then the roll). The rows slide by themselves, in
 * opposite directions, and wrap, so the slide never ends. The wall fills a frame (the left 65
 * percent of the screen on a wide display, the top part on a tall one); the rows are the same
 * plane over the whole screen. A card's place is a pure function of its slot and the slide.
 */
import { DEG, qFromEuler, qMul, qRotate, type Q, type V3 } from "./math";
import type { CardPose, Vp } from "./types";

/** A box of the stage frame (centre, size), in frame pixels, y up. */
export interface Frame {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface WallOptions {
  /** Cards in a row of the wall (the plane has this many rows). The owner's wall has three. */
  rows: number;
  /** Card height over the square root of the frame's area. */
  size: number;
  /** Width over height of a card. */
  aspect: number;
  /** Space between cards, as a share of the card's own size. */
  gap: number;
  twist: number;
  tilt: number;
  roll: number;
}

const WALL_DEFAULTS: WallOptions = {
  rows: 3,
  size: 0.36,
  aspect: 16 / 9,
  gap: 0.12,
  twist: 35,
  tilt: 53,
  roll: -6,
};

/** The telephoto distance of the camera while the wall is on (about 25 degrees of field). */
export const WALL_DISTANCE = 2000;

export interface WallGeom {
  readonly n: number;
  readonly rows: number;
  /** Cards in each row. */
  readonly rowCount: readonly number[];
  readonly slotRow: Int32Array;
  readonly slotCol: Int32Array;
  readonly cardH: number;
  readonly cardW: number;
  readonly pitch: number;
  readonly rise: number;
  readonly frame: Frame;
  /** The plane's right and up axes in the frame, and its rotation. */
  readonly right: V3;
  readonly up: V3;
  readonly q: Q;
  readonly aspect: number;
  /** v (across the rows) of each row, the top row first. */
  readonly rowV: readonly number[];
  /** The middle of each row's wrap window along u (0 for the plain wall). */
  readonly rowCenter: readonly number[];
  /** The row that runs through v = 0, or -1 when there is none. */
  readonly midRow: number;
}

/** The rows of a wall that covers a region: which rows, how many cards each, and where each wraps. */
export interface RowPlan {
  /** v of each row, the top row first (a multiple of the rise). */
  readonly rowV: readonly number[];
  readonly counts: readonly number[];
  readonly centers: readonly number[];
}

/**
 * The share of a wide screen's width the wall's frame fills (round five, 20 Nov 2026: the owner's
 * words take about 35 percent, so the wall takes the other 65; it was one half).
 */
export const WALL_SHARE = 0.65;

/** The frame the wall (kind "wall") or the rows (kind "rows") fills, for a viewport. */
export function wallFrame(vp: Vp, kind: "wall" | "rows", share: number = WALL_SHARE): Frame {
  if (kind === "rows") return { cx: 0, cy: 0, w: vp.w, h: vp.h };
  if (vp.h > vp.w) {
    const h = vp.h * 0.56;
    return { cx: 0, cy: vp.h / 2 - h / 2, w: vp.w, h };
  }
  const w = vp.w * share;
  return { cx: -vp.w / 2 + w / 2, cy: 0, w, h: vp.h };
}

/** Split `n` cards into `rows` rows as evenly as possible, the longer rows first. */
function rowCounts(n: number, rows: number): number[] {
  const base = Math.floor(n / rows);
  const extra = n - base * rows;
  return Array.from({ length: rows }, (_, r) => base + (r < extra ? 1 : 0));
}

export function wallGeom(n: number, frame: Frame, options: Partial<WallOptions> = {}): WallGeom {
  const o = { ...WALL_DEFAULTS, ...options };
  const counts = rowCounts(n, o.rows);
  const rise = o.size * Math.sqrt(frame.w * frame.h) * (1 + o.gap);
  const rowV = Array.from({ length: o.rows }, (_, r) => ((o.rows - 1) / 2 - r) * rise);
  const centers = new Array<number>(o.rows).fill(0);
  return buildGeom(frame, o, { rowV, counts, centers });
}

/** A wall laid out by a plan (the rows and the cards in each), over a frame. */
export function planGeom(
  frame: Frame,
  plan: RowPlan,
  options: Partial<WallOptions> = {},
): WallGeom {
  const o = { ...WALL_DEFAULTS, ...options, rows: plan.rowV.length };
  return buildGeom(frame, o, plan);
}

function buildGeom(frame: Frame, o: WallOptions, plan: RowPlan): WallGeom {
  const counts = plan.counts;
  const n = counts.reduce((a, b) => a + b, 0);
  const slotRow = new Int32Array(n);
  const slotCol = new Int32Array(n);
  let s = 0;
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < counts[r]!; c++) {
      slotRow[s] = r;
      slotCol[s] = c;
      s += 1;
    }
  }
  const cardH = o.size * Math.sqrt(frame.w * frame.h);
  const cardW = cardH * o.aspect;
  const q: Q = [0, 0, 0, 1];
  const qa: Q = [0, 0, 0, 1];
  qFromEuler(0, 0, o.twist * DEG, q);
  qFromEuler(-o.tilt * DEG, 0, 0, qa);
  qMul(qa, q, q);
  qFromEuler(0, 0, o.roll * DEG, qa);
  qMul(qa, q, q);
  const right: V3 = [0, 0, 0];
  const up: V3 = [0, 0, 0];
  qRotate(q, 1, 0, 0, right);
  qRotate(q, 0, 1, 0, up);
  return {
    n,
    rows: o.rows,
    rowCount: counts,
    slotRow,
    slotCol,
    cardH,
    cardW,
    pitch: cardW * (1 + o.gap),
    rise: cardH * (1 + o.gap),
    frame,
    right,
    up,
    q,
    aspect: o.aspect,
    rowV: plan.rowV,
    rowCenter: plan.centers,
    midRow: plan.rowV.findIndex((v) => Math.abs(v) < 1e-6),
  };
}

/** The slide of a row: even rows go one way, odd rows the other. */
export function rowWay(row: number): number {
  return row % 2 === 0 ? 1 : -1;
}

/** `x` wrapped into [-len / 2, len / 2). */
export function wrapAround(x: number, len: number): number {
  return ((((x + len / 2) % len) + len) % len) - len / 2;
}

/**
 * The place of a slot on the plane (u along the row, v across the rows), after the slide. A row wraps
 * inside a window of its own length centred on `rowCenter`, so the slide never ends and never shows a seam.
 */
export function slotPlane(g: WallGeom, slot: number, slide: number, out: [number, number]): void {
  const r = g.slotRow[slot]!;
  const c = g.slotCol[slot]!;
  const count = g.rowCount[r]!;
  const len = count * g.pitch;
  out[0] = g.rowCenter[r]! + wrapAround((c - (count - 1) / 2) * g.pitch + rowWay(r) * slide, len);
  out[1] = g.rowV[r]!;
}

const place: [number, number] = [0, 0];

/** Write the pose of a slot on the wall at a slide. Wide, flat on the plane, no live motion. */
export function wallSlotPose(g: WallGeom, slot: number, slide: number, out: CardPose): CardPose {
  slotPlane(g, slot, slide, place);
  const u = place[0];
  const v = place[1];
  out.x = g.frame.cx + u * g.right[0] + v * g.up[0];
  out.y = g.frame.cy + u * g.right[1] + v * g.up[1];
  out.z = u * g.right[2] + v * g.up[2];
  out.q[0] = g.q[0];
  out.q[1] = g.q[1];
  out.q[2] = g.q[2];
  out.q[3] = g.q[3];
  out.h = g.cardH;
  out.aspect = g.aspect;
  out.shape = 1;
  out.opacity = 1;
  out.live = 0;
  return out;
}
