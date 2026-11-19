import { describe, expect, it } from "vitest";

import { END_FEET_Y, END_HEIGHT, HIPS_ABOVE_FEET } from "../bolt/journey";

import { FRAME_COUNT, HAND_LAST, LIST_LAST } from "./stations";
import {
  HAND_AT,
  HIPS_ABOVE_FEET as HIPS,
  J6,
  JOIN_AT,
  LIST_AT,
  handBeats,
  fallEnd,
  handGeometry,
  listBeats,
  newHandBeats,
  newListBeats,
  stripIndex,
} from "./timeline";

describe("hand beats", () => {
  const b = newHandBeats();

  it("shows the fingertips at the bottom edge at the start (J6), and nothing before the lead", () => {
    expect(handBeats(-0.5, -2, b).rise).toBe(0);
    expect(handBeats(0, -2, b).rise).toBeCloseTo(0.13, 5);
    expect(handBeats(0, -2, b).fall).toBe(0);
    expect(handBeats(0, -2, b).landed).toBe(false);
  });

  it("is monotonic: the rise grows, the fall grows, the text arrives in order", () => {
    let rise = -1;
    let fall = -1;
    for (let t = -0.5; t <= HAND_LAST + 0.5; t += 0.05) {
      handBeats(t, -2, b);
      expect(b.rise).toBeGreaterThanOrEqual(rise);
      expect(b.fall).toBeGreaterThanOrEqual(fall);
      rise = b.rise;
      fall = b.fall;
    }
    expect(handBeats(HAND_AT.title[0], -2, b).title).toBe(0);
    expect(handBeats(HAND_AT.hint[1], -2, b).hint).toBe(1);
  });

  it("lands when the palm has arrived, and sits after standing", () => {
    expect(handBeats(HAND_AT.land - 0.01, -2, b).landed).toBe(false);
    expect(handBeats(HAND_AT.land, -2, b).landed).toBe(true);
    expect(handBeats(HAND_AT.land, -2, b).rise).toBeCloseTo(1, 5);
    handBeats(HAND_AT.stood, -2, b);
    expect(b.stand).toBe(1);
    expect(b.sit).toBe(0);
    expect(handBeats(HAND_AT.sat, -2, b).sit).toBe(1);
  });

  it("asks for the pointer's reach only once the doll sits", () => {
    expect(HAND_AT.react[0]).toBeGreaterThanOrEqual(HAND_AT.sat);
    expect(handBeats(HAND_AT.sat, -2, b).react).toBe(0);
    expect(handBeats(HAND_AT.react[0] + 0.1, -2, b).react).toBeGreaterThan(0);
    expect(handBeats(HAND_AT.react[1], -2, b).react).toBe(1);
  });

  it("is the same value for the same input whatever came before (pure)", () => {
    handBeats(1.9, -0.2, b);
    const first = { ...b };
    handBeats(0.4, 0.3, b);
    handBeats(1.9, -0.2, b);
    expect(b).toEqual(first);
  });

  it("rests on the last beat with everything shown, the hand up and the words in", () => {
    handBeats(HAND_LAST, -2, b);
    expect(b.title).toBe(1);
    expect(b.desc).toBe(1);
    expect(b.hint).toBe(1);
    expect(b.react).toBe(1);
    expect(b.rise).toBeCloseTo(1, 6);
    expect(b.drop).toBe(0);
    expect(b.textOut).toBe(0);
    expect(HAND_AT.hint[1]).toBeLessThanOrEqual(HAND_LAST);
    expect(HAND_AT.desc[1]).toBeLessThanOrEqual(HAND_LAST);
  });

  it("brings the hand down and the words away with the join, never before the rest", () => {
    expect(handBeats(HAND_LAST, JOIN_AT.drop[0], b).drop).toBe(0);
    expect(handBeats(HAND_LAST, JOIN_AT.drop[1], b).drop).toBe(1);
    expect(handBeats(HAND_LAST, JOIN_AT.textOut[1], b).textOut).toBe(1);
    expect(JOIN_AT.textOut[0]).toBeGreaterThanOrEqual(JOIN_AT.drop[0]);
    expect(JOIN_AT.appear[1]).toBeLessThanOrEqual(0.1);
  });
});

