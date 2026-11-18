import { describe, expect, it } from "vitest";

import { newRoutePlace, ROUTE_END, routeAt } from "./drone-route";

const VIEW = { w: 1440, h: 900 };

describe("the drone's route", () => {
  it("starts where the intro ends (joint J0)", () => {
    const p = routeAt(0, VIEW, newRoutePlace());
    expect(p.x).toBeCloseTo(0.3 * 1440, 6);
    expect(p.y).toBeCloseTo(-0.22 * 900, 6);
    expect(p.height).toBeCloseTo(0.17 * 900, 6);
    expect(p.visible).toBe(true);
  });

  it("holds under the text of the aspirants", () => {
    const a = routeAt(4.2, VIEW, newRoutePlace());
    const b = routeAt(5, VIEW, newRoutePlace());
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it("has no jump: a small step in the scroll moves the drone a little", () => {
    const p = newRoutePlace();
    let px = routeAt(0, VIEW, p).x;
    let py = p.y;
    for (let s = 0.01; s <= ROUTE_END; s += 0.01) {
      routeAt(s, VIEW, p);
      expect(Math.abs(p.x - px)).toBeLessThan(40);
      expect(Math.abs(p.y - py)).toBeLessThan(40);
      px = p.x;
      py = p.y;
    }
  });

  it("clamps before the start and ends off the screen", () => {
    const before = routeAt(-3, VIEW, newRoutePlace());
    expect(before.x).toBeCloseTo(0.3 * 1440, 6);
    const end = routeAt(ROUTE_END, VIEW, newRoutePlace());
    expect(end.visible).toBe(false);
    expect(Math.abs(end.x)).toBeGreaterThan(VIEW.w / 2);
    expect(end.y).toBeGreaterThan(VIEW.h / 2);
    expect(routeAt(30, VIEW, newRoutePlace()).visible).toBe(false);
  });

  it("scales with the viewport", () => {
    const small = routeAt(2, { w: 390, h: 844 }, newRoutePlace());
    const big = routeAt(2, VIEW, newRoutePlace());
    expect(small.height / 844).toBeCloseTo(big.height / 900, 6);
    expect(small.x / 390).toBeCloseTo(big.x / 1440, 6);
  });
});
