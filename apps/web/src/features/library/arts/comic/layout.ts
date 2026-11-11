/**
 * The maths of the Comic room. Pure functions, so they are tested without a browser.
 *
 * The pictures are panels of every shape: strips as tall as 1:4.2, squares, portraits and strips
 * as wide as 3.2:1. A row of equal height would shrink a tall strip to a sliver, so the room is
 * not made of rows. It is made of lanes: two columns of one fixed width (one column on a phone),
 * and every picture is shown at the full width of its lane, as tall as its own shape makes it. A
 * tall strip runs on and is read by scrolling past. Nothing is stretched, and nothing is drawn
 * wider than its own pixels (a small source stands at its own size in the middle of its lane).
 *
 * Reading order: pictures are placed in the order of the file, each into the lane that is shorter
 * so far. That makes the top edges never go up from one picture to the next, so reading the page
 * from the top, left to right, is reading the file in order. A very wide picture takes both lanes
 * at once, at the foot of the taller one. It does so only when the lanes are near each other in
 * height (or when it is so wide that a lane would shrink it to a ribbon), so no big hole opens
 * beside a tall strip.
 */

/** The picture's own pixels (the full size file). */
export interface Shape {
  w: number;
  h: number;
}

/** Two lanes from this width of the page's box (each is then at least about 330 px). */
export const TWO_LANES_FROM = 680;
/** A picture this wide (width over height) may take both lanes. */
export const SPAN_MIN = 1.8;
/** A picture this wide always takes both lanes: one lane would make it a ribbon. */
export const SPAN_ALWAYS = 2.5;
/** Otherwise it takes both when the lanes differ by no more than this part of a lane's width. */
export const SPAN_TOLERANCE = 0.45;
/**
 * On one lane (a phone), a picture that would stand shorter than `PAN_BELOW` is shown `PAN_H` tall
 * and slides sideways under the finger, so what is drawn in it can be seen.
 */
export const PAN_H = 190;
export const PAN_BELOW = 150;

const MIN_RATIO = 0.1;
const MAX_RATIO = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The ratio a picture is drawn at: its own. A broken size counts as a square. */
export function ratioOf(shape: Shape): number {
  return shape.w > 0 && shape.h > 0 ? clamp(shape.w / shape.h, MIN_RATIO, MAX_RATIO) : 1;
}

export interface ComicMetrics {
  /** The width of the box the pictures stand in, CSS pixels. */
  width: number;
  /** The viewport height. */
  vh: number;
  lanes: 1 | 2;
  /** The gap between lanes and between pictures. */
  gap: number;
  /** The width of one lane (the whole box on one lane). */
  laneW: number;
}

/** The lanes for a box `width` wide on a screen `vh` high. */
export function metricsFor(width: number, vh: number): ComicMetrics {
  const w = Math.max(1, Math.floor(width));
  const lanes = w >= TWO_LANES_FROM ? 2 : 1;
  const gap = lanes === 2 ? Math.round(clamp(w * 0.018, 16, 28)) : 16;
  const laneW = lanes === 2 ? Math.floor((w - gap) / 2) : w;
  return { width: w, vh, lanes, gap, laneW };
}

/** One picture placed in the box: its place and size in CSS pixels, from the box's top left. */
export interface ComicTile {
  /** The index in the list that was planned. */
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The picture takes both lanes. */
  span: boolean;
  /** The lane (0 left, 1 right) of a picture that does not span. A spanning picture is 0. */
  lane: 0 | 1;
  /** The width of the picture inside its tile when it slides sideways (a pan strip), else 0. */
  pan: number;
}

export interface ComicPlan {
  metrics: ComicMetrics;
  tiles: ComicTile[];
  /** The height of the box. */
  height: number;
}

/** Whether a picture of `ratio` takes both lanes now, when the lanes end `delta` px apart. */
export function takesBothLanes(ratio: number, delta: number, m: ComicMetrics): boolean {
  if (m.lanes !== 2 || ratio < SPAN_MIN) return false;
  return ratio >= SPAN_ALWAYS || delta <= SPAN_TOLERANCE * m.laneW;
}

/**
 * Place the pictures, in order. `shapes` are their full size pixels (`img.w` and `img.h`).
 * `groups` names the comic of each picture: where it changes, both lanes are brought level and a
 * little more space is left, so a new comic starts on a clean line instead of beside the last
 * strip of the one before.
 */
