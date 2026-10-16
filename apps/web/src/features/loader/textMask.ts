import { FINE_STEP, WORDMARK } from "./constants";

/** RGBA pixels, the shape of ImageData without needing a DOM. */
export interface MaskImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Rows above this y hold the small line, which is sampled at a finer step. */
  split?: number;
}

export interface WordmarkMetrics {
  /** Width of "ASPIRANTS" in em of its own size, tracking included. */
  mainWidthEm: number;
  mainCapEm: number;
  /** Width of "THE" in em of its own size, tracking included. */
  smallWidthEm: number;
  smallCapEm: number;
}

export interface WordmarkLayout {
  mainSize: number;
  smallSize: number;
  mainX: number;
  mainBaseline: number;
  smallX: number;
  smallBaseline: number;
  /** Size of the inked block, centred in the box. */
  width: number;
  height: number;
  /** Middle of the gap between the two lines. */
  split: number;
}

export interface SampledPoints {
  /** x, y pairs in mask pixels. */
  xy: Float32Array;
  /** 1 where the point sits on a letter edge. */
  edge: Uint8Array;
  /** 1 where the point belongs to the finely sampled small line. */
  fine: Uint8Array;
  count: number;
  /** Typical distance between neighbouring points, in mask pixels. */
  spacing: number;
}

type MeasureContext = Pick<CanvasRenderingContext2D, "font" | "measureText">;
type DrawContext = MeasureContext &
  Pick<CanvasRenderingContext2D, "fillText" | "fillStyle" | "textAlign" | "textBaseline">;

const MEASURE_SIZE = 200;
const DEFAULT_CAP_EM = 0.72;

const fontString = (size: number, family: string, weight: number = WORDMARK.weight) =>
  `${weight} ${size}px ${family}`;

function trackedWidth(ctx: MeasureContext, text: string, size: number, trackingEm: number) {
  let width = 0;
  for (const ch of text) width += ctx.measureText(ch).width;
  return width + trackingEm * size * Math.max(0, text.length - 1);
}

/** Measures both lines once at a reference size. Widths and cap heights scale linearly. */
export function measureWordmark(ctx: MeasureContext, family: string): WordmarkMetrics {
  const capEm = () => {
    const ascent = ctx.measureText("H").actualBoundingBoxAscent;
    return Number.isFinite(ascent) && ascent > 0 ? ascent / MEASURE_SIZE : DEFAULT_CAP_EM;
  };
  ctx.font = fontString(MEASURE_SIZE, family);
  const mainCapEm = capEm();
  const mainWidthEm =
    trackedWidth(ctx, WORDMARK.main, MEASURE_SIZE, WORDMARK.mainTracking) / MEASURE_SIZE;
  ctx.font = fontString(MEASURE_SIZE, family, WORDMARK.smallWeight);
  return {
    mainWidthEm,
    mainCapEm,
    smallWidthEm:
      trackedWidth(ctx, WORDMARK.small, MEASURE_SIZE, WORDMARK.smallTracking) / MEASURE_SIZE,
    smallCapEm: capEm(),
  };
}

/**
 * Largest wordmark that fits the box: "THE" small and spaced above "ASPIRANTS", centred.
 * `minSmall` keeps "THE" readable on narrow screens; the main line shrinks if it must.
 */
