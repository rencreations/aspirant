import { describe, expect, it } from "vitest";

import { makePose } from "../../fx/image-field/types";
import { wallFrame, wallGeom, wallSlotPose } from "../../fx/image-field/wall";

import { clearedPose, clearingReach, slotPlace } from "./clearing";

const vp = { w: 1440, h: 900 };
const geom = wallGeom(18, wallFrame(vp, "rows"), { size: 0.34 });

describe("clearedPose", () => {
  it("is the field's own rows pose until the clearing starts", () => {
    for (const slide of [0, 1234.5, -800]) {
      for (let slot = 0; slot < 18; slot++) {
        const a = makePose();
        const b = makePose();
        wallSlotPose(geom, slot, slide, a);
        clearedPose(geom, slot, slide, 0, 0, b);
        expect(b).toEqual(a);
      }
    }
  });

  it("leaves no card behind at progress 1", () => {
    for (const centre of [0, 400, -900]) {
      for (let slot = 0; slot < 18; slot++) {
        const p = makePose();
        clearedPose(geom, slot, 700, centre, 1, p);
        expect(p.opacity).toBe(0);
      }
    }
  });

  it("sends the card nearest the film first and every card away from it", () => {
    const near = [0, 0] as [number, number];
    // The card nearest the film at the middle, and the one furthest from it.
    let nearest = 0;
    let furthest = 0;
    let dn = Infinity;
    let df = -1;
    for (let slot = 0; slot < 18; slot++) {
      slotPlace(geom, slot, 0, near);
      const d = Math.hypot(near[0], near[1] * 1.25);
      if (d < dn) [dn, nearest] = [d, slot];
      if (d > df) [df, furthest] = [d, slot];
    }
    const a = makePose();
    const b = makePose();
    clearedPose(geom, nearest, 0, 0, 0.5, a);
    clearedPose(geom, furthest, 0, 0, 0.5, b);
    expect(a.opacity).toBeLessThan(b.opacity);
    expect(b.opacity).toBe(1);
  });

  it("never moves a card that has not started to go, and never allocates a new pose", () => {
    const p = makePose();
    const q = p.q;
    clearedPose(geom, 3, 100, 0, 0.5, p);
    expect(p.q).toBe(q);
  });

  it("has a reach that grows with the film's distance from the middle", () => {
    expect(clearingReach(geom, 900)).toBeGreaterThan(clearingReach(geom, 0));
  });
});
