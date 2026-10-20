import { describe, expect, it } from "vitest";

import {
  clampPan,
  clampZoom,
  fitScale,
  maxZoom,
  naturalZoom,
  wheelZoom,
  zoomAround,
  zoomPercent,
  type Box,
} from "./image-viewer-math";

const wide: Box = { cw: 1000, ch: 600, iw: 2000, ih: 1200 };
const small: Box = { cw: 1000, ch: 600, iw: 400, ih: 300 };

describe("fit and zoom limits", () => {
  it("fits a big picture to the stage and never stretches a small one", () => {
    expect(fitScale(wide)).toBeCloseTo(0.5);
    expect(fitScale(small)).toBe(1);
    expect(fitScale({ cw: 0, ch: 0, iw: 10, ih: 10 })).toBe(1);
  });

  it("knows where the natural size is and how far it can zoom", () => {
    expect(naturalZoom(wide)).toBeCloseTo(2);
    expect(naturalZoom(small)).toBe(1);
    expect(maxZoom(wide)).toBeCloseTo(6);
    expect(maxZoom(small)).toBe(4);
    expect(clampZoom(0.2, wide)).toBe(1);
    expect(clampZoom(99, wide)).toBeCloseTo(6);
  });

  it("labels the zoom as a percentage of the natural size", () => {
    expect(zoomPercent(1, wide)).toBe(50);
    expect(zoomPercent(2, wide)).toBe(100);
    expect(zoomPercent(1, small)).toBe(100);
  });
});

describe("pan", () => {
  it("keeps the picture in the middle while it is smaller than the stage", () => {
    expect(clampPan(120, -80, 1, wide)).toEqual([0, 0]);
    expect(clampPan(50, 50, 1, small)).toEqual([0, 0]);
  });

  it("lets it move only as far as its edges allow once it is bigger", () => {
    // At 2x the picture is 2000 by 1200 on a 1000 by 600 stage: 500 and 300 either way.
    expect(clampPan(900, -900, 2, wide)).toEqual([500, -300]);
    expect(clampPan(100, 40, 2, wide)).toEqual([100, 40]);
  });
});

describe("zooming around a point", () => {
  it("keeps the point under the pointer where it is", () => {
    const start = { z: 2, x: 100, y: 0 };
    const px = 200;
    const py = 50;
    const next = zoomAround(start, 4, px, py, wide);
    // The image point under the pointer, in image pixels, before and after.
    const s0 = fitScale(wide) * start.z;
    const s1 = fitScale(wide) * next.z;
    expect((px - start.x) / s0).toBeCloseTo((px - next.x) / s1, 5);
    expect((py - start.y) / s0).toBeCloseTo((py - next.y) / s1, 5);
  });

  it("returns to the middle at fit", () => {
    const next = zoomAround({ z: 3, x: 400, y: 200 }, 1, 0, 0, wide);
    expect(next).toEqual({ z: 1, x: 0, y: 0 });
  });

  it("does not go past the limits", () => {
    expect(zoomAround({ z: 1, x: 0, y: 0 }, 50, 0, 0, wide).z).toBeCloseTo(maxZoom(wide));
    expect(zoomAround({ z: 2, x: 0, y: 0 }, 0.1, 0, 0, wide).z).toBe(1);
  });
});

describe("the wheel", () => {
  it("zooms in when it turns up and out when it turns down, in smaller steps for a pinch", () => {
    expect(wheelZoom(2, -100, false)).toBeGreaterThan(2);
    expect(wheelZoom(2, 100, false)).toBeLessThan(2);
    expect(Math.abs(wheelZoom(2, -10, true) - 2)).toBeGreaterThan(
      Math.abs(wheelZoom(2, -10, false) - 2),
    );
  });
});
