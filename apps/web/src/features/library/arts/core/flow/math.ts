/**
 * The maths of the flow: rows of pictures that slide sideways while the page scrolls. Pure
 * functions, so they can be tested without a browser. The numbers come from the reference gallery
 * (`docs/design/arts-reference-gallery.md`): one row height and one gap for the whole page, a row
 * that slides over its own pass through the screen, a position that is a straight line of the
 * scroll, and rows whose length comes from the pictures' own ratios.
 *
 * The picture ratios decide the rows. A row takes pictures until it is wider than the screen by a
 * slide of about 0.4 px per px of scroll, and it slides exactly its own slack: its first picture is
 * whole at one end of the slide and its last at the other, so no edge is ever empty and no picture is
 * hidden. How many pictures a row holds follows from the row height and the ratios.
 *
 * Nothing here reads the page. Where a row sits and how far it has slid are arithmetic.
 */

/** Pictures flatter or taller than this are cropped by their tile (a safety, no real picture comes near it). */
export const MIN_RATIO = 0.2;
export const MAX_RATIO = 6;

/** The row height as a part of the width, and its floor and ceiling. A phone's rows are the floor. */
const ROW_H_PER_VW = 0.145;
export const ROW_H_MIN = 160;
export const ROW_H_MAX = 300;

/** The gap between pictures and between rows, as a part of the width, and its floor and ceiling. */
const GAP_PER_VW = 0.0165;
export const GAP_MIN = 14;
export const GAP_MAX = 28;

/**
 * Sideways travel per pixel of scroll. A row takes pictures until its slack is at least the floor
 * (times the screen height), then one more when that brings it closer to the goal.
 */
const FLOW_SPEED_GOAL = 0.4;
export const FLOW_SPEED_MIN = 0.2;

/** How far outside the screen rows stand ready, as a part of the screen height. */
const OVERSCAN = 0.75;

export interface FlowMetrics {
  /** Width of the rows' box, CSS pixels. */
  vw: number;
  /** The large viewport height, CSS pixels. A phone's address bar does not change it. */
  vh: number;
  /** Height of every row. */
  rowH: number;
  /** The gap between pictures and between rows. */
  gap: number;
}