describe("the joint with the fall (J6)", () => {
  it("keeps the numbers the bolt section's journey ends the fall with", () => {
    expect(J6.height).toBe(END_HEIGHT);
    expect(J6.feetY).toBe(END_FEET_Y);
    expect(HIPS).toBe(HIPS_ABOVE_FEET);
  });

  it("puts the doll's hips at the middle of the screen, 0.38 of the screen tall", () => {
    const vp = { w: 1440, h: 900 };
    const e = fallEnd(vp);
    expect(e.height).toBeCloseTo(0.38 * 900, 6);
    expect(e.x).toBe(0);
    expect(e.y).toBeCloseTo(0, 6);
  });

  it("has the fingers live by the hand's last beat, before the join takes the hand down", () => {
    expect(HAND_AT.react[1]).toBeLessThanOrEqual(HAND_LAST);
    expect(handBeats(HAND_LAST, JOIN_AT.drop[0], newHandBeats()).react).toBe(1);
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

  it("has the strip on frame `k` at beat 1 + k, and moves between them in a straight line", () => {
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      expect(stripIndex(LIST_AT.stripFrom + i)).toBeCloseTo(i, 9);
    }
    expect(stripIndex(LIST_AT.stripFrom + 3.5)).toBeCloseTo(3.5, 9);
    expect(stripIndex(-3)).toBe(0);
    expect(stripIndex(99)).toBe(FRAME_COUNT - 1);
    let last = -1;
    for (let u = 0; u <= LIST_LAST; u += 0.01) {
      const v = stripIndex(u);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
  });

  it("leaves the last frame standing before it grows, and ends the growth at the last beat", () => {
    expect(LIST_AT.stripFrom + FRAME_COUNT - 1).toBe(LIST_AT.expandFrom);
    expect(LIST_AT.expandTo).toBe(LIST_LAST);
    expect(listBeats(LIST_AT.expandFrom, 0, b).expand).toBe(0);
    expect(listBeats(LIST_AT.expandTo, 0, b).expand).toBe(1);
    expect(listBeats(LIST_LAST + 0.4, 0, b).expand).toBe(1);
  });

  it("stands her up, crouches, tosses after the crouch and sinks the hand after the toss starts", () => {
    expect(listBeats(0, 0, b).stand).toBe(0);
    expect(listBeats(LIST_AT.stand[1], 0, b).stand).toBe(1);
    expect(listBeats(LIST_AT.crouch[0], 0, b).crouch).toBe(0);
    expect(listBeats(LIST_AT.toss[0], 0, b).crouch).toBe(1);
    expect(listBeats(LIST_AT.toss[0], 0, b).toss).toBe(0);
    expect(listBeats(LIST_AT.toss[1], 0, b).toss).toBe(1);
    expect(listBeats(LIST_AT.sink[0], 0, b).sink).toBe(0);
    expect(listBeats(LIST_AT.sink[1], 0, b).sink).toBe(1);
    expect(LIST_AT.sink[0]).toBeGreaterThan(LIST_AT.toss[0]);
  });

  it("is done with the first play by beat 1: the hand gone, the name in, the doll seated", () => {
    listBeats(1, 0, b);
    expect(b.sink).toBe(1);
    expect(b.nameIn).toBe(1);
    expect(b.settle).toBe(1);
    expect(b.index).toBe(0);
  });

  it("has the frame arrive in the join, before the toss", () => {
    expect(listBeats(0, JOIN_AT.appear[0], b).appear).toBe(0);
    expect(listBeats(0, JOIN_AT.appear[1], b).appear).toBe(1);
    expect(JOIN_AT.appear[1]).toBeLessThan(0.5);
  });
});