export function fitWordmark(
  boxW: number,
  boxH: number,
  m: WordmarkMetrics,
  minSmall = 0,
): WordmarkLayout {
  const r = WORDMARK.smallRatio;
  const widthEm = Math.max(m.mainWidthEm, m.smallWidthEm * r);
  const heightEm = m.smallCapEm * r + WORDMARK.gapEm + m.mainCapEm;
  let mainSize =
    widthEm > 0 && heightEm > 0 ? Math.max(0, Math.min(boxW / widthEm, boxH / heightEm)) : 0;
  let smallSize = mainSize * r;
  if (mainSize > 0 && smallSize < minSmall) {
    smallSize = Math.min(minSmall, m.smallWidthEm > 0 ? boxW / m.smallWidthEm : minSmall);
    const room = boxH - m.smallCapEm * smallSize;
    mainSize = Math.max(0, Math.min(mainSize, room / (WORDMARK.gapEm + m.mainCapEm)));
  }
  const width = Math.max(m.mainWidthEm * mainSize, m.smallWidthEm * smallSize);
  const height = m.smallCapEm * smallSize + WORDMARK.gapEm * mainSize + m.mainCapEm * mainSize;
  const top = (boxH - height) / 2;
  const smallBaseline = top + m.smallCapEm * smallSize;
  return {
    mainSize,
    smallSize,
    mainX: (boxW - m.mainWidthEm * mainSize) / 2,
    mainBaseline: smallBaseline + WORDMARK.gapEm * mainSize + m.mainCapEm * mainSize,
    smallX: (boxW - m.smallWidthEm * smallSize) / 2,
    smallBaseline,
    width,
    height,
    split: smallBaseline + (WORDMARK.gapEm * mainSize) / 2,
  };
}

function drawTracked(
  ctx: DrawContext,
  text: string,
  x: number,
  y: number,
  size: number,
  trackingEm: number,
) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + trackingEm * size;
  }
}

/** Draws the fitted wordmark in white. Letters are placed one by one so tracking works everywhere. */
export function drawWordmark(ctx: DrawContext, layout: WordmarkLayout, family: string) {
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fontString(layout.mainSize, family);
  drawTracked(
    ctx,
    WORDMARK.main,
    layout.mainX,
    layout.mainBaseline,
    layout.mainSize,
    WORDMARK.mainTracking,
  );
  ctx.font = fontString(layout.smallSize, family, WORDMARK.smallWeight);
  drawTracked(
    ctx,
    WORDMARK.small,
    layout.smallX,
    layout.smallBaseline,
    layout.smallSize,
    WORDMARK.smallTracking,
  );
}

const EDGE_SHARE = 0.22;
/** Smallest "THE" font size in CSS pixels; below this its particles stop reading as letters. */
const MIN_SMALL_PX = 30;

/**
 * Turns a text mask into exactly `target` points. Interior points come from a jittered grid
 * whose step is chosen from the filled area, so density follows the budget. A second pass
 * places a share of the points on letter edges so the outline stays crisp at low counts.
 * Rows above `mask.split` (the small line) use a finer step so "THE" stays legible on phones.
 * The result is shuffled and trimmed or padded to `target`.
 */