/** One row: which pictures, how wide each one is, how far it slides and where it stands. */
export interface FlowRow {
  index: number;
  /** Index of its first picture in the list. */
  start: number;
  count: number;
  /** Width of each tile, CSS pixels (whole numbers). */
  widths: number[];
  /** Width of the row: the tiles and the gaps. */
  content: number;
  /** How far the row slides: its slack, `max(0, content - vw)`. */
  travel: number;
  /** Distance from the top of the rows' box. */
  top: number;
  /** 1 slides right while the page scrolls down, -1 slides left. Alternates row by row. */
  dir: 1 | -1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The ratio a tile is drawn at: the picture's own. A broken size counts as a square. */
export function tileRatio(w: number, h: number): number {
  const r = w > 0 && h > 0 ? w / h : 1;
  return clamp(r, MIN_RATIO, MAX_RATIO);
}

/** Row height and gap for a screen. `vh` is the large viewport height. */
export function metricsFor(vw: number, vh: number): FlowMetrics {
  return {
    vw,
    vh,
    rowH: Math.round(clamp(vw * ROW_H_PER_VW, ROW_H_MIN, ROW_H_MAX)),
    gap: Math.round(clamp(vw * GAP_PER_VW, GAP_MIN, GAP_MAX)),
  };
}

/**
 * Whether the rows must be planned again for a new screen size. A change of width always does. A
 * change of height only when it is large (a turned phone): the large viewport height does not
 * follow an address bar, and a plan made again while the visitor scrolls would make the page jump.
 */
export function needsRebuild(prev: FlowMetrics | null, vw: number, vh: number): boolean {
  if (!prev) return true;
  if (Math.round(prev.vw) !== Math.round(vw)) return true;
  return Math.abs(vh - prev.vh) / Math.max(1, prev.vh) > 0.25;
}

/** The distance between the tops of two rows. */
export function pitchOf(m: FlowMetrics): number {
  return m.rowH + m.gap;
}

/** Height of the rows' box with `rows` rows in it. */
export function boxHeight(rows: number, m: FlowMetrics): number {
  return rows > 0 ? rows * pitchOf(m) - m.gap : 0;
}

/**
 * Cut the pictures into rows, in order, nothing reordered and nothing repeated. `ratios` are the
 * tile ratios (`tileRatio`).
 *
 * A row takes pictures until its slack (`content - vw`) is at least `FLOW_SPEED_MIN` of a screen
 * height, then looks at one more picture and takes it when that brings the slack closer to
 * `FLOW_SPEED_GOAL` of a screen height. A last row that cannot fill the screen slides a little, or
 * not at all (a row narrower than the screen stands still, centred).
 */
export function planRows(ratios: readonly number[], m: FlowMetrics): FlowRow[] {
  const total = ratios.length;
  const widthOf = (i: number) => Math.max(1, Math.round((ratios[i] ?? 1) * m.rowH));
  const floor = FLOW_SPEED_MIN * m.vh;
  const goal = FLOW_SPEED_GOAL * m.vh;
  const rows: FlowRow[] = [];
  let i = 0;
  while (i < total) {
    let content = 0;
    let count = 0;
    while (i + count < total) {
      content += (count > 0 ? m.gap : 0) + widthOf(i + count);
      count++;
      if (content - m.vw >= floor) break;
    }
    if (content - m.vw >= floor && i + count < total) {
      const more = content + m.gap + widthOf(i + count);
      if (Math.abs(more - m.vw - goal) < Math.abs(content - m.vw - goal)) {
        content = more;
        count++;
      }
    }
    const index = rows.length;
    const widths: number[] = [];
    for (let k = 0; k < count; k++) widths.push(widthOf(i + k));
    rows.push({
      index,
      start: i,
      count,
      widths,
      content,
      travel: Math.max(0, content - m.vw),
      top: index * pitchOf(m),
      dir: index % 2 === 0 ? 1 : -1,
    });
    i += count;
  }
  return rows;
}

/** What the scroll maths needs to know about the page. */
export interface FlowScroll {
  /** The page's scroll position now. */
  y: number;
  /** The distance from the top of the page to the top of the rows' box. */
  boxTop: number;
  /** The most the page can scroll: its height less the screen's. */
  maxScroll: number;
}

/**
 * The scroll positions between which a row slides: from the row whole at the bottom edge of the
 * screen to the row whole at the top edge (or the page's end). At both ends the row is fully in
 * view, so the picture at the end of the strip is whole and fully seen there: nothing is half
 * hidden. A row that is already past the bottom edge when the page is at the top starts its slide
 * at scroll 0, so the whole row can be seen: nothing of a first row is lost.
 */
export function slideWindow(
  row: FlowRow,
  m: FlowMetrics,
  boxTop: number,
  maxScroll: number,
): [start: number, end: number] {
  const mid = boxTop + row.top + m.rowH / 2;
  const half = m.rowH / 2;
  const start = Math.max(0, mid + half - m.vh);
  // A page that ends before the row is at the top lets the row finish its slide as the page ends.
  const end = Math.max(Math.min(mid - half, Math.max(0, maxScroll)), start + 1);
  return [start, end];
}

/** How far through its slide a row is, 0 to 1. */
export function slideProgress(row: FlowRow, m: FlowMetrics, scroll: FlowScroll): number {
  const [start, end] = slideWindow(row, m, scroll.boxTop, scroll.maxScroll);
  return clamp((scroll.y - start) / (end - start), 0, 1);
}

/**
 * Where the row's content sits, as a translateX in CSS pixels. The row slides right while the page
 * scrolls down when `dir` is 1. A row narrower than the screen stands still, centred. The result is a
 * whole device pixel, so the pictures stay sharp.
 */
export function rowShift(row: FlowRow, m: FlowMetrics, scroll: FlowScroll, dpr = 1): number {
  if (row.content < m.vw) return roundTo(Math.max(0, (m.vw - row.content) / 2), dpr);
  const q = slideProgress(row, m, scroll);
  const x = row.dir === 1 ? -row.travel * (1 - q) : -row.travel * q;
  return roundTo(x, dpr);
}

function roundTo(value: number, dpr: number): number {
  const d = Math.max(1, dpr);
  // Adding zero turns -0 into 0.
  return Math.round(value * d) / d + 0;
}

/**
 * The page scroll that brings picture `k` of a row to the middle of the screen, kept inside the
 * middle half of the row's slide so the row is well in view. Used to open a picture named by the
 * address, and to follow the keyboard focus.
 */
export function scrollForPicture(
  row: FlowRow,
  k: number,
  m: FlowMetrics,
  boxTop: number,
  maxScroll: number,
): number {
  const [start, end] = slideWindow(row, m, boxTop, maxScroll);
  if (row.travel <= 0 || row.content < m.vw) return start + (end - start) * 0.5;
  let c = 0;
  for (let j = 0; j < k; j++) c += (row.widths[j] ?? 0) + m.gap;
  c += (row.widths[k] ?? 0) / 2;
  const x = clamp(m.vw / 2 - c, -row.travel, 0);
  const q = row.dir === 1 ? 1 + x / row.travel : -x / row.travel;
  return start + clamp(q, 0.25, 0.75) * (end - start);
}

/**
 * The page scroll that shows picture `k` of a row whole, as near the current scroll `y` as the
 * row's slide allows: the same `y` when it is whole already. For a keyboard focus, which should
 * not move the page more than it must. A picture wider than the screen is centred.
 */
export function scrollToShow(
  row: FlowRow,
  k: number,
  m: FlowMetrics,
  boxTop: number,
  maxScroll: number,
  y: number,
): number {
  if (row.travel <= 0 || row.content < m.vw) return y;
  let a = 0;
  for (let j = 0; j < k; j++) a += (row.widths[j] ?? 0) + m.gap;
  const w = row.widths[k] ?? 0;
  if (w >= m.vw) return scrollForPicture(row, k, m, boxTop, maxScroll);
  // The picture is whole while the row's shift is in [-a, vw - a - w]: the same in terms of the slide.
  const toQ = (x: number) => (row.dir === 1 ? (x + row.travel) / row.travel : -x / row.travel);
  const qa = toQ(-a);
  const qb = toQ(m.vw - a - w);
  const lo = clamp(Math.min(qa, qb), 0, 1);
  const hi = clamp(Math.max(qa, qb), 0, 1);
  const [start, end] = slideWindow(row, m, boxTop, maxScroll);
  const now = clamp((y - start) / (end - start), 0, 1);
  const q = clamp(now, lo, hi);
  return q === now ? y : start + q * (end - start);
}

/** Which row holds picture `i`, or -1. */
export function rowOfPicture(rows: readonly FlowRow[], i: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    if (!row) return -1;
    if (i < row.start) hi = mid - 1;
    else if (i >= row.start + row.count) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * The rows that stand in the page: those that are on screen or within `overscan` pixels of it.
 * Returns `[first, last]` (inclusive), or `[0, -1]` when there are none.
 */
export function visibleRows(
  scrollY: number,
  boxTop: number,
  vh: number,
  rowCount: number,
  m: FlowMetrics,
  overscan: number,
): [number, number] {
  if (rowCount <= 0) return [0, -1];
  const pitch = pitchOf(m);
  const rel = scrollY - boxTop;
  const first = Math.floor((rel - overscan - m.rowH) / pitch) + 1;
  const last = Math.floor((rel + vh + overscan) / pitch);
  const a = clamp(first, 0, rowCount - 1);
  const b = clamp(last, 0, rowCount - 1);
  return b < a ? [0, -1] : [a, b];
}

/** How far outside the screen rows stand ready, in pixels. */
export function overscanFor(vh: number): number {
  return Math.round(vh * OVERSCAN);
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
 * The pictures that show on the first screen, for the loading list: the ones of the first rows that
 * are inside the screen when the page is at the top. `headOffset` is the height of what stands above
 * the rows. At most `limit` of them, row by row.
 */
export function firstScreenIndexes(
  ratios: readonly number[],
  m: FlowMetrics,
  headOffset: number,
  limit: number,
  maxScroll = Number.POSITIVE_INFINITY,
): number[] {
  const rows = planRows(ratios, m);
  const out: number[] = [];
  for (const row of rows) {
    if (headOffset + row.top >= m.vh) break;
    let x = rowShift(row, m, { y: 0, boxTop: headOffset, maxScroll });
    for (let k = 0; k < row.count; k++) {
      const w = row.widths[k] ?? 0;
      if (x + w > 0 && x < m.vw && out.length < limit) out.push(row.start + k);
      x += w + m.gap;
    }
    if (out.length >= limit) break;
  }
  return out;
}
