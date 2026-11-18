import { describe, expect, it } from "vitest";

import { Spring, approach, clamp, easeInOutCubic, easeOutCubic, lerp, smoothstep } from "./motion";

describe("easings", () => {
  it("clamp, lerp and smoothstep hold their ends", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    // An inverted pair of edges is the mirror.
    expect(smoothstep(1, 0, 0.25)).toBeCloseTo(1 - smoothstep(0, 1, 0.25), 6);
  });

  it("the cubics go from 0 to 1 and never leave that range", () => {
    for (const f of [easeOutCubic, easeInOutCubic]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBeCloseTo(1, 9);
      expect(f(-3)).toBe(0);
      expect(f(4)).toBeCloseTo(1, 9);
      let last = -1;
      for (let i = 0; i <= 20; i += 1) {
        const v = f(i / 20);
        expect(v).toBeGreaterThanOrEqual(last);
        last = v;
      }
    }
    // Out is quick at the start, in-out is slow at the start.
    expect(easeOutCubic(0.2)).toBeGreaterThan(0.4);
    expect(easeInOutCubic(0.2)).toBeLessThan(0.1);
  });

  it("approach never overshoots and does nothing in no time", () => {
    expect(approach(0, 1, 8, 0)).toBe(0);
    const a = approach(0, 1, 8, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(approach(0, 1, 8, 10)).toBeCloseTo(1, 6);
  });
});

describe("Spring", () => {
  it("settles on its target, with a little overshoot when under damped", () => {
    const s = new Spring(2 * Math.PI * 1.5, 0.5, 0);
    let peak = 0;
    for (let i = 0; i < 240; i += 1) peak = Math.max(peak, s.step(1, 1 / 60));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.3);
    expect(s.x).toBeCloseTo(1, 3);
  });

  it("does not move when the frame has no time, and snap puts it at rest", () => {
    const s = new Spring(9, 0.5, 0.4);
    expect(s.step(1, 0)).toBe(0.4);
    s.step(1, 0.05);
    expect(s.v).not.toBe(0);
    s.snap(0.2);
    expect(s.x).toBe(0.2);
    expect(s.v).toBe(0);
  });

  it("survives a very long frame", () => {
    const s = new Spring(2 * Math.PI * 1.5, 0.5, 0);
    for (let i = 0; i < 20; i += 1) s.step(1, 0.5);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x - 1)).toBeLessThan(0.05);
  });

  it("a kick adds speed", () => {
    const s = new Spring(9, 0.4, 0);
    s.kick(-100);
    s.step(0, 1 / 60);
    expect(s.x).toBeLessThan(0);
  });
});
