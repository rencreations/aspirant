import { describe, expect, it } from "vitest";

import {
  danceClock,
  GUEST_BOW,
  GUEST_FLY,
  guestPlace,
  newVisit,
  stepVisit,
  visitWanted,
  type Visit,
} from "./guests";

const DT = 1 / 60;

/** Run the visit for `seconds` with `wanted` and return the largest step of the flight in one frame. */
function run(v: Visit, wanted: boolean, seconds: number): number {
  let worst = 0;
  for (let i = 0; i < Math.round(seconds / DT); i += 1) {
    const before = v.flight.x;
    stepVisit(v, wanted, DT);
    worst = Math.max(worst, Math.abs(v.flight.x - before));
  }
  return worst;
}

describe("the guests' visit", () => {
  it("is wanted from 20 to 60 percent of the descent", () => {
    expect(visitWanted(0.19)).toBe(false);
    expect(visitWanted(0.2)).toBe(true);
    expect(visitWanted(0.59)).toBe(true);
    expect(visitWanted(0.6)).toBe(false);
  });

  it("starts off the screen and flies in over about GUEST_FLY seconds, never faster than that", () => {
    const v = newVisit();
    stepVisit(v, false, DT);
    expect(v.shown).toBe(false);
    const worst = run(v, true, GUEST_FLY + 1);
    // The weight of the flight: at most 1 / GUEST_FLY of the way a second, and in a frame a 60th of that.
    expect(worst).toBeLessThanOrEqual(1 / GUEST_FLY / 60 + 1e-9);
    expect(v.flight.x).toBeGreaterThan(0.999);
    expect(v.pose === "bow" || v.pose === "dance" || v.pose === "float").toBe(true);
  });

  it("is smooth when the scroll reverses in the middle of a flight (no jump in the weight)", () => {
    const v = newVisit();
    run(v, true, 0.7);
    const mid = v.flight.x;
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.9);
    const worst = run(v, false, 3);
    expect(worst).toBeLessThanOrEqual(1 / GUEST_FLY / 60 + 1e-9);
    expect(v.shown).toBe(false);
  });

  it("bows first, dances after the bow, and stops dancing before it flies out", () => {
    const v = newVisit();
    run(v, true, GUEST_FLY + 0.2);
    const poses = new Set<string>();
    let sawDance = false;
    for (let i = 0; i < Math.round((GUEST_BOW + 3) / DT); i += 1) {
      stepVisit(v, true, DT);
      poses.add(v.pose);
      if (v.pose === "dance") sawDance = true;
    }
    expect(poses.has("bow")).toBe(true);
    expect(sawDance).toBe(true);
    // No longer wanted: the dance ends before the flight out begins.
    let flewWhileDancing = false;
    for (let i = 0; i < Math.round(7 / DT); i += 1) {
      const before = v.flight.x;
      stepVisit(v, false, DT);
      if (v.perform > 0.01 && v.flight.x < before - 1e-9) flewWhileDancing = true;
    }
    expect(flewWhileDancing).toBe(false);
    expect(v.shown).toBe(false);
  });

  it("greets once they stand beside the pair, on their own clock, and not before", () => {
    const v = newVisit();
    run(v, true, GUEST_FLY * 0.5);
    expect(v.greet).toBe(0);
    run(v, true, GUEST_FLY + GUEST_BOW * 0.5);
    expect(v.greet).toBeGreaterThan(0.3);
  });

  it("marks the beat the dance begins on, once", () => {
    const v = newVisit();
    let marks = 0;
    for (let i = 0; i < Math.round(8 / DT); i += 1) {
      stepVisit(v, true, DT);
      if (v.danceFrom) marks += 1;
    }
    expect(marks).toBe(1);
  });
});

describe("the guests' dance clock", () => {
  it("skips the third phrase and is continuous", () => {
    let last = danceClock(0);
    for (let i = 1; i <= 2000; i += 1) {
      const t = (i * 18) / 2000;
      const c = danceClock(t);
      const jump = c - last;
      // Only the skip of the third phrase (3 s) is a step, and only at 6 s into each 9.
      expect(jump).toBeLessThan(3.1);
      last = c;
    }
    expect(danceClock(0)).toBe(0);
    expect(danceClock(6.0001)).toBeGreaterThan(8.9);
  });
});

describe("where the guests stand", () => {
  it("keeps both on the screen, a side each, whatever the pair's place", () => {
    const a = { x: 0, y: 0, height: 0 };
    const b = { x: 0, y: 0, height: 0 };
    for (const x of [-700, -300, 0, 300, 700]) {
      guestPlace(-1, x, 0, 140, 1440, 0, a);
      guestPlace(1, x, 0, 140, 1440, 0, b);
      expect(Math.abs(a.x)).toBeLessThanOrEqual(720);
      expect(Math.abs(b.x)).toBeLessThanOrEqual(720);
      expect(a.x).toBeLessThanOrEqual(b.x);
    }
  });
});
