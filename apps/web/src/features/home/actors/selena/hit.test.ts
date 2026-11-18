import { describe, expect, it } from "vitest";

import { capsuleHit, distToSegment } from "./hit";

describe("distToSegment", () => {
  it("is the distance to the nearest point of the segment", () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3, 9);
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5, 9);
    expect(distToSegment(14, -3, 0, 0, 10, 0)).toBeCloseTo(5, 9);
  });

  it("a segment of no length is a point", () => {
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5, 9);
  });
});

describe("capsuleHit", () => {
  it("hits inside the radius with the depth and the bias, misses outside", () => {
    expect(capsuleHit(5, 2, 0, 0, 10, 0, 3, 100, 7)).toBe(107);
    expect(capsuleHit(5, 4, 0, 0, 10, 0, 3, 100, 7)).toBeNull();
  });
});
