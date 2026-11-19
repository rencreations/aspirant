import { describe, expect, it } from "vitest";

import { dockPlace } from "./dock";
import { newPairPlace, pairAt } from "./route";
import { DESCENT_LEAD, DESCENT_SCREENS, LIST_LEAD, LIST_RISE_AT_U } from "./stations";

const WIDE = { w: 1440, h: 900 };
const PHONE = { w: 390, h: 844 };

describe("the descent's numbers", () => {
  it("lets the list rise over the descent's last LIST_LEAD screens", () => {
    expect(LIST_RISE_AT_U).toBeCloseTo(DESCENT_SCREENS - LIST_LEAD, 10);
    expect(LIST_LEAD).toBeLessThan(DESCENT_SCREENS);
    expect(DESCENT_LEAD).toBeGreaterThan(0);
  });
});

describe("the pair's route", () => {
  for (const [name, vp] of [
    ["wide", WIDE],
    ["phone", PHONE],
  ] as const) {
    it(`starts above the top edge and is not drawn there (${name})`, () => {
      const p = pairAt(-DESCENT_LEAD, vp, newPairPlace());
      expect(p.y - 0.55 * p.height).toBeGreaterThan(vp.h / 2);
      expect(p.visible).toBe(false);
    });

    it(`ends exactly at the dock (${name})`, () => {
      const p = pairAt(DESCENT_SCREENS, vp, newPairPlace());
      const d = dockPlace(vp, { x: 0, y: 0, height: 0 });
      expect(p.x).toBeCloseTo(d.x, 6);
      expect(p.y).toBeCloseTo(d.y, 6);
      expect(p.height).toBeCloseTo(d.height, 6);
      expect(p.visible).toBe(true);
      expect(p.descent).toBe(0);
    });

    it(`only ever goes down the screen (${name})`, () => {
      let y = Infinity;
      for (let u = -DESCENT_LEAD; u <= DESCENT_SCREENS + 1e-9; u += 0.01) {
        const p = pairAt(u, vp, newPairPlace());
        expect(p.y).toBeLessThanOrEqual(y + 0.5);
        y = p.y;
      }
    });

    it(`comes closer: bigger in the middle than at the entrance (${name})`, () => {
      const first = pairAt(0, vp, newPairPlace()).height;
      const middle = pairAt(3, vp, newPairPlace()).height;
      expect(middle).toBeGreaterThan(first * 1.4);
    });

    it(`stays on the screen once it is in (${name})`, () => {
      for (let u = 0.2; u <= DESCENT_SCREENS; u += 0.05) {
        const p = pairAt(u, vp, newPairPlace());
        // The drone's middle and a wing's reach (about 1.2 of its height): inside the screen.
        expect(Math.abs(p.x) + 1.2 * p.height).toBeLessThan(vp.w / 2);
        expect(Math.abs(p.y)).toBeLessThan(vp.h / 2);
      }
    });

    it(`is flying down in the middle and rests at both ends (${name})`, () => {
      expect(pairAt(DESCENT_SCREENS, vp, newPairPlace()).descent).toBe(0);
      expect(pairAt(-DESCENT_LEAD, vp, newPairPlace()).descent).toBe(0);
      expect(pairAt(2, vp, newPairPlace()).descent).toBe(1);
    });
  }
});
