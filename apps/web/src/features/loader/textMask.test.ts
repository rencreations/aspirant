import { describe, expect, it } from "vitest";

import { WORDMARK } from "./constants";
import { createRng } from "./random";
import {
  drawWordmark,
  fitWordmark,
  maskScale,
  measureWordmark,
  sampleMask,
  type MaskImage,
  type WordmarkMetrics,
} from "./textMask";

/** A 2D context stand-in: every glyph is half an em wide and caps are 0.7 em tall. */
function fakeContext() {
  const calls: Array<{ text: string; x: number; y: number; font: string }> = [];
  const sizeOf = (font: string) => Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 0);
  const ctx: Parameters<typeof drawWordmark>[0] = {
    font: "",
    fillStyle: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    measureText: (text: string) => {
      const size = sizeOf(ctx.font);
      return {
        width: text.length * size * 0.5,
        actualBoundingBoxAscent: size * 0.7,
      } as TextMetrics;
    },
    fillText: (text: string, x: number, y: number) => {
      calls.push({ text, x, y, font: ctx.font });
    },
  };
  return { ctx, calls, sizeOf };
}

function rectMask(
  width: number,
  height: number,
  rects: Array<[number, number, number, number]>,
  split?: number,
): MaskImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { data, width, height, split };
}

const metrics: WordmarkMetrics = {
  mainWidthEm: 4,
  mainCapEm: 0.7,
  smallWidthEm: 3,
  smallCapEm: 0.7,
};

describe("measureWordmark", () => {
  it("measures both lines with tracking, in em", () => {
    const { ctx } = fakeContext();
    const m = measureWordmark(ctx, "Display");
    expect(m.mainWidthEm).toBeCloseTo(9 * 0.5 + WORDMARK.mainTracking * 8);
    expect(m.smallWidthEm).toBeCloseTo(3 * 0.5 + WORDMARK.smallTracking * 2);
    expect(m.mainCapEm).toBeCloseTo(0.7);
    expect(m.smallCapEm).toBeCloseTo(0.7);
  });
});

describe("fitWordmark", () => {
  it("fills the width of a wide box and centres the block vertically", () => {
    const l = fitWordmark(1000, 300, metrics);
    expect(l.mainSize).toBeCloseTo(250);
    expect(l.smallSize).toBeCloseTo(250 * WORDMARK.smallRatio);
    expect(l.mainX).toBeCloseTo(0);
    const top = l.smallBaseline - metrics.smallCapEm * l.smallSize;
    expect(top).toBeCloseTo((300 - l.height) / 2);
    expect(l.mainBaseline).toBeCloseTo(top + l.height);
    expect(l.split).toBeGreaterThan(l.smallBaseline);
    expect(l.split).toBeLessThan(l.mainBaseline - metrics.mainCapEm * l.mainSize);
  });

  it("is bound by height in a short box", () => {
    const l = fitWordmark(1000, 100, metrics);
    expect(l.height).toBeCloseTo(100);
    expect(l.width).toBeLessThan(1000);
    expect(l.mainX).toBeGreaterThan(0);
  });

  it("keeps the small line at a readable size and shrinks the main line to fit", () => {
    const plain = fitWordmark(300, 80, metrics);
    const l = fitWordmark(300, 80, metrics, 30);
    expect(plain.smallSize).toBeLessThan(30);
    expect(l.smallSize).toBe(30);
    expect(l.mainSize).toBeLessThan(plain.mainSize);
    expect(l.height).toBeLessThanOrEqual(80 + 1e-9);
  });

  it("returns an empty layout for unusable metrics", () => {
    expect(fitWordmark(500, 200, { ...metrics, mainWidthEm: 0, smallWidthEm: 0 }).mainSize).toBe(0);
  });
});

