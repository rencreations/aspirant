import { describe, expect, it } from "vitest";

import { END_FEET_Y, END_HEIGHT, HIPS_ABOVE_FEET } from "../bolt/journey";

import {
  FRAME_COUNT,
  HAND_AT,
  HAND_SCREENS,
  HIPS_ABOVE_FEET as HIPS,
  J6,
  LIST_AT,
  STRIP_END,
  handBeats,
  fallEnd,
  handGeometry,
  listBeats,
  newHandBeats,
  newListBeats,
  restOf,
  stripIndex,
} from "./timeline";

describe("hand beats", () => {
  const b = newHandBeats();

  it("shows the fingertips at the bottom edge at the start (J6), and nothing before the lead", () => {
    expect(handBeats(-0.5, b).rise).toBe(0);
    expect(handBeats(0, b).rise).toBeCloseTo(0.13, 5);
    expect(handBeats(0, b).fall).toBe(0);
    expect(handBeats(0, b).landed).toBe(false);
  });

  it("is monotonic: the rise grows, the fall grows, the text arrives in order", () => {
    let rise = -1;
    let fall = -1;
    for (let t = -0.5; t <= HAND_SCREENS + 0.5; t += 0.05) {
      handBeats(t, b);
      expect(b.rise).toBeGreaterThanOrEqual(rise);
      expect(b.fall).toBeGreaterThanOrEqual(fall);
      rise = b.rise;
      fall = b.fall;
    }
    expect(handBeats(HAND_AT.title[0], b).title).toBe(0);
    expect(handBeats(HAND_AT.hint[1], b).hint).toBe(1);
  });

  it("lands when the palm has arrived, and sits after standing", () => {
    expect(handBeats(HAND_AT.land - 0.01, b).landed).toBe(false);
    expect(handBeats(HAND_AT.land, b).landed).toBe(true);
    expect(handBeats(HAND_AT.land, b).rise).toBeCloseTo(1, 5);
    handBeats(HAND_AT.stood, b);
    expect(b.stand).toBe(1);
    expect(b.sit).toBe(0);
    expect(handBeats(HAND_AT.sat, b).sit).toBe(1);
  });

  it("asks for the pointer's reach only once the doll sits", () => {
    expect(HAND_AT.react[0]).toBeGreaterThanOrEqual(HAND_AT.sat);
    expect(handBeats(HAND_AT.sat, b).react).toBe(0);
    expect(handBeats(HAND_AT.react[0] + 0.2, b).react).toBeGreaterThan(0);
    expect(handBeats(HAND_AT.react[1], b).react).toBe(1);
  });

  it("is the same value for the same t whatever came before (pure)", () => {
    handBeats(3, b);
    const first = { ...b };
    handBeats(0.4, b);
    handBeats(3, b);
    expect(b).toEqual(first);
  });
});

describe("the joint with the fall (J6)", () => {
  it("keeps the numbers the bolt section's journey ends the fall with", () => {
    expect(J6.height).toBe(END_HEIGHT);
    expect(J6.feetY).toBe(END_FEET_Y);
    expect(HIPS).toBe(HIPS_ABOVE_FEET);
  });

  it("puts the doll's hips above her feet, 0.26 of the screen tall", () => {
    const vp = { w: 1440, h: 900 };
    const e = fallEnd(vp);
    expect(e.height).toBeCloseTo(0.26 * 900, 6);
    expect(e.x).toBe(0);
    expect(e.y - HIPS * e.height).toBeCloseTo(0.1 * 900, 6);
  });

  it("leaves the text above for the hand's drop, and has the fingers live before it", () => {
    expect(HAND_AT.react[1]).toBeLessThan(HAND_AT.drop[0]);
    expect(HAND_AT.hint[1]).toBeLessThanOrEqual(HAND_AT.drop[0]);
    expect(HAND_AT.textOut[0]).toBeGreaterThan(HAND_AT.drop[0] - 0.2);
    expect(HAND_AT.textOut[1]).toBeLessThanOrEqual(HAND_SCREENS);
  });
});

describe("hand geometry", () => {
  it("is 0.55 of the screen tall on a desktop and smaller and to the left on a phone", () => {
    const d = handGeometry({ w: 1440, h: 900 });
    expect(d.height).toBeCloseTo(495, 3);
    expect(d.x).toBe(0);
    expect(d.restY).toBe(-450);
    const p = handGeometry({ w: 390, h: 844 });
    expect(p.scale).toBe(0.85);
    expect(p.x).toBe(-40);
  });

  it("puts the palm's stand point where the lab measured it", () => {
    const d = handGeometry({ w: 1440, h: 900 });
    expect(Math.abs(d.restY + d.standDy + 296)).toBeLessThan(6);
    expect(Math.abs(d.x + d.standDx - 10)).toBeLessThan(6);
    const p = handGeometry({ w: 390, h: 844 });
    expect(Math.abs(p.restY + p.standDy + 286)).toBeLessThan(6);
  });
});

describe("list beats", () => {
  const b = newListBeats();

  it("has the strip at rest on each frame, with a tenth of rest on either side", () => {
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      expect(stripIndex(restOf(i))).toBeCloseTo(i, 6);
      expect(stripIndex(restOf(i) + 0.05 * LIST_AT.step)).toBeCloseTo(i, 6);
    }
  });

  it("moves between frames in sine in and out and never goes back", () => {
    let last = -1;
    for (let s = 0; s <= 9; s += 0.01) {
      const v = stripIndex(s);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
    expect(stripIndex(restOf(0) + 0.5 * LIST_AT.step)).toBeCloseTo(0.5, 6);
    expect(stripIndex(-3)).toBe(0);
    expect(stripIndex(99)).toBe(FRAME_COUNT - 1);
  });

  it("leaves the last frame standing before it grows, and ends the growth before the section ends", () => {
    expect(STRIP_END).toBeLessThan(LIST_AT.expandFrom);
    expect(LIST_AT.expandTo).toBeLessThan(8.6 - 0.45);
    expect(listBeats(LIST_AT.expandFrom, b).expand).toBe(0);
    expect(listBeats(LIST_AT.expandTo, b).expand).toBe(1);
    expect(listBeats(8.6, b).expand).toBe(1);
  });

  it("tosses the doll after the crouch and sinks the hand after the toss starts", () => {
    expect(listBeats(LIST_AT.crouch[0], b).crouch).toBe(0);
    expect(listBeats(LIST_AT.toss[0], b).crouch).toBe(1);
    expect(listBeats(LIST_AT.toss[0], b).toss).toBe(0);
    expect(listBeats(LIST_AT.toss[1], b).toss).toBe(1);
    expect(listBeats(LIST_AT.sink[0], b).sink).toBe(0);
    expect(listBeats(LIST_AT.sink[1], b).sink).toBe(1);
    expect(LIST_AT.sink[0]).toBeGreaterThan(LIST_AT.toss[0]);
  });

  it("starts with the frame arriving in the lead", () => {
    expect(listBeats(LIST_AT.appear[0], b).appear).toBe(0);
    expect(listBeats(LIST_AT.appear[1], b).appear).toBe(1);
  });
});
