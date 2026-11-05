import { describe, expect, it } from "vitest";

import { REST, ribbonPose } from "./ribbon-math";

describe("ribbon pose", () => {
  it("lifts and grows the panel under the pointer, and does not push it sideways", () => {
    const p = ribbonPose(0);
    expect(p.scale).toBeCloseTo(1.1);
    expect(p.lift).toBeCloseTo(-14);
    expect(p.push).toBe(0);
    expect(p.slide).toBe(0);
  });

  it("steps the neighbours away from the pointer", () => {
    // d > 0: the pointer is to the right of the panel, so the panel steps left.
    expect(ribbonPose(1).push).toBeLessThan(0);
    expect(ribbonPose(-1).push).toBeGreaterThan(0);
    expect(ribbonPose(1).push).toBeCloseTo(-ribbonPose(-1).push);
  });

  it("settles to rest far from the pointer", () => {
    const far = ribbonPose(6);
    expect(far.scale).toBeCloseTo(REST.scale, 3);
    expect(far.lift).toBeCloseTo(0, 3);
    expect(Math.abs(far.push)).toBeLessThan(0.01);
  });

  it("slides the picture toward the pointer, within limits", () => {
    expect(ribbonPose(0.5).slide).toBeGreaterThan(0);
    expect(ribbonPose(-0.5).slide).toBeLessThan(0);
    expect(ribbonPose(10).slide).toBe(6);
    expect(ribbonPose(-10).slide).toBe(-6);
  });
});
