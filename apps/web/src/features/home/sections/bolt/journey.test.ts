import { describe, expect, it } from "vitest";

import {
  Journey,
  easeInOut,
  headSpeed,
  mistLeft,
  pathParam,
  wheelAt,
  wheelShow,
  whiteRise,
} from "./journey";
import { BOLT_AT, BOLT_SCREENS, FALL_AT, FALL_SCREENS, SLOW_SPEED } from "./stations";

const MID = (BOLT_AT.slowFrom + BOLT_AT.slowTo) / 2;

describe("the head's path", () => {
  it("crawls at 12 percent in the middle of the slow range and is at full speed outside it", () => {
    expect(headSpeed(MID)).toBeCloseTo(SLOW_SPEED, 6);
    expect(headSpeed(BOLT_AT.slowFrom - 0.01)).toBeCloseTo(1, 3);
    expect(headSpeed(BOLT_AT.slowTo + 0.01)).toBeCloseTo(1, 3);
    expect(headSpeed(BOLT_AT.enter)).toBe(1);
  });

  it("puts the middle of the slow range at the middle of the path, and only ever goes forward", () => {
    expect(pathParam(MID)).toBeCloseTo(0.5, 3);
    let last = -Infinity;
    for (let u = -1; u < 8; u += 0.05) {
      const p = pathParam(u);
      expect(p).toBeGreaterThan(last);
      last = p;
    }
  });

  it("moves the head only a little across the whole slow range", () => {
    const across = pathParam(BOLT_AT.slowTo) - pathParam(BOLT_AT.slowFrom);
    const before = pathParam(BOLT_AT.slowFrom) - pathParam(BOLT_AT.slowFrom - 2.4);
    expect(across).toBeLessThan(before * 0.5);
  });

  it("is a pure function of u: the same u gives the same head, up or down", () => {
    const a = new Journey();
    const b = new Journey();
    a.at(1.2, 1440, 900);
    a.at(3.0, 1440, 900);
    b.at(3.0, 1440, 900);
    expect(a.headX).toBe(b.headX);
    expect(a.headY).toBe(b.headY);
  });

  it("holds the head near the middle of the screen across the slow range", () => {
    const j = new Journey();
    j.at(MID, 1440, 900);
    expect(Math.abs(j.headX)).toBeLessThan(5);
    expect(Math.abs(j.headY)).toBeLessThan(5);
    j.at(BOLT_AT.slowFrom + 0.6, 1440, 900);
    expect(Math.abs(j.headX)).toBeLessThan(0.25 * 1440);
  });
});

describe("the wheel", () => {
  it("turns continuously from the first pair to the last, never in stations", () => {
    expect(wheelAt(BOLT_AT.wheelFrom - 1)).toBe(0);
    expect(wheelAt(BOLT_AT.wheelTo + 1)).toBe(4);
    const mid = wheelAt((BOLT_AT.wheelFrom + BOLT_AT.wheelTo) / 2);
    expect(mid).toBeCloseTo(2, 6);
    expect(wheelAt(2.0)).not.toBe(Math.round(wheelAt(2.0)));
  });

  it("is shown while the head crawls and gone before the fall", () => {
    expect(wheelShow(0)).toBe(0);
    expect(wheelShow(MID)).toBe(1);
    expect(wheelShow(BOLT_SCREENS + 0.5)).toBe(0);
  });
});

describe("the white and the mist", () => {
  it("rises with the scroll through the bolt, stays through the fall and goes back at the hand", () => {
    expect(whiteRise(0)).toBe(0);
    expect(whiteRise(1.5)).toBeGreaterThan(whiteRise(0.8));
    expect(whiteRise(BOLT_SCREENS)).toBeGreaterThan(0.6);
    expect(whiteRise(BOLT_SCREENS + FALL_AT.move[1])).toBeGreaterThan(0.7);
    expect(whiteRise(BOLT_SCREENS + FALL_SCREENS + 0.3)).toBeLessThan(0.01);
  });

  it("thins the pale mist out to the plain paper, and not before the dragon comes", () => {
    expect(mistLeft(0.1)).toBeCloseTo(1, 6);
    expect(mistLeft(BOLT_SCREENS)).toBeLessThan(0.01);
    expect(mistLeft(2)).toBeLessThan(mistLeft(1));
  });
});

describe("the fall", () => {
  it("eases in and out and centres the doll with the camera at the end of the move", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    const j = new Journey();
    j.launchX = 40;
    j.launchY = 90;
    j.at(BOLT_SCREENS, 1440, 900);
    expect(j.zoom).toBe(1);
    expect(j.camX).toBe(0);
    expect(j.dollX).toBeCloseTo(40, 6);
    j.at(BOLT_SCREENS + FALL_AT.move[1] + 0.2, 1440, 900);
    expect(j.dollX).toBeCloseTo(0, 6);
    expect(j.dollY).toBeCloseTo(0, 6);
    expect(j.zoom).toBeGreaterThan(1.5);
    expect(j.dollMode).toBe("fall");
  });

  it("rides before the end of the slow range and is hidden before the dragon", () => {
    const j = new Journey();
    j.at(BOLT_AT.enter, 1440, 900);
    expect(j.dollMode).toBe("hidden");
    j.at(2, 1440, 900);
    expect(j.dollMode).toBe("ride");
  });
});
