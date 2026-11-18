import { describe, expect, it } from "vitest";

import { blendLens, newLens, pixelFov, type BakedLens } from "./camera-blend";

const RAD = Math.PI / 180;
// The baked lens for a screen `h` tall: the notes' formula (a whole frame 1.25 times the screen, the
// screen the bottom window of it), 61.9275 degrees over the whole frame.
const baked = (h: number): BakedLens => ({ fov: 61.9275, fullHeight: 1.25 * h, offsetY: 0.25 * h });

describe("the lens between the pixel view and the baked one", () => {
  it("is the pixel camera's own field of view at 0 (the whole screen is the frame)", () => {
    const fov = pixelFov(900, 1000);
    expect(fov).toBeCloseTo(48.46, 1);
    const l = blendLens(1440, 900, fov, baked(900), 0, newLens());
    expect(l.fov).toBeCloseTo(fov, 9);
    expect(l.aspect).toBeCloseTo(1440 / 900, 9);
    expect(l.fullHeight).toBe(900);
    expect(l.offsetY).toBe(0);
  });

  it("is the baked lens at 1", () => {
    const l = blendLens(1440, 900, pixelFov(900, 1000), baked(900), 1, newLens());
    expect(l.fov).toBeCloseTo(61.9275, 9);
    expect(l.aspect).toBeCloseTo(1440 / (1.25 * 900), 9);
    expect(l.fullHeight).toBeCloseTo(1125, 9);
    expect(l.offsetY).toBeCloseTo(225, 9);
  });

  it("changes in one direction in between", () => {
    const fov = pixelFov(900, 1000);
    let lastFocal = Infinity;
    let lastOffset = -1;
    for (let k = 0; k <= 1.0001; k += 0.05) {
      const l = blendLens(1440, 900, fov, baked(900), k, newLens());
      const focal = l.fullHeight / (2 * Math.tan((l.fov * RAD) / 2));
      expect(focal).toBeLessThanOrEqual(lastFocal + 1e-9);
      expect(l.offsetY).toBeGreaterThanOrEqual(lastOffset);
      expect(l.fov).toBeGreaterThan(40);
      expect(l.fov).toBeLessThan(65);
      lastFocal = focal;
      lastOffset = l.offsetY;
    }
  });

  it("keeps the window on the screen: the offset plus the screen never passes the whole frame", () => {
    for (let k = 0; k <= 1.0001; k += 0.1) {
      const l = blendLens(390, 844, pixelFov(844, 1000), baked(844), k, newLens());
      expect(l.offsetY + 844).toBeLessThanOrEqual(l.fullHeight + 1e-6);
    }
  });
});