export function sampleMask(mask: MaskImage, target: number, rng: () => number): SampledPoints {
  const { data, width: w, height: h } = mask;
  const empty: SampledPoints = {
    xy: new Float32Array(0),
    edge: new Uint8Array(0),
    fine: new Uint8Array(0),
    count: 0,
    spacing: 1,
  };
  if (w <= 0 || h <= 0 || target <= 0) return empty;

  const split = Math.min(h, Math.max(0, Math.round(mask.split ?? 0)));
  const filled = new Uint8Array(w * h);
  let areaFine = 0;
  let areaMain = 0;
  for (let i = 0, n = w * h; i < n; i++) {
    if ((data[i * 4 + 3] ?? 0) >= 128) {
      filled[i] = 1;
      if (i < split * w) areaFine++;
      else areaMain++;
    }
  }
  if (areaFine + areaMain === 0) return empty;

  const isFilled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && filled[y * w + x] === 1;

  const xs: number[] = [];
  const ys: number[] = [];
  const edges: number[] = [];
  const fines: number[] = [];
  const push = (x: number, y: number, isEdge: number, isFine: number) => {
    xs.push(x);
    ys.push(y);
    edges.push(isEdge);
    fines.push(isFine);
  };

  // The small line is sampled FINE_STEP times closer, so it costs 1 / FINE_STEP^2 per pixel.
  const f = FINE_STEP;
  const edgeTarget = Math.round(target * EDGE_SHARE);
  const weighted = areaMain + areaFine / (f * f);
  const step = Math.max(1, Math.sqrt(weighted / Math.max(1, target - edgeTarget)));
  const grid = (y0: number, y1: number, s: number, isFine: number) => {
    for (let gy = y0 + s / 2; gy < y1; gy += s) {
      for (let gx = s / 2; gx < w; gx += s) {
        const x = gx + (rng() - 0.5) * s * 0.3;
        const y = gy + (rng() - 0.5) * s * 0.3;
        if (isFilled(Math.floor(x), Math.floor(y))) push(x, y, 0, isFine);
      }
    }
  };
  grid(0, split, Math.max(1, step * f), 1);
  grid(split, h, step, 0);

  const edgeFine: number[] = [];
  const edgeMain: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (
        filled[y * w + x] === 1 &&
        (!isFilled(x - 1, y) || !isFilled(x + 1, y) || !isFilled(x, y - 1) || !isFilled(x, y + 1))
      ) {
        (y < split ? edgeFine : edgeMain).push(y * w + x);
      }
    }
  }
  // Edges are lines, so the fine line costs 1 / FINE_STEP per edge pixel.
  const edgeWeighted = edgeMain.length + edgeFine.length / f;
  if (edgeTarget > 0 && edgeWeighted > 0) {
    const pick = (pixels: number[], cell: number, isFine: number) => {
      const cols = Math.ceil(w / cell);
      const taken = new Uint8Array(cols * Math.ceil(h / cell));
      for (const p of pixels) {
        const x = p % w;
        const y = (p - x) / w;
        const key = Math.floor(y / cell) * cols + Math.floor(x / cell);
        if (taken[key] === 1) continue;
        taken[key] = 1;
        push(x + 0.5, y + 0.5, 1, isFine);
      }
    };
    const cell = Math.max(1, edgeWeighted / edgeTarget);
    pick(edgeFine, Math.max(1, cell * f), 1);
    pick(edgeMain, cell, 0);
  }

  const found = xs.length;
  if (found === 0) return empty;

  // Pick `target` source indices in random order. Extra points, when the mask yields too
  // few, are duplicates that get a little jitter so they do not stack exactly.
  const pool = new Uint32Array(Math.max(found, target));
  const dup = new Uint8Array(pool.length);
  for (let i = 0; i < pool.length; i++) {
    pool[i] = i < found ? i : Math.floor(rng() * found);
    dup[i] = i < found ? 0 : 1;
  }
  for (let i = 0; i < target; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const p = pool[i] ?? 0;
    const d = dup[i] ?? 0;
    pool[i] = pool[j] ?? 0;
    dup[i] = dup[j] ?? 0;
    pool[j] = p;
    dup[j] = d;
  }

  const xy = new Float32Array(target * 2);
  const edge = new Uint8Array(target);
  const fine = new Uint8Array(target);
  for (let i = 0; i < target; i++) {
    const src = pool[i] ?? 0;
    const isFine = fines[src] ?? 0;
    const j = dup[i] === 1 ? step * (isFine ? f : 1) * 0.3 : 0;
    xy[i * 2] = (xs[src] ?? 0) + (j ? (rng() - 0.5) * j : 0);
    xy[i * 2 + 1] = (ys[src] ?? 0) + (j ? (rng() - 0.5) * j : 0);
    edge[i] = edges[src] ?? 0;
    fine[i] = isFine;
  }
  return { xy, edge, fine, count: target, spacing: step };
}

/**
 * Renders the wordmark for a box (CSS pixels) into an offscreen canvas and returns its
 * pixels. Returns null when 2D canvas is unavailable.
 */
export function renderMask(
  boxW: number,
  boxH: number,
  family: string,
  scale: number,
): MaskImage | null {
  const w = Math.max(1, Math.round(boxW * scale));
  const h = Math.max(1, Math.round(boxH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const layout = fitWordmark(w, h, measureWordmark(ctx, family), MIN_SMALL_PX * scale);
  drawWordmark(ctx, layout, family);
  const image = ctx.getImageData(0, 0, w, h);
  return { data: image.data, width: w, height: h, split: layout.split };
}

/** Pixels per CSS pixel for the mask: fine enough on phones, cheap on ultrawide screens. */
export function maskScale(boxW: number): number {
  if (boxW <= 0) return 1;
  return Math.min(2.5, Math.max(0.6, 1100 / boxW));
}
