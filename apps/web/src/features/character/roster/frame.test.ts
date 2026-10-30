import { describe, expect, it } from "vitest";

import { frameOf, inset, trimOf, type Pt } from "./frame";
import { SEAMS, SLASH, SLOTS } from "./layout";
import { SLASH_ART } from "./slash";

const area = (pts: readonly Pt[]) =>
  Math.abs(
    pts.reduce((sum, [x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length] ?? [x, y];
      return sum + (x * ny - nx * y);
    }, 0) / 2,
  );

describe("the frame of a panel", () => {
  it("is nested: the bevel holds the line and the line holds the picture", () => {
    for (const s of SLOTS) {
      const f = frameOf(s);
      expect(area(f.outer)).toBeGreaterThan(area(f.line));
      expect(area(f.line)).toBeGreaterThan(area(f.face));
      expect(f.face).toHaveLength(f.outer.length);
    }
  });

  it("moves each side in by the same distance", () => {
    const square: Pt[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(inset(square, 1)).toEqual([
      [1, 1],
      [9, 1],
      [9, 9],
      [1, 9],
    ]);
  });

  it("keeps the trim inside the box", () => {
    for (const s of SLOTS) {
      const f = frameOf(s);
      const t = trimOf(f);
      expect(t.bar.x).toBeGreaterThan(0);
      expect(t.bar.x + t.bar.w).toBeLessThan(f.w + 1);
      expect(t.screws).toHaveLength(2);
    }
  });
});

describe("the slash and the seams", () => {
  it("runs on the line between Obsidia and Selena", () => {
    const o = SLOTS.find((s) => s.slug === "obsidia");
    const s = SLOTS.find((x) => x.slug === "selena");
    expect(SLASH.x).toBeGreaterThan(o?.x2 ?? Infinity);
    expect(SLASH.x).toBeLessThan(s?.x2 ?? 0);
    expect(SLASH_ART.body.startsWith("M")).toBe(true);
    expect(SLASH_ART.cracks.length).toBeGreaterThan(200);
  });

  it("has one seam for each of the other four pairs", () => {
    expect(new Set(SEAMS.map((s) => s.pair)).size).toBe(4);
    for (const s of SEAMS) expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeGreaterThan(80);
  });
});
