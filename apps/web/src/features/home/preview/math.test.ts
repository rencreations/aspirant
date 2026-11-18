import { describe, expect, it } from "vitest";

import { flipBetween, isOnScreen, wrapIndex } from "./math";

describe("flipBetween", () => {
  it("is nothing for the same box", () => {
    const box = { x: 10, y: 20, w: 300, h: 200 };
    expect(flipBetween(box, box)).toEqual({ dx: 0, dy: 0, scale: 1 });
  });

  it("puts the end box's centre on the start box's centre and scales by width", () => {
    const start = { x: 100, y: 100, w: 200, h: 112 };
    const end = { x: 300, y: 50, w: 800, h: 450 };
    const t = flipBetween(start, end);
    expect(t.scale).toBeCloseTo(0.25, 9);
    // About the end's centre: the centre moves by (dx, dy) to the start's centre.
    expect(end.x + end.w / 2 + t.dx).toBeCloseTo(start.x + start.w / 2, 9);
    expect(end.y + end.h / 2 + t.dy).toBeCloseTo(start.y + start.h / 2, 9);
  });
});

describe("wrapIndex", () => {
  it("wraps forward and back", () => {
    expect(wrapIndex(17, 1, 18)).toBe(0);
    expect(wrapIndex(0, -1, 18)).toBe(17);
    expect(wrapIndex(3, 2, 18)).toBe(5);
    expect(wrapIndex(3, -40, 18)).toBe(17);
  });

  it("is 0 for an empty list", () => {
    expect(wrapIndex(2, 1, 0)).toBe(0);
  });
});

describe("isOnScreen", () => {
  it("is true for a box inside and false for one outside", () => {
    expect(isOnScreen({ x: 100, y: 100, w: 200, h: 100 }, 1440, 900)).toBe(true);
    expect(isOnScreen({ x: 1500, y: 100, w: 200, h: 100 }, 1440, 900)).toBe(false);
  });

  it("needs a quarter of the box", () => {
    expect(isOnScreen({ x: 1400, y: 100, w: 200, h: 100 }, 1440, 900)).toBe(false);
    expect(isOnScreen({ x: 1300, y: 100, w: 200, h: 100 }, 1440, 900)).toBe(true);
  });
});
