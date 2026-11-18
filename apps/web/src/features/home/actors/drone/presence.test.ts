import { describe, expect, it } from "vitest";

import { createPresence, GONE, stepPresence } from "./presence";

function run(p: ReturnType<typeof createPresence>, here: boolean, seconds: number, hz: number) {
  const dt = 1 / hz;
  const samples: number[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    stepPresence(p, here, dt);
    samples.push(p.x);
  }
  return samples;
}

describe("the presence of the drone", () => {
  it("pops in: it passes 1, then settles on it", () => {
    const p = createPresence(false);
    const samples = run(p, true, 1.5, 60);
    const peak = Math.max(...samples);
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.4);
    expect(p.x).toBeCloseTo(1, 2);
    expect(Math.abs(p.v)).toBeLessThan(0.01);
  });

  it("is at least half there after a tenth of a second, so a pop is quick", () => {
    const p = createPresence(false);
    run(p, true, 0.12, 60);
    expect(p.x).toBeGreaterThan(0.5);
  });

  it("goes without overshoot and is gone in half a second", () => {
    const p = createPresence(true);
    const samples = run(p, false, 0.5, 60);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(samples.every((v, i) => i === 0 || v <= (samples[i - 1] ?? 1))).toBe(true);
    expect(p.x).toBe(0);
  });

  it("gives about the same line at 60 and at 144 Hz", () => {
    const a = createPresence(false);
    const b = createPresence(false);
    run(a, true, 0.4, 60);
    run(b, true, 0.4, 144);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.03);
    const c = createPresence(true);
    const d = createPresence(true);
    run(c, false, 0.2, 60);
    run(d, false, 0.2, 144);
    expect(Math.abs(c.x - d.x)).toBeLessThan(0.01);
  });

  it("does nothing when time stands still or runs backward", () => {
    const p = createPresence(false);
    stepPresence(p, true, 0);
    stepPresence(p, true, -1);
    stepPresence(p, true, Number.NaN);
    expect(p).toEqual({ x: 0, v: 0 });
  });

  it("never goes below the floor that counts as gone", () => {
    const p = createPresence(true);
    run(p, false, 2, 60);
    expect(p.x === 0 || p.x >= GONE).toBe(true);
  });

  it("copes with one very long frame", () => {
    const p = createPresence(false);
    stepPresence(p, true, 0.5);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.x).toBeLessThan(1.5);
  });
});
