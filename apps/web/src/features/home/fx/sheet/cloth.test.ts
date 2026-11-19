import { describe, expect, it } from "vitest";

import { COLS, ROWS, VERTS, edgeAt, fillGrid, gridIndex, newGrid, newShape } from "./cloth";

describe("the sheet's shape", () => {
  it("has the vertices and triangles the grid says", () => {
    const g = fillGrid(newShape(), newGrid());
    expect(g.pos.length).toBe(VERTS * 3);
    const idx = gridIndex();
    expect(idx.length).toBe(COLS * (ROWS + 2) * 6);
    expect(Math.max(...idx)).toBe(VERTS - 1);
  });

  it("holds the edge at the grip and trails it above away from the grip", () => {
    const s = newShape();
    s.gripX = 0.2;
    s.gripY = 0.1;
    s.lag = 0.3;
    expect(edgeAt(s, 0.2)).toBeCloseTo(0.1, 6);
    expect(edgeAt(s, 1.5)).toBeGreaterThan(0.35);
    expect(edgeAt(s, -1.5)).toBeGreaterThan(0.35);
  });

  it("is flat, uniform paper when calm", () => {
    const s = newShape();
    s.fold = 0;
    s.gripY = -1.4;
    const g = fillGrid(s, newGrid());
    for (let i = 0; i < VERTS; i += 1) {
      expect(Math.abs(g.pos[i * 3 + 2]!)).toBe(0);
      if (!g.ink[i]) expect(g.shade[i]).toBeCloseTo(0.5, 6);
    }
  });

  it("covers the screen when the edge is below it and the top above", () => {
    const s = newShape();
    s.gripY = -1.3;
    s.lag = 0;
    s.top = 3;
    const g = fillGrid(s, newGrid());
    let low = 9;
    let high = -9;
    for (let i = 0; i < VERTS; i += 1) {
      low = Math.min(low, g.pos[i * 3 + 1]!);
      high = Math.max(high, g.pos[i * 3 + 1]!);
    }
    expect(low).toBeLessThanOrEqual(-1.3 + 1e-6);
    expect(high).toBeGreaterThan(1.5);
  });

  it("moves continuously with the grip", () => {
    const s = newShape();
    const a = fillGrid({ ...s, gripY: 0.2, fold: 0.6, phase: 0.3 }, newGrid());
    const pa = Float32Array.from(a.pos);
    const b = fillGrid({ ...s, gripY: 0.21, fold: 0.6, phase: 0.3 }, newGrid());
    for (let i = 0; i < pa.length; i += 1) expect(Math.abs(b.pos[i]! - pa[i]!)).toBeLessThan(0.02);
  });
});