describe("drawWordmark", () => {
  it("draws ASPIRANTS then THE letter by letter, centred, in their weights", () => {
    const { ctx, calls, sizeOf } = fakeContext();
    const m = measureWordmark(ctx, "Display");
    const l = fitWordmark(1000, 300, m);
    drawWordmark(ctx, l, "Display");
    expect(calls.map((c) => c.text).join("")).toBe("ASPIRANTSTHE");
    const main = calls.slice(0, 9);
    const small = calls.slice(9);
    expect(main.every((c) => c.font.startsWith(`${WORDMARK.weight} `))).toBe(true);
    expect(small.every((c) => c.font.startsWith(`${WORDMARK.smallWeight} `))).toBe(true);
    const last = main[8];
    expect(last).toBeDefined();
    if (!last) return;
    const right = last.x + sizeOf(last.font) * 0.5;
    expect(main[0]?.x).toBeCloseTo(1000 - right);
    expect(main.every((c) => c.y === l.mainBaseline)).toBe(true);
    expect(small.every((c) => c.y === l.smallBaseline)).toBe(true);
    const gap = (small[1]?.x ?? 0) - (small[0]?.x ?? 0);
    expect(gap).toBeCloseTo(l.smallSize * (0.5 + WORDMARK.smallTracking));
  });
});

describe("sampleMask", () => {
  const rect = rectMask(200, 100, [[40, 20, 160, 80]]);

  it("returns exactly the target, all inside the letters", () => {
    const p = sampleMask(rect, 500, createRng(1));
    expect(p.count).toBe(500);
    expect(p.xy).toHaveLength(1000);
    for (let i = 0; i < p.count; i++) {
      const x = p.xy[i * 2] ?? -1;
      const y = p.xy[i * 2 + 1] ?? -1;
      expect(x).toBeGreaterThanOrEqual(40);
      expect(x).toBeLessThanOrEqual(160);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(80);
    }
  });

  it("picks the grid step from the filled area and keeps a share on the edges", () => {
    const p = sampleMask(rect, 500, createRng(1));
    expect(p.spacing).toBeCloseTo(Math.sqrt(7200 / 390), 1);
    const edges = p.edge.reduce((sum, e) => sum + e, 0) / p.count;
    expect(edges).toBeGreaterThan(0.1);
    expect(edges).toBeLessThan(0.4);
  });

  it("pads with jittered duplicates when the mask is too small for the budget", () => {
    const p = sampleMask(rectMask(50, 50, [[10, 10, 20, 20]]), 1000, createRng(2));
    expect(p.count).toBe(1000);
    for (let i = 0; i < p.count; i++) {
      expect(p.xy[i * 2]).toBeGreaterThan(9.5);
      expect(p.xy[i * 2]).toBeLessThan(20.5);
    }
  });

  it("samples the small line more densely and flags it", () => {
    const mask = rectMask(
      200,
      120,
      [
        [60, 5, 140, 25],
        [20, 50, 180, 110],
      ],
      40,
    );
    const p = sampleMask(mask, 2000, createRng(3));
    let fine = 0;
    for (let i = 0; i < p.count; i++) {
      const isFine = (p.xy[i * 2 + 1] ?? 0) < 40;
      expect(p.fine[i]).toBe(isFine ? 1 : 0);
      if (isFine) fine++;
    }
    const fineDensity = fine / (80 * 20);
    const mainDensity = (p.count - fine) / (160 * 60);
    expect(fineDensity / mainDensity).toBeGreaterThan(2);
  });

  it("is repeatable for a seed and empty for an empty mask", () => {
    const a = sampleMask(rect, 300, createRng(9));
    const b = sampleMask(rect, 300, createRng(9));
    expect(Array.from(a.xy)).toEqual(Array.from(b.xy));
    expect(sampleMask(rectMask(10, 10, []), 100, createRng(1)).count).toBe(0);
    expect(sampleMask(rect, 0, createRng(1)).count).toBe(0);
  });
});

describe("maskScale", () => {
  it("renders small boxes finer and huge boxes coarser", () => {
    expect(maskScale(359)).toBe(2.5);
    expect(maskScale(1100)).toBe(1);
    expect(maskScale(2400)).toBe(0.6);
    expect(maskScale(0)).toBe(1);
  });
});
