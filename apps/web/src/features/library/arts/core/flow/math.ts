/**
 * The maths of the wall: rows of pictures that stand still. Pure functions, so they can be tested
 * without a browser.
 *
 * Every row is as wide as the wall. A row takes pictures, in order, until one more would not fit at
 * the target height, then settles on the height that makes its pictures fill the width exactly (the
 * pictures keep their own shapes, so none is cropped by more than a pixel or two). A row is never
 * far from the target height: the last picture goes in or out of the row, whichever leaves the row
 * closer to it. The last row of a group, which runs out of pictures, keeps the target height and
 * stands at the left when filling the width would make it much taller.
 *
 * Nothing here reads the page, and nothing moves with the scroll.
 */

/** Pictures flatter or taller than this are cropped by their tile (a safety, no real picture comes near it). */
export const MIN_RATIO = 0.2;
export const MAX_RATIO = 6;

/** The target row height as a part of the wall's width, and its floor and ceiling. A phone's rows are the floor (two wide pictures or three squares to a row). */
const ROW_H_PER_VW = 0.17;
export const ROW_H_MIN = 110;
export const ROW_H_MAX = 340;

/** The gap between pictures and between rows, as a part of the wall's width, and its floor and ceiling. */
const GAP_PER_VW = 0.0065;
export const GAP_MIN = 6;
export const GAP_MAX = 12;

/** A last row that would grow taller than this many target heights to fill the width keeps the target height. */
const LAST_ROW_STRETCH = 1.25;

/**
 * What a group's heading and the space around it take, for the estimate of where rows stand on the
 * first screen (the loading list plans before the page exists), measured on the page: the first
 * group sits close under the head, the later ones after a wider space. The page itself does not use it.
 */
const FIRST_PART_ADVANCE = 68;
const PART_ADVANCE = 100;

export interface FlowMetrics {
  /** Width of the wall, CSS pixels (the page's width less its side margins). */
  vw: number;
  /** The target height of a row. */
  rowH: number;
  /** The gap between pictures and between rows. */
  gap: number;
}

/** One row: which pictures, how wide each one is and how tall the row is. */
export interface FlowRow {
  /** Index of its first picture in the list. */
  start: number;
  count: number;
  /** Width of each tile, CSS pixels (whole numbers). The widths and the gaps add up to the wall's width. */
  widths: number[];
  /** Height of the row, a whole number. */
  height: number;
}

/** A group of the wall: its pictures are `count` of the list from `start`. */
export interface FlowPart {
  id: string;
  name: string;
  start: number;
  count: number;
}

