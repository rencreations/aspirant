import { describe, expect, it } from "vitest";

import { Spring, approach, clamp, makeRandom, smoothstep } from "./motion";

describe("motion helpers", () => {
  it("clamps and eases", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
  });

  it("approach is 0 for no time and tends to 1", () => {
    expect(approach(8, 0)).toBe(0);
    expect(approach(8, -1)).toBe(0);
    expect(approach(8, 10)).toBeGreaterThan(0.999);
  });

  it("a spring settles on the target, from any step size", () => {
    for (const dt of [1 / 240, 1 / 60, 0.05, 0.5, 5]) {
      const s = new Spring(9, 0.5, 0);
      for (let i = 0; i < Math.ceil(6 / dt); i += 1) s.step(1, dt);
      expect(s.x).toBeCloseTo(1, 3);
      expect(Math.abs(s.v)).toBeLessThan(1e-3);
    }
  });

  it("an under damped spring overshoots, a critical one does not", () => {
    const under = new Spring(10, 0.3, 0);
    const critical = new Spring(10, 1, 0);
    let maxUnder = 0;
    let maxCritical = 0;
    for (let i = 0; i < 240; i += 1) {
      maxUnder = Math.max(maxUnder, under.step(1, 1 / 60));
      maxCritical = Math.max(maxCritical, critical.step(1, 1 / 60));
    }
    expect(maxUnder).toBeGreaterThan(1.1);
    expect(maxCritical).toBeLessThanOrEqual(1.0001);
  });

  it("a zero step changes nothing, snap and kick work", () => {
    const s = new Spring(9, 0.5, 2);
    expect(s.step(0, 0)).toBe(2);
    s.snap(5);
    expect(s.x).toBe(5);
    expect(s.v).toBe(0);
    s.kick(3);
    expect(s.v).toBe(3);
  });

  it("the random is deterministic and in range", () => {
    const a = makeRandom(7);
    const b = makeRandom(7);
    for (let i = 0; i < 50; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
