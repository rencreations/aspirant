import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/lib/math";

import {
  GAP_MAX,
  GAP_MIN,
  MAX_RATIO,
  MIN_RATIO,
  ROW_H_MAX,
  ROW_H_MIN,
  firstScreenTiles,
  metricsFor,
  needsRebuild,
  pickSize,
  planRows,
  planWall,
  tileRatio,
  type FlowPart,
} from "./math";

/** A mix of shapes like the real rooms: mostly 16 by 9, some squares, some tall, a few very wide or very tall. */
function shapes(n: number, seed = 7): number[] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const roll = rand();
    if (roll < 0.55) return 16 / 9;
    if (roll < 0.75) return 1;
    if (roll < 0.9) return 0.5 + rand() * 0.4;
    if (roll < 0.97) return 2.2 + rand() * 1.5;
    return roll < 0.985 ? 0.25 : 5.5;
  });
}

describe("tileRatio", () => {
  it("is the picture's own ratio, kept inside the safety limits", () => {
    expect(tileRatio(1920, 1080)).toBeCloseTo(16 / 9, 5);
    expect(tileRatio(1000, 1000)).toBe(1);
    expect(tileRatio(100, 10_000)).toBe(MIN_RATIO);
    expect(tileRatio(10_000, 100)).toBe(MAX_RATIO);
    expect(tileRatio(0, 0)).toBe(1);
  });
});

describe("metricsFor", () => {
  it("grows with the wall between a floor and a ceiling", () => {
    const phone = metricsFor(358);
    const laptop = metricsFor(1350);
    const wide = metricsFor(3000);
    expect(phone.rowH).toBe(ROW_H_MIN);
    expect(laptop.rowH).toBeGreaterThan(ROW_H_MIN);
    expect(laptop.rowH).toBeLessThan(ROW_H_MAX);
    expect(wide.rowH).toBe(ROW_H_MAX);
    for (const m of [phone, laptop, wide]) {
      expect(m.gap).toBeGreaterThanOrEqual(GAP_MIN);
      expect(m.gap).toBeLessThanOrEqual(GAP_MAX);
    }
  });

  it("is planned again for a new width, and for nothing else", () => {
    const m = metricsFor(1350);
    expect(needsRebuild(null, 1350)).toBe(true);
    expect(needsRebuild(m, 1350)).toBe(false);
    expect(needsRebuild(m, 1350.4)).toBe(false);
    expect(needsRebuild(m, 1320)).toBe(true);
  });
});

describe("planRows", () => {
  for (const vw of [358, 700, 1350, 1820, 2400]) {
    const m = metricsFor(vw);
    const ratios = shapes(300, vw);
    const rows = planRows(ratios, m);

    it(`cuts every picture into rows once and in order (${vw} wide)`, () => {
      let next = 0;
      for (const row of rows) {
        expect(row.start).toBe(next);
        expect(row.count).toBeGreaterThan(0);
        expect(row.widths).toHaveLength(row.count);
        next += row.count;
      }
      expect(next).toBe(ratios.length);
    });

    it(`fills the width exactly in every row but the last (${vw} wide)`, () => {
      for (const row of rows.slice(0, -1)) {
        const used = row.widths.reduce((a, b) => a + b, 0) + m.gap * (row.count - 1);
        expect(used).toBe(m.vw);
      }
      const last = rows.at(-1);
      if (last) {
        const used = last.widths.reduce((a, b) => a + b, 0) + m.gap * (last.count - 1);
        expect(used).toBeLessThanOrEqual(m.vw);
      }
    });

    it(`keeps each row near the target height and each picture near its own shape (${vw} wide)`, () => {
      for (const row of rows.slice(0, -1)) {
        // A wide single picture is shorter than the target, never much taller.
        expect(row.height).toBeLessThanOrEqual(m.rowH * 1.6);
        expect(row.height).toBeGreaterThan(m.rowH * 0.3);
        for (let k = 0; k < row.count; k++) {
          const own = ratios[row.start + k] ?? 1;
          const drawn = (row.widths[k] ?? 1) / row.height;
          // Whole pixels move a tile's width by a pixel and its height by half a pixel, which
          // moves the width by half the ratio: the picture is cropped by that much at most.
          expect(Math.abs(drawn - own) * row.height).toBeLessThanOrEqual(own * 0.5 + 1.01);
        }
      }
    });
  }

  it("never stretches a short last row: it keeps the target height and stands at the left", () => {
    const m = metricsFor(1350);
    const rows = planRows([16 / 9, 16 / 9], m);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.height).toBe(m.rowH);
    const used = (rows[0]?.widths ?? []).reduce((a, b) => a + b, 0) + m.gap;
    expect(used).toBeLessThan(m.vw);
  });

  it("gives a picture wider than the wall a row of its own, shorter than the target", () => {
    const m = metricsFor(358);
    const rows = planRows([5.5, 5.5], m);
    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.widths[0]).toBe(m.vw);
    expect(rows[0]?.height).toBeLessThan(m.rowH);
  });

  it("plans a slice of the list with the pictures' own indexes", () => {
    const m = metricsFor(1350);
    const ratios = shapes(40);
    const rows = planRows(ratios, m, 10, 25);
    expect(rows[0]?.start).toBe(10);
    const end = rows.reduce((n, row) => n + row.count, 10);
    expect(end).toBe(25);
  });

  it("is empty for nothing", () => {
    expect(planRows([], metricsFor(1350))).toEqual([]);
  });
});