export function planComic(
  shapes: readonly Shape[],
  m: ComicMetrics,
  groups?: readonly string[],
): ComicPlan {
  const ends: [number, number] = [0, 0];
  const tiles: ComicTile[] = [];
  const lanes = m.lanes;

  shapes.forEach((shape, index) => {
    if (index > 0 && groups && groups[index] !== groups[index - 1]) {
      ends[0] = ends[1] = Math.max(ends[0], ends[1]) + m.gap;
    }
    const ratio = ratioOf(shape);
    const own = Math.max(1, Math.round(shape.w));
    const delta = lanes === 2 ? Math.abs(ends[0] - ends[1]) : 0;

    if (takesBothLanes(ratio, delta, m)) {
      const y = Math.max(ends[0], ends[1]);
      const w = Math.max(1, Math.min(m.width, own));
      const h = Math.max(1, Math.round(w / ratio));
      tiles.push({ index, x: Math.round((m.width - w) / 2), y, w, h, span: true, lane: 0, pan: 0 });
      ends[0] = ends[1] = y + h + m.gap;
      return;
    }

    const lane: 0 | 1 = lanes === 2 && ends[1] < ends[0] ? 1 : 0;
    const slot = m.laneW;
    const w = Math.max(1, Math.min(slot, own));
    let h = Math.max(1, Math.round(w / ratio));
    let pan = 0;
    if (lanes === 1 && h < PAN_BELOW) {
      // Too flat to read at the width of the screen: stand it taller and let it slide.
      const inner = Math.min(Math.round(PAN_H * ratio), own);
      if (inner > w + 8) {
        h = Math.max(1, Math.round(inner / ratio));
        pan = inner;
      }
    }
    const x = lane * (slot + m.gap) + Math.round((slot - w) / 2);
    const y = ends[lane];
    tiles.push({ index, x, y, w, h, span: false, lane, pan });
    ends[lane] = y + h + m.gap;
  });

  const height = tiles.length > 0 ? Math.max(ends[0], ends[1]) - m.gap : 0;
  return { metrics: m, tiles, height };
}

/**
 * The size of the file a tile asks for. The thumbnail (`t`) is always drawn first as the
 * placeholder, so this is the sharp one: the preview (`p`, at most 1280 wide) unless the tile is
 * wider on the screen than the preview can fill (a spanning picture on a dense screen), when it
 * is the full size. A source that is not wider than the preview never asks for more.
 */
export function pickSize(cssWidth: number, dpr: number, sourceWidth: number): "p" | "f" {
  const need = cssWidth * Math.max(1, dpr);
  const preview = Math.min(1280, sourceWidth);
  return sourceWidth > 1280 && need > preview * 1.15 ? "f" : "p";
}

/** The indexes of the tiles that show in the screen `[scrollY, scrollY + vh]`, `margin` px more on each side. */
export function visibleIndexes(
  plan: ComicPlan,
  boxTop: number,
  scrollY: number,
  vh: number,
  margin = 0,
): number[] {
  const lo = scrollY - margin;
  const hi = scrollY + vh + margin;
  const out: number[] = [];
  for (const tile of plan.tiles) {
    const top = boxTop + tile.y;
    if (top + tile.h > lo && top < hi) out.push(tile.index);
  }
  return out;
}

/**
 * The tiles the first screen shows when the page opens at the top, for the loading list: those
 * that start above the fold (`headOffset` is what stands above the box: the bar, the title and the
 * filter), with a little more for a tile that has just come in. At most `limit`.
 */
export function firstScreenIndexes(
  plan: ComicPlan,
  headOffset: number,
  vh: number,
  limit = 8,
): number[] {
  return visibleIndexes(plan, headOffset, 0, vh, vh * 0.1).slice(0, limit);
}

/** A place on the page that survives a new plan: a tile and how far down it the middle of the screen was. */
export interface Anchor {
  index: number;
  frac: number;
}

/**
 * The anchor at `y` (from the box's top), or null for an empty plan. The tile that holds `y` (of
 * two lanes, the one whose middle is nearer), else the nearest.
 */
export function anchorAt(plan: ComicPlan, y: number): Anchor | null {
  let best: ComicTile | undefined;
  let gap = Number.POSITIVE_INFINITY;
  let mid = Number.POSITIVE_INFINITY;
  for (const tile of plan.tiles) {
    const d = y < tile.y ? tile.y - y : y > tile.y + tile.h ? y - (tile.y + tile.h) : 0;
    const m = Math.abs(y - (tile.y + tile.h / 2));
    if (d < gap || (d === gap && m < mid)) {
      gap = d;
      mid = m;
      best = tile;
    }
  }
  if (!best) return null;
  return { index: best.index, frac: clamp((y - best.y) / best.h, 0, 1) };
}

/** The y (from the box's top) of an anchor in a plan. */
export function yOfAnchor(plan: ComicPlan, anchor: Anchor): number | null {
  const tile = plan.tiles[anchor.index];
  return tile ? tile.y + anchor.frac * tile.h : null;
}

/**
 * Where to scroll the page so tile `tile` shows: in the middle of the screen when it fits under the
 * bar, from its top when it is a tall strip. `boxTop` is the box's distance from the top of the
 * page, `bar` the height of what stands over the top of the screen.
 */
export function scrollForTile(
  tile: ComicTile,
  boxTop: number,
  vh: number,
  bar: number,
  maxScroll: number,
): number {
  const top = boxTop + tile.y;
  const free = vh - bar;
  const y = tile.h >= free * 0.9 ? top - bar - 16 : top - bar - (free - tile.h) / 2;
  return clamp(Math.round(y), 0, Math.max(0, maxScroll));
}
