import { describe, expect, it } from "vitest";

import {
  columnCount,
  justified,
  layoutGrid,
  masonry,
  neighbour,
  nextSlice,
  ratio,
  sizeFor,
  staggerDelay,
  type Box,
} from "./layout";

describe("ratio and columns", () => {
  it("treats a broken size as a square", () => {
    expect(ratio(1600, 900)).toBeCloseTo(16 / 9);
    expect(ratio(0, 900)).toBe(1);
    expect(ratio(900, -1)).toBe(1);
  });

  it("fits as many columns as the width allows, and at least one", () => {
    expect(columnCount(1000, 300, 10)).toBe(3);
    expect(columnCount(1000, 600, 10)).toBe(1);
    expect(columnCount(100, 300, 10)).toBe(1);
    expect(columnCount(0, 300, 10)).toBe(1);
  });
});

describe("masonry", () => {
  it("puts each picture under the shortest column and keeps inside the width", () => {
    const { boxes, height } = masonry([1, 2, 1, 1], 310, 2, 10);
    expect(boxes).toHaveLength(4);
    expect(boxes[0]).toEqual({ x: 0, y: 0, w: 150, h: 150 });
    // The second column holds the wide one, so the third picture goes under the first.
    expect(boxes[1]).toEqual({ x: 160, y: 0, w: 150, h: 75 });
    expect(boxes[2]?.x).toBe(160);
    expect(boxes[2]?.y).toBe(85);
    expect(boxes[3]?.x).toBe(0);
    expect(boxes[3]?.y).toBe(160);
    for (const b of boxes) expect(b.x + b.w).toBeLessThanOrEqual(310);
    expect(height).toBe(Math.max(...boxes.map((b) => b.y + b.h)));
  });

  it("returns an empty grid for no pictures", () => {
    expect(masonry([], 500, 3, 8)).toEqual({ boxes: [], height: 0 });
  });
});

describe("justified", () => {
  it("fills each full row to the width exactly", () => {
    const ratios = Array.from({ length: 12 }, () => 16 / 9);
    const { boxes } = justified(ratios, 1000, 200, 8);
    const rows = new Map<number, Box[]>();
    for (const b of boxes) rows.set(b.y, [...(rows.get(b.y) ?? []), b]);
    const full = [...rows.values()].slice(0, -1);
    expect(full.length).toBeGreaterThan(0);
    for (const row of full) {
      const last = row[row.length - 1]!;
      expect(last.x + last.w).toBe(1000);
      expect(new Set(row.map((b) => b.h)).size).toBe(1);
    }
  });

  it("does not blow up a short last row", () => {
    const { boxes } = justified([16 / 9], 1000, 200, 8);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.h).toBe(200);
    expect(boxes[0]?.w).toBe(356);
  });

  it("keeps every picture's shape", () => {
    const ratios = [1.78, 1, 2.56, 0.75, 1.78, 1.78, 1];
    const { boxes } = justified(ratios, 900, 180, 6);
    boxes.forEach((b, i) => {
      expect(b.w / b.h).toBeCloseTo(ratios[i]!, 1);
    });
  });

  it("returns an empty grid for no pictures", () => {
    expect(justified([], 500, 200, 8)).toEqual({ boxes: [], height: 0 });
  });
});

describe("layoutGrid and sizeFor", () => {
  it("gives a phone two columns", () => {
    expect(sizeFor(390, 300, "masonry", 10)).toBe(190);
    const { boxes } = layoutGrid([1, 1, 1, 1], {
      layout: "masonry",
      width: 390,
      gap: 10,
      size: 300,
    });
    expect(new Set(boxes.map((b) => b.x)).size).toBe(2);
  });

  it("keeps the wanted size on a wide screen", () => {
    expect(sizeFor(1440, 300, "masonry", 10)).toBe(300);
    expect(sizeFor(1440, 260, "justified", 10)).toBe(260);
  });
});

describe("arrow key moves", () => {
  const boxes: Box[] = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 110, y: 0, w: 100, h: 60 },
    { x: 110, y: 70, w: 100, h: 100 },
    { x: 0, y: 110, w: 100, h: 100 },
  ];

  it("steps through the order sideways", () => {
    expect(neighbour(boxes, 1, "left")).toBe(0);
    expect(neighbour(boxes, 1, "right")).toBe(2);
    expect(neighbour(boxes, 0, "left")).toBe(-1);
    expect(neighbour(boxes, 3, "right")).toBe(-1);
  });

  it("goes up and down to the nearest picture in that direction", () => {
    expect(neighbour(boxes, 3, "up")).toBe(0);
    expect(neighbour(boxes, 2, "up")).toBe(1);
    expect(neighbour(boxes, 0, "down")).toBe(3);
    expect(neighbour(boxes, 2, "down")).toBe(-1);
  });
});

describe("slices and staggering", () => {
  it("builds a slice at a time and stops at the total", () => {
    expect(nextSlice(36, 100)).toBe(72);
    expect(nextSlice(72, 80)).toBe(80);
    expect(nextSlice(10, 100, 5)).toBe(15);
  });

  it("delays each arrival a little more, with a cap", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(165);
    expect(staggerDelay(99)).toBe(660);
    expect(staggerDelay(-4)).toBe(0);
  });
});
