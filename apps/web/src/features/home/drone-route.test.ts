import { describe, expect, it } from "vitest";

import { COMPACT_ROUTE_W, isCompactView, newRoutePlace, routeAt, routeEnd } from "./drone-route";
import { STORY, type StoryId } from "./sections/story";

// The route is placed on the story axis (`sections/story.ts`): nothing here may depend on what the
// numbers are today.
const ROUTE_END = routeEnd();
const ASPIRANTS = STORY.aspirants.start;

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
    const a = routeAt(ASPIRANTS, VIEW, newRoutePlace());
    const b = routeAt(ASPIRANTS + 0.5 * STORY.aspirants.length, VIEW, newRoutePlace());
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

  it("follows the sections: its stops come in order whatever their lengths", () => {
    // Every stop is a section's start plus a share of its length: they come in order.
    const at = (id: StoryId, share: number) => STORY[id].start + share * STORY[id].length;
    const marks = [
      at("hero", 0),
      at("hero", 1.2 / 4.2),
      at("hero", 2.6 / 4.2),
      at("aspirants", 0),
      at("aspirants", 0.5),
      at("rows", 0.8 / 2.4),
      at("rows", 1.8 / 2.4),
      at("strip", 0),
      at("strip", 1.2 / 3.1),
      ROUTE_END,
    ];
    for (let i = 1; i < marks.length; i++) expect(marks[i]!).toBeGreaterThan(marks[i - 1]!);
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
    const wide = { w: 1706, h: 950 };
    const small = routeAt(2, wide, newRoutePlace());
    const big = routeAt(2, VIEW, newRoutePlace());
    expect(small.height / 950).toBeCloseTo(big.height / 900, 6);
    expect(small.x / 1706).toBeCloseTo(big.x / 1440, 6);
  });

  describe("on a narrow screen", () => {
    const PHONE = { w: 390, h: 844 };

    it("takes its own route under the width and on an upright screen only", () => {
      expect(COMPACT_ROUTE_W).toBeGreaterThan(390);
      const at = (w: number, h: number) => routeAt(0, { w, h }, newRoutePlace()).x / w;
      expect(at(COMPACT_ROUTE_W - 1, 500)).not.toBeCloseTo(at(COMPACT_ROUTE_W, 500), 3);
      expect(isCompactView(768, 1024)).toBe(true);
      expect(isCompactView(1440, 900)).toBe(false);
      expect(isCompactView(1024, 700)).toBe(false);
      expect(at(768, 1024)).toBeCloseTo(at(390, 844), 6);
    });

    it("rests with its wing on the screen at joint J0 (reach 1.2 of its height)", () => {
      const p = routeAt(0, PHONE, newRoutePlace());
      expect(p.x + 1.2 * p.height).toBeLessThan(PHONE.w / 2 - 8);
      expect(p.x - 1.2 * p.height).toBeGreaterThan(-PHONE.w / 2);
    });

    it("keeps clear of the words under the wall (a quarter of the screen up, the wall's corner)", () => {
      const p = routeAt(ASPIRANTS + 0.25 * STORY.aspirants.length, PHONE, newRoutePlace());
      expect(p.y).toBeGreaterThan(0);
    });

    it("has no jump and ends off the screen like the wide route", () => {
      const p = newRoutePlace();
      let px = routeAt(0, PHONE, p).x;
      let py = p.y;
      for (let s = 0.01; s <= ROUTE_END; s += 0.01) {
        routeAt(s, PHONE, p);
        expect(Math.abs(p.x - px)).toBeLessThan(30);
        expect(Math.abs(p.y - py)).toBeLessThan(30);
        px = p.x;
        py = p.y;
      }
      const end = routeAt(ROUTE_END, PHONE, newRoutePlace());
      expect(end.visible).toBe(false);
      expect(Math.abs(end.x)).toBeGreaterThan(PHONE.w / 2);
    });
  });
});
