/**
 * The maths of the gallery grid: where each picture goes. Pure functions, so they can be tested.
 *
 * Every picture's width and height are known from the data, so the whole layout is worked out
 * before a single picture loads. Two layouts:
 *
 *  - `masonry`: equal columns, each picture goes to the shortest column.
 *  - `justified`: rows of equal height that fill the width, like a wall of prints.
 *
 * Both return a box (`x`, `y`, `w`, `h`, in CSS pixels) for each picture in the order given, and
 * the height of the whole grid.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  boxes: Box[];
  height: number;
}

/** Width over height of a picture. A broken size counts as a square. */
export function ratio(w: number, h: number): number {
  return w > 0 && h > 0 ? w / h : 1;
}

/** How many columns of at least `minColumn` fit in `width` (at least one). */
export function columnCount(width: number, minColumn: number, gap: number): number {
  if (width <= 0 || minColumn <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (minColumn + gap)));
}

/** Equal columns. Each picture goes under the shortest column (the leftmost one when they tie). */
export function masonry(
  ratios: readonly number[],
  width: number,
  columns: number,
  gap: number,
): Layout {
  const n = Math.max(1, Math.floor(columns));
  const colW = Math.max(1, (width - gap * (n - 1)) / n);
  const tops = new Array<number>(n).fill(0);
  const boxes: Box[] = [];
  for (const r of ratios) {
    let col = 0;
    for (let c = 1; c < n; c++) if ((tops[c] ?? 0) < (tops[col] ?? 0) - 0.5) col = c;
    const h = colW / (r > 0 ? r : 1);
    const y = tops[col] ?? 0;
    boxes.push({ x: col * (colW + gap), y, w: colW, h });
    tops[col] = y + h + gap;
  }
  const height = boxes.length ? Math.max(...tops) - gap : 0;
  return { boxes: boxes.map(roundBox), height: Math.round(height) };
}

/**
 * Rows of equal height that fill `width`. A row takes pictures until it is full at the wanted
 * height `rowHeight`, then it is scaled so it fits the width exactly. The last row is only
 * stretched when it is nearly full, so a lone picture is not blown up.
 */
export function justified(
  ratios: readonly number[],
  width: number,
  rowHeight: number,
  gap: number,
): Layout {
  const boxes: Box[] = [];
  let y = 0;
  let i = 0;
  const lastStretch = 1.3;
  while (i < ratios.length) {
    // Take pictures until the row is as wide as the grid at the wanted height.
    let sum = 0;
    let n = 0;
    while (i + n < ratios.length) {
      const r = ratios[i + n] ?? 1;
      const next = sum + (r > 0 ? r : 1);
      const rowW = next * rowHeight + gap * n;
      if (n > 0 && rowW > width) {
        // Include this picture only when that gets the row closer to the wanted height.
        const withIt = (width - gap * n) / next;
        const without = (width - gap * (n - 1)) / sum;
        if (Math.abs(withIt - rowHeight) < Math.abs(without - rowHeight)) {
          sum = next;
          n++;
        }
        break;
      }
      sum = next;
      n++;
      if (rowW === width) break;
    }
    const fit = (width - gap * (n - 1)) / sum;
    const isLast = i + n >= ratios.length;
    const h = isLast && fit > rowHeight * lastStretch ? rowHeight : fit;
    let x = 0;
    for (let k = 0; k < n; k++) {
      const r = ratios[i + k] ?? 1;
      const w = h * (r > 0 ? r : 1);
      boxes.push({ x, y, w, h });
      x += w + gap;
    }
    y += h + gap;
    i += n;
  }
  return { boxes: boxes.map(roundBox), height: boxes.length ? Math.round(y - gap) : 0 };
}

function roundBox(b: Box): Box {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  // Round the far edge, not the size, so neighbours meet without a hairline.
  return {
    x,
    y,
    w: Math.max(1, Math.round(b.x + b.w) - x),
    h: Math.max(1, Math.round(b.y + b.h) - y),
  };
}

export type GalleryLayout = "masonry" | "justified";

export interface GridOptions {
  layout: GalleryLayout;
  width: number;
  gap: number;
  /** Masonry: the narrowest a column may be. Justified: the wanted row height. */
  size: number;
}

/** The size that suits the width: a phone gets two columns or short rows, whatever `size` is. */
export function sizeFor(width: number, size: number, layout: GalleryLayout, gap: number): number {
  if (width < 520) {
    return layout === "masonry" ? Math.floor((width - gap) / 2) : Math.round(size * 0.5);
  }
  if (width < 900)
    return layout === "masonry"
      ? Math.min(size, Math.floor((width - gap) / 2))
      : Math.round(size * 0.75);
  return size;
}

/** Lay out `ratios` for a grid `width` px wide. */
export function layoutGrid(ratios: readonly number[], o: GridOptions): Layout {
  const size = sizeFor(o.width, o.size, o.layout, o.gap);
  if (o.layout === "justified") return justified(ratios, o.width, size, o.gap);
  return masonry(ratios, o.width, columnCount(o.width, size, o.gap), o.gap);
}

export type Dir = "left" | "right" | "up" | "down";

/**
 * The picture to move to from picture `i` with an arrow key. Left and right step through the
 * order. Up and down pick the nearest picture entirely above or below, the one whose middle is
 * closest. Returns -1 when there is none.
 */
export function neighbour(boxes: readonly Box[], i: number, dir: Dir): number {
  const from = boxes[i];
  if (!from) return -1;
  if (dir === "left") return i > 0 ? i - 1 : -1;
  if (dir === "right") return i < boxes.length - 1 ? i + 1 : -1;
  const cx = from.x + from.w / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, j) => {
    if (j === i) return;
    const gapY = dir === "up" ? from.y - (b.y + b.h) : b.y - (from.y + from.h);
    if (gapY < -1) return;
    const score = Math.max(0, gapY) * 2 + Math.abs(b.x + b.w / 2 - cx);
    if (score < bestScore) {
      bestScore = score;
      best = j;
    }
  });
  return best;
}

/** How many pictures to build at first and each time after (a slice). */
export const SLICE = 36;

/** The end of the next slice, never past `total`. */
export function nextSlice(shown: number, total: number, slice = SLICE): number {
  return Math.min(total, shown + slice);
}

/** The delay of the `k`th picture that arrives in one batch: a short step each, with a cap. */
export function staggerDelay(k: number, step = 55, max = 12): number {
  return Math.min(Math.max(0, k), max) * step;
}
