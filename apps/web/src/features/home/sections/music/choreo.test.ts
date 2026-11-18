import { describe, expect, it } from "vitest";

import { geometry } from "../funny/timeline";
import { cornerSpots, newSpots } from "../voices/choreo";

import { validatePlays } from "../../kernel/plays";

import {
  EXIT_FROM,
  LEAVE_TO,
  arrivalAt,
  arrivalOf,
  exitAt,
  j10,
  j11,
  layoutFor,
  leaveWeight,
  newArrival,
  newLayout,
  riseAt,
} from "./choreo";
import { AT_ARRIVE, AT_EXIT, MUSIC_PLAYS, SECONDS, STAND } from "./stations";

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

describe("the plays", () => {
  it("are a valid table: the pair's corners, the standing scene, the pair's rise", () => {
    expect(() => {
      validatePlays("music", MUSIC_PLAYS);
    }).not.toThrow();
    expect(MUSIC_PLAYS.map((p) => p.from)).toEqual([0, STAND]);
    expect(MUSIC_PLAYS.map((p) => p.to)).toEqual([STAND, 1]);
    expect(AT_ARRIVE).toBeLessThan(AT_EXIT);
  });

  it("are short: the props come in within about three seconds, go out in under two", () => {
    expect(SECONDS.arrive).toBeLessThanOrEqual(3.5);
    expect(SECONDS.exit).toBeLessThanOrEqual(2);
  });

  it("give the gramophone and the crate about a second and a half each", () => {
    // The arrival is a straight line over the part of the play that follows the zip off.
    const arriveSeconds = SECONDS.arrive * ((STAND - LEAVE_TO) / STAND);
    expect(arriveSeconds * 0.55).toBeGreaterThan(1.1);
    expect(arriveSeconds * 0.6).toBeLessThan(2.2);
  });

  it("fill the arrival from nothing at the zip off's end to a whole scene at the stand", () => {
    expect(arrivalOf(0)).toBe(0);
    expect(arrivalOf(LEAVE_TO)).toBe(0);
    expect(arrivalOf(STAND)).toBe(1);
    expect(arrivalOf(1)).toBe(1);
    let last = -1;
    for (let v = 0; v <= 1; v += 0.01) {
      const a = arrivalOf(v);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });

  it("stand ready: both props at rest and the records can be picked", () => {
    const a = arrivalAt(arrivalOf(STAND), newArrival());
    expect(a.ready).toBe(true);
    expect(a.gramophone).toBe(0);
    expect(a.crate).toBe(0);
    expect(exitAt(STAND)).toBe(0);
  });

  it("keep the stand dwell long enough to pick a record and short enough to be no dead scroll", () => {
    // The screens are in `index.ts`; the thresholds' spacing is what the dwell is made of.
    expect(AT_EXIT - AT_ARRIVE).toBeGreaterThan(0.5);
    expect(AT_EXIT).toBeLessThanOrEqual(0.82);
  });
});

describe("the leaving", () => {
  it("lets the drones go in the first stretch and keeps the scene until the exit", () => {
    expect(leaveWeight(0)).toBe(0);
    expect(leaveWeight(LEAVE_TO)).toBe(1);
    expect(leaveWeight(0.3)).toBe(1);
    expect(exitAt(EXIT_FROM - 0.01)).toBe(0);
    expect(exitAt(1)).toBe(1);
    expect(exitAt(1.2)).toBe(1);
  });

  it("brings the pair up to the top left once the props are on their way out", () => {
    expect(riseAt(EXIT_FROM)).toBe(0);
    expect(riseAt(1)).toBe(1);
    expect(exitAt(0.69)).toBeGreaterThan(0.25);
    expect(riseAt(0.6)).toBe(0);
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
