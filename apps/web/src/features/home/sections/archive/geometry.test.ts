import { describe, expect, it } from "vitest";

import { DWELL, ROOMS, STEPS, coverX, lit, nearest, restU, stripGeo, tourP } from "./geometry";

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [1440, 900],
  [1706, 950],
  [1366, 768],
  [390, 844],
  [820, 1180],
  [2560, 1440],
];

describe("the strip", () => {
  it("has ten rooms and nine steps", () => {
    expect(ROOMS).toBe(10);
    expect(STEPS).toBe(9);
  });

  it("keeps the slide share between 0 and 1 and the drone over the screen at every size", () => {
    for (const [w, h] of SIZES) {
      const g = stripGeo(w, h);
      expect(g.k, `${w}x${h}`).toBeGreaterThan(0);
      expect(g.k, `${w}x${h}`).toBeLessThan(1);
      expect(g.x0).toBeGreaterThan(0.1 * w);
      expect(g.x1).toBeLessThan(0.9 * w);
      // The drone hovers below the bar and above the covers, and the covers stay on the screen.
      expect(g.droneY - g.droneH / 2, `${w}x${h}`).toBeGreaterThan(0.12 * h);
      expect(g.top).toBeGreaterThan(g.droneY + g.droneH / 2);
      expect(g.yc + g.s / 2).toBeLessThan(0.8 * h);
    }
  });

  it("puts the drone exactly over the cover it lights when the light is on the tour's position", () => {
    for (const [w, h] of SIZES) {
      const g = stripGeo(w, h);
      for (let i = 0; i <= STEPS; i += 1) {
        // The drone's x at tour position p is x0 + p (x1 - x0) / 9: the cover i is under it at p = i.
        const droneX = g.x0 + (i * (g.x1 - g.x0)) / STEPS;
        expect(coverX(g, i, i)).toBeCloseTo(droneX, 6);
      }
    }
  });

  it("shows the first cover at the start and the last at the end", () => {
    for (const [w, h] of SIZES) {
      const g = stripGeo(w, h);
      expect(coverX(g, 0, 0)).toBeCloseTo(g.x0, 6);
      expect(coverX(g, STEPS, STEPS)).toBeCloseTo(g.x1, 6);
    }
  });
});

describe("the tour", () => {
  it("runs from 0 to 9, never back, with a rest over every cover", () => {
    let last = 0;
    for (let i = 0; i <= 1000; i += 1) {
      const p = tourP(i / 1000);
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      last = p;
    }
    expect(tourP(0)).toBe(0);
    expect(tourP(1)).toBe(STEPS);
    expect(tourP(-3)).toBe(0);
    expect(tourP(4)).toBe(STEPS);
    for (let i = 0; i < STEPS; i += 1) {
      const a = tourP((i + 0.02) / STEPS);
      const b = tourP((i + DWELL - 0.02) / STEPS);
      expect(a).toBe(i);
      expect(b).toBe(i);
    }
  });

  it("rests over cover i at restU(i)", () => {
    for (let i = 0; i <= STEPS; i += 1) expect(tourP(restU(i))).toBeCloseTo(i, 6);
  });

  it("lights the cover the light is on, and shares the light while it moves", () => {
    expect(lit(3, 3)).toBe(1);
    expect(lit(3, 4)).toBe(0);
    expect(lit(3.5, 3)).toBeCloseTo(lit(3.5, 4), 9);
    expect(lit(3.5, 3)).toBeLessThan(0.5);
    for (let q = 0; q <= STEPS; q += 0.1) {
      for (let i = 0; i <= STEPS; i += 1) {
        const v = lit(q, i);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(nearest(-2)).toBe(0);
    expect(nearest(3.4)).toBe(3);
    expect(nearest(3.6)).toBe(4);
    expect(nearest(20)).toBe(STEPS);
  });
});
