/**
 * The wall and the rows are one plane of small cards over the whole screen (round two, 19 Nov 2026).
 * The wall is that plane seen through the clip of the left frame, the rows are the same plane with
 * the clip open, so the aspirants' close is only the clip opening and the glide never has to be
 * handed over. This file lays the plane out so that it covers the screen and a margin, however the
 * screen is shaped, and says which picture each slot shows. Pure: no three.js, no DOM.
 *
 * The plane has an odd number of rows with one through v = 0 (the middle row: the film rides it).
 * Each row has just enough cards to span the part of the screen that row crosses, plus a card and a
 * pitch, and wraps inside a window of its own length, so the slide never ends and a card never leaves
 * or enters on the screen.
 */
import type { V3 } from "./math";
import type { Vp } from "./types";
import {
  WALL_DISTANCE,
  planGeom,
  slotPlane,
  wallFrame,
  type Frame,
  type RowPlan,
  type WallGeom,
} from "./wall";

/** Card height over the square root of the wall frame's area: wide screens, tall screens. */
const GRID_SIZE = { wide: 0.15, tall: 0.18 } as const;
/** How far past the screen the plane is laid out (CSS px), for the push of the pointer and a hovered card's lift. */
const COVER_MARGIN = 40;

export interface WallGrid {
  readonly geom: WallGeom;
  /** The frame the wall shows in (the clip while the words are up): the left part or the top part. */
  readonly wall: Frame;
  /** 1 where a slot's card is inside the wall's frame at slide 0 (a story card may land there). */
  readonly inFrame: Uint8Array;
}

/** The plane point (u, v) that appears at the frame point (X, Y) (y up, the origin at the middle). */
export function screenToPlane(
  right: V3,
  up: V3,
  distance: number,
  X: number,
  Y: number,
  out: [number, number],
): [number, number] {
  const d = distance;
  const a11 = d * right[0] + X * right[2];
  const a12 = d * up[0] + X * up[2];
  const a21 = d * right[1] + Y * right[2];
  const a22 = d * up[1] + Y * up[2];
  const b1 = X * d;
  const b2 = Y * d;
  const det = a11 * a22 - a12 * a21;
  out[0] = (b1 * a22 - a12 * b2) / det;
  out[1] = (a11 * b2 - b1 * a21) / det;
  return out;
}

/** The plane point (u, v) on the screen: the frame point it is drawn at through the wall's lens. */
export function planeToScreen(
  g: WallGeom,
  u: number,
  v: number,
  out: [number, number],
): [number, number] {
  const x = g.frame.cx + u * g.right[0] + v * g.up[0];
  const y = g.frame.cy + u * g.right[1] + v * g.up[1];
  const z = u * g.right[2] + v * g.up[2];
  const s = WALL_DISTANCE / (WALL_DISTANCE - z);
  out[0] = x * s;
  out[1] = y * s;
  return out;
}

/** The u range of the quad `quad` (four (u, v) corners in order) on the line at `v`, or null when it misses. */
function sliceAt(quad: ReadonlyArray<[number, number]>, v: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    if ((a[1] - v) * (b[1] - v) > 0) continue;
    if (Math.abs(b[1] - a[1]) < 1e-9) {
      lo = Math.min(lo, a[0], b[0]);
      hi = Math.max(hi, a[0], b[0]);
      continue;
    }
    const u = a[0] + ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]);
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
  }
  return lo <= hi ? [lo, hi] : null;
}

/**
 * The rows and counts that cover the screen (grown by `margin` px) for a plane whose cards have the
 * given size. The axes come from a throw-away geometry of the same angles.
 */
