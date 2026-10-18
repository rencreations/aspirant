import { describe, expect, it } from "vitest";

import { cameraAt, layoutFor, LOGO_H, LOGO_W, outsideRectPath, PIVOT } from "./logo-geometry";

describe("logo geometry", () => {
  const sizes: ReadonlyArray<readonly [number, number]> = [
    [1440, 900],
    [390, 844],
    [844, 390],
    [2560, 1080],
    [3440, 1440],
  ];

  it("fits the logo inside the viewport at rest", () => {
    for (const [vw, vh] of sizes) {
      const l = layoutFor(vw, vh);
      expect(l.width).toBeLessThanOrEqual(vw);
      expect(l.height).toBeLessThan(vh * 0.5);
      expect(l.width / l.height).toBeCloseTo(LOGO_W / LOGO_H, 3);
    }
  });

  it("rests at u = 0 with the pivot where the layout says", () => {
    const l = layoutFor(1440, 900);
    const c = cameraAt(0, l, 1440, 900);
    expect(c.k).toBeCloseTo(l.k0, 6);
    expect(c.ox).toBeCloseTo(l.o0.x, 6);
    expect(c.oy).toBeCloseTo(l.o0.y, 6);
  });

  it("opens at u = 1 with a letter window around the whole viewport", () => {
    for (const [vw, vh] of sizes) {
      const l = layoutFor(vw, vh);
      const c = cameraAt(1, l, vw, vh);
      expect(c.ox).toBeCloseTo(vw / 2, 6);
      expect(c.oy).toBeCloseTo(vh / 2, 6);
      // The inscribed circle of the window, in pixels, must contain the viewport corners.
      expect(PIVOT.r * c.k).toBeGreaterThanOrEqual(Math.hypot(vw, vh) / 2);
    }
  });

  it("zooms monotonically", () => {
    const l = layoutFor(1440, 900);
    let last = 0;
    for (let u = 0; u <= 1; u += 0.1) {
      const k = cameraAt(u, l, 1440, 900).k;
      expect(k).toBeGreaterThan(last);
      last = k;
    }
  });

  it("builds an outside path that starts with a rectangle covering the viewport", () => {
    const l = layoutFor(1440, 900);
    const c = cameraAt(0.4, l, 1440, 900);
    const d = outsideRectPath(c, 1440, 900);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("Z");
  });
});
