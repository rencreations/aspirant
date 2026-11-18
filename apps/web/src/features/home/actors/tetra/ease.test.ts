import { describe, expect, it } from "vitest";

import { bump, clamp, clamp01, easeOutBack, makeRandom, ramp, springTo } from "./ease";

describe("ease", () => {
  it("clamps", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
  });

  it("ramps softly from 0 to 1 and stays", () => {
    expect(ramp(1, 2, 0)).toBe(0);
    expect(ramp(1, 2, 3)).toBe(1);
    expect(ramp(1, 2, 1.5)).toBeCloseTo(0.5, 9);
  });

  it("bumps up and back", () => {
    expect(bump(0)).toBeCloseTo(0, 9);
    expect(bump(0.5)).toBeCloseTo(1, 9);
    expect(bump(1)).toBeCloseTo(0, 9);
  });

  it("pops past one and settles on it", () => {
    let peak = 0;
    for (let i = 0; i <= 100; i += 1) peak = Math.max(peak, easeOutBack(i / 100));
    expect(peak).toBeGreaterThan(1.05);
    expect(easeOutBack(1)).toBeCloseTo(1, 9);
    expect(easeOutBack(0)).toBeCloseTo(0, 9);
  });

  it("a spring settles on its target without passing it, at any rate", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      const s = { x: 0, v: 0 };
      for (let t = 0; t < 2; t += dt) {
        springTo(s, 1, 10, dt);
        expect(s.x).toBeLessThanOrEqual(1 + 1e-9);
      }
      expect(s.x).toBeCloseTo(1, 3);
    }
  });

  it("a seeded random repeats", () => {
    const a = makeRandom(4);
    const b = makeRandom(4);
    for (let i = 0; i < 20; i += 1) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