function coverPlan(
  vp: Vp,
  right: V3,
  up: V3,
  cardW: number,
  pitch: number,
  rise: number,
  margin = COVER_MARGIN,
): RowPlan {
  const hw = vp.w / 2 + margin;
  const hh = vp.h / 2 + margin;
  const quad: Array<[number, number]> = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  const corners: ReadonlyArray<[number, number]> = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  corners.forEach(([x, y], i) => {
    screenToPlane(right, up, WALL_DISTANCE, x, y, quad[i]!);
  });
  const vmin = Math.min(...quad.map((p) => p[1]));
  const vmax = Math.max(...quad.map((p) => p[1]));
  const kMax = Math.ceil(vmax / rise) + 1;
  const kMin = Math.floor(vmin / rise) - 1;
  const rowV: number[] = [];
  const counts: number[] = [];
  const centers: number[] = [];
  for (let k = kMax; k >= kMin; k--) {
    const v = k * rise;
    // The widest the screen is anywhere within this row's band, so a slanted edge never leaves a corner bare.
    let lo = Infinity;
    let hi = -Infinity;
    for (const t of [-0.5, 0, 0.5]) {
      const s = sliceAt(quad, Math.min(vmax, Math.max(vmin, v + t * rise)));
      if (!s) continue;
      lo = Math.min(lo, s[0]);
      hi = Math.max(hi, s[1]);
    }
    if (lo > hi) continue;
    const slice: [number, number] = [lo, hi];
    const span = slice[1] - slice[0] + cardW * 1.1;
    rowV.push(v);
    counts.push(Math.max(4, Math.ceil(span / pitch)));
    centers.push((slice[0] + slice[1]) / 2);
  }
  return { rowV, counts, centers };
}

let cached: { w: number; h: number; grid: WallGrid } | null = null;

/** The plane for a viewport, made once per size. */
export function wallGrid(vp: Vp): WallGrid {
  if (cached?.w === vp.w && cached.h === vp.h) return cached.grid;
  const tall = vp.h > vp.w;
  const screen = wallFrame(vp, "rows");
  const wall = wallFrame(vp, "wall");
  const size =
    (tall ? GRID_SIZE.tall : GRID_SIZE.wide) *
    (Math.sqrt(wall.w * wall.h) / Math.sqrt(screen.w * screen.h));
  // A one-row geometry gives the angles, the card size and the pitch.
  const probe = planGeom(screen, { rowV: [0], counts: [1], centers: [0] }, { size });
  const plan = coverPlan(vp, probe.right, probe.up, probe.cardW, probe.pitch, probe.rise);
  const geom = planGeom(screen, plan, { size });
  const inFrame = new Uint8Array(geom.n);
  const uv: [number, number] = [0, 0];
  const xy: [number, number] = [0, 0];
  for (let s = 0; s < geom.n; s++) {
    slotPlane(geom, s, 0, uv);
    planeToScreen(geom, uv[0], uv[1], xy);
    const inside =
      Math.abs(xy[0] - wall.cx) <= wall.w / 2 - geom.cardW * 0.15 &&
      Math.abs(xy[1] - wall.cy) <= wall.h / 2 - geom.cardH * 0.15;
    inFrame[s] = inside ? 1 : 0;
  }
  const grid = { geom, wall, inFrame };
  cached = { w: vp.w, h: vp.h, grid };
  return grid;
}

/**
 * Which picture of a pool of `pool` pictures a slot shows. The even rows use the even pictures and
 * the odd rows the odd ones, so two rows that slide past each other never show the same picture side
 * by side, and a row repeats a picture only after the whole of its half of the pool. The rows of one
 * parity start a whole row further on in the cycle, so a screen shows the whole pool.
 */
export function slotPicture(g: WallGeom, slot: number, pool: number): number {
  if (pool <= 1) return 0;
  const r = g.slotRow[slot]!;
  const c = g.slotCol[slot]!;
  const half = Math.ceil(pool / 2);
  const parity = r % 2;
  const size = parity === 0 ? half : Math.floor(pool / 2);
  if (size <= 0) return 0;
  const shift = Math.floor(r / 2) * (g.rowCount[r]! + 1);
  const at = (((c + shift) % size) + size) % size;
  return at * 2 + parity;
}
