import { clamp, damp, lerp, map, mulberry32, smoothstep, wrap } from "./math";

describe("math", () => {
  it("clamps", () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, -2, 2)).toBe(-2);
  });

  it("lerps", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("damps toward the target independent of frame rate", () => {
    const oneStep = damp(0, 1, 8, 1 / 30);
    let twoSteps = damp(0, 1, 8, 1 / 60);
    twoSteps = damp(twoSteps, 1, 8, 1 / 60);
    expect(oneStep).toBeCloseTo(twoSteps, 10);
    expect(damp(0, 1, 8, 10)).toBeCloseTo(1, 6);
    expect(damp(0, 1, 8, 0)).toBe(0);
  });

  it("maps ranges, clamped by default", () => {
    expect(map(5, 0, 10, 0, 100)).toBe(50);
    expect(map(20, 0, 10, 0, 100)).toBe(100);
    expect(map(20, 0, 10, 0, 100, false)).toBe(200);
    expect(map(1, 1, 1, 3, 4)).toBe(3);
  });

  it("smoothsteps", () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it("wraps indices both ways", () => {
    expect(wrap(10, 10)).toBe(0);
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(23, 10)).toBe(3);
  });

  it("mulberry32 is deterministic and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const values = Array.from({ length: 1000 }, () => a());
    expect(values.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