describe("planWall", () => {
  const m = metricsFor(1350);
  const ratios = shapes(60);
  const parts: FlowPart[] = [
    { id: "a", name: "A", start: 0, count: 25 },
    { id: "b", name: "B", start: 25, count: 0 },
    { id: "c", name: "C", start: 25, count: 35 },
  ];

  it("plans each group on its own and leaves an empty group out", () => {
    const blocks = planWall(ratios, parts, m);
    expect(blocks.map((b) => b.part?.id)).toEqual(["a", "c"]);
    for (const block of blocks) {
      const part = block.part;
      const first = block.rows[0];
      expect(first?.start).toBe(part?.start);
      const covered = block.rows.reduce((n, row) => n + row.count, 0);
      expect(covered).toBe(part?.count);
    }
  });

  it("is one block with no part when there are no groups", () => {
    const blocks = planWall(ratios, null, m);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.part).toBeNull();
    expect(planWall([], null, m)).toEqual([]);
  });
});

describe("firstScreenTiles", () => {
  const m = metricsFor(1350);
  const ratios = shapes(200);

  it("takes the first rows that start on the screen, whole rows, up to the limit", () => {
    const tiles = firstScreenTiles(ratios, null, m, 300, 900, 100);
    expect(tiles.length).toBeGreaterThan(3);
    expect(tiles.map((t) => t.index)).toEqual(tiles.map((_, i) => i));
    const rows = planRows(ratios, m);
    const reach = rows.slice(0, 4).reduce((n, row) => n + row.count, 0);
    expect(tiles.length).toBeLessThanOrEqual(reach);
    expect(firstScreenTiles(ratios, null, m, 300, 900, 5)).toHaveLength(5);
  });

  it("counts a group's heading against the screen", () => {
    const parts: FlowPart[] = [
      { id: "a", name: "A", start: 0, count: 100 },
      { id: "b", name: "B", start: 100, count: 100 },
    ];
    const flat = firstScreenTiles(ratios, null, m, 300, 900, 100);
    const grouped = firstScreenTiles(ratios, parts, m, 300, 900, 100);
    expect(grouped.length).toBeLessThanOrEqual(flat.length);
  });

  it("gives each tile its own size, which is the size the page draws", () => {
    const rows = planRows(ratios, m);
    const tiles = firstScreenTiles(ratios, null, m, 300, 900, 100);
    const first = rows[0];
    expect(tiles[0]).toEqual({ index: 0, w: first?.widths[0], h: first?.height });
  });

  it("is empty when the head already fills the screen", () => {
    expect(firstScreenTiles(ratios, null, m, 2000, 900, 100)).toEqual([]);
  });
});

describe("pickSize", () => {
  it("asks for the small size while it is sharp enough, and the preview otherwise", () => {
    expect(pickSize(436, 245, 1)).toBe("t");
    expect(pickSize(436, 245, 2)).toBe("p");
    expect(pickSize(300, 300, 1.5)).toBe("t");
    expect(pickSize(700, 400, 1)).toBe("p");
  });
});