/** A group with its rows. A wall with no groups is one block with no part. */
export interface FlowBlock {
  part: FlowPart | null;
  rows: FlowRow[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The ratio a tile is drawn at: the picture's own. A broken size counts as a square. */
export function tileRatio(w: number, h: number): number {
  const r = w > 0 && h > 0 ? w / h : 1;
  return clamp(r, MIN_RATIO, MAX_RATIO);
}

/** The target row height and the gap for a wall `vw` wide. */
export function metricsFor(vw: number): FlowMetrics {
  return {
    vw,
    rowH: Math.round(clamp(vw * ROW_H_PER_VW, ROW_H_MIN, ROW_H_MAX)),
    gap: Math.round(clamp(vw * GAP_PER_VW, GAP_MIN, GAP_MAX)),
  };
}

/** Whether the rows must be planned again: only a new width does (the height of the screen plays no part). */
export function needsRebuild(prev: FlowMetrics | null, vw: number): boolean {
  return !prev || Math.round(prev.vw) !== Math.round(vw);
}

/** The height at which pictures of these ratios (their sum, in `count` pictures) fill the wall. */
function fitHeight(sum: number, count: number, m: FlowMetrics): number {
  return (m.vw - m.gap * (count - 1)) / sum;
}

/**
 * Cut the pictures `from` to `to` (exclusive) of the list into rows, in order, nothing reordered
 * and nothing repeated. `ratios` are the tile ratios (`tileRatio`) of the whole list.
 */
export function planRows(
  ratios: readonly number[],
  m: FlowMetrics,
  from = 0,
  to = ratios.length,
): FlowRow[] {
  const ratioAt = (i: number) => ratios[i] ?? 1;
  const rows: FlowRow[] = [];
  let i = from;
  while (i < to) {
    let sum = 0;
    let count = 0;
    while (i + count < to) {
      const r = ratioAt(i + count);
      if (count > 0 && (sum + r) * m.rowH + m.gap * count > m.vw) {
        // One more does not fit at the target height: it goes in when the row is then closer to the target.
        const without = fitHeight(sum, count, m);
        const withIt = fitHeight(sum + r, count + 1, m);
        if (Math.abs(withIt - m.rowH) < Math.abs(without - m.rowH)) {
          sum += r;
          count += 1;
        }
        break;
      }
      sum += r;
      count += 1;
    }

    const fit = fitHeight(sum, count, m);
    const keep = i + count >= to && fit > m.rowH * LAST_ROW_STRETCH;
    const widths: number[] = [];
    let height: number;
    if (keep) {
      height = m.rowH;
      for (let k = 0; k < count; k++) widths.push(Math.max(1, Math.round(ratioAt(i + k) * m.rowH)));
    } else {
      height = Math.max(1, Math.round(fit));
      // Cumulative rounding, so the widths and the gaps add up to the wall's width exactly.
      const room = m.vw - m.gap * (count - 1);
      let cum = 0;
      let before = 0;
      for (let k = 0; k < count; k++) {
        cum += ratioAt(i + k);
        const edge = Math.round((room * cum) / sum);
        widths.push(Math.max(1, edge - before));
        before = edge;
      }
    }
    rows.push({ start: i, count, widths, height });
    i += count;
  }
  return rows;
}

/** The rows of every group (or of the one list, when there are no groups). Empty groups are left out. */
export function planWall(
  ratios: readonly number[],
  parts: readonly FlowPart[] | null,
  m: FlowMetrics,
): FlowBlock[] {
  if (!parts) return ratios.length > 0 ? [{ part: null, rows: planRows(ratios, m) }] : [];
  return parts
    .filter((part) => part.count > 0)
    .map((part) => ({ part, rows: planRows(ratios, m, part.start, part.start + part.count) }));
}

/**
 * Which size of a picture a tile asks for. `t` is 480 on the long side: it is sharp enough while
 * the tile needs at most `t` times 1.15 device pixels on its long side, and `p` (1280) otherwise.
 * The display decides, nothing else. The loading list uses the same function, so what it waits
 * for is what the tiles ask for.
 */
export function pickSize(tileW: number, tileH: number, dpr: number): "t" | "p" {
  const need = Math.max(tileW, tileH) * Math.max(1, dpr);
  return need <= 480 * 1.15 ? "t" : "p";
}

/**
 * The pictures that show on the first screen, for the loading list: the ones of the first rows
 * that start inside the screen when the page is at the top. `headOffset` is the height of what
 * stands above the wall and `vh` the height of the screen. At most `limit` of them, row by row.
 * Returns the index of each picture and the tile's width and height.
 */
export function firstScreenTiles(
  ratios: readonly number[],
  parts: readonly FlowPart[] | null,
  m: FlowMetrics,
  headOffset: number,
  vh: number,
  limit: number,
): Array<{ index: number; w: number; h: number }> {
  const out: Array<{ index: number; w: number; h: number }> = [];
  let y = headOffset;
  let first = true;
  for (const block of planWall(ratios, parts, m)) {
    if (block.part) y += first ? FIRST_PART_ADVANCE : PART_ADVANCE;
    first = false;
    for (const row of block.rows) {
      if (y >= vh || out.length >= limit) return out;
      for (let k = 0; k < row.count && out.length < limit; k++) {
        out.push({ index: row.start + k, w: row.widths[k] ?? 0, h: row.height });
      }
      y += row.height + m.gap;
    }
  }
  return out;
}
