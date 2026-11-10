import { describe, expect, it } from "vitest";

import {
  FIELD,
  FOLLOW,
  arcPose,
  arrival,
  cubicBezier,
  dipOf,
  followShare,
  frontSlot,
  glideEase,
  glideFor,
  leanOf,
  mod,
  nearestSlot,
  rowPose,
  slotsAround,
  trackOf,
} from "./field";

describe("the endless field", () => {
  it("maps every slot to a track, both ways round", () => {
    expect(mod(-1, 9)).toBe(8);
    expect(mod(9, 9)).toBe(0);
    expect(mod(-10, 9)).toBe(8);
    expect(trackOf(17, 9)).toBe(8);
    expect(trackOf(-9, 9)).toBe(0);
    expect(mod(3, 0)).toBe(0);
  });

  it("puts the nearest slot in front", () => {
    expect(frontSlot(2.4)).toBe(2);
    expect(frontSlot(2.6)).toBe(3);
    expect(frontSlot(-0.6)).toBe(-1);
  });

  it("draws the slots within reach of the position, never one track twice on screen", () => {
    expect(slotsAround(0, 2)).toEqual([-2, -1, 0, 1, 2]);
    expect(slotsAround(0.5, 1)).toEqual([0, 1]);
    const slots = slotsAround(3.3, FIELD.reach);
    expect(slots.length).toBeLessThanOrEqual(9);
    // With nine tracks a track comes back nine slots later: never inside the reach.
    expect(slots[slots.length - 1]! - slots[0]!).toBeLessThan(9);
  });

  it("finds the short way round to a track", () => {
    // From the last track to the first is one step forward, not eight back.
    expect(nearestSlot(8, 0, 9)).toBe(9);
    // From the first track back to the last is one step back.
    expect(nearestSlot(0, 8, 9)).toBe(-1);
    expect(nearestSlot(0, 3, 9)).toBe(3);
    expect(nearestSlot(-4, 2, 9)).toBe(-7);
    expect(nearestSlot(22, 4, 9)).toBe(22);
  });
});

describe("the place of a disc", () => {
  it("lays the discs on an arc, the front one largest and lifted", () => {
    const front = arcPose(0, true, 0);
    expect(front.x).toBe(0);
    expect(front.z).toBe(0);
    expect(front.scale).toBe(1);
    expect(front.y).toBeCloseTo(FIELD.frontLift);
    const next = arcPose(1, false, 0);
    const prev = arcPose(-1, false, 0);
    expect(next.x).toBeCloseTo(-prev.x);
    expect(next.z).toBeCloseTo(prev.z);
    expect(next.z).toBeGreaterThan(0);
    expect(next.ry).toBeCloseTo(-FIELD.arcStep);
    expect(next.scale).toBeLessThan(1);
    expect(arcPose(5, false, 0).scale).toBe(FIELD.sideScale);
  });

  it("leans and dips with the speed, within bounds", () => {
    expect(leanOf(0)).toBe(0);
    expect(leanOf(40)).toBeLessThanOrEqual(0.3);
    expect(leanOf(-40)).toBeGreaterThanOrEqual(-0.3);
    expect(Math.sign(leanOf(-2))).toBe(-1);
    expect(dipOf(100)).toBeLessThanOrEqual(0.09);
    const moving = arcPose(0, true, 6);
    expect(moving.y).toBeLessThan(FIELD.frontLift);
    expect(moving.rz).not.toBe(0);
  });

  it("lines the discs up in a row on a narrow screen, dropping and receding on the sides", () => {
    const front = rowPose(0, true, 0);
    expect(front.scale).toBe(1.5);
    const right = rowPose(1, false, 0);
    const left = rowPose(-1, false, 0);
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
    expect(right.y).toBeLessThan(front.y);
    expect(right.z).toBeLessThan(0);
    // The left disc turns the other way, like the left page of a book.
    expect(left.ry).toBeGreaterThan(right.ry);
  });

  it("lets far discs trail behind the near ones", () => {
    const dt = 1 / 60;
    expect(followShare(0, dt, false)).toBeCloseTo(dt * FOLLOW.base);
    expect(followShare(3, dt, false)).toBeLessThan(followShare(0, dt, false));
    expect(followShare(10, dt, false)).toBeCloseTo(dt * FOLLOW.min);
    expect(followShare(0, dt, true)).toBeCloseTo(dt * FOLLOW.tight);
    expect(followShare(0, 1, false)).toBe(1);
  });
});

describe("the motion", () => {
  it("glides longer for farther presses and kicks the lean", () => {
    expect(glideFor("wheel", 1).duration).toBeCloseTo(0.51);
    expect(glideFor("click", 4).duration).toBeGreaterThan(glideFor("click", 1).duration);
    expect(glideFor("click", 20).duration).toBeLessThanOrEqual(1.05);
    expect(glideFor("click", 20).kick).toBe(5);
    expect(glideFor("flick", 1).kick).toBe(0);
  });

  it("eases like a cubic Bezier curve", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 4);
    expect(glideEase(0)).toBe(0);
    expect(glideEase(1)).toBe(1);
    let last = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const v = glideEase(t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    // Quick out of the start: more than half way at a quarter of the time.
    expect(glideEase(0.25)).toBeGreaterThan(0.5);
  });

  it("brings the near discs in first during the entrance", () => {
    expect(arrival(0, 1)).toBe(0);
    expect(arrival(1, 1)).toBe(1);
    expect(arrival(1, 4)).toBe(1);
    expect(arrival(0.4, 1)).toBeGreaterThan(arrival(0.4, 4));
  });
});
