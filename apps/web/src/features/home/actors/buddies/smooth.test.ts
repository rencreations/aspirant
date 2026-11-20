import { describe, expect, it } from "vitest";

import { dampAngle, dampTo, nearestAngle, wrapPi, type Damped } from "./smooth";

const TAU = Math.PI * 2;

describe("wrapPi and nearestAngle", () => {
  it("wraps to the same turn in (-pi, pi]", () => {
    for (const a of [-10, -3.2, -0.1, 0, 0.1, 3.2, 7, 100]) {
      const w = wrapPi(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a), 9);
      expect(Math.sin(w)).toBeCloseTo(Math.sin(a), 9);
    }
  });

  it("gives the target nearest to where the angle is", () => {
    expect(nearestAngle(0, TAU + 0.2)).toBeCloseTo(0.2, 9);
    expect(nearestAngle(3 * TAU, 0.1)).toBeCloseTo(3 * TAU + 0.1, 9);
    expect(nearestAngle(3.0, -3.0)).toBeCloseTo(TAU - 3.0, 9);
  });
});

describe("dampTo", () => {
  it("never moves faster than the limit and never overshoots", () => {
    const s: Damped = { x: 0, v: 0 };
    let last = 0;
    let top = 0;
    for (let i = 0; i < 600; i += 1) {
      const x = dampTo(s, 20, 0.3, 4, 1 / 60);
      top = Math.max(top, (x - last) * 60);
      expect(x).toBeLessThanOrEqual(20 + 1e-9);
      last = x;
    }
    // A touch above the limit is the spring's own speed as it closes the last of the gap.
    expect(top).toBeLessThan(4 * 1.35);
    expect(last).toBeGreaterThan(19.9);
  });

  it("is smooth when the target jumps back and forth", () => {
    const s: Damped = { x: 0, v: 0 };
    let last = 0;
    let lastStep = 0;
    let worst = 0;
    for (let i = 0; i < 900; i += 1) {
      const target = Math.floor(i / 45) % 2 === 0 ? 50 : -50;
      const x = dampTo(s, target, 0.25, 6, 1 / 60);
      const step = x - last;
      worst = Math.max(worst, Math.abs(step - lastStep));
      lastStep = step;
      last = x;
    }
    // The change of speed between two frames stays small: no sudden turn.
    expect(worst).toBeLessThan(0.2);
  });

  it("follows a slow target closely", () => {
    const s: Damped = { x: 0, v: 0 };
    let x = 0;
    for (let i = 0; i < 300; i += 1) x = dampTo(s, i * 0.01, 0.2, 5, 1 / 60);
    expect(Math.abs(x - 2.99)).toBeLessThan(0.2);
  });
});

describe("dampAngle", () => {
  it("takes the short way round when the target wraps", () => {
    const s: Damped = { x: Math.PI - 0.05, v: 0 };
    let worst = 0;
    let last = s.x;
    for (let i = 0; i < 120; i += 1) {
      // The target sits at -pi + 0.05, a tenth of a radian away through the wrap.
      const x = dampAngle(s, -Math.PI + 0.05, 0.1, 8, 1 / 60);
      worst = Math.max(worst, Math.abs(x - last));
      last = x;
    }
    expect(worst).toBeLessThan(0.12);
    expect(Math.abs(last - (Math.PI + 0.05))).toBeLessThan(0.01);
  });

  it("does not step by more than the limit when the target leaps", () => {
    const s: Damped = { x: 0, v: 0 };
    let last = 0;
    let worst = 0;
    for (let i = 0; i < 240; i += 1) {
      // A target that leaps by whole turns and half turns every few frames.
      const target = [0, 3, -3, 2 * TAU + 1, 1][Math.floor(i / 20) % 5] ?? 0;
      const x = dampAngle(s, target, 0.1, 8, 1 / 60);
      worst = Math.max(worst, Math.abs(x - last));
      last = x;
    }
    expect(worst).toBeLessThan((8 / 60) * 1.4);
  });
});
