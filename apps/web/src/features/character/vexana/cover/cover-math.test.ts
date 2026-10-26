import { describe, expect, it } from "vitest";

import { RISE_START_SCALE, riseRadius, riseScale } from "./cover-math";

describe("riseScale", () => {
  it("starts with a padding and ends at full size", () => {
    expect(riseScale(0)).toBeCloseTo(RISE_START_SCALE, 6);
    expect(riseScale(1)).toBe(1);
  });

  it("only grows", () => {
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const s = riseScale(i / 100);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it("never leaves the bottom of the screen uncovered", () => {
    // The panel's bottom edge is (1 - p) + scale screens down: it must reach the bottom edge, 1.
    for (let i = 0; i <= 1000; i++) {
      const p = i / 1000;
      expect(riseScale(p)).toBeGreaterThanOrEqual(p);
    }
  });
});

describe("riseRadius", () => {
  it("is the full radius at the start and square from 60 percent on", () => {
    expect(riseRadius(0, 72)).toBe(72);
    expect(riseRadius(0.6, 72)).toBe(0);
    expect(riseRadius(0.9, 72)).toBe(0);
    expect(riseRadius(1, 72)).toBe(0);
  });

  it("changes slowly first and quickly later (an exponential curve)", () => {
    const early = riseRadius(0, 72) - riseRadius(0.12, 72);
    const late = riseRadius(0.42, 72) - riseRadius(0.54, 72);
    expect(late).toBeGreaterThan(early * 4);
  });

  it("matches R * (1 - (p / 0.6)^3)", () => {
    for (const p of [0.1, 0.25, 0.4, 0.55]) {
      expect(riseRadius(p, 60)).toBeCloseTo(60 * (1 - Math.pow(p / 0.6, 3)), 8);
    }
  });
});
