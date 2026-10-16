import { describe, expect, it } from "vitest";

import { canvasDpr, particleBudget, wordShare } from "./budget";
import { WORD_SHARE, WORD_SHARE_SMALL } from "./constants";

const desktop = { coarse: false, cores: 8 };
const touch = { coarse: true, cores: 8 };

describe("particleBudget", () => {
  it("scales with area on desktop between 5k and 12k", () => {
    expect(particleBudget({ width: 1440, height: 900, ...desktop })).toBeCloseTo(10_109, -1);
    expect(particleBudget({ width: 800, height: 600, ...desktop })).toBe(5000);
    expect(particleBudget({ width: 3440, height: 1440, ...desktop })).toBe(12_000);
    expect(particleBudget({ width: 5120, height: 1440, ...desktop })).toBe(12_000);
  });

  it("keeps phones near 3k in both orientations", () => {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [430, 932],
    ] as const) {
      const n = particleBudget({ width, height, ...touch });
      expect(n).toBeGreaterThanOrEqual(3200);
      expect(n).toBeLessThanOrEqual(3600);
    }
  });

  it("puts tablets between phones and desktops", () => {
    const n = particleBudget({ width: 820, height: 1180, ...touch });
    expect(n).toBeGreaterThan(3600);
    expect(n).toBeLessThanOrEqual(7000);
  });

  it("gives weak CPUs a quarter fewer", () => {
    const strong = particleBudget({ width: 1440, height: 900, coarse: false, cores: 8 });
    const weak = particleBudget({ width: 1440, height: 900, coarse: false, cores: 4 });
    expect(weak).toBe(Math.round(strong * 0.75));
  });

  it("survives empty viewports", () => {
    expect(particleBudget({ width: 0, height: 0, ...desktop })).toBe(5000);
  });
});

describe("canvasDpr", () => {
  it("caps the pixel ratio at 2, or 1.5 on weak CPUs", () => {
    expect(canvasDpr(3, 8, 390, 844)).toBe(2);
    expect(canvasDpr(1.25, 8, 1440, 900)).toBe(1.25);
    expect(canvasDpr(3, 4, 390, 844)).toBe(1.5);
    expect(canvasDpr(0, 0, 1440, 900)).toBe(1);
  });

  it("keeps the backing store under the pixel budget on very large screens", () => {
    expect(canvasDpr(2, 8, 1440, 900)).toBe(2);
    const big = canvasDpr(2, 8, 2560, 1440);
    expect(big).toBeLessThan(2);
    expect(2560 * 1440 * big * big).toBeLessThanOrEqual(6_000_001);
    expect(canvasDpr(1, 8, 3440, 1440)).toBe(1);
    expect(canvasDpr(1, 8, 7680, 2160)).toBe(0.75);
  });
});

describe("wordShare", () => {
  it("gives the letters a larger share of small budgets", () => {
    expect(wordShare(3200)).toBe(WORD_SHARE_SMALL);
    expect(wordShare(10_000)).toBe(WORD_SHARE);
  });
});
