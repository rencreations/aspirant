import { describe, expect, it } from "vitest";

import {
  PointerTrail,
  PRESS_STRENGTH,
  TRAIL_GAP,
  TRAIL_LEN,
  TRAIL_LIFE,
  TRAIL_MOVE,
} from "./trail";

const DT = 1 / 60;

/** Move the pointer along a line in `steps` frames. */
function drag(trail: PointerTrail, from: number, to: number, steps: number, y = 0.5): void {
  for (let i = 0; i <= steps; i++) {
    trail.step(DT, from + ((to - from) * i) / steps, y, true, false);
  }
}

describe("PointerTrail", () => {
  it("leaves nothing for a pointer that stands still or has not arrived", () => {
    const t = new PointerTrail();
    for (let i = 0; i < 120; i++) t.step(DT, 0.4, 0.4, true, false);
    expect(t.alive).toBe(0);
    for (let i = 0; i < 120; i++) t.step(DT, 0.9, 0.9, false, false);
    expect(t.alive).toBe(0);
  });

  it("leaves a ripple at the pointer after it has moved far enough, and not before", () => {
    const t = new PointerTrail();
    t.step(DT, 0.4, 0.5, true, false);
    t.step(1, 0.4 + TRAIL_MOVE * 0.5, 0.5, true, false);
    expect(t.alive).toBe(0);
    t.step(1, 0.4 + TRAIL_MOVE * 1.2, 0.5, true, false);
    expect(t.alive).toBe(1);
    expect(t.data[0]).toBeCloseTo(0.4 + TRAIL_MOVE * 1.2, 5);
    expect(t.data[1]).toBeCloseTo(0.5, 5);
    expect(t.data[2]).toBe(0);
    expect(t.data[3]).toBeGreaterThan(0);
  });

  it("does not leave two ripples closer in time than the gap", () => {
    const t = new PointerTrail();
    t.step(DT, 0.1, 0.5, true, false);
    t.step(TRAIL_GAP / 4, 0.2, 0.5, true, false);
    t.step(TRAIL_GAP / 4, 0.3, 0.5, true, false);
    expect(t.alive).toBe(1);
  });

  it("ages a ripple and drops it at the end of its life", () => {
    const t = new PointerTrail();
    t.step(DT, 0.1, 0.5, true, false);
    t.step(DT, 0.3, 0.5, true, false);
    expect(t.alive).toBe(1);
    t.step(1, 0.3, 0.5, true, false);
    expect(t.data[2]).toBeCloseTo(1, 5);
    t.step(TRAIL_LIFE, 0.3, 0.5, true, false);
    expect(t.alive).toBe(0);
    expect(t.data[3]).toBe(0);
  });

  it("is held still by a frame of no time (a frozen frame)", () => {
    const t = new PointerTrail();
    t.step(DT, 0.1, 0.5, true, false);
    t.step(DT, 0.3, 0.5, true, false);
    const before = Array.from(t.data);
    for (let i = 0; i < 10; i++) t.step(0, 0.3, 0.5, true, false);
    expect(Array.from(t.data)).toEqual(before);
  });

  it("leaves a stronger one for a press, even from a finger that never hovered", () => {
    const t = new PointerTrail();
    t.step(DT, 0.7, 0.2, false, true);
    expect(t.alive).toBe(1);
    expect(t.data[3]).toBe(PRESS_STRENGTH);
    expect(t.data[0]).toBeCloseTo(0.7, 5);
    // A held press is one ripple.
    for (let i = 0; i < 30; i++) t.step(DT, 0.7, 0.2, false, true);
    expect(t.alive).toBe(1);
  });

  it("keeps ten at most and overwrites the oldest", () => {
    const t = new PointerTrail();
    drag(t, 0.05, 0.95, 600);
    expect(t.alive).toBeLessThanOrEqual(TRAIL_LEN);
    for (let i = 0; i < 40; i++) t.step(0.2, 0.95, 0.5, true, false);
    expect(t.alive).toBe(0);
    for (let k = 0; k < 14; k++) {
      t.step(TRAIL_GAP * 2, 0.05 + k * 0.06, 0.5, true, false);
    }
    expect(t.alive).toBeLessThanOrEqual(TRAIL_LEN);
    expect(t.alive).toBeGreaterThan(5);
  });

  it("has a stronger ripple for a faster move", () => {
    const slow = new PointerTrail();
    slow.step(DT, 0.2, 0.5, true, false);
    slow.step(DT, 0.2 + TRAIL_MOVE * 1.1, 0.5, true, false);
    const fast = new PointerTrail();
    fast.step(DT, 0.2, 0.5, true, false);
    fast.step(DT, 0.5, 0.5, true, false);
    expect(fast.data[3]!).toBeGreaterThan(slow.data[3]!);
  });

  it("forgets everything on clear", () => {
    const t = new PointerTrail();
    t.step(DT, 0.7, 0.2, false, true);
    t.clear();
    expect(t.alive).toBe(0);
    expect(Array.from(t.data).every((v) => v === 0)).toBe(true);
  });
});
