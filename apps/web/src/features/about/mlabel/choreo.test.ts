import { describe, expect, it } from "vitest";

import { M_POINTS, M_SOLID } from "./assets";
import {
  CLOSE,
  closeParts,
  openScale,
  PLATE_START,
  quadMatrix,
  quadPoint,
  SCENE_END,
  sheetScale,
  SHORT_END,
  SHORT_START,
} from "./choreo";

describe("the close", () => {
  it("starts with the M's solid band over the whole screen and ends at the window's size", () => {
    for (const [vw, vh, mw, mh] of [
      [1440, 900, 456, 414],
      [1920, 1080, 547, 497],
      [390, 844, 242, 220],
    ] as const) {
      const open = openScale(vw, vh, mw, mh, M_SOLID, 0.48);
      // The band, scaled about the pivot, reaches past the top, the foot and the sides.
      expect((0.48 - M_SOLID.top) * mh * open).toBeGreaterThan(vh / 2);
      expect((M_SOLID.bottom - 0.48) * mh * open).toBeGreaterThan(vh / 2);
      expect((mw / 2) * open).toBeGreaterThan(vw / 2);
      expect(sheetScale(0, open)).toBeCloseTo(open);
      expect(sheetScale(1, open)).toBeCloseTo(1);
      expect(sheetScale(0.5, open)).toBeCloseTo(Math.sqrt(open));
    }
  });

  it("splits the scroll into the sheet, the short scene and the flat M, in that order", () => {
    expect(closeParts(0)).toEqual({ sheet: 0, short: 0, flat: 0 });
    expect(closeParts(CLOSE.sheet)).toEqual({ sheet: 1, short: 0, flat: 0 });
    expect(closeParts(CLOSE.short).short).toBe(1);
    expect(closeParts(1)).toEqual({ sheet: 1, short: 1, flat: 1 });
  });
});

describe("the clock", () => {
  it("has five plates in order, and the short scene is the tail of the long one", () => {
    expect(PLATE_START).toHaveLength(5);
    expect([...PLATE_START].sort((a, b) => a - b)).toEqual([...PLATE_START]);
    expect(SHORT_START).toBe(PLATE_START[4]);
    expect(SHORT_END).toBeGreaterThan(SHORT_START);
    expect(SCENE_END).toBeGreaterThan(SHORT_END);
  });
});

describe("the M", () => {
  it("is symmetric and solid across its middle band", () => {
    expect(M_POINTS).toHaveLength(12);
    for (const [x, y] of M_POINTS) {
      expect(M_POINTS.some(([mx, my]) => Math.abs(mx - (1 - x)) < 1e-6 && my === y)).toBe(true);
    }
    expect(M_SOLID.bottom).toBeGreaterThan(M_SOLID.top);
  });
});

describe("laying the last plate on the logo's M", () => {
  it("puts the four corners of the box on the four points", () => {
    const to = [
      [310, 210],
      [520, 205],
      [524, 460],
      [308, 420],
    ] as const;
    const matrix = quadMatrix(400, 360, to);
    const from = [
      [0, 0],
      [400, 0],
      [400, 360],
      [0, 360],
    ] as const;
    from.forEach(([x, y], i) => {
      const [u, v] = quadPoint(matrix, x, y);
      expect(u).toBeCloseTo(to[i]?.[0] ?? 0, 2);
      expect(v).toBeCloseTo(to[i]?.[1] ?? 0, 2);
    });
  });
});
