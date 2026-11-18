import { describe, expect, it } from "vitest";

import { inQuad } from "./quad";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("a point in a cover", () => {
  it("is in a square, either way round, and out of it", () => {
    expect(inQuad(SQUARE, 5, 5)).toBe(true);
    expect(inQuad([...SQUARE].reverse(), 5, 5)).toBe(true);
    expect(inQuad(SQUARE, 11, 5)).toBe(false);
    expect(inQuad(SQUARE, 5, -0.1)).toBe(false);
  });

  it("works for a cover that is turned and foreshortened", () => {
    const skew = [
      { x: 0, y: 0 },
      { x: 8, y: 2 },
      { x: 9, y: 11 },
      { x: -1, y: 9 },
    ];
    expect(inQuad(skew, 4, 5)).toBe(true);
    expect(inQuad(skew, 9, 1)).toBe(false);
  });

  it("is false for a quad that is not four corners", () => {
    expect(inQuad([{ x: 0, y: 0 }], 0, 0)).toBe(false);
  });
});
