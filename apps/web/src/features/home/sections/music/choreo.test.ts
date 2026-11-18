import { describe, expect, it } from "vitest";

import { geometry } from "../funny/timeline";
import { cornerSpots, newSpots } from "../voices/choreo";

import {
  ARRIVE_SECONDS,
  EXIT_FROM,
  LEAVE_TO,
  LOCK_AT,
  UNARRIVE_SECONDS,
  arrivalAt,
  crossedLock,
  exitAt,
  j10,
  j11,
  layoutFor,
  leaveWeight,
  newArrival,
  newLayout,
  scrollArrival,
  stepClock,
} from "./choreo";

const VIEWS = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];

describe("the arrival", () => {
  it("starts with both props off screen and nobody dragging", () => {
    const a = arrivalAt(0, newArrival());
    expect(a.gramophone).toBe(1);
    expect(a.crate).toBe(1);
    expect(a.dragging).toBe(false);
    expect(a.carrying).toBe(false);
    expect(a.ready).toBe(false);
  });

  it("ends with both props at rest and the records ready", () => {
    const a = arrivalAt(1, newArrival());
    expect(a.gramophone).toBe(0);
    expect(a.crate).toBe(0);
    expect(a.dragging).toBe(false);
    expect(a.carrying).toBe(false);
    expect(a.ready).toBe(true);
  });

  it("brings the gramophone before the crate and never goes backwards", () => {
    let lastG = 1;
    let lastC = 1;
    const a = newArrival();
    for (let i = 0; i <= 100; i++) {
      arrivalAt(i / 100, a);
      expect(a.gramophone).toBeLessThanOrEqual(lastG + 1e-12);
      expect(a.crate).toBeLessThanOrEqual(lastC + 1e-12);
      lastG = a.gramophone;
      lastC = a.crate;
    }
    arrivalAt(0.4, a);
    expect(a.gramophone).toBeLessThan(a.crate);
  });

  it("has a drone dragging each prop while it moves", () => {
    const a = newArrival();
    arrivalAt(0.2, a);
    expect(a.dragging).toBe(true);
    arrivalAt(0.7, a);
    expect(a.carrying).toBe(true);
  });
});

describe("the clock and the scroll", () => {
  it("fills in ARRIVE_SECONDS and empties in UNARRIVE_SECONDS", () => {
    let c = 0;
    for (let i = 0; i < Math.round(ARRIVE_SECONDS * 60) + 2; i++) c = stepClock(c, true, 1 / 60);
    expect(c).toBe(1);
    for (let i = 0; i < Math.round(UNARRIVE_SECONDS * 60) + 2; i++) c = stepClock(c, false, 1 / 60);
    expect(c).toBe(0);
  });

  it("does not move on a zero step", () => {
    expect(stepClock(0.3, true, 0)).toBe(0.3);
  });

  it("gives the scroll's own arrival, 0 before the lock and 1 well after it", () => {
    expect(scrollArrival(LOCK_AT - 0.01)).toBe(0);
    expect(scrollArrival(0.6)).toBe(1);
  });

  it("locks when the scroll crosses the lock going down, and only then", () => {
    expect(crossedLock(LOCK_AT - 0.01, LOCK_AT + 0.01)).toBe(true);
    expect(crossedLock(LOCK_AT + 0.01, LOCK_AT + 0.05)).toBe(false);
    // Going up.
    expect(crossedLock(LOCK_AT + 0.01, LOCK_AT - 0.01)).toBe(false);
    // A jump (a seek, a scrollbar drag).
    expect(crossedLock(0, 0.6)).toBe(false);
    expect(crossedLock(0.9, 0.1)).toBe(false);
  });
});

describe("the leaving", () => {
  it("lets the drones go in the first stretch and keeps the scene until the exit", () => {
    expect(leaveWeight(0)).toBe(0);
    expect(leaveWeight(LEAVE_TO)).toBe(1);
    expect(leaveWeight(0.5)).toBe(1);
    expect(exitAt(EXIT_FROM - 0.01)).toBe(0);
    expect(exitAt(1)).toBe(1);
    expect(exitAt(1.2)).toBe(1);
  });

  it("puts the lock after the drones have gone and before the scene stands", () => {
    expect(LOCK_AT).toBeGreaterThan(LEAVE_TO);
    expect(LOCK_AT).toBeLessThan(EXIT_FROM - 0.3);
  });
});

describe("the joints", () => {
  it("starts where the voices section ends (J10) and ends where the funny section starts (J11)", () => {
    for (const vp of VIEWS) {
      const start = j10(vp, newSpots());
      const voicesEnd = cornerSpots(vp, newSpots());
      expect(start).toEqual(voicesEnd);
      const end = j11(vp, newSpots());
      const g = geometry(vp.w, vp.h);
      expect(end.a).toEqual({ x: g.watch[0].x, y: g.watch[0].y, h: g.watch[0].height });
      expect(end.b).toEqual({ x: g.watch[1].x, y: g.watch[1].y, h: g.watch[1].height });
    }
  });
});

describe("the layout", () => {
  it("keeps the gramophone and the crate on the screen at rest", () => {
    for (const vp of VIEWS) {
      const l = layoutFor(vp, newLayout());
      expect(Math.abs(l.gramophone.x)).toBeLessThan(vp.w / 2);
      expect(Math.abs(l.crate.x)).toBeLessThan(vp.w / 2);
      expect(l.gramophone.height).toBeGreaterThan(0.3 * vp.h);
      expect(l.crate.width).toBeGreaterThan(0.3 * vp.w);
    }
  });

  it("puts the crate to the left of the gramophone on a wide screen and under it on a phone", () => {
    const wide = layoutFor(VIEWS[0]!, newLayout());
    expect(wide.compact).toBe(false);
    expect(wide.crate.x).toBeLessThan(wide.gramophone.x);
    const phone = layoutFor(VIEWS[2]!, newLayout());
    expect(phone.compact).toBe(true);
    expect(phone.crate.y).toBeLessThan(phone.gramophone.y);
  });

  it("keeps the waiting drones inside the screen", () => {
    for (const vp of VIEWS) {
      const l = layoutFor(vp, newLayout());
      for (const p of [l.aIdle, l.bIdle, l.aCrate, l.aPlatter]) {
        // The ball and its gloves (0.85 of the ball's diameter either side of the middle).
        expect(Math.abs(p.x) + 0.85 * p.height).toBeLessThanOrEqual(
          vp.w / 2 + 0.25 * p.height + 1e-9,
        );
        expect(Math.abs(p.y) + p.height / 2).toBeLessThan(vp.h / 2);
      }
    }
  });
});
